/**
 * 学习域·知识梳理星图端点封装（8900 唯一入口，ADR 0007）
 * 契约来源：backend/qed_engine/api/learn.py（M5 知识点族 + M6 层级化端点）
 * 契约正文：docs/architecture/api-contracts.md §⑥
 * - /learn/star-map：领域 → track 星云 → 课程节点（含知识点计数）+ 先修边
 * - /learn/courses/{id}/knowledge-points：已确认知识点 + 同 norm_key 待选叙述
 * - /learn/kp-details*：候选池登记 / 人工确认提升 / 驳回
 */
import { api, type ApiRequestOptions } from './client';

/** 星图课程节点（后端已按 sort_order 排序） */
export interface StarCourseNode {
  course_id: string;
  name: string;
  track: string;
  stage: string;
  sort_order: number | null;
  kp_confirmed: number;
  kp_candidates: number;
}

/** track 星云（kind：main=主轨 / 其余=支轨） */
export interface TrackCluster {
  track: string;
  kind: string;
  summary: string;
  courses: StarCourseNode[];
}

export interface StarMapDomain {
  domain_id: string;
  name: string;
  level: string;
  tracks: TrackCluster[];
}

/** 先修边（跨 track 边由布局降为星云质心软链） */
export interface StarMapEdge {
  from: string;
  to: string;
  domain_id: string;
  cross_track: boolean;
}

export interface StarMapResponse {
  domains: StarMapDomain[];
  edges: StarMapEdge[];
}

export type KnowledgePointType = 'memory' | 'procedure' | 'concept' | 'design';

/** 已确认知识点（qed_knowledge_point 行） */
export interface KnowledgePoint {
  kp_id: string;
  domain_id: string;
  domain_label: string;
  course_id: string;
  course_label: string;
  name: string;
  norm_key: string;
  type: KnowledgePointType | null;
  order_hint: number | null;
  summary: string;
  anchors: Array<Record<string, unknown>>;
  from_detail_id: string | null;
  confirmed: boolean;
  /** 同 norm_key 的待选叙述（多版本并存，仅课程总览下发） */
  candidates?: KpCandidate[];
  [key: string]: unknown;
}

/** 候选明细状态（qed_learn_kp_detail.gen_status 闭集） */
export type KpDetailStatus = 'draft' | 'candidate' | 'adopted' | 'rejected';

/** 候选叙述（qed_learn_kp_detail 待选态投影） */
export interface KpCandidate {
  detail_id: string;
  name: string;
  type: KnowledgePointType | null;
  narrative: string;
  payload: Record<string, unknown>;
  anchors: Array<Record<string, unknown>>;
  gen_batch: string;
  model_ref: string;
  gen_status: KpDetailStatus;
}

export interface CourseKnowledgeResponse {
  course: { course_id: string; name: string; track: string; domain_id: string };
  points: KnowledgePoint[];
  total: number;
  candidate_total: number;
}

/** 候选明细全量行（GET /kp-details：含 adopted/rejected，供待选池与状态核对） */
export interface KpDetailRow extends KpCandidate {
  domain_id: string;
  domain_label: string;
  course_id: string;
  course_label: string;
  norm_key: string;
  kp_id: string | null;
  map_seed: string | null;
  dedup_of: string | null;
  parent_kp_id: string | null;
  intent: KpIntent;
  book_ref: string;
  confirmed: number | boolean;
  created_at: string;
  updated_at: string;
}

/** GET /api/v1/learn/star-map：星图一次取全 */
export function getStarMap(domain?: string, opts?: ApiRequestOptions): Promise<StarMapResponse> {
  return api.get<StarMapResponse>('/learn/star-map', { ...opts, params: { domain } });
}

/** GET /api/v1/learn/courses/{course_id}/knowledge-points：课程知识点总览 */
export function getCourseKnowledge(courseId: string, opts?: ApiRequestOptions): Promise<CourseKnowledgeResponse> {
  return api.get<CourseKnowledgeResponse>(`/learn/courses/${courseId}/knowledge-points`, opts);
}

/** GET /api/v1/learn/kp-details?course=X&parent=Y：候选明细池（待选/已采纳/已驳回，可按章过滤） */
export function listKpDetails(
  courseId: string,
  parentKpId?: string | null,
  opts?: ApiRequestOptions,
): Promise<{ details: KpDetailRow[]; total: number }> {
  return api.get<{ details: KpDetailRow[]; total: number }>('/learn/kp-details', {
    ...opts,
    params: { course: courseId, parent: parentKpId ?? undefined, limit: '500' },
  });
}

