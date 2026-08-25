/**
 * 数据域·QED-Tracker 端点封装（8900 唯一入口，ADR 0007）
 * 契约来源：backend/qed_engine/api/tracker.py（透传 8901 /api/v1，五层模型 QED-031）
 * - /catalogs/{catalog_id}：课程目录（targets 提供课程结构，文档下载管理主数据源）
 * - /knowledge：知识行列表（一套教程/延展资料归类；可 course_id/status 过滤）
 * - /knowledge/{id}：知识行详情（含所辖书行 books）
 * - /books、/books/{id}/sources、/books/{id}/...：书行全生命周期操作
 */
import { api, type ApiRequestOptions } from './client';
import type {
  BookRecord, Catalog, CourseRecord, CurriculumRun, DomainSystem, ExploreAdoptResult, ExploreLaunchResult, ExploreRun,
  ExploreLaunchMode, ExploreRunSummary, KnowledgeDetail, KnowledgeRecord, SourceRecord,
} from '../stores';

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


// --- 领域课程体系（GET /courses：QED-033 只读透传；手工维护端点 REQ-059，2026-08-24） ---

/** GET /api/v1/courses：领域课程体系（领域含嵌套课程，服务端已按 sort_order 排序） */
export function listCourseSystem(opts?: ApiRequestOptions): Promise<DomainSystem[]> {
  return api.get<DomainSystem[]>('/courses', opts);
}

export interface CreateDomainBody {
  name: string;
  description?: string;
  stages?: string[];
}

/** POST /api/v1/domains：手工新建领域（REQ-059 §8 请求项；8901 未实现前由 UI 降级提示） */
export function createDomain(body: CreateDomainBody, opts?: ApiRequestOptions): Promise<DomainSystem> {
  return api.post<DomainSystem>('/domains', body, opts);
}

export interface UpdateDomainBody {
  description?: string;
  stages?: string[];
}

/** PATCH /api/v1/domains/{id}：修改领域描述/阶段（名称锁定不可改） */
export function updateDomain(domainId: string, body: UpdateDomainBody, opts?: ApiRequestOptions): Promise<DomainSystem> {
  return api.patch<DomainSystem>(`/domains/${domainId}`, body, opts);
}

/** DELETE /api/v1/domains/{id}：删除领域（存在课程时上游 409 保护） */
export function deleteDomain(domainId: string, opts?: ApiRequestOptions): Promise<void> {
  return api.del<void>(`/domains/${domainId}`, opts);
}

export interface CreateCourseBody {
  name: string;
  stage?: string;
  sort_order?: number;
  note?: string;
}

/** POST /api/v1/domains/{id}/courses：手工新增课程（REQ-059 §8 请求项） */
export function createCourse(domainId: string, body: CreateCourseBody, opts?: ApiRequestOptions): Promise<CourseRecord> {
  return api.post<CourseRecord>(`/domains/${domainId}/courses`, body, opts);
}

export interface UpdateCourseBody {
  stage?: string;
  sort_order?: number;
  note?: string;
}

/** PATCH /api/v1/courses/{id}：修改课程阶段/排序/备注（名称锁定不可改，REQ-059 §8 请求项） */
export function updateCourse(courseId: string, body: UpdateCourseBody, opts?: ApiRequestOptions): Promise<CourseRecord> {
  return api.patch<CourseRecord>(`/courses/${courseId}`, body, opts);
}

/** DELETE /api/v1/courses/{id}:删除课程（存在知识行时上游 409 保护） */
export function deleteCourse(courseId: string, opts?: ApiRequestOptions): Promise<void> {
  return api.del<void>(`/courses/${courseId}`, opts);
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


// --- 探索端点封装（exploration-api 冻结契约 §1~§7，2026-08-23；8901 未就绪时由 store mock 层承接） ---

/** POST /api/v1/courses/{course_id}/explore：发起课程层探索（§1） */
export function launchCourseExplore(
  courseId: string,
  body: { mode: ExploreLaunchMode; ref_text?: string; ref_doc_path?: string },
  opts?: ApiRequestOptions,
): Promise<ExploreLaunchResult> {
  return api.post<ExploreLaunchResult>(`/courses/${courseId}/explore`, body, opts);
}

/** GET /api/v1/explore-runs/{run_id}：运行详情（轮询，§2） */
export function fetchExploreRun(runId: string, opts?: ApiRequestOptions): Promise<ExploreRun> {
  return api.get<ExploreRun>(`/explore-runs/${runId}`, opts);
}

/** POST /api/v1/explore-runs/{run_id}/adopt：采纳所选（§3） */
export function adoptExploreRun(runId: string, selected: string[], opts?: ApiRequestOptions): Promise<ExploreAdoptResult> {
  return api.post<ExploreAdoptResult>(`/explore-runs/${runId}/adopt`, { selected }, opts);
}

/** POST /api/v1/explore-runs/{run_id}/discard：放弃本次（§4，幂等） */
export function discardExploreRun(runId: string, opts?: ApiRequestOptions): Promise<ExploreRun> {
  return api.post<ExploreRun>(`/explore-runs/${runId}/discard`, undefined, opts);
}

/** GET /api/v1/courses/{course_id}/explore-runs：探索历史（§5，limit+offset 分页） */
export function listCourseExploreRuns(
  courseId: string,
  paging?: { limit?: number; offset?: number },
  opts?: ApiRequestOptions,
): Promise<ExploreRunSummary[]> {
  return api.get<ExploreRunSummary[]>(`/courses/${courseId}/explore-runs`, {
    ...opts,
    params: paging ? { limit: paging.limit?.toString(), offset: paging.offset?.toString() } : undefined,
  });
}

/** POST /api/v1/curriculum-explore：发起新建领域探索（§6，domain_name 必填） */
export function launchCurriculumExplore(
  body: { domain_name: string; mode: ExploreLaunchMode; ref_text?: string; ref_doc_path?: string },
  opts?: ApiRequestOptions,
): Promise<ExploreLaunchResult> {
  return api.post<ExploreLaunchResult>('/curriculum-explore', body, opts);
}

/** GET /api/v1/curriculum-runs/{run_id}：领域探索详情（§7.1） */
export function fetchCurriculumRun(runId: string, opts?: ApiRequestOptions): Promise<CurriculumRun> {
  return api.get<CurriculumRun>(`/curriculum-runs/${runId}`, opts);
}

/** POST /api/v1/curriculum-runs/{run_id}/apply：应用所选变更（§7.2，冲突拒绝标记 conflicts） */
export function applyCurriculumRun(
  runId: string,
  selected: string[],
  opts?: ApiRequestOptions,
): Promise<{ applied: { change_id: string; entity: string; target_id: string }[]; conflicts: { change_id: string; reason: string }[]; run: CurriculumRun }> {
  return api.post(`/curriculum-runs/${runId}/apply`, { selected }, opts);
}