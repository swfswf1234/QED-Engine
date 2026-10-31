/**
 * 知识点梳理屏 store（`#/admin/kp-review`，REQ-141 批次 F＋REQ-143 W9・数据源换到 8902 `af_kp`）
 * 设计关联：docs/design/frontend/kp-review-ui.md（暂定）、docs/plans/2026-10-26-kp-generation-leg-and-one-click-summary.md
 * - **唯一事实源**（改判②）：目录、总结、导读、批次提交一律走 `api/kp.ts` 的十条 8900→8902 透传腿；
 *   根侧 §⑥（`/learn/*`）与 §模型（`/llm/*`）在本屏一条都不发——同一屏两套事实源会让「屏读 af_kp、写落 qe_*」。
 * - **教材入选项＝文档解析管理已解析完成**（用户 2026-10-25 补充令）：判据复用 `stores/dashboard.ts` 的
 *   `parseBookLabel(book).label === '已完成'`，本屏不另造第二套完成判定。
 * - **类型四值**（`KA-44`）：行上的 `node_type`（章节／知识点／习题／其他）是读面派生键，屏侧只呈现；
 *   旧读面缺键时按层数退「一层＝章节、其余＝知识点」。点行已随 T14 删净，缓冲只吃目录行。
 * - **完成判据＝读时三数**（`progressOfKpNodes`）：目录行数 > 0、章节与知识点行自身 `summary` 非空
 *   （习题／其他按令不需要总结、不入账）。`rejected` 行不吃；遗留 `node_kind='point'` 行的空总结仍计入
 *   `emptySummaries`（旧书不因点行退役被误判完成）。
 * - **两条在册写腿**＝详情总结 `PATCH /kp/nodes/{node_id}`（带 `if_rev`，乐观并发在屏侧收口）＋
 *   梳理批次 `POST /kp-jobs`（W9：整本或选中行的页区间，可附人工评审意见；第九令⑤补 `stage:'content'` 只补内容）。
 *   第三条＝知识点单点重生成 `POST /kp/nodes/{node_id}/summary`（W25③，详情面「重新生成总结」）。目录整树
 *   `PUT …/outline`、确认位 `POST …/confirm` 等仍在册但本批不放行；屏侧不绕回根侧。
 * - **详情面按类型三形**（W27）：章节＝总结可改＋导读只读；知识点＝所属章的总结与导读只读＋本点总结可改＋
 *   「重新生成总结」；习题／其他＝只名称与类型标注，页脚三钮（上一个／保存结果／下一个）不可用。
 *   上一个／下一个只走**同级行页序**（`siblingRowsOf`），不再铺「本章知识点」列表。
 * - 页区间不是列：读面派生两键 `page_start`／`page_end`（`KA-42`：目录行＝到下一枚目录行起点前 −1 页，点行＝
 *   自己锚点两端）优先，缺键（在飞 `draft` 行、旧读面）才退回 `anchors` 的最小／最大页（`KA-25`：缺省＝整本，故允许空）。
 * - 在飞判据按 `KA-4`／`KA-9`：只认批次进度面的 `in_flight` 与本批 `draft` 行数；流水缺席不等于完成、
 *   读失败不翻判据（崩掉的批次仍留 draft 行），超限只停表、状态保持 running 并指回「刷新」。
 * - **第七令（W16）＝反馈只走弹窗那一句**：受理／拒绝／收口／失败／未写出／停表六口各出一句 antd `message`，
 *   屏侧不再常驻批次号与五格计数；逐轮读失败只进 `job.message`（不每轮敲人），在飞痕迹只剩界面那一句灰字。
 */
import { create } from 'zustand';
import { message } from 'antd';
import { ApiError, describeError } from '../api/client';
import { getBookPage, getParsingTree } from '../api/axiom';
import type { PageData, ParsingTreeNode } from '../api/axiom';
import { parseBookLabel } from './dashboard';
import { createKpJob, getKpJobProgress, getKpNarrative, getKpWorkspace, patchKpNode, regenerateKpSummary } from '../api/kp';
import type { KpGenStatus, KpJobProgress, KpNode, KpNodeKind, KpReadNodeType } from '../api/kp';
import { blocksOf } from '../components/parsing/CompareView';
import { blockText } from '../components/parsing/blocks';
import { PAGE_BATCH, POINT_KEY_PREFIX, rangeOfRef } from './learnWorkbench';
import type { PageEntry, PageRange } from './learnWorkbench';

/** 目录行的本地键＝推进键同形（服务端行）；新增行用 `local:{n}`，提交腿接通后才换身份 */
export const LOCAL_KEY_PREFIX = 'local:';
/** 中栏未选中目录行时的默认落点＝第 1 页（封面／书名页，用户规划第⑤条） */
export const COVER_PAGE = 1;
/** 「知识点合并梳理」的点亮阈值＝本课程已梳理完成教材数 ≥ 2（第四批问答：读数改课程口径） */
export const MERGE_MIN_DONE_BOOKS = 2;
/** 批次进度轮询间隔与上限（上限＝20 分钟：整本轮次可跑很久，超限只停表不判失败） */
export const KP_JOB_POLL_MS = 3000;
export const KP_JOB_MAX_POLLS = 400;
/** 人工评审意见上限＝对方 `KA-31`（超限 422 不截断，屏侧同值只为早点可见拒绝） */
export const KP_REVIEW_NOTE_MAX_LEN = 2000;
/** 弹窗这一轮跑哪条腿：`outline`＝重新解析目录（默认）、`content`＝只补内容（`KA-43`） */
export type KpParseStage = 'outline' | 'content';
/** 没有书号就没有提交目标（两枚按钮共用同一句拒绝，不各写一套话术） */
const NO_BOOK_MESSAGE = '先选一本教材：没有 book_id 就没有提交目标。';
/** 停表那一句（第七令：零数字——批次号与五格计数既不进弹窗也不进灰字；灰字后缀消费同一枚常量） */
export const KP_JOB_STOP_MESSAGE = '本批轮询已停表：批次可能仍在跑，点「刷新」重读工作区与账面。';
/** 流水缺席那一句（`KA-9`：禁拿缺席当完成，报的是「没写出」而不是「已完成」） */
const KP_JOB_NO_LEDGER_MESSAGE = '本批已不在飞，但流水未写出：账面结果以工作区读数为准。';

/** 目录行的缓冲态（`af_kp` 行的可编辑镜像＋本地新增） */
export interface DraftNode {
  key: string;
  /** 服务端行才带；本地新增为 null，提交腿接通后才发放身份 */
  nodeId: string | null;
  name: string;
  parentKey: string | null;
  /** 由父链推导（改挂父即重算），不是服务端可覆写的列 */
  depth: number;
  pageStart: number | null;
  pageEnd: number | null;
  /** 起点页那枚锚的最小块号；`null`＝该锚没带块号，中栏按整页起 */
  startBlock: number | null;
  summary: string;
  /** 四值展示类型（`node_type` 读键；旧读面缺键按层数退章节／知识点） */
  nodeType: KpReadNodeType;
  orderHint: number;
  origin: 'server' | 'local';
  dirty: boolean;
  /** 乐观并发序号：写腿只发 `if_rev`＝这一枚，服务端不符即 409 */
  rev: number;
  /** 机器三态（`draft`／`candidate`／`rejected`）：只呈现，屏侧改不了 */
  genStatus: KpGenStatus | '';
  confirmed: number;
}

