/**
 * 文档解析管理 store（左树右对照 + 书目同步 + 块判定）
 * - 数据源：/books（af_books：课程归属 + 解析进度）、/books/sync（同步已验证书目）、
 *   /books/{id}/pages/{no}（单页 blocks）、/books/{id}/pages/{no}/blocks/{index}/review（判定）
 * - 独立降级：8900 不可达 → 整体错误；8901/8902 离线（503）→ 视图级降级提示，互不拖累
 * - 进度推导：af_books 带 pages_done 优先；否则由 manifest 推导（契约冻结前兼容）
 */
import { create } from 'zustand';
import {
  getBookManifest, getBookPage, listBooks, putBlockReview, syncBooks,
} from '../api/axiom';
import { ApiError } from '../api/client';
import type { Block, BlockReview, BookMeta, ManifestEntry, PageData } from '../api/axiom';

/** 从 manifest 推导已解析页数（p<编号>.md 计数；af_books 带 pages_done 后切换上游字段） */
export function countParsedPages(manifest: ManifestEntry[]): number {
  return manifest.filter((m) => /p\d+\.md$/i.test(m.path)).length;
}

export interface ParsingBook extends BookMeta {
  /** 已解析页数（af_books.pages_done 优先；否则 manifest 推导） */
  pages_done: number;
  /** 进度推导失败时为 true（manifest 不可达且无上游字段） */
  progressUnknown?: boolean;
}

/** 左树节点：领域 → 课程 → 书目 */
export interface ParsingTreeNode {
  key: string;
  type: 'domain' | 'course' | 'book';
  title: string;
  domainId?: string;
  courseId?: string;
  book?: ParsingBook;
  children?: ParsingTreeNode[];
}

/** 领域/课程兜底名（af_books 冗余字段缺失时用） */
export function fallbackName(key: string, label: string): string {
  return key || label;
}

/** 构建左树：af_books 冗余课程字段（domain_id/course_id/course_name）优先；
 * 契约冻结前 /books 无课程字段 → 全部归「未分课程」单组 */
export function buildParsingTree(books: ParsingBook[]): ParsingTreeNode[] {
  const withCourse = books.filter((b) => b.course_id);
  if (withCourse.length === 0 && books.length === 0) return [];
  if (withCourse.length === 0) {
    return [{
      key: 'ungrouped',
      type: 'domain',
      title: '未分课程',
      children: books.map((b) => ({
        key: `book:${b.book_id}`,
        type: 'book' as const,
        title: b.display_title || b.title || b.book_id,
        book: b,
      })),
    }];
  }
  // 领域 → 课程 → 书目（DOMAIN 顺序：出现顺序）
  const domains = new Map<string, ParsingTreeNode>();
  for (const b of withCourse) {
    const domainId = b.domain_id || 'other';
    if (!domains.has(domainId)) {
      domains.set(domainId, { key: `domain:${domainId}`, type: 'domain', title: domainId, domainId, children: [] });
    }
    const domain = domains.get(domainId)!;
    const courseKey = `${domainId}:${b.course_id}`;
    let courseNode = domain.children!.find((c) => c.key === courseKey);
    if (!courseNode) {
      courseNode = {
        key: courseKey,
        type: 'course',
        title: b.course_name || b.course_id || '',
        courseId: b.course_id,
        children: [],
      };
      domain.children!.push(courseNode);
    }
    courseNode.children!.push({
      key: `book:${b.book_id}`,
      type: 'book',
      title: b.display_title || b.title || b.book_id,
      book: b,
    });
  }
  return [...domains.values()];
}

