/**
 * 练习面「今日面板」单测（到期复习队列 + 错题本人工位，R3 已裁＝同屏两段、不独立成页、不加 Tabs）。
 * 计数口径＝课级全量（R2）＋单请求 max_tasks=100（R5）：`今日到期 N` 取服务端截断前的 total_due。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChapterPractice from './ChapterPractice';
import { mockFetch } from '../../test/setup';
import { usePracticeStore } from '../../stores/practice';
import type { AttemptResponse, MistakeItem, QuestionRow, ReviewDueTask } from '../../api/learn';

function question(overrides: Partial<QuestionRow> = {}): QuestionRow {
  return {
    question_id: 'q-1', course_id: 'ma', kind: 'quiz', question_type: 'short',
    stem: '叙述确界原理', options: null, answer_back: '', difficulty: 'medium',
    kp_type: 'concept', kp_id: 'kp-c1', source_kind: 'exercise_book', book_ref: 'b07',
    source_ref: null, answer_source: 'same_page', gen_batch: 'workbench-extract', model_ref: '',
    meta: {}, retired: false, created_at: '', updated_at: '', ...overrides,
  };
}

const DUE_TASK: ReviewDueTask = {
  target_kind: 'question', target_id: 'q-due', course_id: 'ma', kp_id: 'kp-c1', kp_type: 'concept',
  interval_index: 2, due_at: '2026-10-04T00:00:00', priority: 1, reason: 'wrong',
  overdue_days: 1,
  question: question({ question_id: 'q-due', kind: 'flashcard', answer_back: '非空有上界必有上确界' }),
};

/** 到期队列只剩题粒度一种形态（D3）；`question` 为 null＝题面投影不到的兜底行 */
const NO_STEM_TASK: ReviewDueTask = {
  target_kind: 'question', target_id: 'q-gone', course_id: 'ma', kp_id: 'kp-c2', kp_type: 'procedure',
  interval_index: 1, due_at: '', priority: 4, reason: 'type', overdue_days: 0, question: null,
};

const MISTAKE: MistakeItem = {
  question: question(),
  last_attempt: {
    attempt_id: 7, question_id: 'q-1', course_id: 'ma', kp_id: 'kp-c1',
    user_answer: '写了一半', is_correct: false, method: 'rule',
    judge_note: '', resolved: false, bookmarked: false, origin: 'new',
    review_date: null, answered_at: '',
  },
  attempt_count: 3, wrong_count: 2, is_correct: false, resolved: false, bookmarked: false,
  score_trend: 'declined', due_today: true,
};

const RESULT: AttemptResponse = {
  attempt_id: 7, question_id: 'q-1', is_correct: false, method: 'rule', judge_note: '关键词不足',
  score_trend: 'declined', resolved: false, answered_at: '',
  expected_answer: '非空有上界必有上确界', explanation: '确界原理', review: {
    target_kind: 'question', target_id: 'q-1', kp_type: 'concept',
    interval_index: 0, due_at: '', next_due_at: '',
  },
};

const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  usePracticeStore.setState({
    courseId: 'ma', dueTasks: [DUE_TASK, NO_STEM_TASK], mistakes: [MISTAKE], totalDue: 2,
    mistakeStats: { total: 1, wrong: 1, unresolved: 1, bookmarked: 0, due_today: 1 },
    questions: [question()], notice: null, lastResult: null,
    loadCourse: vi.fn().mockResolvedValue(undefined),
    setBookmark: vi.fn().mockResolvedValue(undefined),
    setResolved: vi.fn().mockResolvedValue(undefined),
    submitAttempt: vi.fn().mockResolvedValue(null),
  });
  mockFetch.mockImplementation((url: string) => Promise.reject(new TypeError(`no route: ${url}`)));
});

