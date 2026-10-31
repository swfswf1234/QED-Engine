/**
 * 版式重排版排印纯函数（parsing-ui §9.1）：
 * 字号阶梯（五号～一号硬约束）、标题级差推导、字体角色映射、目录启发式、偏好持久化。
 * 版式=重新排版而非原页复刻；流式模式不消费本模块。
 */
import type { Block } from '../../api/axiom';
import { blockText } from './blocks';

export type BodyFontKey = 'SimSun' | 'SimHei' | 'KaiTi';

export const BODY_FONT_LABELS: Record<BodyFontKey, string> = {
  SimSun: '宋体',
  SimHei: '黑体',
  KaiTi: '楷体',
};

/** 中文字号阶梯（pt）：L0 五号 … L8 一号——最小/最大硬界（用户裁决） */
export const FONT_LADDER_PT: readonly number[] = [10.5, 12, 14, 15, 16, 18, 22, 24, 26];
export const FONT_LADDER_LABELS: readonly string[] = [
  '五号', '小四', '四号', '小三', '三号', '小二', '二号', '小一', '一号',
];
export const MAX_LEVEL = FONT_LADDER_PT.length - 1;

export const ptToPx = (pt: number): number => (pt * 4) / 3;

export const clampLevel = (level: number): number =>
  Math.min(MAX_LEVEL, Math.max(0, Math.round(level)));

export const levelPx = (level: number): number => ptToPx(FONT_LADDER_PT[clampLevel(level)]);

/** 标题级差自动推导：大标题=正文+4、小标题（二级）=+2、三级及以下=+1，封顶 L8 */
export const headingLevelFor = (bodyLevel: number, heading: number): number =>
  clampLevel(bodyLevel + (heading <= 1 ? 4 : heading === 2 ? 2 : 1));

/** 字体角色（中英文混排：西文一律 Times New Roman 前置） */
export const bodyFontFamily = (font: BodyFontKey): string => `'Times New Roman', ${font}`;
export const HEADING_FONT_FAMILY = "'Times New Roman', SimHei";
export const TOC_FONT_FAMILY = "'Times New Roman', KaiTi";

export type BlockRole = 'heading' | 'body' | 'caption' | 'toc' | 'symbolTable' | 'furniture';

const TOC_HEADING_RE = /^(目录|目次|contents)$/i;

/** 目录标题启发：文本恰为「目录 / 目 次 / Contents」（大小写与空白归一） */
export function isTocHeadingText(text: string): boolean {
  return TOC_HEADING_RE.test((text ?? '').trim().replace(/\s+/g, ''));
}

/** 目录页自身的页码：b05 p8 实测以 paragraph 块出现「VII」 */
const ROMAN_PAGE_LINE_RE = /^[IVXLCDMivxlcdm]+$/;

/** 噪声行＝空行／目录标题／纯罗马页码：既不算目录形态，也不进密度分母 */
export function isTocNoiseLine(line: string): boolean {
  const text = (line ?? '').trim();
  return text === '' || isTocHeadingText(text) || ROMAN_PAGE_LINE_RE.test(text);
}

/** 目录形态行＝拆得出「引导点＋页码」条目（黏行拆出的多条也算，共用守则一那条拆分腿） */
export function isTocLikeLine(line: string): boolean {
  if (isTocNoiseLine(line)) return false;
  return tocEntriesFromLine(line).some((entry) => entry.page !== '');
}

/** 目录密度＝非噪声行中目录形态行的占比（正文页≈0） */
export function tocLikeRatio(lines: readonly string[]): number {
  const candidates = (lines ?? []).filter((line) => !isTocNoiseLine(line));
  if (candidates.length === 0) return 0;
  return candidates.filter(isTocLikeLine).length / candidates.length;
}

/** 成组门槛（同一枚判据供展示面的目录角色与抽取腿的自动定位续页判定共用） */
export const TOC_LIKE_RATIO = 0.5;

/** 节题白名单（§9.1 类标题，归一化全文匹配：去空白、小写） */
const SECTION_TITLE_SET = new Set([
  '目录', '目次', 'contents', '重要符号表', '符号表',
  '前言', '序', '序言', '后记', '附录', '索引', '参考文献', '致谢',
]);

const normalizeSectionText = (text: string): string =>
  (text ?? '').trim().replace(/\s+/g, '').toLowerCase();

/** 白名单只做全文匹配、不做子串匹配（防误伤正文） */
export function isSectionHeadingText(text: string): boolean {
  return SECTION_TITLE_SET.has(normalizeSectionText(text));
}