/** 一次梳理批次的屏侧记账（三态：running → ok／failed） */
export interface KpJobState {
  genBatch: string;
  phase: 'running' | 'ok' | 'failed';
  /** 本批计数（五键恒发，缺格记 0） */
  counts: Record<string, number>;
  /** 一句账面读数：失败原文、轮询超限提示、流水未写出提示 */
  message: string;
  polls: number;
  /** 这一批的人工评审意见（提交时的值；终态后被流水里的存档值覆写） */
  reviewNote: string;
}

export interface SectionStats {
  pages: number;
  blocks: number;
  chars: number;
}

/** 置灰五项（换源后：`reparse` 与 `kp.workspace` 已放行、`kp.detail_write` 换成在册的导读写腿） */
export type DisabledLeg =
  | 'outline.submit' | 'kp.confirm' | 'kp.review_flags' | 'kp.export'
  | 'narrative.write';

/** 乙类＝端点在册但本批放行范围外（现网没有丙类：生成腿已由 W25③ 的单点重生成补齐） */
export const DISABLED_LEGS: { leg: DisabledLeg; label: string; text: string; kind: 'out-of-scope' }[] = [
  {
    leg: 'outline.submit',
    label: '提交目录',
    text: '端点在册・本批放行范围外（`PUT /books/{book_id}/kp/outline` 一按即改 8902 的目录正本）',
    kind: 'out-of-scope',
  },
  {
    leg: 'kp.confirm',
    label: '确认与撤回',
    text: '端点在册・本批放行范围外（`POST /kp/nodes/{node_id}/confirm` 是唯一人工终局位，确认腿随下一批次放行）',
    kind: 'out-of-scope',
  },
  {
    leg: 'kp.review_flags',
    label: '待复核标记处置',
    text: '端点在册・本批放行范围外（标记只读呈现，处置与解除不在本屏写）',
    kind: 'out-of-scope',
  },
  {
    leg: 'kp.export',
    label: '已确认视图导出',
    text: '端点在册・本批放行范围外（`GET …/kp/export` 只给 `confirmed=1`，属提升腿的读面）',
    kind: 'out-of-scope',
  },
  {
    leg: 'narrative.write',
    label: '导读保存',
    text: '端点在册・本批放行范围外（`PUT …/narrative` 一按即覆写 8902 盘上的导读正本）',
    kind: 'out-of-scope',
  },
];

/** 选书行三框的候选（数据源＝`GET /parsing/tree`，顺序与解析管理屏同源） */
export interface CatalogBook {
  book_id: string;
  label: string;
  /** `parseBookLabel` 的书级结局（「已完成」才入选项） */
  parse_label: string;
}

export interface CatalogCourse {
  course_id: string;
  name: string;
  domain_id: string;
  /** 入选项教材＝解析已完成的书（用户补充令） */
  books: CatalogBook[];
}

export interface CatalogDomain {
  domain_id: string;
  name: string;
  courses: CatalogCourse[];
}

/** 单本教材的完成态事实：目录行数、子树里没点的目录行、总结为空的在册点行 */
export interface BookProgress {
  rows: number;
  pending: number;
  emptySummaries: number;
}

/** 已完成 ⇔ 目录行 > 0 且章节／知识点行的总结都非空 且遗留点行（若有）的总结也非空 */
export function bookDone(progress: BookProgress | undefined): boolean {
  if (!progress) return false;
  return progress.rows > 0 && progress.pending === 0 && progress.emptySummaries === 0;
}

/** `rejected`＝让位的行：对方工作区照发（不藏行），屏侧一律不吃 */
function isLive(row: KpNode): boolean {
  return row.gen_status !== 'rejected';
}

/**
 * 四值类型（`KA-44`）：读键 `node_type` 优先；旧读面缺键时按层数退「一层＝章节、其余＝知识点」。
 * 习题／其他只由读键给出——缺键的旧读面没有这两类，屏上不留假想值。
 */
function readNodeType(row: KpNode, depth: number): KpReadNodeType {
  const given = row.node_type;
  if (given === 'chapter' || given === 'point' || given === 'exercise' || given === 'other') return given;
  return depth <= 1 ? 'chapter' : 'point';
}

function outlineRowsOf(rows: readonly KpNode[]): KpNode[] {
  return rows.filter((row) => row.node_kind === 'outline');
}

/** 沿父链上溯到第一枚目录行（穿过点行；`hop` 上限防环）；认不到＝未归档 */
function anchorOf(
  parentId: string | null | undefined,
  parentOf: Map<string, string>,
  kindOf: Map<string, KpNodeKind>,
  outlineIds: Set<string>,
): string | null {
  let cursor = parentId ?? null;
  for (let hop = 0; hop < 16 && cursor; hop += 1) {
    if (outlineIds.has(cursor) && kindOf.get(cursor) === 'outline') return cursor;
    cursor = parentOf.get(cursor) || null;
  }
  return null;
}

/**
 * 整册工作区行 → 按书聚合的完成三数：目录行按 `book_id` 归行，**章节与知识点行自身**的总结为空即计 `pending`
 * （习题／其他按令不写总结、不入账）。遗留 `node_kind='point'` 行（T14 删行前的旧书）仍按旧账计入
 * `emptySummaries`；认不到目录行的点不计入任何一本——它还不算这本书梳理出来的结果。
 */
export function progressOfKpNodes(rows: readonly KpNode[]): Map<string, BookProgress> {
  const live = rows.filter(isLive);
  const outline = outlineRowsOf(live);
  const points = live.filter((row) => row.node_kind === 'point');
  const parentOf = new Map(live.map((row) => [row.node_id, row.parent_id ?? '']));
  const kindOf = new Map(live.map((row) => [row.node_id, row.node_kind]));
  const outlineIds = new Set(outline.map((row) => row.node_id));
  const bookOf = new Map(outline.map((row) => [row.node_id, row.book_id]));
  const out = new Map<string, BookProgress>();
  for (const row of outline) {
    const entry = out.get(row.book_id) ?? { rows: 0, pending: 0, emptySummaries: 0 };
    entry.rows += 1;
    const type = readNodeType(row, depthOf(outline, row));
    if ((type === 'chapter' || type === 'point') && (row.summary ?? '').trim() === '') entry.pending += 1;
    out.set(row.book_id, entry);
  }
  for (const point of points) {
    const anchor = anchorOf(point.parent_id, parentOf, kindOf, outlineIds);
    if (anchor === null) continue;
    const ref = bookOf.get(anchor);
    if (!ref) continue;
    const entry = out.get(ref) ?? { rows: 0, pending: 0, emptySummaries: 0 };
    if ((point.summary ?? '').trim() === '') entry.emptySummaries += 1;
    out.set(ref, entry);
  }
  return out;
}

/** 一次工作区读数（一本书）→ 三数合并：工作区按书面返回，行内的 `book_id` 只是标签 */
export function mergeProgress(byBook: Map<string, BookProgress>): BookProgress {
  const merged = { rows: 0, pending: 0, emptySummaries: 0 };
  for (const entry of byBook.values()) {
    merged.rows += entry.rows;
    merged.pending += entry.pending;
    merged.emptySummaries += entry.emptySummaries;
  }
  return merged;
}

/**
 * 解析树 → 三框候选：只保留「解析已完成」的教材（补充令），
 * 领域与课程的顺序一律保持服务端返回序（不另排）。
 */
