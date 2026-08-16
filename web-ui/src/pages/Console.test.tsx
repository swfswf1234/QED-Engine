import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider, Modal } from 'antd';
import Console from './Console';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useConsoleStore } from '../stores/console';

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
        <Console />
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
      expect(useConsoleStore.getState().services.length).toBe(3);
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

  it('离线服务提供启动按钮；停止/重启需确认框（破坏性操作）', async () => {
    mockApi(baseRoutes);
    const confirmSpy = vi.spyOn(Modal, 'confirm').mockReturnValue({ destroy: vi.fn(), update: vi.fn() } as never);
    renderConsole();
    await waitFor(() => {
      expect(useConsoleStore.getState().services.length).toBe(3);
    });
    // tracker 离线 → 启动按钮（8901 卡内）
    const trackerCard = screen.getByText('QED-Tracker 文档下载服务').closest('.ant-card')!;
    const startBtn = within(trackerCard as HTMLElement).getByRole('button', { name: /启动/ });
    expect(startBtn).toBeInTheDocument();
    // axiom 在线 → 停止/重启按钮；点击停止触发确认框
    const axiomCard = screen.getByText('Axiom-Flow 文档解析服务').closest('.ant-card')!;
    const stopBtns = within(axiomCard as HTMLElement).getAllByRole('button', { name: /停止/ });
    expect(stopBtns.length).toBeGreaterThan(0);
    await userEvent.setup().click(stopBtns[0]);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0].title).toContain('确认停止');
  });

  it('8900/8903 只有重启：8900 点击提示后置不调 API；8903 无卡内按钮', async () => {
    mockApi(baseRoutes);
    const warningSpy = vi.spyOn(Modal, 'warning').mockImplementation(() => undefined as never);
    renderConsole();
    await waitFor(() => {
      expect(useConsoleStore.getState().services.length).toBe(3);
    });
    const callsBefore = mockFetch.mock.calls.length;
    // 8900 卡：重启按钮存在；无启动/停止按钮
    const configCard = screen.getByText('QED 管理服务').closest('.ant-card')!;
    const configButtons = within(configCard as HTMLElement).getAllByRole('button');
    expect(configButtons.map((b) => b.textContent).join(',')).toContain('重启');
    expect(configButtons.map((b) => b.textContent).join(',')).not.toMatch(/启动|停止/);
    await userEvent.setup().click(configButtons[configButtons.length - 1]);
    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(warningSpy.mock.calls[0][0].content).toContain('后置');
    // 点击重启不产生任何 API 请求
    expect(mockFetch.mock.calls.length).toBe(callsBefore);
    // 8903 卡内无操作按钮
    const webCard = screen.getByText('QED 前端服务').closest('.ant-card')!;
    expect(within(webCard as HTMLElement).queryAllByRole('button')).toHaveLength(0);
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

  it('操作后轮询 /services 收敛过渡态（starting → online）', async () => {
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
    await opPromise;
    expect(useConsoleStore.getState().services.find((s) => s.name === 'tracker')?.status).toBe('online');
    expect(useConsoleStore.getState().operating).toBeNull();
  });
});