/** 符号表类节题（触发 symbolTable 组） */
export function isSymbolTitleText(text: string): boolean {
  const norm = normalizeSectionText(text);
  return norm === '重要符号表' || norm === '符号表';
}

/** 符号表行式：符号（不含空白）+ 说明 + 尾部页码（数字/逗号/顿号/破折号） */
const SYMBOL_LINE_RE = /^(\S+)\s+(.*?)\s+([\d][\d,，、\-–—\s]*)$/;

export function symbolLineParts(line: string): { symbol: string; desc: string; page: string } | null {
  const m = SYMBOL_LINE_RE.exec((line ?? '').trim());
  if (!m) return null;
  return { symbol: m[1], desc: m[2].trim(), page: m[3].trim() };
}

/** 块级行式判定：非空行 ≥2 且命中率 ≥60%（§9.1 符号表三列前提） */
export function isSymbolTableBlock(block: Block): boolean {
  const lines = blockText(block).split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) return false;
  const hits = lines.filter((l) => symbolLineParts(l) !== null).length;
  return hits / lines.length >= 0.6;
}

/**
 * 块角色序列（版式渲染的字号/字族/显隐判据）：
 * 目录 heading **或白名单类标题 paragraph** 后连续 list/paragraph 记为 toc，遇其他类型或下一 heading 终止；
 * 无「目录」标题的目录续页＝该块自身目录密度 ≥ TOC_LIKE_RATIO 也记 toc（DEFECT-025 展示面，b05 第 8 页实测）；
 * 符号表类节题后连续 list/paragraph 中行式命中块记为 symbolTable（引言行保持 body 不断组）；
 * header/footer/page_number 恒为 furniture（版式态默认隐藏）。
 */
export function assignRoles(blocks: Block[]): BlockRole[] {
  const roles: BlockRole[] = [];
  let inToc = false;
  let inSymbol = false;
  for (const b of blocks) {
    if (b.type === 'header' || b.type === 'footer' || b.type === 'page_number') {
      roles.push('furniture');
      inToc = false;
      inSymbol = false;
      continue;
    }
    const text = blockText(b);
    if (b.type === 'heading'
      || (b.type === 'paragraph' && !text.includes('\n') && isSectionHeadingText(text))) {
      roles.push('heading');
      inToc = isTocHeadingText(text);
      inSymbol = isSymbolTitleText(text);
      continue;
    }
    if (b.type === 'caption') {
      roles.push('caption');
      inToc = false;
      inSymbol = false;
      continue;
    }
    if (inToc && (b.type === 'list' || b.type === 'paragraph')) {
      roles.push('toc');
      continue;
    }
    if (inSymbol && (b.type === 'list' || b.type === 'paragraph')) {
      roles.push(isSymbolTableBlock(b) ? 'symbolTable' : 'body');
      continue;
    }
    if (b.type !== 'list' && b.type !== 'paragraph') {
      inToc = false;
      inSymbol = false;
      roles.push('body');
      continue;
    }
    // 目录续页不带「目录」标题（b05 第 8 页实测）＝整块目录密度过半也记 toc，交 TocRows 拆行并标章／节
    if (tocLikeRatio(blockText(b).split('\n')) >= TOC_LIKE_RATIO) {
      roles.push('toc');
      continue;
    }
    roles.push('body');
  }
  return roles;
}

export interface RoleStyle {
  fontSizePx: number;
  fontFamily: string;
  fontWeight?: number;
}

/** 角色 → 字号/字族（heading 按级差推导；正文级用户选；题注/目录楷体正文级） */
export function roleTypography(role: BlockRole, block: Block, prefs: TypographyPrefs): RoleStyle {
  const bodyPx = levelPx(prefs.bodyLevel);
  switch (role) {
    case 'heading':
      return {
        fontSizePx: levelPx(headingLevelFor(prefs.bodyLevel, block.level ?? 1)),
        fontFamily: HEADING_FONT_FAMILY,
        fontWeight: 600,
      };
    case 'toc':
    case 'caption':
      return { fontSizePx: bodyPx, fontFamily: TOC_FONT_FAMILY };
    default:
      return { fontSizePx: bodyPx, fontFamily: bodyFontFamily(prefs.bodyFont) };
  }
}

/** 层级左偏移档位（§V2.4.1）：章题 0 / 节题 16px / 子题及以下 32px，正文随最近上级标题同档 */
export const INDENT_STEPS_PX = [0, 16, 32];

