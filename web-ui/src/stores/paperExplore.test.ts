/**
 * 论文探索 store 测试（REQ-102 W4，REQ-109 I9~I10；downloads-ui.md §4.4 / downloads-flow.md §7.2）
 * - 纯派生：§7.2 五态展示徽标（探索中 > 待评审 > 失败 > 已沉淀 > 隐藏），禁读 exploration_stage
 * - 流程：start（请求体由组件侧纯函数组好，store 原样透传）→ pollOnce（completed→读报告）
 *   → adopt（202→采纳结果）
 * - 历史探索清单：loadHistory 只列本领域、失败静默；openReport 读该份详情并进段③
 * - 降级：连续 3 次轮询失败转 error 并停表
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PAPER_HISTORY_LIMIT, PAPER_MAX_POLL_FAILURES, PAPER_POLL_INTERVAL_MS,
  derivePaperRowBadge, isCandidateInStock, paperFlowPhase,
  usePaperExploreStore,
} from './paperExplore';
import { mockFetch } from '../test/setup';
import type { PaperCandidateEntry, TaskRecord } from './index';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** 按 URL 路由的 fetch mock；返回被请求过的 URL 与方法/体，供断言 */
function route(handler: (url: string, init?: RequestInit) => [number, unknown]): void {
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const [status, body] = handler(String(url), init);
    return jsonResponse(body, status);
  });
}

function requestedBodies(): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const call of mockFetch.mock.calls) {
    const url = String(call[0]);
    const init = call[1] as RequestInit | undefined;
    if (init?.method === 'POST' && typeof init.body === 'string') {
      map[url.split('/api/v1')[1] ?? url] = JSON.parse(init.body);
    }
  }
  return map;
}

function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    task_id: 't-1', type: 'paper_recommend', status: 'running', progress: 30,
    message: '规划检索计划', created_at: '2026-10-03T00:00:00Z', updated_at: '2026-10-03T00:00:01Z',
    params: { domain_id: 'math', recipe: 'frontier' }, result: null, error: '',
    ...overrides,
  };
}

function entry(rank: number, arxiv: string, title: string, overrides: Partial<PaperCandidateEntry> = {}): PaperCandidateEntry {
  return {
    rank,
    plan_index: 1,
    candidate: {
      provider: 'arxiv', provider_id: arxiv, title, authors: ['A. Author'], language: 'en',
      year: '2024', page_url: `https://arxiv.org/abs/${arxiv}`, download_url: '',
      identifiers: { arxiv }, abstract: '', published_at: '2024-01-01',
    },
    assessment: { arxiv_id: arxiv, goal_fit: 9, foundational_value: 7, readability: 6, reason: '对齐领域目标', risks: [] },
    score: 132,
    recommended: true,
    ...overrides,
  };
}

const RANKED_REPORT = {
  selection_id: 'sel-1', status: 'ranked', created_at: '2026-10-03T00:02:00Z',
  domain_id: 'math', recipe: 'frontier',
  assessments: [entry(1, '2401.00001', '论文一'), entry(2, '2401.00002', '论文二')],
  recommendations: [1, 2],
};

beforeEach(() => {
  usePaperExploreStore.getState().reset();
});

describe('常量与轮询节拍', () => {
  it('5 秒轮询 / 连续 3 次失败停表', () => {
    expect(PAPER_POLL_INTERVAL_MS).toBe(5000);
    expect(PAPER_MAX_POLL_FAILURES).toBe(3);
  });
});

describe('§7.2 论文行展示态派生', () => {
  it('无书行且无活动任务/报告 → 隐藏（空文案）', () => {
    expect(derivePaperRowBadge({ bookCount: 0 })).toEqual({ key: 'hidden', text: '' });
  });

  it('任务 queued/running → 探索中（优先于其他态）', () => {
    expect(derivePaperRowBadge({ bookCount: 3, task: task({ status: 'queued' }) }).key).toBe('running');
    expect(derivePaperRowBadge({ bookCount: 3, task: task(), selection: { status: 'ranked' } }).key).toBe('running');
    expect(derivePaperRowBadge({ bookCount: 0, task: task() })).toEqual({ key: 'running', text: '探索中' });
  });

  it('最近报告 ranked 且有候选 → 待评审（优先于失败/已沉淀）', () => {
    expect(derivePaperRowBadge({ bookCount: 5, selection: { status: 'ranked' } }))
      .toEqual({ key: 'review', text: '待评审' });
    expect(derivePaperRowBadge({ bookCount: 0, task: task({ status: 'failed' }), selection: { status: 'ranked' } }).key).toBe('review');
  });

  it('最近任务失败 → 失败；否则有书行 → 已沉淀 k 篇', () => {
    expect(derivePaperRowBadge({ bookCount: 2, task: task({ status: 'failed' }) }))
      .toEqual({ key: 'failed', text: '失败' });
    expect(derivePaperRowBadge({ bookCount: 4 })).toEqual({ key: 'sedimented', text: '已沉淀 4 篇' });
  });

  it('报告 downloading（已消费）不压过书行态', () => {
    expect(derivePaperRowBadge({ bookCount: 1, selection: { status: 'downloading' } }).key).toBe('sedimented');
    expect(derivePaperRowBadge({ bookCount: 0, selection: { status: 'no_recommendations' } }).key).toBe('hidden');
  });
});

