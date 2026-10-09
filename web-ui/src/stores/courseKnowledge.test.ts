import { describe, it, expect, beforeEach } from 'vitest';
import { useCourseKnowledgeStore } from './courseKnowledge';
import { mockFetch } from '../test/setup';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

const OVERVIEW = {
  course: { course_id: 'ma', name: '数学分析', track: '分析学', domain_id: 'math' },
  points: [
    {
      kp_id: 'kp-1', course_id: 'ma', name: '确界的极限唯一性', norm_key: '确界的极限唯一性',
      type: 'concept', summary: '闭区间上连续函数 attain 最值', confirmed: true, anchors: [],
      candidates: [{ detail_id: 'd1', name: '确界的极限唯一性', type: 'concept', narrative: '另一版叙述', payload: {}, anchors: [], gen_batch: 'b1', model_ref: '', gen_status: 'candidate' }],
    },
  ],
  total: 1,
  candidate_total: 3,
};

const POOL = {
  details: [
    { detail_id: 'd1', course_id: 'ma', name: '确界的极限唯一性', norm_key: '确界的极限唯一性', type: 'concept', narrative: '另一版叙述', payload: {}, anchors: [], gen_batch: 'b1', model_ref: '', gen_status: 'candidate', kp_id: null, dedup_of: null, map_seed: null, domain_id: 'math', domain_label: '数学', course_label: '数学分析', confirmed: 0, created_at: '', updated_at: '' },
    { detail_id: 'd2', course_id: 'ma', name: '闭区间套定理', norm_key: '闭区间套定理', type: 'procedure', narrative: '嵌套闭区间列交非空', payload: {}, anchors: [], gen_batch: 'b1', model_ref: '', gen_status: 'draft', kp_id: null, dedup_of: null, map_seed: null, domain_id: 'math', domain_label: '数学', course_label: '数学分析', confirmed: 0, created_at: '', updated_at: '' },
    { detail_id: 'd3', course_id: 'ma', name: '已采纳项', norm_key: '已采纳项', type: null, narrative: '', payload: {}, anchors: [], gen_batch: 'b1', model_ref: '', gen_status: 'adopted', kp_id: 'kp-1', dedup_of: null, map_seed: null, domain_id: 'math', domain_label: '数学', course_label: '数学分析', confirmed: 1, created_at: '', updated_at: '' },
    { detail_id: 'd4', course_id: 'ma', name: '已驳回项', norm_key: '已驳回项', type: null, narrative: '', payload: {}, anchors: [], gen_batch: 'b1', model_ref: '', gen_status: 'rejected', kp_id: null, dedup_of: null, map_seed: null, domain_id: 'math', domain_label: '数学', course_label: '数学分析', confirmed: 0, created_at: '', updated_at: '' },
  ],
  total: 4,
};

/** 读接口固定应答；写接口按 url 分派 */
function routeReads() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/knowledge-points')) return jsonResponse(OVERVIEW);
    if (url.includes('/kp-details')) return jsonResponse(POOL);
    return Promise.reject(new TypeError(`no route: ${url}`));
  });
}

