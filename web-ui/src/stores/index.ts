/**
 * Zustand stores 骨架（设计：frontend-react-refactor「stores」）
 * - 契约类型与 8900 后端响应形状对齐（service_manager.py / main.py / data.py）
 * - Phase 0 建模子与类型；Console/Dashboard/Downloads 各界面后续填充逻辑
 */

// --- 契约类型（8900 /api/v1） ---

export type ServiceName = 'config' | 'tracker' | 'axiom' | 'web';

export interface ServiceStatus {
  name: ServiceName;
  label: string;
  port: number;
  log_path: string;
  status: 'online' | 'offline' | 'starting' | 'stopping';
  pid: number | null;
  started_at: string | null;
  reason: string;
}

export interface ServicesResponse {
  services: ServiceStatus[];
}

export interface DatabaseStatus {
  reachable: boolean;
  reason: string;
  checked_at?: string;
}

/** LLM 联通探测（qwen/glm/deepseek） */
export interface LlmStatus {
  reachable: boolean;
  reason: string;
  checked_at: string | null;
}

export type LlmStatusResponse = Record<string, LlmStatus>;

// --- LLM 网关契约类型（8900 控制域，backend/qed_engine/api/control.py） ---

/** /monitor/gpu：GPU + 系统内存（sys_memory_*）+ 进程 kind 分类（REQ-038 饼图） */
export interface GpuProcess {
  pid: number;
  name: string;
  /** 每进程显存 MB；Windows WDDM 下 nvidia-smi 返回 [N/A] → null（清单保留，MB 未知） */
  memory_mb: number | null;
  /** 模型白名单关键词命中 → model；其余（浏览器/图形/陌生任务）→ other */
  kind: 'model' | 'other';
}

export interface GpuStatus {
  available: boolean;
  name?: string;
  memory_total_mb?: number;
  memory_used_mb?: number;
  utilization_percent?: number;
  processes?: GpuProcess[];
  sys_memory_total_mb?: number;
  sys_memory_used_mb?: number;
  sys_memory_percent?: number;
  reason?: string;
}

/** /llm/test/* 测试结果 */
export interface LlmTestResult {
  ok: boolean;
  detail?: string;
  call_id?: number | null;
}

/** GET /config/keys 响应：厂商 + 配置布尔 + 运行模式（2026-08-24 契约扩展，不含密钥值） */
export interface KeysStatus {
  provider: string;
  configured: boolean;
  /** 运行模式：api（云端厂商）/ local（本地 LM Studio / MinerU） */
  mode: 'api' | 'local';
}

/** /monitor/lmstudio：本地文字模型（LM Studio）探测结果 */
export interface LmStudioStatus {
  reachable: boolean;
  base_url?: string;
  models?: string[];
  reason?: string;
}

/** /monitor/mineru：本地图像模型（MinerU）探测结果 */
export interface MineruStatus {
  reachable: boolean;
  port?: number;
  reason?: string;
}

/** /llm/calls 单条记录 */
export interface LlmCallItem {
  id: number;
  service: string;
  mode: string;
  provider: string;
  model: string;
  endpoint: string;
  prompt_template?: string | null;
  prompt: string;
  response: string;
  duration_ms?: number | null;
  status: string;
  error?: string | null;
  created_at: string;
  task?: string | null;
  step?: string | null;
  review_status?: string;
  review_note?: string;
}

export interface CallsResponse {
  items: LlmCallItem[];
  total: number;
  page: number;
  size: number;
}

export interface LlmCallsQuery {
  service?: string;
  mode?: string;
  model?: string;
  status?: string;
  start?: string;
  end?: string;
  task?: string;
  step?: string;
  prompt_template?: string;
  review_status?: string;
  page?: number;
  size?: number;
}

// --- 五层契约类型（8900 数据域·QED-Tracker 适配，QED-031 知识层次模型） ---

/** 知识行（qt_knowledge /knowledge：一套教程或一组延展资料归类） */
export interface KnowledgeRecord {
  knowledge_id: string;
  domain_id: string;
  course_id: string;
  kind: string; // tutorial=一套教程 / other_material=课程延展资料归类
  set_no: string; // 套标记（1~4=中文套 / en=英文套 / ''=无配套）
  name: string; // 教程名/归类名（如 数学分析 套一）
  textbook_ref: Record<string, unknown> | null; // 教材决定引用 {title, version}
  exercise_ref: Record<string, unknown> | null; // 习题集决定引用 {title, version}
  textbook_intro: string; // 教材简介（指引检索）
  exercise_intro: string; // 习题集简介
  materials_intro: string; // 延展资料归类简介
  status: string; // draft / confirmed / completed（rejected/superseded 数据层彻底隐藏）
  reject_reason: string;
  supersede_reason: string;
  created_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
  [key: string]: unknown;
}

/** 书行（qt_books /books/{id}...：一册/一卷/一个快照，候选→决定→下载→验证全生命周期） */
export interface BookRecord {
  book_id: string;
  knowledge_id: string;
  kind: string; // textbook / exercise / supplement / paper / blog / other
  roles: string[]; // textbook / exercise / solutions / reference / supplement
  title: string; // 书名（不含卷）
  part: string; // 卷标识（'' / 第一册 / 上册）
  display_title: string; // 展示名 = title+part（可人工覆盖）
  file_name: string; // 落盘文件名
  authors: string[];
  language: string;
  version: Record<string, unknown>; // {edition, publisher, year, detail}
  source: Record<string, unknown> | null; // 候选来源/下载方案
  original_url: string;
  sha256: string | null;
  relative_path: string;
  absolute_path: string;
  page_count: number | null;
  status: string; // candidate / decided / downloading / downloaded / verified / failed（rejected/superseded 隐藏）
  reject_reason: string;
  supersede_reason: string;
  review_note: string; // 审理备注
  created_at: string;
  decided_at: string | null;
  downloaded_at: string | null;
  verified_at: string | null;
  [key: string]: unknown;
}

