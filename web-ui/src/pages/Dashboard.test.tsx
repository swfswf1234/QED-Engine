import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Dashboard from './Dashboard';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useDashboardStore } from '../stores/dashboard';
import { useRuntimeStore } from '../stores/runtime';
import type { BookRecord, KnowledgeDetail, KnowledgeRecord, ServiceStatus } from '../stores';

// ECharts 依赖 canvas，jsdom 不可用；渲染层由 EChart.test 覆盖，此处以占位验证组装
vi.mock('../components/EChart', () => ({
  default: ({ option }: { option: { series?: { data?: unknown[] }[]; title?: { text?: string } } }) => (
    <div
      data-testid="echart"
      data-series={JSON.stringify(option.series ?? [])}
      data-title={option.title?.text ?? ''}
    />
  ),
}));

function kn(partial: Partial<KnowledgeRecord> & { knowledge_id: string; course_id: string }): KnowledgeRecord {  return {
    domain_id: 'math',
    kind: 'tutorial',
    set_no: '',
    name: partial.name ?? '',
    textbook_ref: null,
    exercise_ref: null,
    textbook_intro: '',
    exercise_intro: '',
    materials_intro: '',
    status: 'draft',
    reject_reason: '',
    supersede_reason: '',
    created_at: '',
    confirmed_at: null,
    completed_at: null,
    ...partial,
  };
}

function book(partial: Partial<BookRecord> & { book_id: string; knowledge_id: string }): BookRecord {
  return {
    kind: 'textbook',
    roles: ['textbook'],
    title: 't',
    part: '',
    display_title: 't',
    file_name: '',
    authors: [],
    language: '',
    version: {},
    source: null,
    original_url: '',
    sha256: null,
    relative_path: '',
    absolute_path: '',
    page_count: null,
    status: 'candidate',
    reject_reason: '',
    supersede_reason: '',
    review_note: '',
    created_at: '',
    decided_at: null,
    downloaded_at: null,
    verified_at: null,
    ...partial,
  };
}

const k1 = kn({ knowledge_id: 'k1', course_id: 'math', status: 'draft' });
const k2 = kn({ knowledge_id: 'k2', course_id: 'math', status: 'confirmed' });
const k3 = kn({ knowledge_id: 'k3', course_id: 'analysis', status: 'confirmed' });
const knowledgeFixture: KnowledgeRecord[] = [k1, k2, k3];
const detailsFixture: Record<string, KnowledgeDetail> = {
  k1: { ...k1, books: [book({ book_id: 'b1', knowledge_id: 'k1', status: 'downloaded' })] },
  k2: { ...k2, books: [book({ book_id: 'b2', knowledge_id: 'k2', status: 'verified' })] },
  k3: { ...k3, books: [] },
};
// catalog targets：math（k1/k2）与 analysis（k3）→ 分母 2 门课程
const catalogFixture = {
  id: 'math-qe',
  targets: [
    { course_id: 'math', name: '数学分析' },
    { course_id: 'analysis', name: '实分析' },
  ],
};

