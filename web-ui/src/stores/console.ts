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

/** 启停操作收敛结果（2026-08-17：操作成功/失败由收敛结果驱动，前端 message 提示） */
export interface OperateResult {
  name: string;
  op: ServiceOp;
  /** 是否成功（收敛到操作目标态） */
  success: boolean;
  /** 最终状态 / 失败状态（error=请求失败；timeout=收敛超时；busy=防重入被拒） */
  status: ServiceStatus['status'] | 'error' | 'timeout' | 'busy';
  /** 失败/超时原因（成功时为 undefined） */
  reason?: string;
}

/** 操作目标态判定：start→online、stop→offline、restart→online */
export function opTargetStatus(op: ServiceOp): 'online' | 'offline' {
  return op === 'stop' ? 'offline' : 'online';
}

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
  /** 启停操作：请求 + 轮询收敛，返回收敛结果（成功/失败/超时），由前端提示 */
  operate: (name: string, op: ServiceOp) => Promise<OperateResult>;
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

  operate: async (name, op): Promise<OperateResult> => {
    const { operating } = get();
    if (operating) {
      // 防重入：另一操作进行中，直接返回失败结果（不阻塞现有操作）
      return { name, op, success: false, status: 'busy', reason: '另一服务操作进行中，请稍后再试' };
    }
    set({ operating: name, error: null });
    try {
      await operateService(name, op);
    } catch (err) {
      set({ operating: null, loading: false });
      return {
        name,
        op,
        success: false,
        status: 'error',
        reason: err instanceof Error ? err.message : String(err),
      };
    }

    // 过渡态轮询收敛：starting/stopping → 最终态（上限 POLL_TIMEOUT_MS），
    // 收敛后按操作目标态判定成功/失败（2026-08-17 用户裁决：只提示收敛结果）
    return new Promise<OperateResult>((resolve) => {
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      const target = opTargetStatus(op);
      const poll = async () => {
        try {
          const services = await listServices();
          set({ services });
          const inTransition = services.some((s) => s.status === 'starting' || s.status === 'stopping');
          const svc = services.find((s) => s.name === name);
          if (!inTransition && svc && svc.status !== 'starting' && svc.status !== 'stopping') {
            const success = svc.status === target;
            set({ operating: null, loading: false });
            resolve({
              name,
              op,
              success,
              status: svc.status,
              reason: success ? undefined : (svc.reason || `最终状态 ${svc.status}`),
            });
            return;
          }
          if (Date.now() < deadline) {
            setTimeout(poll, POLL_INTERVAL_MS);
            return;
          }
          set({ operating: null, loading: false });
          resolve({
            name,
            op,
            success: false,
            status: 'timeout',
            reason: `收敛超时（${POLL_TIMEOUT_MS / 1000}s 内未稳定），请点「刷新」确认`,
          });
        } catch (err) {
          set({ operating: null, loading: false });
          resolve({
            name,
            op,
            success: false,
            status: 'error',
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      };
      setTimeout(poll, POLL_INTERVAL_MS);
    });
  },
}));