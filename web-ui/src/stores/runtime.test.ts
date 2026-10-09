/**
 * runtime store 测试：全局运行时快照（服务 / GPU / 依赖探测）共享层
 * - withWebServiceFallback：web 兜底合并 + 端口排序
 *   （原 Console.tsx / Dashboard.tsx 各自重复实现，2026-08-24 收敛于此）
 * - fetchAll loading 防重入：AdminLayout 挂载拉取 + Console 挂载补拉去重
 * - 分路 pending（ARCH-038）：pendingRoutes 八路逐路落定逐路清 + ZONE_ROUTES 分区聚合
 * 操作互斥按单元（ARCH-041）：pendingOps 服务各单元一键（跨服务并发不受限）、模型槽位
 *   整域互斥、两域互不阻塞；busy 只在同单元复现
 * 操作收敛 / 测试动作等行为级覆盖在 Console.test.tsx（经界面驱动），此处不重复。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRuntimeStore, withWebServiceFallback, deriveRunningModels, isZonePending, ZONE_ROUTES, TEST_TIMEOUT_MS, MODEL_POLL_TIMEOUT_MS } from './runtime';
import { mockFetch } from '../test/setup';
import type { ServiceStatus, SlotStatus, SlotName } from './index';

function svc(name: string, port: number, status: string): ServiceStatus {
  return {
    name: name as ServiceStatus['name'],
    label: name,
    port,
    log_path: '',
    status: status as ServiceStatus['status'],
    pid: null,
    started_at: null,
    reason: '',
  };
}

describe('withWebServiceFallback（web 兜底 + 排序纯函数）', () => {
  it('缺 web 时追加兜底并按端口升序', () => {
    const merged = withWebServiceFallback([
      svc('config', 8900, 'online'),
      svc('tracker', 8901, 'offline'),
      svc('axiom', 8902, 'online'),
    ]);
    expect(merged.map((s) => s.port)).toEqual([8900, 8901, 8902, 8903]);
    expect(merged[3].name).toBe('web');
    expect(merged[3].label).toBe('QED 前端服务');
  });

  it('web 条目 offline 时替换为兜底 online（页面能加载即在线）', () => {
    const merged = withWebServiceFallback([svc('config', 8900, 'online'), svc('web', 8903, 'offline')]);
    expect(merged.filter((s) => s.name === 'web')).toHaveLength(1);
    expect(merged.find((s) => s.name === 'web')?.status).toBe('online');
  });

  it('web 条目非 offline 时保留真实状态', () => {
    const merged = withWebServiceFallback([svc('config', 8900, 'online'), svc('web', 8903, 'online')]);
    expect(merged.filter((s) => s.name === 'web')).toHaveLength(1);
    expect(merged.find((s) => s.name === 'web')?.status).toBe('online');
  });

  it('乱序输入按端口升序输出', () => {
    const merged = withWebServiceFallback([svc('axiom', 8902, 'online'), svc('config', 8900, 'online')]);
    expect(merged.map((s) => s.port)).toEqual([8900, 8902, 8903]);
  });
});

describe('useRuntimeStore', () => {
  beforeEach(() => {
    useRuntimeStore.setState({
      services: [], dbStatus: null, loading: false, error: null, dbError: null,
      gpu: null, gpuError: null,
      slots: { text: null, vision: null, embedding: null },
      slotErrors: { text: null, vision: null, embedding: null },
      pendingOps: [], testing: null, keys: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('默认状态：各路快照皆空、无错误', () => {
    const s = useRuntimeStore.getState();
    expect(s.services).toEqual([]);
    expect(s.dbStatus).toBeNull();
    expect(s.gpu).toBeNull();
    expect(s.slots).toEqual({ text: null, vision: null, embedding: null });
    expect(s.error).toBeNull();
    expect(s.loading).toBe(false);
    // 运行模式未加载（依赖卡按 local 语义渲染兜底）
    expect(s.keys).toBeNull();
  });

  it('fetchAll 七路并行拉取（含 /config/keys 与三槽位）；loading 中重复调用防重入', async () => {
    let servicesCalls = 0;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/config/keys')) {
        return Promise.resolve(
          new Response(JSON.stringify({ provider: 'qwen', configured: true, mode: 'api' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/models/text')) {
        return Promise.resolve(
          new Response(JSON.stringify({ slot: 'text', source: 'local', channel: 'lmstudio', runtime: 'lmstudio', identity: 'qwen3.8-27b', model: 'qwen3.8-27b', ready: false, options: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/services')) {
        servicesCalls += 1;
        return Promise.resolve(
          new Response(JSON.stringify({ services: [svc('config', 8900, 'online')] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    const p1 = useRuntimeStore.getState().fetchAll();
    void useRuntimeStore.getState().fetchAll(); // loading 中 → 直接跳过
    await p1;
    expect(servicesCalls).toBe(1);
    expect(useRuntimeStore.getState().loading).toBe(false);
    // services 成功落库；keys/text 槽位落库；其余路各自降级为独立错误，不影响 services 数据
    expect(useRuntimeStore.getState().services).toHaveLength(1);
    expect(useRuntimeStore.getState().keys).toEqual({ provider: 'qwen', configured: true, mode: 'api' });
    expect(useRuntimeStore.getState().slots.text?.channel).toBe('lmstudio');
    expect(useRuntimeStore.getState().slots.vision).toBeNull();
    expect(useRuntimeStore.getState().slotErrors.vision).not.toBeNull();
    expect(useRuntimeStore.getState().error).toBeNull();
    expect(useRuntimeStore.getState().gpuError).not.toBeNull();
  });

  it('REQ-033 性能：fetchAll 增量提交——快路回包即落库，不被最慢路（gpu ≈3s）拖累', async () => {
    let resolveGpu: ((r: Response) => void) | undefined;
    const gpuPending = new Promise<Response>((res) => { resolveGpu = res; });
    const json = (body: unknown) =>
      Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/monitor/gpu')) return gpuPending;
      if (url.includes('/services')) return json({ services: [svc('config', 8900, 'online')] });
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    const p = useRuntimeStore.getState().fetchAll();
    await new Promise((r) => setTimeout(r, 0)); // 快路 microtask 落定，gpu 仍在飞
    expect(useRuntimeStore.getState().services).toHaveLength(1); // 旧 Promise.all 语义下此处应为空
    expect(useRuntimeStore.getState().error).toBeNull();
    expect(useRuntimeStore.getState().gpu).toBeNull();
    expect(useRuntimeStore.getState().loading).toBe(true);
    resolveGpu!(new Response(JSON.stringify({ available: true, name: 'RTX 4080' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await p;
    expect(useRuntimeStore.getState().gpu?.name).toBe('RTX 4080');
    expect(useRuntimeStore.getState().loading).toBe(false);
  });
});

function slotSt(over: Partial<SlotStatus> & { slot: SlotName }): SlotStatus {
  return { source: 'local', channel: 'lmstudio', ready: true, ...over } as SlotStatus;
}

describe('deriveRunningModels（本地在跑槽位身份：显存占用行数据源）', () => {
  it('仅 source=local 且 ready 的槽位入选，顺序固定 文字→图像→向量', () => {
    const running = deriveRunningModels({
      text: slotSt({ slot: 'text', identity: 'qwen3.8-27b', channel: 'lmstudio' }),
      vision: slotSt({ slot: 'vision', source: 'api', channel: 'direct', model: 'glm-4v' }),
      embedding: slotSt({ slot: 'embedding', ready: false }),
    });
    expect(running).toEqual([{ slot: 'text', label: '文字', identity: 'qwen3.8-27b', channel: 'lmstudio' }]);
  });

  it('identity 缺失回落 model；channel 缺失即原样留空', () => {
    const running = deriveRunningModels({
      text: null,
      vision: slotSt({ slot: 'vision', model: 'minicpm-v', identity: undefined, channel: '' }),
      embedding: null,
    });
    expect(running).toEqual([{ slot: 'vision', label: '图像', identity: 'minicpm-v', channel: '' }]);
    expect(deriveRunningModels({ text: null, vision: null, embedding: null })).toEqual([]);
  });
});

describe('测试动作超时口径（DEFECT-008 ④）', () => {
  it('验证窗口覆盖「冷启动加载 + 请求层限长生成」最坏耗时，且短于启停收敛窗口', () => {
    // 512 token 上限实测解码约 40s，加 40960 档加载 7.3s → 窗口不得小于 45s
    expect(TEST_TIMEOUT_MS).toBeGreaterThanOrEqual(45_000);
    expect(TEST_TIMEOUT_MS).toBeLessThan(MODEL_POLL_TIMEOUT_MS);
  });
});

describe('分路 pending 与分区聚合（ARCH-038 分批刷新）', () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });

  beforeEach(() => {
    useRuntimeStore.setState({
      services: [], dbStatus: null, loading: false, pendingRoutes: [], error: null, dbError: null,
      gpu: null, gpuError: null,
      slots: { text: null, vision: null, embedding: null },
      slotErrors: { text: null, vision: null, embedding: null },
      pendingOps: [], testing: null, keys: null, modelsConfig: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('isZonePending 按分区归属聚合：gpu 在飞不拖累服务管理/基础设施区', () => {
    expect(isZonePending(['gpu', 'slot:vision'], 'services')).toBe(false);
    expect(isZonePending(['gpu', 'slot:vision'], 'infra')).toBe(false);
    expect(isZonePending(['gpu', 'slot:vision'], 'resources')).toBe(true);
    expect(isZonePending(['db'], 'infra')).toBe(true);
    expect(isZonePending(['services'], 'resources')).toBe(false);
    expect(isZonePending([], 'resources')).toBe(false);
    expect(ZONE_ROUTES.resources).toContain('models');
  });

  it('fetchAll：八路全置 pending，逐路落定只清自己那路，全落定后清空', async () => {
    let resolveVision: ((r: Response) => void) | undefined;
    const visionPending = new Promise<Response>((res) => { resolveVision = res; });
    mockFetch.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/models/vision')) return visionPending;
      if (u.includes('/services')) return json({ services: [svc('config', 8900, 'online')] });
      if (u.includes('/config/database')) return json({ reachable: true, reason: '', checked_at: '' });
      return Promise.reject(new TypeError(`no route: ${u}`));
    });
    const p = useRuntimeStore.getState().fetchAll();
    expect(useRuntimeStore.getState().pendingRoutes).toHaveLength(8);
    await new Promise((r) => setTimeout(r, 0));
    const after = useRuntimeStore.getState().pendingRoutes;
    expect(after).toContain('slot:vision'); // 慢路仍在飞
    expect(after).not.toContain('services'); // 快路自清
    expect(after).not.toContain('db');
    expect(useRuntimeStore.getState().loading).toBe(true); // 防重入旗标整批保持
    resolveVision!(json({ slot: 'vision', source: 'local', ready: false }));
    await p;
    expect(useRuntimeStore.getState().pendingRoutes).toEqual([]);
    expect(useRuntimeStore.getState().loading).toBe(false);
  });

  it('fetchGpu / fetchSlots 单独刷新只标自己那路（资源区转圈、服务区不转）', async () => {
    let resolveGpu: ((r: Response) => void) | undefined;
    const gpuPending = new Promise<Response>((res) => { resolveGpu = res; });
    mockFetch.mockImplementation(() => gpuPending);
    const p = useRuntimeStore.getState().fetchGpu();
    expect(useRuntimeStore.getState().pendingRoutes).toEqual(['gpu']);
    resolveGpu!(json({ available: true, name: 'RTX 4080', memory_total_mb: 16376 }));
    await p;
    expect(useRuntimeStore.getState().pendingRoutes).toEqual([]);
    let resolveSlot: ((r: Response) => void) | undefined;
    const slotPending = new Promise<Response>((res) => { resolveSlot = res; });
    mockFetch.mockImplementation(() => slotPending);
    const p2 = useRuntimeStore.getState().fetchSlots();
    expect(useRuntimeStore.getState().pendingRoutes.sort()).toEqual(
      ['slot:embedding', 'slot:text', 'slot:vision']);
    expect(isZonePending(useRuntimeStore.getState().pendingRoutes, 'services')).toBe(false);
    resolveSlot!(json({ slot: 'text', source: 'local', ready: false }));
    await p2;
    expect(useRuntimeStore.getState().pendingRoutes).toEqual([]);
  });
});

describe('操作互斥按单元（ARCH-041 四服务互不受限）', () => {
  const ok = (payload: unknown) => Promise.resolve(
    new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  );
  const servicesPayload = (axiomStatus: string) => ({
    services: [
      svc('config', 8900, 'online'),
      svc('tracker', 8901, 'online'),
      svc('axiom', 8902, axiomStatus),
      svc('web', 8903, 'online'),
    ],
  });

  beforeEach(() => {
    useRuntimeStore.setState({
      services: [], dbStatus: null, loading: false, error: null, dbError: null,
      gpu: null, gpuError: null, pendingRoutes: [],
      slots: { text: null, vision: null, embedding: null },
      slotErrors: { text: null, vision: null, embedding: null },
      pendingOps: [], testing: null, keys: null, modelsConfig: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('两服务并发操作：第二个照常派发，且一方未收敛不挡另一方收敛', async () => {
    vi.useFakeTimers();
    const posts: string[] = [];
    let polls = 0;
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === 'POST') { posts.push(u); return ok({ ok: true }); }
      if (u.includes('/services')) {
        polls += 1;
        // axiom 前两轮仍在 stopping（在飞），tracker 恒 online
        return ok(servicesPayload(polls >= 3 ? 'online' : 'stopping'));
      }
      return Promise.reject(new TypeError(`no route: ${u}`));
    });
    const pTracker = useRuntimeStore.getState().operate('tracker', 'start');
    const pAxiom = useRuntimeStore.getState().operate('axiom', 'restart');
    await vi.advanceTimersByTimeAsync(0);
    expect(posts).toHaveLength(2); // 两个 POST 都真发出去，第二条没被挡
    await vi.advanceTimersByTimeAsync(3200);
    expect(await pTracker).toMatchObject({ name: 'tracker', op: 'start', success: true, status: 'online' });
    expect(await pAxiom).toMatchObject({ name: 'axiom', op: 'restart', success: true, status: 'online' });
    expect(useRuntimeStore.getState().pendingOps).toEqual([]);
  });

  it('同一单元重复操作仍被挡（busy 语义保留），收敛超时后解锁', async () => {
    vi.useFakeTimers();
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === 'POST') return ok({ ok: true });
      if (u.includes('/services')) return ok(servicesPayload('stopping')); // 永不收敛
      return Promise.reject(new TypeError(`no route: ${u}`));
    });
    const p = useRuntimeStore.getState().operate('axiom', 'restart');
    await vi.advanceTimersByTimeAsync(0);
    expect(useRuntimeStore.getState().pendingOps).toEqual(['svc:axiom']);
    const second = await useRuntimeStore.getState().operate('axiom', 'start');
    expect(second).toMatchObject({ success: false, status: 'busy' });
    expect(second.reason).toContain('该服务上一次操作');
    await vi.advanceTimersByTimeAsync(16000);
    expect(await p).toMatchObject({ success: false, status: 'timeout' });
    expect(useRuntimeStore.getState().pendingOps).toEqual([]);
  });

  it('服务域与槽位域互不阻塞；槽位之间仍整域互斥', async () => {
    vi.useFakeTimers();
    const posts: string[] = [];
    let textPolls = 0;
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === 'POST') { posts.push(u); return ok({ ok: true }); }
      if (u.includes('/models/text')) {
        textPolls += 1;
        return ok({ slot: 'text', source: 'local', ready: textPolls >= 3 });
      }
      if (u.includes('/models/')) return ok({ slot: 'vision', source: 'local', ready: false });
      if (u.includes('/services')) return ok(servicesPayload('online'));
      return Promise.reject(new TypeError(`no route: ${u}`));
    });
    const pModel = useRuntimeStore.getState().operateModel('text', 'start');
    await vi.advanceTimersByTimeAsync(0);
    // 槽位在飞：另一服务的启停必须照常派发
    const pSvc = useRuntimeStore.getState().operate('tracker', 'restart');
    await vi.advanceTimersByTimeAsync(0);
    expect(posts.some((u) => u.includes('/services/tracker/restart'))).toBe(true);
    // 服务在飞期间槽位域内第二发被挡（单活仲裁不允许跨槽并发启停）
    const crossSlot = await useRuntimeStore.getState().operateModel('vision', 'start');
    expect(crossSlot).toMatchObject({ name: 'vision', success: false, status: 'busy' });
    expect(crossSlot.reason).toContain('模型');
    await vi.advanceTimersByTimeAsync(1200);
    expect(await pSvc).toMatchObject({ name: 'tracker', op: 'restart', success: true });
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pModel).toMatchObject({ name: 'text', op: 'start', success: true });
    expect(useRuntimeStore.getState().pendingOps).toEqual([]);
  });

  it('在飞操作期间 fetchAll 防重入仍生效，操作清空后恢复', async () => {
    vi.useFakeTimers();
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === 'POST') return ok({ ok: true });
      if (u.includes('/services')) return ok(servicesPayload('stopping'));
      return Promise.reject(new TypeError(`no route: ${u}`));
    });
    const p = useRuntimeStore.getState().operate('axiom', 'restart');
    await vi.advanceTimersByTimeAsync(0);
    await useRuntimeStore.getState().fetchAll();
    expect(useRuntimeStore.getState().pendingRoutes).toEqual([]); // 一条路都没标＝整批被挡
    await vi.advanceTimersByTimeAsync(16000);
    await p;
    expect(useRuntimeStore.getState().pendingOps).toEqual([]);
  });
});

describe('受限启动两段式（ARCH-040 先停对方再启本槽）', () => {
  const ok = (payload: unknown) => Promise.resolve(
    new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  );
  const tail = (u: string) => u.slice(u.indexOf('/models/'));

  beforeEach(() => {
    useRuntimeStore.setState({
      services: [], dbStatus: null, loading: false, error: null, dbError: null,
      gpu: null, gpuError: null, pendingRoutes: [],
      slots: { text: null, vision: null, embedding: null },
      slotErrors: { text: null, vision: null, embedding: null },
      pendingOps: [], testing: null, keys: null, modelsConfig: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('startLocalModel(text, vision)：前段只发停止，对方收敛后才发启动，结果取启动段', async () => {
    vi.useFakeTimers();
    const posts: string[] = [];
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === 'POST') { posts.push(tail(u)); return ok({ ok: true }); }
      if (u.includes('/models/text')) return ok({ slot: 'text', source: 'local', ready: true });
      if (u.includes('/models/vision')) return ok({ slot: 'vision', source: 'local', ready: false });
      if (u.includes('/models/embedding')) return ok({ slot: 'embedding', source: 'api', ready: true });
      return Promise.reject(new TypeError(`no route: ${u}`));
    });
    const p = useRuntimeStore.getState().startLocalModel('text', 'vision');
    await vi.advanceTimersByTimeAsync(0);
    expect(posts).toEqual(['/models/vision/stop']); // 对方未落定前不抢跑启动
    expect(useRuntimeStore.getState().pendingOps).toEqual(['model:vision']);

    await vi.advanceTimersByTimeAsync(1100); // 停止收敛 → 第二派发启动
    expect(posts).toEqual(['/models/vision/stop', '/models/text/start']);
    expect(useRuntimeStore.getState().pendingOps).toEqual(['model:text']);

    await vi.advanceTimersByTimeAsync(1100); // 启动收敛
    expect(await p).toMatchObject({ name: 'text', op: 'start', success: true, status: 'online' });
    expect(useRuntimeStore.getState().pendingOps).toEqual([]);
  });

  it('前段停止失败即止：一条启动请求都不发，失败原因原样透回', async () => {
    const posts: string[] = [];
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === 'POST') {
        posts.push(tail(u));
        if (u.includes('/models/vision/stop')) {
          return Promise.resolve(new Response(
            JSON.stringify({ detail: '对方模型正在卸载中，请稍候' }),
            { status: 409, headers: { 'Content-Type': 'application/json' },
          }));
        }
        return ok({ ok: true });
      }
      if (u.includes('/models/')) return ok({ slot: 'vision', source: 'local', ready: false });
      return Promise.reject(new TypeError(`no route: ${u}`));
    });
    const result = await useRuntimeStore.getState().startLocalModel('text', 'vision');
    expect(posts).toEqual(['/models/vision/stop']); // 无 /models/text/start
    expect(result).toMatchObject({ name: 'vision', op: 'stop', success: false, status: 'error' });
    expect(result.reason).toContain('对方模型正在卸载中');
    expect(useRuntimeStore.getState().pendingOps).toEqual([]);
  });
});
