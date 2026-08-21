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

/** /monitor/gpu：GPU + 系统内存（sys_memory_*） */
export interface GpuStatus {
  available: boolean;
  name?: string;
  memory_total_mb?: number;
  memory_used_mb?: number;
  utilization_percent?: number;
  processes?: Array<{ pid: number; name: string; memory_mb: number }>;
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

// --- 服务控制 store（Console 填充） ---
// Phase 2：/services 轮询 + 启停操作 + 过渡态收敛

// --- 下载管理 store（Downloads 填充） ---
// Phase 4：左树（领域→课程→教程[知识行]）展开/折叠、树宽、筛选（领域/课程/状态）、选择联动

// --- 仪表盘 store（Dashboard 填充） ---
// Phase 3：五层聚合数据（/knowledge + /books 详情）+ 服务健康摘要

export {};