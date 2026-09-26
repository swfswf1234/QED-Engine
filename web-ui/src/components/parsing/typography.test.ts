import { describe, it, expect, beforeEach } from 'vitest';
import type { Block } from '../../api/axiom';
import {
  assignRoles, bodyFontFamily, clampLevel, DEFAULT_TYPOGRAPHY, FONT_LADDER_LABELS,
  FONT_LADDER_PT, headingLevelFor, HEADING_FONT_FAMILY, isSectionHeadingText,
  isTocHeadingText, levelPx,
  loadTypographyPrefs, ptToPx, roleTypography, saveTypographyPrefs, symbolLineParts,
  tocItemParts,
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
    expect(tocItemParts('函数极限与连续性 ……… 12')).toEqual({ title: '函数极限与连续性', page: '12' });
  });
  it('西文句点点线', () => {
    expect(tocItemParts('Introduction..........3')).toEqual({ title: 'Introduction', page: '3' });
  });
  it('空白分隔页码', () => {
    expect(tocItemParts('牛顿-莱布尼茨公式 24')).toEqual({ title: '牛顿-莱布尼茨公式', page: '24' });
  });
  it('无页码 → page 空串；标题尾数不误拆（无分隔符）', () => {
    expect(tocItemParts('无页码条目')).toEqual({ title: '无页码条目', page: '' });
    expect(tocItemParts('Vol.2')).toEqual({ title: 'Vol.2', page: '' });
  });
  it('list items 逐条拆分', () => {
    expect(tocItemParts('第一章 绪论……7  ')).toEqual({ title: '第一章 绪论', page: '7' });
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

  it('保存后可读回', () => {
    saveTypographyPrefs({ bodyFont: 'KaiTi', bodyLevel: 3, showFurniture: true });
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