export function catalogOf(nodes: readonly ParsingTreeNode[]): CatalogDomain[] {
  const domains: CatalogDomain[] = [];
  for (const domain of nodes) {
    if (domain.type !== 'domain') continue;
    const courses: CatalogCourse[] = [];
    for (const course of domain.children ?? []) {
      if (course.type !== 'course' || !course.courseId) continue;
      const books: CatalogBook[] = [];
      for (const book of course.children ?? []) {
        if (book.type !== 'book' || !book.book?.book_id) continue;
        const meta = book.book;
        if (parseBookLabel(meta).label !== '已完成') continue;
        books.push({ book_id: meta.book_id, label: book.title, parse_label: '已完成' });
      }
      courses.push({ course_id: course.courseId, name: course.title, domain_id: domain.domainId ?? '', books });
    }
    domains.push({ domain_id: domain.domainId ?? '', name: domain.title, courses });
  }
  return domains;
}

/** 与对方 `af_kp.norm_key` 同口径：全角→半角、空白折叠、小写 */
export function normKey(name: string): string {
  const chars: string[] = [];
  for (const ch of (name ?? '').trim()) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x3000) chars.push(' ');
    else if (code >= 0xff01 && code <= 0xff5e) chars.push(String.fromCodePoint(code - 0xfee0));
    else chars.push(ch);
  }
  const key = chars.join('').replace(/\s+/g, ' ').toLowerCase();
  return key.length <= 200 ? key : `${key.slice(0, 180)}-${key.length.toString(16)}`;
}

/**
 * 来源锚的最小／最大页＝这一行的页区间（`KA-25`：无锚页即整本，屏上不编造区间）；
 * 起点块号＝起点页那枚锚的最小块号，没带块号即 `null`。
 * 两枚派生键（`KA-42`：目录行到下一枚目录行起点前 −1 页、点行自己锚点两端）优先——读面切好的区间
 * 才是正文那一段，锚点最小／最大页只是它没有派生键时的退路（在飞 `draft` 行、旧读面）。
 */
function anchorRange(row: KpNode): { start: number | null; end: number | null; startBlock: number | null } {
  const anchors = (row.anchors ?? []).filter((anchor) => typeof anchor.page === 'number' && Number.isInteger(anchor.page));
  const derivedStart = typeof row.page_start === 'number' && Number.isInteger(row.page_start) && row.page_start > 0
    ? row.page_start
    : null;
  const derivedEnd = typeof row.page_end === 'number' && Number.isInteger(row.page_end) && row.page_end > 0
    ? row.page_end
    : null;
  const starts = anchors.map((anchor) => anchor.page);
  const start = derivedStart ?? (starts.length === 0 ? null : Math.min(...starts));
  const end = derivedEnd ?? (starts.length === 0 ? null : Math.max(...starts));
  if (start === null) return { start: null, end: null, startBlock: null };
  const blocks = anchors
    .filter((anchor) => anchor.page === start)
    .flatMap((anchor) => anchor.block_indexes ?? [])
    .filter((index): index is number => typeof index === 'number' && Number.isInteger(index));
  return { start, end, startBlock: blocks.length === 0 ? null : Math.min(...blocks) };
}

/** 目录行前序铺平：同父内按 `order_hint` 升序（父不在集合里的行就地按根处理） */
function preorderOutline(rows: readonly KpNode[]): KpNode[] {
  const byParent = new Map<string | null, KpNode[]>();
  const ids = new Set(rows.map((row) => row.node_id));
  for (const row of rows) {
    const parent = row.parent_id && ids.has(row.parent_id) ? row.parent_id : null;
    const bucket = byParent.get(parent) ?? [];
    bucket.push(row);
    byParent.set(parent, bucket);
  }
  const out: KpNode[] = [];
  const walk = (parentKey: string | null) => {
    (byParent.get(parentKey) ?? [])
      .slice()
      .sort((a, b) => (a.order_hint ?? 0) - (b.order_hint ?? 0) || a.node_id.localeCompare(b.node_id))
      .forEach((row) => {
        if (out.includes(row)) return;
        out.push(row);
        walk(row.node_id);
      });
  };
  walk(null);
  return out;
}

/** 服务端行的层数：优先读 `depth` 列，缺列时按父链推导（对方不保证带这一列） */
function depthOf(rows: readonly KpNode[], row: KpNode, seen: Set<string> = new Set()): number {
  if (typeof row.depth === 'number' && row.depth > 0) return row.depth;
  if (!row.parent_id || seen.has(row.node_id)) return 1;
  seen.add(row.node_id);
  const parent = rows.find((item) => item.node_id === row.parent_id);
  return parent ? depthOf(rows, parent, seen) + 1 : 1;
}

/**
 * 整册工作区行 → 左栏缓冲树：只吃在册（非 `rejected`）的目录行，区间取 `anchors` 最小／最大页；
 * 类型取读键 `node_type`（`KA-44`），旧读面缺键按层数退。
 */
export function buildDraft(rows: readonly KpNode[]): DraftNode[] {
  const live = rows.filter(isLive);
  const outline = preorderOutline(outlineRowsOf(live));
  return outline.map((row, index) => {
    const range = anchorRange(row);
    const depth = depthOf(outline, row);
    return {
      key: `${POINT_KEY_PREFIX}${row.node_id}`,
      nodeId: row.node_id,
      name: row.name,
      parentKey: row.parent_id ? `${POINT_KEY_PREFIX}${row.parent_id}` : null,
      depth,
      pageStart: range.start,
      pageEnd: range.end,
      startBlock: range.startBlock,
      summary: row.summary ?? '',
      nodeType: readNodeType(row, depth),
      orderHint: row.order_hint ?? index,
      origin: 'server' as const,
      dirty: false,
      rev: row.rev ?? 0,
      genStatus: row.gen_status,
      confirmed: row.confirmed ?? 0,
    };
  });
}

/** 父链推导层数（改挂父后唯一的层数来源，避免缓冲里留下两套 depth） */
export function reindexDepths(nodes: readonly DraftNode[]): DraftNode[] {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const depthOfKey = (node: DraftNode): number => {
    if (!node.parentKey) return 1;
    const parent = byKey.get(node.parentKey);
    if (!parent || parent.key === node.key) return 1;
    return depthOfKey(parent) + 1;
  };
  return nodes.map((node) => ({ ...node, depth: depthOfKey(node) }));
}

/** 兄弟序＝同父内按 `order_hint` 升序（与对方目录序同口径） */
export function orderedDraft(nodes: readonly DraftNode[]): DraftNode[] {
  const out: DraftNode[] = [];
  const walk = (parentKey: string | null) => {
    nodes
      .filter((node) => node.parentKey === parentKey)
      .sort((a, b) => a.orderHint - b.orderHint || a.key.localeCompare(b.key))
      .forEach((node) => {
        out.push(node);
        walk(node.key);
      });
  };
  walk(null);
  return out;
}

/**
 * 页序＝起点页升序、同页按 `order_hint` 升序（第九令③）：`order_hint` 是**读到的行序**（`KA-40` 逐页
 * 落行＋目录页里那一行的位置），不等于正文页序；弹窗两枚下拉与区间倒挂判据都走这一枚，不各排一份。
 * 没有起点页的行排在最后（选它出可见拒绝，不从这里悄悄滤掉）。
 */
export function pageOrderedDraft(nodes: readonly DraftNode[]): DraftNode[] {
  const rank = (node: DraftNode) => node.pageStart ?? Number.MAX_SAFE_INTEGER;
  return [...nodes].sort((a, b) => rank(a) - rank(b) || a.orderHint - b.orderHint || a.key.localeCompare(b.key));
}

