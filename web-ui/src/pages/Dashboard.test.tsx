import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Dashboard from './Dashboard';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useDashboardStore } from '../stores/dashboard';
import { useRuntimeStore } from '../stores/runtime';
import type { BookRecord, DomainSystem, KnowledgeDetail, KnowledgeRecord, ServiceStatus } from '../stores';

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
    intro: '',
    status: 'draft',
    reject_reason: '',
    supersede_reason: '',
    created_at: '',
    confirmed_at: null,
    completed_at: null,
    ...partial,
  };
}

function book(partial: Partial<BookRecord> & { book_id: string }): BookRecord {
  return {
    title: 't',
    original_title: null,
    part: '',
    authors: [],
    publisher: '',
    edition: '',
    year: null,
    language: '',
    roles: ['textbook'],
    status: 'candidate',
    retire_reason: '',
    holding: 'missing',
    file_path: null,
    priority: null,
    notes: null,
    domain_id: 'math',
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

const k1 = kn({ knowledge_id: 'k1', course_id: 'math', status: 'draft' });
const k2 = kn({ knowledge_id: 'k2', course_id: 'math', status: 'confirmed' });
const k3 = kn({ knowledge_id: 'k3', course_id: 'analysis', status: 'confirmed' });
const knowledgeFixture: KnowledgeRecord[] = [k1, k2, k3];
const detailsFixture: Record<string, KnowledgeDetail> = {
  k1: { ...k1, books: [book({ book_id: 'b1', knowledge_id: 'k1', status: 'parallel', holding: 'owned' })] },
  k2: { ...k2, books: [book({ book_id: 'b2', knowledge_id: 'k2', status: 'decided', holding: 'missing' })] },
  k3: { ...k3, books: [] },
};

// 领域课程体系：math 和 analysis 两个领域
const courseSystemFixture: DomainSystem[] = [
  {
    domain_id: 'math',
    name: '数学',
    exploration_stage: '已完成',
    courses: [
      { course_id: 'math', name: '数学分析', aliases: [], stage: '', prerequisites: [], exploration_stage: '已完成' },
      { course_id: 'math-adv', name: '高等数学', aliases: [], stage: '', prerequisites: [], exploration_stage: '已完成' },
    ],
  },
  {
    domain_id: 'analysis',
    name: '分析学',
    exploration_stage: '探索中',
    courses: [
      { course_id: 'analysis', name: '实分析', aliases: [], stage: '', prerequisites: [], exploration_stage: '已完成' },
    ],
  },
];

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

describe('仪表盘 Dashboard（三行图表重构）', () => {
  beforeEach(() => {
    useDashboardStore.setState({
      knowledge: [], details: {}, courseSystem: [], loading: false, error: null, dataError: null, courseError: null,
    });
    useRuntimeStore.setState({ services: runtimeServices });
  });

  it('渲染标题/服务在线速览/三行图表/统计数字；上下布局', async () => {
    mockApi({
      '/courses': courseSystemFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDashboard();
    expect(await screen.findByText('仪表盘')).toBeInTheDocument();
    // 服务在线情况卡
    expect(screen.getByText('服务在线情况')).toBeInTheDocument();
    expect(screen.getByText('QED 管理服务（配置中心）')).toBeInTheDocument();
    // 零额外请求契约：渲染过程不发出 /services
    expect(mockFetch.mock.calls.some((c) => String(c[0]).includes('/services'))).toBe(false);
    // 布局顺序：服务在线情况 → 统计数字 → 领域探索进度 → 课程进度 → 文档下载进度
    const healthCard = screen.getByText('服务在线情况').closest('.ant-card')!;
    const statsCard = screen.getByText('已探明领域数').closest('.ant-card')!;
    const domainCard = screen.getByText('领域探索进度');
    const courseCard = screen.getByText('课程进度');
    const downloadCard = screen.getByText('文档下载进度');
    expect(healthCard.compareDocumentPosition(statsCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(statsCard.compareDocumentPosition(domainCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(domainCard.compareDocumentPosition(courseCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(courseCard.compareDocumentPosition(downloadCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 领域探索进度 1 个聚合饼图 + 课程进度 2 个（math/analysis）+ 文档下载进度 2 个 = 5 个
    const charts = screen.getAllByTestId('echart');
    expect(charts).toHaveLength(5);
    // 统计数字
    expect(screen.getByText('已探明领域数')).toBeInTheDocument();
    expect(screen.getByText('课程数')).toBeInTheDocument();
    expect(screen.getByText('书籍卷数')).toBeInTheDocument();
    expect(screen.getByText('验收书目数')).toBeInTheDocument();
  });

  it('8901 不可达（/knowledge 503）→ 数据不可达降级提示，无整体横幅；服务在线卡仍展示', async () => {
    mockApi({
      '/courses': courseSystemFixture,
    });
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/knowledge')) {
        return Promise.resolve(
          new Response(JSON.stringify({ detail: 'QED-Tracker 服务不可达' }), { status: 503, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/courses')) {
        return Promise.resolve(
          new Response(JSON.stringify(courseSystemFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    renderDashboard();
    expect(await screen.findByText('QED-Tracker 数据不可达')).toBeInTheDocument();
    // 无整体错误横幅（503 为 http 类错误，不等同 8900 离线）
    expect(screen.queryByText('仪表盘数据获取失败')).not.toBeInTheDocument();
    // 服务在线情况卡来自共享 runtime store，不受 8901 影响
    expect(screen.getByText('服务在线情况')).toBeInTheDocument();
  });

  it('8900 不可达 → 整体错误横幅', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    renderDashboard();
    expect(await screen.findByText('仪表盘数据获取失败')).toBeInTheDocument();
  });

  it('刷新按钮触发重新拉取', async () => {
    mockApi({
      '/courses': courseSystemFixture,
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

  it('状况卡保鲜轮询：30s tick 调 fetchSlots+fetchGpu；document.hidden 时跳过', async () => {
    mockApi({
      '/courses': courseSystemFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    const original = {
      fetchSlots: useRuntimeStore.getState().fetchSlots,
      fetchGpu: useRuntimeStore.getState().fetchGpu,
    };
    const slotsSpy = vi.fn().mockResolvedValue(undefined);
    const gpuSpy = vi.fn().mockResolvedValue(undefined);
    useRuntimeStore.setState({ fetchSlots: slotsSpy, fetchGpu: gpuSpy });
    const ticks: (() => void)[] = [];
    const intervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((fn: () => void, ms?: number) => {
      if (ms === 30_000) ticks.push(fn);
      return 0 as unknown as NodeJS.Timeout;
    }) as typeof window.setInterval);
    try {
      renderDashboard();
      await screen.findByText('仪表盘');
      expect(ticks).toHaveLength(1);
      ticks[0]();
      expect(slotsSpy).toHaveBeenCalledTimes(1);
      expect(gpuSpy).toHaveBeenCalledTimes(1);
      // 隐藏页跳过（浏览器实测中隐身视口 document.hidden=true 即此分支）
      Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
      ticks[0]();
      expect(slotsSpy).toHaveBeenCalledTimes(1);
      Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
      ticks[0]();
      expect(slotsSpy).toHaveBeenCalledTimes(2);
    } finally {
      intervalSpy.mockRestore();
      useRuntimeStore.setState(original);
    }
  });
});
