/**
 * 文档解析管理 store（G 轮单屏：左书目树纯选择 + 右对照工作台）
 * 设计：docs/design/parsing-ui.md §4（2026-09-20 单屏回调定稿）
 * - 数据源：/parsing/tree（左树）、/books + /books/sync（顶部单一「刷新」含同步书目）、
 *   /books/{id}/ingest、/books/{id}/pages/{no}、/edit（块编辑门面）、
 *   /parse-jobs（单页/全本 + 轮询）
 * - 独立降级：8900 不可达 → error（整体）；8902 离线（503）→ dataError（视图级），互不拖累
 */
import { create } from 'zustand';
import {
  createParseJob, getBook, getBookPage, getPageEdits, getParsingTree, getParseJob,
  ingestBook as apiIngestBook, listBooks, listParseJobs, putBlockEdit, syncBooks,
} from '../api/axiom';
import { ApiError } from '../api/client';
import type { BlockEdit, BlockEditInput, BookMeta, PageData, ParseJob, ParsingTreeNode } from '../api/axiom';
import {
  loadTypographyPrefs, saveTypographyPrefs,
  type TypographyPrefs,
} from '../components/parsing/typography';
import type { BBox } from '../components/parsing/regions';

export type { ParsingTreeNode } from '../api/axiom';

export type ScrollMode = 'single' | 'continuous';
export type RenderMode = 'stream' | 'layout';
/** 编辑口径：左=框图几何（拉伸/移动/新框/删/合），右=内容替换（parsing-ui §5/§10） */
export type EditPane = 'box' | 'content';
/** 框图本地预览草稿（删除/合并/新框不落库，REQ-099 R2 承接后接通） */
export interface RegionDraft {
  added: BBox[];
  deleted: number[];
  merged: number[][];
}

/** 单页加载态（连续滚动模式多页缓存） */
export interface PageEntry {
  data: PageData | null;
  /** 该页已有解析产物（页数据 200；404=未解析，非错误） */
  parsed: boolean;
  loading: boolean;
  error: string | null;
}

export const editKey = (bookId: string, pageNo: number, blockIndex: number) =>
  `${bookId}:${pageNo}:${blockIndex}`;

const EMPTY_PAGE: PageEntry = { data: null, parsed: false, loading: false, error: null };

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** 错误归类：offline=8900 不可达（整体错误）；503=8902/上游不可用（数据降级）；其余=普通错误 */
function classifyError(e: unknown): { error: string | null; dataError: string | null } {
  if (e instanceof ApiError && e.status === 503) return { error: null, dataError: errText(e) };
  return { error: errText(e), dataError: null };
}

export interface ParsingStore {
  // 书目数据（标题行同步/刷新；树数据经 fetchTree 单拉）
  books: BookMeta[];
  booksLoading: boolean;
  tree: ParsingTreeNode[];
  treeLoading: boolean;
  treeError: string | null;
  // 全局降级
  error: string | null;
  dataError: string | null;
  syncing: boolean;
  syncMessage: string | null;
  syncError: string | null;
  // 对照工作台选中（右栏；树点击/URL 恢复写入）
  compareBookId: string | null;
  compareBook: BookMeta | null;
  comparePageNo: number;
  pages: Record<number, PageEntry>;
  selectedBlock: number;
  editMode: boolean;
  // 编辑工作台（§5：口径 / 框图多选 / 本地草稿 / 版式偏好）
  editPane: EditPane;
  boxSelection: number[];
  regionDraft: RegionDraft;
  typography: TypographyPrefs;
  // 工作台视图选项（§7 顶栏；engine 不设选择，走服务端默认；G 轮裁决无视图模式切换）
  scrollMode: ScrollMode;
  renderMode: RenderMode;
  syncScroll: boolean;
  zoom: number;
  // 解析任务
  activeJob: ParseJob | null;
  jobError: string | null;
  /** 提交闸门：POST /parse-jobs 在途即 true，按钮禁用防连点重复建任务（与 ingestBusy 同口径） */
  jobSubmitting: boolean;
  ingestBusy: Record<string, boolean>;
  // 编辑
  edits: Record<string, BlockEdit>;
  editSubmitting: boolean;
  // 动作
  fetchBooks: (syncFirst?: boolean) => Promise<void>;
  fetchTree: () => Promise<void>;
  openWorkbench: (bookId: string, pageNo?: number, seed?: BookMeta) => Promise<void>;
  loadPage: (pageNo: number) => Promise<void>;
  ensurePage: (pageNo: number) => Promise<void>;
  gotoPage: (delta: number) => void;
  setScrollMode: (m: ScrollMode) => void;
  setRenderMode: (m: RenderMode) => void;
  setSyncScroll: (on: boolean) => void;
  setZoom: (z: number) => void;
  selectBlock: (index: number) => void;
  setEditMode: (on: boolean) => void;
  setEditPane: (pane: EditPane) => void;
  toggleBoxSelect: (index: number) => void;
  addRegionDraft: (bbox: BBox) => void;
  deleteSelectedBlocks: () => void;
  restoreDeletedRegion: (blockIndex: number) => void;
  mergeSelectedBlocks: () => void;
  resetRegionDraft: () => void;
  setTypography: (patch: Partial<TypographyPrefs>) => void;
  ingestBook: (bookId: string) => Promise<void>;
  createParseJob: (pages?: number[], bookId?: string) => Promise<void>;
  submitEdit: (blockIndex: number, input: BlockEditInput) => Promise<boolean>;
  clearCompare: () => void;
}