describe('已在库去重标记（标题归一匹配）', () => {
  it('标题大小写/空白差异仍判为在库', () => {
    const stock = ['  Attention Is All You Need '.toLowerCase()];
    expect(isCandidateInStock(entry(1, '1706.03762', 'Attention is all you need'), stock)).toBe(true);
    expect(isCandidateInStock(entry(2, '2401.00001', '另一篇'), stock)).toBe(false);
  });
});

describe('弹窗阶段派生 paperFlowPhase', () => {
  it('无任务无报告=form；running 任务=running；失败=failed；有采纳结果=adopted', () => {
    expect(paperFlowPhase({ task: null, selection: null, adopted: null })).toBe('form');
    expect(paperFlowPhase({ task: task(), selection: null, adopted: null })).toBe('running');
    expect(paperFlowPhase({ task: task({ status: 'failed' }), selection: null, adopted: null })).toBe('failed');
    expect(paperFlowPhase({ task: null, selection: RANKED_REPORT, adopted: [] })).toBe('adopted');
  });

  it('I3 首屏纪律：ranked 报告在手、stage 未推进时仍是 form（段①设置）', () => {
    const base = { task: task({ status: 'completed' }), selection: RANKED_REPORT, adopted: null };
    expect(paperFlowPhase(base)).toBe('form');
    expect(paperFlowPhase({ ...base, stage: 'settings' })).toBe('form');
  });

  it('I3 段③→段④：stage=plan 进检索口径；stage=review 且 ranked 才进候选评审', () => {
    const base = { task: task({ status: 'completed' }), selection: RANKED_REPORT, adopted: null };
    expect(paperFlowPhase({ ...base, stage: 'plan' })).toBe('plan');
    expect(paperFlowPhase({ ...base, stage: 'review' })).toBe('review');
  });

  it('I3 段④只对 ranked / no_recommendations 开放；no_candidates 停在段③', () => {
    const base = { task: task({ status: 'completed' }), adopted: null };
    expect(paperFlowPhase({ ...base, selection: RANKED_REPORT, stage: 'review' })).toBe('review');
    const none = { ...RANKED_REPORT, status: 'no_recommendations' };
    expect(paperFlowPhase({ ...base, selection: none, stage: 'review' })).toBe('review');
    const empty = { ...RANKED_REPORT, status: 'no_candidates', assessments: [] };
    expect(paperFlowPhase({ ...base, selection: empty, stage: 'review' })).toBe('form');
    expect(paperFlowPhase({ ...base, selection: empty, stage: 'plan' })).toBe('plan');
  });

  it('I3 toReview 门禁：no_candidates 报告点了不动段位', () => {
    const empty = { ...RANKED_REPORT, status: 'no_candidates', assessments: [], recommendations: [] };
    usePaperExploreStore.setState({ selection: empty, stage: 'plan' });
    usePaperExploreStore.getState().toReview();
    expect(usePaperExploreStore.getState().stage).toBe('plan');
    usePaperExploreStore.setState({ selection: RANKED_REPORT });
    usePaperExploreStore.getState().toReview();
    expect(usePaperExploreStore.getState().stage).toBe('review');
  });

  it('I3「回段①调参再探」：报告留在 store，只换段位', () => {
    usePaperExploreStore.setState({ selection: RANKED_REPORT, stage: 'review' });
    usePaperExploreStore.getState().toSettings();
    const st = usePaperExploreStore.getState();
    expect(st.stage).toBe('settings');
    expect(st.selection?.selection_id).toBe(RANKED_REPORT.selection_id);
    expect(paperFlowPhase(st)).toBe('form');
  });
});

