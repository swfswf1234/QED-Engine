/**
 * 课程层视图单测（REQ-110 W3 由「页」降级为同页内视图；REQ-113 W4 七审改判为大知识点虚框＋框内条目）
 * 口径：本视图只承载主体（《课程名》行＋介绍＋层级星图/空态/降级提示），
 * 页头、大标题与面包屑归 Knowledge.tsx（同页替换层），领域下拉只属领域层，本视图零导航按钮。
 * 图上只有两层：虚框＝大知识点、条目＝框内小知识点；无父／悬空父的 point 不进图，也不出现「未归档」。
 * ECharts 依赖 canvas，jsdom 不可用：层级星图以框／条目名单替身透出（同 Knowledge.test 处理）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import CourseKnowledge from './CourseKnowledge';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useCourseKnowledgeStore } from '../stores/courseKnowledge';

vi.mock('../components/KpTreeGraph', () => ({
  default: ({ layout }: {
    layout: { width: number; boxes: Array<{ id: string; name: string }>; items: Array<{ id: string; name: string }> };
  }) => (
    <div aria-label="层级星图" data-width={layout.width}>
      {layout.boxes.map((b) => (
        <span key={b.id} className="kp-box">{b.name}</span>
      ))}
      {layout.items.map((n) => (
        <span key={n.id} className="kp-item">{n.name}</span>
      ))}
    </div>
  ),
}));

const OUTLINE_ROWS = [
  { kp_id: 'k1', course_id: 'ma', name: '第1章 函数', norm_key: '第1章 函数', node_kind: 'outline', parent_kp_id: null, depth: 1, order_hint: 1, type: null, summary: '', anchors: [], book_ref: 'b05' },
  { kp_id: 'k11', course_id: 'ma', name: '1.1 映射', norm_key: '1.1 映射', node_kind: 'outline', parent_kp_id: 'k1', depth: 2, order_hint: 1, type: null, summary: '', anchors: [], book_ref: 'b05' },
  { kp_id: 'p1', course_id: 'ma', name: '确界原理', norm_key: '确界原理', node_kind: 'point', parent_kp_id: 'k11', depth: null, order_hint: 1, type: 'concept', summary: '有上界数集必有上确界', anchors: [{ kind: 'page', page: 5 }], book_ref: null },
  { kp_id: 'p2', course_id: 'ma', name: '散落的知识点', norm_key: '散落的知识点', node_kind: 'point', parent_kp_id: null, depth: null, order_hint: null, type: null, summary: '', anchors: [], book_ref: null },
];

function overviewOf(courseExtra: Record<string, unknown>, points: unknown[]) {
  return {
    course: { course_id: 'ma', name: '数学分析', track: '分析学', domain_id: 'math', description: '极限、连续与一元微积分', ...courseExtra },
    points,
    total: points.length,
    candidate_total: 0,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

function routeReads(body: unknown = overviewOf({}, OUTLINE_ROWS)) {
  mockFetch.mockImplementation(() => jsonResponse(body));
}

function renderView(courseId = 'ma', contentWidth?: number) {
  return render(
    <ConfigProvider theme={theme}>
      <CourseKnowledge courseId={courseId} contentWidth={contentWidth} />
    </ConfigProvider>,
  );
}

describe('课程层级星图视图 CourseKnowledge（REQ-110 同页内视图 + REQ-113 七审形态）', { timeout: 15000 }, () => {
  beforeEach(() => {
    useCourseKnowledgeStore.setState({ courseId: null, course: null, rows: [], loading: false, error: null, notFound: false });
    mockFetch.mockReset();
  });

  it('《课程名》＋介绍 + 层级星图（虚框＝大知识点，条目＝框内小知识点）', async () => {
    routeReads();
    renderView();
    expect(await screen.findByText('《数学分析》')).toBeInTheDocument();
    expect(screen.getByText('极限、连续与一元微积分')).toBeInTheDocument();
    expect(await screen.findByLabelText('层级星图')).toBeInTheDocument();
    expect(document.querySelectorAll('.kp-box')).toHaveLength(1);
    expect(screen.getByText('第1章 函数')).toBeInTheDocument();
    for (const name of ['1.1 映射', '确界原理']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    // 无父的 point 不进学习面，也不画「未归档」；归属由虚框承载，图上没有边图元
    expect(screen.queryByText('散落的知识点')).not.toBeInTheDocument();
    expect(screen.queryByText('未归档')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.tree-link')).toHaveLength(0);
  });

  it('画布宽＝内容区实测宽（由 Knowledge.tsx 的 ResizeObserver 传入，扣掉两侧留白）', async () => {
    routeReads();
    renderView('ma', 1400);
    expect(await screen.findByLabelText('层级星图')).toHaveAttribute('data-width', '1360');
  });

  it('只有大知识点（outline 行，无 point）也出图；全是无父 point → 走空态', async () => {
    routeReads(overviewOf({}, [OUTLINE_ROWS[0], OUTLINE_ROWS[1]]));
    const first = renderView();
    expect(await screen.findByLabelText('层级星图')).toBeInTheDocument();
    expect(screen.queryByText('该课程暂无已确认知识点')).not.toBeInTheDocument();
    first.unmount();

    routeReads(overviewOf({}, [OUTLINE_ROWS[3]]));
    renderView('complex_analysis');
    expect(await screen.findByText('该课程暂无已确认知识点')).toBeInTheDocument();
    expect(screen.queryByLabelText('层级星图')).not.toBeInTheDocument();
  });

  it('七审形态：无浅色卡容器、视图内不挂领域下拉（回领域层只经面包屑）', async () => {
    routeReads();
    const { container } = renderView();
    await screen.findByLabelText('层级星图');
    expect(container.querySelector('.kn-course-card')).toBeNull();
    expect(container.querySelector('.kn-course')).not.toBeNull();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('只留知识点结构：无统计行/轨迹 Tag/待选池/手工登记/候选抽屉，且不请求候选池', async () => {
    routeReads();
    renderView();
    await screen.findByLabelText('层级星图');
    expect(screen.queryByText(/已确认 \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/待选/)).not.toBeInTheDocument();
    expect(screen.queryByText(/轨迹/)).not.toBeInTheDocument();
    expect(screen.queryByText(/待选池/)).not.toBeInTheDocument();
    expect(screen.queryByText(/手工登记/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /登记候选|确认|驳回|改用此版/ })).not.toBeInTheDocument();
    expect(mockFetch.mock.calls.every((c) => !String(c[0]).includes('/kp-details'))).toBe(true);
  });

  it('单次取数：只发一次 knowledge-points?include_outline=true（虚框与条目同响应）', async () => {
    routeReads();
    renderView();
    await screen.findByLabelText('层级星图');
    expect(mockFetch.mock.calls).toHaveLength(1);
    expect(String(mockFetch.mock.calls[0][0])).toContain('include_outline=true');
  });

  it('无已确认知识点 → 空态「该课程暂无已确认知识点」，课程名与介绍照常显示，不画图', async () => {
    routeReads(overviewOf({}, []));
    renderView('complex_analysis');
    expect(await screen.findByText('该课程暂无已确认知识点')).toBeInTheDocument();
    expect(screen.getByText('《数学分析》')).toBeInTheDocument();
    expect(screen.getByText('极限、连续与一元微积分')).toBeInTheDocument();
    expect(screen.queryByLabelText('层级星图')).not.toBeInTheDocument();
  });

  it('介绍缺失 → 只显示《课程名》，不留占位', async () => {
    routeReads(overviewOf({ description: '' }, OUTLINE_ROWS));
    renderView();
    expect(await screen.findByLabelText('层级星图')).toBeInTheDocument();
    expect(screen.getByText('《数学分析》')).toBeInTheDocument();
    expect(screen.queryByText('极限、连续与一元微积分')).not.toBeInTheDocument();
  });

  it('视图内零导航按钮（回退归面包屑）、无跨界出口、不发复习聚合', async () => {
    routeReads();
    renderView();
    await screen.findByLabelText('层级星图');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('学习中心·知识探索')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /进入学习工作台|今日复习|返回/ })).not.toBeInTheDocument();
    expect(mockFetch.mock.calls.every((c) => !String(c[0]).includes('/learn/review/due'))).toBe(true);
  });

  it('知识点存储未接入（503）→ 明确提示 + 重试，不白屏也不误报空态', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ detail: '知识点存储未接入（数据库不可达或未配置）' }, 503));
    renderView();
    expect(await screen.findByText('知识点数据不可达')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重\s*试/ })).toBeInTheDocument();
    expect(screen.queryByText('该课程暂无已确认知识点')).not.toBeInTheDocument();
  });

  it('课程不存在（404）→ 「课程不存在或已下线」，不显示重试也不误报空态', async () => {
    mockFetch.mockImplementation(() =>
      jsonResponse({ detail: { code: 'COURSE_NOT_FOUND', message: '课程不存在：ghost' } }, 404),
    );
    renderView('ghost');
    expect(await screen.findByText('课程不存在或已下线')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /重\s*试/ })).not.toBeInTheDocument();
    expect(screen.queryByText('该课程暂无已确认知识点')).not.toBeInTheDocument();
  });

  it('切换 courseId 只重取该课数据：旧课程名不残留', async () => {
    mockFetch.mockImplementation((url: string) => {
      const matched = /courses\/([^/]+)\/knowledge-points/.exec(String(url));
      return jsonResponse(overviewOf({ course_id: matched?.[1], name: matched?.[1] === 'ra' ? '实变函数' : '数学分析' }, OUTLINE_ROWS));
    });
    const { rerender } = renderView('ma');
    expect(await screen.findByText('《数学分析》')).toBeInTheDocument();
    rerender(
      <ConfigProvider theme={theme}>
        <CourseKnowledge courseId="ra" />
      </ConfigProvider>,
    );
    expect(await screen.findByText('《实变函数》')).toBeInTheDocument();
    expect(screen.queryByText('《数学分析》')).not.toBeInTheDocument();
  });

  it('数据不可达后点「重试」＝只重取该课数据并出图', async () => {
    let failed = true;
    mockFetch.mockImplementation(() => {
      const status = failed ? 503 : 200;
      const body = failed ? { detail: '知识点存储未接入' } : overviewOf({}, OUTLINE_ROWS);
      failed = false;
      return jsonResponse(body, status);
    });
    renderView();
    await screen.findByText('知识点数据不可达');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /重\s*试/ }));
    expect(await screen.findByLabelText('层级星图')).toBeInTheDocument();
    expect(mockFetch.mock.calls.every((c) => String(c[0]).includes('/knowledge-points'))).toBe(true);
  });
});
