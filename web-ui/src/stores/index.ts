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
  /** 运行模式：api（云端厂商）/ local（本地 Qwen / MinerU） */
  mode: 'api' | 'local';
}

// --- 槽位契约类型（PLAN-046 模型统一注册：三槽位单管道，控制台三卡数据源） ---

/** 槽位名：text 文字 / vision 图像 / embedding 向量 */
export type SlotName = 'text' | 'vision' | 'embedding';

/** 可启停槽位（embedding 无本地 runtime，仅 api，无启停语义） */
export type ModelSlot = 'text' | 'vision';

/** 模型来源：本地部署 / API 调用 */
export type ModelSource = 'api' | 'local';

/** 槽位模型下拉选项（按来源 × 渠道过滤，带一句话备注） */
export interface SlotModelOption {
  value: string;
  label: string;
  description?: string;
}

/** 槽位渠道下拉选项（status：available 登记可用 / pending 待上线置灰） */
export interface SlotChannelOption {
  value: string;
  label: string;
  status: 'available' | 'pending';
}

/** 槽位来源下拉选项（status：available 可选 / pending 待上线置灰） */
export interface SlotSourceOption {
  value: ModelSource;
  label: string;
  status?: 'available' | 'pending';
}

/** 槽位运行态选择（POST /models/{slot}/select：source / runtime / model 至少一项） */
export interface SlotSelectPatch {
  source?: ModelSource;
  /** lmstudio | llamacpp | docker | default（default = 回退全局默认） */
  runtime?: string;
  model?: string;
}

