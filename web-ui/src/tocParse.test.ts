import { describe, expect, it } from 'vitest';
import {
  estimateTocOffset, parseTocLines, toOutlinePayload, tocLinesFromBlockTexts,
  type TocNode, type TocUnrecognizedLine,
} from './tocParse';

/**
 * 夹具＝b05 目录页实测文本（解析产物 paragraph 块逐行原样，页 7 / 页 8 两栏）。
 * 尾章题在实测里被列边界截断，故第 10/11 章题行按合成样本另测（标注「合成」）。
 */
const B05_P7 = [
  '目录',
  '第1章 实数系和复数系…… 1',
  '导引 …… 1',
  '有序集 …… 2',
  '域 …… 4',
  '实数域 …… 7',
  '广义实数系 …… 10',
  '复数域 …… 10',
  '欧氏空间 …… 13',
  '附录 …… 15',
  '习题 …… 18',
  '第2章 基础拓扑 …… 21',
];

const B05_P8_COL_A = [
  'VII',
  '习题 …… 148',
  '第8章 一些特殊函数 …… 155',
  '幂级数 …… 155',
  '指数函数与对数函数 …… 160',
  '三角函数 …… 164',
  '复数域的代数完备性 …… 166',
  'Fourier级数 …… 167',
  'Γ函数 …… 173',
];

const B05_P8_COL_B = [
  '本原映射 …… 225',
  '单位的分割 …… 227',
  '变量代换 …… 228',
  '微分形式 …… 230',
  '单形与链 …… 242',
  'Stokes 定理 …… 248',
  '闭形式与恰当形式 …… 251',
  '向量分析 …… 255',
  '习题 …… 262',
];

const titles = (nodes: readonly TocNode[]): string[] => nodes.map((n) => n.name);
const reasons = (lines: readonly TocUnrecognizedLine[]): string[] => lines.map((l) => l.reason);

describe('章/节定级（目录解析规格 2：章题 depth=1，其余挂最近章题 depth=2）', () => {
  it('b05 p7 实测：第1章 收 7 个节题，第2章 起新章', () => {
    const { tree } = parseTocLines(B05_P7);
    expect(titles(tree)).toEqual(['第1章 实数系和复数系', '第2章 基础拓扑']);
    expect(tree[0].depth).toBe(1);
    expect(titles(tree[0].children)).toEqual([
      '导引', '有序集', '域', '实数域', '广义实数系', '复数域', '欧氏空间',
    ]);
    expect(tree[0].children[0].depth).toBe(2);
    expect(tree[1].children).toEqual([]);
  });

  it('b05 p8 左栏实测：第8章 收节题', () => {
    const { tree } = parseTocLines(B05_P8_COL_A);
    expect(titles(tree)).toEqual(['第8章 一些特殊函数']);
    expect(titles(tree[0].children)).toEqual([
      '幂级数', '指数函数与对数函数', '三角函数', '复数域的代数完备性', 'Fourier级数', 'Γ函数',
    ]);
  });

  it('章题变体（合成）：阿拉伯数字带空格、中文数字、Chapter 前缀均判 depth=1', () => {
    const { tree } = parseTocLines([
      '第 11 章 微分形式的积分 …… 265',
      '第十二章 合成样本 …… 300',
      'Chapter 3 Continuous Functions …… 50',
    ]);
    expect(titles(tree)).toEqual([
      '第 11 章 微分形式的积分', '第十二章 合成样本', 'Chapter 3 Continuous Functions',
    ]);
    expect(tree.every((n) => n.depth === 1)).toBe(true);
  });

  it('最深两级：节题下的行不会再降一层', () => {
    const { tree } = parseTocLines(['第一章 甲 …… 1', '第一节 乙 …… 2', '第二节 丙 …… 3']);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children.every((s) => s.children.length === 0)).toBe(true);
  });
});

describe('未识别行（规格 4：不静默丢弃）', () => {
  it('剔除行进 unrecognized 并标 reason=excluded（前言/附录/习题/参考文献类）', () => {
    const { tree, unrecognized } = parseTocLines(B05_P7);
    expect(tree[0].children.some((s) => s.name === '附录')).toBe(false);
    expect(unrecognized.filter((l) => l.reason === 'excluded').map((l) => l.raw))
      .toEqual(['附录 …… 15', '习题 …… 18']);
  });

  it('拆不出页码的行标 no-page（合成：列边界断在标题上）', () => {
    const { unrecognized } = parseTocLines(['广义实数系']);
    expect(unrecognized).toEqual([{ raw: '广义实数系', reason: 'no-page', page: null }]);
  });

  it('节题先于任何章题出现标 no-parent（b05 p8 右栏实测：章题在左栏尾）', () => {
    const { tree, unrecognized } = parseTocLines(B05_P8_COL_B);
    expect(tree).toEqual([]);
    expect(reasons(unrecognized)).toEqual([
      'no-parent', 'no-parent', 'no-parent', 'no-parent',
      'no-parent', 'no-parent', 'no-parent', 'no-parent', 'excluded',
    ]);
    expect(unrecognized[0]).toEqual({ raw: '本原映射 …… 225', reason: 'no-parent', page: 225 });
  });

  it('两栏按块序拼接后节题归位（章题在前的整页文本）', () => {
    const { tree, unrecognized } = parseTocLines(['第十章 微分形式的积分 …… 225', ...B05_P8_COL_B]);
    expect(titles(tree[0].children)).toEqual([
      '本原映射', '单位的分割', '变量代换', '微分形式', '单形与链', 'Stokes 定理', '闭形式与恰当形式', '向量分析',
    ]);
    expect(unrecognized.filter((l) => l.reason === 'no-parent')).toEqual([]);
  });
});

