import { describe, it, expect, beforeEach } from 'vitest';
import type { Block } from '../../api/axiom';
import { blockText } from './blocks';
import {
  assignRoles, bodyFontFamily, clampLevel, DEFAULT_TYPOGRAPHY, FONT_LADDER_LABELS,
  FONT_LADDER_PT, headingLevelFor, HEADING_FONT_FAMILY, isSectionHeadingText,
  indentForDepth, INDENT_STEPS_PX, isSentenceClosed, headingDepthOf, isTocHeadingText, layoutUnits, levelPx,
  loadTypographyPrefs, ptToPx, roleTypography, symbolLineParts,
  tocEntriesFromLine,
  isChapterTocEntry, tocEntryRowStyle, isTocLikeLine, tocLikeRatio,
  TYPOGRAPHY_STORAGE_KEY,
  type BlockRole, type TypographyPrefs,
} from './typography';

const mk = (type: string, extra: Partial<Block> = {}): Block => ({ type, bbox: [0, 0, 10, 10], ...extra });

describe('字号阶梯（parsing-ui §9.1，五号～一号硬约束）', () => {
  it('9 级：最小五号 10.5pt、最大一号 26pt', () => {
    expect(FONT_LADDER_PT).toHaveLength(9);
    expect(FONT_LADDER_PT[0]).toBe(10.5);
    expect(FONT_LADDER_PT[8]).toBe(26);
    expect(FONT_LADDER_LABELS[0]).toBe('五号');
    expect(FONT_LADDER_LABELS[8]).toBe('一号');
  });

  it('pt→px 为 ×4/3（96dpi）', () => {
    expect(ptToPx(10.5)).toBeCloseTo(14);
    expect(levelPx(0)).toBeCloseTo(14);
    expect(levelPx(8)).toBeCloseTo(26 * 4 / 3);
  });

  it('clampLevel 越界回区间、四舍五入', () => {
    expect(clampLevel(-2)).toBe(0);
    expect(clampLevel(9)).toBe(8);
    expect(clampLevel(2.4)).toBe(2);
    expect(clampLevel(2.6)).toBe(3);
  });
});

describe('标题级差自动推导（大标题=正文+4，小标题=+2，三级+=1，封顶 L8）', () => {
  it('正文 L0：一级=4、二级=2、三级=1、四级及以下=1', () => {
    expect(headingLevelFor(0, 1)).toBe(4);
    expect(headingLevelFor(0, 2)).toBe(2);
    expect(headingLevelFor(0, 3)).toBe(1);
    expect(headingLevelFor(0, 5)).toBe(1);
  });

  it('正文 L4：一级=8（+4）、二级=6、三级=5', () => {
    expect(headingLevelFor(4, 1)).toBe(8);
    expect(headingLevelFor(4, 2)).toBe(6);
    expect(headingLevelFor(4, 3)).toBe(5);
  });

  it('一律封顶 L8；正文 L8 时标题同封顶（一号为最大，不再放大）', () => {
    expect(headingLevelFor(5, 1)).toBe(8);
    expect(headingLevelFor(6, 2)).toBe(8);
    expect(headingLevelFor(8, 1)).toBe(8);
  });

  it('正文级 ≤7 时标题恒大于正文', () => {
    for (let body = 0; body <= 7; body += 1) {
      for (const h of [1, 2, 3]) expect(headingLevelFor(body, h)).toBeGreaterThan(body);
    }
  });
});