/** POST /api/v1/learn/kp-details：候选明细登记（demo 手工写面） */
export function addKpDetail(
  body: {
    course_id: string;
    name: string;
    type?: KnowledgePointType;
    narrative?: string;
    gen_batch?: string;
    anchors?: KpAnchor[];
    gen_status?: 'draft' | 'candidate';
    parent_kp_id?: string | null;
    intent?: KpIntent;
    book_ref?: string;
  },
  opts?: ApiRequestOptions,
): Promise<Record<string, unknown>> {
  return api.post<Record<string, unknown>>('/learn/kp-details', body, opts);
}

/** POST /api/v1/learn/kp-details/{detail_id}/confirm：确认并提升到共享主表 */
export function confirmKpDetail(detailId: string, opts?: ApiRequestOptions): Promise<{ point: KnowledgePoint }> {
  return api.post<{ point: KnowledgePoint }>(`/learn/kp-details/${detailId}/confirm`, undefined, opts);
}

/** POST /api/v1/learn/kp-details/{detail_id}/reject：驳回（不落主表） */
export function rejectKpDetail(detailId: string, opts?: ApiRequestOptions): Promise<{ detail: Record<string, unknown> }> {
  return api.post<{ detail: Record<string, unknown> }>(`/learn/kp-details/${detailId}/reject`, undefined, opts);
}

/** 批注用途（qed_learn_kp_detail.intent 闭集，与四分类 type 正交） */
export type KpIntent = 'summary' | 'explanation';

/** 来源锚（anchors JSON 元素，契约见 api-contracts §⑥） */
export interface KpAnchor {
  kind: string;
  ref_id: string;
  page?: number;
  snippet?: string;
  [key: string]: unknown;
}

/** outline 行（书籍目录节点＝大知识点）：页范围承载位在 source_ref */
export interface OutlineRow extends KnowledgePoint {
  node_kind: 'outline' | 'point';
  parent_kp_id: string | null;
  depth: number | null;
  book_ref: string;
  source_ref: { kind?: string; ref_id?: string; page_start?: number; page_end?: number } | null;
  point_count?: number;
}

export interface OutlineResponse {
  course_id: string;
  book_ref: string;
  outline: OutlineRow[];
}

/** GET /api/v1/learn/courses/{id}/outline：章节树一次取全（前序平铺 + 每章知识点计数） */
export function getOutline(
  courseId: string,
  bookRef?: string,
  opts?: ApiRequestOptions,
): Promise<OutlineResponse> {
  return api.get<OutlineResponse>(`/learn/courses/${courseId}/outline`, {
    ...opts,
    params: { book: bookRef || undefined },
  });
}

/** PUT /api/v1/learn/courses/{id}/outline：目录确认后整树幂等替换（页范围＝PDF 页序） */
export function putOutline(
  courseId: string,
  body: { book_ref: string; tree: unknown[] },
  opts?: ApiRequestOptions,
): Promise<OutlineResponse & { reused?: number }> {
  return api.put<OutlineResponse & { reused?: number }>(`/learn/courses/${courseId}/outline`, body, opts);
}

/** PATCH /api/v1/learn/knowledge-points/{kp_id}：人工移动归属 / 改名 / 顺序 */
export function patchKnowledgePoint(
  kpId: string,
  body: { parent_kp_id?: string | null; name?: string; order_hint?: number },
  opts?: ApiRequestOptions,
): Promise<KnowledgePoint> {
  return api.patch<KnowledgePoint>(`/learn/knowledge-points/${kpId}`, body, opts);
}

/* ---------- M2 练习与复习（docs/architecture/api-contracts.md §⑥，8 端点） ---------- */

/** 题源书目行（`qt_books.roles` 过滤 + 8902 解析态联查；课程归属空则回退解析表） */
export interface QuestionBook {
  book_id: string;
  title: string;
  roles: string[];
  course_id: string;
  parse_status: string;
  page_count: number;
  /** 已有解析产物的页数——0＝该页范围必然全 404，不可作题源 */
  parsed_pages: number;
}

