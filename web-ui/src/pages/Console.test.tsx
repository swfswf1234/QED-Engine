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
      gpu: null, gpuError: null, lmstudio: null, lmstudioError: null, mineru: null, mineruError: null,
      operating: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    messageSpies.success.mockClear();
    messageSpies.warning.mockClear();
    messageSpies.error.mockClear();
  });

  it('渲染四服务卡 + 依赖三卡（结构化字段）；副标题全局快照语义、命名去括号、无 LLM 卡', async () => {
    mockApi(baseRoutes);
    renderConsole();
    // 副标题（2026-08-24 用户裁决文案：区块顺序 资源总览→服务管理→组件管理）
    expect(screen.getByText('QED服务全局俯瞰：资源总览、服务管理、组件管理')).toBeInTheDocument();
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
    // 依赖组件三卡：标题简化（MySQL/文字模型/图像模型），LLM 卡不在
    expect(getDepCard('MySQL')).toBeInTheDocument();
    expect(getDepCard('文字模型')).toBeInTheDocument();
    expect(getDepCard('图像模型')).toBeInTheDocument();
    expect(screen.queryByText(/LLM/)).not.toBeInTheDocument();
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

  it('8903 web 离线 → 显示启动按钮', async () => {
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
    const startBtn = within(webCard as HTMLElement).getByRole('button', { name: /启动/ });
    expect(startBtn).toBeInTheDocument();
    // 离线状态无停止/重启按钮
    const texts = within(webCard as HTMLElement).getAllByRole('button').map((b) => b.textContent).join(',');
    expect(texts).not.toMatch(/停止|重启/);
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

  it('8900 在线但 database 失败 → 仅 MySQL 卡降级，服务卡正常展示', async () => {
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
    // 仅 MySQL 卡降级文案（gpu/lmstudio/mineru 各自降级，不影响该断言）
    const mysqlCard = getDepCard('MySQL');
    expect(await within(mysqlCard).findByText('探测失败')).toBeInTheDocument();
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

  it('资源总览卡在四服务卡之前渲染（2026-08-24 区块重排；显卡型号/显存/利用率/系统内存）', async () => {
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
      '/monitor/lmstudio': { reachable: true, base_url: 'http://127.0.0.1:5001/v1', models: ['qwen7b'], reason: '' },
      '/monitor/mineru': { reachable: false, port: 8002, reason: 'mineru docker 容器未启动' },
    };
    mockApi(routes);
    renderConsole();
    // 卡片标题：资源总览（精确匹配，避免命中含同词的副标题；旧名与刷新周期字样不再出现）
    expect(await screen.findByText('资源总览')).toBeInTheDocument();
    expect(screen.queryByText(/GPU 总览/)).not.toBeInTheDocument();
    expect(screen.queryByText(/显存构成/)).not.toBeInTheDocument();
    // 总览条内容：显卡型号 / 显存 used/total / 利用率 / 系统内存 / 模型进程
    expect(screen.getByText(/4096 \/ 16376/)).toBeInTheDocument();
    expect(screen.getByText(/65%/)).toBeInTheDocument();
    expect(screen.getByText(/45%/)).toBeInTheDocument();
    expect(screen.getByText(/模型进程/)).toBeInTheDocument();
    // 顺序（2026-08-24 用户裁决）：资源总览在最前，四服务卡在后
    const svcCards = ['QED 管理服务', 'QED-Tracker 文档下载服务', 'Axiom-Flow 文档解析服务', 'QED 前端服务']
      .map((name) => screen.getByText(name).closest('.ant-card')!);
    const gpuCard = screen.getByText(/RTX 4080/).closest('.ant-card')!;
    svcCards.forEach((card) => {
      expect(card.compareDocumentPosition(gpuCard)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
    });
    // 分节标题（2026-08-24 用户裁决）：「服务管理」隔开资源总览与四服务卡
    const svcSectionTitle = screen.getByText('服务管理');
    expect(gpuCard.compareDocumentPosition(svcSectionTitle)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    svcCards.forEach((card) => {
      expect(svcSectionTitle.compareDocumentPosition(card)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  it('GPU 显存构成饼图：进程切片 + 系统·图形占用片 + 非模型任务提示（REQ-038）', async () => {
    const gpuRoutes = {
      ...baseRoutes,
      '/monitor/lmstudio': { reachable: false, reason: '未启动' },
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
    // 饼图渲染：切片 = LM Studio(3000) + chrome.exe(500) + 系统·图形占用(16376-3500=12876)
    const chart = await screen.findByTestId('echart');
    const series = JSON.parse(chart.getAttribute('data-series') ?? '[]');
    expect(series).toHaveLength(1);
    const sliceNames = (series[0].data as Array<{ name: string; value: number }>).map((d) => d.name);
    expect(sliceNames).toEqual(['LM Studio', 'chrome.exe', '系统·图形占用']);
    // 非模型任务清单（逐行，2026-08-24 换行契约）：chrome.exe → 浏览器进程，占比 = 500/16376 ≈ 3%
    expect(await screen.findByText('非模型任务')).toBeInTheDocument();
    expect(screen.getByText(/浏览器进程 500 MB（3%）/)).toBeInTheDocument();
    // <95%：无警告 Alert
    expect(screen.queryByText(/已接近满载/)).not.toBeInTheDocument();
  });

  it('显存占用 ≥95% → 卡内常驻警告 Alert 并列出非模型任务；正常占比无 Alert', async () => {
    const gpuRoutes = {
      ...baseRoutes,
      '/monitor/lmstudio': { reachable: false, reason: '未启动' },
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
    // ≥95%（97%）→ 警告 Alert：占比 + 非模型任务清单（逐行；some_game.exe 非浏览器/系统 → 保留短名）
    expect(
      await screen.findByText(/显存占用 97%（9700 \/ 10000 MB），已接近满载/),
    ).toBeInTheDocument();
    expect(screen.getByText(/检测到非模型任务占用显存/)).toBeInTheDocument();
    expect(screen.getByText(/some_game\.exe 1200 MB（12%）/)).toBeInTheDocument();
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

  it('WDDM 模式（每进程显存 [N/A]=null）：饼图退化为已用/空闲两片，非模型清单仍可见', async () => {
    const gpuRoutes = {
      ...baseRoutes,
      '/monitor/lmstudio': { reachable: true, base_url: 'http://127.0.0.1:5001/v1', models: ['qwen7b'], reason: '' },
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
    // 饼图退化为 已用/空闲 两片（无任何有效每进程 MB）
    const chart = await screen.findByTestId('echart');
    const series = JSON.parse(chart.getAttribute('data-series') ?? '[]');
    const slices = series[0].data as Array<{ name: string; value: number; itemStyle: { color: string } }>;
    expect(slices.map((d) => d.name)).toEqual(['已用', '空闲']);
    // 颜色契约（2026-08-23 用户裁决）：已用=模型蓝、空闲=绿
    expect(slices[0].itemStyle.color).toBe('#5b8ff9');
    expect(slices[1].itemStyle.color).toBe('#52c41a');
    // 模型进程区在前：短名 + 同名 ×N 聚合；每进程独立一行（2026-08-24 换行契约）
    expect(await screen.findByText('模型进程')).toBeInTheDocument();
    expect(screen.getByText(/LM Studio\.exe ×2 占比未知/)).toBeInTheDocument();
    // 非模型任务区在后：友好分类（chrome→浏览器进程、explorer→Windows 进程）+ 占比未知
    expect(screen.getByText('非模型任务')).toBeInTheDocument();
    expect(screen.getByText(/浏览器进程 占比未知/)).toBeInTheDocument();
    expect(screen.getByText(/Windows 进程 占比未知/)).toBeInTheDocument();
    expect(screen.queryByText(/chrome\.exe/)).not.toBeInTheDocument();
    // 排序契约：模型进程区块在非模型任务区块之前（2026-08-23 用户裁决）
    const modelLabel = screen.getByText('模型进程');
    const otherLabel = screen.getByText('非模型任务');
    expect(otherLabel.compareDocumentPosition(modelLabel)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
    // <95%（28%）：无警告 Alert
    expect(screen.queryByText(/已接近满载/)).not.toBeInTheDocument();
  });

  it('依赖三卡结构化字段：来源/类型/可达四态/备注；测试动作点亮并更新备注', async () => {
    const routes = {
      '/services': servicesFixture,
      '/config/database': dbFixture,
      '/monitor/gpu': { available: false, reason: '未检测到显卡' },
      '/monitor/lmstudio': { reachable: false, reason: '超时' },
      '/monitor/mineru': { reachable: false, reason: 'mineru docker 容器未启动' },
      '/database/test': { reachable: true, reason: '' },
      '/llm/test/text': { ok: true, detail: '模型响应正常' },
      '/llm/test/vision': { ok: true, detail: '识别成功' },
    };
    mockApi(routes);
    renderConsole();
    // 三卡齐备
    expect(await getDepCard('MySQL')).toBeInTheDocument();
    const mysqlCard = getDepCard('MySQL');
    const textCard = getDepCard('文字模型');
    const visionCard = getDepCard('图像模型');
    // 等三路探测数据落库（避免可达/备注断言落在「探测中…」瞬态）
    await waitFor(() => {
      const s = useRuntimeStore.getState();
      expect(s.dbStatus).not.toBeNull();
      expect(s.lmstudio).not.toBeNull();
      expect(s.mineru).not.toBeNull();
    });
    // 字段行·来源：三卡均「本地」
    expect(within(mysqlCard).getByText('来源')).toBeInTheDocument();
    expect(within(mysqlCard).getByText('本地')).toBeInTheDocument();
    expect(within(textCard).getByText('本地')).toBeInTheDocument();
    expect(within(visionCard).getByText('本地')).toBeInTheDocument();
    // 字段行·类型：LM Studio / MinerU 唯一；MySQL 与标题同文 → 标题+类型共 2 处
    expect(within(textCard).getByText('LM Studio')).toBeInTheDocument();
    expect(within(visionCard).getByText('MinerU')).toBeInTheDocument();
    expect(within(mysqlCard).getAllByText('MySQL')).toHaveLength(2);
    // 可达四态（初始探测结果）：可达未验证=在线 · 未验证；不可达=离线
    expect(within(mysqlCard).getByText('在线 · 未验证')).toBeInTheDocument();
    expect(within(textCard).getByText('离线')).toBeInTheDocument();
    expect(within(visionCard).getByText('离线')).toBeInTheDocument();
    // 备注：探测 reason 透出，空 reason 显示 —
    expect(within(mysqlCard).getByText('—')).toBeInTheDocument();
    expect(within(textCard).getByText('超时')).toBeInTheDocument();
    expect(within(visionCard).getByText('mineru docker 容器未启动')).toBeInTheDocument();
    // MySQL 卡「测试」→ POST /database/test → 已验证在线 + 备注更新为响应 detail
    const callsBefore = mockFetch.mock.calls.length;
    await userEvent.setup().click(within(mysqlCard as HTMLElement).getByRole('button', { name: /测\s*试/ }));
    expect(await within(mysqlCard as HTMLElement).findByText('已验证在线')).toBeInTheDocument();
    expect(within(mysqlCard as HTMLElement).getByText('连接正常')).toBeInTheDocument();
    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(String(mockFetch.mock.calls[callsBefore][0])).toContain('/database/test');
    // 文字模型卡「测试」→ POST /llm/test/text；LM Studio 探测离线 → 可达保持离线
    // （探测优先，陈旧守卫），测试结论并入备注（2026-08-24 模式感知语义）
    const callsBeforeText = mockFetch.mock.calls.length;
    await userEvent.setup().click(within(textCard as HTMLElement).getByRole('button', { name: /测\s*试/ }));
    expect(await within(textCard as HTMLElement).findByText(/^最近测试通过：模型响应正常$/)).toBeInTheDocument();
    expect(within(textCard as HTMLElement).getByText('离线')).toBeInTheDocument();
    expect(String(mockFetch.mock.calls[callsBeforeText][0])).toContain('/llm/test/text');
    // 图像模型卡「测试」→ POST /llm/test/vision；MinerU 探测离线同理
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
      '/monitor/lmstudio': { reachable: true, base_url: 'http://127.0.0.1:5001/v1', models: ['qwen7b'], reason: '' },
      '/monitor/mineru': { reachable: false, port: 8002, reason: '' },
      '/config/keys': { provider: 'qwen', configured: true, mode: 'local' },
      '/llm/test/text': { ok: false, detail: '鉴权失败' },
    };
    mockApi(routes);
    renderConsole();
    const textCard = getDepCard('文字模型');
    // local 模式：类型行仍为 LM Studio
    expect(await within(textCard as HTMLElement).findByText('LM Studio')).toBeInTheDocument();
    // 初始：可达但未验证，备注空 → —
    expect(await within(textCard as HTMLElement).findByText('在线 · 未验证')).toBeInTheDocument();
    expect(within(textCard as HTMLElement).getByText('—')).toBeInTheDocument();
    // 点击测试 → 失败分支：可达=验证失败（红），备注=detail
    await userEvent.setup().click(within(textCard as HTMLElement).getByRole('button', { name: /测\s*试/ }));
    expect(await within(textCard as HTMLElement).findByText('验证失败')).toBeInTheDocument();
    expect(within(textCard as HTMLElement).getByText('鉴权失败')).toBeInTheDocument();
  });

  it('api 模式：文字/图像卡类型标注云端厂商，不显示本地探测离线（模式感知，2026-08-24）', async () => {
    const routes = {
      '/services': servicesFixture,
      '/config/database': dbFixture,
      // LM Studio / MinerU 均未启动——api 模式下不应把它们显示为模型卡的「离线」
      '/monitor/lmstudio': { reachable: false, reason: '未启动' },
      '/monitor/mineru': { reachable: false, reason: 'mineru docker 容器未启动' },
      '/config/keys': { provider: 'qwen', configured: true, mode: 'api' },
    };
    mockApi(routes);
    renderConsole();
    const textCard = getDepCard('文字模型');
    const visionCard = getDepCard('图像模型');
    // 类型行跟随运行模式：云端 · qwen（provider 来自 /config/keys）
    expect(await within(textCard as HTMLElement).findByText('云端 · qwen')).toBeInTheDocument();
    expect(await within(visionCard as HTMLElement).findByText('云端 · qwen')).toBeInTheDocument();
    // 可达初始：云端 · 未验证（而非本地探测的「离线」）
    expect(within(textCard as HTMLElement).getByText('云端 · 未验证')).toBeInTheDocument();
    expect(within(visionCard as HTMLElement).getByText('云端 · 未验证')).toBeInTheDocument();
  });

  it('local 模式陈旧 outcome 守卫：探测转离线后，「已验证在线」不得残留', async () => {
    const routes = {
      '/services': servicesFixture,
      '/config/database': dbFixture,
      '/monitor/lmstudio': { reachable: true, base_url: 'http://127.0.0.1:5001/v1', models: ['qwen7b'], reason: '' },
      '/monitor/mineru': { reachable: false, reason: '未启动' },
      '/monitor/gpu': { available: false, reason: '未检测到显卡' },
      '/config/keys': { provider: 'qwen', configured: true, mode: 'local' },
      '/llm/test/text': { ok: true, detail: 'OK' },
    };
    mockApi(routes);
    renderConsole();
    const textCard = getDepCard('文字模型');
    // 测试通过 → 已验证在线
    await userEvent.setup().click(within(textCard as HTMLElement).getByRole('button', { name: /测\s*试/ }));
    expect(await within(textCard as HTMLElement).findByText('已验证在线')).toBeInTheDocument();
    // LM Studio 转为离线（模拟服务停止后刷新）
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/monitor/lmstudio')) {
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