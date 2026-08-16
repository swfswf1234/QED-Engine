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

// --- 三表契约类型（8900 数据域·QED-Tracker 适配） ---

/** 表2 册级明细（/selections 内嵌 + /resources/{selection_id}/downloads） */
export interface DownloadRecord {
  download_id: string;
  selection_id: string;
  vol: string;
  roles: string[];
  file_hint: string;
  sha256: string | null;
  relative_path: string;
  page_count: number | null;
  status: string; // candidate / downloading / downloaded / approved / failed
  reject_reason: string;
  rejected_by: string;
  [key: string]: unknown;
}

export interface DownloadStats {
  total: number;
  downloaded: number;
  approved: number;
}

/** 表1 选课条目（/selections；8901 to_dict() + downloads + download_stats 透传） */
export interface SelectionRecord {
  selection_id: string;
  course_id: string;
  title: string;
  authors: string[];
  roles: string[]; // textbook / exercises / solutions / reference / supplement
  version: { language?: string; edition?: string; [key: string]: unknown };
  vols: string[];
  set_no: string; // "1"~"4" 中文套 / "en" 英文对照套 / "" 无配套
  evaluation: Record<string, unknown> | null;
  note: string;
  review_note: string;
  status: string; // candidate / confirmed / backup（rejected/superseded 数据层隐藏）
  reject_reason: string;
  supersede_reason: string;
  created_at: string;
  confirmed_at: string | null;
  download_stats: DownloadStats;
  downloads: DownloadRecord[];
  [key: string]: unknown;
}

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

// --- 目录浏览 store（Downloads 填充） ---
// Phase 4：左树（领域→课程→教程）展开/折叠、树宽、筛选（领域/课程/状态）、选择联动

// --- 仪表盘 store（Dashboard 填充） ---
// Phase 3：三表聚合数据（/selections、/downloads）+ 服务健康摘要

export {};