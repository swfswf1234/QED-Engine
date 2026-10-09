/**
 * 题卡单测（M2 Batch B：作答 → 判分依据只在响应里回传；flashcard 走自评）。
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import QuestionCard from './QuestionCard';
import type { AttemptResponse, QuestionRow } from '../../api/learn';

function question(overrides: Partial<QuestionRow> = {}): QuestionRow {
  return {
    question_id: 'q-1', course_id: 'ma', kind: 'quiz', question_type: 'choice',
    stem: '求极限 lim(x→0) sin x / x',
    options: [
      { label: 'A', body: '1' }, { label: 'B', body: '0' },
      { label: 'C', body: '不存在' }, { label: 'D', body: '∞' },
    ],
    answer_back: '', difficulty: 'medium', kp_type: 'concept', kp_id: 'kp-c1',
    source_kind: 'exercise_book', book_ref: 'b07', source_ref: null, answer_source: 'same_page',
    gen_batch: 'workbench-extract', model_ref: '', meta: {}, retired: false,
    created_at: '', updated_at: '', ...overrides,
  };
}

const RESULT: AttemptResponse = {
  attempt_id: 7, question_id: 'q-1', is_correct: false, method: 'rule', judge_note: '选项不符',
  score_trend: 'new', resolved: false, answered_at: '',
  expected_answer: 'B', explanation: '用夹逼准则', review: {
    target_kind: 'question', target_id: 'q-1', course_id: 'ma', kp_type: 'concept',
    interval_index: 0, due_at: '', next_due_at: '',
  },
};

function submitFn(result: AttemptResponse | null = RESULT) {
  return vi.fn().mockResolvedValue(result);
}

describe('题卡 QuestionCard', () => {
  it('未作答时不显示判分依据（缝 2：题面投影不含答案）', () => {
    render(<QuestionCard question={question()} onSubmit={submitFn()} />);
    expect(screen.queryByText(/评分依据/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /提交作答/ })).toBeDisabled();
  });

  it('选择题提交选中项，判错后展开评分依据与解析', async () => {
    const onSubmit = submitFn();
    render(<QuestionCard question={question()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('C．不存在'));
    fireEvent.click(screen.getByRole('button', { name: /提交作答/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith({
      question_id: 'q-1', user_answer: 'C', origin: 'new', review_date: null,
    });
    expect(await screen.findByText('判错')).toBeInTheDocument();
    expect(screen.getByText('评分依据：B')).toBeInTheDocument();
    expect(screen.getByText(/夹逼准则/)).toBeInTheDocument();
  });

  it('简答题走文本输入并原样提交', async () => {
    const onSubmit = submitFn();
    render(
      <QuestionCard
        question={question({ options: null, question_type: 'short', stem: '叙述确界原理' })}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByLabelText('作答 q-1'), { target: { value: '非空有上界必有上确界' } });
    fireEvent.click(screen.getByRole('button', { name: /提交作答/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      user_answer: '非空有上界必有上确界',
    })));
  });

  it('闪卡先翻背文再自评（记得／重来，不带判分依据）', async () => {
    const onSubmit = submitFn({ ...RESULT, method: 'self', expected_answer: null, explanation: null });
    render(
      <QuestionCard
        question={question({ kind: 'flashcard', question_type: 'short', options: null, answer_back: '柯西收敛准则' })}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.queryByText('柯西收敛准则')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /翻开背文/ }));
    expect(screen.getByText('柯西收敛准则')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /重\s*来/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      question_id: 'q-1', user_answer: '重来', origin: 'new', review_date: null, self_result: 'again',
    }));
  });

  it('闪卡自评结果用记忆口径（已记住／未记住），不写判对判错', async () => {
    const onSubmit = submitFn({ ...RESULT, method: 'self', is_correct: false, expected_answer: null, explanation: null });
    render(
      <QuestionCard
        question={question({ kind: 'flashcard', question_type: 'short', options: null, answer_back: '柯西收敛准则' })}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /翻开背文/ }));
    fireEvent.click(screen.getByRole('button', { name: /重\s*来/ }));
    expect(await screen.findByText('未记住')).toBeInTheDocument();
    expect(screen.queryByText('判错')).not.toBeInTheDocument();
  });

  it('到期复习面带 origin=review 与 review_date 透传', async () => {
    const onSubmit = submitFn();
    render(
      <QuestionCard
        question={question({ options: null, question_type: 'short', stem: '求极限' })}
        onSubmit={onSubmit}
        origin="review"
        reviewDate="2026-10-05T00:00:00"
      />,
    );
    fireEvent.change(screen.getByLabelText('作答 q-1'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /提交作答/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      origin: 'review', review_date: '2026-10-05T00:00:00',
    })));
  });
});
