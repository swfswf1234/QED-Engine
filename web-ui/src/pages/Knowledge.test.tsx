import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Knowledge from './Knowledge';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useStarMapStore } from '../stores/starMap';
import type { StarMapResponse } from '../api/learn';

// ECharts 依赖 canvas，jsdom 不可用：以按钮列表替身透出布局节点（同 Dashboard/GpuOverview 处理）
vi.mock('../components/StarMapGraph', () => ({
  default: ({
    layout, onSelectCourse,
  }: {
    layout: { nodes: Array<{ id: string; name: string; track: string }> };
    onSelectCourse: (id: string) => void;
  }) => (
    <div aria-label="星图">
      {layout.nodes.map((n) => (
        <button key={n.id} onClick={() => onSelectCourse(n.id)}>课程卡 {n.name}（{n.track}）</button>
      ))}
    </div>
  ),
}));

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
}

const STAR_MAP: StarMapResponse = {
  domains: [
    {
      domain_id: 'math',
      name: '数学',
      level: '本科',
      tracks: [
        {
          track: '分析学',
          kind: 'main',
          summary: '',
          courses: [
            { course_id: 'ma', name: '数学分析', track: '分析学', stage: '', sort_order: 1, kp_confirmed: 2, kp_candidates: 1 },
            { course_id: 'ra', name: '实变函数', track: '分析学', stage: '', sort_order: 2, kp_confirmed: 0, kp_candidates: 0 },
          ],
        },
        {
          track: '代数学',
          kind: 'main',
          summary: '',
          courses: [{ course_id: 'la', name: '线性代数', track: '代数学', stage: '', sort_order: 1, kp_confirmed: 0, kp_candidates: 3 }],
        },
      ],
    },
    {
      domain_id: 'cs',
      name: '计算机科学',
      level: '本科',
      tracks: [
        {
          track: 'AI',
          kind: 'other',
          summary: '',
          courses: [{ course_id: 'ml', name: '机器学习', track: 'AI', stage: '', sort_order: 1, kp_confirmed: 0, kp_candidates: 0 }],
        },
      ],
    },
  ],
  edges: [
    { from: 'ma', to: 'ra', domain_id: 'math', cross_track: false },
    { from: 'la', to: 'ra', domain_id: 'math', cross_track: true },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ConfigProvider theme={theme}>
        <Knowledge />
        <LocationProbe />
      </ConfigProvider>
    </MemoryRouter>,
  );
}

describe('学习中心·知识梳理星图 Knowledge（M5 demo）', { timeout: 15000 }, () => {
  beforeEach(() => {
    useStarMapStore.setState({ domains: [], edges: [], domainId: '', loading: false, error: null });
    mockFetch.mockReset();
  });

  it('大标题 + 领域下拉（默认第一个领域）+ 轨迹列与课程卡；画面不出现统计与图例', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify(STAR_MAP), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    renderPage();
    expect(await screen.findByText('学习中心 · 知识梳理星图')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '领域' })).toBeInTheDocument();
    expect(screen.getByText('数学')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '课程卡 数学分析（分析学）' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '课程卡 线性代数（代数学）' })).toBeInTheDocument();
    expect(screen.queryByText(/机器学习/)).not.toBeInTheDocument();
    // 图上可直读的信息不再写成文字（统计行 / 页面内图例）
    expect(screen.queryByText(/条轨迹/)).not.toBeInTheDocument();
    expect(screen.queryByText(/已确认知识点/)).not.toBeInTheDocument();
    expect(screen.queryByText(/竖虚线框＝学习轨迹/)).not.toBeInTheDocument();
  });

  it('右上角只有三枚按钮，「使用手册」打开手册并含星图读图口径', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify(STAR_MAP), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    renderPage();
    await screen.findByText('学习中心 · 知识梳理星图');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /使用手册/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('知识梳理星图')).toBeInTheDocument();
    expect(screen.getByText(/竖虚线框＝学习轨迹（track），框内课程卡自上而下按层级排/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /刷新/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /返回/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /返回主界面|刷新星图/ })).not.toBeInTheDocument();
  });

  it('切换领域 → 课程卡换为该领域课程', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify(STAR_MAP), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    renderPage();
    await screen.findByRole('button', { name: '课程卡 数学分析（分析学）' });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '领域' }));
    fireEvent.click(await screen.findByText('计算机科学'));
    expect(await screen.findByRole('button', { name: '课程卡 机器学习（AI）' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '课程卡 数学分析（分析学）' })).not.toBeInTheDocument();
  });

  it('点击课程卡 → 下钻课程知识点页', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify(STAR_MAP), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '课程卡 实变函数（分析学）' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/knowledge/c/ra');
  });

  it('星图数据不可达 → 降级提示 + 空态，不白屏', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: '课程目录不可达：8901 未启动' }), { status: 503, headers: { 'Content-Type': 'application/json' } }),
    );
    renderPage();
    expect(await screen.findByText('星图数据不可达')).toBeInTheDocument();
    expect(screen.getByText('课程目录暂不可达，星图无课程可展示')).toBeInTheDocument();
  });
});
