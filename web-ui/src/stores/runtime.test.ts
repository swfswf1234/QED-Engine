/**
 * runtime store 测试：全局运行时快照（服务 / GPU / 依赖探测）共享层
 * - withWebServiceFallback：web 兜底合并 + 端口排序
 *   （原 Console.tsx / Dashboard.tsx 各自重复实现，2026-08-24 收敛于此）
 * - fetchAll loading 防重入：AdminLayout 挂载拉取 + Console 挂载补拉去重
 * 操作收敛 / 测试动作等行为级覆盖在 Console.test.tsx（经界面驱动），此处不重复。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRuntimeStore, withWebServiceFallback, deriveRunningModels, formatRunningModels, formatRunningSlotLine } from './runtime';
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
      operating: null, testing: null, keys: null,
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

describe('deriveRunningModels / formatRunningModels（S3·S4 共用派生：本地在跑槽位身份）', () => {
  it('仅 source=local 且 ready 的槽位入选，顺序固定 文字→图像→向量', () => {
    const running = deriveRunningModels({
      text: slotSt({ slot: 'text', identity: 'qwen3.8-27b', channel: 'lmstudio' }),
      vision: slotSt({ slot: 'vision', source: 'api', channel: 'direct', model: 'glm-4v' }),
      embedding: slotSt({ slot: 'embedding', ready: false }),
    });
    expect(running).toEqual([{ slot: 'text', label: '文字', identity: 'qwen3.8-27b', channel: 'lmstudio' }]);
    expect(formatRunningModels(running)).toBe('文字·qwen3.8-27b（lmstudio）');
  });

  it('identity 缺失回落 model；channel 缺失省略括号；空列表返回空串', () => {
    const running = deriveRunningModels({
      text: null,
      vision: slotSt({ slot: 'vision', model: 'minicpm-v', identity: undefined, channel: '' }),
      embedding: null,
    });
    expect(formatRunningModels(running)).toBe('图像·minicpm-v');
    expect(formatRunningModels(deriveRunningModels({ text: null, vision: null, embedding: null }))).toBe('');
  });
});

describe('formatRunningSlotLine（当前在跑一行文案）', () => {
  it('有 local ready 槽位时列出身份名；全 api 就绪显示（API 模式）；无就绪槽位显示 无', () => {
    expect(formatRunningSlotLine({
      text: slotSt({ slot: 'text', identity: 'qwen3.8-27b' }), vision: null, embedding: null,
    })).toBe('文字·qwen3.8-27b（lmstudio）');
    expect(formatRunningSlotLine({
      text: slotSt({ slot: 'text', source: 'api', channel: 'direct', model: 'glm-4v' }),
      vision: null, embedding: null,
    })).toBe('（API 模式）');
    expect(formatRunningSlotLine({ text: null, vision: null, embedding: null })).toBe('无');
  });
});