describe('字体角色映射（西文 Times New Roman 前置）', () => {
  it('正文族随偏好切换', () => {
    expect(bodyFontFamily('SimSun')).toBe("'Times New Roman', SimSun");
    expect(bodyFontFamily('SimHei')).toBe("'Times New Roman', SimHei");
    expect(bodyFontFamily('KaiTi')).toBe("'Times New Roman', KaiTi");
  });

  it('标题恒黑体', () => {
    expect(HEADING_FONT_FAMILY).toBe("'Times New Roman', SimHei");
  });

  it('roleTypography：正文/标题/目录/题注/furniture 各自字号与字族', () => {
    const prefs: TypographyPrefs = { bodyFont: 'SimSun', bodyLevel: 0, showFurniture: true };
    const body = roleTypography('body', mk('paragraph'), prefs);
    expect(body.fontSizePx).toBeCloseTo(14);
    expect(body.fontFamily).toBe("'Times New Roman', SimSun");

    const h1 = roleTypography('heading', mk('heading', { level: 1 }), prefs);
    expect(h1.fontSizePx).toBeCloseTo(levelPx(4));
    expect(h1.fontFamily).toBe(HEADING_FONT_FAMILY);

    const toc = roleTypography('toc', mk('list'), prefs);
    expect(toc.fontSizePx).toBeCloseTo(levelPx(0));
    expect(toc.fontFamily).toBe("'Times New Roman', KaiTi");

    const cap = roleTypography('caption', mk('caption'), prefs);
    expect(cap.fontSizePx).toBeCloseTo(levelPx(0));
    expect(cap.fontFamily).toBe("'Times New Roman', KaiTi");

    const fur = roleTypography('furniture', mk('header'), prefs);
    expect(fur.fontFamily).toBe("'Times New Roman', SimSun");
  });
});

describe('目录启发式识别（R4 承接前兜底）', () => {
  it('目录/目 次/Contents 命中，正文不命中', () => {
    expect(isTocHeadingText('目录')).toBe(true);
    expect(isTocHeadingText('目 次')).toBe(true);
    expect(isTocHeadingText(' Contents ')).toBe(true);
    expect(isTocHeadingText('CONTENTS')).toBe(true);
    expect(isTocHeadingText('引言')).toBe(false);
    expect(isTocHeadingText('目录学')).toBe(false);
  });

  it('assignRoles：目录 heading 后连续 list/paragraph → toc，下一 heading 终止', () => {
    const blocks: Block[] = [
      mk('paragraph', { text: '前言正文' }),
      mk('heading', { level: 1, text: '目录' }),
      mk('list', { items: ['一 极限……1'] }),
      mk('paragraph', { text: '二 导数……5' }),
      mk('heading', { level: 1, text: '第一章' }),
      mk('paragraph', { text: '章正文' }),
    ];
    const roles = assignRoles(blocks);
    expect(roles).toEqual<BlockRole[]>(['body', 'heading', 'toc', 'toc', 'heading', 'body']);
  });

  it('assignRoles：非连续（中间隔 formula）终止目录区；caption/页眉类归位', () => {
    const blocks: Block[] = [
      mk('heading', { text: '目录' }),
      mk('paragraph', { text: '条目A' }),
      mk('formula', { latex: 'x^2' }),
      mk('paragraph', { text: '条目B' }),
      mk('caption', { caption: '图 1' }),
      mk('header', { text: '页眉文字' }),
      mk('page_number', { text: '3' }),
    ];
    expect(assignRoles(blocks)).toEqual<BlockRole[]>(
      ['heading', 'toc', 'body', 'body', 'caption', 'furniture', 'furniture'],
    );
  });

  it('assignRoles：首个目录 heading 之前的正文不受影响；目录区延伸至页尾（无后续 heading）', () => {
    const blocks: Block[] = [
      mk('heading', { level: 1, text: '目录' }),
      mk('list', { items: ['a'] }),
      mk('paragraph', { text: 'b' }),
    ];
    expect(assignRoles(blocks)).toEqual<BlockRole[]>(['heading', 'toc', 'toc']);
  });
});

describe('目录条目拆分（点线 + 页码右对齐数据源）', () => {
  it('中文点线 + 尾数页码', () => {
    expect(tocEntriesFromLine('函数极限与连续性 ……… 12')).toEqual([
      { title: '函数极限与连续性', page: '12', segment: '函数极限与连续性 ……… 12' },
    ]);
  });
  it('西文句点点线', () => {
    expect(tocEntriesFromLine('Introduction..........3')).toEqual([
      { title: 'Introduction', page: '3', segment: 'Introduction..........3' },
    ]);
  });
  it('空白分隔页码', () => {
    expect(tocEntriesFromLine('牛顿-莱布尼茨公式 24')).toEqual([
      { title: '牛顿-莱布尼茨公式', page: '24', segment: '牛顿-莱布尼茨公式 24' },
    ]);
  });
  it('无页码 → page 空串；标题尾数不误拆（无分隔符）', () => {
    expect(tocEntriesFromLine('无页码条目')).toEqual([{ title: '无页码条目', page: '', segment: '无页码条目' }]);
    expect(tocEntriesFromLine('Vol.2')).toEqual([{ title: 'Vol.2', page: '', segment: 'Vol.2' }]);
  });
  it('list items 逐条拆分', () => {
    expect(tocEntriesFromLine('第一章 绪论……7  ')).toEqual([
      { title: '第一章 绪论', page: '7', segment: '第一章 绪论……7' },
    ]);
  });
});

