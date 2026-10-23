/**
 * 学习域契约层（8900 唯一入口，ADR 0007）
 * 契约来源：backend/qed_engine/api/learn.py；正文：docs/architecture/api-contracts.md §⑥
 * v1.0 三张化（ADR 0026）后的读源改道：
 * - `qe_unit` 退出 → 推进序列改读 `GET …/knowledge-points` 的 `sequence`（主表 point 行 × 章 outline × kp 行）
 * - `qe_kp_detail` 退出 → 条级注解写主表 `angles`，长文按 `narrative_ref` 走文件读腿
 * - `qe_review_task` 退出 → 到期队列由 `qe_attempt` 流水重放派生（`/review/due` 字段名不变）
 * - `owner` 不收不回显（D7）：前端不传、不显、不据此分支；学习课程 ID 即共享课程 ID（D4）
 */
import { api, type ApiRequestOptions } from './client';

/* ---------- 知识探索·星图与知识点主表 ---------- */

/** 星图课程节点（后端已按 sort_order 排序；description＝qed_course 叙述，悬停提示用） */
export interface StarCourseNode {
  course_id: string;
  name: string;
  track: string;
  stage: string;
  sort_order: number | null;
  description?: string;
  kp_confirmed: number;
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

/** 主表节点形态：outline＝目录节点（大知识点），point＝细知识点 */
export type NodeKind = 'outline' | 'point';

/** 多角度叙述闭集（主表 `angles` 元素；数组序＝权威排序） */
export type AngleKind = 'summary' | 'explanation' | 'definition' | 'theorem' | 'proof' | 'example';

export interface KpAngle {
  angle: AngleKind;
  note?: string;
  [key: string]: unknown;
}

/** 来源锚（anchors JSON 元素） */
export interface KpAnchor {
  kind: string;
  ref_id: string;
  page?: number;
  /** 页内块序（页码＋块序精确命中某一块；旧行缺位时按页回落） */
  block_index?: number;
  snippet?: string;
  [key: string]: unknown;
}

/** 正文位置（outline 行承载章/节页窗；point 行可空） */
export interface KpSourceRef {
  kind?: string;
  ref_id?: string;
  page_start?: number;
  page_end?: number;
}

/**
 * 知识点主表行的**前端投影**：只声明界面上真读的列（25 列全口径见
 * docs/architecture/database-design.md 与 api-contracts.md §⑥，其余列经索引签名原样透传，不认领）。
 */
export interface KnowledgePoint {
  kp_id: string;
  name: string;
  node_kind: NodeKind;
  parent_kp_id?: string | null;
  depth?: number | null;
  book_ref?: string | null;
  domain_id?: string;
  course_id?: string;
  type?: KnowledgePointType | null;
  order_hint?: number | null;
  summary?: string;
  /** 同物异名（权威名恒为 `name`，本列不表权威） */
  aliases?: string[];
  /** 长文正文的数据根相对指针（空／缺＝无正文；正文不落库） */
  narrative_ref?: string;
  angles?: KpAngle[];
  source_ref?: KpSourceRef | null;
  anchors?: KpAnchor[] | null;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

/** outline 行（目录节点）：课程总览与章树里带每节点知识点计数 */
export interface OutlineRow extends KnowledgePoint {
  node_kind: 'outline';
  point_count?: number;
}

/** GET /api/v1/learn/star-map：星图一次取全 */
export function getStarMap(domain?: string, opts?: ApiRequestOptions): Promise<StarMapResponse> {
  return api.get<StarMapResponse>('/learn/star-map', { ...opts, params: { domain } });
}

/** 学习序列里的一条知识点（投影行＝主表 point 行 + 归属/取材/落笔态） */
export interface PointUnit extends KnowledgePoint {
  node_kind: 'point';
  /** 派生键 `kp:{kp_id}`（门游标与进度游标同形） */
  unit_id: string;
  parent_id: string;
  chapter_kp_id: string;
  title: string;
  sort_order: number;
  source_ref: KpSourceRef | null;
  /** 这一条的正文范围来自哪里（point／anchor／chapter／空＝还没定位到） */
  window_source?: 'point' | 'anchor' | 'chapter' | '';
  /** 学习者落笔态；没落笔过＝null */
  learner?: KpLearnerRow | null;
}

/** 学习序列里的章行（outline 根节点 + 章级注解成品位） */
export interface PointChapter extends KnowledgePoint {
  node_kind: 'outline';
  unit_id: string;
  point_count: number;
  /** 章级注解成品位：进场随目录直读，缺失由右栏出「生成」入口 */
  key_points: string[];
}

/** 课程在工作台里的推进序列（未加入学习面＝enrolled false 且序列空） */
export interface CourseSequence {
  enrolled: boolean;
  units: PointUnit[];
  chapters: PointChapter[];
  kp_path: string[];
}

export interface CourseKnowledgeResponse {
  course: { course_id: string; name: string; track: string; domain_id: string; description: string };
  points: KnowledgePoint[];
  total: number;
  sequence: CourseSequence;
}

/** GET /api/v1/learn/courses/{course_id}/knowledge-points：知识点总览 + 学习序列 */
export function getCourseKnowledge(
  courseId: string,
  includeOutline = false,
  opts?: ApiRequestOptions,
): Promise<CourseKnowledgeResponse> {
  return api.get<CourseKnowledgeResponse>(`/learn/courses/${courseId}/knowledge-points`, {
    ...opts,
    params: { include_outline: includeOutline ? 'true' : undefined },
  });
}

/** 长文正文读腿响应：指针缺失/悬空都明示（available=false + 中文 reason），不静默回落空串 */
export interface NarrativeResponse {
  kp_id: string;
  narrative_ref: string;
  available: boolean;
  content: string;
  reason: string;
  bytes?: number;
  truncated?: boolean;
}

/** GET /api/v1/learn/knowledge-points/{kp_id}/narrative：按 `narrative_ref` 取长文正文 */
export function getPointNarrative(kpId: string, opts?: ApiRequestOptions): Promise<NarrativeResponse> {
  return api.get<NarrativeResponse>(`/learn/knowledge-points/${kpId}/narrative`, opts);
}

/** GET /api/v1/learn/courses/{id}/outline：章节树一次取全（前序平铺 + 每节点知识点计数） */
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

export interface OutlineResponse {
  course_id: string;
  book_ref: string;
  outline: OutlineRow[];
}

/** PUT /api/v1/learn/courses/{id}/outline：目录确认后整树幂等替换（页范围＝PDF 页序） */
export function putOutline(
  courseId: string,
  body: { book_ref: string; tree: unknown[] },
  opts?: ApiRequestOptions,
): Promise<OutlineResponse & { reused?: number }> {
  return api.put<OutlineResponse & { reused?: number }>(`/learn/courses/${courseId}/outline`, body, opts);
}

/* ---------- 注解按需生成（章＝写章行，条＝追加主表 angles） ---------- */

/** 注解用途：章＝章节总结／学习要点，条＝总结与注解（part 与目标层不匹配＝422） */
export type AnnotationPart = 'summary' | 'key_points' | 'annotation';

/** 按需生成一次的同步等待上限（一次一条，慢生成不透默认 8s） */
export const ANNOTATION_TIMEOUT_MS = 180000;

export interface AnnotationGenerateBody {
  course_id: string;
  target_kind: 'chapter' | 'point';
  kp_id: string;
  part: AnnotationPart;
}

export interface AnnotationGenerateResult {
  ok: boolean;
  target: { kind: string; kp_id: string; name: string };
  /** target_kind=chapter：写回章行后的成品位 */
  chapter?: { kp_id: string; summary: string; key_points: string[] };
  /** target_kind=point：追加 angles 后的主表整行 */
  point?: KnowledgePoint;
}

/**
 * POST /api/v1/learn/annotations/generate：按需生成注解。
 * 章级覆写章行 `summary`／`meta.chapter_key_points` 并服务端节流；条级追加主表 `angles` 一元素
 * （同角不堆叠，只更新 note），长文仍只由 `narrative_ref` 指。
 */
export function generateAnnotation(
  body: AnnotationGenerateBody,
  opts?: ApiRequestOptions,
): Promise<AnnotationGenerateResult> {
  return api.post<AnnotationGenerateResult>('/learn/annotations/generate', body, {
    timeoutMs: ANNOTATION_TIMEOUT_MS,
    ...opts,
  });
}

/* ---------- M2 练习与复习 ---------- */

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
  kp_id: string | null;
  kind: 'quiz' | 'flashcard';
  question_type: 'choice' | 'short' | 'open' | null;
  stem: string;
  options: Array<{ label: string; body: string }> | null;
  answer_back: string;
  difficulty: string;
  kp_type: KnowledgePointType | null;
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

/** 判分趋势（D9 C1 退列后仍按原字段名回传；只出现在响应，不在作答行上） */
export type ScoreTrend = 'new' | 'improved' | 'declined' | 'unchanged';

/** 作答行（`qe_attempt` 投影；趋势/调度态一律读时派生，不落列） */
export interface AttemptRow {
  attempt_id: number;
  question_id: string;
  course_id: string;
  kp_id: string | null;
  user_answer: string;
  is_correct: boolean;
  method: string;
  judge_note: string;
  resolved: boolean;
  bookmarked: boolean;
  origin: 'new' | 'review' | 'manual';
  review_date: string | null;
  answered_at: string;
  [key: string]: unknown;
}

/** 判分响应里的复习回写位（重放派生的下一到期） */
export interface ReviewWriteBack {
  target_kind: string;
  target_id: string;
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
  score_trend: ScoreTrend;
  resolved: boolean;
  answered_at: string;
  expected_answer: string | null;
  explanation: string | null;
  review: ReviewWriteBack;
}

/** 到期队列行（D3 重放派生，只有题粒度一种形态） */
export interface ReviewDueTask {
  target_kind: 'question';
  target_id: string;
  course_id: string;
  kp_id: string | null;
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
  score_trend: ScoreTrend;
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

/** PATCH /api/v1/learn/questions/{id}：人工面白名单 */
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

/** GET /api/v1/learn/review/due：到期复习队列（`qe_attempt` 流水重放派生） */
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

/** PATCH /api/v1/learn/attempts/{id}：错题本人工位（收藏 / 已解决，R6 纯人工） */
export function patchAttempt(
  attemptId: number,
  body: { bookmarked?: boolean; resolved?: boolean },
  opts?: ApiRequestOptions,
): Promise<AttemptRow> {
  return api.patch<AttemptRow>(`/learn/attempts/${attemptId}`, body, opts);
}

/* ---------- M1 学习面（qe_learning：course 行 + kp 行，单表继承） ---------- */

/** 派生课程态（`derived.status` 闭集；编译态随链路退役） */
export type LearnCourseStatus = 'draft' | 'learning' | 'completed';

/** 选课态（course 行 `status` 列闭集，与派生态两口径） */
export type LearnEnrollStatus = 'active' | 'paused' | 'done';

/** 知识点落笔态（kp 行 `status` 闭集） */
export type LearnerKpStatus = 'done' | 'skipped' | 'pending';

export interface CourseResource {
  kind: 'book' | 'af_version' | 'knowledge';
  ref_id: string;
  label: string;
  /** 书架清单的教材级忽略位（落 resources JSON 键，零 DDL；缺省＝未忽略） */
  dismissed?: boolean;
}

/** 教材级进度（`derived.books`）：计数单位行按取材 `source_ref.ref_id` 归集 */
export interface LearnBookProgress {
  ref_id: string;
  label: string;
  total: number;
  done: number;
  skipped?: number;
  percent: number;
}

/** 进度响应（`GET …/progress` 与 `derived` 的共同底座；游标＝门游标） */
export interface LearnProgress {
  total: number;
  done: number;
  skipped: number;
  percent: number;
  /** 门游标：第一个未掌握且未被显式让位的知识点行派生键 */
  current_unit_id: string | null;
  completed: boolean;
  mastered: number;
  /** 下一步建议（三态优先：到期复习 → 第一个未掌握 → 结课） */
  next_unit_id: string | null;
  provenance: { system: number; learner: number };
}

export interface LearnDerived extends LearnProgress {
  status: LearnCourseStatus;
  books: LearnBookProgress[];
}

/** 学习课程行＝qe_learning course 行 + 共享目录名称（R5 引用不复制：名称/领域/track 只来自 qed_course） */
export interface LearnCourse {
  /** ＝共享 `qed_course.course_id`（D4：不再有两套课程 ID） */
  learn_course_id: string;
  status: LearnEnrollStatus;
  name: string;
  domain_id: string;
  track: string;
  description: string;
  resources: CourseResource[];
  /** 学习者给定的推进顺序（空＝按默认序） */
  kp_path: string[];
  learner_note: string;
  created_at: string;
  updated_at: string;
  /** 序列里的知识点条数（＝门与游标的计数单位） */
  unit_count?: number;
  derived: LearnDerived;
}

/** kp 行投影（学习者对某条知识点的独立记录，跨课程共享，不随退课删除） */
export interface KpLearnerRow {
  kp_id: string;
  status: LearnerKpStatus;
  /** 质性门判定（未判定＝null） */
  qualitative_passed: boolean | null;
  qualitative_note: string;
  assessed_by: string;
  assessed_at: string | null;
  learner_note: string;
  updated_at: string;
  /** 撤销终态位且无质性痕迹时整行删除 */
  removed?: boolean;
}

export interface CreateLearnCourseBody {
  course_id: string;
  resources: CourseResource[];
  kp_path?: string[];
  learner_note?: string;
}

export type PatchLearnCourseBody = Partial<CreateLearnCourseBody> & { status?: LearnEnrollStatus };

/** GET /api/v1/learn/courses：学习课程列表（含派生进度） */
export function listLearnCourses(opts?: ApiRequestOptions): Promise<{ courses: LearnCourse[] }> {
  return api.get<{ courses: LearnCourse[] }>('/learn/courses', opts);
}

/** POST /api/v1/learn/courses：把一门共享课程加入学习面（已在学习面 409、素材为空 409） */
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

/** 同步回的教材展示元数据：简介/面向对象由 8902 书行 knowledge_id 联接 8901 教程套得出 */
export interface SyncBookMeta {
  ref_id: string;
  label: string;
  course_id: string;
  knowledge_id: string;
  intro: string;
  position: string;
  position_label: string;
  page_count: number;
}

export interface SyncLearnCoursesResult {
  synced: number;
  created: string[];
  updated: string[];
  courses: LearnCourse[];
  books: SyncBookMeta[];
}

/**
 * POST /api/v1/learn/courses/sync：解析好即同步（书架清单的「刷新」）。
 * 服务端只读物化 `af_books.active_job_id` 非空且课程归属可回查的书；未达者 PASS。
 * 解析侧（8902）不可达＝503，调用方降级为只读既有课程。
 */
export function syncLearnCourses(opts?: ApiRequestOptions): Promise<SyncLearnCoursesResult> {
  return api.post<SyncLearnCoursesResult>('/learn/courses/sync', {}, opts);
}

/** PATCH /api/v1/learn/courses/{id}：改选课态/备注/顺序或整列提交 resources（教材忽略位走此通道） */
export function patchLearnCourse(
  courseId: string,
  body: PatchLearnCourseBody,
  opts?: ApiRequestOptions,
): Promise<LearnCourse> {
  return api.patch<LearnCourse>(`/learn/courses/${courseId}`, body, opts);
}

/** DELETE /api/v1/learn/courses/{id}：退课只删 course 行，kp 行不随课程删除（D4） */
export function deleteLearnCourse(courseId: string, opts?: ApiRequestOptions): Promise<{ deleted: string }> {
  return api.del<{ deleted: string }>(`/learn/courses/${courseId}`, opts);
}

/** GET /api/v1/learn/courses/{id}/progress：派生进度 + 门态（只读，看板数据源） */
export function getLearnProgress(courseId: string, opts?: ApiRequestOptions): Promise<LearnProgress> {
  return api.get<LearnProgress>(`/learn/courses/${courseId}/progress`, opts);
}

/**
 * POST /api/v1/learn/courses/{id}/progress：勾选落笔（done/skipped/pending）。
 * `note` 走同一请求：kp 行不存在时备注不生效（整行被撤销删除时随行作废）。
 */
export function setLearnProgress(
  courseId: string,
  body: { kp_id: string; status: LearnerKpStatus; note?: string },
  opts?: ApiRequestOptions,
): Promise<KpLearnerRow & { derived: LearnProgress }> {
  return api.post(`/learn/courses/${courseId}/progress`, body, opts);
}

/** 逐知识点门态行（分数与结论一律读时派生） */
export interface MasteryItem {
  unit_id: string;
  kp_id: string;
  kp_type: string;
  gate: 'qualitative' | 'quantitative';
  mastery: number;
  threshold: number;
  attempt_count: number;
  /** 过门来源：system=判分算出来的，learner=自己勾的/质性自评过的，''=还没过 */
  provenance: '' | 'system' | 'learner';
  status: 'mastered' | 'learning' | 'new';
  qualitative_passed: boolean | null;
  due_reviews: number;
}

export interface MasteryNextStep {
  action: 'review' | 'probe' | 'assess' | 'practice' | 'complete';
  unit_id: string;
  kp_id: string;
  reason: string;
}

export interface CourseMasteryResponse {
  items: MasteryItem[];
  next_step: MasteryNextStep;
  summary: { total: number; mastered: number; learning: number; new: number };
}

/** GET /api/v1/learn/courses/{id}/mastery：逐知识点门态（主链 M-3） */
export function getCourseMastery(courseId: string, opts?: ApiRequestOptions): Promise<CourseMasteryResponse> {
  return api.get<CourseMasteryResponse>(`/learn/courses/${courseId}/mastery`, opts);
}

/** POST /api/v1/learn/courses/{id}/mastery/assess：质性门判定（量化型 409 拒绝） */
export function assessCourseMastery(
  courseId: string,
  body: { kp_id: string; passed: boolean; note?: string; by?: 'learner' },
  opts?: ApiRequestOptions,
): Promise<{ item: MasteryItem; kp_row: KpLearnerRow; next_step: MasteryNextStep }> {
  return api.post(`/learn/courses/${courseId}/mastery/assess`, body, opts);
}