describe('发起与轮询流程', () => {
  it('start 原样透传组件组好的请求体（store 不再拼参数）并进入 running', async () => {
    route((url) => {
      if (url.includes('/papers/recommend')) return [202, { task_id: 't-9' }];
      if (url.includes('/tasks/t-9')) return [200, task({ task_id: 't-9' })];
      return [404, { detail: 'unexpected' }];
    });
    await usePaperExploreStore.getState().start({
      domain_id: 'math', recipe: 'frontier', top: 5, goal: '向量检索', categories: ['cs.IR'],
    });
    const body = requestedBodies()['/papers/recommend'] as Record<string, unknown>;
    expect(body).toEqual({ domain_id: 'math', recipe: 'frontier', top: 5, goal: '向量检索', categories: ['cs.IR'] });
    expect(usePaperExploreStore.getState().task?.task_id).toBe('t-9');
    expect(paperFlowPhase(usePaperExploreStore.getState())).toBe('running');
  });

  it('领域缺失：上游 422 结构化 detail 进 error，不发任务', async () => {
    route((url) => (url.includes('/papers/recommend')
      ? [422, { detail: { code: 'INVALID_PARAMS', message: '领域不存在：math（论文没有默认桶）' } }]
      : [404, { detail: 'unexpected' }]));
    await usePaperExploreStore.getState().start({ domain_id: 'math', recipe: 'core', top: 5 });
    const st = usePaperExploreStore.getState();
    expect(st.error).toContain('领域不存在');
    expect(st.task).toBeNull();
    expect(paperFlowPhase(st)).toBe('failed');
  });

  it('任务完成 → 读报告详情先进段③检索口径（I3）', async () => {
    route((url) => {
      if (url.includes('/tasks/t-9')) return [200, task({ task_id: 't-9', status: 'completed', progress: 100, result: { selection_id: 'sel-1' } })];
      if (url.includes('/papers/selections/sel-1')) return [200, RANKED_REPORT];
      return [404, { detail: 'unexpected' }];
    });
    usePaperExploreStore.setState({ domainId: 'math', task: task({ task_id: 't-9' }) });
    await usePaperExploreStore.getState().pollOnce();
    const st = usePaperExploreStore.getState();
    expect(st.selection?.selection_id).toBe('sel-1');
    expect(paperFlowPhase(st)).toBe('plan');
    expect(st.stage).toBe('plan');
  });

  it('进入候选评审需显式动作（唯一前进路径）', async () => {
    route((url) => (url.includes('/papers/selections/sel-1') ? [200, RANKED_REPORT] : [404, { detail: 'unexpected' }]));
    usePaperExploreStore.setState({ selection: RANKED_REPORT, stage: 'plan' });
    usePaperExploreStore.getState().toReview();
    expect(paperFlowPhase(usePaperExploreStore.getState())).toBe('review');
  });

  it('深度方向的 years_limit／limit 覆盖随请求体原样下发（R8 参数映射不在 store 拼）', async () => {
    route((url) => {
      if (url.includes('/papers/recommend')) return [202, { task_id: 't-9' }];
      if (url.includes('/tasks/t-9')) return [200, task({ task_id: 't-9' })];
      return [404, { detail: 'unexpected' }];
    });
    await usePaperExploreStore.getState().start({
      domain_id: 'math', recipe: 'core', top: 5, years_limit: 0, limit: 25,
    });
    expect(requestedBodies()['/papers/recommend'])
      .toEqual({ domain_id: 'math', recipe: 'core', top: 5, years_limit: 0, limit: 25 });
  });

  it('连续 3 次轮询失败 → 记错并停表', async () => {
    vi.useFakeTimers();
    route(() => [503, { detail: 'QED-Tracker 服务不可达' }]);
    usePaperExploreStore.setState({ domainId: 'math', task: task() });
    for (let i = 0; i < PAPER_MAX_POLL_FAILURES; i += 1) await usePaperExploreStore.getState().pollOnce();
    const st = usePaperExploreStore.getState();
    expect(st.pollFailures).toBe(PAPER_MAX_POLL_FAILURES);
    expect(st.error).toBeTruthy();
    expect(paperFlowPhase(st)).toBe('failed');
    vi.useRealTimers();
  });
});