describe('课程知识点 store（courseKnowledge：候选池 → 确认提升）', () => {
  beforeEach(() => {
    useCourseKnowledgeStore.setState({
      courseId: null, course: null, points: [], loose: [], candidateTotal: 0, loading: false, error: null, notice: null,
    });
    mockFetch.mockReset();
  });

  it('待选池只留未归入已确认的开放叙述（adopted/rejected 与同 norm_key 不进）', async () => {
    routeReads();
    await useCourseKnowledgeStore.getState().fetchCourse('ma');
    const state = useCourseKnowledgeStore.getState();
    expect(state.course?.name).toBe('数学分析');
    expect(state.points).toHaveLength(1);
    expect(state.points[0].candidates).toHaveLength(1);
    expect(state.loose.map((c) => c.detailId)).toEqual(['d2']);
    expect(state.candidateTotal).toBe(3);
    expect(state.loading).toBe(false);
  });

  it('确认成功 → 回执带知识点名并重取课程', async () => {
    routeReads();
    await useCourseKnowledgeStore.getState().fetchCourse('ma');
    mockFetch.mockImplementation((url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') return jsonResponse({ point: { kp_id: 'kp-9', name: '闭区间套定理' } });
      if (url.includes('/knowledge-points')) return jsonResponse(OVERVIEW);
      return jsonResponse(POOL);
    });
    await useCourseKnowledgeStore.getState().confirmCandidate('d2');
    expect(mockFetch.mock.calls.some((c) => String(c[0]).endsWith('/learn/kp-details/d2/confirm'))).toBe(true);
    expect(useCourseKnowledgeStore.getState().notice).toBe('已确认并提升：闭区间套定理');
    // 确认后重取课程（两次读接口）
    expect(mockFetch.mock.calls.filter((c) => String(c[0]).includes('/knowledge-points')).length).toBeGreaterThanOrEqual(2);
  });

  it('确认重复 norm_key → 409 文案进 notice，不抛错', async () => {
    routeReads();
    await useCourseKnowledgeStore.getState().fetchCourse('ma');
    mockFetch.mockImplementation((url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') {
        return jsonResponse({ detail: '该课程下同名知识点已存在（norm_key=x），请走合并' }, 409);
      }
      if (url.includes('/knowledge-points')) return jsonResponse(OVERVIEW);
      return jsonResponse(POOL);
    });
    await useCourseKnowledgeStore.getState().confirmCandidate('d2');
    expect(useCourseKnowledgeStore.getState().notice).toContain('已存在');
    expect(useCourseKnowledgeStore.getState().notice).toContain('状态冲突');
  });

  it('驳回 → 回执提示并重取', async () => {
    routeReads();
    await useCourseKnowledgeStore.getState().fetchCourse('ma');
    mockFetch.mockImplementation((url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') return jsonResponse({ detail: { detail_id: 'd2', gen_status: 'rejected' } });
      if (url.includes('/knowledge-points')) return jsonResponse(OVERVIEW);
      return jsonResponse(POOL);
    });
    await useCourseKnowledgeStore.getState().rejectCandidate('d2');
    expect(useCourseKnowledgeStore.getState().notice).toContain('已驳回');
  });

  it('手工登记候选 → POST 体带课程与 demo 批次，成功返回 true', async () => {
    routeReads();
    await useCourseKnowledgeStore.getState().fetchCourse('ma');
    let posted: Record<string, unknown> = {};
    mockFetch.mockImplementation((_url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'POST') {
        posted = JSON.parse(String(init.body));
        return jsonResponse({ detail_id: 'd9', gen_status: 'candidate' });
      }
      if (_url.includes('/knowledge-points')) return jsonResponse(OVERVIEW);
      return jsonResponse(POOL);
    });
    const ok = await useCourseKnowledgeStore.getState().addCandidate({ name: '致密性', type: 'memory', narrative: '有理数稠密' });
    expect(ok).toBe(true);
    expect(posted).toMatchObject({ course_id: 'ma', name: '致密性', type: 'memory', narrative: '有理数稠密', gen_batch: 'manual-demo' });
    expect(useCourseKnowledgeStore.getState().notice).toContain('候选已登记');
  });

  it('存储未接入（503）→ error 文案，页面可重试', async () => {
    // 并发两个请求共用同一 Response 实例会二次读流失败，必须每次新建
    mockFetch.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ detail: '知识点存储未接入（数据库不可达或未配置）' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    await useCourseKnowledgeStore.getState().fetchCourse('ma');
    const state = useCourseKnowledgeStore.getState();
    expect(state.error).toContain('服务暂不可用');
    expect(state.error).toContain('知识点存储未接入');
    expect(state.points).toEqual([]);
  });
});
