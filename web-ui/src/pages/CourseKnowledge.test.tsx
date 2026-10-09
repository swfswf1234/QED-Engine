import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import CourseKnowledge from './CourseKnowledge';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useCourseKnowledgeStore } from '../stores/courseKnowledge';
import { usePracticeStore } from '../stores/practice';

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
}

const POINTS = {
  course: { course_id: 'ma', name: '数学分析', track: '分析学', domain_id: 'math' },
  points: [
    {
      kp_id: 'kp-1', course_id: 'ma', name: '确界的极限唯一性', norm_key: '确界的极限唯一性',
      type: 'concept', summary: '闭区间上连续函数必取到最值', confirmed: true, anchors: [],
      candidates: [{ detail_id: 'd1', name: '确界的极限唯一性', type: 'concept', narrative: '确界原理的另一种叙述', payload: {}, anchors: [], gen_batch: 'b1', model_ref: '', gen_status: 'candidate' }],
    },
  ],
  total: 1,
  candidate_total: 2,
};

const POOL = {
  details: [
    { detail_id: 'd1', course_id: 'ma', name: '确界的极限唯一性', norm_key: '确界的极限唯一性', type: 'concept', narrative: '确界原理的另一种叙述', payload: {}, anchors: [], gen_batch: 'b1', model_ref: '', gen_status: 'candidate', kp_id: null, dedup_of: null, map_seed: null, domain_id: 'math', domain_label: '数学', course_label: '数学分析', confirmed: 0, created_at: '', updated_at: '' },
    { detail_id: 'd2', course_id: 'ma', name: '闭区间套定理', norm_key: '闭区间套定理', type: 'procedure', narrative: '一列嵌套闭区间的交非空', payload: {}, anchors: [], gen_batch: 'b1', model_ref: '', gen_status: 'candidate', kp_id: null, dedup_of: null, map_seed: null, domain_id: 'math', domain_label: '数学', course_label: '数学分析', confirmed: 0, created_at: '', updated_at: '' },
  ],
  total: 2,
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

function routeReads() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/knowledge-points')) return jsonResponse(POINTS);
    if (url.includes('/kp-details')) return jsonResponse(POOL);
    if (url.includes('/learn/review/due')) return jsonResponse({ course_id: 'ma', tasks: [], total_due: 5 });
    return Promise.reject(new TypeError(`no route: ${url}`));
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/knowledge/c/ma']}>
      <ConfigProvider theme={theme}>
        <Routes>
          <Route path="/knowledge/c/:courseId" element={<CourseKnowledge />} />
        </Routes>
        <LocationProbe />
      </ConfigProvider>
    </MemoryRouter>,
  );
}

describe('课程知识点掌握详情 CourseKnowledge（M5 demo）', { timeout: 15000 }, () => {
  beforeEach(() => {
    useCourseKnowledgeStore.setState({
      courseId: null, course: null, points: [], loose: [], candidateTotal: 0, loading: false, error: null, notice: null,
    });
    mockFetch.mockReset();
    usePracticeStore.setState({ courseDueCounts: {} });
  });

  it('已确认知识点与待选池分列，多版本候选挂在同名词下', async () => {
    routeReads();
    renderPage();
    expect(await screen.findByText('《数学分析》知识点梳理')).toBeInTheDocument();
    expect(screen.getByText('轨迹：分析学')).toBeInTheDocument();
    expect(screen.getByText('已确认 1 · 待选 1')).toBeInTheDocument();
    expect(screen.getByText('确界的极限唯一性')).toBeInTheDocument();
    expect(screen.getByText('概念性')).toBeInTheDocument();
    expect(screen.getByText('同名词另一版：确界原理的另一种叙述')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /改用此版/ })).toBeInTheDocument();
    // 未归入已确认的开放叙述才进待选池
    expect(screen.getByRole('button', { name: /确\s*认/ })).toBeInTheDocument();
    expect(screen.getByText('一列嵌套闭区间的交非空')).toBeInTheDocument();
  });

  it('确认候选 → 调 confirm 端点并展示回执', async () => {
    routeReads();
    renderPage();
    await screen.findByRole('button', { name: /确\s*认/ });
    mockFetch.mockImplementation((url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') return jsonResponse({ point: { kp_id: 'kp-9', name: '闭区间套定理' } });
      if (url.includes('/knowledge-points')) return jsonResponse(POINTS);
      return jsonResponse(POOL);
    });
    fireEvent.click(screen.getByRole('button', { name: /确\s*认/ }));
    expect(await screen.findByText('已确认并提升：闭区间套定理')).toBeInTheDocument();
    expect(mockFetch.mock.calls.some((c) => String(c[0]).endsWith('/learn/kp-details/d2/confirm'))).toBe(true);
  });

  it('手工登记候选 → POST 带课程 id 与名称', async () => {
    routeReads();
    renderPage();
    await screen.findByText('《数学分析》知识点梳理');
    let posted: Record<string, unknown> = {};
    mockFetch.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'POST') {
        posted = JSON.parse(String(init.body));
        return jsonResponse({ detail_id: 'd9', gen_status: 'candidate' });
      }
      if (url.includes('/knowledge-points')) return jsonResponse(POINTS);
      return jsonResponse(POOL);
    });
    fireEvent.change(screen.getByLabelText('候选名称'), { target: { value: '致密性定理' } });
    fireEvent.click(screen.getByRole('button', { name: /登记候选/ }));
    await waitFor(() => expect(posted.course_id).toBe('ma'));
    expect(posted).toMatchObject({ name: '致密性定理', gen_batch: 'manual-demo' });
    expect(await screen.findByText('候选已登记：致密性定理')).toBeInTheDocument();
  });

  it('未登记名称时登记按钮禁用；返回按钮回星图', async () => {
    routeReads();
    renderPage();
    await screen.findByText('《数学分析》知识点梳理');
    expect(screen.getByRole('button', { name: /登记候选/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /返回知识星图/ }));
    await vi.waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/knowledge'));
  });

  it('知识点存储未接入（503）→ 明确提示 + 重试，不白屏', async () => {
    mockFetch.mockImplementation(() =>
      jsonResponse({ detail: '知识点存储未接入（数据库不可达或未配置）' }, 503));
    renderPage();
    expect(await screen.findByText('知识点数据不可达')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重\s*试/ })).toBeInTheDocument();
  });

  it('复习入口：今日到期条数按课程聚合显示，点击进入学习工作台', async () => {
    routeReads();
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '今日复习 5 条' }));
    await vi.waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/learn/c/ma'));
  });

  it('复习入口：无到期项时不显示按钮（due 聚合失败也按 0 条处理）', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/knowledge-points')) return jsonResponse(POINTS);
      if (url.includes('/kp-details')) return jsonResponse(POOL);
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    renderPage();
    await screen.findByText('《数学分析》知识点梳理');
    expect(screen.queryByRole('button', { name: /今日复习/ })).not.toBeInTheDocument();
  });
});