/** GET /models/{slot}：槽位状态（来源/渠道/身份/备注/可用性 + 三个下拉，PLAN-046 v3 五字段卡） */
export interface SlotStatus {
  slot: SlotName;
  /** 生效来源：本地部署 / API 调用（manifest.source > 全局 QED_API_SELECT） */
  source: ModelSource;
  /** 生效渠道：api → 'direct'（直连）；local → runtime 名 */
  channel: string;
  /** local 时为 lmstudio / llamacpp / docker；api 时空 */
  runtime?: string;
  /** 当前身份（模型下拉选中值） */
  identity?: string;
  /** 生效模型标识（api=云端模型名；local=本地标识） */
  model?: string;
  /** api=厂商（qwen/deepseek/...）；local=runtime 名 */
  provider?: string;
  base_url?: string;
  /** 当前身份一句话备注（「备注」行） */
  description?: string;
  /** 可用判定：api=API_KEY 已配置；local=绑定模型探针就绪 */
  ready: boolean;
  /** 可用性文本：可用 / 不可用 / 未就绪 */
  availability?: string;
  /** 来源下拉数据源 */
  source_options?: SlotSourceOption[];
  /** 渠道下拉数据源（待上线置灰） */
  channel_options?: SlotChannelOption[];
  /** 模型下拉数据源（按来源 × 渠道过滤） */
  options?: SlotModelOption[];
  /** 解析备注（如回退告警） */
  notes?: string[];
  /** 解析错误（非空即解析失败，卡片标红） */
  error?: string;
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

/** 教程（qt_knowledge /knowledge：一套教程或一组延展资料归类） */
export interface KnowledgeRecord {
  knowledge_id: string;
  /** 8901 qt_knowledge 表无 domain_id，由前端通过课程归属反查 */
  domain_id?: string;
  course_id: string;
  kind: string; // tutorial=一套教程 / other_material=课程延展资料归类
  set_no: string; // 套标记（1~4=中文套 / en=英文套 / ''=无配套）
  name: string; // 教程名/归类名（如 数学分析 套一）
  textbook_ref: Record<string, unknown> | null; // 教材决定引用 {title, version}
  exercise_ref: Record<string, unknown> | null; // 习题集决定引用 {title, version}
  intro: string; // 套级简介（散文，120~350字）
  status: string; // draft / confirmed / completed（rejected/superseded 数据层彻底隐藏）
  reject_reason: string;
  supersede_reason: string;
  created_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
  [key: string]: unknown;
}

/** 书籍（qt_books 书库化重构 QED-050-D：域级书库，一册/一本书） */
export interface BookRecord {
  book_id: string;
  title: string;
  original_title: string | null;  // 外文原版书名（可空）
  part: string;                    // 卷标识（空串=单卷本；上册/下册；Vol.1/2/3）
  authors: Array<{ name: string; role: string }>; // [{name, role:"author|translator"}]
  publisher: string;
  edition: string;
  year: number | null;
  language: string;                // zh / en
  roles: string[];                 // textbook / exercises / solutions
  status: string;                  // decided / parallel / candidate / retired
  retire_reason: string;
  holding: string;                 // owned / missing
  file_path: string | null;
  priority: number | null;
  notes: string | null;
  domain_id: string;
  created_at: string;
  updated_at: string;
  /** 向后兼容旧字段（Downloads 页面暂用，后续迁移） */
  knowledge_id?: string;
  kind?: string;
  display_title?: string;
  file_name?: string;
  sha256?: string | null;
  relative_path?: string;
  absolute_path?: string;
  page_count?: number | null;
  source?: Record<string, unknown> | null;
  original_url?: string;
  reject_reason?: string;
  supersede_reason?: string;
  review_note?: string;
  decided_at?: string | null;
  downloaded_at?: string | null;
  verified_at?: string | null;
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

/** 教程详情（GET /knowledge/{id}）：教程 + 所辖书籍列表 */
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
  track?: string;
  description?: string;
  sort_order?: number;
  prerequisites: string[];
  related_targets?: string[];
  note?: string;
  /** 探索状态（PLAN-022 F4：未开始/已生成/探索中/已完成） */
  exploration_stage?: string;
  /** 课程下的教程列表（来自 GET /courses 嵌套数据） */
  knowledge?: Array<{ knowledge_id: string; name: string }>;
}

/** 领域课程体系行（GET /courses：领域 + 嵌套课程；服务端已按 sort_order 排序） */
export interface DomainSystem {
  domain_id: string;
  name: string;
  description?: string;
  stages?: string[];
  /** 探索状态（PLAN-022 F4：未开始/已生成/探索中/已完成/失败；QED-Tracker GET /courses 透出） */
  exploration_stage?: string;
  /** 探索中间状态（REQ-067 B7/B8 + PLAN-034：名称确认/审阅结果/导入挂起/失败，QED-Tracker 写入） */
  explore_pending?: {
    kind: 'name_confirm' | 'name_confirmation';
    name_check: { suggested_name: string; valid: boolean; reason: string };
  } | {
    kind: 'review_results';
    courses: Array<{
      course_id?: string;
      name: string;
      track: string;
      stage: string;
      summary: string;
    }>;
    domain_report: {
      description: string;
      stages: string[];
      classic_tracks: Array<{ name: string; summary: string; kind: string }>;
    };
  } | {
    kind: 'failed' | 'error';
    error: string;
  } | {
    kind: 'import_courses';
    courses: Array<{
      name: string;
      description: string;
      stage: string;
      track: string;
      sort_order: number;
      aliases: string[];
      prerequisites: string[];
    }>;
    name_changed: boolean;
    imported_name: string;
  } | null;
  /** 领域层级（探索产物，domain@v2） */
  level?: string;
  classic_tracks?: Array<{ name: string; summary?: string; kind?: string }>;
  path_results?: unknown;
  scope?: string;
  courses: CourseRecord[];
}

// --- 探索会话契约类型（PLAN-022 B3/F1，2026-08-28；旧 explore-runs 契约已废弃） ---

/** 探索发起方式：direct 直接开始 / text 粘贴参考文本 / doc 指定文本文档路径 */
export type ExploreLaunchMode = 'direct' | 'text' | 'doc';

/** 推荐套（Proposal，字段与 qt_knowledge textbook_ref/exercise_ref/intro 对齐；tutorials@v1 输出） */
export interface ExploreProposal {
  proposal_id: string;
  set_no?: string;
  set_name: string;
  textbook: {
    title: string;
    authors?: string[];
    version?: { edition?: string; publisher?: string; year?: number | null } | string | null;
    intro?: string;
  };
  exercise?: {
    title: string;
    version?: { edition?: string; publisher?: string; year?: number | null } | string | null;
    intro?: string;
  } | null;
  reason?: string;
}

/** 领域探索报告课程行（8901 DomainPipeline courses@v4 + path@v4 合并输出） */
export interface DomainExploreCourse {
  slug: string;
  name: string;
  aliases?: string[];
  track?: string;
  summary?: string;
  tier?: number;
  prerequisites?: string[];
}

/** 领域探索报告（target=domain 的 session.report） */
export interface DomainExploreReport {
  domain: {
    final_name: string;
    description: string;
    level: string;
    classic_tracks: { name: string; description?: string }[];
    entry_requirements: unknown;
  };
  courses: DomainExploreCourse[];
  path: { notes: string; edges: { from: string; to: string }[]; graph_td: string };
}

/** 课程探索报告（target=course 的 session.report，CoursePipeline tutorials@v1） */
export interface CourseExploreReport {
  course: { course_id: string; name: string; [key: string]: unknown };
  tutorials: ExploreProposal[];
}

/** 名称校验结果（领域管线 P12，waiting_name_confirm 时随会话返回） */
export interface ExploreNameCheck {
  valid: boolean;
  reason: string;
  suggested_name: string;
}

/** 探索会话（8900 /explore-sessions 会话模型，D3：内存态 + 后台线程 + 轮询） */
export interface ExploreSessionRecord {
  session_id: string;
  target: 'domain' | 'course';
  status: 'running' | 'waiting_name_confirm' | 'ready' | 'failed';
  domain_name: string;
  domain_id: string;
  course_id: string;
  mode: ExploreLaunchMode;
  report: DomainExploreReport | CourseExploreReport | null;
  name_check: ExploreNameCheck | null;
  error: string | null;
  /** 管线进度（step/template_id/duration_ms，ready 时透出） */
  steps: { step: string; template_id: string; duration_ms: number }[];
}

/** 探索会话 apply 响应（领域=applied 实体清单；课程=created 教程清单；conflicts 统一结构） */
export interface ExploreApplyResult {
  applied: { entity?: string; target_id?: string; name?: string; knowledge_id?: string; set_name?: string }[];
  conflicts: { name?: string; reason: string }[];
}

// --- 服务控制 store（Console 填充） ---
// Phase 2：/services 轮询 + 启停操作 + 过渡态收敛

// --- 文档下载管理 store（Downloads 填充） ---
// Phase 4：左树（领域→课程→教程[教程]）展开/折叠、树宽、筛选（领域/课程/状态）、选择联动

// --- 仪表盘 store（Dashboard 填充） ---
// Phase 3：五层聚合数据（/knowledge + /books 详情）+ 服务健康摘要

// --- 模型操作契约类型（Task 6，2026-09-06 /models/{name} 端点族；PLAN-046 槽位名泛化） ---

/** 本地模型操作：start / stop / restart */
export type ModelOp = 'start' | 'stop' | 'restart';

/** POST /models/{name}/{op} 响应（与 /services 的 ActionResponse 形状一致） */
export interface ModelActionResponse {
  name: string;
  status: string;
  pid?: number | null;
}

export {};