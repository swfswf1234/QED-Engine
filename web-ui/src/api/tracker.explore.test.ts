/**
 * 探索端点封装测试（exploration-api 冻结契约，2026-08-23）
 * - 路径/方法/请求体逐一对齐契约 §1~§7
 * - 仅验证封装层转发，不验证业务逻辑（store 层另测）
 */
import { describe, it, expect } from 'vitest';
import {
  launchCourseExplore, fetchExploreRun, adoptExploreRun, discardExploreRun,
  listCourseExploreRuns, launchCurriculumExplore, fetchCurriculumRun, applyCurriculumRun,
} from './tracker';
import { mockFetch } from '../test/setup';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function lastCall(): { url: string; init: RequestInit } {
  expect(mockFetch.mock.calls.length).toBeGreaterThan(0);
  const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
  return { url: String(call[0]), init: (call[1] ?? {}) as RequestInit };
}

describe('课程层探索端点（§1~§5）', () => {
  it('launchCourseExplore → POST /courses/{id}/explore，body 透传 mode/ref_*', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ run_id: 'exp_1', task_id: 'tk_1', status: 'running' }, 202));
    const res = await launchCourseExplore('01_math_analysis', { mode: 'doc', ref_doc_path: 'D:/x.txt' });
    expect(res.run_id).toBe('exp_1');
    const { url, init } = lastCall();
    expect(url).toContain('/api/v1/courses/01_math_analysis/explore');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ mode: 'doc', ref_doc_path: 'D:/x.txt' });
  });

  it('fetchExploreRun → GET /explore-runs/{run_id}', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ run_id: 'exp_9', status: 'ready', proposals: [] }));
    const res = await fetchExploreRun('exp_9');
    expect(res.status).toBe('ready');
    const { url, init } = lastCall();
    expect(url).toContain('/api/v1/explore-runs/exp_9');
    expect(init.method).toBe('GET');
  });

  it('adoptExploreRun → POST /explore-runs/{id}/adopt，body={selected}', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ adopted: [], remaining_slots: 2, run: { status: 'adopted' } }));
    const res = await adoptExploreRun('exp_9', ['pp_a', 'pp_b']);
    expect(res.remaining_slots).toBe(2);
    const { url, init } = lastCall();
    expect(url).toContain('/api/v1/explore-runs/exp_9/adopt');
    expect(JSON.parse(String(init.body))).toEqual({ selected: ['pp_a', 'pp_b'] });
  });

  it('discardExploreRun → POST /explore-runs/{id}/discard 无请求体', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ run_id: 'exp_9', status: 'discarded' }));
    const res = await discardExploreRun('exp_9');
    expect(res.status).toBe('discarded');
    const { url, init } = lastCall();
    expect(url).toContain('/api/v1/explore-runs/exp_9/discard');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('listCourseExploreRuns → GET /courses/{id}/explore-runs?limit=&offset=', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await listCourseExploreRuns('01_math_analysis', { limit: 5, offset: 10 });
    const { url } = lastCall();
    expect(url).toContain('/api/v1/courses/01_math_analysis/explore-runs');
    expect(url).toContain('limit=5');
    expect(url).toContain('offset=10');
  });

  it('listCourseExploreRuns 不传分页时不带 query', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await listCourseExploreRuns('c1');
    const { url } = lastCall();
    expect(url.endsWith('/api/v1/courses/c1/explore-runs')).toBe(true);
  });
});

describe('新建领域探索端点（§6~§7）', () => {
  it('launchCurriculumExplore → POST /curriculum-explore，body 含 domain_name', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ run_id: 'cur_1', task_id: 'tk_2', status: 'running' }, 202));
    const res = await launchCurriculumExplore({ domain_name: '高等数学', mode: 'doc', ref_doc_path: 'D:/高等数学探索.txt' });
    expect(res.run_id).toBe('cur_1');
    const { url, init } = lastCall();
    expect(url).toContain('/api/v1/curriculum-explore');
    expect(JSON.parse(String(init.body))).toEqual({
      domain_name: '高等数学', mode: 'doc', ref_doc_path: 'D:/高等数学探索.txt',
    });
  });

  it('fetchCurriculumRun → GET /curriculum-runs/{run_id}', async () => {
    // 服务端真实形状：proposals/adopted_proposal_ids（2026-08-24 字段名对齐修复）
    mockFetch.mockResolvedValueOnce(jsonResponse({ run_id: 'cur_1', status: 'ready', proposals: [], adopted_proposal_ids: [] }));
    const res = await fetchCurriculumRun('cur_1');
    expect(res.status).toBe('ready');
    const { url } = lastCall();
    expect(url).toContain('/api/v1/curriculum-runs/cur_1');
  });

  it('applyCurriculumRun → POST /curriculum-runs/{id}/apply，body={selected}', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ applied: [], conflicts: [], run: { status: 'applied' } }));
    const res = await applyCurriculumRun('cur_1', ['ch_01']);
    expect(res.run.status).toBe('applied');
    const { url, init } = lastCall();
    expect(url).toContain('/api/v1/curriculum-runs/cur_1/apply');
    expect(JSON.parse(String(init.body))).toEqual({ selected: ['ch_01'] });
  });
});