export interface ParsingStore {
  books: ParsingBook[];
  loading: boolean;
  /** 整体错误（8900 不可达） */
  error: string | null;
  /** 8902 数据错误（503 等） */
  dataError: string | null;
  /** 同步状态 */
  syncing: boolean;
  syncMessage: string | null;
  syncError: string | null;
  lastSyncedAt: string | null;
  /** 对照视图：选中书 + 选中页 + 页数据 + 清单 */
  compareBookId: string | null;
  comparePageNo: number | null;
  pageData: PageData | null;
  pageLoading: boolean;
  pageError: string | null;
  manifest: ManifestEntry[];
  /** 块判定缓存：`${book}:${page}:${index}` → 判定 */
  blockReviews: Record<string, BlockReview>;
  reviewSubmitting: boolean;
  fetchBooks: (syncFirst?: boolean) => Promise<void>;
  openCompare: (bookId: string) => Promise<void>;
  loadPage: (bookId: string, pageNo: number) => Promise<void>;
  /** 块判定提交（verdict: ok 一致 / bad 不一致） */
  submitReview: (bookId: string, pageNo: number, blockIndex: number, blockType: string, verdict: 'ok' | 'bad', note?: string) => Promise<void>;
  clearCompare: () => void;
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const useParsingStore = create<ParsingStore>((set, get) => ({
  books: [],
  loading: false,
  error: null,
  dataError: null,
  syncing: false,
  syncMessage: null,
  syncError: null,
  lastSyncedAt: null,
  compareBookId: null,
  comparePageNo: null,
  pageData: null,
  pageLoading: false,
  pageError: null,
  manifest: [],
  blockReviews: {},
  reviewSubmitting: false,

  fetchBooks: async (syncFirst = true) => {
    if (get().loading) return;
    set({ loading: true, error: null, dataError: null });
    // 同步已验证书目（前端触发，REQ-042 用户裁决）——失败不阻塞列表展示
    if (syncFirst && !get().syncing) {
      set({ syncing: true, syncError: null });
      const [sync, syncErr] = await syncBooks()
        .then((s) => [s, null] as const)
        .catch((e) => [null, e] as const);
      set({
        syncing: false,
        syncMessage: sync ? `已同步 ${sync.synced} 本新书目（更新 ${sync.updated}）` : null,
        syncError: syncErr ? errText(syncErr) : null,
        lastSyncedAt: sync ? new Date().toISOString() : get().lastSyncedAt,
      });
    }
    const [books, err] = await listBooks()
      .then((b) => [b, null] as const)
      .catch((e) => [null, e] as const);
    // 8900 不可达（offline/timeout）→ 整体错误；8902 离线（503）→ 数据源级降级
    const isUpstream = err instanceof ApiError && err.kind === 'http';
    // 每本书拉 manifest 推导已解析页数（书目少，N+1 可接受；af_books 带 pages_done 后切换）
    const withProgress = books
      ? await Promise.all(
          books.map(async (b): Promise<ParsingBook> => {
            if (typeof b.pages_done === 'number') {
              return { ...b, pages_done: b.pages_done, progressUnknown: false };
            }
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
      error: err && !isUpstream ? errText(err) : null,
      dataError: err ? errText(err) : null,
    });
    set({ loading: false });
  },

  openCompare: async (bookId) => {
    set({ compareBookId: bookId, comparePageNo: 1, pageData: null, pageError: null });
    const [manifest, err] = await getBookManifest(bookId)
      .then((m) => [m, null] as const)
      .catch((e) => [null, e] as const);
    set({ manifest: manifest ?? [], pageError: err ? errText(err) : null });
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
      pageError: err ? errText(err) : null,
    });
    set({ pageLoading: false });
  },

  submitReview: async (bookId, pageNo, blockIndex, blockType, verdict, note = '') => {
    if (get().reviewSubmitting) return;
    set({ reviewSubmitting: true });
    const key = `${bookId}:${pageNo}:${blockIndex}`;
    const [review, err] = await putBlockReview(bookId, pageNo, blockIndex, verdict, note)
      .then((r) => [r, null] as const)
      .catch((e) => [null, e] as const);
    set({
      reviewSubmitting: false,
      blockReviews: err
        ? get().blockReviews
        : { ...get().blockReviews, [key]: { ...review, block_type: blockType } as BlockReview },
      pageError: err ? `判定提交失败：${errText(err)}` : get().pageError,
    });
  },

  clearCompare: () => {
    set({ compareBookId: null, comparePageNo: null, pageData: null, pageError: null, manifest: [] });
  },
}));

export type { Block };