/**
 * 抽取确认面板单测（M2 Batch B：人工确认才入库，不合格草稿不进提交批次）。
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ExerciseConfirmPanel from './ExerciseConfirmPanel';
import { parseExerciseBlocks, type QuestionDraft } from '../../exerciseParse';

function draftsOf(lines: Array<[number, number, string]>): QuestionDraft[] {
  return parseExerciseBlocks(
    lines.map(([page, index, text]) => ({ page, index, type: 'paragraph', text })),
  ).drafts;
}

const MIXED = draftsOf([
  [12, 0, '1、求极限 lim(x→0) sin x / x（A．1 B．0 C．不存在 D．∞）。'],
  [12, 1, '1、解：B。'],
  [12, 2, '2、叙述确界原理。'],
]);

describe('抽取确认面板', () => {
  it('草稿逐条呈现题面与答案来源，未识别行可见', () => {
    render(
      <ExerciseConfirmPanel
        drafts={MIXED}
        unrecognized={[{ raw: '这段没有题号', reason: 'no-anchor', page: 12, index: 3 }]}
        notices={['题 2 未配对答案（按裁决 ⑨ 转闪卡自评）']}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText('求极限 lim(x→0) sin x / x')).toBeTruthy();
    expect(screen.getByText(/缺题号锚/)).toBeTruthy();
    expect(screen.getByText(/可入库 1 题/)).toBeTruthy();
  });

  it('编辑题面即回调 onUpdate（人工可改）', () => {
    const onUpdate = vi.fn();
    render(
      <ExerciseConfirmPanel
        drafts={MIXED}
        unrecognized={[]}
        notices={[]}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('题 1 题面'), { target: { value: '改过的题面' } });
    expect(onUpdate).toHaveBeenCalledWith(0, { stem: '改过的题面' });
  });

  it('删除回调按下标传出', () => {
    const onRemove = vi.fn();
    render(
      <ExerciseConfirmPanel
        drafts={MIXED}
        unrecognized={[]}
        notices={[]}
        onUpdate={vi.fn()}
        onRemove={onRemove}
        onConfirm={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '删除题 2' }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('全部不合格时确认按钮禁用并点名问题；有合格草稿才可提交', () => {
    const invalid = MIXED.map((draft) => ({ ...draft, kind: 'quiz' as const, expected_answer: null }));
    const { unmount } = render(
      <ExerciseConfirmPanel
        drafts={invalid}
        unrecognized={[]}
        notices={[]}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /确认入库/ })).toBeDisabled();
    expect(screen.getByText('判分题缺评分依据')).toBeTruthy();
    unmount();

    const onConfirm = vi.fn();
    render(
      <ExerciseConfirmPanel
        drafts={MIXED}
        unrecognized={[]}
        notices={[]}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByRole('button', { name: /确认入库/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /确认入库/ }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('评分依据输入同时同步关键词（论述题口径）', () => {
    const onUpdate = vi.fn();
    render(
      <ExerciseConfirmPanel
        drafts={[MIXED[0]]}
        unrecognized={[]}
        notices={[]}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('题 1 评分依据'), { target: { value: '上确界, 完备性' } });
    expect(onUpdate).toHaveBeenCalledWith(0, {
      expected_answer: '上确界, 完备性',
      keywords: ['上确界', '完备性'],
    });
  });
});
