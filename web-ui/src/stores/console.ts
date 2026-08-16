/**
 * 控制台 store（Phase 2）
 * - 四服务快照（/services）+ MySQL（/config/database）两路独立拉取，互不拖累
 * - 独立超时：services 5s（本地脚本查询，秒回）；database 10s（后端 3s 探测 + 60s 缓存）
 * - 启停操作 + 过渡态轮询收敛（starting/stopping → online/offline）
 * - 离线降级：8900 不可达 → 整体 error 横幅；database 失败 → 仅 dbError 卡片降级
 */
import { create } from 'zustand';
import { listServices, operateService, getDatabaseStatus, type ServiceOp } from '../api/services';
import type { DatabaseStatus, ServiceStatus } from './index';

/** 过渡态收敛轮询参数（对齐后端 TRANSITION_WINDOW=15s） */
export const POLL_INTERVAL_MS = 1000;
export const POLL_TIMEOUT_MS = 15000;

/** /services 为本地脚本查询，短超时即可（长超时会拖慢整页感知） */
export const SERVICES_TIMEOUT_MS = 5000;
/** /config/database 后端真实探测（connect_timeout 3s + 缓存 60s），放宽超时 */
export const DATABASE_TIMEOUT_MS = 10000;

export interface ConsoleStore {
  services: ServiceStatus[];
  dbStatus: DatabaseStatus | null;
  loading: boolean;
  /** 整体错误（8900 不可达时设置；单个服务离线不算错误） */
  error: string | null;
  /** MySQL 探测独立错误（不影响服务卡展示） */
  dbError: string | null;
  /** 操作中（按钮 loading），值为服务名 */
  operating: string | null;
  fetchAll: () => Promise<void>;
  operate: (name: string, op: ServiceOp) => Promise<void>;
}

export const useConsoleStore = create<ConsoleStore>((set, get) => ({
  services: [],
  dbStatus: null,
  loading: false,
  error: null,
  dbError: null,
  operating: null,

  fetchAll: async () => {
    const { operating } = get();
    // 操作收敛轮询期间不再叠加重载
    if (operating) return;
    set({ loading: true });
    // 两路独立拉取：services 失败 → 整体横幅；database 失败 → 仅 MySQL 卡降级
    const [services, servicesErr] = await listServices({ timeoutMs: SERVICES_TIMEOUT_MS })
      .then((services) => [services, null] as const)
      .catch((err) => [null, err] as const);
    const [dbStatus, dbErr] = await getDatabaseStatus({ timeoutMs: DATABASE_TIMEOUT_MS })
      .then((dbStatus) => [dbStatus, null] as const)
      .catch((err) => [null, err] as const);
    set({
      services: services ?? get().services,
      dbStatus: dbStatus ?? get().dbStatus,
      error: servicesErr ? (servicesErr instanceof Error ? servicesErr.message : String(servicesErr)) : null,
      dbError: dbErr ? (dbErr instanceof Error ? dbErr.message : String(dbErr)) : null,
    });
    if (!get().operating) set({ loading: false });
  },

  operate: async (name, op) => {
    const { operating } = get();
    if (operating) return; // 防重入
    set({ operating: name, error: null });
    try {
      await operateService(name, op);
    } catch (err) {
      set({
        operating: null,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    // 过渡态轮询收敛：starting/stopping → 最终态（上限 POLL_TIMEOUT_MS）
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    const poll = async () => {
      try {
        const services = await listServices();
        set({ services });
        const inTransition = services.some((s) => s.status === 'starting' || s.status === 'stopping');
        if (inTransition && Date.now() < deadline) {
          setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          set({ operating: null, loading: false });
        }
      } catch (err) {
        set({
          operating: null,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };
    setTimeout(poll, POLL_INTERVAL_MS);
  },
}));