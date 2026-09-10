/**
 * 全局运行时 store（原「控制台 store」升格，2026-08-24 用户裁决：全局俯瞰数据层共享）
 * - 挂载策略：AdminLayout 进入管理台时拉取一次；Console 挂载时补拉保新鲜
 *   （fetchAll 带 loading 防重入，双挂载只发一轮请求）；zustand 模块级单例跨页存活
 * - 数据面：服务快照（/services）+ MySQL（/config/database）+ GPU（/monitor/gpu）+
 *   LM Studio（/monitor/lmstudio）+ MinerU（/monitor/mineru）+ 运行模式（/config/keys）
 *   六路独立拉取，互不拖累
 * - 独立超时：services 5s（本地脚本查询，秒回）；database 10s（后端 3s 探测 + 60s 缓存）；
 *   gpu/lmstudio/mineru 8s（后端探测 5s，放宽）
 * - 启停操作 + 过渡态轮询收敛（starting/stopping → online/offline）
 * - 测试动作：MySQL 即时探测 / 文字 / 图像（置 testing 标记 → 调端点 → outcome）
 * - 离线降级：8900 不可达 → 整体 error 横幅；database/gpu/lmstudio/mineru 失败 → 仅对应字段降级
 */
import { create } from 'zustand';
import {
  listServices, operateService, getDatabaseStatus, monitorGpu, monitorLmstudio, monitorMineru,
  fetchModelsConfig, type ServiceOp, type ModelsConfig,
} from '../api/services';
import {
  databaseTest, getKeys, llmTestText, llmTestVision, operateModel as operateModelApi,
} from '../api/llm';
import type {
  DatabaseStatus, GpuStatus, KeysStatus, LmStudioStatus, MineruStatus, ModelName, ModelOp, ServiceStatus,
} from './index';

/** 过渡态收敛轮询参数（对齐后端 TRANSITION_WINDOW=15s） */
export const POLL_INTERVAL_MS = 1000;
export const POLL_TIMEOUT_MS = 15000;

/** /services 为本地脚本查询，短超时即可（长超时会拖慢整页感知） */
export const SERVICES_TIMEOUT_MS = 5000;
/** /config/database 后端真实探测（connect_timeout 3s + 缓存 60s），放宽超时 */
export const DATABASE_TIMEOUT_MS = 10000;

/** /monitor/gpu 探测超时（GPU 工具查询可能较慢） */
export const GPU_TIMEOUT_MS = 8000;
/** GPU 显存构成自动刷新周期（REQ-038，2026-08-21 用户裁决：60s 一次足矣） */
export const GPU_REFRESH_INTERVAL_MS = 60_000;
/** /monitor/lmstudio、/monitor/mineru 探测超时（后端 5s 探测，放宽到 8s） */
export const LMSTUDIO_TIMEOUT_MS = 8000;
export const MINERU_TIMEOUT_MS = 8000;
/** 测试动作（MySQL 即时探测/文字/图像）超时（真实模型调用，放宽） */
export const TEST_TIMEOUT_MS = 15000;

/**
 * 8903 前端服务兜底（原 stores/webService.ts，2026-08-24 并入）。
 * 后端 /services 注册表已含 web 单元（8900 在线时以真实状态为准，经去重不重复渲染）；
 * 8900 离线时前端无法经 /services 获取，此本地判定兜底（页面能显示即在线）。
 */
const WEB_SERVICE: ServiceStatus = {
  name: 'web',
  label: 'QED 前端服务',
  port: 8903,
  log_path: '',
  status: 'online',
  pid: null,
  started_at: null,
  reason: '',
};

/** web 兜底合并 + 端口排序（纯函数）：
 *  - 缺 web → 追加兜底（8900 离线场景）
 *  - web=offline → 替换为兜底 online（页面能加载即在线，8900 探测不可信）
 *  - web 非 offline → 保留 8900 真实状态（online/starting/stopping）
 *  输出恒按端口升序 */
export function withWebServiceFallback(services: ServiceStatus[]): ServiceStatus[] {
  const webEntry = services.find((s) => s.name === 'web');
  let merged: ServiceStatus[];
  if (!webEntry) {
    merged = [...services, WEB_SERVICE];
  } else if (webEntry.status === 'offline') {
    // 页面能加载 → 8903 一定在线；8900 的 _probe_http 对 web 不可信，覆盖为 online
    merged = services.map((s) => (s.name === 'web' ? { ...WEB_SERVICE } : s));
  } else {
    merged = services;
  }
  return [...merged].sort((a, b) => a.port - b.port);
}

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