/** 任务轮询令牌（新任务/退出工作台即作废） */
let pollToken = 0;

export const useParsingStore = create<ParsingStore>((set, get) => {
  const setPage = (pageNo: number, patch: Partial<PageEntry>) =>
    set((s) => ({ pages: { ...s.pages, [pageNo]: { ...EMPTY_PAGE, ...s.pages[pageNo], ...patch } } }));

  /** 拉取一页（404=未解析不算错误）；连续模式预取与单页共用 */
  const fetchPage = async (bookId: string, pageNo: number) => {
    setPage(pageNo, { loading: true, error: null });
    const [data, err] = await getBookPage(bookId, pageNo)
      .then((d) => [d, null] as const)
      .catch((e) => [null, e] as const);
    const unparsed = err instanceof ApiError && err.status === 404;
    setPage(pageNo, {
      data: data ?? null,
      parsed: Boolean(data),
      loading: false,
      error: err && !unparsed ? errText(err) : null,
    });
  };

  /** 轮询至任务终态：完成即刷新当前页 + 回写行进度 */
  const pollJob = async (jobId: string) => {
    const token = ++pollToken;
    for (;;) {
      const job = await getParseJob(jobId).catch(() => null);
      if (token !== pollToken || !job) return;
      set({ activeJob: job });
      if (job.status === 'completed' || job.status === 'failed') {
        if (job.status === 'failed') set({ jobError: job.error ?? job.progress?.error ?? '解析任务失败' });
        const s = get();
        if (s.compareBookId) {
          const detail = await getBook(s.compareBookId).catch(() => null);
          if (token !== pollToken) return;
          if (detail) set({ compareBook: detail, books: s.books.map((b) => (b.book_id === s.compareBookId ? { ...b, ...detail } : b)) });
          void fetchPage(s.compareBookId, s.comparePageNo);
        }
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
      if (token !== pollToken) return;
    }
  };

  return {
    books: [],
    booksLoading: false,
    tree: [],
    treeLoading: false,
    treeError: null,
    error: null,
    dataError: null,
    syncing: false,
    syncMessage: null,
    syncError: null,
    compareBookId: null,
    compareBook: null,
    comparePageNo: 1,
    pages: {},
    selectedBlock: -1,
    editMode: false,
    editPane: 'box',
    boxSelection: [],
    regionDraft: { added: [], deleted: [], merged: [] },
    typography: loadTypographyPrefs(),
    scrollMode: 'single',
    renderMode: 'stream',
    syncScroll: true,
    zoom: 100,
    activeJob: null,
    jobError: null,
    jobSubmitting: false,
    ingestBusy: {},
    edits: {},
    editSubmitting: false,

    fetchBooks: async (syncFirst = false) => {
      if (get().booksLoading) return;
      set({ booksLoading: true });
      if (syncFirst) {
        set({ syncing: true, syncError: null, syncMessage: null });
        const [sync, syncErr] = await syncBooks().then((r) => [r, null] as const).catch((e) => [null, e] as const);
        set({
          syncing: false,
          syncMessage: sync ? `已同步 ${sync.synced} 本新书目（更新 ${sync.updated}）` : null,
          syncError: syncErr ? errText(syncErr) : null,
        });
      }
      const [rows, err] = await listBooks().then((r) => [r, null] as const).catch((e) => [null, e] as const);
      set({
        books: rows ?? get().books,
        ...(err ? classifyError(err) : { error: null, dataError: null }),
        booksLoading: false,
      });
    },

    fetchTree: async () => {
      if (get().treeLoading) return;
      set({ treeLoading: true, treeError: null });
      const [raw, err] = await getParsingTree().then((t) => [t, null] as const).catch((e) => [null, e] as const);
      set({
        tree: raw ?? [],
        ...(err ? { treeError: errText(err), ...classifyError(err) } : {}),
        treeLoading: false,
      });
    },

    openWorkbench: async (bookId, pageNo = 1, seed) => {
      ++pollToken; // 作废旧任务轮询
      set({
        compareBookId: bookId,
        compareBook: seed ?? get().books.find((b) => b.book_id === bookId) ?? null,
        comparePageNo: pageNo,
        pages: {},
        selectedBlock: -1,
        boxSelection: [],
        regionDraft: { added: [], deleted: [], merged: [] },
        activeJob: null,
        jobError: null,
        edits: {},
      });
      const detail = await getBook(bookId).catch(() => null);
      if (detail && get().compareBookId === bookId) set({ compareBook: detail });
      // 防重闸门·重开恢复：该书在服务端有非终态任务即恢复 activeJob 并续轮询
      // （否则重开工作台后 activeJob=null，可重复建任务压垮本地模型）
      const list = await listParseJobs(bookId, ['queued', 'running']).catch(() => null);
      const runningJob = list?.jobs.find((j) => j.active) ?? list?.jobs[0];
      if (runningJob && get().compareBookId === bookId) {
        set({ activeJob: runningJob });
        void pollJob(String(runningJob.id));
      }
      await get().loadPage(pageNo);
    },

    loadPage: async (pageNo) => {
      const { compareBookId, pages } = get();
      if (!compareBookId) return;
      const entry = pages[pageNo];
      if (entry?.loading) return;
      set({ comparePageNo: pageNo, selectedBlock: -1, boxSelection: [], regionDraft: { added: [], deleted: [], merged: [] } });
      await fetchPage(compareBookId, pageNo);
      if (get().compareBookId === compareBookId) {
        const list = await getPageEdits(compareBookId, pageNo).catch(() => null);
        if (list && get().compareBookId === compareBookId && get().comparePageNo === pageNo) {
          set((s) => {
            const edits = { ...s.edits };
            for (const e of list) edits[editKey(compareBookId, pageNo, e.block_index)] = e;
            return { edits };
          });
        }
      }
    },

    ensurePage: async (pageNo) => {
      const { compareBookId, pages } = get();
      if (!compareBookId) return;
      if (pages[pageNo]) return;
      setPage(pageNo, EMPTY_PAGE); // 占位防并发重复拉取
      await fetchPage(compareBookId, pageNo);
    },

    gotoPage: (delta) => {
      const s = get();
      const total = s.compareBook?.page_count ?? 1;
      const next = Math.min(Math.max(s.comparePageNo + delta, 1), Math.max(total, 1));
      if (next !== s.comparePageNo) void s.loadPage(next);
    },

    setScrollMode: (m) => set({ scrollMode: m }),
    setRenderMode: (m) => set({ renderMode: m }),
    setSyncScroll: (on) => set({ syncScroll: on }),
    setZoom: (z) => set({ zoom: z }),
    selectBlock: (index) => set({ selectedBlock: index }),
    setEditMode: (on) => set(on
      ? { editMode: true }
      : {
        editMode: false,
        selectedBlock: -1,
        boxSelection: [],
        regionDraft: { added: [], deleted: [], merged: [] },
      }),
    setEditPane: (pane) => set({ editPane: pane }),
    toggleBoxSelect: (index) => set((s) => ({
      boxSelection: s.boxSelection.includes(index)
        ? s.boxSelection.filter((i) => i !== index)
        : [...s.boxSelection, index],
    })),
    addRegionDraft: (bbox) => set((s) => ({ regionDraft: { ...s.regionDraft, added: [...s.regionDraft.added, bbox] } })),
    deleteSelectedBlocks: () => set((s) => ({
      regionDraft: { ...s.regionDraft, deleted: Array.from(new Set([...s.regionDraft.deleted, ...s.boxSelection])) },
      boxSelection: [],
      selectedBlock: -1,
    })),
    restoreDeletedRegion: (blockIndex) => set((s) => ({
      regionDraft: { ...s.regionDraft, deleted: s.regionDraft.deleted.filter((i) => i !== blockIndex) },
    })),
    mergeSelectedBlocks: () => set((s) => (s.boxSelection.length >= 2
      ? {
        regionDraft: { ...s.regionDraft, merged: [...s.regionDraft.merged, [...s.boxSelection]] },
        boxSelection: [],
        selectedBlock: -1,
      }
      : {})),
    resetRegionDraft: () => set({ regionDraft: { added: [], deleted: [], merged: [] } }),
    setTypography: (patch) => set((s) => {
      const next = { ...s.typography, ...patch };
      saveTypographyPrefs(next);
      return { typography: next };
    }),

    ingestBook: async (bookId) => {
      if (get().ingestBusy[bookId]) return;
      set((s) => ({ ingestBusy: { ...s.ingestBusy, [bookId]: true }, jobError: null }));
      const [res, err] = await apiIngestBook(bookId).then((r) => [r, null] as const).catch((e) => [null, e] as const);
      set((s) => ({ ingestBusy: { ...s.ingestBusy, [bookId]: false } }));
      if (err) {
        set({ jobError: `书页入库失败：${errText(err)}` });
        return;
      }
      set((s) => ({
        books: s.books.map((b) => (b.book_id === bookId ? { ...b, ...(res as object) } : b)),
        compareBook: s.compareBook?.book_id === bookId ? { ...s.compareBook, ...(res as object) } : s.compareBook,
      }));
      if (get().compareBookId === bookId) {
        set({ pages: {} });
        await get().loadPage(get().comparePageNo);
      }
    },

    createParseJob: async (pages, bookIdArg) => {
      const s = get();
      const bookId = bookIdArg ?? s.compareBookId;
      if (!bookId) return;
      if (s.jobSubmitting) return;
      if (s.activeJob && (s.activeJob.status === 'queued' || s.activeJob.status === 'running')) return;
      set({ jobError: null, jobSubmitting: true });
      const [job, err] = await createParseJob(bookId, pages)
        .then((r) => [r, null] as const)
        .catch((e) => [null, e] as const);
      set({ jobSubmitting: false });
      if (err || !job) {
        set({ jobError: `解析任务提交失败：${errText(err)}` });
        return;
      }
      set({ activeJob: job });
      void pollJob(String(job.id));
    },

    submitEdit: async (blockIndex, input) => {
      const s = get();
      const bookId = s.compareBookId;
      const pageNo = s.comparePageNo;
      if (!bookId || s.editSubmitting) return false;
      set({ editSubmitting: true });
      const [record, err] = await putBlockEdit(bookId, pageNo, blockIndex, input)
        .then((r) => [r, null] as const)
        .catch((e) => [null, e] as const);
      set({ editSubmitting: false });
      if (err) {
        set({ jobError: `编辑保存失败：${errText(err)}` });
        return false;
      }
      set((st) => ({ edits: { ...st.edits, [editKey(bookId, pageNo, blockIndex)]: record! } }));
      return true;
    },

    clearCompare: () => {
      ++pollToken;
      set({
        compareBookId: null,
        compareBook: null,
        pages: {},
        selectedBlock: -1,
        boxSelection: [],
        regionDraft: { added: [], deleted: [], merged: [] },
        activeJob: null,
        comparePageNo: 1,
      });
    },
  };
});