export function indentForDepth(depth: number): number {
  const index = Math.min(INDENT_STEPS_PX.length - 1, Math.max(0, (depth || 1) - 1));
  return INDENT_STEPS_PX[index];
}

/**
 * 标题层级启发：解析侧 `level` 常缺省，题号形态是现网唯一可用信号。
 * 「第 3 章 / 第一篇」=1、「1.2」=2、「1.2.4」=3；无题号时回落 `level`，再回落 1。
 */
export function headingDepthOf(text: string, level?: number): number {
  const t = (text ?? '').trim();
  const numbered = /^(\d+(?:[.．]\d+)*)(?:[\s、．.）)]|$)/u.exec(t);
  if (numbered) return Math.min(INDENT_STEPS_PX.length, numbered[1].split(/[.．]/).length);
  const cn = /^第\s*[\d一二三四五六七八九十百零]+\s*(部分|章|篇|节|部)/u.exec(t);
  if (cn) return cn[1] === '章' || cn[1] === '篇' ? 1 : 2;
  return level && level > 0 ? Math.min(INDENT_STEPS_PX.length, level) : 1;
}

/** 段落收尾判定（§V2.4.2 跨页续段合并前提）：句末标点或冒号结尾视为已收尾 */
const SENTENCE_END_RE = /[。！？?!：;；]$/u;

export function isSentenceClosed(text: string): boolean {
  return SENTENCE_END_RE.test((text ?? '').trim());
}

export interface LayoutUnit {
  /** 渲染用块（合并段为首块文本覆写后的合成块） */
  block: Block;
  role: BlockRole;
  /** 组成该展示单元的原块下标（选中/编辑按首下标定位） */
  indices: number[];
  indentPx: number;
}

const MERGEABLE_TYPES = new Set(['paragraph', 'list']);

function mergeable(block: Block): boolean {
  return MERGEABLE_TYPES.has(block.type) && !block.path && !block.latex && !block.html;
}

/**
 * 版式排版单元序列（§V2.4.1~3 一次前置处理，学习工作台与解析面共用）：
 * 标题按题号形态定档左偏移、正文/公式/图表与最近上级标题同档；
 * 相邻两个纯文本块且前块未收尾 → 合并为一段（消除「一页一块、句子从中间断开」）；
 * 同一标题跨页/页眉重印只保留首个。
 */
export function layoutUnits(blocks: Block[], roles: BlockRole[]): LayoutUnit[] {
  const units: LayoutUnit[] = [];
  let depth = 1;
  let lastHeadingKey = '';
  blocks.forEach((block, index) => {
    const role = roles[index];
    const text = blockText(block);
    if (role === 'heading') {
      const key = text.trim().replace(/\s+/g, '').toLowerCase();
      if (key !== '' && key === lastHeadingKey) return;
      depth = headingDepthOf(text, block.level);
      lastHeadingKey = key;
      units.push({ block, role, indices: [index], indentPx: indentForDepth(depth) });
      return;
    }
    const indentPx = role !== 'body' ? 0 : indentForDepth(depth);
    const prev = units[units.length - 1];
    if (
      role === 'body'
      && prev
      && prev.role === 'body'
      && mergeable(prev.block)
      && mergeable(block)
      && !isSentenceClosed(blockText(prev.block))
    ) {
      const merged: Block = { ...prev.block, text: `${blockText(prev.block)}${text}` };
      units[units.length - 1] = { ...prev, block: merged, indices: [...prev.indices, index] };
      return;
    }
    units.push({ block, role, indices: [index], indentPx });
  });
  return units;
}

/** 引导点串：省略号字形一枚即算，句点/间隔号/破折号需连续两枚以上（`Vol.2` 的单点不算） */
const LEADER_RUN = /(?:[…⋯]{1,}|[.·•–—－]{2,})/;
/** 行内「引导点串＋页码」＝一条目录条目的收尾（DEFECT-025 守则一：不锚在行尾） */
const LEADER_PAGE_RE = new RegExp(`${LEADER_RUN.source}[ \\t]*(\\d{1,5})`, 'g');
/** 行尾页码：引导点可选，西文目录常用空白分隔 */
const TRAILING_PAGE_RE = /^(.*?)\s*(?:[.…·•⋯–—]{2,}|\s+[.…·•⋯–—]*)\s*(\d+)\s*$/;

/** 一条目录条目：清洗后的标题、印刷页码（拆不出为空串）、该行原样片段（供复核面板回显） */
export interface TocEntry {
  title: string;
  page: string;
  segment: string;
}

