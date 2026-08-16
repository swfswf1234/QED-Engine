import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Dashboard from './Dashboard';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useDashboardStore } from '../stores/dashboard';

// ECharts 依赖 canvas，jsdom 不可用；渲染层由 EChart.test 覆盖，此处以占位验证组装
vi.mock('../components/EChart', () => ({
  default: ({ option }: { option: { series?: { data?: unknown[] }[] } }) => (
    <div data-testid="echart" data-series={JSON.stringify(option.series ?? [])} />
  ),
}));

const servicesFixture = {
  services: [
    { name: 'config', label: 'QED 管理服务（配置中心）', port: 8900, log_path: '', status: 'online', pid: null, started_at: null, reason: '' },
    { name: 'tracker', label: 'QED-Tracker 文档下载服务', port: 8901, log_path: '', status: 'offline', pid: null, started_at: null, reason: '未启动' },
    { name: 'axiom', label: 'Axiom-Flow 文档解析服务', port: 8902, log_path: '', status: 'online', pid: 9, started_at: '', reason: '' },
  ],
};

const selectionsFixture = [
  {
    book_id: 's1', knowledge_id: 'k1', course_id: 'math', kind: 'textbook', title: '数学分析', display_title: '数学分析（上）',
    status: 'candidate', download_stats: { total: 2, downloaded: 1, approved: 0 }, downloads: [],
  },
  {
    book_id: 's2', knowledge_id: 'k2', course_id: 'math', kind: 'exercise', title: '习题集', display_title: '数学分析习题集',
    status: 'confirmed', download_stats: { total: 1, downloaded: 1, approved: 1 }, downloads: [],
  },
  {
    book_id: 's3', knowledge_id: 'k3', course_id: 'analysis', kind: 'textbook', title: '实分析', display_title: '实分析',
    status: 'confirmed', download_stats: { total: 0, downloaded: 0, approved: 0 }, downloads: [],
  },
];

function mockApi(routes: Record<string, unknown>) {
  mockFetch.mockImplementation((url: string) => {
    const hit = Object.keys(routes).find((k) => url.includes(k));
    if (!hit) return Promise.reject(new TypeError(`no route: ${url}`));
    return Promise.resolve(
      new Response(JSON.stringify(routes[hit]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <ConfigProvider theme={theme}>
        <Dashboard />
      </ConfigProvider>
    </MemoryRouter>,
  );
}

describe('仪表盘 Dashboard（Phase 3）', () => {
  beforeEach(() => {
    useDashboardStore.setState({ selections: [], services: [], loading: false, error: null, dataError: null });
  });

  it('渲染标题/四服务摘要/下载状况图表/解析占位；上下布局', async () => {
    mockApi({ '/services': servicesFixture, '/selections': selectionsFixture });
    renderDashboard();
    expect(await screen.findByText('仪表盘')).toBeInTheDocument();
    // 服务健康摘要：只含四服务，无 MySQL
    await waitFor(() => {
      expect(useDashboardStore.getState().services.length).toBe(3);
    });
    expect(screen.getByText('服务健康摘要')).toBeInTheDocument();
    expect(screen.getByText('QED 管理服务（配置中心）')).toBeInTheDocument();
    expect(screen.getByText('QED 前端服务')).toBeInTheDocument();
    expect(screen.queryByText(/MySQL/)).not.toBeInTheDocument();
    // 图表占位两个 + 统计数字
    const charts = screen.getAllByTestId('echart');
    expect(charts).toHaveLength(2);
    // 表1 状态分布数据（mock EChart 注入 series）：s1 candidate、s2/s3 confirmed → [1, 2, 0]
    const distSeries = JSON.parse(charts[0].getAttribute('data-series') ?? '[]');
    expect(distSeries[0].data).toEqual([1, 2, 0]);
    // 课程完成进度：math 2 套 1 推进，analysis 1 套 1 推进
    const progSeries = JSON.parse(charts[1].getAttribute('data-series') ?? '[]');
    expect(progSeries[0].data.map((d: { value: number }) => d.value)).toEqual([0.5, 1]);
    // 统计行
    expect(screen.getByText('套书总数')).toBeInTheDocument();
    const totalStat = screen.getByText('套书总数').closest('.ant-statistic')!;
    expect(within(totalStat as HTMLElement).getByText('3')).toBeInTheDocument();
    expect(screen.getByText('册级总数')).toBeInTheDocument();
    expect(screen.getByText('已下载')).toBeInTheDocument();
    // 解析状况占位
    expect(screen.getByText('解析任务数据源后置')).toBeInTheDocument();
    // 上下布局：下载状况卡在解析状况卡之前（DOM 顺序）
    const downloadCard = screen.getByText('文档下载状况');
    const parseCard = screen.getByText('文档解析状况');
    expect(downloadCard.compareDocumentPosition(parseCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('8901 不可达（/selections 503）→ 文档下载状况降级提示，其余卡片正常', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/services')) {
        return Promise.resolve(
          new Response(JSON.stringify(servicesFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/selections')) {
        return Promise.resolve(
          new Response(JSON.stringify({ detail: 'QED-Tracker 服务不可达' }), { status: 503, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    renderDashboard();
    expect(await screen.findByText('QED-Tracker 数据不可达')).toBeInTheDocument();
    // 无整体错误横幅（8900 正常）
    expect(screen.queryByText('仪表盘数据获取失败')).not.toBeInTheDocument();
    // 服务健康摘要仍正常
    expect(screen.getByText('服务健康摘要')).toBeInTheDocument();
  });

  it('8900 不可达 → 整体错误横幅', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    renderDashboard();
    expect(await screen.findByText('仪表盘数据获取失败')).toBeInTheDocument();
  });

  it('刷新按钮触发重新拉取', async () => {
    mockApi({ '/services': servicesFixture, '/selections': selectionsFixture });
    renderDashboard();
    await screen.findByText('仪表盘');
    await waitFor(() => {
      expect(useDashboardStore.getState().selections.length).toBe(3);
    });
    const callsBefore = mockFetch.mock.calls.length;
    await userEvent.setup().click(screen.getByRole('button', { name: /刷新/ }));
    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});