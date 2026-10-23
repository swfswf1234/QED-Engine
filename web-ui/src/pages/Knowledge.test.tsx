/**
 * 学习中心·知识探索页面单测（REQ-110 W3：单页两级视图）
 * 领域星图与课程层级星图在 `#/knowledge` 同页内替换，层级唯一事实源＝URL（`?course=`），
 * 回退只走面包屑（两级「知识探索 / {课程名}」，不含领域名）。
 * ECharts 依赖 canvas，jsdom 不可用：星图与层级星图都以节点列表替身透出（同 Dashboard/GpuOverview 处理）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Knowledge from './Knowledge';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useStarMapStore } from '../stores/starMap';
import { useCourseKnowledgeStore } from '../stores/courseKnowledge';
import type { StarMapResponse } from '../api/learn';

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

vi.mock('../components/KpTreeGraph', () => ({
  default: ({ layout }: { layout: { boxes: Array<{ id: string; name: string }>; items: Array<{ id: string; name: string }> } }) => (
    <div aria-label="层级星图">
      {layout.boxes.map((b) => (
        <span key={b.id} className="kp-box">{b.name}</span>
      ))}
      {layout.items.map((n) => (
        <span key={n.id} className="kp-item">{n.name}</span>
      ))}
    </div>
  ),
}));

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <span data-testid="location">{pathname}{search}</span>;
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
            { course_id: 'ma', name: '数学分析', track: '分析学', stage: '', sort_order: 1, description: '极限、连续与一元微积分', kp_confirmed: 2 },
            { course_id: 'ra', name: '实变函数', track: '分析学', stage: '', sort_order: 2, kp_confirmed: 0 },
          ],
        },
        {
          track: '代数学',
          kind: 'main',
          summary: '',
          courses: [{ course_id: 'la', name: '线性代数', track: '代数学', stage: '', sort_order: 1, kp_confirmed: 0 }],
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
          courses: [{ course_id: 'ml', name: '机器学习', track: 'AI', stage: '', sort_order: 1, kp_confirmed: 0 }],
        },
      ],
    },
  ],
  edges: [
    { from: 'ma', to: 'ra', domain_id: 'math', cross_track: false },
    { from: 'la', to: 'ra', domain_id: 'math', cross_track: true },
  ],
};

const ROWS = [
  { kp_id: 'k1', name: '第1章 函数', node_kind: 'outline', parent_kp_id: null, depth: 1, order_hint: 1 },
  { kp_id: 'p1', name: '确界原理', node_kind: 'point', parent_kp_id: 'k1', depth: null, order_hint: 1 },
];

function overviewFor(courseId: string) {
  return {
    course: {
      course_id: courseId,
      name: courseId === 'ra' ? '实变函数' : '数学分析',
      track: '分析学',
      domain_id: 'math',
      description: '极限、连续与一元微积分',
    },
    points: ROWS,
    total: ROWS.length,
    candidate_total: 0,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

/** 端点分发：层级端点按 course_id 回该课数据，其余回星图 */
function routeEndpoints() {
  mockFetch.mockImplementation((url: string) => {
    const matched = /courses\/([^/]+)\/knowledge-points/.exec(String(url));
    return jsonResponse(matched ? overviewFor(matched[1]) : STAR_MAP);
  });
}

function starMapCalls() {
  return mockFetch.mock.calls.filter((c) => String(c[0]).includes('/learn/star-map')).length;
}

function renderPage(path = '/knowledge') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ConfigProvider theme={theme}>
        <Knowledge />
        <LocationProbe />
      </ConfigProvider>
    </MemoryRouter>,
  );
}