describe('页眉页脚与目录页自身页码（规格 1：先去除，不从文本猜）', () => {
  it('「目录」标题与罗马页码 VII 不入树也不入 unrecognized', () => {
    expect(parseTocLines(B05_P7).tree).toEqual(parseTocLines(['VII', '目录', 'V', ...B05_P7]).tree);
    expect(parseTocLines(['VII', '目录']).unrecognized).toEqual([]);
  });

  it('空行与纯空白行忽略（合成）', () => {
    const { tree, unrecognized } = parseTocLines(['', '   ', '\t']);
    expect(tree).toEqual([]);
    expect(unrecognized).toEqual([]);
  });
});

describe('印刷页 → PDF 页偏移（规格 3）', () => {
  it('人工指定 offset 优先，且落 PDF 页序', () => {
    expect(parseTocLines(B05_P7, { offset: 6 }).offset).toBe(6);
  });

  it('无人指定也无正文页文本时 offset 取 0（由面板提示人工填）', () => {
    expect(parseTocLines(B05_P7).offset).toBe(0);
  });

  it('自动试算＝首章标题正文侧首次出现页 − 其印刷页码（合成 bodyPages）', () => {
    const { tree } = parseTocLines(B05_P7);
    const bodyPages = [
      { page: 27, text: '第2章 基础拓扑' },
      { page: 7, text: '第1章 实数系和复数系' },
    ];
    expect(estimateTocOffset(tree, bodyPages)).toBe(6);
    expect(parseTocLines(B05_P7, { bodyPages }).offset).toBe(6);
  });

  it('自动试算容得下正文侧不带序号的章题（合成）', () => {
    const { tree } = parseTocLines(B05_P7);
    expect(estimateTocOffset(tree, [{ page: 9, text: '实数系和复数系' }])).toBe(8);
  });

  it('正文侧找不到首章 → null（人工填 offset）', () => {
    const { tree } = parseTocLines(B05_P7);
    expect(estimateTocOffset(tree, [{ page: 9, text: '习题解答' }])).toBeNull();
    expect(estimateTocOffset([], [])).toBeNull();
  });
});

describe('outline 写入形状（规格 3：相邻首尾相接、末章取 pageCount）', () => {
  it('b05 p7 + offset 6 + 全书 317 页 → 章范围与节范围', () => {
    const { tree } = parseTocLines(B05_P7);
    const payload = toOutlinePayload(tree, 6, 317);
    expect(payload[0]).toEqual({
      name: '第1章 实数系和复数系',
      page_start: 7,
      page_end: 26,
      children: [
        { name: '导引', page_start: 7, page_end: 7, children: [] },
        { name: '有序集', page_start: 8, page_end: 9, children: [] },
        { name: '域', page_start: 10, page_end: 12, children: [] },
        { name: '实数域', page_start: 13, page_end: 15, children: [] },
        { name: '广义实数系', page_start: 16, page_end: 16, children: [] },
        { name: '复数域', page_start: 16, page_end: 18, children: [] },
        { name: '欧氏空间', page_start: 19, page_end: 26, children: [] },
      ],
    });
    expect(payload[1]).toEqual({
      name: '第2章 基础拓扑', page_start: 27, page_end: 317, children: [],
    });
  });

  it('越界页范围回夹：page_start≥1 且 page_end≥page_start（合成 offset 为负）', () => {
    const { tree } = parseTocLines(['第一章 甲 …… 1', '第一节 乙 …… 2', '第二章 丙 …… 3']);
    const payload = toOutlinePayload(tree, -5, 200);
    expect(payload[0].page_start).toBe(1);
    expect(payload[0].page_end).toBe(1);
    expect(payload[0].children[0].page_end).toBeGreaterThanOrEqual(payload[0].children[0].page_start);
    expect(payload[1]).toMatchObject({ page_start: 1, page_end: 200 });
  });

  it('末节尾＝本章尾（不再越到下一章）', () => {
    const { tree } = parseTocLines(['第一章 甲 …… 1', '第一节 乙 …… 2', '第二章 丙 …… 10']);
    const payload = toOutlinePayload(tree, 6, 317);
    expect(payload[0].children[0].page_end).toBe(payload[0].page_end);
    expect(payload[0].page_end).toBe(15);
  });
});

describe('块文本 → 目录行（规格 1：多行块按行拆开，供导入面板消费）', () => {
  it('单个 paragraph 块内含换行时逐行拆开，空行与首尾空白剔除', () => {
    const lines = tocLinesFromBlockTexts(['目录\n第1章 实数系和复数系…… 1\n\n  导引 …… 1  ']);
    expect(lines).toEqual(['目录', '第1章 实数系和复数系…… 1', '导引 …… 1']);
  });

  it('多块按块序拼接（两栏目录页 = 两块），空文本块与空数组不报错', () => {
    expect(tocLinesFromBlockTexts(['有序集 …… 2', '', '域 …… 4'])).toEqual(['有序集 …… 2', '域 …… 4']);
    expect(tocLinesFromBlockTexts([])).toEqual([]);
    expect(tocLinesFromBlockTexts([''])).toEqual([]);
  });

  it('拆出的行可直接进解析：与逐行夹具得到同一棵树', () => {
    const fromBlocks = tocLinesFromBlockTexts([B05_P7.join('\n'), B05_P8_COL_A.join('\n')]);
    expect(parseTocLines(fromBlocks).tree.map((n) => n.name)).toEqual(parseTocLines([...B05_P7, ...B05_P8_COL_A]).tree.map((n) => n.name));
  });
});
