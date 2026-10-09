/**
 * 论文探索 store 测试（REQ-102 W4，downloads-ui.md §4.4 / downloads-flow.md §7.2）
 * - 纯派生：§7.2 五态展示徽标（探索中 > 待评审 > 失败 > 已沉淀 > 隐藏），禁读 exploration_stage
 * - 流程：start（202 task_id）→ pollOnce（completed→读报告）→ adopt（202→采纳结果）
 * - 降级：连续 3 次轮询失败转 error 并停表；已在库候选默认不勾
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PAPER_MAX_POLL_FAILURES, PAPER_POLL_INTERVAL_MS,
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
  it('无任务无报告=form；running 任务=running；失败=failed；ranked 报告=review；有采纳结果=adopted', () => {
    expect(paperFlowPhase({ task: null, selection: null, adopted: null })).toBe('form');
    expect(paperFlowPhase({ task: task(), selection: null, adopted: null })).toBe('running');
    expect(paperFlowPhase({ task: task({ status: 'failed' }), selection: null, adopted: null })).toBe('failed');
    expect(paperFlowPhase({ task: task({ status: 'completed' }), selection: RANKED_REPORT, adopted: null })).toBe('review');
    expect(paperFlowPhase({ task: null, selection: RANKED_REPORT, adopted: [] })).toBe('adopted');
  });
});

describe('发起与轮询流程', () => {
  it('start 原样发出 domain_id/recipe/goal/categories 并进入 running', async () => {
    route((url) => {
      if (url.includes('/papers/recommend')) return [202, { task_id: 't-9' }];
      if (url.includes('/tasks/t-9')) return [200, task({ task_id: 't-9' })];
      return [404, { detail: 'unexpected' }];
    });
    await usePaperExploreStore.getState().start({ domainId: 'math', recipe: 'frontier', goal: '向量检索', categories: ['cs.IR'] });
    const body = requestedBodies()['/papers/recommend'] as Record<string, unknown>;
    expect(body).toEqual({ domain_id: 'math', recipe: 'frontier', goal: '向量检索', categories: ['cs.IR'] });
    expect(usePaperExploreStore.getState().task?.task_id).toBe('t-9');
    expect(paperFlowPhase(usePaperExploreStore.getState())).toBe('running');
  });

  it('领域缺失：上游 422 结构化 detail 进 error，不发任务', async () => {
    route((url) => (url.includes('/papers/recommend')
      ? [422, { detail: { code: 'INVALID_PARAMS', message: '领域不存在：math（论文没有默认桶）' } }]
      : [404, { detail: 'unexpected' }]));
    await usePaperExploreStore.getState().start({ domainId: 'math', recipe: 'core' });
    const st = usePaperExploreStore.getState();
    expect(st.error).toContain('领域不存在');
    expect(st.task).toBeNull();
    expect(paperFlowPhase(st)).toBe('failed');
  });

  it('任务完成 → 读报告详情进评审', async () => {
    route((url) => {
      if (url.includes('/tasks/t-9')) return [200, task({ task_id: 't-9', status: 'completed', progress: 100, result: { selection_id: 'sel-1' } })];
      if (url.includes('/papers/selections/sel-1')) return [200, RANKED_REPORT];
      return [404, { detail: 'unexpected' }];
    });
    usePaperExploreStore.setState({ domainId: 'math', task: task({ task_id: 't-9' }) });
    await usePaperExploreStore.getState().pollOnce();
    const st = usePaperExploreStore.getState();
    expect(st.selection?.selection_id).toBe('sel-1');
    expect(paperFlowPhase(st)).toBe('review');
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
    usePaperExploreStore.setState({ domainId: 'math', selection: RANKED_REPORT });
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
    await usePaperExploreStore.getState().openModal('math', '数学');
    const st = usePaperExploreStore.getState();
    expect(st.modalOpen).toBe(true);
    expect(st.domainName).toBe('数学');
    expect(mockFetch.mock.calls.some((c) => String(c[0]).includes('/papers/recommend'))).toBe(false);
  });

  it('无活动任务 → 拉最近报告摘要，ranked 则读详情进评审', async () => {
    route((url) => {
      if (url.includes('/papers/selections?')) return [200, { selections: [{ selection_id: 'sel-1', domain_id: 'math', recipe: 'frontier', status: 'ranked', created_at: '', recommendation_count: 2 }] }];
      if (url.includes('/papers/selections/sel-1')) return [200, RANKED_REPORT];
      return [404, { detail: 'unexpected' }];
    });
    await usePaperExploreStore.getState().openModal('math', '数学');
    const st = usePaperExploreStore.getState();
    expect(st.selection?.selection_id).toBe('sel-1');
    expect(paperFlowPhase(st)).toBe('review');
  });

  it('报告面失败（8901 离线 503）→ 静默进发起表单，不抛错', async () => {
    route(() => [503, { detail: 'QED-Tracker 服务不可达：connection refused' }]);
    await usePaperExploreStore.getState().openModal('math', '数学');
    const st = usePaperExploreStore.getState();
    expect(paperFlowPhase(st)).toBe('form');
    expect(st.selection).toBeNull();
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
    await usePaperExploreStore.getState().start({ domainId: 'math', recipe: 'frontier' });
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
