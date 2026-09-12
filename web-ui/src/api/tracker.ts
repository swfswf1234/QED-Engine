/**
 * 数据域·QED-Tracker 端点封装（8900 唯一入口，ADR 0007）
 * 契约来源：backend/qed_engine/api/tracker.py（透传 8901 /api/v1，五层模型 QED-031）
 * - /catalogs/{catalog_id}：课程目录（targets 提供课程结构，文档下载管理主数据源）
 * - /knowledge：教程列表（一套教程/延展资料归类；可 course_id/status 过滤）
 * - /knowledge/{id}：教程详情（含所辖书籍 books）
 * - /books、/books/{id}/sources、/books/{id}/...：书籍全生命周期操作
 */
import { api, type ApiRequestOptions } from './client';
import type {
  BookRecord, Catalog, CourseRecord, DomainSystem, ExploreApplyResult, ExploreLaunchMode,
  ExploreSessionRecord, KnowledgeDetail, KnowledgeRecord, SourceRecord,
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

/** GET /api/v1/knowledge：教程列表（rejected/superseded 由上游数据层彻底隐藏） */
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
  level?: string;
  classic_tracks?: Array<{ name: string; summary?: string; kind?: string }>;
  scope?: string;
}

/** POST /api/v1/domains：手工新建领域（REQ-059 §8 请求项；8901 未实现前由 UI 降级提示） */
export function createDomain(body: CreateDomainBody, opts?: ApiRequestOptions): Promise<DomainSystem> {
  return api.post<DomainSystem>('/domains', body, opts);
}

export interface UpdateDomainBody {
  name?: string;
  description?: string;
  stages?: string[];
  level?: string;
  classic_tracks?: Array<{ name: string; summary?: string; kind?: string }>;
  scope?: string;
  exploration_stage?: string;
  explore_pending?: Record<string, unknown> | '__CLEAR__' | null;
}

/** PATCH /api/v1/domains/{id}：修改领域描述/阶段（名称锁定不可改） */
export function updateDomain(domainId: string, body: UpdateDomainBody, opts?: ApiRequestOptions): Promise<DomainSystem> {
  return api.patch<DomainSystem>(`/domains/${domainId}`, body, opts);
}

/** DELETE /api/v1/domains/{id}：删除领域（存在课程时上游 409 保护） */
export function deleteDomain(domainId: string, opts?: ApiRequestOptions): Promise<void> {
  return api.del<void>(`/domains/${domainId}`, opts);
}

export interface ImportDomainResult {
  domain_id: string;
  courses_created: number;
  courses_updated: number;
}

/** POST /api/v1/domains/import：手动领域 JSON 导入（REQ-067 B3，QED-050） */
export function importDomain(domainData: Record<string, unknown>, targetDomainId?: string, opts?: ApiRequestOptions): Promise<ImportDomainResult> {
  return api.post<ImportDomainResult>('/domains/import', { domain: domainData, target_domain_id: targetDomainId }, opts);
}

export interface CommitImportResult {
  committed: number;
  updated: number;
}

/** POST /api/v1/domains/{id}/commit-import：确认导入课程（REQ-067 B3） */
export function commitImport(domainId: string, opts?: ApiRequestOptions): Promise<CommitImportResult> {
  return api.post<CommitImportResult>(`/domains/${domainId}/commit-import`, undefined, opts);
}

export interface CreateCourseBody {
  name: string;
  description?: string;
  stage?: string;
  track?: string;
  sort_order?: number;
  aliases?: string[];
  prerequisites?: string[];
  note?: string;
}

/** POST /api/v1/domains/{id}/courses：手工新增课程（REQ-059 §8 请求项） */
export function createCourse(domainId: string, body: CreateCourseBody, opts?: ApiRequestOptions): Promise<CourseRecord> {
  return api.post<CourseRecord>(`/domains/${domainId}/courses`, body, opts);
}

export interface UpdateCourseBody {
  description?: string;
  stage?: string;
  track?: string;
  sort_order?: number;
  aliases?: string[];
  prerequisites?: string[];
  exploration_stage?: string;
  note?: string;
}

