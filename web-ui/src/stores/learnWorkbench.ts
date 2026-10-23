/**
 * 学习工作台 store（v1.0：章 → 知识点两级，逐条知识点推进）
 * - 左＝`GET …/knowledge-points` 的 `sequence`（主表 point 行 × 章 outline × kp 行读时投影，
 *   进场只读零写入）；`unit.learner` 携自己的勾选与质性门态，没有落笔过＝null
 * - 中＝`GET /api/v1/books/{id}/pages/{n}` 按选中知识点的正文范围 8 页/批懒取，滚动自动续取（只读，不写回）
 * - 右＝学习交流三段（本章总结与学习要点 → 本条详解与长文 → 备注）：
 *   按需生成走根侧 `POST /learn/annotations/generate`（章＝覆写章行，条＝追加主表 `angles`），
 *   长文按主表 `narrative_ref` 读文件腿，备注＝kp 行 `learner_note`
 * - 推进不在右栏：正文末尾三枚（上一条／下一条／已掌握并下一条，同一条再点＝撤销）
 * - 目录为空者进场自动定位目录页并整树写入（§7 步 0），置信不足即不写猜测值
 * - 数据一律经 8900（ADR 0007）；写后整体重取，不做乐观更新（判例 stores/courseKnowledge）
 */
