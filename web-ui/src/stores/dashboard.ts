/**
 * 仪表盘 store（Phase 3）
 * - 三表聚合：/selections 一次拉取（表1 每项内嵌表2 downloads + download_stats）
 * - 服务健康摘要：/services（四服务，含 8903 本地判定）
 * - 独立降级：8901 不可达 → 文档下载状况卡离线提示；8900 不可达 → 整体横幅
 */
import { create } from 'zustand';
import { listServices } from '../api/services';
import { api } from '../api/client';
import type { SelectionRecord, ServiceStatus } from './index';

export const SELECTIONS_TIMEOUT_MS = 8000;

// --- 聚合纯函数（独立可测） ---

export const SELECTION_STATES = ['candidate', 'confirmed', 'backup'] as const;

export interface DistributionItem {
  status: string;
  count: number;
}

/** 表1 状态分布：候选/确认/备选（零值补齐，图表稳定；rejected/superseded 由数据层隐藏） */
export function buildSelectionDistribution(selections: SelectionRecord[]): DistributionItem[] {
  const counts = new Map<string, number>(SELECTION_STATES.map((s) => [s, 0]));
  for (const s of selections) {
    const key = counts.has(s.status) ? s.status : 'candidate';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return SELECTION_STATES.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

export interface DownloadSummary {
  total: number;
  downloaded: number;
  approved: number;
  remaining: number;
}

/** 表2 汇总：跨套聚合册级下载/验收进度（download_stats 由 8901 内嵌） */
export function buildDownloadSummary(selections: SelectionRecord[]): DownloadSummary {
  const total = selections.reduce((acc, s) => acc + (s.download_stats?.total ?? 0), 0);
  const downloaded = selections.reduce((acc, s) => acc + (s.download_stats?.downloaded ?? 0), 0);
  const approved = selections.reduce((acc, s) => acc + (s.download_stats?.approved ?? 0), 0);
  return { total, downloaded, approved, remaining: total - approved };
}

export interface CourseProgress {
  course_id: string;
  total: number;
  confirmed: number;
  /** 完成进度 = 非候选（已推进）占比，0-1 */
  progress: number;
}

/** 课程完成进度：按 course_id 分组；progress = 非候选（已推进）占比，0-1 */
export function buildCourseProgress(selections: SelectionRecord[]): CourseProgress[] {
  const groups = new Map<string, CourseProgress>();
  for (const s of selections) {
    const g = groups.get(s.course_id) ?? { course_id: s.course_id, total: 0, confirmed: 0, progress: 0 };
    g.total += 1;
    if (s.status !== 'candidate') g.confirmed += 1;
    groups.set(s.course_id, g);
  }
  for (const g of groups.values()) {
    g.progress = g.total === 0 ? 0 : g.confirmed / g.total;
  }
  return [...groups.values()];
}

// --- store ---

export interface DashboardStore {
  selections: SelectionRecord[];
  services: ServiceStatus[];
  loading: boolean;
  /** 整体错误（8900 不可达） */
  error: string | null;
  /** 三表数据独立错误（8901 不可达等） */
  dataError: string | null;
  fetchAll: () => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  selections: [],
  services: [],
  loading: false,
  error: null,
  dataError: null,

  fetchAll: async () => {
    if (get().loading) return;
    set({ loading: true });
    const [selections, dataErr] = await api
      .get<SelectionRecord[]>('/selections', { timeoutMs: SELECTIONS_TIMEOUT_MS })
      .then((selections) => [selections, null] as const)
      .catch((err) => [null, err] as const);
    const [services, servicesErr] = await listServices()
      .then((services) => [services, null] as const)
      .catch((err) => [null, err] as const);
    set({
      selections: selections ?? get().selections,
      services: services ?? get().services,
      dataError: dataErr ? (dataErr instanceof Error ? dataErr.message : String(dataErr)) : null,
      error: servicesErr ? (servicesErr instanceof Error ? servicesErr.message : String(servicesErr)) : null,
    });
    set({ loading: false });
  },
}));