import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import Console from './Console';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useRuntimeStore } from '../stores/runtime';

// ECharts 依赖 canvas，jsdom 不可用；以占位组件透出 option.series 供断言（同 Dashboard.test）
vi.mock('../components/EChart', () => ({
  default: ({ option }: { option: { series?: { data?: unknown[] }[] } }) => (
    <div data-testid="echart" data-series={JSON.stringify(option.series ?? [])} />
  ),
}));

/** App.useApp().message spy（message 提示断言用） */
const messageSpies = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  // Object.assign 保留 App 组件函数本身，仅覆盖 useApp（spread 会毁掉组件）
  return {
    ...actual,
    App: Object.assign(actual.App, { useApp: () => ({ message: messageSpies }) }),
  };
});

function mockApi(routes: Record<string, unknown>) {
  mockFetch.mockImplementation((url: string) => {
    const hit = Object.keys(routes).find((k) => url.includes(k));
    if (!hit) return Promise.reject(new TypeError(`no route: ${url}`));
    return Promise.resolve(
      new Response(JSON.stringify(routes[hit]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });
}

const servicesFixture = {
  services: [
    { name: 'config', label: 'QED 管理服务（配置中心）', port: 8900, log_path: 'logs/config.log', status: 'online', pid: null, started_at: null, reason: '' },
    { name: 'tracker', label: 'QED-Tracker 文档下载服务', port: 8901, log_path: 'logs/tracker.log', status: 'offline', pid: null, started_at: null, reason: '未启动' },
    { name: 'axiom', label: 'Axiom-Flow 文档解析服务', port: 8902, log_path: 'logs/axiom.log', status: 'online', pid: 100, started_at: '2026-08-16T10:00:00', reason: '' },
    { name: 'web', label: 'QED 前端服务', port: 8903, log_path: 'logs/web.log', status: 'online', pid: 200, started_at: '2026-08-16T10:00:00', reason: '' },
  ],
};

const dbFixture = { reachable: true, reason: '', checked_at: '2026-08-16T10:00:00' };

const baseRoutes = {
  '/services': servicesFixture,
  '/config/database': dbFixture,
};

function renderConsole() {
  return render(
    <MemoryRouter>
      <ConfigProvider theme={theme}>
        <AntApp>
          <Console />
        </AntApp>
      </ConfigProvider>
    </MemoryRouter>,
  );
}

/** 依赖组件卡定位：按标题 span 作用域查询（避免命中类型字段与标题同文的单元格） */
function getDepCard(title: string): HTMLElement {
  return screen.getByText(title, { selector: '.ant-card-head-title span' }).closest('.ant-card') as HTMLElement;
}

describe('控制台 Console（Phase 2）', () => {
  beforeEach(() => {
    useRuntimeStore.setState({
      services: [], dbStatus: null, loading: false, error: null, dbError: null,
      gpu: null, gpuError: null, qwen: null, qwenError: null, mineru: null, mineruError: null,
      keys: null, modelsConfig: null, testing: null, operating: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    messageSpies.success.mockClear();
    messageSpies.warning.mockClear();
    messageSpies.error.mockClear();
  });

  it('渲染四服务卡 + 基础设施/资源监控区（三区结构）；副标题、命名去括号', async () => {
    const routes = {
      ...baseRoutes,
      '/monitor/gpu': { available: false, reason: '未检测到显卡' },
      '/monitor/qwen': { reachable: false, reason: '未启动' },
      '/monitor/mineru': { reachable: false, reason: '未启动' },
    };
    mockApi(routes);
    renderConsole();
    // 副标题
    expect(screen.getByText('QED 服务管理 + 资源监控')).toBeInTheDocument();
    // 命名：8900/8903 无括号，8901/8902 沿用后端 label
    expect(await screen.findByText('QED 管理服务')).toBeInTheDocument();
    expect(screen.getByText('QED-Tracker 文档下载服务')).toBeInTheDocument();
    expect(screen.getByText('Axiom-Flow 文档解析服务')).toBeInTheDocument();
    expect(screen.getByText('QED 前端服务')).toBeInTheDocument();
    // 端口在卡内（标题不带 :port；内容区含端口）
    await waitFor(() => {
      expect(useRuntimeStore.getState().services.length).toBe(4);
    });
    expect(screen.getAllByText(/端口 8900/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/端口 8903/).length).toBeGreaterThan(0);
    // 三区节标题：服务管理 / 基础设施 / 资源监控
    expect(screen.getByText('服务管理')).toBeInTheDocument();
    expect(screen.getByText('基础设施')).toBeInTheDocument();
    expect(screen.getByText('资源监控')).toBeInTheDocument();
    expect(screen.queryByText('服务监控')).not.toBeInTheDocument();
    expect(screen.queryByText('本地模型')).not.toBeInTheDocument();
    // 基础设施区：元数据库卡；资源监控区：LLM/OCR 模型卡
    expect(getDepCard('元数据库')).toBeInTheDocument();
    expect(getDepCard('LLM 模型')).toBeInTheDocument();
    expect(getDepCard('OCR 模型')).toBeInTheDocument();
    // 状态与原因
    await waitFor(() => {
      expect(screen.getByText(/离线（未启动）/)).toBeInTheDocument();
    });
  });

  it('离线服务提供启动按钮；停止/重启需受控确认框（破坏性操作）', async () => {
    mockApi(baseRoutes);
    renderConsole();
    await waitFor(() => {
      expect(useRuntimeStore.getState().services.length).toBe(4);
    });
    // tracker 离线 → 启动按钮（8901 卡内）
    const trackerCard = screen.getByText('QED-Tracker 文档下载服务').closest('.ant-card')!;
    const startBtn = within(trackerCard as HTMLElement).getByRole('button', { name: /启动/ });
    expect(startBtn).toBeInTheDocument();
    // axiom 在线 → 停止/重启按钮；点击停止触发受控确认框（非静态 Modal.confirm）
    const axiomCard = screen.getByText('Axiom-Flow 文档解析服务').closest('.ant-card')!;
    const stopBtns = within(axiomCard as HTMLElement).getAllByRole('button', { name: /停止/ });
    expect(stopBtns.length).toBeGreaterThan(0);
    await userEvent.setup().click(stopBtns[0]);
    expect(await screen.findByText(/确认停止「Axiom-Flow 文档解析服务」/)).toBeInTheDocument();
    // 取消 → 确认框关闭，不触发操作（antd 5.29 两字按钮自动加空格：取 消）
    // 注：Modal 关闭动画在 jsdom 中不结束（rc-motion 依赖 transitionend），
    // 故以「无操作请求发出」验证取消语义，而非等待弹窗从 DOM 消失。
    const callsBeforeCancel = mockFetch.mock.calls.length;
    await userEvent.setup().click(screen.getByRole('button', { name: /取\s*消/ }));
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch.mock.calls.length).toBe(callsBeforeCancel);
  });

  it('确认框「确认停止」→ 调用 operate；8900 重启经 /self-restart（确认后调 API）；8903 在线仅重启、无停止', async () => {
    const routes = {
      '/services': servicesFixture,
      '/config/database': dbFixture,
      '/self-restart': { status: 'restarting' },
      '/services/axiom/stop': { name: 'axiom', status: 'stopping', pid: null },
    };
    mockApi(routes);
    // 成功分支会延迟 3s 自动刷新，stub reload 防止 jsdom 抛"导航未实现"
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });
    renderConsole();
    await waitFor(() => {
      expect(useRuntimeStore.getState().services.length).toBe(4);
    });
    // —— 场景 A：axiom 在线 → 停止 → 确认框 → 确认 → POST /services/axiom/stop ——
    const axiomCard = screen.getByText('Axiom-Flow 文档解析服务').closest('.ant-card')!;
    const callsBefore = mockFetch.mock.calls.length;
    const stopBtns = within(axiomCard as HTMLElement).getAllByRole('button', { name: /停止/ });
    await userEvent.setup().click(stopBtns[0]);
    await userEvent.setup().click(screen.getByRole('button', { name: '确认停止' }));
    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBe(callsBefore + 1);
    });
    expect(String(mockFetch.mock.calls[callsBefore][0])).toContain('/services/axiom/stop');
    // —— 场景 B：8900 卡只有重启按钮；无启动/停止 ——
    const configCard = screen.getByText('QED 管理服务').closest('.ant-card')!;
    const configButtons = within(configCard as HTMLElement).getAllByRole('button');
    expect(configButtons.map((b) => b.textContent).join(',')).toContain('重启');
    expect(configButtons.map((b) => b.textContent).join(',')).not.toMatch(/启动|停止/);
    // 点击重启 → 确认框 → 确认后调 POST /self-restart
    const callsBeforeRestart = mockFetch.mock.calls.length;
    await userEvent.setup().click(configButtons[configButtons.length - 1]);
    expect(await screen.findByText(/确认重启「QED 管理服务」/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: '确认重启' }));
    await waitFor(() => {
      expect(messageSpies.success).toHaveBeenCalledWith(expect.stringContaining('8900 重启中'));
    });
    expect(mockFetch.mock.calls.length).toBe(callsBeforeRestart + 1);
    expect(String(mockFetch.mock.calls[callsBeforeRestart][0])).toContain('/self-restart');
    // —— 场景 C：8903 web 在线 → 卡内有重启按钮，无停止按钮 ——
    const webCard = screen.getByText('QED 前端服务').closest('.ant-card')!;
    const webButtons = within(webCard as HTMLElement).getAllByRole('button');
    expect(webButtons.map((b) => b.textContent).join(',')).toContain('重启');
    expect(webButtons.map((b) => b.textContent).join(',')).not.toMatch(/停止/);
  });

  it('8903 web 离线 → 仅重启（2026-09-06 用户裁决：web 无启动，前端不可达时启动无意义）', async () => {
    const webOffline = {
      services: [
        servicesFixture.services[0],
        servicesFixture.services[1],
        servicesFixture.services[2],
        { ...servicesFixture.services[3], status: 'offline', reason: '未启动' },
      ],
    };
    mockApi({ '/services': webOffline, '/config/database': dbFixture });
    renderConsole();
    await waitFor(() => {
      expect(screen.getByText('QED 前端服务')).toBeInTheDocument();
    });
    const webCard = screen.getByText('QED 前端服务').closest('.ant-card')!;
    const texts = within(webCard as HTMLElement).getAllByRole('button').map((b) => b.textContent).join(',');
    // web 仅重启：无启动、无停止；离线态重启按钮仍在（重启即重新拉起）
    expect(texts).not.toMatch(/启动|停止/);
    expect(texts).toContain('重启');
  });

  it('无「重新加载页面」按钮（2026-08-24 裁决：与浏览器刷新等价，删除）；保留「刷新」', async () => {
    mockApi(baseRoutes);
    renderConsole();
    await screen.findByText('QED 管理服务');
    expect(screen.queryByRole('button', { name: /重新加载页面/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /刷新/ })).toBeInTheDocument();
  });

  it('8900 离线 → 错误横幅降级（不白屏）', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    renderConsole();
    expect(await screen.findByText('控制台数据获取失败')).toBeInTheDocument();
    expect(screen.getByText(/请确认 8900 管理服务已启动/)).toBeInTheDocument();
  });

  it('8900 在线但 database 失败 → 仅元数据库卡降级，服务卡正常展示', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/services')) {
        return Promise.resolve(
          new Response(JSON.stringify(servicesFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/config/database')) return Promise.reject(new TypeError('db probe failed'));
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    renderConsole();
    // 服务卡正常
    expect(await screen.findByText('QED 管理服务')).toBeInTheDocument();
    expect(screen.getByText('QED-Tracker 文档下载服务')).toBeInTheDocument();
    // 无整体错误横幅
    expect(screen.queryByText('控制台数据获取失败')).not.toBeInTheDocument();
    // 仅元数据库卡降级文案
    const dbCard = getDepCard('元数据库');
    expect(await within(dbCard).findByText('探测失败')).toBeInTheDocument();
  });

  it('刷新按钮触发重新拉取', async () => {
    mockApi(baseRoutes);
    renderConsole();
    await screen.findByText('QED 管理服务');
    const callsBefore = mockFetch.mock.calls.length;
    await userEvent.setup().click(screen.getByRole('button', { name: /刷新/ }));
    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('操作后轮询 /services 收敛过渡态（starting → online）→ message 成功提示', async () => {
    // 先以真实计时器渲染并等待数据就绪
    const startResp = { name: 'tracker', status: 'starting', pid: 12 };
    const servicesOffline = {
      services: servicesFixture.services.map((s) => (s.name === 'tracker' ? { ...s, status: 'offline', pid: null, reason: '未启动' } : s)),
    };
    const servicesOnline = {
      services: servicesFixture.services.map((s) => (s.name === 'tracker' ? { ...s, status: 'online', pid: 12 } : s)),
    };
    const ok = (data: unknown) =>
      Promise.resolve(new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    let servicesCalls = 0;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/services/tracker/start')) return ok(startResp);
      if (url.includes('/services')) {
        servicesCalls += 1;
        // 首次（fetchAll）返回 offline；后续轮询返回 online（已收敛）
        return ok(servicesCalls === 1 ? servicesOffline : servicesOnline);
      }
      if (url.includes('/config/database')) return ok(dbFixture);
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    renderConsole();
    // 直接等待目标状态（findByText 后立即读 store 存在跨拉取竞态窗口，曾致 flaky）
    await waitFor(() => {
      expect(useRuntimeStore.getState().services.find((s) => s.name === 'tracker')?.status).toBe('offline');
    });

    // 再开启 fake timers，直调 store.operate（内部 setTimeout 轮询由 fake timers 推进）
    vi.useFakeTimers();
    const opPromise = useRuntimeStore.getState().operate('tracker', 'start');
    await vi.advanceTimersByTimeAsync(1100);
    const result = await opPromise;
    expect(result).toMatchObject({ name: 'tracker', op: 'start', success: true, status: 'online' });
    expect(useRuntimeStore.getState().services.find((s) => s.name === 'tracker')?.status).toBe('online');
    expect(useRuntimeStore.getState().operating).toBeNull();
  });

  it('操作请求失败（409）→ message.warning 提示未生效', async () => {
    mockApi(baseRoutes);
    renderConsole();
    await waitFor(() => {
      expect(useRuntimeStore.getState().services.length).toBe(4);
    });
    // 请求失败：/services/tracker/start 返回 409
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/services/tracker/start')) {
        return Promise.resolve(
          new Response(JSON.stringify({ detail: '服务已在线（端口 8901 探测通过），不可重复启动' }), { status: 409, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/services')) return Promise.resolve(new Response(JSON.stringify(servicesFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      if (url.includes('/config/database')) return Promise.resolve(new Response(JSON.stringify(dbFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    const result = await useRuntimeStore.getState().operate('tracker', 'start');
    expect(result).toMatchObject({ name: 'tracker', op: 'start', success: false, status: 'error' });
    expect(result.reason).toContain('服务已在线');
    expect(useRuntimeStore.getState().operating).toBeNull();
  });

  it('三区结构（2026-09-06）：服务管理在前，资源监控（GPU 状态 + 模型卡）殿后', async () => {
    const routes = {
      '/services': servicesFixture,
      '/config/database': dbFixture,
      '/monitor/gpu': {
        available: true,
        name: 'RTX 4080',
        memory_total_mb: 16376,
        memory_used_mb: 4096,
        utilization_percent: 65,
        processes: [{ pid: 100, name: 'python.exe', memory_mb: 2048 }],
        sys_memory_total_mb: 32768,
        sys_memory_used_mb: 14745,
        sys_memory_percent: 45,
        reason: '',
      },
      '/monitor/qwen': { reachable: true, base_url: 'http://127.0.0.1:5001/v1', models: ['qwen7b'], reason: '' },
      '/monitor/mineru': { reachable: false, port: 8002, reason: 'mineru docker 容器未启动' },
    };
    mockApi(routes);
    renderConsole();
    // GPU 状态卡标题
    expect(await screen.findByText('GPU 状态')).toBeInTheDocument();
    expect(screen.queryByText(/资源总览/)).not.toBeInTheDocument();
    expect(screen.queryByText(/服务监控/)).not.toBeInTheDocument();
    // GB 格式
    expect(screen.getByText(/4\.0 GB \/ 16\.0 GB/)).toBeInTheDocument();
    expect(screen.getByText(/65%/)).toBeInTheDocument();
    // 顺序：服务管理在前，资源监控其后
    const svcCards = ['QED 管理服务', 'QED-Tracker 文档下载服务', 'Axiom-Flow 文档解析服务', 'QED 前端服务']
      .map((name) => screen.getByText(name).closest('.ant-card')!);
    const gpuCard = screen.getByText(/RTX 4080/).closest('.ant-card')!;
    svcCards.forEach((card) => {
      expect(card.compareDocumentPosition(gpuCard)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
    // 分节标题：服务管理 / 基础设施 / 资源监控 齐备
    expect(screen.getByText('服务管理')).toBeInTheDocument();
    expect(screen.getByText('基础设施')).toBeInTheDocument();
    expect(screen.getByText('资源监控')).toBeInTheDocument();
    expect(screen.queryByText('本地模型')).not.toBeInTheDocument();
  });

  it('GPU 全量内存占比饼图：模型占用/其他/空闲 三色切片', async () => {
    const gpuRoutes = {
      ...baseRoutes,
      '/monitor/qwen': { reachable: false, reason: '未启动' },
      '/monitor/mineru': { reachable: false, reason: '未启动' },
      '/monitor/gpu': {
        available: true,
        name: 'RTX 4080',
        memory_total_mb: 16376,
        memory_used_mb: 4096,
        utilization_percent: 30,
        processes: [
          { pid: 100, name: 'LM Studio', memory_mb: 3000, kind: 'model' },
          { pid: 200, name: 'chrome.exe', memory_mb: 500, kind: 'other' },
        ],
        sys_memory_total_mb: 32768,
        sys_memory_used_mb: 14745,
        sys_memory_percent: 45,
        reason: '',
      },
    };
    mockApi(gpuRoutes);
    renderConsole();
    // 饼图：模型占用(3000) + 其他(500) + 空闲(16376-3500=12876)
    const chart = await screen.findByTestId('echart');
    const series = JSON.parse(chart.getAttribute('data-series') ?? '[]');
    expect(series).toHaveLength(1);
    const sliceNames = (series[0].data as Array<{ name: string; value: number }>).map((d) => d.name);
    expect(sliceNames).toEqual(['模型占用', '其他', '空闲']);
    // 图例
    expect(screen.getByText('模型占用')).toBeInTheDocument();
    expect(screen.getByText('其他')).toBeInTheDocument();
    expect(screen.getByText('空闲')).toBeInTheDocument();
    // 无进程清单、无警告
    expect(screen.queryByText('模型进程')).not.toBeInTheDocument();
    expect(screen.queryByText('非模型任务')).not.toBeInTheDocument();
    expect(screen.queryByText(/已接近满载/)).not.toBeInTheDocument();
  });

  it('显存占用 ≥95%：无警告 Alert（已移除进程清单与警告功能）', async () => {
    const gpuRoutes = {
      ...baseRoutes,
      '/monitor/qwen': { reachable: false, reason: '未启动' },
      '/monitor/mineru': { reachable: false, reason: '未启动' },
      '/monitor/gpu': {
        available: true,
        name: 'RTX 4080',
        memory_total_mb: 10000,
        memory_used_mb: 9700,
        utilization_percent: 98,
        processes: [
          { pid: 100, name: 'llama-server.exe', memory_mb: 8000, kind: 'model' },
          { pid: 201, name: 'some_game.exe', memory_mb: 1200, kind: 'other' },
        ],
        sys_memory_total_mb: 32768,
        sys_memory_used_mb: 20000,
        sys_memory_percent: 61,
        reason: '',
      },
    };
    mockApi(gpuRoutes);
    renderConsole();
    await screen.findByTestId('echart');
    // 无警告 Alert（已移除）
    expect(screen.queryByText(/已接近满载/)).not.toBeInTheDocument();
    expect(screen.queryByText(/检测到非模型任务占用显存/)).not.toBeInTheDocument();
  });

  it('fetchGpu 独立刷新：仅重拉 /monitor/gpu 并更新 store（60s 定时器数据源）', async () => {
    let gpuCalls = 0;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/monitor/gpu')) {
        gpuCalls += 1;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              available: true, name: 'RTX 4080', memory_total_mb: 16376,
              memory_used_mb: gpuCalls === 1 ? 1000 : 9000, utilization_percent: 10,
              processes: [], sys_memory_total_mb: 32768, sys_memory_used_mb: 14745,
              sys_memory_percent: 45, reason: '',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    await useRuntimeStore.getState().fetchGpu();
    expect(useRuntimeStore.getState().gpu?.memory_used_mb).toBe(1000);
    await useRuntimeStore.getState().fetchGpu();
    expect(gpuCalls).toBe(2);
    expect(useRuntimeStore.getState().gpu?.memory_used_mb).toBe(9000);
    expect(useRuntimeStore.getState().gpuError).toBeNull();
  });

  it('WDDM 模式（每进程显存 [N/A]=null）：饼图退化为模型占用/空闲两片', async () => {
    const gpuRoutes = {
      ...baseRoutes,
      '/monitor/qwen': { reachable: true, base_url: 'http://127.0.0.1:5001/v1', models: ['qwen7b'], reason: '' },
      '/monitor/mineru': { reachable: false, reason: '未启动' },
      '/monitor/gpu': {
        available: true,
        name: 'NVIDIA GeForce RTX 4080',
        memory_total_mb: 16376,
        memory_used_mb: 4635,
        utilization_percent: 62,
        processes: [
          { pid: 28252, name: 'C:\\Program Files\\LM Studio\\LM Studio.exe', memory_mb: null, kind: 'model' },
          { pid: 12136, name: 'C:\\Program Files\\LM Studio\\LM Studio.exe', memory_mb: null, kind: 'model' },
          { pid: 20216, name: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', memory_mb: null, kind: 'other' },
          { pid: 20828, name: 'C:\\Windows\\explorer.exe', memory_mb: null, kind: 'other' },
        ],
        sys_memory_total_mb: 32452,
        sys_memory_used_mb: 20168,
        sys_memory_percent: 62,
        reason: '',
      },
    };
    mockApi(gpuRoutes);
    renderConsole();
    // 饼图退化为 模型占用/空闲 两片（无任何有效每进程 MB）
    const chart = await screen.findByTestId('echart');
    const series = JSON.parse(chart.getAttribute('data-series') ?? '[]');
    const slices = series[0].data as Array<{ name: string; value: number; itemStyle: { color: string } }>;
    expect(slices.map((d) => d.name)).toEqual(['模型占用', '空闲']);
    expect(slices[0].itemStyle.color).toBe('#5b8ff9');
    expect(slices[1].itemStyle.color).toBe('#52c41a');
    // 无进程清单
    expect(screen.queryByText('模型进程')).not.toBeInTheDocument();
    expect(screen.queryByText('非模型任务')).not.toBeInTheDocument();
  });

  it('基础设施（元数据库）+ 模型卡（LLM/OCR）结构化字段：来源/模型/可达/备注；测试动作点亮', async () => {
    const routes = {
      '/services': servicesFixture,
      '/config/database': dbFixture,
      '/monitor/gpu': { available: false, reason: '未检测到显卡' },
      '/monitor/qwen': { reachable: false, reason: '超时' },
      '/monitor/mineru': { reachable: false, reason: 'mineru docker 容器未启动' },
      '/database/test': { reachable: true, reason: '' },
      '/llm/test/text': { ok: true, detail: '模型响应正常' },
      '/llm/test/vision': { ok: true, detail: '识别成功' },
    };
    mockApi(routes);
    renderConsole();
    // 三卡齐备
    expect(await getDepCard('元数据库')).toBeInTheDocument();
    const dbCard = getDepCard('元数据库');
    const textCard = getDepCard('LLM 模型');
    const visionCard = getDepCard('OCR 模型');
    // 等三路探测数据落库
    await waitFor(() => {
      const s = useRuntimeStore.getState();
      expect(s.dbStatus).not.toBeNull();
      expect(s.qwen).not.toBeNull();
      expect(s.mineru).not.toBeNull();
    });
    // 字段行·来源：三卡均「本地」
    expect(within(dbCard).getByText('本地')).toBeInTheDocument();
    expect(within(textCard).getByText('本地')).toBeInTheDocument();
    expect(within(visionCard).getByText('本地')).toBeInTheDocument();
    // 字段行·模型：LLM 显示探测到的模型名或「未加载」；OCR 显示 MinerU
    expect(within(textCard).getByText('未加载')).toBeInTheDocument();
    expect(within(visionCard).getByText('MinerU')).toBeInTheDocument();
    // 可达四态
    expect(within(dbCard).getByText('在线 · 未验证')).toBeInTheDocument();
    expect(within(textCard).getByText('离线')).toBeInTheDocument();
    expect(within(visionCard).getByText('离线')).toBeInTheDocument();
    // 备注
    expect(within(dbCard).getByText('—')).toBeInTheDocument();
    expect(within(textCard).getByText('超时')).toBeInTheDocument();
    expect(within(visionCard).getByText('mineru docker 容器未启动')).toBeInTheDocument();
    // 元数据库「测试」→ POST /database/test → 已验证在线
    const callsBefore = mockFetch.mock.calls.length;
    await userEvent.setup().click(within(dbCard as HTMLElement).getByRole('button', { name: /测\s*试/ }));
    expect(await within(dbCard as HTMLElement).findByText('已验证在线')).toBeInTheDocument();
    expect(within(dbCard as HTMLElement).getByText('连接正常')).toBeInTheDocument();
    expect(String(mockFetch.mock.calls[callsBefore][0])).toContain('/database/test');
    // LLM 模型「测试」→ POST /llm/test/text；探测离线 → 可达保持离线
    const callsBeforeText = mockFetch.mock.calls.length;
    await userEvent.setup().click(within(textCard as HTMLElement).getByRole('button', { name: /测\s*试/ }));
    expect(await within(textCard as HTMLElement).findByText(/^最近测试通过：模型响应正常$/)).toBeInTheDocument();
    expect(within(textCard as HTMLElement).getByText('离线')).toBeInTheDocument();
    expect(String(mockFetch.mock.calls[callsBeforeText][0])).toContain('/llm/test/text');
    // OCR 模型「测试」→ POST /llm/test/vision
    const callsBeforeVision = mockFetch.mock.calls.length;
    await userEvent.setup().click(within(visionCard as HTMLElement).getByRole('button', { name: /测\s*试/ }));
    expect(await within(visionCard as HTMLElement).findByText(/^最近测试通过：识别成功$/)).toBeInTheDocument();
    expect(within(visionCard as HTMLElement).getByText('离线')).toBeInTheDocument();
    expect(String(mockFetch.mock.calls[callsBeforeVision][0])).toContain('/llm/test/vision');
  });

  it('依赖卡可达四态·验证失败分支：测试失败 → 验证失败 + 备注为失败原因', async () => {
    const routes = {
      '/services': servicesFixture,
      '/config/database': dbFixture,
      '/monitor/qwen': { reachable: true, base_url: 'http://127.0.0.1:5001/v1', models: ['qwen7b'], reason: '' },
      '/monitor/mineru': { reachable: false, port: 8002, reason: '' },
      '/config/keys': { provider: 'qwen', configured: true, mode: 'local' },
      '/llm/test/text': { ok: false, detail: '鉴权失败' },
    };
    mockApi(routes);
    renderConsole();
    const textCard = getDepCard('LLM 模型');
    // 初始：可达但未验证，备注空 → —
    expect(await within(textCard as HTMLElement).findByText('在线 · 未验证')).toBeInTheDocument();
    expect(within(textCard as HTMLElement).getAllByText('—').length).toBeGreaterThanOrEqual(1);
    // 点击测试 → 失败分支：可达=验证失败（红），备注=detail
    await userEvent.setup().click(within(textCard as HTMLElement).getByRole('button', { name: /测\s*试/ }));
    expect(await within(textCard as HTMLElement).findByText('验证失败')).toBeInTheDocument();
    expect(within(textCard as HTMLElement).getByText('鉴权失败')).toBeInTheDocument();
  });

  it('api 模式：模型卡显示云端模型名（/config/models），不显示本地探测离线（模式感知，2026-08-24）', async () => {
    const routes = {
      '/services': servicesFixture,
      '/config/database': dbFixture,
      // Qwen / MinerU 均未启动——api 模式下不应把它们显示为模型卡的「离线」
      '/monitor/qwen': { reachable: false, reason: '未启动' },
      '/monitor/mineru': { reachable: false, reason: 'mineru docker 容器未启动' },
      '/config/keys': { provider: 'qwen', configured: true, mode: 'api' },
      '/config/models': {
        default: { model: 'qwen3.8-27b', provider: 'qwen', configured: true },
        ocr: { model: 'qwen-vl-plus', provider: 'qwen', configured: true },
        embedding: { model: 'text-embedding-v4', provider: 'qwen', configured: true },
      },
    };
    mockApi(routes);
    renderConsole();
    const textCard = getDepCard('LLM 模型');
    const visionCard = getDepCard('OCR 模型');
    // 模型名来自 /config/models
    expect(await within(textCard as HTMLElement).findByText('qwen3.8-27b')).toBeInTheDocument();
    expect(await within(visionCard as HTMLElement).findByText('qwen-vl-plus')).toBeInTheDocument();
    // 可达初始：云端 · 未验证（而非本地探测的「离线」）
    expect(within(textCard as HTMLElement).getByText('云端 · 未验证')).toBeInTheDocument();
    expect(within(visionCard as HTMLElement).getByText('云端 · 未验证')).toBeInTheDocument();
  });

  it('local 模式陈旧 outcome 守卫：探测转离线后，「已验证在线」不得残留', async () => {
    const routes = {
      '/services': servicesFixture,
      '/config/database': dbFixture,
      '/monitor/qwen': { reachable: true, base_url: 'http://127.0.0.1:5001/v1', models: ['qwen7b'], reason: '' },
      '/monitor/mineru': { reachable: false, reason: '未启动' },
      '/monitor/gpu': { available: false, reason: '未检测到显卡' },
      '/config/keys': { provider: 'qwen', configured: true, mode: 'local' },
      '/llm/test/text': { ok: true, detail: 'OK' },
    };
    mockApi(routes);
    renderConsole();
    const textCard = getDepCard('LLM 模型');
    // 测试通过 → 已验证在线
    await userEvent.setup().click(within(textCard as HTMLElement).getByRole('button', { name: /测\s*试/ }));
    expect(await within(textCard as HTMLElement).findByText('已验证在线')).toBeInTheDocument();
    // Qwen 转为离线（模拟服务停止后刷新）
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/monitor/qwen')) {
        return Promise.resolve(
          new Response(JSON.stringify({ reachable: false, reason: '未启动' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/config/keys')) {
        return Promise.resolve(
          new Response(JSON.stringify({ provider: 'qwen', configured: true, mode: 'local' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/services')) {
        return Promise.resolve(
          new Response(JSON.stringify(servicesFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/config/database')) {
        return Promise.resolve(
          new Response(JSON.stringify(dbFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/monitor/gpu')) {
        return Promise.resolve(
          new Response(JSON.stringify({ available: false, reason: '未检测到显卡' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/monitor/mineru')) {
        return Promise.resolve(
          new Response(JSON.stringify({ reachable: false, reason: '未启动' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    await useRuntimeStore.getState().fetchAll();
    // 可达回落为离线（probe 赢过陈旧 outcome）；备注保留最近测试结论
    expect(within(textCard as HTMLElement).getByText('离线')).toBeInTheDocument();
    expect(within(textCard as HTMLElement).getByText(/^最近测试通过：/)).toBeInTheDocument();
  });
});