/** 路由匹配：URL 包含路由 key；详情路由（更长 key）优先于列表路由；函数值按 URL 动态返回 */
function mockApi(routes: Record<string, unknown | ((url: string) => unknown)>) {
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
  mockFetch.mockImplementation((url: string) => {
    const hit = keys.find((k) => url.includes(k));
    if (!hit) return Promise.reject(new TypeError(`no route: ${url}`));
    const payload = routes[hit];
    const value = typeof payload === 'function' ? (payload as (u: string) => unknown)(url) : payload;
    return value instanceof Response
      ? Promise.resolve(value)
      : Promise.resolve(
        new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } }),
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

/** runtime store 预置服务快照（仪表盘只读消费共享数据，不发请求） */
const runtimeServices: ServiceStatus[] = [
  { name: 'config', label: 'QED 管理服务（配置中心）', port: 8900, log_path: '', status: 'online', pid: null, started_at: null, reason: '' },
  { name: 'tracker', label: 'QED-Tracker 文档下载服务', port: 8901, log_path: '', status: 'offline', pid: null, started_at: null, reason: '未启动' },
  { name: 'axiom', label: 'Axiom-Flow 文档解析服务', port: 8902, log_path: '', status: 'online', pid: 9, started_at: '', reason: '' },
];

describe('仪表盘 Dashboard（Phase 3 + 五层化）', () => {
  beforeEach(() => {
    useDashboardStore.setState({
      knowledge: [], details: {}, catalogTargets: [], loading: false, error: null, dataError: null, catalogError: null,
    });
    useRuntimeStore.setState({ services: runtimeServices });
  });

  it('渲染标题/服务在线速览（共享数据零请求）/课程完成度+教程饼图/解析占位；上下布局', async () => {
    mockApi({
      '/catalogs/': catalogFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDashboard();
    expect(await screen.findByText('仪表盘')).toBeInTheDocument();
    // 服务在线卡恢复（2026-08-24 二次裁决）：轻量只读展示，数据来自共享 runtime store
    expect(screen.getByText('服务在线')).toBeInTheDocument();
    expect(screen.getByText('QED 管理服务（配置中心）')).toBeInTheDocument();
    expect(screen.getByText('QED-Tracker 文档下载服务')).toBeInTheDocument();
    expect(screen.getByText(/离线（未启动）/)).toBeInTheDocument();
    // 缺 web 条目时兜底显示 8903（withWebServiceFallback）
    expect(screen.getByText('QED 前端服务')).toBeInTheDocument();
    // 零额外请求契约：渲染过程不发出 /services
    expect(mockFetch.mock.calls.some((c) => String(c[0]).includes('/services'))).toBe(false);
    // 布局顺序：服务在线 → 文档下载进度 → 文档解析进度
    const healthCard = screen.getByText('服务在线').closest('.ant-card')!;
    const downloadCard = screen.getByText('文档下载进度');
    const parseCard = screen.getByText('文档解析进度');
    expect(healthCard.compareDocumentPosition(downloadCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(downloadCard.compareDocumentPosition(parseCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 双饼图占位 + 统计数字
    const charts = screen.getAllByTestId('echart');
    expect(charts).toHaveLength(2);
    // 饼图1 课程完成度：分母 2 门（math/analysis）；math 仅 k2 全验收（k1 有 downloaded）→ 完成 0
    const completionSeries = JSON.parse(charts[0].getAttribute('data-series') ?? '[]');
    expect(completionSeries[0].data.map((d: { value: number }) => d.value)).toEqual([0, 2]);
    expect(charts[0].getAttribute('data-title')).toContain('课程下载完成度 0/2');
    // 饼图2 按教程：k1（b1 已下载）、k2（b2 已下载）→ [1, 1]
    const knowledgeSeries = JSON.parse(charts[1].getAttribute('data-series') ?? '[]');
    expect(knowledgeSeries[0].data.map((d: { value: number }) => d.value)).toEqual([1, 1]);
    // 统计行：教程数 3、目标书目 2、已下载 2（downloaded+verified）、已验收 1
    const totalStat = screen.getByText('教程数').closest('.ant-statistic')!;
    expect(within(totalStat as HTMLElement).getByText('3')).toBeInTheDocument();
    expect(screen.getByText('目标书目')).toBeInTheDocument();
    expect(screen.getByText('已下载')).toBeInTheDocument();
    expect(screen.getByText('已验收')).toBeInTheDocument();
    // 解析占位
    expect(screen.getByText('解析任务数据源后置')).toBeInTheDocument();
  });

  it('8901 不可达（/knowledge 503）→ 文档下载状况降级提示，无整体横幅；服务在线卡仍展示', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/knowledge')) {
        return Promise.resolve(
          new Response(JSON.stringify({ detail: 'QED-Tracker 服务不可达' }), { status: 503, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    renderDashboard();
    expect(await screen.findByText('QED-Tracker 数据不可达')).toBeInTheDocument();
    // 无整体错误横幅（503 为 http 类错误，不等同 8900 离线）
    expect(screen.queryByText('仪表盘数据获取失败')).not.toBeInTheDocument();
    // 服务在线卡来自共享 runtime store，不受 8901 影响
    expect(screen.getByText('服务在线')).toBeInTheDocument();
  });

  it('8900 不可达 → 整体错误横幅', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    renderDashboard();
    expect(await screen.findByText('仪表盘数据获取失败')).toBeInTheDocument();
  });

  it('刷新按钮触发重新拉取', async () => {
    mockApi({
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDashboard();
    await screen.findByText('仪表盘');
    await waitFor(() => {
      expect(useDashboardStore.getState().knowledge.length).toBe(3);
    });
    const callsBefore = mockFetch.mock.calls.length;
    await userEvent.setup().click(screen.getByRole('button', { name: /刷新/ }));
    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