/**
 * 守则一・行内引导点与页码一律剔离（DEFECT-025，2026-10-25）。
 * 夹具原文＝8900 `GET /api/v1/books/mathanalysis-b05/pages/7` 与 `/pages/8` 的 paragraph 块行。
 * 原实现把清理正则锚在行尾 ⇒ 黏行把中间页码留在名里（现网章名 `第4章 连续性 …… 73函数的极限` 即其产物）。
 */
describe('目录条目清洗・守则一（一行可出多条，行内引导点与页码一律剔离）', () => {
  it('黏行拆成两条干净条目（b05 p7 实测原文）', () => {
    expect(tocEntriesFromLine('第4章 连续性 …… 73函数的极限 …… 73')).toEqual([
      { title: '第4章 连续性', page: '73', segment: '第4章 连续性 …… 73' },
      { title: '函数的极限', page: '73', segment: '函数的极限 …… 73' },
    ]);
  });

  it('黏行中间夹 LaTeX 只剥引导点与页码、不动正文（b05 p8 实测原文）', () => {
    const entries = tocEntriesFromLine('复函数的积分 …… 296 $\\mathscr{L}^2$ 类的函数 …… 297');
    expect(entries.map((item) => [item.title, item.page])).toEqual([
      ['复函数的积分', '296'], ['$\\mathscr{L}^2$ 类的函数', '297'],
    ]);
  });

  it('条目尾的孤立引导点不留空碎片，也不进该条目的原样片段（黏行被列边界切断）', () => {
    expect(tocEntriesFromLine('连续函数 …… 74…')).toEqual([
      { title: '连续函数', page: '74', segment: '连续函数 …… 74' },
    ]);
  });

  it('下一条目以点线开头时先剥前置引导点（列边界切断的黏行）', () => {
    expect(tocEntriesFromLine('函数的极限………73…连续函数 …… 74').map((item) => item.title))
      .toEqual(['函数的极限', '连续函数']);
  });

  it('折行的前半截＝只出无页码碎片，单点与章号数字不误拆（b05 p7 实测原文）', () => {
    expect(tocEntriesFromLine('第6章 RIEMANN-STIEI.')).toEqual([
      { title: '第6章 RIEMANN-STIEI.', page: '', segment: '第6章 RIEMANN-STIEI.' },
    ]);
    expect(tocEntriesFromLine('Vol.2')).toEqual([{ title: 'Vol.2', page: '', segment: 'Vol.2' }]);
    expect(tocEntriesFromLine('第 11 章 LEBESGUE 理论 …… 275')).toHaveLength(1);
  });

  it('单条目行只出一条（既有读法不回归）', () => {
    for (const line of [
      '函数极限与连续性 ……… 12', 'Introduction..........3',
      '牛顿-莱布尼茨公式 24', '第1章 实数系和复数系…… 1', '无页码条目',
    ]) {
      expect(tocEntriesFromLine(line)).toHaveLength(1);
    }
  });

  it('空文本与纯空白不报错', () => {
    expect(tocEntriesFromLine('')).toEqual([]);
    expect(tocEntriesFromLine('   ')).toEqual([]);
  });
});