/** 整树的形状校验（对方 `af_kp` 目录判据的同口径镜像）：返回逐条可见拒绝的理由 */
export function validateLocalTree(nodes: readonly DraftNode[]): string[] {
  const errors: string[] = [];
  const reindexed = reindexDepths(nodes);
  if (nodes.some((node) => node.parentKey && !nodes.some((parent) => parent.key === node.parentKey))) {
    errors.push('目录节点的父级不在当前树里');
  }
  for (const node of reindexed) {
    if (node.name.trim() === '') errors.push('目录节点必须含非空 name');
    if (node.depth > 2) errors.push('目录树最深两级（章→节）');
    const start = node.pageStart;
    const end = node.pageEnd;
    if (start === null || end === null) {
      errors.push('目录节点必须含整数 page_start/page_end');
    } else if (start < 1 || end < start) {
      errors.push('页范围非法（page_start≥1 且 page_end≥page_start）');
    }
    if (node.summary.length > KP_REVIEW_NOTE_MAX_LEN) errors.push('summary 必须为不超过 2000 字符的字符串');
  }
  const seen = new Map<string, string>();
  for (const node of reindexed) {
    const pair = `${node.parentKey ?? '\u0000'}\u0001${normKey(node.name)}`;
    if (seen.has(pair)) {
      errors.push('同一父级下目录节点重名（同名节须挂不同章）');
      break;
    }
    seen.set(pair, node.key);
  }
  return [...new Set(errors)];
}

/** 只拒绝本次操作**新引入**的错误（缓冲里已有的缺项不拦住别的编辑） */
export function introducedErrors(before: readonly string[], after: readonly string[]): string[] {
  return after.filter((error) => !before.includes(error));
}

/** 在缓冲里插入一条本地行（供 store 与用例共用；不校验，校验由调用方跑） */
export function addLocalNode(
  nodes: readonly DraftNode[],
  parentKey: string | null,
  name: string,
  range?: { start: number | null; end: number | null; startBlock?: number | null },
): DraftNode[] {
  const siblingMax = nodes
    .filter((node) => node.parentKey === parentKey)
    .reduce((max, node) => Math.max(max, node.orderHint), 0);
  const next: DraftNode = {
    key: `${LOCAL_KEY_PREFIX}${nodes.filter((node) => node.origin === 'local').length + 1}`,
    nodeId: null,
    name,
    parentKey,
    depth: parentKey ? 2 : 1,
    pageStart: range?.start ?? null,
    pageEnd: range?.end ?? null,
    startBlock: range?.startBlock ?? null,
    summary: '',
    nodeType: parentKey ? 'point' : 'chapter',
    orderHint: siblingMax + 1,
    origin: 'local',
    dirty: true,
    rev: 0,
    genStatus: '',
    confirmed: 0,
  };
  return orderedDraft([...nodes, next]);
}

/** 同级行页序＝同父行按页序排（详情面上一个／下一个的唯一序；章只与章互跳、点只与点互跳） */
export function siblingRowsOf(nodes: readonly DraftNode[], parentKey: string | null): DraftNode[] {
  return pageOrderedDraft(nodes.filter((node) => node.parentKey === parentKey));
}

/** 知识点详情「所属章节」＝沿父链上溯到最近的章节行（不含自身；认不到＝null） */
export function chapterAncestorOf(nodes: readonly DraftNode[], key: string): DraftNode | null {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const self = byKey.get(key);
  let cursor = self?.parentKey ? byKey.get(self.parentKey) : undefined;
  for (let hop = 0; hop < 16 && cursor; hop += 1) {
    if (cursor.nodeType === 'chapter') return cursor;
    cursor = cursor.parentKey ? byKey.get(cursor.parentKey) : undefined;
  }
  return null;
}

/** 中栏起点页那一刀的载体＝起点页号＋该页的最小块号（渲染与读数共用同一枚判据，不各算一份） */
export interface BodyCut {
  page: number;
  block: number;
}

/** 切点的唯一出处：块号 0／缺失／没有起点页＝不切（返回 `null`，中栏从整页起） */
export function bodyCutOf(row?: DraftNode | null): BodyCut | null {
  if (!row || row.pageStart === null || row.startBlock === null || row.startBlock <= 0) return null;
  return { page: row.pageStart, block: row.startBlock };
}

/** 起点页只从锚给的那枚块起（块号空间与对方 `block_indexes` 同源）；越界切空＝回落整页，不把正文清成空屏 */
export function cutFromStart<T>(rows: T[], pageNo: number, cut: BodyCut | null): T[] {
  if (!cut || pageNo !== cut.page || cut.block <= 0) return rows;
  const sliced = rows.slice(cut.block);
  return sliced.length > 0 ? sliced : rows;
}

export function sectionStatsOf(pages: Record<number, PageEntry>, cut?: BodyCut | null): SectionStats {
  const numbers = Object.keys(pages).map(Number).sort((a, b) => a - b);
  let blocks = 0;
  let chars = 0;
  let loaded = 0;
  for (const pageNo of numbers) {
    const data = pages[pageNo]?.data;
    if (!data) continue;
    loaded += 1;
    const rows = cutFromStart(blocksOf(data), pageNo, cut ?? null);
    blocks += rows.length;
    chars += rows.reduce((sum, block) => sum + blockText(block).length, 0);
  }
  return { pages: loaded, blocks, chars };
}

const emptyPage: PageEntry = { loading: false, parsed: false, data: null, error: null };

/** 详情格的载体：身份一律是 `af_kp` 的 `node_id`，形态由四值 `nodeType` 定 */
export interface DetailTarget {
  nodeId: string;
  name: string;
  nodeType: KpReadNodeType;
  /** 知识点详情「所属章节」指的那一行：最近一级章节；章节／习题／其他不在章下时为 null */
  chapterNodeId: string | null;
  /** 同级行（同父）页序：上一个／下一个只走这一序 */
  siblings: string[];
  index: number;
  summary: string;
  rev: number;
}

export interface NarrativeState {
  loading: boolean;
  available: boolean;
  content: string;
  reason: string;
}

/** 知识点详情的「所属章节」行：按 `chapterNodeId` 回缓冲里认（刷新后同一枚 id 仍可认） */
export function chapterRowOf(
  detail: Pick<DetailTarget, 'chapterNodeId'> | null,
  draft: readonly DraftNode[],
): DraftNode | null {
  if (!detail?.chapterNodeId) return null;
  return draft.find((node) => node.nodeId === detail.chapterNodeId) ?? null;
}

/**
 * 第三行解析钮的点亮律（2026-10-27 用户第五令改判：同屏并列、各自独立判；第九令⑤补「内容解析」）。
 * 「解析目录」＝选了教材即亮（整本重跑随时可用，不再因目录非空而灰）；
 * 「重新解析目录」＝另需本书目录非空（没有目录行就没有可选的区间，弹窗无从现取）；
 * 「内容解析」＝同上再加一层语义前提：没有在册目录行时 8902 的 content 门即 422（`KA-43`），屏上不亮。
 * 没有教材＝三枚都不亮（点了没有提交目标）。
 */
export function parseLitOf(
  bookId: string | null,
  outlineEmpty: boolean,
): { all: boolean; reparse: boolean; content: boolean } {
  if (!bookId) return { all: false, reparse: false, content: false };
  return { all: true, reparse: !outlineEmpty, content: !outlineEmpty };
}