/** 渠道尝试（qt_sources /books/{id}/sources：一次尝试一条记录） */
export interface SourceRecord {
  source_id: string;
  book_id: string;
  channel: string; // manual / internet_archive / open_library / google_books / libgen_li
  provider_id: string;
  page_url: string;
  download_url: string;
  file_keywords: string;
  ok: boolean;
  note: string;
  attempted_at: string;
  [key: string]: unknown;
}

/** 知识行详情（GET /knowledge/{id}）：知识行 + 所辖书行列表 */
export type KnowledgeDetail = KnowledgeRecord & { books: BookRecord[] };

/** 课程目标（/catalogs/{catalog_id} → targets） */
export interface CatalogTarget {
  id: string;
  course_id: string;
  course_name: string;
  kind: string; // book / exercise / supplement
  title: string;
  authors: string[];
  language: string;
  edition: string;
  query: string;
  required: boolean;
  file_hint: string;
  note: string;
  roles: string[];
}

/** 课程目录（/catalogs/{catalog_id}） */
export interface Catalog {
  id: string;
  name: string;
  description: string;
  status: string;
  targets: CatalogTarget[];
}

/** 课程记录（QED-Tracker GET /courses 嵌套行；2026-08-24 起为文档下载管理左树真实数据源） */
export interface CourseRecord {
  course_id: string;
  name: string;
  aliases: string[];
  stage: string;
  prerequisites: string[];
  related_targets?: string[];
  note?: string;
}

/** 领域课程体系行（GET /courses：领域 + 嵌套课程；服务端已按 sort_order 排序） */
export interface DomainSystem {
  domain_id: string;
  name: string;
  description?: string;
  stages?: string[];
  courses: CourseRecord[];
}

// --- 探索契约类型（exploration-api 冻结契约 §1~§7，2026-08-23） ---

/** 探索发起方式：direct 直接开始 / text 粘贴参考文本 / doc 指定文本文档路径 */
export type ExploreLaunchMode = 'direct' | 'text' | 'doc';

/** 推荐套（Proposal，字段与 qt_knowledge textbook_ref/exercise_ref/intro 对齐） */
export interface ExploreProposal {
  proposal_id: string;
  set_name: string;
  textbook: {
    title: string;
    authors?: string[];
    version?: { edition?: string; publisher?: string; year?: number | null } | null;
    intro?: string;
  };
  exercise?: {
    title: string;
    version?: { edition?: string; publisher?: string; year?: number | null } | null;
    intro?: string;
  } | null;
  reason: string;
}

/** 课程层探索运行（GET /explore-runs/{run_id}） */
export interface ExploreRun {
  run_id: string;
  scope: 'course';
  course_id: string;
  status: 'running' | 'ready' | 'adopted' | 'discarded' | 'failed';
  params: { mode: ExploreLaunchMode; ref_text?: string; ref_doc_path?: string };
  proposals: ExploreProposal[];
  adopted_proposal_ids: string[];
  error: { code: string; message: string } | null;
  created_at: string;
  updated_at: string;
}

/** POST /courses/{id}/explore 响应 */
export interface ExploreLaunchResult {
  run_id: string;
  task_id: string;
  status: 'running';
  /** 幂等去重命中时 true（同对象已有 running 运行，返回既有 run） */
  deduplicated?: boolean;
}

/** POST /explore-runs/{id}/adopt 响应 */
export interface ExploreAdoptResult {
  adopted: { knowledge_id: string; set_name: string }[];
  remaining_slots: number;
  run: ExploreRun;
}

/** 探索历史摘要（GET /courses/{id}/explore-runs 行） */
export interface ExploreRunSummary {
  run_id: string;
  scope: 'course';
  course_id: string;
  status: ExploreRun['status'];
  created_at: string;
  updated_at: string;
  proposal_count: number;
  adopted_count: number;
}

/** 领域探索变更项（curriculum-runs proposals 行；字段名与后端 _explore_run_view 对齐） */
export interface CurriculumChange {
  change_id: string;
  action: 'create_domain' | 'create_course' | 'update_course' | 'delete_course';
  entity: 'domain' | 'course';
  target_id: string;
  payload: Record<string, unknown>;
  reason: string;
}

/** 新建领域探索运行（GET /curriculum-runs/{run_id}） */
export interface CurriculumRun {
  run_id: string;
  scope: 'curriculum';
  status: 'running' | 'ready' | 'applied' | 'partially_applied' | 'discarded' | 'failed';
  params: { domain_name: string; mode: ExploreLaunchMode; ref_text?: string; ref_doc_path?: string };
  /** 服务端键为 proposals（2026-08-24 修复：原误作 changes 致弹窗空列表） */
  proposals: CurriculumChange[];
  adopted_proposal_ids: string[];
  conflicts: { change_id: string; reason: string }[];
  /** 重探时已存在领域的 create_domain 跳过清单（REQ-059，apply 后随行记录） */
  skipped: { change_id: string; reason: string }[];
  error: { code: string; message: string } | null;
  created_at: string;
  updated_at: string;
}

// --- 服务控制 store（Console 填充） ---
// Phase 2：/services 轮询 + 启停操作 + 过渡态收敛

// --- 文档下载管理 store（Downloads 填充） ---
// Phase 4：左树（领域→课程→教程[知识行]）展开/折叠、树宽、筛选（领域/课程/状态）、选择联动

// --- 仪表盘 store（Dashboard 填充） ---
// Phase 3：五层聚合数据（/knowledge + /books 详情）+ 服务健康摘要

export {};