import { create } from 'zustand';
import { getBookPage, listBooks, type Block, type BookMeta, type PageData } from '../api/axiom';
import { ApiError, describeError } from '../api/client';
import {
  getCourseKnowledge, getLearnProgress, generateAnnotation,
  getOutline, getStarMap, listLearnCourses, putOutline, setLearnProgress,
  type AnnotationPart, type KpSourceRef, type LearnCourse, type LearnProgress,
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
 * 多角度注解的展示序＝主表 `angles` 数组序（数组序即权威排序，前端不重排）；
 * 只有带 note 的元素才是成品，同角不堆叠（覆写由服务端承载）。
 */
export function anglesOf(point: PointUnit | null | undefined) {
  return (point?.angles ?? []).filter((item) => typeof item?.note === 'string' && item.note !== '');
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

/** 注解生成腿的失败话术：这一手不在当前版本里（404/405）时给下一步，其余照原样显示后端那一句 */
const ANNOTATION_UNAVAILABLE = '这一手暂时生成不了：稍后点右上「刷新」再试。';

function annotationFailure(err: unknown, unavailable: string): string {
  if (err instanceof ApiError && (err.status === 404 || err.status === 405)) return unavailable;
  return err instanceof ApiError ? err.message : describeError(err);
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
  /** 注解按需生成中（一次一条，同步等待） */
  generating: boolean;
  generateError: string | null;
  /** 上一次生成失败落在哪一段：章级／条级，另一段不重复显示这句话 */
  generateTarget: 'chapter' | 'point' | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  fetchCourse: (urlParam: string, initialBookId?: string) => Promise<void>;
  reloadOutline: () => Promise<void>;
  /** 重取推进序列（勾选、备注、生成后的成品都随这一路回来） */
  reloadPoints: () => Promise<void>;
  selectPoint: (kpId: string) => Promise<void>;
  selectChapter: (kpId: string) => Promise<void>;
  loadMorePages: () => Promise<void>;
  selectBlock: (block: SelectedBlock | null) => void;
  /** 章级两件：缺什么生成什么，成品写回章行即可直读（§V2.5／C20） */
  generateChapter: () => Promise<void>;
  /** 条级注解：追加主表 `angles` 的 explanation 一元素（同角覆写不堆叠） */
  generatePoint: () => Promise<void>;
  /** 备注（C26）：写 kp 行 `learner_note`，随当前终态位整笔提交 */
  saveNote: (text: string) => Promise<boolean>;
  markSelected: (status: 'done' | 'pending') => Promise<boolean>;
  /** 沿左栏顺序前走／后走一条（章内读完自动跨章续走；走到头给明确提示） */
  step: (delta: 1 | -1) => Promise<void>;
  /** 已掌握并下一条（C25）：记上这一条再往前走；已掌握的那条再点＝撤销且不动位置 */
  masterAndNext: () => Promise<void>;
  /** 页头「刷新」＝重取目录＋推进序列＋进度，不触发任何生产 */
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
    } catch (err) {
      set({ progressError: describeError(err) });
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
    generating: false,
    generateError: null,
    generateTarget: null,
    loading: false,
    busy: false,
    error: null,
    notice: null,

    fetchCourse: async (urlParam, initialBookId) => {
      set({ loading: true, error: null, progressError: null });
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
        const registered = (learnCourse?.resources ?? []).filter((r) => r.kind === 'book');
        const texts: WorkbenchText[] = registered.length > 0
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
        } catch (err) {
          set({ notice: describeError(err) });
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
        units = overview.sequence.units;
        // 章级成品位是后加的字段：旧返回缺位时补齐空值，右栏按「没有」处理而不是崩
        chapters = overview.sequence.chapters.map((row) => ({
          ...row, summary: row.summary ?? '', key_points: row.key_points ?? [],
        }));
      } catch (err) {
        set({ progressError: describeError(err) });
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

    generateChapter: async () => {
      const { learnCourse, chapters, selected, selectedPoint, generating } = get();
      if (!learnCourse || !selected || generating) return;
      const chapter = selected.kind === 'point'
        ? chapterOfUnit(chapters, selectedPoint)
        : chapterOf(chapters, selected.kpId);
      if (!chapter) {
        set({ generateError: '这一条还没有归属的章：本章总结暂时生成不了。', generateTarget: 'chapter' });
        return;
      }
      const parts: AnnotationPart[] = [];
      if (!chapter.summary) parts.push('summary');
      if (chapter.key_points.length === 0) parts.push('key_points');
      if (parts.length === 0) return;
      set({ generating: true, generateError: null, generateTarget: 'chapter' });
      try {
        for (const part of parts) {
          const out = await generateAnnotation({
            course_id: learnCourse.learn_course_id, target_kind: 'chapter', kp_id: chapter.kp_id, part,
          });
          const patch = out.chapter;
          if (patch) {
            set((s) => ({
              chapters: s.chapters.map((row) => (
                row.kp_id === patch.kp_id
                  ? { ...row, summary: patch.summary ?? '', key_points: patch.key_points ?? [] }
                  : row
              )),
            }));
          }
        }
      } catch (err) {
        set({ generateError: annotationFailure(err, ANNOTATION_UNAVAILABLE), generateTarget: 'chapter' });
      } finally {
        set({ generating: false });
      }
    },

    generatePoint: async () => {
      const { learnCourse, selected, selectedKpId, generating } = get();
      if (!learnCourse || !selectedKpId || generating) return;
      if (selected?.kind !== 'point') {
        set({ generateError: '整章阅读时先写本章总结与学习要点。', generateTarget: 'point' });
        return;
      }
      set({ generating: true, generateError: null, generateTarget: 'point' });
      try {
        const out = await generateAnnotation({
          course_id: learnCourse.learn_course_id, target_kind: 'point', kp_id: selectedKpId, part: 'annotation',
        });
        const saved = out.point;
        if (saved) {
          set((s) => {
            const pointUnits = s.pointUnits.map((unit) => (
              unit.kp_id === saved.kp_id
                ? { ...unit, ...saved, node_kind: 'point' as const }
                : unit
            ));
            return {
              pointUnits,
              selectedPoint: s.selectedPoint?.kp_id === saved.kp_id
                ? pointUnits.find((unit) => unit.kp_id === saved.kp_id) ?? s.selectedPoint
                : s.selectedPoint,
            };
          });
        } else await get().reloadPoints();
      } catch (err) {
        set({ generateError: annotationFailure(err, ANNOTATION_UNAVAILABLE), generateTarget: 'point' });
      } finally {
        set({ generating: false });
      }
    },

    saveNote: async (text) => {
      const { learnCourse, selected, selectedPoint } = get();
      const body = text.trim();
      if (!learnCourse || selected?.kind !== 'point' || body === '') return false;
      // 备注写 kp 行的 learner_note：这一条还没有 kp 行时服务端不起新行，先记位置再写备注
      const learner = selectedPoint?.learner ?? null;
      if (!learner) {
        set({ notice: '这一条还没有学习记录：先用正文末尾的「已掌握并下一条」记上，备注就存得下了。' });
        return false;
      }
      set({ busy: true });
      try {
        await setLearnProgress(learnCourse.learn_course_id, {
          kp_id: selected.kpId, status: learner.status, note: body,
        });
        await get().reloadPoints();
        set({ notice: '已记下这条备注。' });
        return true;
      } catch (err) {
        set({ notice: describeError(err) });
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
      } catch (err) {
        set({ notice: describeError(err) });
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
          set({ notice: delta > 0 ? '已经到本课最后一条：回书架选下一门。' : '已经到本课第一条。' });
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
        set({ notice: delta > 0 ? '已经到本课最后一章：回书架选下一门。' : '已经到本课第一章。' });
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
      await get().reloadOutline();
      await get().reloadPoints();
      await restoreSelection();
    },

    clearNotice: () => set({ notice: null }),
  };
});
