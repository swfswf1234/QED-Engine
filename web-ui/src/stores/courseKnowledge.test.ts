/**
 * 课程知识点 store 单测（REQ-104 W8 瘦身：只读面，层级图数据源）
 * 口径：include_outline=true 取全层级；course.description 透传；零写面（写操作归工作台批注）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCourseKnowledgeStore } from './courseKnowledge';
import { mockFetch } from '../test/setup';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

const OVERVIEW = {
  course: { course_id: 'ma', name: '数学分析', track: '分析学', domain_id: 'math', description: '极限、连续与一元微积分' },
  points: [
    { kp_id: 'k1', course_id: 'ma', name: '第1章 函数', norm_key: '第1章 函数', node_kind: 'outline', parent_kp_id: null, depth: 1, order_hint: 1, type: null, summary: '', anchors: [], book_ref: 'b05' },
    { kp_id: 'p1', course_id: 'ma', name: '确界原理', norm_key: '确界原理', node_kind: 'point', parent_kp_id: 'k1', depth: null, order_hint: 1, type: 'concept', summary: '有上界数集必有上确界', anchors: [{ kind: 'page', page: 5 }], book_ref: null },
  ],
  total: 2,
  candidate_total: 0,
};

describe('课程知识点 store（courseKnowledge：只读 + 全层级）', { timeout: 15000 }, () => {
  beforeEach(() => {
    useCourseKnowledgeStore.setState({ courseId: null, course: null, rows: [], loading: false, error: null, notFound: false });
    mockFetch.mockReset();
  });

  it('fetchCourse 带 include_outline=true 取全层级行，课程介绍透传', async () => {
    mockFetch.mockImplementation(() => jsonResponse(OVERVIEW));
    await useCourseKnowledgeStore.getState().fetchCourse('ma');
    const state = useCourseKnowledgeStore.getState();
    expect(mockFetch.mock.calls.every((c) => String(c[0]).includes('include_outline=true'))).toBe(true);
    expect(state.course?.description).toBe('极限、连续与一元微积分');
    expect(state.rows.map((r) => r.kp_id)).toEqual(['k1', 'p1']);
    expect(state.error).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('只读面：不再请求候选池，也不暴露任何写操作', async () => {
    mockFetch.mockImplementation(() => jsonResponse(OVERVIEW));
    await useCourseKnowledgeStore.getState().fetchCourse('ma');
    expect(mockFetch.mock.calls.every((c) => !String(c[0]).includes('/kp-details'))).toBe(true);
    const state = useCourseKnowledgeStore.getState() as unknown as Record<string, unknown>;
    for (const gone of ['loose', 'notice', 'candidateTotal', 'confirmCandidate', 'rejectCandidate', 'addCandidate', 'clearNotice']) {
      expect(state[gone]).toBeUndefined();
    }
  });

  it('存储未接入（503）→ error 文案，页面可重试', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ detail: '知识点存储未接入（数据库不可达或未配置）' }, 503));
    await useCourseKnowledgeStore.getState().fetchCourse('ma');
    const state = useCourseKnowledgeStore.getState();
    expect(state.error).toContain('服务暂不可用');
    expect(state.rows).toEqual([]);
    expect(state.notFound).toBe(false);
  });

  // REQ-110 W3：单页形态下 ?course= 可被手填/收藏到已下线的课，界面要给出「不存在」而非「不可达」
  it('课程不存在（404）→ notFound 标记，与「数据不可达」区分', async () => {
    mockFetch.mockImplementation(() =>
      jsonResponse({ detail: { code: 'COURSE_NOT_FOUND', message: '课程不存在：ghost' } }, 404),
    );
    await useCourseKnowledgeStore.getState().fetchCourse('ghost');
    const state = useCourseKnowledgeStore.getState();
    expect(state.notFound).toBe(true);
    expect(state.error).toContain('课程不存在');
    expect(state.rows).toEqual([]);
  });
});
