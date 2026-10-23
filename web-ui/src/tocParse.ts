/**
 * 书籍目录页文本 → 章/节树纯函数（M6 裁决 ②：目录页文本解析 + 人工确认，不引 LLM）。
 * 规格正本：docs/plans/2026-10-11-learn-ui-course-study.md §7（原 design/learning-workbench-ui.md §6 随 2026-10-11 拆分轮迁稿；过程与裁决记录＝已归档壳 docs/history/plans/2026-10/2026-10-01-toc-knowledge-tree-and-learn-workbench.md）。
 * 消费面：#/learn/c/{courseId} 左栏「导入目录」确认面板（W4/W5）。
 */
import { isTocHeadingText, tocItemParts } from './components/parsing/typography';

export type TocDepth = 1 | 2;

export interface TocNode {
  name: string;
  printPage: number;
  depth: TocDepth;
  children: TocNode[];
}

export type TocUnrecognizedReason = 'excluded' | 'no-page' | 'no-parent';

export interface TocUnrecognizedLine {
  raw: string;
  reason: TocUnrecognizedReason;
  page: number | null;
}

export interface TocParseResult {
  tree: TocNode[];
  offset: number;
  unrecognized: TocUnrecognizedLine[];
}

export interface BodyPageText {
  page: number;
  text: string;
}

export interface TocParseOptions {
  /** 人工指定的印刷页 → PDF 页偏移，优先于自动试算 */
  offset?: number;
  /** 自动试算用的正文页文本（页序 + 全文） */
  bodyPages?: readonly BodyPageText[];
}

/** 写入 outline 端点的节点形状（页范围＝PDF 页序） */
export interface OutlinePayloadNode {
  name: string;
  page_start: number;
  page_end: number;
  children: OutlinePayloadNode[];
}

const CHAPTER_RE = /^(第\s*[0-9一二三四五六七八九十百千]+\s*章|chapter\s+\d+)/i;

/** 章节序号前缀剥离后得到的正文标题（正文侧章题常不带序号） */
const CHAPTER_PREFIX_RE = /^第\s*[0-9一二三四五六七八九十百千]+\s*章\s*/i;

// 设计内剔除（非解析失败）：这些行进 unrecognized 供面板复核，不静默丢弃
const EXCLUDED_TITLE_RE = /^(前言|序|序言|后记|致谢|索引|参考文献|附录|习题|exercise|exercises)$/i;

// 目录页自身的页码：b05 p8 实测以 paragraph 块出现「VII」
const ROMAN_PAGE_RE = /^[IVXLCDMivxlcdm]+$/;

const normalize = (text: string): string => (text ?? '').trim().replace(/\s+/g, '').toLowerCase();

/** 目录条目行拆分 + 章题判定（不判定剔除项） */
function classifyLine(raw: string): {
  kind: 'chapter' | 'section' | 'excluded';
  name: string;
  page: number | null;
} {
  const { title, page } = tocItemParts(raw);
  const num = page === '' ? null : Number(page);
  const name = title.trim();
  if (EXCLUDED_TITLE_RE.test(normalize(name))) return { kind: 'excluded', name, page: num };
  if (CHAPTER_RE.test(name)) return { kind: 'chapter', name, page: num };
  return { kind: 'section', name, page: num };
}

export function parseTocLines(
  lines: readonly string[],
  options: TocParseOptions = {},
): TocParseResult {
  const tree: TocNode[] = [];
  const unrecognized: TocUnrecognizedLine[] = [];
  let currentChapter: TocNode | null = null;

  for (const line of lines ?? []) {
    const raw = (line ?? '').trim();
    if (raw === '' || isTocHeadingText(raw) || ROMAN_PAGE_RE.test(raw)) continue;

    const hit = classifyLine(raw);
    if (hit.kind === 'excluded') {
      unrecognized.push({ raw, reason: 'excluded', page: hit.page });
      continue;
    }
    if (hit.page === null || !Number.isFinite(hit.page)) {
      unrecognized.push({ raw, reason: 'no-page', page: null });
      continue;
    }
    const page = Math.round(hit.page);
    if (hit.kind === 'chapter') {
      currentChapter = { name: hit.name, printPage: page, depth: 1, children: [] };
      tree.push(currentChapter);
      continue;
    }
    if (currentChapter === null) {
      // 多栏目录按块序拼接时，节题可能先于其章题出现
      unrecognized.push({ raw, reason: 'no-parent', page });
      continue;
    }
    currentChapter.children.push({ name: hit.name, printPage: page, depth: 2, children: [] });
  }

  const offset = options.offset
    ?? estimateTocOffset(tree, options.bodyPages ?? [])
    ?? 0;
  return { tree, offset, unrecognized };
}

/** 自动试算偏移：首章标题在正文侧首次出现的 PDF 页 − 其印刷页码 */
export function estimateTocOffset(
  tree: readonly TocNode[],
  bodyPages: readonly BodyPageText[],
): number | null {
  const first = tree[0];
  if (!first || bodyPages.length === 0) return null;
  const bare = normalize(first.name.replace(CHAPTER_PREFIX_RE, ''));
  const full = normalize(first.name);
  const pages = [...bodyPages].sort((a, b) => a.page - b.page);
  for (const item of pages) {
    const text = normalize(item.text);
    if (full !== '' && text.includes(full)) return item.page - first.printPage;
    if (bare !== '' && text.includes(bare)) return item.page - first.printPage;
  }
  return null;
}

