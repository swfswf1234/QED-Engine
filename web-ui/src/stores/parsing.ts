/**
 * 文档解析管理 store（解析进度 + 原始文档对照）
 * - 数据源：/books（书目列表含解析进度）、/books/{id}/pages/{no}（单页）、/books/{id}/manifest（清单）
 * - 独立降级：8900 不可达 → 整体错误；8902 离线（503）→ 视图级降级提示，互不拖累
 */
import { create } from 'zustand';
import { getBookManifest, getBookPage, listBooks } from '../api/axiom';
import { ApiError } from '../api/client';
import type { BookMeta, ManifestEntry, PageData } from '../api/axiom';

/** 从 manifest 推导已解析页数（p<编号>.md 计数；契约冻结后 BookMeta 带进度字段再切换） */
export function countParsedPages(manifest: ManifestEntry[]): number {
  return manifest.filter((m) => /p\d+\.md$/i.test(m.path)).length;
}

export interface ParsingBook extends BookMeta {
  /** 已解析页数（manifest 推导；契约冻结后由上游提供） */
  pages_done: number;
  /** 进度推导失败时为 true（manifest 不可达） */
  progressUnknown?: boolean;
}

export interface ParsingStore {
  books: ParsingBook[];
  loading: boolean;
  /** 整体错误（8900 不可达） */
  error: string | null;
  /** 8902 数据错误（503 等） */
  dataError: string | null;
  /** 对照视图：选中书 + 选中页 + 页数据 + 清单 */
  compareBookId: string | null;
  comparePageNo: number | null;
  pageData: PageData | null;
  pageLoading: boolean;
  pageError: string | null;
  manifest: ManifestEntry[];
  fetchBooks: () => Promise<void>;
  openCompare: (bookId: string) => Promise<void>;
  loadPage: (bookId: string, pageNo: number) => Promise<void>;
  clearCompare: () => void;
}

export const useParsingStore = create<ParsingStore>((set, get) => ({
  books: [],
  loading: false,
  error: null,
  dataError: null,
  compareBookId: null,
  comparePageNo: null,
  pageData: null,
  pageLoading: false,
  pageError: null,
  manifest: [],

  fetchBooks: async () => {
    if (get().loading) return;
    set({ loading: true });
    const [books, err] = await listBooks()
      .then((b) => [b, null] as const)
      .catch((e) => [null, e] as const);
    // 8900 不可达（offline/timeout）→ 整体错误；8902 离线（503）→ 数据源级降级
    const isUpstream = err instanceof ApiError && err.kind === 'http';
    // 每本书拉 manifest 推导已解析页数（书目少，N+1 可接受；契约冻结后切换上游字段）
    const withProgress = books
      ? await Promise.all(
          books.map(async (b): Promise<ParsingBook> => {
            const [manifest, mErr] = await getBookManifest(b.book_id)
              .then((m) => [m, null] as const)
              .catch((e) => [null, e] as const);
            return {
              ...b,
              pages_done: manifest ? countParsedPages(manifest) : 0,
              progressUnknown: !!mErr,
            };
          }),
        )
      : get().books;
    set({
      books: withProgress,
      error: err && !isUpstream ? (err instanceof Error ? err.message : String(err)) : null,
      dataError: err ? (err instanceof Error ? err.message : String(err)) : null,
    });
    set({ loading: false });
  },

  openCompare: async (bookId) => {
    set({ compareBookId: bookId, comparePageNo: 1, pageData: null, pageError: null });
    const [manifest, err] = await getBookManifest(bookId)
      .then((m) => [m, null] as const)
      .catch((e) => [null, e] as const);
    set({ manifest: manifest ?? [], pageError: err ? (err instanceof Error ? err.message : String(err)) : null });
    void get().loadPage(bookId, 1);
  },

  loadPage: async (bookId, pageNo) => {
    if (get().pageLoading) return;
    set({ pageLoading: true, pageError: null, comparePageNo: pageNo });
    const [data, err] = await getBookPage(bookId, pageNo)
      .then((d) => [d, null] as const)
      .catch((e) => [null, e] as const);
    set({
      pageData: data ?? get().pageData,
      pageError: err ? (err instanceof Error ? err.message : String(err)) : null,
    });
    set({ pageLoading: false });
  },

  clearCompare: () => {
    set({ compareBookId: null, comparePageNo: null, pageData: null, pageError: null, manifest: [] });
  },
}));