describe('采纳流程（不自动下载）', () => {
  it('adopt 发 picks 并轮询采纳任务，结果留在 adopted 供回显', async () => {
    route((url) => {
      if (url.includes('/papers/selections/sel-1/adopt')) return [202, { task_id: 't-adopt', selection_id: 'sel-1' }];
      if (url.includes('/tasks/t-adopt')) {
        return [200, task({
          task_id: 't-adopt', type: 'paper_adopt', status: 'completed', progress: 100,
          result: { selection_id: 'sel-1', adopted: [{ rank: 1, book_id: 'math-b01', status: 'created', arxiv_id: '2401.00001' }] },
        })];
      }
      if (url.includes('/books/math-b01/fetch')) return [202, { task_id: 't-fetch' }];
      return [404, { detail: 'unexpected' }];
    });
    usePaperExploreStore.setState({ domainId: 'math', selection: RANKED_REPORT });
    await usePaperExploreStore.getState().adopt([{ rank: 1, domain_id: 'math', course_id: '' }]);
    const body = requestedBodies()['/papers/selections/sel-1/adopt'] as { picks: unknown[] };
    expect(body.picks).toEqual([{ rank: 1, domain_id: 'math', course_id: '' }]);
    const st = usePaperExploreStore.getState();
    expect(st.adopted).toEqual([{ rank: 1, book_id: 'math-b01', status: 'created', arxiv_id: '2401.00001' }]);
    expect(paperFlowPhase(st)).toBe('adopted');
  });

  it('adopt 422（落位课程不属该领域）→ error 展示且不改阶段', async () => {
    route((url) => (url.includes('/adopt')
      ? [422, { detail: { code: 'INVALID_PARAMS', message: '课程 c1 不属于领域 math' } }]
      : [404, { detail: 'unexpected' }]));
    usePaperExploreStore.setState({ domainId: 'math', selection: RANKED_REPORT, stage: 'review' });
    await usePaperExploreStore.getState().adopt([{ rank: 1, domain_id: 'math', course_id: 'c1' }]);
    const st = usePaperExploreStore.getState();
    expect(st.error).toContain('不属于领域');
    expect(st.adopted).toBeNull();
    expect(paperFlowPhase(st)).toBe('review');
  });
});

describe('打开弹窗：续看活动任务，否则读最近报告', () => {
  it('同领域有在跑任务 → 不重发、直接续轮询', async () => {
    route((url) => (url.includes('/tasks/') ? [200, task()] : [404, { detail: 'unexpected' }]));
    usePaperExploreStore.setState({ domainId: 'math', task: task(), modalOpen: false });
    await usePaperExploreStore.getState().openModal('math', '数学', '数学分析');
    const st = usePaperExploreStore.getState();
    expect(st.modalOpen).toBe(true);
    expect(st.domainName).toBe('数学');
    expect(st.courseName).toBe('数学分析');
    expect(st.stage).toBe('settings');
    expect(mockFetch.mock.calls.some((c) => String(c[0]).includes('/papers/recommend'))).toBe(false);
  });

  it('无活动任务 → 拉最近报告摘要，ranked 则读详情停段①（I3：详情挂 store，不自动跳段）', async () => {
    route((url) => {
      if (url.includes('/papers/selections?')) return [200, { selections: [{ selection_id: 'sel-1', domain_id: 'math', recipe: 'frontier', status: 'ranked', created_at: '', recommendation_count: 2 }] }];
      if (url.includes('/papers/selections/sel-1')) return [200, RANKED_REPORT];
      return [404, { detail: 'unexpected' }];
    });
    await usePaperExploreStore.getState().openModal('math', '数学');
    const st = usePaperExploreStore.getState();
    expect(st.selection?.selection_id).toBe('sel-1');
    expect(paperFlowPhase(st)).toBe('form');
    // 「继续上次报告」是显式动作：进段③检索口径
    st.toPlan();
    expect(paperFlowPhase(usePaperExploreStore.getState())).toBe('plan');
  });

  it('报告面失败（8901 离线 503）→ 静默进发起表单，不抛错', async () => {
    route(() => [503, { detail: 'QED-Tracker 服务不可达：connection refused' }]);
    await usePaperExploreStore.getState().openModal('math', '数学');
    const st = usePaperExploreStore.getState();
    expect(paperFlowPhase(st)).toBe('form');
    expect(st.selection).toBeNull();
  });
});

