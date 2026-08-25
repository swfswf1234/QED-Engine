/**
 * 探索 store 测试（exploration-api 冻结契约 + exploration-ui 设计正文）
 * - 纯 selector：上限/锁定/颜色状态计算（≤4、≥2 锁定规则）
 * - 流程：launch → 轮询 → ready → adopt/discard → 终态；连续 3 次轮询失败转本地 failed
 * - mock 开关：localStorage qed-explore-mock=1 时走本地模拟（QED-Tracker 未就绪留白）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EXPLORE_MAX_TUTORIALS, EXPLORE_MIN_CONFIRMED, POLL_INTERVAL_MS, MAX_POLL_FAILURES,
  exploreStatusOf, remainingSlots, isCourseLocked, isExploreMockEnabled,
  useExploreStore,
} from './explore';
import { mockFetch } from '../test/setup';
import type { ExploreProposal } from './index';

describe('上限与颜色 selector（2026-08-23 用户裁决 D）', () => {
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

  it('remainingSlots = 4 − 现有教程数，不为负', () => {
    expect(remainingSlots(0)).toBe(4);
    expect(remainingSlots(3)).toBe(1);
    expect(remainingSlots(4)).toBe(0);
    expect(remainingSlots(6)).toBe(0);
  });

  it('isCourseLocked：教程≥4 或 完成≥2 均锁定', () => {
    expect(isCourseLocked(4, 0)).toBe(true);
    expect(isCourseLocked(2, 2)).toBe(true);
    expect(isCourseLocked(3, 1)).toBe(false);
  });
});

describe('mock 开关', () => {
  it('localStorage qed-explore-mock=1 时启用', () => {
    localStorage.setItem('qed-explore-mock', '1');
    expect(isExploreMockEnabled()).toBe(true);
    localStorage.setItem('qed-explore-mock', '0');
    expect(isExploreMockEnabled()).toBe(false);
    localStorage.removeItem('qed-explore-mock');
    expect(isExploreMockEnabled()).toBe(false);
  });
});

function proposal(id: string, setName: string): ExploreProposal {
  return {
    proposal_id: id,
    set_name: setName,
    textbook: { title: `教材 ${setName}`, authors: ['某人'], version: { edition: '中译本' }, intro: '……' },
    exercise: { title: `习题集 ${setName}`, version: null, intro: '……' },
    reason: '推荐理由',
  };
}

function runningRun() {
  return {
    run_id: 'exp_t', scope: 'course' as const, course_id: '01_math_analysis',
    status: 'running' as const, params: { mode: 'direct' as const },
    proposals: [], adopted_proposal_ids: [], error: null,
    created_at: '2026-08-23T10:00:00', updated_at: '2026-08-23T10:00:00',
  };
}

function readyRun() {
  return {
    ...runningRun(), status: 'ready' as const,
    proposals: [proposal('pp_1', '套一'), proposal('pp_2', '套二'), proposal('pp_3', '套三')],
    updated_at: '2026-08-23T10:01:00',
  };
}

describe('课程层流程（真实 API 路径）', () => {
  beforeEach(() => {
    localStorage.removeItem('qed-explore-mock');
    useExploreStore.getState().reset();
  });

  it('startCourse 置 running 并启动轮询；ready 后停止轮询', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ run_id: 'exp_t', task_id: 'tk', status: 'running' }), { status: 202 }))
      .mockResolvedValue(new Response(JSON.stringify(readyRun())));
    await useExploreStore.getState().startCourse('01_math_analysis', { mode: 'direct' });
    expect(useExploreStore.getState().run?.status).toBe('running');

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(useExploreStore.getState().run?.status).toBe('ready');
    expect((useExploreStore.getState().run as import('./index').ExploreRun).proposals).toHaveLength(3);

    // ready 后不再轮询：时间推进不产生新请求
    const calls = mockFetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(mockFetch.mock.calls.length).toBe(calls);
  });

  it('adopt 提交勾选并更新运行态为 adopted', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ run_id: 'exp_t', task_id: 'tk', status: 'running' }), { status: 202 }))
      .mockResolvedValue(new Response(JSON.stringify(readyRun())));
    await useExploreStore.getState().startCourse('01_math_analysis', { mode: 'direct' });
    await useExploreStore.getState().refresh();

    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      adopted: [{ knowledge_id: 'kn_1', set_name: '套一' }], remaining_slots: 2,
      run: { ...readyRun(), status: 'adopted', adopted_proposal_ids: ['pp_1'] },
    })));
    const result = await useExploreStore.getState().adopt(['pp_1']);
    expect(result?.adopted[0].knowledge_id).toBe('kn_1');
    expect(useExploreStore.getState().run?.status).toBe('adopted');
    expect((useExploreStore.getState().run as import('./index').ExploreRun).adopted_proposal_ids).toEqual(['pp_1']);
  });

  it('discard 后运行态 discarded，不产生数据行', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ run_id: 'exp_t', task_id: 'tk', status: 'running' }), { status: 202 }))
      .mockResolvedValue(new Response(JSON.stringify(runningRun())));
    await useExploreStore.getState().startCourse('c1', { mode: 'direct' });
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ...runningRun(), status: 'discarded' })));
    await useExploreStore.getState().discard();
    expect(useExploreStore.getState().run?.status).toBe('discarded');
  });

  it('连续 3 次轮询失败 → 本地转 failed 并停止轮询（保留 run_id 供恢复）', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ run_id: 'exp_t', task_id: 'tk', status: 'running' }), { status: 202 }))
      .mockResolvedValue(new Response(JSON.stringify(readyRun())));
    await useExploreStore.getState().startCourse('c1', { mode: 'direct' });

    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    await useExploreStore.getState().refresh();
    await useExploreStore.getState().refresh();
    expect(useExploreStore.getState().run?.status).toBe('running');
    await useExploreStore.getState().refresh();
    expect(useExploreStore.getState().run?.status).toBe('failed');
    expect(useExploreStore.getState().error).toContain('轮询');
    expect(useExploreStore.getState().run?.run_id).toBe('exp_t');
  });

  it('8901 不可达时启动失败 → error 横幅文案', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    await useExploreStore.getState().startCourse('c1', { mode: 'direct' });
    expect(useExploreStore.getState().error).toBeTruthy();
    expect(useExploreStore.getState().launching).toBe(false);
  });
});

describe('领域探索流程（§6~§7）', () => {
  beforeEach(() => {
    localStorage.removeItem('qed-explore-mock');
    useExploreStore.getState().reset();
  });

  it('startCurriculum → apply 成功转 applied；部分冲突转 partially_applied', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ run_id: 'cur_1', task_id: 'tk', status: 'running' }), { status: 202 }))
      .mockResolvedValue(new Response(JSON.stringify({
        run_id: 'cur_1', scope: 'curriculum', status: 'ready',
        params: { domain_name: '高等数学', mode: 'direct' },
        proposals: [
          { change_id: 'ch_0', action: 'create_domain', entity: 'domain', target_id: 'math', payload: { name: '高等数学' }, reason: '' },
          { change_id: 'ch_1', action: 'create_course', entity: 'course', target_id: 'cs_new', payload: { name: '新课程' }, reason: '' },
        ],
        adopted_proposal_ids: [], conflicts: [], error: null,
        created_at: '', updated_at: '',
      })));
    await useExploreStore.getState().startCurriculum('高等数学', { mode: 'direct' });
    await useExploreStore.getState().refresh();

    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      applied: [{ change_id: 'ch_0', entity: 'domain', target_id: 'math' }],
      conflicts: [{ change_id: 'ch_1', reason: '课程已存在' }],
      skipped: [{ change_id: 'ch_0', reason: '领域已存在：高等数学' }],
      run: { run_id: 'cur_1', scope: 'curriculum', status: 'partially_applied' },
    })));
    const result = await useExploreStore.getState().applyChanges(['ch_0', 'ch_1']);
    expect(result?.conflicts).toHaveLength(1);
    // REQ-059：重探语义 skipped 清单透传（已存在领域不重复创建）
    expect(result?.skipped).toHaveLength(1);
    expect(result?.skipped?.[0].reason).toBe('领域已存在：高等数学');
    expect(useExploreStore.getState().run?.status).toBe('partially_applied');
  });

  it('openRun 按 run_id 恢复查看历史运行', async () => {
    localStorage.setItem('qed-explore-mock', '1');
    await useExploreStore.getState().startCourse('01_math_analysis', { mode: 'direct' });
    const runId = useExploreStore.getState().run!.run_id;
    // 模拟「页面离开后本地运行态清空，但服务端/模拟注册表记录仍在」
    useExploreStore.setState({ run: null });
    await useExploreStore.getState().openRun(runId);
    expect(useExploreStore.getState().run?.run_id).toBe(runId);
    localStorage.removeItem('qed-explore-mock');
  });
});

describe('mock 模式全流程（QED-Tracker 未就绪留白）', () => {
  beforeEach(() => {
    localStorage.setItem('qed-explore-mock', '1');
    useExploreStore.getState().reset();
  });
  afterEach(() => localStorage.removeItem('qed-explore-mock'));

  it('mock 启动后按节拍自动 ready，无需网络（fetch 零调用）', async () => {
    vi.useFakeTimers();
    await useExploreStore.getState().startCourse('01_math_analysis', { mode: 'text', ref_text: '偏好 Rudin' });
    expect(mockFetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    const run = useExploreStore.getState().run as import('./index').ExploreRun;
    expect(run?.status).toBe('ready');
    expect(run?.proposals).toHaveLength(3);

    await useExploreStore.getState().adopt([run!.proposals[0].proposal_id]);
    expect(useExploreStore.getState().run?.status).toBe('adopted');
  });

  it('mock 领域探索 ready 后含 create_domain 与三门方向课', async () => {
    vi.useFakeTimers();
    await useExploreStore.getState().startCurriculum('高等数学', { mode: 'direct' });
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    const run = useExploreStore.getState().run as unknown as { status: string; proposals?: { action: string }[] };
    expect(run.status).toBe('ready');
    const actions = (run.proposals ?? []).map((c) => c.action);
    expect(actions).toContain('create_domain');
    expect(actions.filter((a) => a === 'create_course').length).toBeGreaterThanOrEqual(3);
  });
});
