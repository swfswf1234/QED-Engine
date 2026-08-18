/**
 * 数据域·QED-Tracker 端点封装（8900 唯一入口，ADR 0007）
 * 契约来源：backend/qed_engine/api/tracker.py（透传 8901 /api/v1，五层模型 QED-031）
 * - /catalogs/{catalog_id}：课程目录（targets 提供课程结构，下载管理主数据源）
 * - /knowledge：知识行列表（一套教程/延展资料归类；可 course_id/status 过滤）
 * - /knowledge/{id}：知识行详情（含所辖书行 books）
 * - /books、/books/{id}/sources、/books/{id}/...：书行全生命周期操作
 */
import { api, type ApiRequestOptions } from './client';
import type { BookRecord, Catalog, KnowledgeDetail, KnowledgeRecord, SourceRecord } from '../stores';

/** 内置目录 id（冻结目录 math-qe，QED-Tracker catalog.py） */
export const CATALOG_ID = 'math-qe';

/** GET /api/v1/catalogs/{catalog_id}：课程目录详情 */
export async function listCatalog(catalogId: string = CATALOG_ID, opts?: ApiRequestOptions): Promise<Catalog> {
  return api.get<Catalog>(`/catalogs/${catalogId}`, opts);
}

export interface ListKnowledgeParams {
  course_id?: string;
  status?: string;
}

/** GET /api/v1/knowledge：知识行列表（rejected/superseded 由上游数据层彻底隐藏） */
export async function listKnowledge(
  params?: ListKnowledgeParams,
  opts?: ApiRequestOptions,
): Promise<KnowledgeRecord[]> {
  return api.get<KnowledgeRecord[]>('/knowledge', { ...opts, params: params as Record<string, string | undefined> | undefined });
}

/** GET /api/v1/knowledge/{id}：知识行详情（含所辖书行 books） */
export async function getKnowledge(knowledgeId: string, opts?: ApiRequestOptions): Promise<KnowledgeDetail> {
  return api.get<KnowledgeDetail>(`/knowledge/${knowledgeId}`, opts);
}

export interface ConfirmKnowledgeBody {
  textbook_ref?: Record<string, unknown>;
  exercise_ref?: Record<string, unknown>;
  textbook_intro?: string;
  exercise_intro?: string;
}

/** POST /api/v1/knowledge/{id}/confirm：draft→confirmed（定稿：决定引用 + 简介） */
export function confirmKnowledge(knowledgeId: string, body: ConfirmKnowledgeBody, opts?: ApiRequestOptions): Promise<KnowledgeRecord> {
  return api.post<KnowledgeRecord>(`/knowledge/${knowledgeId}/confirm`, body, opts);
}

/** POST /api/v1/knowledge/{id}/complete：confirmed→completed（所辖书行全部 verified 聚合） */
export function completeKnowledge(knowledgeId: string, opts?: ApiRequestOptions): Promise<KnowledgeRecord> {
  return api.post<KnowledgeRecord>(`/knowledge/${knowledgeId}/complete`, undefined, opts);
}

/** POST /api/v1/knowledge/{id}/reject：知识行否定（reason 必填 422） */
export function rejectKnowledge(knowledgeId: string, reason: string, opts?: ApiRequestOptions): Promise<KnowledgeRecord> {
  return api.post<KnowledgeRecord>(`/knowledge/${knowledgeId}/reject`, { reason }, opts);
}

/** POST /api/v1/knowledge/{id}/supersede：知识行过时（reason 必填 422） */
export function supersedeKnowledge(knowledgeId: string, reason: string, opts?: ApiRequestOptions): Promise<KnowledgeRecord> {
  return api.post<KnowledgeRecord>(`/knowledge/${knowledgeId}/supersede`, { reason }, opts);
}

export interface CreateBookBody {
  knowledge_id: string;
  kind?: string;
  roles?: string[];
  title: string;
  part?: string;
  display_title?: string;
  authors?: string[];
  language?: string;
  version?: Record<string, unknown>;
  source?: Record<string, unknown>;
  original_url?: string;
}

/** POST /api/v1/books：新建书行候选（knowledge_id + title 必填 422） */
export function createBook(body: CreateBookBody, opts?: ApiRequestOptions): Promise<BookRecord> {
  return api.post<BookRecord>('/books', body, opts);
}

/** GET /api/v1/books/{id}/sources：书行渠道尝试列表 */
export function listBookSources(bookId: string, opts?: ApiRequestOptions): Promise<SourceRecord[]> {
  return api.get<SourceRecord[]>(`/books/${bookId}/sources`, opts);
}

export interface AddBookSourceBody {
  channel?: string;
  provider_id?: string;
  page_url?: string;
  download_url?: string;
  file_keywords?: string;
  ok?: boolean;
  note?: string;
}

/** POST /api/v1/books/{id}/sources：登记一次渠道尝试 */
export function addBookSource(bookId: string, body: AddBookSourceBody, opts?: ApiRequestOptions): Promise<SourceRecord> {
  return api.post<SourceRecord>(`/books/${bookId}/sources`, body, opts);
}

/** POST /api/v1/books/{id}/register：人工下载登记（candidate→downloaded，relative_path 必填） */
export function registerBook(bookId: string, relativePath: string, opts?: ApiRequestOptions): Promise<BookRecord> {
  return api.post<BookRecord>(`/books/${bookId}/register`, { relative_path: relativePath }, opts);
}

/** POST /api/v1/books/{id}/decide：候选→决定 */
export function decideBook(bookId: string, opts?: ApiRequestOptions): Promise<BookRecord> {
  return api.post<BookRecord>(`/books/${bookId}/decide`, undefined, opts);
}

/** POST /api/v1/books/{id}/start：决定→下载中 */
export function startBook(bookId: string, opts?: ApiRequestOptions): Promise<BookRecord> {
  return api.post<BookRecord>(`/books/${bookId}/start`, undefined, opts);
}

/** POST /api/v1/books/{id}/fail：下载失败标记（可重试） */
export function failBook(bookId: string, opts?: ApiRequestOptions): Promise<BookRecord> {
  return api.post<BookRecord>(`/books/${bookId}/fail`, undefined, opts);
}

/** POST /api/v1/books/{id}/retry：失败重试 → downloading */
export function retryBook(bookId: string, opts?: ApiRequestOptions): Promise<BookRecord> {
  return api.post<BookRecord>(`/books/${bookId}/retry`, undefined, opts);
}

/** POST /api/v1/books/{id}/verify：人工验收通过（downloaded→verified 终态） */
export function verifyBook(bookId: string, opts?: ApiRequestOptions): Promise<BookRecord> {
  return api.post<BookRecord>(`/books/${bookId}/verify`, undefined, opts);
}

/** POST /api/v1/books/{id}/reject：书行否定（reason 必填 422；note 可选） */
export function rejectBook(bookId: string, reason: string, note?: string, opts?: ApiRequestOptions): Promise<BookRecord> {
  return api.post<BookRecord>(`/books/${bookId}/reject`, { reason, ...(note ? { note } : {}) }, opts);
}

/** POST /api/v1/books/{id}/supersede：书行过时（reason 必填 422） */
export function supersedeBook(bookId: string, reason: string, opts?: ApiRequestOptions): Promise<BookRecord> {
  return api.post<BookRecord>(`/books/${bookId}/supersede`, { reason }, opts);
}