export interface KpReviewStore {
  domainId: string | null;
  domainName: string;
  courseId: string | null;
  courseName: string;
  bookId: string | null;
  domains: CatalogDomain[];
  /** 当前领域的完成态扫描结果（course_id → book_id → 事实） */
  progress: Map<string, Map<string, BookProgress>>;
  /** 第三行读数＝本课程口径（第四批问答改判，不再显领域口径） */
  doneBooksInCourse: number;
  editMode: boolean;
  draft: DraftNode[];
  draftError: string | null;
  outlineEmpty: boolean;
  localSeq: number;
  selectedKey: string | null;
  range: PageRange | null;
  pages: Record<number, PageEntry>;
  loadedThrough: number;
  sectionStats: SectionStats;
  detail: DetailTarget | null;
  detailNarrative: NarrativeState;
  detailSaving: boolean;
  detailError: string | null;
  /** 工作区回显的在飞批次号（`find_draft_batch`）：非空即屏侧不再叠批 */
  inFlightBatch: string | null;
  /** 人工评审意见（W9・`KA-31`）：随批次上送、由 8902 注入两阶段 prompt 并存档 */
  reviewNote: string;
  /** 「重新解析」弹窗（第四令）＝范围与备注的唯一取值面；弹窗内现选的那枚目录行才算 */
  reparseModalOpen: boolean;
  /** 弹窗这一轮跑哪条腿：`outline`＝重新解析目录、`content`＝内容解析（`KA-43`） */
  reparseStage: KpParseStage;
  reparseStartKey: string | null;
  reparseEndKey: string | null;
  job: KpJobState | null;
  jobError: string | null;
  loading: boolean;
  error: string | null;
  notice: string | null;
  enter: (input?: { domain?: string; course?: string; book?: string }) => Promise<void>;
  pickDomain: (domainId: string) => Promise<void>;
  pickCourse: (courseId: string) => Promise<void>;
  pickBook: (bookId: string) => Promise<void>;
  reload: () => Promise<void>;
  setEditMode: (on: boolean) => void;
  renameDraft: (key: string, name: string) => boolean;
  setDraftRange: (key: string, start: number, end: number) => boolean;
  setDraftParent: (key: string, parentKey: string | null) => boolean;
  moveDraft: (key: string, delta: -1 | 1) => boolean;
  addDraft: (parentKey: string | null) => string;
  removeDraft: (key: string) => boolean;
  selectNode: (key: string) => Promise<void>;
  showCover: () => Promise<void>;
  loadMorePages: () => Promise<void>;
  openDetail: (nodeId: string) => Promise<void>;
  stepDetail: (delta: -1 | 1) => Promise<void>;
  setDetailSummary: (text: string) => void;
  saveDetail: () => Promise<boolean>;
  /** 知识点单点重生成总结（`KA-45`，同步百秒级调用） */
  regenerateSummary: () => Promise<boolean>;
  setReviewNote: (text: string) => void;
  openReparseModal: (stage?: KpParseStage) => void;
  closeReparseModal: () => void;
  setReparseTarget: (which: 'start' | 'end', key: string | null) => void;
  submitParseAll: () => Promise<boolean>;
  submitReparse: () => Promise<boolean>;
  pollKpJobOnce: () => Promise<void>;
  dismissJob: () => void;
  submitOutline: () => string;
  disabledText: (leg: DisabledLeg) => string;
  clearNotice: () => void;
}

/** 领域内「有未完成教材」的第一门课程；都完成则回第一门（规划第②条） */
export function pickDefaultCourse(
  domain: CatalogDomain | undefined,
  progress: Map<string, Map<string, BookProgress>>,
): CatalogCourse | null {
  const courses = (domain?.courses ?? []).filter((course) => course.books.length > 0);
  if (courses.length === 0) return (domain?.courses ?? [])[0] ?? null;
  const pending = courses.find((course) => course.books.some(
    (book) => !bookDone(progress.get(course.course_id)?.get(book.book_id)),
  ));
  return pending ?? courses[0];
}

/** 课程内「第一本未完成」的入选项教材；都完成则回第一本；集合为空返回 null（空态） */
export function pickDefaultBook(
  course: CatalogCourse | null,
  progress: Map<string, Map<string, BookProgress>>,
): CatalogBook | null {
  if (!course) return null;
  const pending = course.books.find((book) => !bookDone(progress.get(course.course_id)?.get(book.book_id)));
  return pending ?? course.books[0] ?? null;
}

/** 课程内已梳理完成教材数＝合并阈值与第三行读数的唯一来源 */
export function countDoneBooks(
  course: CatalogCourse | null,
  progress: Map<string, Map<string, BookProgress>>,
): number {
  if (!course) return 0;
  return course.books.filter((book) => bookDone(progress.get(course.course_id)?.get(book.book_id))).length;
}

let kpJobTimer: ReturnType<typeof setInterval> | null = null;

function stopKpJobPolling(): void {
  if (kpJobTimer !== null) {
    clearInterval(kpJobTimer);
    kpJobTimer = null;
  }
}

/** 第七令（W16）＝拒绝的唯一出口：一句「不能解析：＋原因原文」弹窗，界面不再常驻拒绝条；`jobError` 只留作状态记账 */
function notifyReject(reason: string): void {
  useKpReviewStore.setState({ jobError: reason });
  message.error(`不能解析：${reason}`);
}

/** 收口那句的行数取法＝流水 `result.outline_rows` 优先，缺则退回本批计数的 `outline`（拿到什么报什么，不写 0 行） */
function outlineRowsReported(ledger: NonNullable<KpJobProgress['ledger']>, out: KpJobProgress): number {
  const fromLedger = Number(ledger.result?.outline_rows);
  return Number.isFinite(fromLedger) ? fromLedger : Number(out.counts?.outline ?? 0);
}

