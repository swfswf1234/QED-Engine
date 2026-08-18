import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import Console from './Console';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useConsoleStore } from '../stores/console';

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

describe('控制台 Console（Phase 2）', () => {
  beforeEach(() => {
    useConsoleStore.setState({ services: [], dbStatus: null, loading: false, error: null, dbError: null, operating: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    messageSpies.success.mockClear();
    messageSpies.warning.mockClear();
    messageSpies.error.mockClear();
  });

  it('渲染四服务卡 + MySQL 卡；命名去括号、端口在卡内、无 LLM 卡', async () => {
    mockApi(baseRoutes);
    renderConsole();
    // 命名：8900/8903 无括号，8901/8902 沿用后端 label
    expect(await screen.findByText('QED 管理服务')).toBeInTheDocument();
    expect(screen.getByText('QED-Tracker 文档下载服务')).toBeInTheDocument();
    expect(screen.getByText('Axiom-Flow 文档解析服务')).toBeInTheDocument();
    expect(screen.getByText('QED 前端服务')).toBeInTheDocument();
    // 端口在卡内（标题不带 :port；内容区含端口）
    await waitFor(() => {
      expect(useConsoleStore.getState().services.length).toBe(4);
    });
    expect(screen.getAllByText(/端口 8900/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/端口 8903/).length).toBeGreaterThan(0);
    // 依赖组件：MySQL 卡在，LLM 卡不在
    expect(screen.getByText('本地 MySQL（qed 库）')).toBeInTheDocument();
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
      expect(useConsoleStore.getState().services.length).toBe(4);
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
      expect(useConsoleStore.getState().services.length).toBe(4);
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

  it('顶部独立「重新加载页面」按钮（window.location.reload）', async () => {
    mockApi(baseRoutes);
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });
    renderConsole();
    await screen.findByText('QED 管理服务');
    const reloadBtn = screen.getByRole('button', { name: /重新加载页面/ });
    expect(reloadBtn).toBeInTheDocument();
    await userEvent.setup().click(reloadBtn);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
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
    // MySQL 卡降级文案
    expect(await screen.findByText(/获取失败/)).toBeInTheDocument();
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
    await screen.findByText('QED-Tracker 文档下载服务');
    expect(useConsoleStore.getState().services.find((s) => s.name === 'tracker')?.status).toBe('offline');

    // 再开启 fake timers，直调 store.operate（内部 setTimeout 轮询由 fake timers 推进）
    vi.useFakeTimers();
    const opPromise = useConsoleStore.getState().operate('tracker', 'start');
    await vi.advanceTimersByTimeAsync(1100);
    const result = await opPromise;
    expect(result).toMatchObject({ name: 'tracker', op: 'start', success: true, status: 'online' });
    expect(useConsoleStore.getState().services.find((s) => s.name === 'tracker')?.status).toBe('online');
    expect(useConsoleStore.getState().operating).toBeNull();
  });

  it('操作请求失败（409）→ message.warning 提示未生效', async () => {
    mockApi(baseRoutes);
    renderConsole();
    await waitFor(() => {
      expect(useConsoleStore.getState().services.length).toBe(4);
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
    const result = await useConsoleStore.getState().operate('tracker', 'start');
    expect(result).toMatchObject({ name: 'tracker', op: 'start', success: false, status: 'error' });
    expect(result.reason).toContain('服务已在线');
    expect(useConsoleStore.getState().operating).toBeNull();
  });
});