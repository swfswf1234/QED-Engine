/**
 * 论文探索管理弹窗测试（REQ-102 W4 起，REQ-108 I3~I5 五段，REQ-109 I9~I11 第二轮；REQ-107 壳 §4~§7、§11）
 * - 段①发起：检索方向四值 + 领域描述 + 可选目标 + 可选分类 + 历史探索清单；恒 top=5，无推荐上限调配面
 * - 段②轮询（每 5 秒）→ 段③检索口径（计划/兜底警示/年窗/候选计数/失败）→ 显式进段④评审
 * - 段④：只列**未采纳且达线**（默认全选），未达线与已剔除折叠只读带归因；点行就地展开摘要与评审小结
 * - 段⑤采纳：picks 逐条带 domain_id/course_id（⑤′ 不补默认值）；结果提示不自动下载
 * - 失败：422/409 detail 原文内联，留在原段可重试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigProvider, App as AntApp } from 'antd';
import PaperExploreModal from './PaperExploreModal';
import { theme } from '../theme';
import { usePaperExploreStore } from '../stores/paperExplore';
import { useDownloadsStore } from '../stores/downloads';
import type { BookRecord, CourseRecord, DomainSystem, PaperCandidateEntry, PaperSelectionDetail } from '../stores';

vi.mock('../api/tracker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/tracker')>();
  return {
    ...actual,
    recommendPapers: vi.fn(),
    getTask: vi.fn(),
    listPaperSelections: vi.fn(),
    getPaperSelection: vi.fn(),
    adoptPapers: vi.fn(),
    listTasks: vi.fn(),
  };
});

import { adoptPapers, getPaperSelection, listPaperSelections, recommendPapers } from '../api/tracker';

function candidateEntry(
  rank: number,
  title: string,
  overrides: { goal_fit?: number; score?: number; recommended?: boolean; abstract?: string; reason?: string; risks?: string[] } = {},
): PaperCandidateEntry {
  const arxiv = `2401.0000${rank}`;
  const goalFit = overrides.goal_fit ?? 5;
  return {
    rank,
    plan_index: 1,
    candidate: {
      provider: 'arxiv', provider_id: arxiv, title, authors: ['A. Author'],
      language: 'en', year: '2024', page_url: `https://arxiv.org/abs/${arxiv}`,
      download_url: '', identifiers: { arxiv }, abstract: overrides.abstract ?? '这篇论文的英文摘要原文。',
    },
    assessment: {
      arxiv_id: arxiv, goal_fit: goalFit, foundational_value: 5, readability: 5,
      reason: overrides.reason ?? '对齐领域目标', risks: overrides.risks ?? [],
    },
    score: overrides.score ?? 132,
    recommended: overrides.recommended ?? true,
  };
}

const REPORT: PaperSelectionDetail = {
  selection_id: 'sel-1',
  status: 'ranked',
  created_at: '2026-10-03T00:02:00Z',
  domain_id: 'math',
  recipe: 'frontier',
  recommendations: [1, 2],
  assessments: [
    candidateEntry(1, '论文一'),
    candidateEntry(2, '已在库的那篇'),
    candidateEntry(3, '论文三', { goal_fit: 2, score: 40, recommended: false, reason: '相关性低' }),
    candidateEntry(4, '分数不够的那篇', { goal_fit: 5, score: 70 }),
    candidateEntry(5, '超上限的那篇', { goal_fit: 4, score: 90, recommended: false }),
  ],
  temporary_goal: '稀疏注意力',
  allowed_categories: ['cs.AI'],
  profile: { name: '数学', description: '高等数学', goals: ['打基础'], topics: ['极限'], years_limit: 3, allowed_categories: ['cs.AI'] },
  search_plan: [
    { terms: ['sparse attention', 'transformer'], category: 'cs.AI', reason: '覆盖注意力近似主线', plan_index: 1, fetched: 12, kept: 5 },
    { terms: ['numerical analysis'], category: 'math.NA', reason: '补充经典线', plan_index: 2, fetched: 0, kept: 0 },
  ],
  plan_coverage: [{ plan_index: 1, terms: ['sparse attention'], category: 'cs.AI', fetched: 12, kept: 5 }],
  plan_source: 'llm',
  search_failures: [],
  excluded_existing: ['2401.00002'],
  candidates: [],
};

function paperBook(title: string): BookRecord {
  return {
    book_id: 'math-b01', title, original_title: null, part: '', authors: [], publisher: 'arXiv',
    edition: '', year: 2023, language: 'en', roles: [], status: 'candidate', retire_reason: '',
    holding: 'missing', file_path: null, priority: null, notes: null, domain_id: 'math',
    created_at: '', updated_at: '', kind: 'paper',
  };
}

function domains(courses: CourseRecord[]): DomainSystem[] {
  return [{ domain_id: 'math', name: '数学', description: '领域描述正文', stages: [], courses, exploration_stage: '已完成' }];
}

function course(course_id: string, name: string): CourseRecord {
  return { course_id, name, aliases: [], stage: '', prerequisites: [] };
}

function renderModal() {
  return render(
    <ConfigProvider theme={theme}>
      <AntApp>
        <PaperExploreModal />
      </AntApp>,
    </ConfigProvider>,
  );
}

function openAt(patch: Partial<Parameters<typeof usePaperExploreStore.setState>[0]>) {
  usePaperExploreStore.setState({ modalOpen: true, domainId: 'math', domainName: '数学', ...patch });
  return renderModal();
}

const RUNNING_TASK = {
  task_id: 't-1', type: 'paper_recommend', status: 'running', progress: 60, message: 'arXiv 检索中',
  created_at: '', updated_at: '', params: null, result: null, error: '',
} as const;

const DONE_TASK = {
  task_id: 't-1', type: 'paper_recommend', status: 'completed', progress: 100, message: '报告已落库',
  created_at: '', updated_at: '', params: null, result: { selection_id: 'sel-1' }, error: '',
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  usePaperExploreStore.getState().reset();
  useDownloadsStore.setState({ domains: domains([course('01_analysis', '数学分析')]), paperBooks: [] });
  // 段①挂载即拉历史清单：默认给空清单，用例按需覆盖
  vi.mocked(listPaperSelections).mockResolvedValue({ selections: [] });
});

describe('段①探索设置（检索方向四值，REQ-109 I9）', () => {
  it('默认方向=前沿；提交带 domain_id/recipe/top=5，目标与分类原样传入', async () => {
    vi.mocked(recommendPapers).mockResolvedValue({ task_id: 't-1' });
    vi.mocked(await import('../api/tracker')).getTask.mockResolvedValue({ ...RUNNING_TASK });
    openAt({});
    expect(screen.getByRole('radio', { name: '前沿' })).toBeChecked();
    fireEvent.change(screen.getByPlaceholderText('本次探索目标（可空，默认取领域描述）'), { target: { value: '稀疏注意力' } });
    fireEvent.change(screen.getByPlaceholderText('如 cs.AI, math.NA（领域映射不到 arXiv 分类时必填）'), { target: { value: 'cs.AI' } });
    fireEvent.click(screen.getByRole('button', { name: /发起探索/ }));
    await waitFor(() => expect(recommendPapers).toHaveBeenCalled());
    expect(recommendPapers).toHaveBeenCalledWith({
      domain_id: 'math', recipe: 'frontier', top: 5, goal: '稀疏注意力', categories: ['cs.AI'],
    });
    await waitFor(() => expect(screen.getByText(/探索进行中/)).toBeInTheDocument());
  });

  it('界面不再有推荐上限调配面（top 恒 5，只在摘要行以「一次推荐 5 篇」说明）', () => {
    openAt({});
    expect(screen.queryByPlaceholderText(/本次最多推荐几篇/)).not.toBeInTheDocument();
    expect(screen.queryByText(/推荐上限/)).not.toBeInTheDocument();
    expect(screen.getByTestId('launch-summary')).toHaveTextContent('一次推荐 5 篇');
  });

  it('四值单选且各带一行选中说明；改名领域描述', () => {
    openAt({});
    ['前沿', '核心', '深度', '匹配'].forEach((label) => {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('radio', { name: '深度' }));
    expect(screen.getByText(/不限年 \+ 每组抓取量拉满/)).toBeInTheDocument();
    expect(screen.getByText('领域描述（本次探索目标缺省取此）')).toBeInTheDocument();
    expect(screen.getByText('领域描述正文')).toBeInTheDocument();
  });

  it('深度：下发 core + years_limit=0 + limit=25，追加语进请求体并原样回显', async () => {
    vi.mocked(recommendPapers).mockResolvedValue({ task_id: 't-1' });
    openAt({});
    fireEvent.click(screen.getByRole('radio', { name: '深度' }));
    expect(screen.getByTestId('launch-summary')).toHaveTextContent('年窗 不限（显式下发 0）');
    expect(screen.getByTestId('launch-goal')).toHaveTextContent('领域描述正文，侧重证明细节、方法论与理论深度');
    fireEvent.click(screen.getByRole('button', { name: /发起探索/ }));
    await waitFor(() => expect(recommendPapers).toHaveBeenCalledWith({
      domain_id: 'math', recipe: 'core', top: 5, goal: '领域描述正文，侧重证明细节、方法论与理论深度',
      years_limit: 0, limit: 25,
    }));
  });

  it('匹配：探索目标必填 → 内联提示且发起禁用（不发请求）；填了才下发放宽年窗', async () => {
    vi.mocked(recommendPapers).mockResolvedValue({ task_id: 't-1' });
    openAt({});
    fireEvent.click(screen.getByRole('radio', { name: '匹配' }));
    expect(screen.getByTestId('direction-error')).toHaveTextContent('匹配方向需要填写本次探索目标');
    expect(screen.getByRole('button', { name: /发起探索/ })).toBeDisabled();
    expect(recommendPapers).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('本次探索目标（可空，默认取领域描述）'), { target: { value: '稀疏注意力' } });
    expect(screen.queryByTestId('direction-error')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /发起探索/ }));
    await waitFor(() => expect(recommendPapers).toHaveBeenCalledWith({
      domain_id: 'math', recipe: 'frontier', top: 5, goal: '稀疏注意力', years_limit: 10, limit: 20,
    }));
  });

  it('口径说明一句：参数决定年窗/抓取量/分类，具体计划由模型在任务内生成', () => {
    openAt({});
    expect(screen.getByText(/具体检索计划由模型在任务内生成/)).toBeInTheDocument();
  });

  it('标题：领域语境无括号，课程语境带课程名（探索仍走所属领域）', () => {
    const { unmount } = openAt({});
    expect(screen.getByRole('dialog')).toHaveTextContent('论文探索 · 数学');
    expect(screen.queryByText(/（数学分析）/)).not.toBeInTheDocument();
    unmount();
    usePaperExploreStore.getState().reset();
    openAt({ courseName: '数学分析' });
    expect(screen.getByRole('dialog')).toHaveTextContent('论文探索 · 数学（数学分析）');
  });

  it('422（领域不存在）原文内联并可回到表单重试', async () => {
    vi.mocked(recommendPapers).mockRejectedValue(
      Object.assign(new Error('领域不存在：math（论文没有默认桶）'), { kind: 'http', status: 422, detail: {} }),
    );
    openAt({});
    fireEvent.click(screen.getByRole('button', { name: /发起探索/ }));
    await waitFor(() => expect(screen.getByText(/领域不存在：math/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /改参数重试/ })).toBeInTheDocument();
  });
});

describe('段①历史探索清单＝单按钮（REQ-109 I10，I13 改判）', () => {
  it('默认只一个按钮、不内联展示报告内容；点击展开待决定清单（新的在前），点行直达段④评审', async () => {
    vi.mocked(listPaperSelections).mockResolvedValue({
      selections: [
        { selection_id: 'sel-old', domain_id: 'math', recipe: 'frontier', status: 'ranked', created_at: '2026-10-06T02:00:00', recommendation_count: 1 },
        { selection_id: 'sel-new', domain_id: 'math', recipe: 'core', status: 'ranked', created_at: '2026-10-08T03:04:00', recommendation_count: 3 },
        { selection_id: 'sel-empty', domain_id: 'math', recipe: 'frontier', status: 'no_candidates', created_at: '2026-10-09T01:00:00', recommendation_count: 0 },
      ],
    });
    vi.mocked(getPaperSelection).mockResolvedValue({ ...REPORT, selection_id: 'sel-new' });
    openAt({});
    expect(screen.queryByTestId('history-row')).not.toBeInTheDocument();
    const toggle = screen.getByTestId('history-toggle');
    await waitFor(() => expect(toggle).toHaveTextContent('历史探索清单（2）'));   // no_candidates 不进清单
    fireEvent.click(toggle);
    const rows = screen.getAllByTestId('history-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('10-08 03:04 ｜ core ｜ 待评审 ｜ 达线 3 篇');
    expect(rows[1]).toHaveTextContent('10-06 02:00');
    fireEvent.click(rows[0].querySelector('button') as HTMLElement);
    await waitFor(() => expect(getPaperSelection).toHaveBeenCalledWith('sel-new'));
    expect(screen.getByTestId('shortlist-summary')).toBeInTheDocument();
    expect(screen.queryByText('本次检索口径')).not.toBeInTheDocument();
  });

  it('待决定 0 份 → 按钮禁用 + 空态文案；拉取失败同样静默且不阻塞发起', async () => {
    vi.mocked(listPaperSelections).mockRejectedValue(new Error('QED-Tracker 服务不可达'));
    vi.mocked(recommendPapers).mockResolvedValue({ task_id: 't-1' });
    openAt({});
    expect(await screen.findByTestId('history-empty')).toHaveTextContent('本领域没有待决定的探索报告');
    expect(screen.getByTestId('history-toggle')).toBeDisabled();
    const startButton = screen.getByRole('button', { name: /发起探索/ });
    expect(startButton).not.toBeDisabled();
    fireEvent.click(startButton);
    await waitFor(() => expect(recommendPapers).toHaveBeenCalled());
  });

  it('历史清单只按领域拉（limit=10），不按 recipe 过滤；旧「继续上次报告」按钮已删', async () => {
    openAt({ selection: REPORT, stage: 'settings' });
    await waitFor(() => expect(listPaperSelections).toHaveBeenCalledWith({ domain_id: 'math', limit: 10 }));
    const recipeArgs = vi.mocked(listPaperSelections).mock.calls.map(([args]) => args?.recipe);
    expect(recipeArgs.every((recipe) => recipe === undefined)).toBe(true);
    expect(screen.queryByTestId('continue-report')).not.toBeInTheDocument();
  });
});

describe('段②轮询', () => {
  it('running 显示进度与任务消息，并提示每 5 秒轮询', () => {
    openAt({ taskKind: 'recommend', task: { ...RUNNING_TASK } });
    expect(screen.getByText(/探索进行中/)).toBeInTheDocument();
    expect(screen.getByText(/arXiv 检索中/)).toBeInTheDocument();
    expect(screen.getByText(/每 5 秒轮询/)).toBeInTheDocument();
  });
});

describe('段③检索口径', () => {
  it('模型计划：徽标 + 逐条计划（关键词/分类/理由/抓取/保留）+ 年窗 + 候选计数', () => {
    openAt({ task: { ...DONE_TASK }, selection: REPORT, stage: 'plan' });
    expect(screen.getByTestId('plan-source')).toHaveTextContent('模型计划');
    expect(screen.getByText('覆盖注意力近似主线')).toBeInTheDocument();
    expect(screen.getByText('sparse attention')).toBeInTheDocument();
    expect(screen.getByText(/排除已在库 1 篇/)).toBeInTheDocument();
    expect(screen.getByText(/年窗 近 3 年/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /进入候选评审/ })).toBeInTheDocument();
  });

  it('兜底计划：警示徽标可见并逐条列出检索失败', () => {
    openAt({
      task: { ...DONE_TASK }, stage: 'plan',
      selection: { ...REPORT, plan_source: 'fallback', search_failures: [{ category: 'cs.AI', terms: ['x'], error: 'arXiv 超时' }] },
    });
    expect(screen.getByTestId('plan-source')).toHaveTextContent('兜底计划');
    expect(screen.getByTestId('plan-failures')).toHaveTextContent('arXiv 超时');
  });

  it('老报告无 search_plan → 降级提示且不炸', () => {
    const legacy = { ...REPORT, search_plan: undefined, plan_coverage: undefined, plan_source: undefined };
    openAt({ task: { ...DONE_TASK }, selection: legacy, stage: 'plan' });
    expect(screen.getByTestId('plan-missing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /进入候选评审/ })).toBeInTheDocument();
  });

  it('no_candidates 给「检索没出东西」的区分文案', () => {
    openAt({
      task: { ...DONE_TASK }, stage: 'plan',
      selection: { ...REPORT, status: 'no_candidates', assessments: [], recommendations: [] },
    });
    expect(screen.getByText(/本次检索没有取回候选/)).toBeInTheDocument();
  });

  it('no_recommendations 给「有候选但没达线」的区分文案', () => {
    openAt({
      task: { ...DONE_TASK }, stage: 'plan',
      selection: { ...REPORT, status: 'no_recommendations', recommendations: [] },
    });
    expect(screen.getByText(/没有一条达到服务端推荐线/)).toBeInTheDocument();
  });
});

describe('段④候选评审与落位（只列未采纳且达线，REQ-109 I11）', () => {
  const openReview = (patch: Partial<Parameters<typeof usePaperExploreStore.setState>[0]> = {}) =>
    openAt({ task: { ...DONE_TASK }, selection: REPORT, stage: 'review', ...patch });

  it('I13 段④头部「查看检索口径」回段③（历史清单直达评审后口径面仍可达）', () => {
    openReview();
    fireEvent.click(screen.getByRole('button', { name: /查看检索口径/ }));
    expect(screen.getByText('本次检索口径')).toBeInTheDocument();
  });

  it('头部三段计数；达线且未采纳的论文一默认全选，已在库那条不进待选', () => {
    openReview();
    expect(screen.getByTestId('shortlist-summary'))
      .toHaveTextContent('候选 5 篇 ｜ 待选区间 1 篇（未达线 3 篇） ｜ 已剔除 1 篇（已采纳／已在库）');
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toBeChecked();
    expect(screen.getByRole('button', { name: /采纳所选（不自动下载）\(1\)/ })).toBeInTheDocument();
    expect(screen.getByText('论文一')).toBeInTheDocument();
    expect(screen.queryByText('已在库的那篇')).not.toBeInTheDocument();
  });

  it('折叠区未达线三条各给唯一归因，被剔除条目注明「已采纳／已在库」，都不可勾选', () => {
    openReview();
    fireEvent.click(screen.getByText(/查看未入选/));
    const rows = screen.getAllByTestId('excluded-row');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('相关度 2＜4');
    expect(rows[1]).toHaveTextContent('总分 70＜80');
    expect(rows[2]).toHaveTextContent('超出本次推荐上限');
    expect(rows[3]).toHaveTextContent('已采纳／已在库');
    expect(rows[3]).toHaveTextContent('已在库的那篇');
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);   // 折叠区只读，不出现勾选框
  });

  it('本地书目桶命中的达线条目同样计入剔除（标题归一，与 excluded_existing 并存不重复计）', () => {
    useDownloadsStore.setState({ paperBooks: [paperBook(' 论文一 '), paperBook('已在库的那篇')] });
    openReview();
    expect(screen.getByTestId('shortlist-summary'))
      .toHaveTextContent('候选 5 篇 ｜ 待选区间 0 篇（未达线 3 篇） ｜ 已剔除 2 篇（已采纳／已在库）');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /采纳所选/ })).toBeDisabled();
  });

  it('达线全被剔除 → 专门空态与「换检索方向」出口', () => {
    useDownloadsStore.setState({ paperBooks: [paperBook('论文一'), paperBook('已在库的那篇')] });
    openReview({ selection: { ...REPORT, assessments: REPORT.assessments.slice(0, 2) } });
    expect(screen.getByTestId('shortlist-empty')).toHaveTextContent('本领域达线的论文都已采纳或已在库，换个检索方向再探索');
    expect(screen.getByRole('button', { name: /回段①换检索方向再探/ })).toBeInTheDocument();
  });

  it('勾选与落位逐条透传：取消默认全选后按钮禁用，重勾只发所选', async () => {
    vi.mocked(adoptPapers).mockResolvedValue({ task_id: 't-adopt', selection_id: 'sel-1' });
    vi.mocked(await import('../api/tracker')).getTask.mockResolvedValue({
      task_id: 't-adopt', type: 'paper_adopt', status: 'completed', progress: 100, message: '完成',
      created_at: '', updated_at: '', params: null,
      result: { selection_id: 'sel-1', adopted: [{ rank: 1, book_id: 'math-b09', status: 'created', arxiv_id: '2401.00001' }] },
      error: '',
    });
    openReview();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);       // 取消默认全选
    expect(screen.getByRole('button', { name: /采纳所选/ })).toBeDisabled();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);       // 重勾论文一
    fireEvent.click(screen.getByRole('button', { name: /采纳所选/ }));
    await waitFor(() => expect(adoptPapers).toHaveBeenCalled());
    expect(adoptPapers).toHaveBeenCalledWith('sel-1', [{ rank: 1, domain_id: 'math', course_id: '' }]);
    await waitFor(() => expect(screen.getByText(/已建书行/)).toBeInTheDocument());
    expect(screen.getByText(/停在待下载/)).toBeInTheDocument();
    expect(screen.getByText(/左栏「论文」节点/)).toBeInTheDocument();
  });

  it('落位选到课程 → picks.course_id 为该课程', async () => {
    vi.mocked(adoptPapers).mockResolvedValue({ task_id: 't-adopt', selection_id: 'sel-1' });
    openReview();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '落位 论文一' }));
    fireEvent.click(await screen.findByText('数学分析'));
    fireEvent.click(screen.getByRole('button', { name: /采纳所选/ }));
    await waitFor(() => expect(adoptPapers).toHaveBeenCalledWith('sel-1', [
      { rank: 1, domain_id: 'math', course_id: '01_analysis' },
    ]));
  });

  it('点条目就地展开：摘要原文 + 评审小结（reason/risks）+ 三维分，引用数位不渲染', () => {
    openReview();
    expect(screen.queryByText('这篇论文的英文摘要原文。')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('论文一'));
    expect(screen.getByTestId('candidate-detail')).toHaveTextContent('这篇论文的英文摘要原文。');
    expect(screen.getByTestId('candidate-detail')).toHaveTextContent('评审小结');
    expect(screen.getByTestId('candidate-detail')).toHaveTextContent('相关度 5 ｜ 基础性 5 ｜ 可读性 5 ｜ 总分 132');
    expect(screen.queryByText(/引用/)).not.toBeInTheDocument();
    expect(screen.queryByText(/权威/)).not.toBeInTheDocument();
  });

  it('条目行的 arXiv 标识是外跳链接（href 取 candidate.page_url，新窗口 + noopener）', () => {
    openReview();
    const link = screen.getByRole('link', { name: 'arXiv: 2401.00001' });
    expect(link).toHaveAttribute('href', 'https://arxiv.org/abs/2401.00001');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('摘要缺失的历史记录给「该记录未携带摘要」', () => {
    openReview({
      selection: {
        ...REPORT,
        assessments: [candidateEntry(7, '无摘要的那篇', { abstract: '' }), ...REPORT.assessments],
        excluded_existing: [],
      },
    });
    fireEvent.click(screen.getByText('无摘要的那篇'));
    expect(screen.getByTestId('candidate-detail')).toHaveTextContent('该记录未携带摘要');
  });

  it('采纳 422（课程不属该领域）→ 留在段④内联提示', async () => {
    vi.mocked(adoptPapers).mockRejectedValue(
      Object.assign(new Error('课程 c9 不属于领域 math'), { kind: 'http', status: 422, detail: {} }),
    );
    openReview();
    fireEvent.click(screen.getByRole('button', { name: /采纳所选/ }));
    await waitFor(() => expect(screen.getByText(/不属于领域/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /采纳所选/ })).toBeInTheDocument();
  });
});

describe('段④空态（未达线）', () => {
  it('一条都不达线：门槛取值空态 + 回段①出口，且没有勾选框', () => {
    openAt({
      task: { ...DONE_TASK }, stage: 'review',
      selection: { ...REPORT, assessments: [candidateEntry(4, '谁都没达线', { goal_fit: 1, score: 10, recommended: false })] },
    });
    expect(screen.getByTestId('shortlist-empty')).toHaveTextContent('相关度需 ≥4 且总分需 ≥80');
    expect(screen.getByRole('button', { name: /回段①换检索方向再探/ })).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    fireEvent.click(screen.getByText(/查看未入选/));
    expect(screen.getByTestId('excluded-row')).toHaveTextContent('相关度 1＜4');
  });
});