describe('章题判定单点（DEFECT-025 展示面・章加粗＋节缩进的判据源）', () => {
  it('第 N 章（阿拉伯／中文序号／带空白）与 Chapter N 判为章', () => {
    for (const title of ['第4章 连续性', '第 11 章 LEBESGUE 理论', '第一章 实数系', 'Chapter 3 Series']) {
      expect(isChapterTocEntry(title)).toBe(true);
    }
  });

  it('节题、编号题、条目内出现「章」字的普通题判为节', () => {
    for (const title of ['函数的极限', '连续函数', '1.2 微分中值定理', '第 3 节 一致收敛', '章末总结', 'RIEMANN 积分']) {
      expect(isChapterTocEntry(title)).toBe(false);
    }
  });

  it('层级样式＝章加粗不缩进、节不加粗缩进一档（甲案形态）', () => {
    expect(tocEntryRowStyle('第4章 连续性')).toEqual({ fontWeight: 600, paddingLeft: INDENT_STEPS_PX[0] });
    expect(tocEntryRowStyle('函数的极限')).toEqual({ paddingLeft: INDENT_STEPS_PX[1] });
  });
});

describe('目录密度判据（DEFECT-025 展示面・目录续页无标题也按目录渲染）', () => {
  it('整页目录续页（本行内无「目录」标题）＝命中 toc 角色，不再当正文铺出残点', () => {
    const blocks = [mk('paragraph', { text: 'VII\n习题 …… 148\n第8章 一些特殊函数 …… 155\n幂级数 …… 155\n三角函数 …… 164' })];
    expect(assignRoles(blocks)).toEqual(['toc']);
  });

  it('正文页（带页码形态行不过半）仍为 body，不误判成目录', () => {
    const blocks = [mk('paragraph', { text: '设 f 在闭区间上连续。\n由介值定理可知 f 取到最值。\n下面给出证明。' })];
    expect(assignRoles(blocks)).toEqual(['body']);
  });

  it('isTocLikeLine＝拆得出带页码条目才算；目录标题与纯罗马页码是噪声', () => {
    expect(isTocLikeLine('幂级数 …… 155')).toBe(true);
    expect(isTocLikeLine('第4章 连续性 …… 73函数的极限 …… 73')).toBe(true);
    expect(isTocLikeLine('目录')).toBe(false);
    expect(isTocLikeLine('VII')).toBe(false);
    expect(isTocLikeLine('由定义可得')).toBe(false);
  });

  it('tocLikeRatio＝分母先剔噪声行，全噪声为 0', () => {
    expect(tocLikeRatio(['VII', '目录'])).toBe(0);
    expect(tocLikeRatio(['幂级数 …… 155', '三角函数 …… 164', '由定义可得'])).toBeCloseTo(2 / 3, 6);
  });
});

describe('版式偏好持久化（localStorage，默认正文五号宋体、页眉页脚隐藏）', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('默认：宋体、L0 五号、furniture 隐藏（用户裁决）', () => {
    expect(DEFAULT_TYPOGRAPHY).toEqual({ bodyFont: 'SimSun', bodyLevel: 0, showFurniture: false });
    expect(loadTypographyPrefs()).toEqual(DEFAULT_TYPOGRAPHY);
  });

  it('盘上已有偏好就读回（界面写腿随「排版」面板一并撤除，读腿保留）', () => {
    localStorage.setItem(TYPOGRAPHY_STORAGE_KEY, JSON.stringify({ bodyFont: 'KaiTi', bodyLevel: 3, showFurniture: true }));
    expect(loadTypographyPrefs()).toEqual({ bodyFont: 'KaiTi', bodyLevel: 3, showFurniture: true });
  });

  it('损坏 JSON → 默认值', () => {
    localStorage.setItem(TYPOGRAPHY_STORAGE_KEY, '{oops');
    expect(loadTypographyPrefs()).toEqual(DEFAULT_TYPOGRAPHY);
  });

  it('非法字段逐项回退默认（越界字号夹紧、未知字体回退）', () => {
    localStorage.setItem(TYPOGRAPHY_STORAGE_KEY, JSON.stringify({ bodyFont: 'Comic', bodyLevel: 99, showFurniture: 'yes' }));
    const p = loadTypographyPrefs();
    expect(p.bodyFont).toBe('SimSun');
    expect(p.bodyLevel).toBe(8);
    expect(p.showFurniture).toBe(false);
  });
});

