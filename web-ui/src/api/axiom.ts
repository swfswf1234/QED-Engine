/**
 * 数据域·Axiom 端点封装（8900 唯一入口，ADR 0007）
 * 契约来源：backend/qed_engine/api/axiom.py（透传 8902 v2 契约，
 * Axiom-Flow docs/architecture/api.md + REQ-001；书目同步 af-books-sync.md，REQ-042）
 * - /books：书目列表（af_books：含课程归属 + 解析进度）
 * - /books/{id}：单本详情；/books/{id}/file：源 PDF inline 流（未解析时原始文件直显）
 * - /books/sync：同步已验证书目（前端触发，8900 聚合 8901 → 8902 upsert）
 * - /books/{id}/pages/{no}：单页完整数据（原页图 URL + markdown + blocks）
 * - /books/{id}/pages/{no}/blocks/{index}/review：块判定（PUT 写入 / GET 回显）
 * - /books/{id}/manifest：产物清单
 * - /parse-jobs：任务提交与状态查询
 * - /parsing/tree：左侧树聚合（8900 共享表领域课程 + 8902 书目，ARCH-020）
 */
import { api, API_BASE, type ApiRequestOptions } from './client';

export interface BookMeta {
  book_id: string;
  title: string;
  author: string;
  /** 总页数（af_books.page_count，ingest 后回填；未 ingest 可为空） */
  page_count: number | null;
  sha256: string;
  /** 解析策略（local / hybrid） */
  strategy: string;
  /** 源 PDF 数据根相对路径（af_books.file_path，同源 qt_books；空=未登记，PDF 直显判定） */
  file_path?: string;
  /** ingest 状态（none / ingested） */
  ingest_status?: string;
  /** 课程归属（af_books 冗余，REQ-042） */
  domain_id?: string;
  course_id?: string;
  course_name?: string;
  knowledge_id?: string;
  /** 展示名 = title + part（qt_books 同源；当前恒空，空时前端按 title+part 组合） */
  display_title?: string;
  /** 卷标识（空=单卷本；上册/下册；Vol.1/2/3；同名多卷的区分依据） */
  part?: string;
  /** 解析进度（af_books 自持字段，REQ-042） */
  parse_status?: string; // pending / parsing / completed / failed
  pages_done?: number;
  [key: string]: unknown;
}

export interface ParseJobProgress {
  parsed: number;
  total: number;
  error?: string;
}

export interface ParseJob {
  id: string;
  book_id?: string;
  pages?: number[];
  engine?: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: ParseJobProgress;
  error?: string;
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

/** 块判定记录（af_block_reviews，旧 /review 门面，随 /edit 切换退役） */
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

/** 块编辑记录（af_block_edits，8902 EditRecord） */
export interface BlockEdit {
  edit_id?: string;
  book_id: string;
  page_no: number;
  block_index: number;
  block_type?: string;
  verdict?: '' | 'ok' | 'bad';
  note?: string;
  corrected_text?: string | null;
  corrected_bbox?: [number, number, number, number] | null;
  edited_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** 块编辑提交体（字段均可选；verdict 空串视为不提交） */
export interface BlockEditInput {
  verdict?: 'ok' | 'bad' | '';
  note?: string;
  corrected_text?: string;
  corrected_bbox?: [number, number, number, number];
}

/** ingest 结果（af_books 进度回填） */
export interface IngestResult {
  book_id: string;
  page_count: number;
  sha256: string;
  ingest_status: string;
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

/** GET /api/v1/books/{id}：单本详情（file_path/ingest_status/page_count，PDF 直显判定源） */
export function getBook(bookId: string, opts?: ApiRequestOptions): Promise<BookMeta> {
  return api.get<BookMeta>(`/books/${bookId}`, opts);
}

/** 8900 页图代理端点绝对地址（不依赖页数据请求成功即可构造——解析页原图直接渲染） */
export function bookPageImageUrl(bookId: string, pageNo: number): string {
  return `${API_BASE}/books/${encodeURIComponent(bookId)}/pages/${pageNo}/image`;
}

/** 8900 源 PDF 流端点地址（未解析时原始文件 iframe 直显） */
export function bookFileUrl(bookId: string): string {
  return `${API_BASE}/books/${encodeURIComponent(bookId)}/file`;
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

/** ingest 请求超时：PDF→页图渲染分钟级（8900→8902 同层放宽到 300s，见 axiom_client）。 */
export const INGEST_TIMEOUT_MS = 300_000;

/** POST /api/v1/books/{id}/ingest：ingest 透传（PDF→页图渲染，不调模型；工作台/列表 ingest 按钮） */
export function ingestBook(bookId: string, opts?: ApiRequestOptions): Promise<IngestResult> {
  return api.post<IngestResult>(`/books/${bookId}/ingest`, undefined, { timeoutMs: INGEST_TIMEOUT_MS, ...opts });
}

/** PUT /api/v1/books/{id}/pages/{no}/blocks/{i}/edit：块编辑门面（判定/备注/文字修正/范围修正） */
export function putBlockEdit(
  bookId: string,
  pageNo: number,
  blockIndex: number,
  input: BlockEditInput,
  opts?: ApiRequestOptions,
): Promise<BlockEdit> {
  const body: Record<string, unknown> = {};
  if (input.verdict) body.verdict = input.verdict;
  if (input.note !== undefined) body.note = input.note;
  if (input.corrected_text !== undefined) body.corrected_text = input.corrected_text;
  if (input.corrected_bbox !== undefined) body.corrected_bbox = input.corrected_bbox;
  return api.put<BlockEdit>(`/books/${bookId}/pages/${pageNo}/blocks/${blockIndex}/edit`, body, opts);
}

/** GET /api/v1/books/{id}/pages/{no}/edits：页级块编辑记录列表 */
export function getPageEdits(bookId: string, pageNo: number, opts?: ApiRequestOptions): Promise<BlockEdit[]> {
  return api.get<BlockEdit[]>(`/books/${bookId}/pages/${pageNo}/edits`, opts);
}

/** POST /api/v1/parse-jobs：提交解析任务（engine 默认 mineru；缺省 pages 由上游生成） */
export function createParseJob(
  bookId: string,
  pages?: number[],
  opts?: ApiRequestOptions,
): Promise<ParseJob> {
  // engine 省略 = 服务端默认（G 轮裁决：前端不选模型）
  return api.post<ParseJob>('/parse-jobs', { book_id: bookId, pages }, opts);
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