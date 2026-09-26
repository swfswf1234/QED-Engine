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

/** 目录条目拆分：标题 + 页码（点线/空白引导后的尾数；无分隔符的尾数不误拆） */
export function tocItemParts(text: string): { title: string; page: string } {
  const raw = (text ?? '').trim();
  const m = /^(.*?)\s*(?:[.…·•⋯–—]{2,}|\s+[.…·•⋯–—]*)\s*(\d+)\s*$/.exec(raw);
  if (!m || m[1].trim() === '') return { title: raw, page: '' };
  return { title: m[1].trim(), page: m[2] };
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

export function saveTypographyPrefs(prefs: TypographyPrefs): void {
  try {
    localStorage.setItem(TYPOGRAPHY_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage 不可用（隐私模式等）时静默，偏好仅存活于本次会话
  }
}
