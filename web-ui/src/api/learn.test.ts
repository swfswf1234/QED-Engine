/**
 * 学习域契约层封装用例（v1.0 三张化后的读源/写腿形状）
 * 守护三件事：生成腿超时＝180s（一次一条，不透默认 8s）；知识点总览的 `include_outline`
 * 只在点名时带上（默认序列腿不带整树）；落笔与备注走同一枚 progress 写请求。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANNOTATION_TIMEOUT_MS, generateAnnotation, getCourseKnowledge, getPointNarrative, setLearnProgress,
} from './learn';
import { ApiError, API_BASE } from './client';
import { mockFetch } from '../test/setup';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

describe('学习域端点封装（生成超时口径＋读源改道＋落笔写腿）', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('生成腿按 180s 超时：默认 8s 不误伤慢生成', async () => {
    vi.useFakeTimers();
    mockFetch.mockImplementation((_url: string, init?: { signal?: AbortSignal }) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    let caught: unknown = null;
    const pending = generateAnnotation({
      course_id: 'lc-ma', target_kind: 'point', kp_id: 'p1', part: 'annotation',
    }).catch((err) => { caught = err; });
    await vi.advanceTimersByTimeAsync(ANNOTATION_TIMEOUT_MS - 1);
    expect(caught).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).kind).toBe('timeout');
    expect((caught as ApiError).message).toContain(`${ANNOTATION_TIMEOUT_MS}ms`);
  });

  it('生成腿 POST 到根侧注解端点并带回章行成品位', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ ok: true, target: { kind: 'chapter', kp_id: 'c1', name: '第1章 实数' }, chapter: { kp_id: 'c1', summary: '总结', key_points: ['要点'] } }));
    const out = await generateAnnotation({ course_id: 'lc-ma', target_kind: 'chapter', kp_id: 'c1', part: 'key_points' });
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body))).toEqual({
      course_id: 'lc-ma', target_kind: 'chapter', kp_id: 'c1', part: 'key_points',
    });
    expect(mockFetch.mock.calls[0][0]).toContain('/learn/annotations/generate');
    expect(out.chapter?.key_points).toEqual(['要点']);
  });

  it('条级生成腿带回追加 angles 后的主表整行', async () => {
    mockFetch.mockImplementation(() => jsonResponse({
      ok: true,
      target: { kind: 'point', kp_id: 'p1', name: '确界原理' },
      point: { kp_id: 'p1', name: '确界原理', node_kind: 'point', angles: [{ angle: 'summary', note: '本条总结' }] },
    }));
    const out = await generateAnnotation({ course_id: 'lc-ma', target_kind: 'point', kp_id: 'p1', part: 'annotation' });
    expect(out.point?.angles).toEqual([{ angle: 'summary', note: '本条总结' }]);
  });

  it('知识点总览默认不带整树，点名才带 include_outline=true', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ course: {}, points: [], total: 0, sequence: { enrolled: false, units: [], chapters: [], kp_path: [] } }));
    await getCourseKnowledge('ma');
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/learn/courses/ma/knowledge-points`);
    await getCourseKnowledge('ma', true);
    expect(mockFetch.mock.calls[1][0]).toBe(`${API_BASE}/learn/courses/ma/knowledge-points?include_outline=true`);
  });

  it('长文按 narrative_ref 走独立读腿，指针悬空也由服务端给 reason', async () => {
    mockFetch.mockImplementation(() => jsonResponse({
      kp_id: 'p1', narrative_ref: 'knowledge/p1.md', available: false, content: '', reason: '正文文件不存在',
    }));
    const out = await getPointNarrative('p1');
    expect(mockFetch.mock.calls[0][0]).toContain('/learn/knowledge-points/p1/narrative');
    expect(out.available).toBe(false);
    expect(out.reason).toBe('正文文件不存在');
  });

  it('落笔与备注同请求：note 只在写了时才带上', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ kp_id: 'p1', status: 'done', derived: {} }));
    await setLearnProgress('lc-ma', { kp_id: 'p1', status: 'done' });
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body))).toEqual({ kp_id: 'p1', status: 'done' });
    await setLearnProgress('lc-ma', { kp_id: 'p1', status: 'done', note: '一句话理解' });
    expect(JSON.parse(String(mockFetch.mock.calls[1][1].body))).toEqual({
      kp_id: 'p1', status: 'done', note: '一句话理解',
    });
    expect(mockFetch.mock.calls[1][0]).toContain('/learn/courses/lc-ma/progress');
  });
});