describe('W7 节题白名单（类标题，parsing-ui §9.1）', () => {
  it('全文命中：目录/目次/Contents（大小写与空白不敏感）等白名单节题', () => {
    expect(isSectionHeadingText('目 录')).toBe(true);
    expect(isSectionHeadingText('Contents')).toBe(true);
    expect(isSectionHeadingText('重要符号表')).toBe(true);
    expect(isSectionHeadingText('致谢')).toBe(true);
  });

  it('子串不命中（防误伤正文）', () => {
    expect(isSectionHeadingText('目录学是重要分支')).toBe(false);
    expect(isSectionHeadingText('前言后记')).toBe(false);
    expect(isSectionHeadingText('本章介绍索引结构')).toBe(false);
  });

  it('白名单节题 paragraph → heading 角色并触发目录组', () => {
    const roles = assignRoles([
      mk('paragraph', { text: '目录' }),
      mk('paragraph', { text: '第1章 实数系…… 1\n导引 …… 1' }),
      mk('heading', { level: 1, text: '第一章' }),
    ]);
    expect(roles[0]).toBe('heading');
    expect(roles[1]).toBe('toc');
    expect(roles[2]).toBe('heading');
  });

  it('多行段落不算节题', () => {
    expect(assignRoles([mk('paragraph', { text: '目录\n正文' })])[0]).toBe('body');
  });
});

describe('W7 符号表行式与三列拆分', () => {
  it('符号 + 说明 + 尾部页码命中', () => {
    expect(symbolLineParts('∈ 属于 2')).toEqual({ symbol: '∈', desc: '属于', page: '2' });
    expect(symbolLineParts('⊂,⊃ 包含符号 2')).toEqual({ symbol: '⊂,⊃', desc: '包含符号', page: '2' });
    expect(symbolLineParts('+∞,-∞,∞ 无穷大 10,23')).toEqual({ symbol: '+∞,-∞,∞', desc: '无穷大', page: '10,23' });
    expect(symbolLineParts('Re(z) 实部 12')).toEqual({ symbol: 'Re(z)', desc: '实部', page: '12' });
    expect(symbolLineParts('U(P,f),U(P,f,a),L(P,f), L(P,f,a) Riemann 和 107,108')?.page).toBe('107,108');
  });

  it('非行式返回 null', () => {
    expect(symbolLineParts('下表所列符号附以简短说明及其定义所在之页数。')).toBeNull();
    expect(symbolLineParts('')).toBeNull();
    expect(symbolLineParts('只有一个词')).toBeNull();
    expect(symbolLineParts('行尾页码不是纯数字 第12页')).toBeNull();
  });

  it('块命中率 ≥60% → symbolTable；引言行不断组，下一 heading 断组', () => {
    const rows = Array.from({ length: 10 }, (_, i) => `s${i} 说明${i} ${i + 1}`).join('\n');
    const roles = assignRoles([
      mk('paragraph', { text: '重要符号表' }),
      mk('paragraph', { text: '下表所列符号附以简短说明及其定义所在之页数。' }),
      mk('paragraph', { text: rows }),
      mk('heading', { level: 1, text: '下一章' }),
    ]);
    expect(roles[0]).toBe('heading');
    expect(roles[1]).toBe('body');
    expect(roles[2]).toBe('symbolTable');
    expect(roles[3]).toBe('heading');
  });

  it('命中率不足回落 body', () => {
    const text = ['散文第一行', '散文第二行', '散文第三行 而且不带页码', 's 单独命中一行 5'].join('\n');
    expect(assignRoles([
      mk('paragraph', { text: '符号表' }),
      mk('paragraph', { text }),
    ])[1]).toBe('body');
  });

  it('symbolTable 样式=正文族与正文级字号', () => {
    const st = roleTypography('symbolTable', mk('paragraph'), DEFAULT_TYPOGRAPHY);
    expect(st.fontFamily).toContain('SimSun');
    expect(st.fontSizePx).toBeCloseTo(levelPx(0), 5);
  });
});