describe('历史探索清单 loadHistory / openReport（REQ-109 I10，I13 改判）', () => {
  const summaries = (n: number) => Array.from({ length: n }, (_, i) => ({
    selection_id: `sel-${i + 1}`, domain_id: 'math', recipe: 'frontier', status: 'ranked',
    created_at: '', recommendation_count: 1,
  }));

  it('只按 domain_id 拉、上限 10 份，且不按 recipe 过滤（方向是界面概念）', async () => {
    route((url) => {
      expect(url).toContain('domain_id=math');
      expect(url).toContain(`limit=${PAPER_HISTORY_LIMIT}`);
      expect(url).not.toContain('recipe=');
      return [200, { selections: summaries(25) }];
    });
    await usePaperExploreStore.getState().loadHistory('math');
    expect(usePaperExploreStore.getState().history).toHaveLength(PAPER_HISTORY_LIMIT);
  });

  it('I13 清单只留待决定报告（ranked / no_recommendations），已消费与无候选不进', async () => {
    route(() => [200, { selections: [
      { ...summaries(1)[0], selection_id: 'sel-ranked', status: 'ranked' },
      { ...summaries(1)[0], selection_id: 'sel-none', status: 'no_recommendations' },
      { ...summaries(1)[0], selection_id: 'sel-empty', status: 'no_candidates' },
      { ...summaries(1)[0], selection_id: 'sel-plan', status: 'planning' },
      { ...summaries(1)[0], selection_id: 'sel-done', status: 'downloaded' },
      { ...summaries(1)[0], selection_id: 'sel-odd', status: 'failed' },
    ] }]);
    await usePaperExploreStore.getState().loadHistory('math');
    expect(usePaperExploreStore.getState().history.map((row) => row.selection_id))
      .toEqual(['sel-ranked', 'sel-none']);
  });

  it('I13 新的在前：按 created_at 倒序，不按服务端返回顺序', async () => {
    route(() => [200, { selections: [
      { ...summaries(1)[0], selection_id: 'old', created_at: '2026-10-01T00:00:00Z' },
      { ...summaries(1)[0], selection_id: 'new', created_at: '2026-10-09T03:00:00Z' },
      { ...summaries(1)[0], selection_id: 'mid', created_at: '2026-10-05T01:00:00Z' },
    ] }]);
    await usePaperExploreStore.getState().loadHistory('math');
    expect(usePaperExploreStore.getState().history.map((row) => row.selection_id))
      .toEqual(['new', 'mid', 'old']);
  });

  it('拉取失败静默：不写 error、保留旧清单、不影响段位', async () => {
    usePaperExploreStore.setState({ history: summaries(1) });
    route(() => [503, { detail: 'QED-Tracker 服务不可达' }]);
    await usePaperExploreStore.getState().loadHistory('math');
    const st = usePaperExploreStore.getState();
    expect(st.error).toBeNull();
    expect(st.history).toHaveLength(1);
    expect(paperFlowPhase(st)).toBe('form');
  });

  it('I13 点历史条目：读该 selection_id 详情并**直达段④评审**（继续确认/否定）', async () => {
    route((url) => (url.includes('/papers/selections/sel-7')
      ? [200, { ...RANKED_REPORT, selection_id: 'sel-7' }]
      : [404, { detail: 'unexpected' }]));
    usePaperExploreStore.setState({ domainId: 'math', selection: RANKED_REPORT, stage: 'settings' });
    await usePaperExploreStore.getState().openReport('sel-7');
    const st = usePaperExploreStore.getState();
    expect(st.selection?.selection_id).toBe('sel-7');
    expect(st.stage).toBe('review');
    expect(paperFlowPhase(st)).toBe('review');
  });

  it('段④的「查看检索口径」出口仍可达段③', () => {
    usePaperExploreStore.setState({ selection: RANKED_REPORT, stage: 'review' });
    usePaperExploreStore.getState().toPlan();
    expect(paperFlowPhase(usePaperExploreStore.getState())).toBe('plan');
  });

  it('详情读不到（早期报告已清理）→ 内联提示并可改参数重试，报告不被清空', async () => {
    route(() => [404, { detail: 'not found' }]);
    usePaperExploreStore.setState({ domainId: 'math', selection: RANKED_REPORT, stage: 'settings' });
    await usePaperExploreStore.getState().openReport('sel-404');
    const st = usePaperExploreStore.getState();
    expect(st.error).toContain('该报告还没有可看的候选');
    expect(st.selection?.selection_id).toBe(RANKED_REPORT.selection_id);
    expect(paperFlowPhase(st)).toBe('failed');
    usePaperExploreStore.getState().clearError();
    expect(paperFlowPhase(usePaperExploreStore.getState())).toBe('form');
  });
});

