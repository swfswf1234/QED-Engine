/**
 * 学习域契约层封装用例（v1.0 三张化后的读源/写腿形状）
 * 守护五件事：生成腿超时＝180s（一次一条，不透默认 8s）；提升同步腿超时＝120s
 * （真机整课逐本取数实测 12s，默认 8s 会把跑成功的同步误报成失败）；知识点总览的 `include_outline`
 * 只在点名时带上（默认序列腿不带整树）；落笔与备注走同一枚 progress 写请求；
 * 知识点主表的列／登记／改只发被点名的键（缺席与显式 null 两件事）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANNOTATION_TIMEOUT_MS, createKnowledgePoint, generateAnnotation, getCourseKnowledge,
  getPointNarrative, KP_SYNC_TIMEOUT_MS, listKnowledgePoints, patchKnowledgePoint,
  setLearnProgress, syncCourseKnowledge,
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

  it('同步腿 POST 到本课的 knowledge-points/sync（页头「刷新」的第一步）', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ course_id: 'ma', books: [], totals: { chapters: {}, points: {} } }));
    await syncCourseKnowledge('ma');
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/learn/courses/ma/knowledge-points/sync`);
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
  });

  it('同步腿按 120s 超时：整课逐本取数真机 12s，默认 8s 会把跑通的同步误报成失败', async () => {
    vi.useFakeTimers();
    mockFetch.mockImplementation((_url: string, init?: { signal?: AbortSignal }) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    let caught: unknown = null;
    const pending = syncCourseKnowledge('ma').catch((err) => { caught = err; });
    await vi.advanceTimersByTimeAsync(KP_SYNC_TIMEOUT_MS - 1);
    expect(caught).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).kind).toBe('timeout');
    expect((caught as ApiError).message).toContain(`${KP_SYNC_TIMEOUT_MS}ms`);
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

/**
 * 知识点主表三条面（REQ-141 批次 F・W3）：梳理屏的列点／直登记／改列全部打根侧自有面，
 * 七条 `af_kp` 透传面属批次 B，本批一条都不消费。
 */
describe('知识点主表面（列／登记／改）', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('检索面只带点名的过滤位，数字参数转字符串', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ points: [], total: 0 }));
    await listKnowledgePoints({ course: 'ma', q: '一致收敛', limit: 200 });
    expect(mockFetch.mock.calls[0][0]).toBe(
      `${API_BASE}/learn/knowledge-points?course=ma&q=%E4%B8%80%E8%87%B4%E6%94%B6%E6%95%9B&limit=200`,
    );
    await listKnowledgePoints({});
    expect(mockFetch.mock.calls[1][0]).toBe(`${API_BASE}/learn/knowledge-points`);
  });

  it('直登记 POST 主表面并回显整行（写入本表这一动作即承载确认）', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ kp_id: 'p9', name: '确界原理', node_kind: 'point' }));
    const out = await createKnowledgePoint({
      course_id: 'ma', name: '确界原理', parent_kp_id: 'c1', type: 'concept',
      narrative_ref: 'parsed/b07/kp/p9.md', anchors: [{ kind: 'page_block', ref_id: 'b07', page: 42 }],
    });
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/learn/knowledge-points`);
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body))).toEqual({
      course_id: 'ma', name: '确界原理', parent_kp_id: 'c1', type: 'concept',
      narrative_ref: 'parsed/b07/kp/p9.md', anchors: [{ kind: 'page_block', ref_id: 'b07', page: 42 }],
    });
    expect(out.kp_id).toBe('p9');
  });

  it('直登记缺席的键不出现（type/parent 留空＝未归档池，不写成空串）', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ kp_id: 'p10', name: '闭区间套', node_kind: 'point' }));
    await createKnowledgePoint({ course_id: 'ma', name: '闭区间套' });
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body))).toEqual({ course_id: 'ma', name: '闭区间套' });
  });

  it('改列只发出被改的键；显式 null 的 parent_kp_id 原样送出（＝退未归档池）', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ kp_id: 'p9', name: '改过的名', node_kind: 'point' }));
    await patchKnowledgePoint('p9', { name: '改过的名' });
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/learn/knowledge-points/p9`);
    expect(mockFetch.mock.calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body))).toEqual({ name: '改过的名' });
    await patchKnowledgePoint('p9', { parent_kp_id: null, summary: '' });
    expect(JSON.parse(String(mockFetch.mock.calls[1][1].body))).toEqual({ parent_kp_id: null, summary: '' });
  });
});
