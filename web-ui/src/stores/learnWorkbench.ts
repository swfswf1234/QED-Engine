/**
 * 三栏学习工作台 store（M6：书 → 章节目录 → 正文只读排版 → 批注登记）
 * - 左＝`GET /api/v1/books`（按 course_id 过滤且 active_job_id 非空者可选）＋ `GET /learn/courses/{id}/outline`
 * - 中＝`GET /api/v1/books/{id}/pages/{n}` 按章/节 `source_ref` 页范围 8 页/批懒取（只读，不写回）
 * - 右＝`POST /learn/kp-details`（intent + anchors 带页与片段 + parent_kp_id，gen_status=candidate）→ `/confirm` 提升主表
 * - 写后整体重取，不做乐观更新（判例 stores/courseKnowledge）
 */
import { create } from 'zustand';
import { getBookPage, listBooks, type BookMeta, type PageData } from '../api/axiom';
import { ApiError, describeError } from '../api/client';
import {
  addKpDetail, confirmKpDetail, getOutline, getStarMap, listKpDetails, rejectKpDetail,
  type KpDetailRow, type KpIntent, type KnowledgePointType, type OutlineRow,
} from '../api/learn';
/** 中栏每批懒取页数（一章 ~20 页，不整章一次拉完） */
export const PAGE_BATCH = 8;

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

export interface LearnWorkbenchStore {
  courseId: string | null;
  course: CourseRef | null;
  bookId: string | null;
  book: BookMeta | null;
  books: BookMeta[];
  outline: OutlineRow[];
  selectedKpId: string | null;
  /** 选中章/节的正文页范围（source_ref，PDF 页序） */
  range: PageRange | null;
  pages: Record<number, PageEntry>;
  /** 已发起加载的最后一页（0＝未加载） */
  loadedThrough: number;
  selectedBlock: SelectedBlock | null;
  candidates: KpDetailRow[];
  loading: boolean;
  error: string | null;
  notice: string | null;
  fetchCourse: (courseId: string) => Promise<void>;
  selectBook: (bookId: string) => Promise<void>;
  selectNode: (kpId: string | null) => Promise<void>;
  loadMorePages: () => Promise<void>;
  selectBlock: (block: SelectedBlock | null) => void;
  reloadOutline: () => Promise<void>;
  addAnnotation: (input: {
    name: string;
    narrative: string;
    intent: KpIntent;
    type?: KnowledgePointType;
  }) => Promise<boolean>;
  confirmCandidate: (detailId: string) => Promise<void>;
  rejectCandidate: (detailId: string) => Promise<void>;
  clearNotice: () => void;
}

/** outline 行的 source_ref → 正文页范围（缺页范围＝不可读，中栏给明确空态） */
export function rangeOfNode(node: OutlineRow | null): PageRange | null {
  const ref = node?.source_ref ?? null;
  if (!ref) return null;
  const start = ref.page_start;
  const end = ref.page_end;
  if (typeof start !== 'number' || typeof end !== 'number' || start < 1 || end < start) return null;
  return { start, end };
}

const emptyPage: PageEntry = { loading: false, parsed: false, data: null, error: null };