/** PATCH /api/v1/courses/{id}：修改课程阶段/排序/备注（名称锁定不可改，REQ-059 §8 请求项） */
export function updateCourse(courseId: string, body: UpdateCourseBody, opts?: ApiRequestOptions): Promise<CourseRecord> {
  return api.patch<CourseRecord>(`/courses/${courseId}`, body, opts);
}

/** DELETE /api/v1/courses/{id}:删除课程（存在教程时上游 409 保护） */
export function deleteCourse(courseId: string, opts?: ApiRequestOptions): Promise<void> {
  return api.del<void>(`/courses/${courseId}`, opts);
}

/** GET /api/v1/knowledge/{id}：教程详情（含所辖书籍 books） */
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

/** POST /api/v1/knowledge/{id}/complete：confirmed→completed（所辖书籍全部 verified 聚合） */
export function completeKnowledge(knowledgeId: string, opts?: ApiRequestOptions): Promise<KnowledgeRecord> {
  return api.post<KnowledgeRecord>(`/knowledge/${knowledgeId}/complete`, undefined, opts);
}

/** POST /api/v1/knowledge/{id}/reject：教程否定（reason 必填 422） */
export function rejectKnowledge(knowledgeId: string, reason: string, opts?: ApiRequestOptions): Promise<KnowledgeRecord> {
  return api.post<KnowledgeRecord>(`/knowledge/${knowledgeId}/reject`, { reason }, opts);
}

/** POST /api/v1/knowledge/{id}/supersede：教程过时（reason 必填 422） */
export function supersedeKnowledge(knowledgeId: string, reason: string, opts?: ApiRequestOptions): Promise<KnowledgeRecord> {
  return api.post<KnowledgeRecord>(`/knowledge/${knowledgeId}/supersede`, { reason }, opts);
}

/** PATCH /api/v1/knowledge/{id}：更新教程（name、position、intro） */
export function updateKnowledge(knowledgeId: string, body: { name?: string; position?: string; intro?: string }, opts?: ApiRequestOptions): Promise<KnowledgeRecord> {
  return api.patch<KnowledgeRecord>(`/knowledge/${knowledgeId}`, body, opts);
}

/** DELETE /api/v1/knowledge/{id}：删除教程 */
export function deleteKnowledge(knowledgeId: string, opts?: ApiRequestOptions): Promise<void> {
  return api.del<void>(`/knowledge/${knowledgeId}`, opts);
}

/** POST /api/v1/courses/{id}/knowledge：导入课程知识（tutorials JSON） */
export function importCourseKnowledge(courseId: string, data: Record<string, unknown>, opts?: ApiRequestOptions): Promise<{ tutorials_created: number }> {
  return api.post<{ tutorials_created: number }>(`/courses/${courseId}/knowledge`, data, opts);
}

export interface CreateBookBody {
  /** 书库化创建（QED-050）：book_id 显式（{abbr}-b{NN} 格式），归属由教程 refs 承载（8901 不收 knowledge_id） */
  book_id: string;
  title: string;
  authors?: Array<{ name: string; role: string }>;
  part?: string;
  original_title?: string;
  publisher?: string;
  edition?: string;
  year?: number;
  language?: string;
  roles?: string[];
  status?: string;
  domain_id?: string;
  notes?: string;
}

/** POST /api/v1/books：书库化创建（book_id {abbr}-b{NN} 与 title 必填 422；重复 409） */
export function createBook(body: CreateBookBody, opts?: ApiRequestOptions): Promise<BookRecord> {
  return api.post<BookRecord>('/books', body, opts);
}

/** GET /api/v1/books/{id}/sources：书籍渠道尝试列表 */
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

/** POST /api/v1/books/{id}/fetch：自动下载书籍（触发下载任务） */
export function fetchBook(bookId: string, opts?: ApiRequestOptions): Promise<{ task_id?: string }> {
  return api.post<{ task_id?: string }>(`/books/${bookId}/fetch`, undefined, opts);
}