/** 题面投影（缝 2：不含 expected_answer/keywords/explanation） */
export interface QuestionRow {
  question_id: string;
  course_id: string;
  kind: 'quiz' | 'flashcard';
  question_type: 'choice' | 'short' | 'open' | null;
  stem: string;
  options: Array<{ label: string; body: string }> | null;
  answer_back: string;
  difficulty: string;
  kp_type: KnowledgePointType | null;
  kp_id: string | null;
  source_kind: string;
  book_ref: string;
  source_ref: Record<string, unknown> | null;
  answer_source: string;
  gen_batch: string;
  model_ref: string;
  meta: Record<string, unknown>;
  retired: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** 作答行（错题本人工位与判分结果） */
export interface AttemptRow {
  attempt_id: number;
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  method: string;
  judge_note: string;
  score_trend: 'new' | 'improved' | 'declined' | 'unchanged';
  resolved: boolean;
  bookmarked: boolean;
  origin: 'new' | 'review' | 'manual';
  review_date: string | null;
  answered_at: string;
  [key: string]: unknown;
}

/** 判分响应里的复习回写位 */
export interface ReviewWriteBack {
  target_kind: string;
  target_id: string;
  course_id: string;
  kp_type: KnowledgePointType | null;
  interval_index: number;
  due_at: string;
  next_due_at: string;
}

export interface AttemptResponse {
  attempt_id: number;
  question_id: string;
  is_correct: boolean;
  method: string;
  judge_note: string;
  score_trend: AttemptRow['score_trend'];
  resolved: boolean;
  answered_at: string;
  expected_answer: string | null;
  explanation: string | null;
  review: ReviewWriteBack;
}

/** 到期队列行（题粒度与知识点粒度双形态） */
export interface ReviewDueTask {
  target_kind: 'question' | 'kp';
  target_id: string;
  course_id: string;
  kp_type: KnowledgePointType | null;
  interval_index: number;
  due_at: string;
  priority: number;
  reason: 'wrong' | 'type';
  overdue_days: number;
  question: QuestionRow | null;
}

/** 错题本行（派生，一题一行取最近作答） */
export interface MistakeItem {
  question: QuestionRow;
  last_attempt: AttemptRow;
  attempt_count: number;
  wrong_count: number;
  is_correct: boolean;
  resolved: boolean;
  bookmarked: boolean;
  score_trend: AttemptRow['score_trend'];
  due_today: boolean;
}

export interface MistakeStats {
  total: number;
  wrong: number;
  unresolved: number;
  bookmarked: number;
  due_today: number;
}

/** GET /api/v1/learn/question-books：题源书目（R-10 根侧透传 + roles 过滤） */
export function getQuestionBooks(
  courseId?: string,
  role?: string,
  opts?: ApiRequestOptions,
): Promise<{ course_id: string; books: QuestionBook[] }> {
  return api.get<{ course_id: string; books: QuestionBook[] }>('/learn/question-books', {
    ...opts,
    params: { course: courseId, role },
  });
}

/** POST /api/v1/learn/questions：人工确认后批量入库（`stem_hash` 幂等跳重） */
export function addQuestions(
  body: {
    course_id: string;
    gen_batch?: string;
    model_ref?: string;
    learn_course_id?: string | null;
    questions: Array<Record<string, unknown>>;
  },
  opts?: ApiRequestOptions,
): Promise<{
  created: number;
  skipped_duplicates: number;
  gen_batch: string;
  model_ref: string;
  questions: QuestionRow[];
}> {
  return api.post('/learn/questions', body, opts);
}

/** GET /api/v1/learn/questions：题库浏览（题面投影） */
export function listQuestions(
  params: Record<string, string | undefined> = {},
  opts?: ApiRequestOptions,
): Promise<{ questions: QuestionRow[]; total: number }> {
  return api.get<{ questions: QuestionRow[]; total: number }>('/learn/questions', { ...opts, params });
}

/** PATCH /api/v1/learn/questions/{id}：人工面白名单（裁决 ⑨ 的升级路径） */
export function patchQuestion(
  questionId: string,
  body: Record<string, unknown>,
  opts?: ApiRequestOptions,
): Promise<QuestionRow> {
  return api.patch<QuestionRow>(`/learn/questions/${questionId}`, body, opts);
}

/** POST /api/v1/learn/attempts：提交作答（同事务判分，判分依据只在此回传） */
export function addAttempt(
  body: {
    question_id: string;
    user_answer: string;
    origin?: 'new' | 'review' | 'manual';
    review_date?: string | null;
    self_result?: 'correct' | 'again';
  },
  opts?: ApiRequestOptions,
): Promise<AttemptResponse> {
  return api.post<AttemptResponse>('/learn/attempts', body, opts);
}

/** GET /api/v1/learn/review/due：到期复习队列 */
export function getReviewDue(
  courseId?: string,
  maxTasks?: number,
  opts?: ApiRequestOptions,
): Promise<{ course_id: string; tasks: ReviewDueTask[]; total_due: number }> {
  return api.get<{ course_id: string; tasks: ReviewDueTask[]; total_due: number }>('/learn/review/due', {
    ...opts,
    params: { course: courseId, max_tasks: maxTasks === undefined ? undefined : String(maxTasks) },
  });
}

/** GET /api/v1/learn/mistakes：错题本（读时派生） */
export function listMistakes(
  params: Record<string, string | undefined> = {},
  opts?: ApiRequestOptions,
): Promise<{ items: MistakeItem[]; total: number; stats: MistakeStats }> {
  return api.get<{ items: MistakeItem[]; total: number; stats: MistakeStats }>('/learn/mistakes', {
    ...opts,
    params,
  });
}

/** PATCH /api/v1/learn/attempts/{id}：错题本人工位（收藏 / 已解决） */
export function patchAttempt(
  attemptId: number,
  body: { bookmarked?: boolean; resolved?: boolean },
  opts?: ApiRequestOptions,
): Promise<AttemptRow> {
  return api.patch<AttemptRow>(`/learn/attempts/${attemptId}`, body, opts);
}

/* ---------- M1 学习链路面（主链 M-1 契约：课程注册 / 单元树 / 编译作业 / 派生进度） ---------- */

/** 课程态（后端 `derived.status` 闭集，读时派生非落列） */
export type LearnCourseStatus = 'draft' | 'compiling' | 'learning' | 'completed';

/** 块类型闭集（`PUT …/syllabus` 节点 `type`，与后端 UNIT_TYPES 同集） */
export type LearnUnitType = 'text' | 'formula' | 'figure' | 'quiz' | 'flashcard';

export interface CourseRefBody {
  ref_id: string;
  label?: string;
}

export interface CourseResource {
  kind: 'book' | 'af_version' | 'knowledge';
  ref_id: string;
  label: string;
}

export interface PageWindow {
  start: number;
  end: number;
}

/** 派生进度（`GET …/progress` 与课程行 `derived` 同形状） */
export interface LearnDerived {
  status: LearnCourseStatus;
  total: number;
  done: number;
  skipped: number;
  percent: number;
  current_unit_id: string | null;
  completed: boolean;
}

export interface LearnCourse {
  learn_course_id: string;
  name: string;
  domain_ref: CourseRefBody | null;
  course_ref: CourseRefBody | null;
  direction: string;
  resources: CourseResource[];
  compile_status: 'proposed' | 'running' | 'completed' | 'failed' | null;
  compile_done: number;
  compile_total: number;
  failure_count: number;
  page_windows: PageWindow[] | null;
  compile_fingerprint: string | null;
  instructions: string;
  agent_notes: string;
  created_at: string;
  updated_at: string;
  derived: LearnDerived;
  unit_count?: number;
}

/** 单元树节点（section＝章节大纲、unit＝最小学习块）；source_ref 承载块页窗 */
export interface LearnUnit {
  unit_id: string;
  learn_course_id: string;
  parent_id: string | null;
  level: 'section' | 'unit';
  title: string;
  sort_order: number;
  confirmed: boolean;
  covered: boolean;
  type: LearnUnitType | null;
  payload: { text?: string; [key: string]: unknown } | null;
  source_ref: {
    ref_id?: string;
    page?: number | null;
    page_start?: number;
    page_end?: number;
    block_index?: number | null;
  } | null;
  gen_status: 'pending' | 'generated' | 'failed';
  active: boolean;
  drift?: boolean;
  [key: string]: unknown;
}

export interface CreateLearnCourseBody {
  name: string;
  resources: CourseResource[];
  domain_ref?: CourseRefBody | null;
  course_ref?: CourseRefBody | null;
  direction?: string;
  instructions?: string;
  agent_notes?: string;
}

/** GET /api/v1/learn/courses：学习课程列表（含派生进度） */
export function listLearnCourses(opts?: ApiRequestOptions): Promise<{ courses: LearnCourse[] }> {
  return api.get<{ courses: LearnCourse[] }>('/learn/courses', opts);
}

/** POST /api/v1/learn/courses：引用式注册（resources 只存 ref_id + label 快照） */
export function createLearnCourse(
  body: CreateLearnCourseBody,
  opts?: ApiRequestOptions,
): Promise<LearnCourse> {
  return api.post<LearnCourse>('/learn/courses', body, opts);
}

/** GET /api/v1/learn/courses/{learn_course_id}：详情聚合（含 derived 与 unit_count） */
export function getLearnCourse(courseId: string, opts?: ApiRequestOptions): Promise<LearnCourse> {
  return api.get<LearnCourse>(`/learn/courses/${courseId}`, opts);
}

/** DELETE /api/v1/learn/courses/{id}：删除（编译在跑＝409） */
export function deleteLearnCourse(courseId: string, opts?: ApiRequestOptions): Promise<{ deleted: string }> {
  return api.del<{ deleted: string }>(`/learn/courses/${courseId}`, opts);
}

/** PUT /api/v1/learn/courses/{id}/syllabus：整树草稿覆写（节点可带 type/payload/source_ref 页窗） */
export function putSyllabus(
  courseId: string,
  tree: unknown[],
  opts?: ApiRequestOptions,
): Promise<{ tree: unknown[]; unit_count: number }> {
  return api.put<{ tree: unknown[]; unit_count: number }>(`/learn/courses/${courseId}/syllabus`, { tree }, opts);
}

/** GET /api/v1/learn/courses/{id}/units：单元树（level 过滤＝章节视图 or 块序列） */
export function listLearnUnits(
  courseId: string,
  level?: 'section' | 'unit',
  opts?: ApiRequestOptions,
): Promise<{ units: LearnUnit[] }> {
  return api.get<{ units: LearnUnit[] }>(`/learn/courses/${courseId}/units`, {
    ...opts,
    params: { level: level ?? undefined },
  });
}

/** PATCH /api/v1/learn/units/{id}：人工面白名单（title/order/confirmed/covered） */
export function patchLearnUnit(
  unitId: string,
  body: { title?: string; order?: number; confirmed?: boolean; covered?: boolean },
  opts?: ApiRequestOptions,
): Promise<LearnUnit> {
  return api.patch<LearnUnit>(`/learn/units/${unitId}`, body, opts);
}

/** POST …/compile/propose：登记人工页窗（编译输入面，drift 判定基线） */
export function proposeCompile(
  courseId: string,
  pageWindows: PageWindow[],
  opts?: ApiRequestOptions,
): Promise<{ compile_status: 'proposed'; page_windows: PageWindow[] }> {
  return api.post(`/learn/courses/${courseId}/compile/propose`, { page_windows: pageWindows }, opts);
}

/** POST …/compile/start：两级确认齐备后受理（202，轮询 compile 状态） */
export function startCompile(courseId: string, opts?: ApiRequestOptions): Promise<{ compile_status: 'running' }> {
  return api.post(`/learn/courses/${courseId}/compile/start`, undefined, opts);
}

export interface CompileStatus {
  compile_status: 'proposed' | 'running' | 'completed' | 'failed' | null;
  done: number;
  total: number;
  failure_count: number;
}

/** GET …/compile：编译作业态与断点位（读课程行自 carry） */
export function getCompileStatus(courseId: string, opts?: ApiRequestOptions): Promise<CompileStatus> {
  return api.get<CompileStatus>(`/learn/courses/${courseId}/compile`, opts);
}

/** GET …/progress：派生进度 + 结课位（只读，看板数据源） */
export function getLearnProgress(courseId: string, opts?: ApiRequestOptions): Promise<LearnDerived> {
  return api.get<LearnDerived>(`/learn/courses/${courseId}/progress`, opts);
}

/** POST …/progress：学习事件写入（done/skipped/pending，派生重算的输入事实） */
export function setLearnProgress(
  courseId: string,
  unitId: string,
  status: 'done' | 'skipped' | 'pending',
  opts?: ApiRequestOptions,
): Promise<{ unit_id: string; status: string; derived: LearnDerived }> {
  return api.post(`/learn/courses/${courseId}/progress`, { unit_id: unitId, status }, opts);
}

/**
 * 共享课程 id → 学习课程行：以 `course_ref.ref_id` 桥接（一个共享课程一门学习课）。
 * 未登记＝null（界面给「去书架创建学习课程」空态，不静默造课）。
 */
export function findLearnCourseFor(courses: LearnCourse[], courseId: string): LearnCourse | null {
  return courses.find((course) => course.course_ref?.ref_id === courseId) ?? null;
}