export const useLearnWorkbenchStore = create<LearnWorkbenchStore>((set, get) => {
  /** 拉一页并写回 pages（404＝该页未解析，不算错误） */
  const loadPage = async (bookId: string, pageNo: number) => {
    set((s) => ({ pages: { ...s.pages, [pageNo]: { ...emptyPage, loading: true } } }));
    try {
      const data = await getBookPage(bookId, pageNo);
      set((s) => ({ pages: { ...s.pages, [pageNo]: { loading: false, parsed: true, data, error: null } } }));
    } catch (err) {
      // 404＝该页无解析产物（不算错误，中栏出「未解析」空态）
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

  const fetchCandidates = async (courseId: string | null, kpId: string | null) => {
    if (!courseId || !kpId) {
      set({ candidates: [] });
      return;
    }
    try {
      const pool = await listKpDetails(courseId, kpId);
      set({ candidates: pool.details });
    } catch (err) {
      set({ candidates: [], notice: describeError(err) });
    }
  };

  return {
    courseId: null,
    course: null,
    bookId: null,
    book: null,
    books: [],
    outline: [],
    selectedKpId: null,
    range: null,
    pages: {},
    loadedThrough: 0,
    selectedBlock: null,
    candidates: [],
    loading: false,
    error: null,
    notice: null,

    fetchCourse: async (courseId) => {
      set({ courseId, loading: true, error: null });
      try {
        const [star, allBooks] = await Promise.all([getStarMap(), listBooks()]);
        const found = star.domains
          .flatMap((d) => d.tracks.flatMap((t) => t.courses.map((c) => ({ ...c, domain_id: d.domain_id }))))
          .find((c) => c.course_id === courseId);
        set({
          course: found
            ? { course_id: found.course_id, name: found.name, track: found.track, domain_id: found.domain_id }
            : { course_id: courseId, name: courseId, track: '', domain_id: '' },
          // 可选书＝已激活解析版本者（active_job_id 是「哪一版可读」唯一事实源）
          books: allBooks.filter((b) => b.course_id === courseId && b.active_job_id),
        });
      } catch (err) {
        set({ error: describeError(err), books: [] });
      } finally {
        set({ loading: false });
      }
      await get().reloadOutline();
    },

    selectBook: async (bookId) => {
      const book = get().books.find((b) => b.book_id === bookId) ?? null;
      set({
        bookId,
        book,
        pages: {},
        loadedThrough: 0,
        range: null,
        selectedBlock: null,
        selectedKpId: null,
        candidates: [],
      });
      await get().reloadOutline();
    },

    reloadOutline: async () => {
      const { courseId, bookId } = get();
      if (!courseId) return;
      try {
        const result = await getOutline(courseId, bookId ?? undefined);
        const outline = result.outline;
        const stillThere = outline.some((n) => n.kp_id === get().selectedKpId);
        if (!stillThere) set({ selectedKpId: null, range: null, pages: {}, loadedThrough: 0 });
        set({ outline });
      } catch (err) {
        set({ outline: [], notice: describeError(err) });
      }
    },

    selectNode: async (kpId) => {
      if (kpId === get().selectedKpId) return;
      const node = get().outline.find((n) => n.kp_id === kpId) ?? null;
      set({
        selectedKpId: kpId,
        range: rangeOfNode(node),
        pages: {},
        loadedThrough: 0,
        selectedBlock: null,
      });
      await fetchCandidates(get().courseId, kpId);
      await advanceBatch();
    },

    loadMorePages: () => advanceBatch(),

    selectBlock: (block) => set({ selectedBlock: block }),

    addAnnotation: async ({ name, narrative, intent, type }) => {
      const { courseId, bookId, selectedKpId, selectedBlock } = get();
      if (!courseId || !name.trim()) {
        set({ notice: '知识点名必填' });
        return false;
      }
      const anchors = selectedBlock
        ? [{ kind: 'book', ref_id: bookId ?? '', page: selectedBlock.page, snippet: selectedBlock.snippet }]
        : [];
      try {
        await addKpDetail({
          course_id: courseId,
          name: name.trim(),
          type,
          narrative,
          gen_batch: 'learn-workbench',
          anchors,
          gen_status: 'candidate',
          parent_kp_id: selectedKpId,
          intent,
          book_ref: bookId ?? '',
        });
        set({ notice: `候选已登记：${name.trim()}` });
        await fetchCandidates(courseId, selectedKpId);
        return true;
      } catch (err) {
        set({ notice: describeError(err) });
        return false;
      }
    },

    confirmCandidate: async (detailId) => {
      try {
        const { point } = await confirmKpDetail(detailId);
        set({ notice: `已确认并提升：${point.name}` });
      } catch (err) {
        set({ notice: describeError(err) });
      }
      const { courseId, selectedKpId } = get();
      await fetchCandidates(courseId, selectedKpId);
      await get().reloadOutline();
    },

    rejectCandidate: async (detailId) => {
      try {
        await rejectKpDetail(detailId);
        set({ notice: '已驳回（不落主表，可重新批注）' });
      } catch (err) {
        set({ notice: describeError(err) });
      }
      const { courseId, selectedKpId } = get();
      await fetchCandidates(courseId, selectedKpId);
    },

    clearNotice: () => set({ notice: null }),
  };
});