/** 测试动作结果（ok=false 时 detail 为失败原因/后端返回文案） */
export interface LlmTestOutcome {
  ok: boolean;
  detail: string;
}

/** 测试动作模板：置 testing 标记 → 调端点 → 归一化 outcome（失败 catch 为 {ok:false, detail}） */
async function runTest(
  set: (partial: Partial<RuntimeStore>) => void,
  kind: 'db' | 'text' | 'vision',
  call: () => Promise<{ ok: boolean; detail?: string }>,
): Promise<LlmTestOutcome> {
  set({ testing: kind });
  try {
    const res = await call();
    return { ok: res.ok, detail: res.detail ?? (res.ok ? '测试通过' : '测试失败') };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  } finally {
    set({ testing: null });
  }
}

export interface RuntimeStore {
  services: ServiceStatus[];
  dbStatus: DatabaseStatus | null;
  loading: boolean;
  /** 整体错误（8900 不可达时设置；单个服务离线不算错误） */
  error: string | null;
  /** MySQL 探测独立错误（不影响服务卡展示） */
  dbError: string | null;
  /** GPU + 系统内存总览（资源总览卡；探测失败仅置 gpuError） */
  gpu: GpuStatus | null;
  /** GPU 探测独立错误（不影响服务卡展示） */
  gpuError: string | null;
  /** LM Studio（本地文字模型）探测结果（依赖组件三卡；失败仅置 lmstudioError） */
  lmstudio: LmStudioStatus | null;
  /** LM Studio 探测独立错误 */
  lmstudioError: string | null;
  /** MinerU（本地图像模型）探测结果（依赖组件三卡；失败仅置 mineruError） */
  mineru: MineruStatus | null;
  /** MinerU 探测独立错误 */
  mineruError: string | null;
  /** 运行模式与厂商（/config/keys；依赖卡模式感知用，null=未加载按 local 语义兜底渲染） */
  keys: KeysStatus | null;
  /** 模型路由表（/config/models；云端模型名来源，null=未加载） */
  modelsConfig: ModelsConfig | null;
  /** 操作中（按钮 loading），值为服务名 */
  operating: string | null;
  /** 测试按钮执行中标记（db=MySQL 即时探测 / text=文字 / vision=图像） */
  testing: 'db' | 'text' | 'vision' | null;
  fetchAll: () => Promise<void>;
  /** 仅重拉 GPU（REQ-038 饼图 60s 自动刷新用；失败保留旧值，不影响其他五路数据） */
  fetchGpu: () => Promise<void>;
  /** 启停操作：请求 + 轮询收敛，返回收敛结果（成功/失败/超时），由前端提示 */
  operate: (name: string, op: ServiceOp) => Promise<OperateResult>;
  /** 本地模型启停/重启（Task 6）：POST /models/{name}/{op}，复用 operate 收敛语义 */
  operateModel: (name: ModelName, op: ModelOp) => Promise<OperateResult>;
  /** MySQL 即时连接测试（测试按钮） */
  testDatabase: () => Promise<LlmTestOutcome>;
  /** 文字模型测试（测试按钮） */
  testText: () => Promise<LlmTestOutcome>;
  /** 图像模型测试（测试按钮） */
  testVision: () => Promise<LlmTestOutcome>;
}

