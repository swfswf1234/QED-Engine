/**
 * 数据域·Axiom 端点封装（8900 唯一入口，ADR 0007）
 * 契约来源：backend/qed_engine/api/axiom.py（透传 8902，草案 Axiom-Flow 8902-integration-contract.md）
 * - /books：书目列表（含解析进度）
 * - /books/{id}/pages/{no}：单页完整数据（原页图 URL + markdown + blocks）
 * - /books/{id}/manifest：产物清单
 * - /parse-jobs：任务提交与状态查询
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
  [key: string]: unknown;
}

export interface ParseJob {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  [key: string]: unknown;
}

export interface Block {
  type: string;
  content: string;
  [key: string]: unknown;
}

export interface PageData {
  page_no: number;
  image_url: string;
  markdown: string;
  blocks: Block[];
  [key: string]: unknown;
}

export interface ManifestEntry {
  path: string;
  size: number;
  sha256: string;
  [key: string]: unknown;
}

/** GET /api/v1/books：书目列表（含解析进度；8902 离线 → 503） */
export function listBooks(opts?: ApiRequestOptions): Promise<BookMeta[]> {
  return api.get<BookMeta[]>('/books', opts);
}

/** GET /api/v1/books/{id}/pages/{no}：单页完整数据 */
export function getBookPage(bookId: string, pageNo: number, opts?: ApiRequestOptions): Promise<PageData> {
  return api.get<PageData>(`/books/${bookId}/pages/${pageNo}`, opts);
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