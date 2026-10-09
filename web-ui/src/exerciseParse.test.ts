/**
 * 抽取式题源纯函数单测（M2 裁决 ⑥／壳「抽取式题源管线规格」9 条规则逐条对应）。
 * 夹具＝吉米多维奇类习题集页文本的实测块形态（paragraph 块内含换行、formula 块独立、
 * 答案区在书末同书页内），不依赖网络与解析服务。
 */
import { describe, expect, it } from 'vitest';
import {
  draftIssues, parseExerciseBlocks, toQuestionPayload,
  type ExerciseBlockInput,
} from './exerciseParse';

const blk = (page: number, index: number, type: string, text: string): ExerciseBlockInput => ({
  page, index, type, text,
});

const FIRST_LINE = '1、求极限 lim(x→0) sin x / x。';

describe('规则 1 题号锚与粘连', () => {
  it('题号锚起新题，无锚行粘连上一题', () => {
    const result = parseExerciseBlocks([
      blk(12, 0, 'paragraph', FIRST_LINE),
      blk(12, 1, 'paragraph', '其中 x 趋于零。'),
      blk(12, 2, 'paragraph', '2、求导数 y = x^2 ln x。'),
    ]);
    expect(result.drafts.map((d) => d.number)).toEqual(['1', '2']);
    expect(result.drafts[0].stem).toContain('其中 x 趋于零。');
    expect(result.drafts[1].block_indexes).toEqual([2]);
  });

  it('多行 paragraph 块按行拆，题号在块内第二行也起新题', () => {
    const result = parseExerciseBlocks([
      blk(12, 0, 'paragraph', '3、计算积分。\n4、求面积。'),
    ]);
    expect(result.drafts.map((d) => d.number)).toEqual(['3', '4']);
    expect(result.drafts[1].page).toBe(12);
  });

  it('小数题号（1.2）与顿号/括号分隔都认', () => {
    const result = parseExerciseBlocks([
      blk(1, 0, 'paragraph', '1.2、设 f 连续。'),
      blk(1, 1, 'paragraph', '1.3）求极限。'),
    ]);
    expect(result.drafts.map((d) => d.number)).toEqual(['1.2', '1.3']);
  });
});

describe('规则 2 节题白名单', () => {
  it('「习题」行＝题区开始，不当题面', () => {
    const result = parseExerciseBlocks([
      blk(18, 0, 'heading', '习题 1-5'),
      blk(18, 1, 'paragraph', FIRST_LINE),
    ]);
    expect(result.drafts.length).toBe(1);
    expect(result.drafts[0].stem).not.toContain('习题 1-5');
  });

  it('「答案与提示」行＝答案区开始，其后行不再当题面', () => {
    const result = parseExerciseBlocks([
      blk(18, 0, 'heading', '习题'),
      blk(18, 1, 'paragraph', FIRST_LINE),
      blk(120, 0, 'heading', '答案与提示'),
      blk(120, 1, 'paragraph', '1、解：原式 = 1。'),
    ]);
    expect(result.drafts.length).toBe(1);
    expect(result.drafts[0].answer_source).toBe('solution_section');
  });
});

describe('规则 3 公式保真', () => {
  it('formula 块整块原样入题面（补 $$ 定界，不降级为文本）', () => {
    const result = parseExerciseBlocks([
      blk(12, 0, 'paragraph', '1、计算下列极限。'),
      blk(12, 1, 'formula', '\\lim_{x\\to 0}\\frac{\\sin x}{x}'),
    ]);
    expect(result.drafts[0].stem).toContain('$$\\lim_{x\\to 0}\\frac{\\sin x}{x}$$');
    expect(result.drafts[0].block_indexes).toEqual([0, 1]);
  });

  it('老代产物自带 $$ 定界不重复包裹（BUGFIX-011 口径）', () => {
    const result = parseExerciseBlocks([
      blk(12, 0, 'paragraph', '1、计算下列极限。'),
      blk(12, 1, 'formula', '$$x^2+1$$'),
    ]);
    expect(result.drafts[0].stem).toContain('$$x^2+1$$');
    expect(result.drafts[0].stem).not.toContain('$$$$');
  });
});