export const useRuntimeStore = create<RuntimeStore>((set, get) => ({
  services: [],
  dbStatus: null,
  loading: false,
  error: null,
  dbError: null,
  gpu: null,
  gpuError: null,
  lmstudio: null,
  lmstudioError: null,
  mineru: null,
  mineruError: null,
  keys: null,
  modelsConfig: null,
  operating: null,
  testing: null,

  fetchAll: async () => {
    // 防重入：拉取中或操作收敛轮询期间不再叠加重载
    // （AdminLayout 挂载拉取 + Console 挂载补拉场景下只发一轮）
    if (get().loading || get().operating) return;
    set({ loading: true });
    // 六路并行独立拉取：services 失败 → 整体横幅；database/gpu/lmstudio/mineru/keys 失败 → 仅对应字段降级
    const fetchOne = <T,>(call: () => Promise<T>): Promise<readonly [T | null, unknown | null]> =>
      call().then((v) => [v, null] as const).catch((err) => [null, err] as const);
    const [[services, servicesErr], [dbStatus, dbErr], [gpu, gpuErr], [lmstudio, lmstudioErr], [mineru, mineruErr], [keys], [modelsConfig]] =
      await Promise.all([
        fetchOne(() => listServices({ timeoutMs: SERVICES_TIMEOUT_MS })),
        fetchOne(() => getDatabaseStatus({ timeoutMs: DATABASE_TIMEOUT_MS })),
        fetchOne(() => monitorGpu({ timeoutMs: GPU_TIMEOUT_MS })),
        fetchOne(() => monitorLmstudio({ timeoutMs: LMSTUDIO_TIMEOUT_MS })),
        fetchOne(() => monitorMineru({ timeoutMs: MINERU_TIMEOUT_MS })),
        fetchOne(() => getKeys({ timeoutMs: SERVICES_TIMEOUT_MS })),
        fetchOne(() => fetchModelsConfig({ timeoutMs: SERVICES_TIMEOUT_MS })),
      ]);
    const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));
    set({
      services: services ?? get().services,
      dbStatus: dbStatus ?? get().dbStatus,
      gpu: gpu ?? get().gpu,
      lmstudio: lmstudio ?? get().lmstudio,
      mineru: mineru ?? get().mineru,
      keys: keys ?? get().keys,
      modelsConfig: modelsConfig ?? get().modelsConfig,
      error: servicesErr ? reason(servicesErr) : null,
      dbError: dbErr ? reason(dbErr) : null,
      gpuError: gpuErr ? reason(gpuErr) : null,
      lmstudioError: lmstudioErr ? reason(lmstudioErr) : null,
      mineruError: mineruErr ? reason(mineruErr) : null,
    });
    if (!get().operating) set({ loading: false });
  },

  fetchGpu: async () => {
    // 独立 GPU 拉取（60s 定时刷新）：失败仅置 gpuError，保留旧值（与 fetchAll 单路降级语义一致）
    try {
      const gpu = await monitorGpu({ timeoutMs: GPU_TIMEOUT_MS });
      set({ gpu, gpuError: null });
    } catch (err) {
      set({ gpuError: err instanceof Error ? err.message : String(err) });
    }
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

  operateModel: async (name, op): Promise<OperateResult> => {
    const { operating } = get();
    if (operating) {
      return { name, op, success: false, status: 'busy', reason: '另一操作进行中，请稍后再试' };
    }
    set({ operating: name, error: null });
    try {
      await operateModelApi(name, op);
    } catch (err) {
      set({ operating: null, loading: false });
      return {
        name, op, success: false, status: 'error',
        reason: err instanceof Error ? err.message : String(err),
      };
    }
    // 模型收敛：start/restart 目标 = 模型探针可达（qwen→lmstudio / mineru reachable），stop = 不可达
    const targetReachable = op !== 'stop';
    const probe = async (): Promise<boolean> => (
      name === 'qwen' ? monitorLmstudio() : monitorMineru()
    ).then((s) => (s as { reachable: boolean }).reachable);
    return new Promise<OperateResult>((resolve) => {
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      const poll = async () => {
        try {
          let reachable: boolean;
          try {
            reachable = await probe();
          } catch {
            reachable = false;
          }
          if (reachable === targetReachable) {
            set({ operating: null, loading: false });
            resolve({ name, op, success: true, status: op === 'stop' ? 'offline' : 'online' });
            return;
          }
          if (Date.now() < deadline) {
            setTimeout(poll, POLL_INTERVAL_MS);
            return;
          }
          set({ operating: null, loading: false });
          resolve({
            name, op, success: false, status: 'timeout',
            reason: `收敛超时（${POLL_TIMEOUT_MS / 1000}s 内未稳定），请点「刷新」确认`,
          });
        } catch (err) {
          set({ operating: null, loading: false });
          resolve({
            name, op, success: false, status: 'error',
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      };
      setTimeout(poll, POLL_INTERVAL_MS);
    });
  },

  testDatabase: async () =>
    runTest(set, 'db', async () => {
      const res = await databaseTest({ timeoutMs: TEST_TIMEOUT_MS });
      // 空串 reason 视为缺失（成功时后端返回 reason:''）→ 回退默认文案
      return { ok: res.reachable, detail: res.reason || (res.reachable ? '连接正常' : '连接失败') };
    }),

  testText: async () =>
    runTest(set, 'text', async () => {
      const res = await llmTestText({ timeoutMs: TEST_TIMEOUT_MS });
      return { ok: res.ok, detail: res.detail };
    }),

  testVision: async () =>
    runTest(set, 'vision', async () => {
      const res = await llmTestVision({ timeoutMs: TEST_TIMEOUT_MS });
      return { ok: res.ok, detail: res.detail };
    }),
}));