describe('学习中心·知识探索 Knowledge（REQ-110 单页两级视图）', { timeout: 15000 }, () => {
  beforeEach(() => {
    useStarMapStore.setState({ domains: [], edges: [], domainId: '', loading: false, error: null });
    useCourseKnowledgeStore.setState({ courseId: null, course: null, rows: [], loading: false, error: null, notFound: false });
    mockFetch.mockReset();
  });

  it('领域层：大标题 + 单级面包屑 + 领域下拉 + 轨迹课程卡；无统计与图例；不发复习聚合请求', async () => {
    routeEndpoints();
    renderPage();
    expect(await screen.findByText('学习中心·知识探索')).toBeInTheDocument();
    expect(screen.getByText('知识探索')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '领域' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '课程卡 数学分析（分析学）' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '课程卡 线性代数（代数学）' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /机器学习/ })).not.toBeInTheDocument();
    // 图上可直读的信息不再写成文字（统计行 / 页面内图例）
    expect(screen.queryByText(/条轨迹/)).not.toBeInTheDocument();
    expect(screen.queryByText(/已确认知识点/)).not.toBeInTheDocument();
    expect(screen.queryByText(/竖虚线框＝学习轨迹/)).not.toBeInTheDocument();
    // 裁决 ④：独立面不消费复习域——GET /learn/review/due 聚合调用整体移除
    expect(mockFetch.mock.calls.every((c) => !String(c[0]).includes('/learn/review/due'))).toBe(true);
  });

  it('页头右上角固定三枚按钮（两视图共用），「使用手册」直落知识探索册（章节／知识点读图口径）', async () => {
    routeEndpoints();
    renderPage();
    await screen.findByText('学习中心·知识探索');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /使用手册/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/竖虚线框是章节/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /学习中心总手册/ })).toBeInTheDocument();
    // 打开即子册，不先落总册（总册入口另有点选）
    expect(within(dialog).queryByText(/整理成一条独自也走得完的路/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /刷新/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /返回/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /返回主界面|刷新星图|返回知识探索/ })).not.toBeInTheDocument();
  });

  it('切换领域 → 课程卡换为该领域课程', async () => {
    routeEndpoints();
    renderPage();
    await screen.findByRole('button', { name: '课程卡 数学分析（分析学）' });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '领域' }));
    fireEvent.click(await screen.findByText('计算机科学'));
    expect(await screen.findByRole('button', { name: '课程卡 机器学习（AI）' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '课程卡 数学分析（分析学）' })).not.toBeInTheDocument();
  });

  it('点课程卡 → 同页替换为层级星图并写 ?course=，面包屑两级不含领域名，星图数据不重取', async () => {
    routeEndpoints();
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '课程卡 实变函数（分析学）' }));
    expect(await screen.findByLabelText('层级星图')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/knowledge?course=ra');
    // 同页替换：星图课程卡不再是可交互图元（主体已让位给层级星图）
    expect(screen.queryByRole('button', { name: /课程卡/ })).not.toBeInTheDocument();
    // 大标题仍是页面唯一标题
    expect(screen.getByText('学习中心·知识探索')).toBeInTheDocument();
    // 面包屑两级＝知识探索 / 课程名，不含领域名（四审裁决）
    const crumbs = within(screen.getByRole('navigation', { name: '面包屑' }));
    expect(crumbs.getByText('知识探索')).toBeInTheDocument();
    expect(crumbs.getByText('实变函数')).toBeInTheDocument();
    expect(crumbs.queryByText('数学')).not.toBeInTheDocument();
    // 层级唯一事实源＝URL：星图数据沿用 store，不重取
    expect(starMapCalls()).toBe(1);
  });

  it('点面包屑「知识探索」→ 清参数回领域层，星图回来且不重取数据', async () => {
    routeEndpoints();
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '课程卡 数学分析（分析学）' }));
    expect(await screen.findByLabelText('层级星图')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: '知识探索' }));
    expect(await screen.findByRole('button', { name: '课程卡 数学分析（分析学）' })).toBeInTheDocument();
    expect(screen.queryByLabelText('层级星图')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/knowledge');
    expect(starMapCalls()).toBe(1);
  });

  it('深链 #/knowledge?course=ma 直接落课程层（刷新/收藏都落在对应层级）', async () => {
    routeEndpoints();
    renderPage('/knowledge?course=ma');
    expect(await screen.findByLabelText('层级星图')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '知识探索' })).toBeInTheDocument();
    // 课程名行＝该视图唯一标题，只显一处（五审：不与图区重复）
    expect(screen.getAllByText('《数学分析》')).toHaveLength(1);
  });

  it('课程层不挂领域下拉（五审裁决）：只显课程名行，换领域只经面包屑回领域层', async () => {
    routeEndpoints();
    renderPage('/knowledge?course=ma');
    await screen.findByLabelText('层级星图');
    expect(screen.queryByRole('combobox', { name: '领域' })).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: '知识探索' }));
    expect(await screen.findByRole('combobox', { name: '领域' })).toBeInTheDocument();
    expect(screen.queryByLabelText('层级星图')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/knowledge');
  });

  it('刷新按钮只重取当前视图数据（课程层不重取星图）', async () => {
    routeEndpoints();
    renderPage('/knowledge?course=ma');
    await screen.findByLabelText('层级星图');
    const user = userEvent.setup();
    const before = starMapCalls();
    await user.click(screen.getByRole('button', { name: /刷新/ }));
    await vi.waitFor(() => expect(mockFetch.mock.calls.length).toBeGreaterThan(1));
    expect(starMapCalls()).toBe(before);
  });

  it('?course= 指向不存在的课程（404）→ 提示「课程不存在或已下线」，面包屑仍可回退', async () => {
    mockFetch.mockImplementation((url: string) =>
      String(url).includes('/knowledge-points')
        ? jsonResponse({ detail: { code: 'COURSE_NOT_FOUND', message: '课程不存在：ghost' } }, 404)
        : jsonResponse(STAR_MAP),
    );
    renderPage('/knowledge?course=ghost');
    expect(await screen.findByText('课程不存在或已下线')).toBeInTheDocument();
    expect(screen.queryByText('该课程暂无已确认知识点')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('层级星图')).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: '知识探索' }));
    expect(await screen.findByRole('button', { name: '课程卡 数学分析（分析学）' })).toBeInTheDocument();
  });

  it('星图数据不可达 → 降级提示 + 空态，不白屏', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ detail: '课程目录不可达：8901 未启动' }, 503),
    );
    renderPage();
    expect(await screen.findByText('星图数据不可达')).toBeInTheDocument();
    expect(screen.getByText('课程目录暂不可达，星图无课程可展示')).toBeInTheDocument();
  });
});