/** POST /api/v1/knowledge/{id}/fetch：批量下载教程所辖书籍（触发下载任务） */
export function fetchKnowledgeBooks(knowledgeId: string, opts?: ApiRequestOptions): Promise<{ task_id?: string }> {
  return api.post<{ task_id?: string }>(`/knowledge/${knowledgeId}/fetch`, undefined, opts);
}

/** POST /api/v1/books/{id}/import：浏览器文件选择上传 PDF（multipart，8901 落盘 + mark_owned） */
export function importBookPdf(
  bookId: string,
  file: File,
  targetPath?: string,
  opts?: ApiRequestOptions,
): Promise<BookRecord> {
  const form = new FormData();
  form.append('file', file);
  if (targetPath) form.append('target_path', targetPath);
  return api.postForm<BookRecord>(`/books/${bookId}/import`, form, opts);
}

/** POST /api/v1/books/{id}/start：开始下载（decided→downloading） */
export function startBook(bookId: string, opts?: ApiRequestOptions): Promise<BookRecord> {
  return api.post<BookRecord>(`/books/${bookId}/start`, undefined, opts);
}

/** POST /api/v1/books/{id}/fail：标记下载失败（downloading→failed） */
export function failBook(bookId: string, opts?: ApiRequestOptions): Promise<BookRecord> {
  return api.post<BookRecord>(`/books/${bookId}/fail`, undefined, opts);
}

/** POST /api/v1/books/{id}/verify：人工验收通过（downloaded→verified 终态） */
export function verifyBook(bookId: string, opts?: ApiRequestOptions): Promise<BookRecord> {
  return api.post<BookRecord>(`/books/${bookId}/verify`, undefined, opts);
}

/** POST /api/v1/books/{id}/cancel：取消下载（downloading→decided 复位） */
export function cancelBook(bookId: string, opts?: ApiRequestOptions): Promise<BookRecord> {
  return api.post<BookRecord>(`/books/${bookId}/cancel`, undefined, opts);
}


// --- 探索会话端点封装（PLAN-022 B3/F1，2026-08-28；旧 explore-runs 契约已被 8901 migration 0013 废弃） ---

/** POST /api/v1/explore-sessions 请求体（target=domain 需 domain_name；target=course 需 course_id） */
export interface CreateExploreSessionBody {
  target: 'domain' | 'course';
  mode: ExploreLaunchMode;
  domain_name?: string;
  /** 重探时携带（已有领域 id，会话据此回写 exploration_stage） */
  domain_id?: string;
  course_id?: string;
  ref_text?: string;
  ref_doc_path?: string;
}

/** POST /api/v1/explore-sessions：发起探索会话（202 + session_id，后台线程执行 8901 dry-run 管线） */
export function createExploreSession(
  body: CreateExploreSessionBody,
  opts?: ApiRequestOptions,
): Promise<ExploreSessionRecord> {
  return api.post<ExploreSessionRecord>('/explore-sessions', body, opts);
}

/** GET /api/v1/explore-sessions/{id}：轮询会话（running/waiting_name_confirm/ready/failed） */
export function fetchExploreSession(sessionId: string, opts?: ApiRequestOptions): Promise<ExploreSessionRecord> {
  return api.get<ExploreSessionRecord>(`/explore-sessions/${sessionId}`, opts);
}

/** POST /api/v1/explore-sessions/{id}/confirm-name：名称确认（waiting_name_confirm → 重跑管线） */
export function confirmExploreSessionName(
  sessionId: string,
  nameOverride: string,
  opts?: ApiRequestOptions,
): Promise<ExploreSessionRecord> {
  return api.post<ExploreSessionRecord>(`/explore-sessions/${sessionId}/confirm-name`, { name_override: nameOverride }, opts);
}

/** POST /api/v1/explore-sessions/{id}/apply：应用所选（领域=课程对象清单；课程=tutorial 套清单） */
export function applyExploreSession(
  sessionId: string,
  selected: unknown[],
  opts?: ApiRequestOptions,
): Promise<ExploreApplyResult> {
  return api.post<ExploreApplyResult>(`/explore-sessions/${sessionId}/apply`, { selected }, opts);
}