/** 章/节 → PDF 页范围：相邻首尾相接、末章取 pageCount，落库只存 PDF 页序 */
export function toOutlinePayload(
  tree: readonly TocNode[],
  offset: number,
  pageCount: number,
): OutlinePayloadNode[] {
  return tree.map((chapter, index) => {
    const nextChapter = tree[index + 1];
    const start = Math.max(1, chapter.printPage + offset);
    const chapterEnd = nextChapter
      ? Math.max(start, nextChapter.printPage + offset - 1)
      : Math.max(start, pageCount);
    return {
      name: chapter.name,
      page_start: start,
      page_end: chapterEnd,
      children: chapter.children.map((section, sectionIndex) => {
        const nextSection = chapter.children[sectionIndex + 1];
        const sectionStart = Math.max(start, section.printPage + offset);
        const sectionEnd = nextSection
          ? Math.max(sectionStart, nextSection.printPage + offset - 1)
          : chapterEnd;
        return {
          name: section.name,
          page_start: sectionStart,
          page_end: sectionEnd,
          children: [],
        };
      }),
    };
  });
}

/** 块文本 → 目录行：多行块按行拆开、空行剔除（目录页 paragraph 块内含换行的实测形态） */
export function tocLinesFromBlockTexts(texts: readonly string[]): string[] {
  const lines: string[] = [];
  for (const text of texts ?? []) {
    for (const line of (text ?? '').split('\n')) {
      const trimmed = line.trim();
      if (trimmed !== '') lines.push(trimmed);
    }
  }
  return lines;
}

/* ---------- 进场自动定位（REQ-105 §7 步 0：只读已解析块文本，不触发重新解析） ---------- */

export type TocAutoFailure = 'no-toc-page' | 'no-chapter-lines' | 'no-body-start' | 'offset-invalid';

export interface TocAutoResult {
  ok: boolean;
  failure?: TocAutoFailure;
  tocStart: number | null;
  tocEnd: number | null;
  bodyStart: number | null;
  offset: number | null;
  lines: string[];
  tree: TocNode[];
  unrecognized: TocUnrecognizedLine[];
}

/** 目录段续页门槛：该页「行＋尾页码」形态行占比（正文页≈0） */
const TOC_LIKE_RATIO = 0.5;
/** 偏移试算的正文窗口页数 */
const BODY_SCAN_LIMIT = 40;

const EMPTY_AUTO: TocAutoResult = {
  ok: false, tocStart: null, tocEnd: null, bodyStart: null, offset: null,
  lines: [], tree: [], unrecognized: [],
};

const pageLines = (text: string): string[] => tocLinesFromBlockTexts([text]);

const isNoiseLine = (line: string): boolean => isTocHeadingText(line) || ROMAN_PAGE_RE.test(line);

const isTocLikeLine = (line: string): boolean => !isNoiseLine(line) && tocItemParts(line).page !== '';

function tocLikeRatio(lines: readonly string[]): number {
  const candidates = lines.filter((line) => !isNoiseLine(line));
  if (candidates.length === 0) return 0;
  return candidates.filter(isTocLikeLine).length / candidates.length;
}

/**
 * 自动定位目录页段与正文起页并试算偏移：命中即返回可写入的章/节树，
 * 任一步置信不足即返回 ok=false（调用方降级人工，绝不写猜测值）。
 */
export function autoLocateToc(pages: readonly BodyPageText[]): TocAutoResult {
  const sorted = [...pages].sort((a, b) => a.page - b.page);
  const starts = sorted.filter((item) => pageLines(item.text).some(isTocHeadingText));
  if (starts.length === 0) return { ...EMPTY_AUTO, failure: 'no-toc-page' };

  for (const start of starts) {
    const from = sorted.findIndex((item) => item.page === start.page);
    const lines: string[] = [];
    let end = start.page;
    for (let index = from; index < sorted.length; index += 1) {
      const rowLines = pageLines(sorted[index].text);
      if (index !== from && tocLikeRatio(rowLines) < TOC_LIKE_RATIO) break;
      lines.push(...rowLines);
      end = sorted[index].page;
    }

    const parsed = parseTocLines(lines);
    if (parsed.tree.length === 0) continue;

    const after = sorted.filter((item) => item.page > end);
    const body = after.find((item) => pageLines(item.text).some((line) => CHAPTER_RE.test(line)));
    const partial: TocAutoResult = {
      ...EMPTY_AUTO, tocStart: start.page, tocEnd: end, lines,
      tree: parsed.tree, unrecognized: parsed.unrecognized,
    };
    if (!body) return { ...partial, failure: 'no-body-start' };

    const offset = estimateTocOffset(parsed.tree, after.slice(0, BODY_SCAN_LIMIT));
    if (offset === null) return { ...partial, failure: 'offset-invalid' };
    if (parsed.tree[0].printPage + offset < 1) return { ...partial, failure: 'offset-invalid' };
    return {
      ...partial, ok: true, bodyStart: body.page, offset,
    };
  }
  return { ...EMPTY_AUTO, failure: 'no-chapter-lines' };
}
