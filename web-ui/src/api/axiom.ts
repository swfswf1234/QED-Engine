/**
 * 数据域·Axiom 端点封装（8900 唯一入口，ADR 0007）
 * 契约来源：backend/qed_engine/api/axiom.py（透传 8902，草案 Axiom-Flow 8902-integration-contract.md
 * + af-books-sync.md，REQ-042）
 * - /books：书目列表（af_books：含课程归属 + 解析进度）
 * - /books/sync：同步已验证书目（前端触发，8900 聚合 8901 → 8902 upsert）
 * - /books/{id}/pages/{no}：单页完整数据（原页图 URL + markdown + blocks）
 * - /books/{id}/pages/{no}/blocks/{index}/review：块判定（PUT 写入 / GET 回显）
 * - /books/{id}/manifest：产物清单
 * - /parse-jobs：任务提交与状态查询
 * - /parsing/tree：左侧树聚合（8900 共享表领域课程 + 8902 书目，ARCH-020）
 */
import { api, type ApiRequestOptions } from './client';

export interface BookMeta {
  book_id: string;
  title: string;
  author: string;
  /** 总页数（8902 实际字段 page_count） */
  page_count: number;
  sha256: string;
  /** 解析策略（local / hybrid） */
  strategy: string;
  /** 课程归属（af_books 冗余，REQ-042） */
  domain_id?: string;
  course_id?: string;
  course_name?: string;
  knowledge_id?: string;
  /** 展示名 = title + part（qt_books 同源） */
  display_title?: string;
  /** 解析进度（af_books 自持字段，REQ-042） */
  parse_status?: string; // pending / parsing / completed / failed
  pages_done?: number;
  [key: string]: unknown;
}

export interface ParseJob {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  [key: string]: unknown;
}

/** 结构化块（Axiom-Flow schemas.py Block，type 判别 + 必需字段） */
export interface Block {
  type: string; // heading / paragraph / formula / table / image / list / caption / header / footer / page_number
  bbox: [number, number, number, number];
  text?: string;
  level?: number;
  latex?: string;
  display?: boolean;
  confidence?: number;
  html?: string;
  path?: string;
  caption?: string;
  items?: string[];
  [key: string]: unknown;
}

/** 单页块数据（BlocksPage：page + source + blocks） */
export interface BlocksPage {
  page: number;
  source?: string; // mineru / qwen-vl-plus
  blocks: Block[];
  quality?: Record<string, unknown> | null;
}

export interface PageData {
  page_no: number;
  image_url: string;
  markdown: string;
  blocks: BlocksPage | Block[] | null;
  [key: string]: unknown;
}

export interface ManifestEntry {
  path: string;
  size: number;
  sha256: string;
  [key: string]: unknown;
}

/** 块判定记录（af_block_reviews） */
export interface BlockReview {
  review_id?: string;
  book_id: string;
  page_no: number;
  block_index: number;
  block_type: string;
  verdict: 'ok' | 'bad';
  note: string;
  reviewed_at?: string;
  [key: string]: unknown;
}

export interface SyncResult {
  synced: number;
  updated: number;
  books: BookMeta[];
  [key: string]: unknown;
}

/** GET /api/v1/books：书目列表（af_books：课程归属 + 解析进度；8902 离线 → 503） */
export function listBooks(opts?: ApiRequestOptions): Promise<BookMeta[]> {
  return api.get<BookMeta[]>('/books', opts);
}

/** POST /api/v1/books/sync：同步已验证书目（8900 聚合 8901 verified → 8902 upsert） */
export function syncBooks(opts?: ApiRequestOptions): Promise<SyncResult> {
  return api.post<SyncResult>('/books/sync', undefined, opts);
}

/** GET /api/v1/books/{id}/pages/{no}：单页完整数据 */
export function getBookPage(bookId: string, pageNo: number, opts?: ApiRequestOptions): Promise<PageData> {
  return api.get<PageData>(`/books/${bookId}/pages/${pageNo}`, opts);
}

/** PUT /api/v1/books/{id}/pages/{no}/blocks/{index}/review：块判定（一致/不一致 + 备注） */
export function putBlockReview(
  bookId: string,
  pageNo: number,
  blockIndex: number,
  verdict: 'ok' | 'bad',
  note = '',
  opts?: ApiRequestOptions,
): Promise<BlockReview> {
  return api.put<BlockReview>(`/books/${bookId}/pages/${pageNo}/blocks/${blockIndex}/review`, { verdict, note }, opts);
}

/** GET /api/v1/books/{id}/pages/{no}/blocks/{index}/review：查询块判定（无判定 → 404 透传） */
export function getBlockReview(bookId: string, pageNo: number, blockIndex: number, opts?: ApiRequestOptions): Promise<BlockReview> {
  return api.get<BlockReview>(`/books/${bookId}/pages/${pageNo}/blocks/${blockIndex}/review`, opts);
}

/** GET /api/v1/books/{id}/manifest：产物清单 */
export function getBookManifest(bookId: string, opts?: ApiRequestOptions): Promise<ManifestEntry[]> {
  return api.get<ManifestEntry[]>(`/books/${bookId}/manifest`, opts);
}

/** POST /api/v1/parse-jobs：提交解析任务（strategy 默认 hybrid；缺省 pages 由上游生成） */
export function createParseJob(
  bookId: string,
  pages?: number[],
  strategy = 'hybrid',
  opts?: ApiRequestOptions,
): Promise<ParseJob> {
  return api.post<ParseJob>('/parse-jobs', { book_id: bookId, pages, strategy }, opts);
}

/** GET /api/v1/parse-jobs/{id}：任务状态与进度 */
export function getParseJob(jobId: string, opts?: ApiRequestOptions): Promise<ParseJob> {
  return api.get<ParseJob>(`/parse-jobs/${jobId}`, opts);
}

// --- 左侧树聚合（ARCH-020） ---

/** 左侧树节点（领域→课程→书目） */
export interface ParsingTreeNode {
  key: string;
  type: 'domain' | 'course' | 'book';
  title: string;
  domainId?: string;
  courseId?: string;
  book?: BookMeta;
  children?: ParsingTreeNode[];
}

/** GET /api/v1/parsing/tree：左侧树聚合（8900 共享表领域课程 + 8902 书目） */
export function getParsingTree(opts?: ApiRequestOptions): Promise<ParsingTreeNode[]> {
  return api.get<ParsingTreeNode[]>('/parsing/tree', opts);
}