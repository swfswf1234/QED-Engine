/**
 * 学习工作台 store（v1.0：章 → 知识点两级，逐条知识点推进）
 * - 左＝`GET …/knowledge-points` 的 `sequence`（主表 point 行 × 章 outline × kp 行读时投影，
 *   进场只读零写入）；`unit.learner` 携自己的勾选与质性门态，没有落笔过＝null
 * - 中＝`GET /api/v1/books/{id}/pages/{n}` 按选中知识点的正文范围 8 页/批懒取，滚动自动续取（只读，不写回）；
 *   标题之下只排书页内容，界面不写任何说明话术，缺页窗即空白
 * - 右＝批注四段闭集（§6：本章总结／本章学习导读／知识点总结／记录）：前三段只读、缺位整段不渲染，
 *   本面零生成入口；导读走 8900 的梳理透传读腿（取数键＝章行提升锚 `from_detail_id`），记录＝kp 行 `learner_note`
 * - 推进不在右栏：中栏卡片底部居中三枚（上一条／下一条／已掌握并下一条，同一条再点＝撤销）
 * - 页头「刷新」＝同步＋重取（REQ-144 裁乙的唯一同步入口，进场不触发）：先 `POST …/knowledge-points/sync`
 *   把整理好的内容提升到本课目录，再重取目录／序列／进度；同步没跑通只出 `syncError` 一条提示，三栏形态不动
 * - 目录为空者进场自动定位目录页并整树写入（§7 步 0），置信不足即不写猜测值
 * - 数据一律经 8900（ADR 0007）；写后整体重取，不做乐观更新（判例 stores/courseKnowledge）
 */
import { create } from 'zustand';
import { getBookPage, listBooks, type Block, type BookMeta, type PageData } from '../api/axiom';
import { ApiError, describeError } from '../api/client';
import {
  getCourseKnowledge, getLearnProgress, syncCourseKnowledge,
  getOutline, getStarMap, listLearnCourses, putOutline, setLearnProgress,
  type KpSourceRef, type LearnCourse, type LearnProgress,
  type OutlineRow, type PointChapter, type PointUnit,
} from '../api/learn';
import { assignRoles, layoutUnits } from '../components/parsing/typography';
import { blocksOf } from '../components/parsing/CompareView';
import { blockText } from '../components/parsing/blocks';
import { autoLocateToc, toOutlinePayload, type BodyPageText } from '../tocParse';

/** 中栏每批懒取页数（一章 ~20 页，不整章一次拉完） */
export const PAGE_BATCH = 8;

/** 自动定位目录页的扫描页数上限（封面/扉页之后目录必在其内，超限即降级人工） */
export const TOC_SCAN_PAGES = 20;

/** 知识点推进键前缀（服务端同口径，§V2.3 派生键） */
export const POINT_KEY_PREFIX = 'kp:';

export interface PageEntry {
  loading: boolean;
  parsed: boolean;
  data: PageData | null;
  error: string | null;
}

export interface SelectedBlock {
  page: number;
  index: number;
  snippet: string;
}

export interface CourseRef {
  course_id: string;
  name: string;
  track: string;
  domain_id: string;
}

export interface PageRange {
  start: number;
  end: number;
}

/** 课程教材行（注册顺序＝学习顺序；未激活解析版本者不贡献目录与正文） */
export interface WorkbenchText {
  bookId: string;
  label: string;
  active: boolean;
  pageCount: number | null;
}

export type TocPhase = 'ready' | 'generating' | 'failed';

/** 选中位：知识点（常规）或整章（该章还在整理时的次级入口，§V2.10 待裁项③） */
export interface Selection {
  kind: 'point' | 'chapter';
  kpId: string;
}

/** 正文范围（知识点自带 → 来源锚点 → 所属整章，三级由服务端回落并标注来处） */
export function rangeOfRef(ref: { page_start?: number; page_end?: number } | null | undefined): PageRange | null {
  if (!ref) return null;
  const start = ref.page_start;
  const end = ref.page_end;
  if (typeof start !== 'number' || typeof end !== 'number' || start < 1 || end < start) return null;
  return { start, end };
}