describe('W5 排版层止血（§V2.4.1~3：层级左偏移、跨页续段合并、标题重印去重）', () => {
  it('左偏移档位＝0/16/32，三级以上封顶 32', () => {
    expect(INDENT_STEPS_PX).toEqual([0, 16, 32]);
    expect(indentForDepth(1)).toBe(0);
    expect(indentForDepth(2)).toBe(16);
    expect(indentForDepth(3)).toBe(32);
    expect(indentForDepth(7)).toBe(32);
  });

  it('标题层级启发：题号点数定档，「第 N 章/篇」=1、「第 N 节」=2，无题号回落 level', () => {
    expect(headingDepthOf('第 3 章 微分学', 1)).toBe(1);
    expect(headingDepthOf('第三章 积分', undefined)).toBe(1);
    expect(headingDepthOf('第一篇 总论', undefined)).toBe(1);
    expect(headingDepthOf('1.2 序列的极限', undefined)).toBe(2);
    expect(headingDepthOf('1.2.4 例题选讲', undefined)).toBe(3);
    expect(headingDepthOf('小结与回顾', 2)).toBe(2);
    expect(headingDepthOf('小结与回顾', undefined)).toBe(1);
  });

  it('收尾判定：句末标点/冒号视为收尾，未完句不收尾', () => {
    expect(isSentenceClosed('极限的定义')).toBe(false);
    expect(isSentenceClosed('定义如下：')).toBe(true);
    expect(isSentenceClosed('收敛。')).toBe(true);
  });

  it('跨页续段：相邻两个正文块且前块未收尾 → 合并为一段并保留两块来源下标', () => {
    const blocks = [
      mk('paragraph', { text: '设数列' }),
      mk('paragraph', { text: '{xn} 单调增加且有上界。' }),
      mk('paragraph', { text: '则其极限存在。' }),
    ];
    const units = layoutUnits(blocks, assignRoles(blocks));
    expect(units).toHaveLength(2);
    expect(units[0].indices).toEqual([0, 1]);
    expect(blockText(units[0].block)).toBe('设数列{xn} 单调增加且有上界。');
    expect(units[1].indices).toEqual([2]);
  });

  it('已收尾的正文块不合并（保持两段）', () => {
    const blocks = [mk('paragraph', { text: '第一段结束。' }), mk('paragraph', { text: '第二段开始' })];
    const units = layoutUnits(blocks, assignRoles(blocks));
    expect(units.map((u) => u.indices)).toEqual([[0], [1]]);
  });

  it('正文块与最近上级标题同档：节题 16px 下的正文同 16px，子题下 32px', () => {
    const blocks = [
      mk('heading', { text: '1.2 序列的极限' }),
      mk('paragraph', { text: '数列极限是本章的核心概念。' }),
      mk('heading', { text: '1.2.1 子列' }),
      mk('paragraph', { text: '子列沿用收敛性。' }),
    ];
    expect(layoutUnits(blocks, assignRoles(blocks)).map((u) => u.indentPx)).toEqual([16, 16, 32, 32]);
  });

  it('章题档为 0：首章标题与其下正文都不缩进', () => {
    const blocks = [mk('heading', { text: '第一章 实数' }), mk('paragraph', { text: '实数完备性。' })];
    expect(layoutUnits(blocks, assignRoles(blocks)).map((u) => u.indentPx)).toEqual([0, 0]);
  });

  it('同一标题跨页重印只保留首个，其后正文仍归该标题档', () => {
    const blocks = [
      mk('heading', { text: '1.3 函数极限' }),
      mk('paragraph', { text: '定义。' }),
      mk('heading', { text: '1.3 函数极限' }),
      mk('paragraph', { text: '续文。' }),
    ];
    const units = layoutUnits(blocks, assignRoles(blocks));
    expect(units.filter((u) => u.role === 'heading')).toHaveLength(1);
    expect(units).toHaveLength(3);
  });

  it('题注不缩进；家具块保留单元由渲染层决定显隐', () => {
    const blocks = [
      mk('heading', { text: '1.1 节题' }),
      mk('caption', { text: '图 1 示意' }),
      mk('header', { text: '页眉文字' }),
    ];
    expect(layoutUnits(blocks, assignRoles(blocks)).map((u) => [u.role, u.indentPx]))
      .toEqual([['heading', 16], ['caption', 0], ['furniture', 0]]);
  });

  it('公式块不并入文本段（只合并纯文本 paragraph/list）', () => {
    const blocks = [
      mk('paragraph', { text: '由定义可得' }),
      mk('formula', { latex: 'a_n \to a' }),
      mk('paragraph', { text: '成立。' }),
    ];
    expect(layoutUnits(blocks, assignRoles(blocks)).map((u) => u.indices)).toEqual([[0], [1], [2]]);
  });
});