describe('已入库论文按需回源 tracePaperOrigin（I5 ②）', () => {
  const summaries = (n: number) => Array.from({ length: n }, (_, i) => ({
    selection_id: `sel-${i + 1}`, domain_id: 'math', recipe: 'frontier', status: 'ranked',
    created_at: '', recommendation_count: 1,
  }));

  it('命中：按 arXiv ID 在报告候选里匹配，带出摘要与评审结论', async () => {
    route((url) => {
      if (url.includes('/papers/selections?')) return [200, { selections: summaries(2) }];
      if (url.includes('/papers/selections/sel-2')) {
        return [200, { ...RANKED_REPORT, selection_id: 'sel-2', assessments: [entry(1, '2401.00009', '命中的那篇')] }];
      }
      if (url.includes('/papers/selections/sel-1')) return [200, { ...RANKED_REPORT, selection_id: 'sel-1', assessments: [] }];
      return [404, { detail: 'unexpected' }];
    });
    await usePaperExploreStore.getState().tracePaperOrigin({ bookId: 'math-b19', domainId: 'math', arxivId: '2401.00009' });
    const trace = usePaperExploreStore.getState().trace;
    expect(trace?.state).toBe('hit');
    expect(trace?.hit?.candidate.title).toBe('命中的那篇');
    expect(trace?.hit?.assessment?.reason).toBe('对齐领域目标');
    expect(trace?.hit?.selection_id).toBe('sel-2');
  });

  it('纪律：只扫本领域、上限 20 份，第 21 份不再请求', async () => {
    route((url) => {
      if (url.includes('/papers/selections?')) {
        expect(url).toContain('domain_id=math');
        expect(url).toContain('limit=20');
        return [200, { selections: summaries(25) }];
      }
      return [200, { ...RANKED_REPORT, selection_id: 'sel-x', assessments: [] }];
    });
    await usePaperExploreStore.getState().tracePaperOrigin({ bookId: 'b', domainId: 'math', arxivId: 'nope' });
    const detailGets = mockFetch.mock.calls.filter(([u, init]) =>
      String(u).includes('/papers/selections/sel-') && (init as RequestInit | undefined)?.method !== 'POST');
    expect(detailGets).toHaveLength(20);
    expect(usePaperExploreStore.getState().trace?.state).toBe('miss');
  });

  it('未命中给 miss（早期采纳/报告已清理，不编造摘要）', async () => {
    route((url) => (url.includes('/papers/selections?') ? [200, { selections: summaries(1) }] : [200, RANKED_REPORT]));
    await usePaperExploreStore.getState().tracePaperOrigin({ bookId: 'b', domainId: 'math', arxivId: '9999.99999' });
    expect(usePaperExploreStore.getState().trace).toEqual({ bookId: 'b', state: 'miss', hit: null });
  });

  it('缺 arXiv 标识或缺领域 → 不发任何请求，直接 no_source', async () => {
    await usePaperExploreStore.getState().tracePaperOrigin({ bookId: 'b', domainId: 'math', arxivId: '' });
    expect(usePaperExploreStore.getState().trace).toEqual({ bookId: 'b', state: 'no_source', hit: null });
    await usePaperExploreStore.getState().tracePaperOrigin({ bookId: 'b2', domainId: '', arxivId: '2401.1' });
    expect(usePaperExploreStore.getState().trace?.state).toBe('no_source');
    expect(mockFetch.mock.calls.filter(([u]) => String(u).includes('/papers/selections'))).toHaveLength(0);
  });

  it('报告面 503 → 静默 miss，不抛错不弹错', async () => {
    route(() => [503, { detail: 'QED-Tracker 服务不可达' }]);
    await usePaperExploreStore.getState().tracePaperOrigin({ bookId: 'b', domainId: 'math', arxivId: '2401.1' });
    expect(usePaperExploreStore.getState().trace?.state).toBe('miss');
    expect(usePaperExploreStore.getState().error).toBeNull();
  });
});

