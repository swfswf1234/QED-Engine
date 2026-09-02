/**
 * 探索会话端点封装测试（PLAN-022 B3 契约，2026-08-28；旧 explore-runs §1~§7 已废弃）
 * - 路径/方法/请求体逐一对齐 /explore-sessions 五端点
 * - 仅验证封装层转发，不验证业务逻辑（store 层另测）
 */
import { describe, it, expect } from 'vitest';
import {
  createExploreSession, fetchExploreSession, confirmExploreSessionName,
  applyExploreSession, deleteExploreSession,
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

describe('探索会话端点（PLAN-022 B3）', () => {
  it('createExploreSession → POST /explore-sessions（202），body 透传 target/mode/ref_*', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ session_id: 'es_1', target: 'course', status: 'running' }, 202));
    const res = await createExploreSession({
      target: 'course', course_id: '01_math_analysis', mode: 'doc', ref_doc_path: 'D:/x.txt',
    });
    expect(res.session_id).toBe('es_1');
    const { url, init } = lastCall();
    expect(url).toContain('/api/v1/explore-sessions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      target: 'course', course_id: '01_math_analysis', mode: 'doc', ref_doc_path: 'D:/x.txt',
    });
  });

  it('createExploreSession 领域目标携带 domain_name/domain_id', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ session_id: 'es_2', target: 'domain', status: 'running' }, 202));
    await createExploreSession({ target: 'domain', domain_name: '计算机科学', domain_id: 'd_cs', mode: 'direct' });
    const { init } = lastCall();
    expect(JSON.parse(String(init.body))).toEqual({
      target: 'domain', domain_name: '计算机科学', domain_id: 'd_cs', mode: 'direct',
    });
  });

  it('fetchExploreSession → GET /explore-sessions/{id}（轮询）', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ session_id: 'es_9', status: 'ready', report: null }));
    const res = await fetchExploreSession('es_9');
    expect(res.status).toBe('ready');
    const { url, init } = lastCall();
    expect(url).toContain('/api/v1/explore-sessions/es_9');
    expect(init.method).toBe('GET');
  });

  it('confirmExploreSessionName → POST /explore-sessions/{id}/confirm-name，body={name_override}', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ session_id: 'es_9', status: 'running' }));
    const res = await confirmExploreSessionName('es_9', '人工智能');
    expect(res.status).toBe('running');
    const { url, init } = lastCall();
    expect(url).toContain('/api/v1/explore-sessions/es_9/confirm-name');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ name_override: '人工智能' });
  });

  it('applyExploreSession → POST /explore-sessions/{id}/apply，body={selected}', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ applied: [{ entity: 'course', target_id: 'c_1' }], conflicts: [] }));
    const res = await applyExploreSession('es_9', [{ name: '数据结构' }]);
    expect(res.applied).toHaveLength(1);
    const { url, init } = lastCall();
    expect(url).toContain('/api/v1/explore-sessions/es_9/apply');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ selected: [{ name: '数据结构' }] });
  });

  it('deleteExploreSession → DELETE /explore-sessions/{id}', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const res = await deleteExploreSession('es_9');
    expect(res.ok).toBe(true);
    const { url, init } = lastCall();
    expect(url).toContain('/api/v1/explore-sessions/es_9');
    expect(init.method).toBe('DELETE');
  });
});
