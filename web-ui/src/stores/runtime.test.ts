/**
 * runtime store 测试：全局运行时快照（服务 / GPU / 依赖探测）共享层
 * - withWebServiceFallback：web 兜底合并 + 端口排序
 *   （原 Console.tsx / Dashboard.tsx 各自重复实现，2026-08-24 收敛于此）
 * - fetchAll loading 防重入：AdminLayout 挂载拉取 + Console 挂载补拉去重
 * 操作收敛 / 测试动作等行为级覆盖在 Console.test.tsx（经界面驱动），此处不重复。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRuntimeStore, withWebServiceFallback } from './runtime';
import { mockFetch } from '../test/setup';
import type { ServiceStatus } from './index';

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
      gpu: null, gpuError: null, qwen: null, qwenError: null, mineru: null, mineruError: null,
      operating: null, testing: null, keys: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('默认状态：五路快照皆空、无错误', () => {
    const s = useRuntimeStore.getState();
    expect(s.services).toEqual([]);
    expect(s.dbStatus).toBeNull();
    expect(s.gpu).toBeNull();
    expect(s.qwen).toBeNull();
    expect(s.mineru).toBeNull();
    expect(s.error).toBeNull();
    expect(s.loading).toBe(false);
    // 运行模式未加载（依赖卡按 local 语义渲染兜底）
    expect(s.keys).toBeNull();
  });

  it('fetchAll 六路并行拉取（含 /config/keys）；loading 中重复调用防重入', async () => {
    let servicesCalls = 0;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/config/keys')) {
        return Promise.resolve(
          new Response(JSON.stringify({ provider: 'qwen', configured: true, mode: 'api' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
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
    // services 成功落库；keys 落库；其余四路各自降级为独立错误，不影响 services 数据
    expect(useRuntimeStore.getState().services).toHaveLength(1);
    expect(useRuntimeStore.getState().keys).toEqual({ provider: 'qwen', configured: true, mode: 'api' });
    expect(useRuntimeStore.getState().error).toBeNull();
    expect(useRuntimeStore.getState().gpuError).not.toBeNull();
  });
});