/** DELETE /api/v1/explore-sessions/{id}：放弃会话（exploration_stage 回退未开始） */
export function deleteExploreSession(sessionId: string, opts?: ApiRequestOptions): Promise<{ ok: boolean }> {
  return api.del<{ ok: boolean }>(`/explore-sessions/${sessionId}`, opts);
}


// --- 领域探索五态门面（PLAN-033/034，2026-09-08；契约：api-contracts.md「领域探索五态门面」） ---

/** explore_pending 载荷课程条目（courses.json / 导入挂起共享形态） */
export interface ExplorePendingCourse {
  course_id?: string;
  name: string;
  description?: string;
  summary?: string;
  stage?: string;
  track?: string;
  tier?: number;
  aliases?: string[];
  prerequisites?: string[];
  [key: string]: unknown;
}

/** explore_pending 载荷（kind 四形态：审阅/导入挂起/名称确认/失败） */
export interface ExplorePending {
  kind: 'review_results' | 'import_courses' | 'name_confirmation' | 'error' | 'failed';
  courses?: ExplorePendingCourse[];
  name_check?: Record<string, unknown>;
  error?: string;
  [key: string]: unknown;
}

/** GET /domains/{id}/explore-status 响应 */
export interface DomainExploreStatus {
  domain_id: string;
  name?: string | null;
  exploration_stage: string;
  active_session: boolean;
  task_id?: string | null;
  explore_pending: ExplorePending | null;
  available: boolean;
}

/** POST /api/v1/domains/{domainId}/explore-knowledge：提交领域探索任务（202→探索中，成功后已生成） */
export function exploreDomainKnowledge(
  domainId: string,
  body: { mode?: string } = {},
  opts?: ApiRequestOptions,
): Promise<{ domain_id: string; task_id: string; exploration_stage: string; message: string }> {
  return api.post(`/domains/${domainId}/explore-knowledge`, body, opts);
}

/** POST /api/v1/domains/{domainId}/confirm-domain：确认领域（已生成→探索中；名称确认挂起时改名重提） */
export function confirmDomainInfo(
  domainId: string,
  body: { name?: string } = {},
  opts?: ApiRequestOptions,
): Promise<{ domain_id: string; task_id: string | null; exploration_stage: string; degraded?: boolean; message: string }> {
  return api.post(`/domains/${domainId}/confirm-domain`, body, opts);
}

/** POST /api/v1/domains/{domainId}/confirm-knowledge：确认课程（待确认→已完成；selected 缺省全选） */
export function confirmCourseKnowledge(
  domainId: string,
  selected?: string[],
  opts?: ApiRequestOptions,
): Promise<{ domain_id: string; ok: boolean; exploration_stage: string; applied: number; applied_courses?: string[]; message: string }> {
  return api.post(`/domains/${domainId}/confirm-knowledge`, selected ? { selected } : {}, opts);
}

/** POST /api/v1/courses/{courseId}/explore-knowledge：课程探索（explore-sessions 通道，202） */
export function exploreCourseKnowledge(
  courseId: string,
  body: { mode?: string } = {},
  opts?: ApiRequestOptions,
): Promise<{ session_id: string; status: string; message: string }> {
  return api.post(`/courses/${courseId}/explore-knowledge`, body, opts);
}

/** POST /api/v1/courses/{courseId}/confirm：课程探索确认（待确认→已完成，PLAN-035） */
export function confirmCourse(
  courseId: string,
  opts?: ApiRequestOptions,
): Promise<{ course_id: string; ok: boolean; exploration_stage: string; message: string }> {
  return api.post(`/courses/${courseId}/confirm`, {}, opts);
}

/** GET /api/v1/domains/{domainId}/explore-status：领域探索状态轮询（含 explore_pending 合成） */
export function getDomainExploreStatus(
  domainId: string,
  opts?: ApiRequestOptions,
): Promise<DomainExploreStatus> {
  return api.get(`/domains/${domainId}/explore-status`, opts);
}