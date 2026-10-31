import { describe, expect, it } from 'vitest';
import { isChapterTocEntry } from './components/parsing/typography';
import {
  autoLocateToc, estimateTocOffset, parseTocLines, toOutlinePayload, tocLinesFromBlockTexts,
  type BodyPageText, type TocNode, type TocUnrecognizedLine,
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

/**
 * 夹具＝b05 目录页实测原文（8900 `GET /api/v1/books/mathanalysis-b05/pages/7` 的 paragraph 块整文本）。
 * DEFECT-025 的四例失真原样在内：黏行 `第4章 连续性 …… 73函数的极限 …… 73`，
 * 折行 `无限极限与在无穷远点的`／`极限 …… 84`、`第6章 RIEMANN-STIEI.`／`TJES积分 …… 107`、
 * `第7章 函数序列与函数项`／`级数 …… 129`。
 */
const B05_P7_RAW = [
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
  '有限集、可数集和不可数集 …… 21',
  '度量空间 …… 26',
  '紧集 …… 31',
  '完全集 …… 35',
  '连通集 …… 36',
  '习题 …… 36',
  '第3章 数列与级数 …… 41',
  '收敛序列 …… 41',
  '子序列 …… 44',
  'Cauchy 序列 …… 45',
  '上极限和下极限 …… 47',
  '一些特殊序列 …… 49',
  '级数 …… 50',
  '非负项级数 …… 52',
  '数 e …… 54',
  '根值验敛法与比率验敛法 …… 56',
  '幂级数 …… 59',
  '分部求和法 …… 60',
  '绝对收敛 …… 61',
  '级数的加法和乘法 …… 62',
  '级数的重排 …… 65',
  '习题 …… 67',
  '第4章 连续性 …… 73函数的极限 …… 73',
  '连续函数 …… 74',
  '连续性与紧性 …… 77',
  '连续性与连通性 …… 81',
  '间断 …… 81',
  '单调函数 …… 83',
  '无限极限与在无穷远点的',
  '极限 …… 84',
  '习题 …… 85',
  '第5章 微分法 …… 91',
  '实函数的导数 …… 91',
  '中值定理 …… 94',
  '导数的连续性 …… 95',
  "L'Hospital法则 …… 95",
  '高阶导数 …… 97',
  'Taylor定理 …… 97',
  '向量值函数的微分法 …… 98',
  '习题 …… 100',
  '第6章 RIEMANN-STIEI.',
  'TJES积分 …… 107',
  '积分的定义和存在性 …… 107',
  '积分的性质 …… 114',
  '积分与微分 …… 119',
  '向量值函数的积分 …… 120',
  '可求长曲线 …… 122',
  '习题 …… 123',
  '第7章 函数序列与函数项',
  '级数 …… 129',
  '主要问题的讨论 …… 129',
  '一致收敛性 …… 132',
  '一致收敛性与连续性 …… 133',
  '一致收敛性与积分 …… 136',
  '一致收敛性与微分 …… 136',
  '等度连续的函数族 …… 139',
  'Stone-Weierstrass定理 …… 142',
].join('\n');

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

  it('展示面判据＝抽取腿判据（DEFECT-025 甲案：章加粗不造第二套正则）', () => {
    const { tree } = parseTocLines(tocLinesFromBlockTexts([B05_P7_RAW]));
    expect(tree.every((chapter) => isChapterTocEntry(chapter.name))).toBe(true);
    expect(tree.flatMap((chapter) => chapter.children).every((section) => !isChapterTocEntry(section.name))).toBe(true);
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

describe('目录进场自动定位（REQ-105 §7 步 0：只读已解析块文本，置信不足即不写）', () => {
  const AUTO_PAGES: BodyPageText[] = [
    { page: 6, text: '前言\n本书面向初学者。\n作者' },
    { page: 7, text: B05_P7.join('\n') },
    { page: 8, text: `${B05_P8_COL_A.join('\n')}\n${B05_P8_COL_B.join('\n')}` },
    { page: 9, text: '' },
    { page: 10, text: '第1章 实数系和复数系\n导引\n实数系的完备性公理……' },
    { page: 11, text: '有序集\n上界与下界' },
  ];

  it('命中时给出目录段与正文起页，偏移＝首章正文出现页 − 印刷页', () => {
    const result = autoLocateToc(AUTO_PAGES);
    expect(result.ok).toBe(true);
    expect(result).toMatchObject({ tocStart: 7, tocEnd: 8, bodyStart: 10, offset: 9 });
    expect(result.tree?.map((node) => node.name)).toEqual([
      '第1章 实数系和复数系', '第2章 基础拓扑', '第8章 一些特殊函数',
    ]);
  });

  it('目录段在第一个非目录形态页前终止（空白页不续），且不越过正文起页', () => {
    const result = autoLocateToc(AUTO_PAGES);
    expect(result.tocEnd).toBe(8);
    expect((result.bodyStart ?? 0)).toBeGreaterThan(result.tocEnd ?? 0);
  });

  it('首章 PDF 起始页＝自动试算的正文起页（写入形状与偏移自洽）', () => {
    const result = autoLocateToc(AUTO_PAGES);
    const payload = toOutlinePayload(result.tree ?? [], result.offset ?? 0, 317);
    expect(payload[0].page_start).toBe(10);
    expect(payload[0].page_end).toBeLessThan(payload[1].page_start);
  });

  it('未识别行随结果返回（附录/习题类剔除不静默丢弃）', () => {
    const result = autoLocateToc(AUTO_PAGES);
    expect(result.unrecognized?.some((line) => line.reason === 'excluded')).toBe(true);
  });

  it('无目录页 → no-toc-page，不写入任何猜测值', () => {
    const result = autoLocateToc([
      { page: 1, text: '封面\n书名' },
      { page: 2, text: '版权页\nISBN' },
      { page: 3, text: '第1章 开端\n正文' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.failure).toBe('no-toc-page');
    expect(result.tree ?? []).toHaveLength(0);
  });

  it('有目录页但拆不出章题 → no-chapter-lines', () => {
    const result = autoLocateToc([
      { page: 5, text: '目录\n导引 …… 1\n有序集 …… 2\n域 …… 4' },
      { page: 6, text: '导引\n正文开始' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.failure).toBe('no-chapter-lines');
  });

  it('目录段之后正文侧找不到章题 → no-body-start', () => {
    const result = autoLocateToc([
      { page: 5, text: '目录\n第1章 实数系和复数系…… 1\n第2章 基础拓扑…… 21' },
      { page: 6, text: '导引\n实数系的完备性公理' },
      { page: 7, text: '有序集\n上界与下界' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.failure).toBe('no-body-start');
  });

  it('页序乱序输入不影响定位结果（按页号升序消费）', () => {
    const shuffled = [...AUTO_PAGES].reverse();
    expect(autoLocateToc(shuffled)).toMatchObject({ tocStart: 7, tocEnd: 8, bodyStart: 10, offset: 9 });
  });
});

/**
 * 守则一＋守则二（DEFECT-025，2026-10-25 用户裁「先清洗再搬」）。
 * 原判据下的实测缺陷＝第6章与第7章整章从目录正本消失、三枚折行后半降为节行并错挂上一个章。
 */
describe('目录清洗防线（守则一行内剔离＋守则二碎片拼回）', () => {
  const clean = () => parseTocLines(tocLinesFromBlockTexts([B05_P7_RAW]));

  it('b05 第7页整块重取＝章行 7 枚，第6章与第7章不再整章缺失', () => {
    expect(titles(clean().tree)).toEqual([
      '第1章 实数系和复数系', '第2章 基础拓扑', '第3章 数列与级数', '第4章 连续性',
      '第5章 微分法', '第6章 RIEMANN-STIEI.TJES积分', '第7章 函数序列与函数项级数',
    ]);
  });

  it('黏行的第二条与三枚折行后半各归正确父级（不再错挂上一个章）', () => {
    const { tree } = clean();
    expect(titles(tree[3].children)).toEqual([
      '函数的极限', '连续函数', '连续性与紧性', '连续性与连通性', '间断', '单调函数', '无限极限与在无穷远点的极限',
    ]);
    expect(titles(tree[5].children)).toEqual([
      '积分的定义和存在性', '积分的性质', '积分与微分', '向量值函数的积分', '可求长曲线',
    ]);
    expect(titles(tree[6].children)).toEqual([
      '主要问题的讨论', '一致收敛性', '一致收敛性与连续性', '一致收敛性与积分', '一致收敛性与微分',
      '等度连续的函数族', 'Stone-Weierstrass定理',
    ]);
  });

  it('零丢弃零残点＝碎片全被拼回，且目录名内不含引导点与尾数', () => {
    const { tree, unrecognized } = clean();
    expect(unrecognized.filter((line) => line.reason === 'no-page')).toEqual([]);
    const names = tree.flatMap((node) => [node.name, ...node.children.map((child) => child.name)]);
    expect(names).toHaveLength(7 + 7 + 5 + 14 + 7 + 7 + 5 + 7);
    // 残点＝引导点串（省略号字形或连续两枚以上点线）；`RIEMANN-STIEI.TJES` 的词内单点不算
    expect(names.filter((name) => /[…⋯]|[.·•–—－]{2,}/.test(name) || /\d\s*$/.test(name))).toEqual([]);
    expect(reasons(unrecognized)).toEqual(['excluded', 'excluded', 'excluded', 'excluded', 'excluded', 'excluded', 'excluded']);
  });

  it('碎片拼回按语种接缝：中日文直连、西文词尾点号直连、纯西文补一个空格', () => {
    const hyphen = parseTocLines(['第6章 RIEMANN-STIEI.', 'TJES积分 …… 107']);
    expect(hyphen.tree[0].name).toBe('第6章 RIEMANN-STIEI.TJES积分');
    expect(hyphen.tree[0].printPage).toBe(107);
    const latin = parseTocLines(['FUNCTIONS OF', 'REAL VARIABLES …… 301']);
    expect(latin.tree.map((node) => node.name)).toEqual([]);
    expect(reasons(latin.unrecognized)).toEqual(['no-parent']);
    expect(latin.unrecognized[0].raw).toBe('FUNCTIONS OF REAL VARIABLES …… 301');
  });

  it('拼回后仍是章题判定＝章号不丢（第7章形态）', () => {
    const { tree } = parseTocLines(['第7章 函数序列与函数项', '级数 …… 129', '主要问题的讨论 …… 129']);
    expect(tree.map((node) => node.name)).toEqual(['第7章 函数序列与函数项级数']);
    expect(titles(tree[0].children)).toEqual(['主要问题的讨论']);
  });

  it('末尾拼不出页码的碎片不静默丢弃（no-page 语义保留）', () => {
    const { tree, unrecognized } = parseTocLines(['第1章 甲 …… 1', '导引', '有序集 …… 2', '尾行断在标题上']);
    expect(titles(tree[0].children)).toEqual(['导引有序集']);
    expect(unrecognized).toEqual([{ raw: '尾行断在标题上', reason: 'no-page', page: null }]);
  });

  it('黏行拆分后的两条目不共享同一 identity（父级随章题推进）', () => {
    const { tree } = parseTocLines(['第4章 连续性 …… 73函数的极限 …… 73', '连续函数 …… 74']);
    expect(tree).toHaveLength(1);
    expect(titles(tree[0].children)).toEqual(['函数的极限', '连续函数']);
    expect(tree[0].children.map((child) => child.printPage)).toEqual([73, 74]);
  });

  it('自动定位在同一条清洗腿上跑通（进场自动目录＝清洗后正本可直写）', () => {
    const result = autoLocateToc([
      { page: 7, text: `目录\n${B05_P7_RAW}` },
      { page: 9, text: '第1章 实数系和复数系\n导引\n正文' },
    ]);
    expect(result.ok).toBe(true);
    expect(result.tree.map((node) => node.name)).toEqual([
      '第1章 实数系和复数系', '第2章 基础拓扑', '第3章 数列与级数', '第4章 连续性',
      '第5章 微分法', '第6章 RIEMANN-STIEI.TJES积分', '第7章 函数序列与函数项级数',
    ]);
  });
});