/** 剔离条目名起始处的引导点串（黏行被列边界切断时，下一条目以点线开头） */
function stripLeadingLeaders(text: string): string {
  const leading = new RegExp(`^${LEADER_RUN.source}`);
  let out = text.trim();
  for (let m = leading.exec(out); m !== null; m = leading.exec(out)) out = out.slice(m[0].length).trim();
  return out;
}

/**
 * 一行目录文本 → 条目数组（守则一・行内引导点与页码一律剔离）。
 * 解析产物把整页目录出成单个 paragraph 块，条目靠换行分隔，而换行有两种失真：
 * 两条目黏成一行（`第4章 连续性 …… 73函数的极限 …… 73`）与一条目折成两行（前半截无页码）。
 * 前者在此拆成两条，后者以 `page === ''` 的碎片交回调用方拼回（守则二见 `tocParse.ts`）。
 */
export function tocEntriesFromLine(text: string): TocEntry[] {
  const raw = (text ?? '').trim();
  if (raw === '') return [];
  const entries: TocEntry[] = [];
  let cursor = 0;
  for (const match of raw.matchAll(LEADER_PAGE_RE)) {
    const start = match.index ?? 0;
    const title = stripLeadingLeaders(raw.slice(cursor, start));
    if (title !== '') entries.push({ title, page: match[1], segment: raw.slice(cursor, start + match[0].length).trim() });
    cursor = start + match[0].length;
  }
  const tail = raw.slice(cursor);
  if (tail.trim() === '') return entries;
  const trailing = TRAILING_PAGE_RE.exec(tail);
  if (trailing && trailing[1].trim() !== '') {
    entries.push({ title: trailing[1].trim(), page: trailing[2], segment: tail.trim() });
    return entries;
  }
  const title = stripLeadingLeaders(tail);
  if (title !== '') entries.push({ title, page: '', segment: tail.trim() });
  return entries;
}

/**
 * 章题判据（DEFECT-025 展示面・用户 2026-10-25 裁「甲・章加粗＋节缩进」）。
 * 正本＝目录抽取腿 `tocParse.ts` 的那条章题正则，上提到此单点复用，展示面不造第二套。
 */
const CHAPTER_TOC_RE = /^(第\s*[0-9一二三四五六七八九十百千]+\s*章|chapter\s+\d+)/i;

export function isChapterTocEntry(title: string): boolean {
  return CHAPTER_TOC_RE.test((title ?? '').trim());
}

/** 目录行的层级形态：章＝加粗＋顶格，节＝不加粗＋缩进一档（缩进阶位沿用 INDENT_STEPS_PX） */
export function tocEntryRowStyle(title: string): { fontWeight?: number; paddingLeft: number } {
  return isChapterTocEntry(title)
    ? { fontWeight: 600, paddingLeft: INDENT_STEPS_PX[0] }
    : { paddingLeft: INDENT_STEPS_PX[1] };
}

export interface TypographyPrefs {
  bodyFont: BodyFontKey;
  bodyLevel: number;
  showFurniture: boolean;
}

/** 默认：正文宋体五号（L0）、页眉页脚隐藏（用户裁决） */
export const DEFAULT_TYPOGRAPHY: TypographyPrefs = {
  bodyFont: 'SimSun',
  bodyLevel: 0,
  showFurniture: false,
};

export const TYPOGRAPHY_STORAGE_KEY = 'qed.parsing.typography';

/** 读偏好：损坏 JSON 整体回退默认；非法字段逐项回退/夹紧 */
export function loadTypographyPrefs(): TypographyPrefs {
  try {
    const raw = localStorage.getItem(TYPOGRAPHY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TYPOGRAPHY };
    const o = JSON.parse(raw) as Record<string, unknown>;
    const fonts: BodyFontKey[] = ['SimSun', 'SimHei', 'KaiTi'];
    return {
      bodyFont: fonts.includes(o.bodyFont as BodyFontKey) ? (o.bodyFont as BodyFontKey) : DEFAULT_TYPOGRAPHY.bodyFont,
      bodyLevel: typeof o.bodyLevel === 'number' && Number.isFinite(o.bodyLevel)
        ? clampLevel(o.bodyLevel)
        : DEFAULT_TYPOGRAPHY.bodyLevel,
      showFurniture: typeof o.showFurniture === 'boolean' ? o.showFurniture : DEFAULT_TYPOGRAPHY.showFurniture,
    };
  } catch {
    return { ...DEFAULT_TYPOGRAPHY };
  }
}