describe('规则 4 子题', () => {
  it('(1)(2) 与 ①② 起子题，保留换行且不拆成多题', () => {
    const result = parseExerciseBlocks([
      blk(12, 0, 'paragraph', '5、判别下列级数敛散性。'),
      blk(12, 1, 'paragraph', '(1) $\\sum 1/n$；'),
      blk(12, 2, 'paragraph', '② $\\sum 1/n^2$。'),
    ]);
    expect(result.drafts.length).toBe(1);
    expect(result.drafts[0].stem.split('\n').length).toBe(3);
    expect(result.drafts[0].block_indexes).toEqual([0, 1, 2]);
  });
});

describe('规则 5 选项识别', () => {
  it('A/B/C/D 四项齐 → choice + options，题面去掉选项段', () => {
    const result = parseExerciseBlocks([
      blk(12, 0, 'paragraph', '6、求极限 lim(x→0) sin x/x 的值为（A．0 B．1 C．∞ D．不存在）。'),
    ]);
    const draft = result.drafts[0];
    expect(draft.question_type).toBe('choice');
    expect(draft.options?.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D']);
    expect(draft.options?.[1].body).toContain('1');
    expect(draft.stem).not.toContain('D．不存在');
  });

  it('选项不齐则保持原判定并出 notice', () => {
    const result = parseExerciseBlocks([
      blk(12, 0, 'paragraph', '7、求值（A．0 B．1）。'),
    ]);
    expect(result.drafts[0].question_type).toBe('short');
    expect(result.notices.join(' ')).toContain('7');
  });
});

describe('规则 6 答案配对（answer_source 按序命中）', () => {
  it('同页「答：/解：」→ same_page（优先于答案区）', () => {
    const result = parseExerciseBlocks([
      blk(12, 0, 'paragraph', '8、求极限。'),
      blk(12, 1, 'paragraph', '答：1。'),
    ]);
    expect(result.drafts[0].answer_source).toBe('same_page');
    expect(result.drafts[0].expected_answer).toBe('1');
    expect(result.drafts[0].answer_page).toBe(12);
  });

  it('书内答案节按题号命中 → solution_section + answer_page 记位', () => {
    const result = parseExerciseBlocks([
      blk(12, 0, 'paragraph', '9、求导数。'),
      blk(130, 0, 'heading', '参考答案'),
      blk(130, 1, 'paragraph', '9、解：y\' = 2x ln x + x。'),
    ]);
    expect(result.drafts[0].answer_source).toBe('solution_section');
    expect(result.drafts[0].answer_page).toBe(130);
  });

  it('关联题解书（R-11）→ sibling_book', () => {
    const result = parseExerciseBlocks(
      [blk(12, 0, 'paragraph', '10、求积分。')],
      { siblingAnswers: { '10': '解：$\\ln|x|+C$' } },
    );
    expect(result.drafts[0].answer_source).toBe('sibling_book');
  });

  it('皆不中 → none 且 kind 强制 flashcard（裁决 ⑨）', () => {
    const result = parseExerciseBlocks([blk(12, 0, 'paragraph', '11、叙述确界原理。')]);
    const draft = result.drafts[0];
    expect(draft.answer_source).toBe('none');
    expect(draft.kind).toBe('flashcard');
    expect(draft.expected_answer).toBeNull();
    expect(draft.confidence).toBeLessThan(0.5);
  });
});

describe('规则 7 判分型回落', () => {
  it('答案 ≤30 字符且无句读 → short', () => {
    const result = parseExerciseBlocks([
      blk(1, 0, 'paragraph', '12、求极限 lim sin x/x。'),
      blk(1, 1, 'paragraph', '答：1'),
    ]);
    expect(result.drafts[0].question_type).toBe('short');
    expect(result.drafts[0].expected_answer).toBe('1');
  });

  it('答案可枚举 → open + keywords', () => {
    const result = parseExerciseBlocks([
      blk(1, 0, 'paragraph', '13、叙述确界原理的内容。'),
      blk(1, 1, 'paragraph', '答：非空数集；有上界；必有上确界。'),
    ]);
    const draft = result.drafts[0];
    expect(draft.question_type).toBe('open');
    expect(draft.keywords?.length).toBeGreaterThanOrEqual(2);
  });

  it('选择题答案取字母，无字母则回落 flashcard 自评', () => {
    const withLetter = parseExerciseBlocks([
      blk(1, 0, 'paragraph', '14、求值（A．0 B．1 C．∞ D．不存在）。'),
      blk(1, 1, 'paragraph', '答：B'),
    ]);
    expect(withLetter.drafts[0].expected_answer).toBe('B');
    expect(withLetter.drafts[0].kind).toBe('quiz');

    const noLetter = parseExerciseBlocks([
      blk(1, 0, 'paragraph', '15、求值（A．0 B．1 C．∞ D．不存在）。'),
      blk(1, 1, 'paragraph', '答：重要极限值为 1。'),
    ]);
    expect(noLetter.drafts[0].kind).toBe('flashcard');
    expect(noLetter.drafts[0].answer_back).toContain('重要极限');
  });

  it('长论述答案 → open 且 keywords 取步骤词', () => {
    const result = parseExerciseBlocks([
      blk(1, 0, 'paragraph', '16、证明单调有界必收敛。'),
      blk(1, 1, 'paragraph', '答：构造上确界；证其为界；取子列；由极限存在得证结论。'),
    ]);
    const draft = result.drafts[0];
    expect(draft.question_type).toBe('open');
    expect((draft.keywords ?? []).length).toBeGreaterThanOrEqual(2);
    expect((draft.keywords ?? []).join('')).not.toContain('。');
  });
});

describe('规则 8 未识别行不静默丢弃', () => {
  it('页眉/页脚/页码块＝设计内剔除，题区首行无题号＝no-anchor，答案区孤儿行＝answer-orphan', () => {
    const result = parseExerciseBlocks([
      blk(12, 0, 'header', '吉米多维奇习题集'),
      blk(12, 1, 'paragraph', '本节补充下列题目。'),
      blk(12, 2, 'paragraph', FIRST_LINE),
      blk(12, 3, 'page_number', '12'),
      blk(130, 0, 'heading', '答案与提示'),
      blk(130, 1, 'paragraph', '77、解：略。'),
    ]);
    const reasons = result.unrecognized.map((u) => u.reason);
    expect(reasons).toContain('excluded');
    expect(reasons).toContain('no-anchor');
    expect(reasons).toContain('answer-orphan');
    expect(result.drafts.length).toBe(1);
  });

  it('图片/表格块入 attachments 并降置信度，不进题面文本', () => {
    const result = parseExerciseBlocks([
      blk(12, 0, 'paragraph', '17、求图示区域的面积。'),
      blk(12, 1, 'image', ''),
      blk(12, 2, 'table', '<table><tr><td>1</td></tr></table>'),
    ]);
    const draft = result.drafts[0];
    expect(draft.attachments.length).toBe(2);
    expect(draft.stem).not.toContain('<table>');
    expect(draft.confidence).toBeLessThan(0.9);
  });
});

describe('规则 9 输出形状与入库载荷', () => {
  it('toQuestionPayload 出 POST /learn/questions 的题项形状（含 ⑨ 一致性）', () => {
    const result = parseExerciseBlocks([
      blk(12, 0, 'paragraph', '18、求极限（A．0 B．1 C．∞ D．不存在）。'),
      blk(130, 0, 'heading', '答案与提示'),
      blk(130, 1, 'paragraph', '18、解：B。'),
    ]);
    const item = toQuestionPayload(result.drafts[0], {
      book_ref: 'mathanalysis-b07',
      source_kind: 'exercise_book',
      kp_id: 'kp-a',
      kp_type: 'concept',
    });
    expect(item.stem).toContain('求极限');
    expect(item.kind).toBe('quiz');
    expect(item.question_type).toBe('choice');
    expect(item.expected_answer).toBe('B');
    expect(item.answer_source).toBe('solution_section');
    expect(item.kp_type).toBe('concept');
    expect(item.kp_id).toBe('kp-a');
    expect(item.source_ref).toMatchObject({ page: 12, answer_page: 130 });
    expect(item.meta?.attachments).toHaveLength(0);
  });

  it('kp_type 快照默认 memory（与后端 DEFAULT_KP_TYPE 同口径）', () => {
    const result = parseExerciseBlocks([blk(1, 0, 'paragraph', '19、求值。')]);
    const item = toQuestionPayload(result.drafts[0], { book_ref: 'b', source_kind: 'manual' });
    expect(item.kp_type).toBe('memory');
  });

  it('draftIssues 镜像后端入库不变量（面板据此拦确认按钮）', () => {
    const result = parseExerciseBlocks([
      blk(1, 0, 'paragraph', '20、求值。'),
      blk(1, 1, 'paragraph', '答：因为该极限存在且唯一，故所求值即为该上确界，证毕。'),
    ]);
    const draft = result.drafts[0];
    expect(draftIssues(draft)).toEqual([]);
    expect(draftIssues({ ...draft, expected_answer: null })).toContain('expected_answer');
    expect(draftIssues({ ...draft, stem: '   ' })).toContain('stem');
    expect(draftIssues({ ...draft, keywords: [] })).toContain('keywords');
    expect(draftIssues({ ...draft, options: [{ label: 'A', body: '1' }] })).toContain('options');
    expect(
      draftIssues({ ...draft, kind: 'flashcard', answer_back: '' }),
    ).toContain('answer_back');
  });
});

describe('页块归一与题解索引（store 侧纯函数）', () => {
  it('exerciseBlocksOf 按类型取文本口径（formula=latex / table=html / list=换行拼接）', async () => {
    const { exerciseBlocksOf } = await import('./exerciseParse');
    const blocks = exerciseBlocksOf(7, [
      { type: 'paragraph', text: FIRST_LINE },
      { type: 'formula', latex: '\lim_{x\to0}\frac{\sin x}{x}' },
      { type: 'table', html: '<table><tr><td>1</td></tr></table>' },
      { type: 'list', items: ['甲', '乙'] },
      { text: '无类型段落' },
    ]);
    expect(blocks).toMatchObject([
      { page: 7, index: 0, type: 'paragraph', text: FIRST_LINE },
      { index: 1, type: 'formula', text: '\lim_{x\to0}\frac{\sin x}{x}' },
      { index: 2, type: 'table', text: '<table><tr><td>1</td></tr></table>' },
      { index: 3, type: 'list', text: '甲\n乙' },
      { index: 4, type: 'paragraph', text: '无类型段落' },
    ]);
  });

  it('parseAnswerIndex 只认题号锚行并剥引导词，同题号多行拼接', async () => {
    const { parseAnswerIndex } = await import('./exerciseParse');
    const index = parseAnswerIndex([
      blk(130, 0, 'paragraph', '1、答：B'),
      blk(130, 1, 'paragraph', '2、解答：因为该极限存在，所以和收敛'),
      blk(130, 2, 'paragraph', '这一段没有题号，不收'),
      blk(130, 3, 'header', '3、页眉里的题号不收'),
      blk(130, 4, 'paragraph', '3、上确界存在。提示：用完备性。'),
      blk(130, 5, 'paragraph', '3、补充：取上确界。'),
    ]);
    expect(index).toEqual({
      '1': 'B',
      '2': '因为该极限存在，所以和收敛',
      '3': '上确界存在。提示：用完备性 补充：取上确界',
    });
  });

  it('题解索引喂给抽取器＝sibling_book 配对（R-11）', async () => {
    const { parseAnswerIndex } = await import('./exerciseParse');
    const sibling = parseAnswerIndex([blk(130, 0, 'paragraph', '1、答：B')]);
    const result = parseExerciseBlocks(
      [blk(12, 0, 'paragraph', '1、求极限（A．1 B．2 C．3 D．4）')],
      { siblingAnswers: sibling },
    );
    expect(result.drafts[0]).toMatchObject({ answer_source: 'sibling_book', expected_answer: 'B' });
    expect(result.notices).toHaveLength(0);
  });
});
