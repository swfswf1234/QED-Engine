/**
 * PaperExploreModal 论文探索管理弹窗测试（REQ-102 W4，downloads-ui.md §4.4）
 * - 三段流转：发起（配方 前沿|核心 + 目标 + 可选 arXiv 分类）→ 轮询（每 5 秒）→ 评审与落位
 * - 评审段：逐条勾选 + 逐条落位选择器（领域 | 该领域下课程）；已在库/未达推荐线不可勾
 * - 采纳：picks 逐条带 domain_id/course_id（⑤′ 不补默认值）；结果段提示不自动下载
 * - 失败：422/409 detail 原文内联，留在原段可重试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigProvider, App as AntApp } from 'antd';
import PaperExploreModal from './PaperExploreModal';
import { theme } from '../theme';
import { usePaperExploreStore } from '../stores/paperExplore';
import { useDownloadsStore } from '../stores/downloads';
import type { BookRecord, CourseRecord, DomainSystem, PaperSelectionDetail } from '../stores';

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

import { adoptPapers, recommendPapers } from '../api/tracker';

const REPORT: PaperSelectionDetail = {
  selection_id: 'sel-1',
  status: 'ranked',
  created_at: '2026-10-03T00:02:00Z',
  domain_id: 'math',
  recipe: 'frontier',
  recommendations: [1, 2],
  assessments: [
    {
      rank: 1, plan_index: 1, score: 132, recommended: true,
      candidate: {
        provider: 'arxiv', provider_id: '2401.00001', title: '论文一', authors: ['A. Author'],
        language: 'en', year: '2024', page_url: 'https://arxiv.org/abs/2401.00001',
        download_url: '', identifiers: { arxiv: '2401.00001' },
      },
      assessment: { arxiv_id: '2401.00001', goal_fit: 9, foundational_value: 7, readability: 6, reason: '对齐领域目标', risks: [] },
    },
    {
      rank: 2, plan_index: 1, score: 120, recommended: true,
      candidate: {
        provider: 'arxiv', provider_id: '2401.00002', title: '已在库的那篇', authors: ['B. Author'],
        language: 'en', year: '2023', page_url: '', download_url: '', identifiers: { arxiv: '2401.00002' },
      },
      assessment: { arxiv_id: '2401.00002', goal_fit: 8, foundational_value: 6, readability: 7, reason: '经典', risks: [] },
    },
    {
      rank: 3, plan_index: 2, score: 40, recommended: false,
      candidate: {
        provider: 'arxiv', provider_id: '2401.00003', title: '论文三', authors: [],
        language: 'en', year: '2022', page_url: '', download_url: '', identifiers: { arxiv: '2401.00003' },
      },
      assessment: { arxiv_id: '2401.00003', goal_fit: 2, foundational_value: 3, readability: 3, reason: '相关性低', risks: [] },
    },
  ],
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
  return [{ domain_id: 'math', name: '数学', description: '', stages: [], courses, exploration_stage: '已完成' }];
}

function course(course_id: string, name: string): CourseRecord {
  return { course_id, name, aliases: [], stage: '', prerequisites: [] };
}

function renderModal() {
  return render(
    <ConfigProvider theme={theme}>
      <AntApp>
        <PaperExploreModal />
      </AntApp>
    </ConfigProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  usePaperExploreStore.getState().reset();
  useDownloadsStore.setState({ domains: domains([course('01_analysis', '数学分析')]), paperBooks: [] });
});

describe('发起段', () => {
  it('默认配方=前沿；提交带 domain_id/recipe，可选目标与分类原样传入', async () => {
    vi.mocked(recommendPapers).mockResolvedValue({ task_id: 't-1' });
    vi.mocked(await import('../api/tracker')).getTask.mockResolvedValue({
      task_id: 't-1', type: 'paper_recommend', status: 'running', progress: 30, message: '规划检索计划',
      created_at: '', updated_at: '', params: null, result: null, error: '',
    });
    usePaperExploreStore.setState({ modalOpen: true, domainId: 'math', domainName: '数学' });
    renderModal();
    expect(screen.getByRole('radio', { name: '前沿' })).toBeChecked();
    fireEvent.change(screen.getByPlaceholderText('本次探索目标（可空，默认取领域描述）'), { target: { value: '稀疏注意力' } });
    fireEvent.change(screen.getByPlaceholderText('如 cs.AI, math.NA（领域映射不到 arXiv 分类时必填）'), { target: { value: 'cs.AI' } });
    fireEvent.click(screen.getByRole('button', { name: /开始探索/ }));
    await waitFor(() => expect(recommendPapers).toHaveBeenCalled());
    expect(recommendPapers).toHaveBeenCalledWith({
      domain_id: 'math', recipe: 'frontier', goal: '稀疏注意力', categories: ['cs.AI'],
    });
    await waitFor(() => expect(screen.getByText(/探索进行中/)).toBeInTheDocument());
  });

  it('切到核心配方后提交 recipe=core', async () => {
    vi.mocked(recommendPapers).mockResolvedValue({ task_id: 't-2' });
    usePaperExploreStore.setState({ modalOpen: true, domainId: 'math', domainName: '数学' });
    renderModal();
    fireEvent.click(screen.getByRole('radio', { name: '核心' }));
    fireEvent.click(screen.getByRole('button', { name: /开始探索/ }));
    await waitFor(() => expect(recommendPapers).toHaveBeenCalled());
    expect(vi.mocked(recommendPapers).mock.calls[0][0].recipe).toBe('core');
  });

  it('422（领域不存在）原文内联并可回到表单重试', async () => {
    vi.mocked(recommendPapers).mockRejectedValue(
      Object.assign(new Error('领域不存在：math（论文没有默认桶）'), { kind: 'http', status: 422, detail: {} }),
    );
    usePaperExploreStore.setState({ modalOpen: true, domainId: 'math', domainName: '数学' });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /开始探索/ }));
    await waitFor(() => expect(screen.getByText(/领域不存在：math/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /返回修改/ })).toBeInTheDocument();
  });
});

describe('轮询段', () => {
  it('running 显示进度与任务消息，并提示每 5 秒轮询', () => {
    usePaperExploreStore.setState({
      modalOpen: true, domainId: 'math', taskKind: 'recommend',
      task: {
        task_id: 't-1', type: 'paper_recommend', status: 'running', progress: 60, message: 'arXiv 检索中',
        created_at: '', updated_at: '', params: null, result: null, error: '',
      },
    });
    renderModal();
    expect(screen.getByText(/探索进行中/)).toBeInTheDocument();
    expect(screen.getByText(/arXiv 检索中/)).toBeInTheDocument();
    expect(screen.getByText(/每 5 秒轮询/)).toBeInTheDocument();
  });
});

describe('评审与落位段', () => {
  beforeEach(() => {
    usePaperExploreStore.setState({
      modalOpen: true, domainId: 'math', domainName: '数学', selection: REPORT,
      task: {
        task_id: 't-1', type: 'paper_recommend', status: 'completed', progress: 100, message: '报告已落库',
        created_at: '', updated_at: '', params: null, result: { selection_id: 'sel-1' }, error: '',
      },
    });
  });

  it('候选行显示评分与理由；已在库标记默认不勾；未达推荐线不可勾', () => {
    useDownloadsStore.setState({ paperBooks: [paperBook(' 已在库的那篇 ')] });
    renderModal();
    expect(screen.getByText('论文一')).toBeInTheDocument();
    expect(screen.getByText('已在库的那篇')).toBeInTheDocument();
    expect(screen.getByText('已在库')).toBeInTheDocument();
    expect(screen.getByText('未达推荐线')).toBeInTheDocument();
    expect(screen.getByText(/对齐领域目标/)).toBeInTheDocument();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes[1]).toBeDisabled();   // 已在库
    expect(boxes[2]).toBeDisabled();   // 未达推荐线
    expect(boxes[0]).not.toBeChecked();
  });

  it('勾选 + 落位选择器 → 确认采纳逐条带 domain_id/course_id（picks 原样透传）', async () => {
    vi.mocked(adoptPapers).mockResolvedValue({ task_id: 't-adopt', selection_id: 'sel-1' });
    vi.mocked(await import('../api/tracker')).getTask.mockResolvedValue({
      task_id: 't-adopt', type: 'paper_adopt', status: 'completed', progress: 100, message: '完成',
      created_at: '', updated_at: '', params: null,
      result: { selection_id: 'sel-1', adopted: [{ rank: 1, book_id: 'math-b09', status: 'created', arxiv_id: '2401.00001' }] },
      error: '',
    });
    renderModal();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /确认采纳/ }));
    await waitFor(() => expect(adoptPapers).toHaveBeenCalled());
    expect(adoptPapers).toHaveBeenCalledWith('sel-1', [{ rank: 1, domain_id: 'math', course_id: '' }]);
    await waitFor(() => expect(screen.getByText(/已建书行/)).toBeInTheDocument());
    expect(screen.getByText(/停在待下载/)).toBeInTheDocument();
  });

  it('落位选到课程 → picks.course_id 为该课程；不勾任何条目时按钮禁用', async () => {
    vi.mocked(adoptPapers).mockResolvedValue({ task_id: 't-adopt', selection_id: 'sel-1' });
    vi.mocked((await import('../api/tracker')).getTask).mockResolvedValue({
      task_id: 't-adopt', type: 'paper_adopt', status: 'queued', progress: 0, message: '采纳任务已提交',
      created_at: '', updated_at: '', params: null, result: null, error: '',
    });
    renderModal();
    expect(screen.getByRole('button', { name: /确认采纳/ })).toBeDisabled();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '落位 论文一' }));
    fireEvent.click(await screen.findByText('数学分析'));
    fireEvent.click(screen.getByRole('button', { name: /确认采纳/ }));
    await waitFor(() => expect(adoptPapers).toHaveBeenCalled());
    expect(adoptPapers).toHaveBeenCalledWith('sel-1', [{ rank: 1, domain_id: 'math', course_id: '01_analysis' }]);
  });

  it('采纳 422（课程不属该领域）→ 留在评审段内联提示', async () => {
    vi.mocked(adoptPapers).mockRejectedValue(
      Object.assign(new Error('课程 c9 不属于领域 math'), { kind: 'http', status: 422, detail: {} }),
    );
    renderModal();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /确认采纳/ }));
    await waitFor(() => expect(screen.getByText(/不属于领域/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /确认采纳/ })).toBeInTheDocument();
  });
});
