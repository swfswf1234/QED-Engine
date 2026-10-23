import { describe, it, expect, beforeEach } from 'vitest';
import { currentDomain, useStarMapStore } from './starMap';
import { mockFetch } from '../test/setup';
import type { StarMapResponse } from '../api/learn';

const MATH: StarMapResponse['domains'][number] = {
  domain_id: 'math',
  name: '数学',
  level: '本科',
  tracks: [
    {
      track: '分析学',
      kind: 'main',
      summary: '',
      courses: [
        { course_id: 'ma', name: '数学分析', track: '分析学', stage: '', sort_order: 1, kp_confirmed: 0 },
      ],
    },
  ],
};

const CS: StarMapResponse['domains'][number] = {
  domain_id: 'cs',
  name: '计算机科学',
  level: '本科',
  tracks: [
    {
      track: 'AI',
      kind: 'main',
      summary: '',
      courses: [
        { course_id: 'ml', name: '机器学习', track: 'AI', stage: '', sort_order: 1, kp_confirmed: 3 },
      ],
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

describe('知识星图 store（starMap）', () => {
  beforeEach(() => {
    useStarMapStore.setState({ domains: [], edges: [], domainId: '', loading: false, error: null });
    mockFetch.mockReset();
  });

  it('首次拉取默认选中第一个领域', async () => {
    mockFetch.mockReturnValue(jsonResponse({ domains: [MATH, CS], edges: [] }));
    await useStarMapStore.getState().fetchStarMap();
    const state = useStarMapStore.getState();
    expect(state.domainId).toBe('math');
    expect(currentDomain(state)?.name).toBe('数学');
    expect(state.error).toBeNull();
  });

  it('星图一次取全域：请求不带 domain 参数（切换领域本地过滤）', async () => {
    mockFetch.mockReturnValue(jsonResponse({ domains: [MATH, CS], edges: [] }));
    await useStarMapStore.getState().fetchStarMap();
    useStarMapStore.getState().selectDomain('cs');
    expect(currentDomain(useStarMapStore.getState())?.name).toBe('计算机科学');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0][0])).not.toContain('domain=');
  });

  it('重取保持已选领域；领域消失回落第一个', async () => {
    mockFetch.mockReturnValue(jsonResponse({ domains: [MATH, CS], edges: [] }));
    await useStarMapStore.getState().fetchStarMap();
    useStarMapStore.getState().selectDomain('cs');
    await useStarMapStore.getState().fetchStarMap();
    expect(useStarMapStore.getState().domainId).toBe('cs');

    mockFetch.mockReturnValue(jsonResponse({ domains: [MATH], edges: [] }));
    await useStarMapStore.getState().fetchStarMap();
    expect(useStarMapStore.getState().domainId).toBe('math');
  });

  it('503 → error 文案落 store（页面降级提示，不抛错）', async () => {
    mockFetch.mockReturnValue(jsonResponse({ detail: '课程目录不可达：boom' }, 503));
    await useStarMapStore.getState().fetchStarMap();
    const state = useStarMapStore.getState();
    expect(state.error).toContain('课程目录不可达');
    expect(state.domains).toEqual([]);
    expect(state.loading).toBe(false);
  });
});