describe('领域徽标汇总 refreshBadges', () => {
  it('按任务与报告联立出各领域徽标，8901 离线时退回仅书行数', async () => {
    route((url) => {
      if (url.endsWith('/tasks')) return [200, [task({ task_id: 't-a', status: 'running', params: { domain_id: 'math', recipe: 'frontier' } })]];
      if (url.includes('/papers/selections')) {
        return [200, { selections: [{ selection_id: 'sel-c', domain_id: 'cs', recipe: 'core', status: 'ranked', created_at: '', recommendation_count: 1 }] }];
      }
      return [404, { detail: 'unexpected' }];
    });
    await usePaperExploreStore.getState().refreshBadges({ math: 2, cs: 0, phys: 5 });
    const badges = usePaperExploreStore.getState().badges;
    expect(badges.math.key).toBe('running');
    expect(badges.cs).toEqual({ key: 'review', text: '待评审' });
    expect(badges.phys).toEqual({ key: 'sedimented', text: '已沉淀 5 篇' });

    route(() => [503, { detail: '不可达' }]);
    await usePaperExploreStore.getState().refreshBadges({ math: 3 });
    expect(usePaperExploreStore.getState().badges.math).toEqual({ key: 'sedimented', text: '已沉淀 3 篇' });
  });

  it('8901 任务列表还没反映刚发起的任务时，本地在跟任务把「探索中」保住', async () => {
    route((url) => {
      if (url.endsWith('/tasks')) return [200, []];
      if (url.includes('/papers/selections')) return [200, { selections: [] }];
      return [404, { detail: 'unexpected' }];
    });
    usePaperExploreStore.setState({ domainId: 'math', task: task() });
    await usePaperExploreStore.getState().refreshBadges({ math: 0 });
    expect(usePaperExploreStore.getState().badges.math).toEqual({ key: 'running', text: '探索中' });
  });
});

describe('徽标随任务就地流转（§7.2：发起即探索中，不等页面回灌）', () => {
  it('start 成功 → 该领域立刻探索中（树右键禁用与行徽标同源）', async () => {
    route((url) => {
      if (url.includes('/papers/recommend')) return [202, { task_id: 't-9' }];
      if (url.includes('/tasks/t-9')) return [200, task({ task_id: 't-9' })];
      return [404, { detail: 'unexpected' }];
    });
    await usePaperExploreStore.getState().start({ domain_id: 'math', recipe: 'frontier', top: 5 });
    expect(usePaperExploreStore.getState().badges.math).toEqual({ key: 'running', text: '探索中' });
  });

  it('任务完成出 ranked 报告 → 该领域待评审', async () => {
    route((url) => {
      if (url.includes('/tasks/t-9')) return [200, task({ task_id: 't-9', status: 'completed', progress: 100, result: { selection_id: 'sel-1' } })];
      if (url.includes('/papers/selections/sel-1')) return [200, RANKED_REPORT];
      return [404, { detail: 'unexpected' }];
    });
    usePaperExploreStore.setState({ domainId: 'math', task: task({ task_id: 't-9' }) });
    await usePaperExploreStore.getState().pollOnce();
    expect(usePaperExploreStore.getState().badges.math).toEqual({ key: 'review', text: '待评审' });
  });

  it('任务 failed → 该领域失败', async () => {
    route((url) => (url.includes('/tasks/t-9')
      ? [200, task({ task_id: 't-9', status: 'failed', error: '检索计划为空' })]
      : [404, { detail: 'unexpected' }]));
    usePaperExploreStore.setState({ domainId: 'math', task: task({ task_id: 't-9' }) });
    await usePaperExploreStore.getState().pollOnce();
    expect(usePaperExploreStore.getState().badges.math).toEqual({ key: 'failed', text: '失败' });
  });

  it('无候选报告（completed 但非 ranked）→ 按书行数退回', async () => {
    route((url) => {
      if (url.includes('/tasks/t-9')) return [200, task({ task_id: 't-9', status: 'completed', progress: 100, result: { selection_id: 'sel-2' } })];
      if (url.includes('/papers/selections/sel-2')) {
        return [200, { ...RANKED_REPORT, selection_id: 'sel-2', status: 'no_candidates', assessments: [], recommendations: [] }];
      }
      return [404, { detail: 'unexpected' }];
    });
    usePaperExploreStore.setState({ domainId: 'math', task: task({ task_id: 't-9' }), counts: { math: 4 } });
    await usePaperExploreStore.getState().pollOnce();
    expect(usePaperExploreStore.getState().badges.math).toEqual({ key: 'sedimented', text: '已沉淀 4 篇' });
  });
});