describe('练习面今日面板', () => {
  it('到期队列逐条呈现：题粒度带题面，题面取不到的行只给兜底说明', () => {
    render(<ChapterPractice courseId="ma" />);
    expect(screen.getByText('到期复习（2）')).toBeInTheDocument();
    expect(screen.getByText('叙述确界原理')).toBeInTheDocument();
    expect(screen.getByText('错题优先')).toBeInTheDocument();
    expect(screen.getByText('超期 1 天')).toBeInTheDocument();
    expect(screen.getByText(/题面暂时取不到（档 1）/)).toBeInTheDocument();
  });

  it('顶部口径行的到期数取 total_due（截断前全量），非已列条数', () => {
    usePracticeStore.setState({ totalDue: 137, dueTasks: [DUE_TASK] });
    render(<ChapterPractice courseId="ma" />);
    expect(screen.getByText('今日到期 137／错题 1 未解决（共 1）')).toBeInTheDocument();
    expect(screen.getByText('到期复习（1）')).toBeInTheDocument();
  });

  it('total_due 超过单请求上限 100 时队列尾行交代剩余（R5）', () => {
    usePracticeStore.setState({ totalDue: 137, dueTasks: [DUE_TASK, NO_STEM_TASK] });
    render(<ChapterPractice courseId="ma" />);
    expect(screen.getByText('另有 135 条到期未列，做完本批再看')).toBeInTheDocument();
  });

  it('未超上限不出剩余尾行', () => {
    render(<ChapterPractice courseId="ma" />);
    expect(screen.queryByText(/到期未列/)).not.toBeInTheDocument();
  });

  it('最近判分行持久显示且按口径选文案（DEFECT-013：题卡卸载后反馈不丢）', () => {
    usePracticeStore.setState({
      lastResult: {
        ...RESULT, method: 'rule', is_correct: false, score_trend: 'declined',
      },
    });
    render(<ChapterPractice courseId="ma" />);
    expect(screen.getByText('最近判分：判错·趋势 declined')).toBeInTheDocument();
  });

  it('自评结果的最近判分行走记忆口径（已记住／未记住），不写判对判错', () => {
    usePracticeStore.setState({
      lastResult: {
        ...RESULT, method: 'self', is_correct: true, score_trend: 'improved',
        expected_answer: null, explanation: null,
      },
    });
    render(<ChapterPractice courseId="ma" />);
    expect(screen.getByText('最近判分：自评已记住·趋势 improved')).toBeInTheDocument();
    expect(screen.queryByText(/判对/)).not.toBeInTheDocument();
  });

  it('错题行显示趋势与作答次数，收藏按钮调用 store 人工位', () => {
    render(<ChapterPractice courseId="ma" />);
    expect(screen.getByText('退步')).toBeInTheDocument();
    expect(screen.getByText('答错 2/3 次')).toBeInTheDocument();
    expect(screen.getByText('上次作答：写了一半')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /收\s*藏/ }));
    expect(usePracticeStore.getState().setBookmark).toHaveBeenCalledWith(7, true);
  });

  it('重做本题展开题卡，提交后收起', async () => {
    const submit = vi.fn().mockResolvedValue(null);
    usePracticeStore.setState({ submitAttempt: submit });
    render(<ChapterPractice courseId="ma" />);
    fireEvent.click(screen.getByRole('button', { name: /重做本题/ }));
    fireEvent.change(screen.getByLabelText('作答 q-1'), { target: { value: '再答一次' } });
    fireEvent.click(screen.getByRole('button', { name: /提交作答/ }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      question_id: 'q-1', user_answer: '再答一次', origin: 'manual',
    }));
    expect(calls).toHaveLength(0);
  });

  it('刷新按课重取三张面（无 kp 参数）', () => {
    const load = vi.fn().mockResolvedValue(undefined);
    usePracticeStore.setState({ loadCourse: load });
    render(<ChapterPractice courseId="ma" />);
    fireEvent.click(screen.getByRole('button', { name: /刷\s*新/ }));
    expect(load).toHaveBeenCalledWith('ma');
  });

  it('队列与错题都空时给两段空态（N=0 仍渲染面板：复习入口在本面唯一落位）', () => {
    usePracticeStore.setState({ dueTasks: [], mistakes: [], mistakeStats: null, totalDue: 0 });
    render(<ChapterPractice courseId="ma" />);
    expect(screen.getByText('今天没有到期')).toBeInTheDocument();
    expect(screen.getByText('还没有错题')).toBeInTheDocument();
    expect(screen.getByText('今日到期 0／错题 0 未解决（共 0）')).toBeInTheDocument();
  });
});
