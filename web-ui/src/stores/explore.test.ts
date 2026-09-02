/**
 * 探索 store 测试（PLAN-022 F2 会话模型，2026-08-28；旧 run_id 轮询契约已废弃）
 * - 纯 selector：上限/锁定/颜色状态计算（≤4、≥2 锁定规则）
 * - 流程：startCourse → 轮询 → ready → apply → applied；名称确认重跑；放弃清理
 * - 自愈：404 清持久化；连续 3 次轮询失败本地转 failed 并停轮询
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  EXPLORE_MAX_TUTORIALS, EXPLORE_MIN_CONFIRMED, POLL_INTERVAL_MS, MAX_POLL_FAILURES,
  exploreStatusOf, remainingSlots, isCourseLocked, asCourseTutorials, asDomainReport,
  useExploreStore,
} from './explore';
import { mockFetch } from '../test/setup';
import type { ExploreSessionRecord } from './index';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function courseSession(overrides: Partial<ExploreSessionRecord> = {}): ExploreSessionRecord {
  return {
    session_id: 'es_t', target: 'course', status: 'running',
    domain_name: '', domain_id: '', course_id: '01_math_analysis', mode: 'direct',
    report: null, name_check: null, error: null, steps: [],
    ...overrides,
  };
}

describe('上限与颜色 selector（用户裁决 D）', () => {
  it('常量：上限 4 套 / 达标 2 套 / 轮询 3s / 连续失败 3 次', () => {
    expect(EXPLORE_MAX_TUTORIALS).toBe(4);
    expect(EXPLORE_MIN_CONFIRMED).toBe(2);
    expect(POLL_INTERVAL_MS).toBe(3000);
    expect(MAX_POLL_FAILURES).toBe(3);
  });

  it('exploreStatusOf：0 教程=未探索(none)；有教程但完成<2=不足(insufficient)；完成≥2=达标(ready)', () => {
    expect(exploreStatusOf(0, 0)).toBe('none');
    expect(exploreStatusOf(3, 0)).toBe('insufficient');
    expect(exploreStatusOf(3, 1)).toBe('insufficient');
    expect(exploreStatusOf(4, 2)).toBe('ready');
    expect(exploreStatusOf(2, 2)).toBe('ready');
  });

  it('remainingSlots：4−现有不为负', () => {
    expect(remainingSlots(0)).toBe(4);
    expect(remainingSlots(3)).toBe(1);
    expect(remainingSlots(6)).toBe(0);
  });

  it('isCourseLocked：满 4 或完成≥2 锁定', () => {
    expect(isCourseLocked(4, 0)).toBe(true);
    expect(isCourseLocked(0, 2)).toBe(true);
    expect(isCourseLocked(3, 1)).toBe(false);
  });
});

describe('report 收敛 selector', () => {
  it('asCourseTutorials：course 报告返回 tutorials；其他为空', () => {
    const s = courseSession({
      status: 'ready',
      report: { course: { course_id: 'c1', name: 'x' }, tutorials: [{ proposal_id: 'pp_1', set_name: '套一', textbook: { title: 'T' } }] },
    });
    expect(asCourseTutorials(s)).toHaveLength(1);
    expect(asDomainReport(s)).toBeNull();
    expect(asCourseTutorials(courseSession())).toEqual([]);
  });

  it('asDomainReport：domain 报告返回 report；其他为空', () => {
    const s = courseSession({
      target: 'domain', status: 'ready',
      report: { domain: { final_name: 'X', description: '', level: '', classic_tracks: [], entry_requirements: null }, courses: [], path: { notes: '', edges: [], graph_td: '' } },
    });
    expect(asDomainReport(s)?.domain.final_name).toBe('X');
    expect(asCourseTutorials(s)).toEqual([]);
  });
});

describe('会话流程（startCourse → ready → apply）', () => {
  beforeEach(() => {
    localStorage.removeItem('qed-explore-run');
    useExploreStore.getState().reset();
  });

  it('startCourse → POST /explore-sessions → 轮询 ready', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(courseSession(), 202))
      .mockResolvedValue(jsonResponse(courseSession({
        status: 'ready',
        report: { course: { course_id: '01_math_analysis', name: 'x' }, tutorials: [] },
      })));
    await useExploreStore.getState().startCourse('01_math_analysis', { mode: 'direct' });
    expect(useExploreStore.getState().session?.session_id).toBe('es_t');
    await useExploreStore.getState().refresh();
    expect(useExploreStore.getState().session?.status).toBe('ready');
  });

  it('ready 后 apply 选中套 → applied 标记 + 结果持有', async () => {
    const tutorials = [{ proposal_id: 'pp_1', set_no: '1', set_name: '套一', textbook: { title: 'T' } }];
    mockFetch
      .mockResolvedValueOnce(jsonResponse(courseSession(), 202))
      .mockResolvedValueOnce(jsonResponse(courseSession({
        status: 'ready',
        report: { course: { course_id: '01_math_analysis', name: 'x' }, tutorials },
      })))
      .mockResolvedValueOnce(jsonResponse({ applied: [{ knowledge_id: 'kn_1', set_name: '套一' }], conflicts: [] }));
    await useExploreStore.getState().startCourse('01_math_analysis', { mode: 'direct' });
    await useExploreStore.getState().refresh();
    const result = await useExploreStore.getState().apply(tutorials);
    expect(result?.applied[0].knowledge_id).toBe('kn_1');
    expect(useExploreStore.getState().applied).toBe(true);
    expect(useExploreStore.getState().applyResult?.applied).toHaveLength(1);
  });

  it('waiting_name_confirm → confirmName 重跑（继续轮询）', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({
        ...courseSession({ target: 'domain', domain_name: 'AI' }), status: 'waiting_name_confirm',
        name_check: { valid: false, reason: 'r', suggested_name: '人工智能' },
      }, 202))
      .mockResolvedValueOnce(jsonResponse({
        ...courseSession({ target: 'domain', domain_name: '人工智能' }), status: 'running',
      }));
    await useExploreStore.getState().startCurriculum('AI', { mode: 'direct' });
    expect(useExploreStore.getState().session?.status).toBe('waiting_name_confirm');
    await useExploreStore.getState().confirmName('人工智能');
    expect(useExploreStore.getState().session?.domain_name).toBe('人工智能');
    expect(useExploreStore.getState().session?.status).toBe('running');
  });

  it('轮询 404 → 自愈清障（session 清空 + 持久化清除）', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(courseSession(), 202))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Not Found' }), { status: 404 }));
    await useExploreStore.getState().startCourse('01_math_analysis', { mode: 'direct' });
    await useExploreStore.getState().refresh();
    expect(useExploreStore.getState().session).toBeNull();
    expect(localStorage.getItem('qed-explore-run')).toBeNull();
  });

  it('连续 3 次轮询失败 → 本地转 failed 并停止轮询（保留 session_id）', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(courseSession(), 202))
      .mockRejectedValue(new Error('network down'));
    await useExploreStore.getState().startCourse('01_math_analysis', { mode: 'direct' });
    for (let i = 0; i < MAX_POLL_FAILURES; i += 1) {
      await useExploreStore.getState().refresh();
    }
    expect(useExploreStore.getState().session?.status).toBe('failed');
    expect(useExploreStore.getState().session?.session_id).toBe('es_t');
  });

  it('discard → DELETE 会话 + 本地清空', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(courseSession(), 202))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    await useExploreStore.getState().startCourse('01_math_analysis', { mode: 'direct' });
    await useExploreStore.getState().discard();
    expect(useExploreStore.getState().session).toBeNull();
    const last = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(String(last[0])).toContain('/api/v1/explore-sessions/es_t');
    expect((last[1] as RequestInit).method).toBe('DELETE');
  });

  it('startCurriculum 领域重探携带 domain_id → running 标记', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(
      { ...courseSession({ target: 'domain', domain_name: '数学', domain_id: 'd_math' }) }, 202,
    ));
    await useExploreStore.getState().startCurriculum('数学', { mode: 'direct' }, 'd_math');
    const body = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ target: 'domain', domain_name: '数学', domain_id: 'd_math' });
  });
});