export const useKpReviewStore = create<KpReviewStore>((set, get) => {
  /** 拉一页并写回 pages（404＝这一页没有可展示的内容，不算错误；口径同工作台） */
  const loadPage = async (bookId: string, pageNo: number) => {
    set((s) => ({ pages: { ...s.pages, [pageNo]: { ...emptyPage, loading: true } } }));
    try {
      const data: PageData = await getBookPage(bookId, pageNo);
      set((s) => ({ pages: { ...s.pages, [pageNo]: { loading: false, parsed: true, data, error: null } } }));
    } catch (err) {
      const missing = err instanceof ApiError && err.status === 404;
      set((s) => ({
        pages: {
          ...s.pages,
          [pageNo]: { loading: false, parsed: false, data: null, error: missing ? null : describeError(err) },
        },
      }));
    }
    set((s) => ({
      sectionStats: sectionStatsOf(s.pages, bodyCutOf(s.draft.find((node) => node.key === s.selectedKey))),
    }));
  };

  const advanceBatch = async () => {
    const { bookId, range, loadedThrough } = get();
    if (!bookId || !range) return;
    const from = Math.max(range.start, loadedThrough + 1);
    if (from > range.end) return;
    const to = Math.min(range.end, from + PAGE_BATCH - 1);
    set({ loadedThrough: to });
    await Promise.all(Array.from({ length: to - from + 1 }, (_, i) => loadPage(bookId, from + i)));
  };

  /** 缓冲写入的唯一出口：先按对方口径校验，只拒新引入的错误；层数一律父链重算 */
  const commitDraft = (nodes: readonly DraftNode[]): boolean => {
    const before = validateLocalTree(get().draft);
    const next = reindexDepths(orderedDraft(nodes));
    const introduced = introducedErrors(before, validateLocalTree(next));
    if (introduced.length > 0) {
      set({ draftError: introduced[0] });
      return false;
    }
    set({ draft: next, draftError: null });
    return true;
  };

  /** 当前领域的完成态扫描＝逐本入选项教材各一次工作区读数（现网每课 1～2 本，成本登记在壳里） */
  const scanDomain = async (domain: CatalogDomain | null): Promise<Map<string, Map<string, BookProgress>>> => {
    const progress = new Map<string, Map<string, BookProgress>>();
    if (!domain) return progress;
    await Promise.all(domain.courses.map(async (course) => {
      const byBook = new Map<string, BookProgress>();
      await Promise.all(course.books.map(async (book) => {
        try {
          const workspace = await getKpWorkspace(book.book_id);
          byBook.set(book.book_id, mergeProgress(progressOfKpNodes(workspace.nodes)));
        } catch {
          byBook.set(book.book_id, { rows: 0, pending: 0, emptySummaries: 0 });
        }
      }));
      progress.set(course.course_id, byBook);
    }));
    return progress;
  };

  const courseOf = () => {
    const { domains, domainId, courseId } = get();
    return domains.find((row) => row.domain_id === domainId)?.courses.find((row) => row.course_id === courseId) ?? null;
  };

  const recountCourse = () => {
    const course = courseOf();
    set({ doneBooksInCourse: countDoneBooks(course, get().progress) });
  };

  /** 本书工作区读腿＝左栏目录＋在飞批次号的唯一来源（一次读数，不多发） */
  const loadWorkspace = async () => {
    const { bookId, courseId } = get();
    if (!bookId) {
      set({ draft: [], outlineEmpty: true, inFlightBatch: null });
      return;
    }
    try {
      const workspace = await getKpWorkspace(bookId);
      const draft = buildDraft(workspace.nodes);
      set({
        draft,
        outlineEmpty: draft.length === 0,
        draftError: null,
        inFlightBatch: workspace.in_flight_batch ?? null,
      });
      if (!courseId) return;
      const merged = new Map(get().progress.get(courseId));
      merged.set(bookId, mergeProgress(progressOfKpNodes(workspace.nodes)));
      const progress = new Map(get().progress);
      progress.set(courseId, merged);
      set({ progress });
      recountCourse();
    } catch (err) {
      set({ error: describeError(err), draft: [], outlineEmpty: false });
    }
  };

  /** 导读正文读腿（`KA-19`：缺文件判 200 带 `exists=false`，不是 404——矛盾态要显示出来） */
  const loadNarrative = async (nodeId: string) => {
    try {
      const out = await getKpNarrative(nodeId);
      const missing = !out.exists || (out.content ?? '').trim() === '';
      set({
        detailNarrative: {
          loading: false,
          available: !missing,
          content: missing ? '' : out.content,
          reason: missing ? '这一条还没有导读正文：正文文件不在盘上，屏上不拿空文件当正文。' : '',
        },
      });
    } catch (err) {
      set({ detailNarrative: { loading: false, available: false, content: '', reason: describeError(err) } });
    }
  };

  /**
   * 详情格的读腿：行按 `node_id` 认；上一个／下一个只走**同级行页序**。
   * 导读只给章节与其下的知识点（知识点读所属章的正文，章级导读正文由内容解析批次写出）；
   * 习题／其他按令不出总结与导读，故一条正文腿都不发。
   */
  const openDetailOf = async (nodeId: string) => {
    const { draft } = get();
    const node = draft.find((row) => row.nodeId === nodeId);
    if (!node) {
      set({ detail: null, detailError: '这一行不在当前目录里（可能刚被对方重跑顶掉），刷新后再看。' });
      return;
    }
    const siblings = siblingRowsOf(draft, node.parentKey)
      .map((row) => row.nodeId)
      .filter((id): id is string => Boolean(id));
    const chapter = chapterAncestorOf(draft, node.key);
    set({
      detail: {
        nodeId,
        name: node.name,
        nodeType: node.nodeType,
        chapterNodeId: chapter?.nodeId ?? null,
        siblings,
        index: siblings.indexOf(nodeId),
        summary: node.summary,
        rev: node.rev,
      },
      detailError: null,
    });
    const narrativeId = node.nodeType === 'chapter' ? nodeId : node.nodeType === 'point' ? chapter?.nodeId : null;
    if (!narrativeId) {
      set({ detailNarrative: { loading: false, available: false, content: '', reason: '' } });
      return;
    }
    set({ detailNarrative: { loading: true, available: false, content: '', reason: '' } });
    await loadNarrative(narrativeId);
  };

  const resetBody = () => set({
    selectedKey: null,
    pages: {},
    range: null,
    loadedThrough: 0,
    sectionStats: { pages: 0, blocks: 0, chars: 0 },
    // 详情栏与中栏同属一次选书作用域：不清就会把上一本书的章总结留在右栏，其「保存结果」仍指向旧 node_id
    detail: null,
    detailNarrative: { loading: false, available: false, content: '', reason: '' },
    detailError: null,
  });

  /** 批次提交的唯一出口：整本或弹窗里那一行的页区间，加一枚可选的人工评审意见；三条腿各带自己的 `stage` */
  const submitJob = async (
    scope: { start: number | null; end: number | null; note: string },
    stage: KpParseStage = 'outline',
  ): Promise<boolean> => {
    const { bookId, job, inFlightBatch } = get();
    if (!bookId) {
      notifyReject(NO_BOOK_MESSAGE);
      return false;
    }
    if (job?.phase === 'running') {
      notifyReject(`批次 ${job.genBatch} 还在飞（工作区仍有 draft 行），屏侧不叠批。`);
      return false;
    }
    if (inFlightBatch) {
      notifyReject(`这本书已有在飞批次 ${inFlightBatch}，屏侧不叠批（在飞判据只认工作区的 draft 行）。`);
      return false;
    }
    const note = scope.note.trim();
    // 第五令：两枚目录钮只跑目录腿；内容解析走 `KA-43` 的 content 腿（只补内容、不重发目录）
    const body: {
      book_id: string; page_start?: number; page_end?: number; review_note?: string; stage: KpParseStage;
    } = { book_id: bookId, stage };
    if (scope.start !== null && scope.end !== null) {
      body.page_start = scope.start;
      body.page_end = scope.end;
    }
    if (note !== '') body.review_note = note;
    set({ jobError: null, job: null, error: null });
    try {
      const accepted = await createKpJob(body);
      set({ job: { genBatch: accepted.gen_batch, phase: 'running', counts: {}, message: '', polls: 0, reviewNote: note } });
      message.success(`已开始解析（批次 ${accepted.gen_batch}）`);
      stopKpJobPolling();
      kpJobTimer = setInterval(() => void useKpReviewStore.getState().pollKpJobOnce(), KP_JOB_POLL_MS);
      return true;
    } catch (err) {
      notifyReject(describeError(err));
      return false;
    }
  };

  return {
    domainId: null,
    domainName: '',
    courseId: null,
    courseName: '',
    bookId: null,
    domains: [],
    progress: new Map(),
    doneBooksInCourse: 0,
    editMode: false,
    draft: [],
    draftError: null,
    outlineEmpty: false,
    localSeq: 0,
    selectedKey: null,
    range: null,
    pages: {},
    loadedThrough: 0,
    sectionStats: { pages: 0, blocks: 0, chars: 0 },
    detail: null,
    detailNarrative: { loading: false, available: false, content: '', reason: '' },
    detailSaving: false,
    detailError: null,
    inFlightBatch: null,
    reviewNote: '',
    reparseModalOpen: false,
    reparseStage: 'outline',
    reparseStartKey: null,
    reparseEndKey: null,
    job: null,
    jobError: null,
    loading: false,
    error: null,
    notice: null,

    enter: async (input) => {
      stopKpJobPolling();
      set({ loading: true, error: null, job: null, jobError: null, reviewNote: '', reparseModalOpen: false, reparseStartKey: null, reparseEndKey: null });
      let domains: CatalogDomain[] = [];
      try {
        const tree = await getParsingTree();
        domains = catalogOf(tree.nodes);
      } catch (err) {
        set({ loading: false, error: describeError(err) });
        return;
      }
      const domain = domains.find((row) => row.domain_id === (input?.domain ?? get().domainId)) ?? domains[0] ?? null;
      const progress = await scanDomain(domain);
      const course = (domain?.courses ?? []).find((row) => row.course_id === input?.course)
        ?? pickDefaultCourse(domain ?? undefined, progress);
      const book = (course?.books ?? []).find((row) => row.book_id === input?.book)
        ?? pickDefaultBook(course ?? null, progress);
      set({
        domains,
        domainId: domain?.domain_id ?? null,
        domainName: domain?.name ?? '',
        courseId: course?.course_id ?? null,
        courseName: course?.name ?? '',
        bookId: book?.book_id ?? null,
        progress,
        doneBooksInCourse: countDoneBooks(course ?? null, progress),
        editMode: false,
      });
      resetBody();
      await loadWorkspace();
      set({ loading: false });
      if (!get().selectedKey) await get().showCover();
      const firstRow = orderedDraft(get().draft).find((node) => node.nodeId);
      if (firstRow && !get().detail) await openDetailOf(firstRow.nodeId as string);
    },

    pickDomain: async (domainId) => {
      stopKpJobPolling();
      const domain = get().domains.find((row) => row.domain_id === domainId) ?? null;
      const progress = await scanDomain(domain);
      const course = pickDefaultCourse(domain ?? undefined, progress);
      const book = pickDefaultBook(course ?? null, progress);
      set({
        domainId: domain?.domain_id ?? null,
        domainName: domain?.name ?? '',
        courseId: course?.course_id ?? null,
        courseName: course?.name ?? '',
        bookId: book?.book_id ?? null,
        progress,
        doneBooksInCourse: countDoneBooks(course ?? null, progress),
        editMode: false,
        job: null,
        jobError: null,
        reviewNote: '',
        reparseModalOpen: false,
        reparseStartKey: null,
        reparseEndKey: null,
      });
      resetBody();
      await loadWorkspace();
      await get().showCover();
    },

    pickCourse: async (courseId) => {
      stopKpJobPolling();
      const domain = get().domains.find((row) => row.domain_id === get().domainId);
      const course = domain?.courses.find((row) => row.course_id === courseId) ?? null;
      const book = pickDefaultBook(course, get().progress);
      set({
        courseId: course?.course_id ?? null,
        courseName: course?.name ?? '',
        bookId: book?.book_id ?? null,
        editMode: false,
        job: null,
        jobError: null,
        reviewNote: '',
        reparseModalOpen: false,
        reparseStartKey: null,
        reparseEndKey: null,
      });
      resetBody();
      await loadWorkspace();
      await get().showCover();
    },

    pickBook: async (bookId) => {
      stopKpJobPolling();
      set({ bookId, editMode: false, job: null, jobError: null, reviewNote: '', reparseModalOpen: false, reparseStartKey: null, reparseEndKey: null });
      resetBody();
      await loadWorkspace();
      await get().showCover();
    },

    reload: async () => {
      const domain = get().domains.find((row) => row.domain_id === get().domainId) ?? null;
      const progress = await scanDomain(domain);
      set({ progress });
      recountCourse();
      await loadWorkspace();
      const { selectedKey, range } = get();
      if (selectedKey && range) await advanceBatch();
      else await get().showCover();
    },

    setEditMode: (on) => set({ editMode: on, draftError: null }),

    renameDraft: (key, name) => commitDraft(
      get().draft.map((node) => (node.key === key ? { ...node, name, dirty: true } : node)),
    ),

    setDraftRange: (key, start, end) => commitDraft(
      get().draft.map((node) => (node.key === key
        ? { ...node, pageStart: Number.isInteger(start) ? start : null, pageEnd: Number.isInteger(end) ? end : null, dirty: true }
        : node)),
    ),

    setDraftParent: (key, parentKey) => {
      const node = get().draft.find((row) => row.key === key);
      if (!node) return false;
      if (parentKey === key) {
        set({ draftError: '不能把节点挂到自己下面' });
        return false;
      }
      return commitDraft(get().draft.map((row) => (row.key === key ? { ...row, parentKey, dirty: true } : row)));
    },

    moveDraft: (key, delta) => {
      const draft = get().draft;
      const node = draft.find((row) => row.key === key);
      if (!node) return false;
      const siblings = orderedDraft(draft).filter((row) => row.parentKey === node.parentKey);
      const index = siblings.findIndex((row) => row.key === key);
      const target = siblings[index + delta];
      if (!target) {
        set({ draftError: delta < 0 ? '已经是同层第一条，不能再上移' : '已经是同层最后一条，不能再下移' });
        return false;
      }
      return commitDraft(draft.map((row) => {
        if (row.key === node.key) return { ...row, orderHint: target.orderHint, dirty: true };
        if (row.key === target.key) return { ...row, orderHint: node.orderHint, dirty: true };
        return row;
      }));
    },

    addDraft: (parentKey) => {
      const draft = get().draft;
      const parent = draft.find((row) => row.key === parentKey);
      const seq = get().localSeq + 1;
      const nodes = addLocalNode(
        draft,
        parentKey,
        `未命名目录 ${seq}`,
        { start: parent?.pageStart ?? null, end: parent?.pageEnd ?? null, startBlock: parent?.startBlock ?? null },
      );
      const next = nodes.map((row) => (row.origin === 'local' && row.name === `未命名目录 ${seq}`
        ? { ...row, key: `${LOCAL_KEY_PREFIX}${seq}` }
        : row));
      set({ draft: next, localSeq: seq, draftError: null });
      return `${LOCAL_KEY_PREFIX}${seq}`;
    },

    removeDraft: (key) => {
      const draft = get().draft;
      const node = draft.find((row) => row.key === key);
      if (!node) return false;
      if (draft.some((row) => row.parentKey === key)) {
        set({ draftError: '该目录下还有子目录，先把子目录改挂别处' });
        return false;
      }
      return commitDraft(draft.filter((row) => row.key !== key));
    },

    selectNode: async (key) => {
      const node = get().draft.find((row) => row.key === key);
      const range = rangeOfRef({ page_start: node?.pageStart ?? undefined, page_end: node?.pageEnd ?? undefined });
      set({
        selectedKey: key,
        range,
        pages: {},
        loadedThrough: 0,
        sectionStats: { pages: 0, blocks: 0, chars: 0 },
      });
      if (range) await advanceBatch();
      if (node?.nodeId) await openDetailOf(node.nodeId);
    },

    /** 中栏未选中目录行时的默认落点＝第 1 页（封面／书名页），规划第⑤条 */
    showCover: async () => {
      const { bookId } = get();
      if (!bookId) return;
      set({ selectedKey: null, range: null, loadedThrough: 0 });
      await loadPage(bookId, COVER_PAGE);
    },

    loadMorePages: advanceBatch,

    openDetail: (nodeId) => openDetailOf(nodeId),

    stepDetail: async (delta) => {
      const detail = get().detail;
      if (!detail) return;
      const list = detail.siblings;
      if (list.length <= 1) {
        set({ detailError: '这一级下只有这一行，无上一个／下一个' });
        return;
      }
      const next = detail.index + delta;
      if (next < 0 || next >= list.length) {
        set({ detailError: delta < 0 ? '已经是这一级的第一条，不能再上一个' : '已经是这一级的最后一条，不能再下一个' });
        return;
      }
      set({ detailError: null });
      await openDetailOf(list[next]);
    },

    setDetailSummary: (text) => set((s) => (s.detail ? { detail: { ...s.detail, summary: text } } : {})),

    /** 在册写腿之一＝改 `summary`＋`if_rev`；习题／其他按令不写总结，点击直接出可见拒绝 */
    saveDetail: async () => {
      const detail = get().detail;
      if (!detail) return false;
      if (detail.nodeType !== 'chapter' && detail.nodeType !== 'point') {
        set({ detailError: '习题与其他行只展示名称与类型，不写总结。' });
        return false;
      }
      set({ detailSaving: true, detailError: null });
      try {
        const out = await patchKpNode(detail.nodeId, { summary: detail.summary, if_rev: detail.rev });
        set({
          detailSaving: false,
          detail: { ...detail, summary: out.summary ?? detail.summary, rev: out.rev ?? detail.rev + 1 },
          notice: `已保存总结：${detail.name}`,
        });
        await loadWorkspace();
        return true;
      } catch (err) {
        set({ detailSaving: false, detailError: describeError(err) });
        return false;
      }
    },

    /** 知识点单点重生成（`KA-45`）：同步百秒级调用，成功即覆盖本行总结并自增 `rev` */
    regenerateSummary: async () => {
      const detail = get().detail;
      if (!detail) return false;
      if (detail.nodeType !== 'point') {
        set({ detailError: '只有知识点行有「重新生成总结」。' });
        return false;
      }
      set({ detailSaving: true, detailError: null });
      try {
        const out = await regenerateKpSummary(detail.nodeId, { if_rev: detail.rev });
        set({
          detailSaving: false,
          detail: { ...detail, summary: out.summary ?? detail.summary, rev: out.rev ?? detail.rev + 1 },
          notice: `已重新生成总结：${detail.name}`,
        });
        await loadWorkspace();
        return true;
      } catch (err) {
        set({ detailSaving: false, detailError: describeError(err) });
        return false;
      }
    },

    setReviewNote: (text) => set({ reviewNote: text }),

    /** 弹窗打开＝空态：屏上选中的那枚行不进弹窗（范围只认弹窗里现选的起止两行）；`stage` 决定这一轮跑哪条腿 */
    openReparseModal: (stage = 'outline') => set({
      reparseModalOpen: true,
      reparseStage: stage,
      reparseStartKey: null,
      reparseEndKey: null,
      jobError: null,
    }),

    /** 取消＝清两枚选择、留备注（打了一半的话不该被一次误点抹掉） */
    closeReparseModal: () => set({ reparseModalOpen: false, reparseStartKey: null, reparseEndKey: null }),

    setReparseTarget: (which, key) => set(which === 'start' ? { reparseStartKey: key } : { reparseEndKey: key }),

    /** 《解析目录》＝整本（不两键页区间＝对方 `KA-25` 的缺省形状）；备注不随这一枚上送 */
    submitParseAll: () => submitJob({ start: null, end: null, note: '' }),

    /**
     * 弹窗提交＝现选起止两行派生的页区间＋备注（队头那行的起点页 → 队尾那行的终点页；不给整本退路）。
     * 队头／队尾的先后按**页序**判（`pageOrderedDraft`）：`order_hint` 是读到的行序，不等于正文页序。
     */
    submitReparse: async () => {
      const { bookId, draft, reparseStage, reparseStartKey, reparseEndKey, reviewNote } = get();
      if (!bookId) {
        notifyReject(NO_BOOK_MESSAGE);
        return false;
      }
      const from = draft.find((node) => node.key === reparseStartKey);
      const to = draft.find((node) => node.key === reparseEndKey);
      if (!from || !to) {
        notifyReject('还没有选全重新解析的起止两行。');
        return false;
      }
      if (from.pageStart === null || to.pageEnd === null) {
        notifyReject('这一行没有锚页，给不出重新解析的范围。');
        return false;
      }
      const byPage = pageOrderedDraft(draft);
      if (byPage.indexOf(from) > byPage.indexOf(to)) {
        notifyReject('重新解析的起始行排在结束行之后（区间倒挂），屏侧不替你换序。');
        return false;
      }
      const note = (reviewNote ?? '').trim();
      if (note.length > KP_REVIEW_NOTE_MAX_LEN) {
        notifyReject('人工评审意见太长了，屏侧不替你截断。');
        return false;
      }
      const ok = await submitJob({ start: from.pageStart, end: to.pageEnd, note }, reparseStage);
      // 受理成功＝这一批已带走备注；取消不抹（人还要接着改）
      if (ok) set({ reparseModalOpen: false, reparseStartKey: null, reparseEndKey: null, reviewNote: '' });
      return ok;
    },

    /** 进度轮询的一条腿（间隔由模块定时器驱动；用例直接调这一枚，不靠假定时器） */
    pollKpJobOnce: async () => {
      const { job, bookId } = get();
      if (!job || !bookId || job.phase !== 'running') {
        stopKpJobPolling();
        return;
      }
      if (job.polls >= KP_JOB_MAX_POLLS) {
        stopKpJobPolling();
        set({ job: { ...job, message: KP_JOB_STOP_MESSAGE } });
        return;
      }
      let out: KpJobProgress;
      try {
        out = await getKpJobProgress(bookId, job.genBatch);
      } catch (err) {
        // 读失败不翻在飞判据：保持 running，下一轮继续（`KA-4` 的当前态只认 `af_kp` 的 draft 行）
        // 第七令＝逐轮读失败只进读数，不每轮敲人一句弹窗
        set({ job: { ...job, message: describeError(err) } });
        return;
      }
      const polls = job.polls + 1;
      if (out.in_flight) {
        // 到上限只停表不翻判据：崩掉的批次仍留 draft 行，屏侧无权判它失败
        if (polls >= KP_JOB_MAX_POLLS) {
          stopKpJobPolling();
          message.warning(KP_JOB_STOP_MESSAGE);
        }
        set({
          job: {
            ...job,
            polls,
            counts: out.counts ?? {},
            message: polls >= KP_JOB_MAX_POLLS ? KP_JOB_STOP_MESSAGE : '',
          },
        });
        return;
      }
      stopKpJobPolling();
      const ledger = out.ledger;
      const settled: KpJobState = ledger
        ? {
          ...job,
          polls,
          counts: out.counts ?? {},
          phase: ledger.status === 'failed' ? 'failed' : 'ok',
          message: ledger.status === 'failed' ? (ledger.error || '批次失败（流水未记原因）') : '',
          reviewNote: ledger.review_note ?? job.reviewNote,
        }
        : {
          ...job,
          polls,
          counts: out.counts ?? {},
          phase: 'ok',
          message: KP_JOB_NO_LEDGER_MESSAGE,
        };
      set({ job: settled });
      // 第七令＝终态只出这一句：成功报目录行数，失败报流水原文，流水缺席不报喜
      if (!ledger) message.warning(KP_JOB_NO_LEDGER_MESSAGE);
      else if (ledger.status === 'failed') message.error(`解析失败：${settled.message}`);
      else message.success(`解析完成：目录 ${outlineRowsReported(ledger, out)} 行`);
      await loadWorkspace();
    },

    dismissJob: () => {
      stopKpJobPolling();
      set({ job: null, jobError: null });
    },

    submitOutline: () => {
      const text = get().disabledText('outline.submit');
      set({ notice: text });
      return text;
    },

    disabledText: (leg) => DISABLED_LEGS.find((item) => item.leg === leg)?.text ?? '未接入',

    clearNotice: () => set({ notice: null }),
  };
});