/** outline 行 → 整章阅读可用的范围（该章没有知识点时的次级入口） */
export function chapterOf(
  chapters: readonly PointChapter[],
  kpId: string | null,
): PointChapter | null {
  if (!kpId) return null;
  return chapters.find((row) => row.kp_id === kpId) ?? null;
}

/** 知识点按所属章归组（章序＝后端给出的 chapters 序，章内按 sort_order） */
export function pointsOfChapter(units: readonly PointUnit[], chapterUnitId: string): PointUnit[] {
  return units
    .filter((unit) => unit.parent_id === chapterUnitId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** 知识点所属的章行（整章阅读时直接命中；没有所属章＝null） */
export function chapterOfUnit(
  chapters: readonly PointChapter[],
  point: PointUnit | null | undefined,
): PointChapter | null {
  if (!point?.parent_id) return null;
  return chapters.find((row) => row.unit_id === point.parent_id) ?? null;
}

/** 「已学」位＝kp 行终态位（covered 列随 qe_unit 退出，ADR 0026 D2） */
export function isCovered(point: PointUnit | null | undefined): boolean {
  return point?.learner?.status === 'done';
}

/**
 * 非教材的取材位（习题集／答案本）：只读服务端 `derived.books[].textbook` 一枚布尔位（T5）。
 * 位缺失＝角色未知，不过滤（判据不在前端重算，也不把缺数据当成「不是教材」）。
 */
export function nonTextbookRefs(learnCourse: LearnCourse | null): Set<string> {
  return new Set(
    (learnCourse?.derived.books ?? [])
      .filter((book) => book.textbook === false)
      .map((book) => book.ref_id),
  );
}

/** 序列按书切（T4）：`sequence` 是课程级返回，本面只留归本位等于当前这本的行；无书可切＝整条课程级序列 */
export function withinBook<T extends { book_ref?: string | null }>(rows: readonly T[], bookId: string | null): T[] {
  if (!bookId) return [...rows];
  return rows.filter((row) => (row.book_ref ?? '') === bookId);
}

export interface FlowPage {
  page: number;
  blocks: Block[];
}

/**
 * 连续正文流的跨页缝合（§V2.4.2~3）：把已取页的块拉平成一条序列做角色判定与排版单元归并，
 * 再按「首个原块所属页」重新分组成逐页渲染单元——页只作为取字与页图的归属，不再是界面上的口径。
 */
export function flowPages(pages: readonly FlowPage[]): FlowPage[] {
  const flat: Block[] = [];
  const owner: number[] = [];
  for (const entry of pages) {
    for (const block of entry.blocks) {
      flat.push(block);
      owner.push(entry.page);
    }
  }
  const out: FlowPage[] = [];
  for (const unit of layoutUnits(flat, assignRoles(flat))) {
    const page = owner[unit.indices[0]];
    const last = out[out.length - 1];
    if (last && last.page === page) last.blocks.push(unit.block);
    else out.push({ page, blocks: [unit.block] });
  }
  return out;
}

const emptyPage: PageEntry = { loading: false, parsed: false, data: null, error: null };

export interface LearnWorkbenchStore {
  courseId: string | null;
  course: CourseRef | null;
  learnCourse: LearnCourse | null;
  texts: WorkbenchText[];
  outline: OutlineRow[];
  tocPhase: Record<string, TocPhase>;
  bookId: string | null;
  /** 知识点推进序列（主表 point 行 × kp 行的读时投影，落笔态在 `unit.learner`） */
  pointUnits: PointUnit[];
  chapters: PointChapter[];
  selected: Selection | null;
  /** 批注归属＝当前读到的那一条（知识点或整章） */
  selectedKpId: string | null;
  selectedPoint: PointUnit | null;
  progress: LearnProgress | null;
  /** 推进区数据不可达（不影响阅读与批注） */
  progressError: string | null;
  /** 当前这一条的正文范围 */
  range: PageRange | null;
  /** 该范围的来处：point／anchor／chapter／空＝还没定位到 */
  windowSource: 'point' | 'anchor' | 'chapter' | '';
  pages: Record<number, PageEntry>;
  /** 已发起加载的最后一页（0＝未加载） */
  loadedThrough: number;
  selectedBlock: SelectedBlock | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  /** 页头「刷新」的同步腿没跑通（只出一条提示，三栏仍按上一次的结果；§10） */
  syncError: string | null;
  fetchCourse: (urlParam: string, initialBookId?: string) => Promise<void>;
  reloadOutline: () => Promise<void>;
  /** 重取推进序列（自己的勾选与记录都随这一路回来） */
  reloadPoints: () => Promise<void>;
  selectPoint: (kpId: string) => Promise<void>;
  selectChapter: (kpId: string) => Promise<void>;
  loadMorePages: () => Promise<void>;
  selectBlock: (block: SelectedBlock | null) => void;
  /** 记录（§6 段④）：写 kp 行 `learner_note`，随当前终态位整笔提交 */
  saveNote: (text: string) => Promise<boolean>;
  markSelected: (status: 'done' | 'pending') => Promise<boolean>;
  /** 沿左栏顺序前走／后走一条（章内读完自动跨章续走；走到头给明确提示） */
  step: (delta: 1 | -1) => Promise<void>;
  /** 已掌握并下一条（C25）：记上这一条再往前走；已掌握的那条再点＝撤销且不动位置 */
  masterAndNext: () => Promise<void>;
  /** 页头「刷新」＝同步＋重取（REQ-144 裁乙的唯一同步入口，进场不触发）：先提升本课各册整理好的内容，再重取目录／序列／进度 */
  refresh: () => Promise<void>;
  clearNotice: () => void;
}

export const useLearnWorkbenchStore = create<LearnWorkbenchStore>((set, get) => {
  /** 拉一页并写回 pages（404＝该页没有可展示的内容，不算错误） */
  const loadPage = async (bookId: string, pageNo: number) => {
    set((s) => ({ pages: { ...s.pages, [pageNo]: { ...emptyPage, loading: true } } }));
    try {
      const data = await getBookPage(bookId, pageNo);
      set((s) => ({ pages: { ...s.pages, [pageNo]: { loading: false, parsed: true, data, error: null } } }));
    } catch (err) {
      const missing = err instanceof ApiError && err.status === 404;
      set((s) => ({
        pages: {
          ...s.pages,
          [pageNo]: { loading: false, parsed: false, data: null, error: missing ? null : describeError(err) },
        },
      }));
    }
  };

  /** 从 range 的 start 推进一批（至多 PAGE_BATCH 页） */
  const advanceBatch = async () => {
    const { bookId, range, loadedThrough } = get();
    if (!bookId || !range) return;
    const from = Math.max(range.start, loadedThrough + 1);
    if (from > range.end) return;
    const to = Math.min(range.end, from + PAGE_BATCH - 1);
    set({ loadedThrough: to });
    await Promise.all(Array.from({ length: to - from + 1 }, (_, i) => loadPage(bookId, from + i)));
  };

  const refreshProgress = async () => {
    const { learnCourse } = get();
    if (!learnCourse) return;
    try {
      set({ progress: await getLearnProgress(learnCourse.learn_course_id), progressError: null });
    } catch {
      // 可见文案只出学习者话术：裸错误串（端口与状态码）不进学习面
      set({ progressError: '进度这次没读到，点右上「刷新」可以再取一次。' });
    }
  };

  /** 进场/刷新后的落点：当前选择仍在序列里就不动；否则有断点回到断点，再否则第一条知识点，一条也没有时落第一章整章阅读 */
  const restoreSelection = async () => {
    const { pointUnits, chapters, progress, selected } = get();
    if (selected?.kind === 'point' && pointUnits.some((unit) => unit.kp_id === selected.kpId)) return;
    if (selected?.kind === 'chapter' && chapters.some((row) => row.kp_id === selected.kpId)) return;
    const current = progress?.current_unit_id ?? '';
    if (current.startsWith(POINT_KEY_PREFIX)) {
      const kpId = current.slice(POINT_KEY_PREFIX.length);
      if (pointUnits.some((unit) => unit.kp_id === kpId)) {
        await get().selectPoint(kpId);
        return;
      }
    }
    const firstPoint = pointUnits[0];
    if (firstPoint) {
      await get().selectPoint(String(firstPoint.kp_id));
      return;
    }
    const firstChapter = chapters[0];
    if (firstChapter) await get().selectChapter(firstChapter.kp_id);
  };


  /** 当前这一条读的位置：知识点自带范围 → 整章范围（该章还在整理时的次级入口） */
  const applySelection = (selection: Selection | null) => {
    const { pointUnits, chapters, texts } = get();
    const fallbackBookId = texts.find((t) => t.active)?.bookId ?? null;
    if (!selection) {
      set({
        selected: null, selectedKpId: null, selectedPoint: null,
        range: null, windowSource: '', pages: {}, loadedThrough: 0, selectedBlock: null,
      });
      return;
    }
    let ref: KpSourceRef | null = null;
    let windowSource: 'point' | 'anchor' | 'chapter' | '' = '';
    let point: PointUnit | null = null;
    if (selection.kind === 'point') {
      point = pointUnits.find((unit) => unit.kp_id === selection.kpId) ?? null;
      ref = point?.source_ref ?? null;
      windowSource = point?.window_source ?? '';
    } else {
      ref = chapterOf(chapters, selection.kpId)?.source_ref ?? null;
      windowSource = ref ? 'chapter' : '';
    }
    const range = rangeOfRef(ref);
    const refId = typeof ref?.ref_id === 'string' ? ref.ref_id : '';
    set({
      selected: selection,
      selectedKpId: selection.kpId,
      selectedPoint: point,
      range,
      windowSource,
      bookId: refId || fallbackBookId || get().bookId,
      pages: {},
      loadedThrough: 0,
      selectedBlock: null,
    });
  };

  /** 进场自动定位目录页并整树写入（§7 步 0：只读已解析块文本，未命中即降级人工） */
  const autoGenerateToc = async (courseId: string, text: WorkbenchText) => {
    set((s) => ({ tocPhase: { ...s.tocPhase, [text.bookId]: 'generating' } }));
    try {
      const fetched = await Promise.all(
        Array.from({ length: TOC_SCAN_PAGES }, (_, i) => getBookPage(text.bookId, i + 1).catch(() => null)),
      );
      const pages: BodyPageText[] = [];
      fetched.forEach((data, index) => {
        if (data) pages.push({ page: index + 1, text: blocksOf(data).map((block) => blockText(block)).join('\n') });
      });
      const located = autoLocateToc(pages);
      const pageCount = text.pageCount;
      if (!located.ok || located.tree.length === 0 || located.offset === null || !pageCount) {
        set((s) => ({ tocPhase: { ...s.tocPhase, [text.bookId]: 'failed' } }));
        return;
      }
      const tree = toOutlinePayload(located.tree, located.offset, pageCount);
      await putOutline(courseId, { book_ref: text.bookId, tree });
      set((s) => ({ tocPhase: { ...s.tocPhase, [text.bookId]: 'ready' } }));
    } catch {
      set((s) => ({ tocPhase: { ...s.tocPhase, [text.bookId]: 'failed' } }));
    }
  };

  return {
    courseId: null,
    course: null,
    learnCourse: null,
    texts: [],
    outline: [],
    tocPhase: {},
    bookId: null,
    pointUnits: [],
    chapters: [],
    selected: null,
    selectedKpId: null,
    selectedPoint: null,
    progress: null,
    progressError: null,
    range: null,
    windowSource: '',
    pages: {},
    loadedThrough: 0,
    selectedBlock: null,
    loading: false,
    busy: false,
    error: null,
    notice: null,
    syncError: null,

    fetchCourse: async (urlParam, initialBookId) => {
      set({ loading: true, error: null, progressError: null, syncError: null });
      let learnCourse: LearnCourse | null = null;
      // 深链参数＝共享课程 ID（D4 后与学习课程 ID 同源，不再有两套坐标）
      const courseId = urlParam;
      try {
        const [star, allBooks, courseList] = await Promise.all([getStarMap(), listBooks(), listLearnCourses()]);
        learnCourse = courseList.courses.find((item) => item.learn_course_id === courseId) ?? null;
        const found = star.domains
          .flatMap((d) => d.tracks.flatMap((t) => t.courses.map((c) => ({ ...c, domain_id: d.domain_id }))))
          .find((c) => c.course_id === courseId);
        const metaOf = (bookId: string): BookMeta | undefined => allBooks.find((b) => b.book_id === bookId);
        const labelOf = (bookId: string, snapshot: string): string => {
          const meta = metaOf(bookId);
          return snapshot || meta?.display_title || meta?.title || bookId;
        };
        const hidden = nonTextbookRefs(learnCourse);
        const bookResources = (learnCourse?.resources ?? []).filter((r) => r.kind === 'book');
        const registered = bookResources.filter((r) => !hidden.has(r.ref_id));
        const texts: WorkbenchText[] = bookResources.length > 0
          ? registered.map((r) => ({
            bookId: r.ref_id,
            label: labelOf(r.ref_id, r.label),
            active: Boolean(metaOf(r.ref_id)?.active_job_id),
            pageCount: metaOf(r.ref_id)?.page_count ?? null,
          }))
          : allBooks
            .filter((b) => b.course_id === courseId)
            .map((b) => ({
              bookId: b.book_id,
              label: labelOf(b.book_id, ''),
              active: Boolean(b.active_job_id),
              pageCount: b.page_count ?? null,
            }));
        set({
          courseId,
          course: found
            ? { course_id: found.course_id, name: found.name, track: found.track, domain_id: found.domain_id }
            : { course_id: courseId, name: courseId, track: '', domain_id: '' },
          learnCourse,
          texts,
          bookId: texts.some((t) => t.bookId === initialBookId)
            ? initialBookId ?? null
            : get().bookId ?? texts.find((t) => t.active)?.bookId ?? null,
        });
      } catch (err) {
        set({ error: describeError(err), texts: [], learnCourse: null });
        return;
      } finally {
        set({ loading: false });
      }
      await get().reloadOutline();
      await get().reloadPoints();
      await restoreSelection();
    },

    reloadOutline: async () => {
      const { courseId, texts } = get();
      // 无教材可取＝没有可重建的目录：保持现有选择与候选，不写空值
      if (!courseId || texts.length === 0) return;
      const tocPhase = { ...get().tocPhase };
      const rows: OutlineRow[] = [];
      for (const text of texts) {
        if (!text.active) continue;
        let outline: OutlineRow[] = [];
        try {
          outline = (await getOutline(courseId, text.bookId)).outline;
        } catch {
          set({ notice: '目录这次没有取到，点右上「刷新」可以再取一次。' });
        }
        if (outline.length === 0 && tocPhase[text.bookId] !== 'failed' && tocPhase[text.bookId] !== 'generating') {
          await autoGenerateToc(courseId, text);
          if (get().tocPhase[text.bookId] === 'ready') {
            outline = (await getOutline(courseId, text.bookId)).outline;
            tocPhase[text.bookId] = 'ready';
          } else {
            tocPhase[text.bookId] = get().tocPhase[text.bookId] ?? 'failed';
          }
        } else if (outline.length > 0) {
          tocPhase[text.bookId] = 'ready';
        }
        rows.push(...outline);
      }
      set({ outline: rows, tocPhase });
    },

    reloadPoints: async () => {
      const { courseId, learnCourse, selected } = get();
      if (!courseId || !learnCourse) {
        set({
          pointUnits: [], chapters: [], progress: null,
          progressError: '这一门课不在您的书架上，进度暂时记不上：回书架点「刷新」再进来。',
        });
        return;
      }
      let units: PointUnit[] = [];
      let chapters: PointChapter[] = [];
      try {
        const overview = await getCourseKnowledge(courseId);
        if (!overview.sequence.enrolled) {
          set({
            pointUnits: [], chapters: [], progress: null,
            progressError: '这一门课不在您的书架上，进度暂时记不上：回书架点「刷新」再进来。',
          });
          return;
        }
        // 序列按书切（T4）：课程级序列先按当前这本过滤，左栏／推进／断点全在过滤后的序列内走
        const book = get().bookId;
        units = withinBook(overview.sequence.units, book);
        // 章级成品位是后加的字段：旧返回缺位时补齐空值，右栏按「没有」处理而不是崩
        chapters = withinBook(overview.sequence.chapters, book).map((row) => ({
          ...row, summary: row.summary ?? '', key_points: row.key_points ?? [],
        }));
      } catch {
        set({ progressError: '这一条的学习情况这次没读到，点右上「刷新」可以再取一次。' });
        return;
      }
      set({ pointUnits: units, chapters, progressError: null });
      if (selected?.kind === 'point') {
        const keep = units.find((unit) => unit.kp_id === selected.kpId) ?? null;
        if (!keep) applySelection(null);
        else set({ selectedPoint: keep });
      }
      await refreshProgress();
    },

    selectPoint: async (kpId) => {
      applySelection({ kind: 'point', kpId });
      await advanceBatch();
    },

    selectChapter: async (kpId) => {
      applySelection({ kind: 'chapter', kpId });
      await advanceBatch();
    },

    loadMorePages: () => advanceBatch(),

    selectBlock: (block) => set({ selectedBlock: block }),

    saveNote: async (text) => {
      const { learnCourse, selected, selectedPoint } = get();
      const body = text.trim();
      if (!learnCourse || selected?.kind !== 'point' || body === '') return false;
      // 记录写 kp 行的 learner_note：这一条还没有 kp 行时服务端不起新行（界面已禁用保存，此处兜住并发）
      const learner = selectedPoint?.learner ?? null;
      if (!learner) return false;
      set({ busy: true });
      try {
        await setLearnProgress(learnCourse.learn_course_id, {
          kp_id: selected.kpId, status: learner.status, note: body,
        });
        await get().reloadPoints();
        set({ notice: '记录已保存。' });
        return true;
      } catch {
        set({ notice: '记录这次没有存上，可以再保存一次。' });
        return false;
      } finally {
        set({ busy: false });
      }
    },

    markSelected: async (status) => {
      const { learnCourse, selected, selectedPoint } = get();
      if (!learnCourse) {
        set({ notice: '这一门课不在您的书架上，进度暂时记不上' });
        return false;
      }
      if (selected?.kind !== 'point') {
        set({ notice: '整章阅读记不进进度：这一章的知识点整理好后才能逐条推进。' });
        return false;
      }
      const note = selectedPoint?.learner?.learner_note ?? '';
      set({ busy: true });
      try {
        await setLearnProgress(
          learnCourse.learn_course_id,
          { kp_id: selected.kpId, status, ...(note ? { note } : {}) },
        );
        await get().reloadPoints();
        return true;
      } catch {
        set({ notice: '这一条的进度这次没有记下，可以再点一次。' });
        return false;
      } finally {
        set({ busy: false });
      }
    },

    step: async (delta) => {
      const { pointUnits, chapters, selected } = get();
      if (pointUnits.length > 0) {
        const index = selected?.kind === 'point'
          ? pointUnits.findIndex((unit) => unit.kp_id === selected.kpId)
          : -1;
        if (index < 0) {
          set({ notice: '先在左栏选中一条知识点，前后走才有归属。' });
          return;
        }
        const next = pointUnits[index + delta];
        if (!next) {
          set({ notice: delta > 0 ? '已经到这本最后一条：回书架选另一本。' : '已经到这本第一条。' });
          return;
        }
        await get().selectPoint(String(next.kp_id));
        return;
      }
      const index = selected ? chapters.findIndex((row) => row.kp_id === selected.kpId) : -1;
      if (index < 0) {
        set({ notice: '先在左栏选中一章，前后走才有归属。' });
        return;
      }
      const next = chapters[index + delta];
      if (!next) {
        set({ notice: delta > 0 ? '已经到这本最后一章：回书架选另一本。' : '已经到这本第一章。' });
        return;
      }
      await get().selectChapter(next.kp_id);
    },

    masterAndNext: async () => {
      const { selected, selectedPoint } = get();
      if (selected?.kind !== 'point') {
        await get().markSelected('done');
        return;
      }
      if (isCovered(selectedPoint)) {
        await get().markSelected('pending');
        return;
      }
      const written = await get().markSelected('done');
      if (written) await get().step(1);
    },

    refresh: async () => {
      // 页头「刷新」＝同步＋重取（REQ-144 裁乙）：先把整理好的内容提升到本课目录，再按主表重读三态。
      // 同步失败不改三栏形态——目录与正文仍按上一次结果显示，只出一条提示（设计正本 §10 末二行）；
      // 提示位在每次刷新开头清掉，下一次刷新成功即撤下。
      const { courseId } = get();
      set({ syncError: null });
      if (courseId) {
        try {
          await syncCourseKnowledge(courseId);
        } catch (err) {
          set({ syncError: describeError(err) });
        }
      }
      await get().reloadOutline();
      await get().reloadPoints();
      await restoreSelection();
    },

    clearNotice: () => set({ notice: null }),
  };
});
