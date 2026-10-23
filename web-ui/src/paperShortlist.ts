/**
 * 论文待选区间门槛（REQ-108 I4 + REQ-109 I11，REQ-107 壳 §6／§11.5）
 * - 门槛三条且仅三条：`goal_fit ≥ 4` ∧ `score ≥ 80` ∧ `recommended`（R6 已裁）
 * - 达线之上再叠「未在库」（R10 已裁＝未判别＝未采纳且达线）：命中 `stockArxivIds` 的达线条目
 *   移出待选区间、计入剔除数 J，折叠区注明「已采纳／已在库」且不可勾选
 * - 只读服务端结论字段做比较，不重算权重（10/6/4）、不抄服务端推荐线（70）
 * - 未入选按固定顺序取**第一个**不满足项归因，一条一个原因
 * - 「权威」不进门槛、界面不出现该字样（R3 已裁）
 */
import type { PaperCandidateEntry } from './stores';

export const SHORTLIST_GOAL_FIT_MIN = 4;
export const SHORTLIST_SCORE_MIN = 80;

export const SHORTLIST_EMPTY_TEXT = '本次没有达到待选门槛的论文（相关度需 ≥4 且总分需 ≥80）';

/** 达线但已采纳／已在库的剔除归因（§11.5） */
export const SHORTLIST_SETTLED_REASON = '已采纳／已在库';

export const SHORTLIST_SETTLED_EMPTY_TEXT = '本领域达线的论文都已采纳或已在库，换个检索方向再探索';

/** 未入选条目：原条目 + 唯一归因文案 */
export interface ShortlistExcluded {
  item: PaperCandidateEntry;
  reason: string;
}

export interface ShortlistResult {
  /** 达线且未采纳／未在库的条目（段④默认全选集合），保持服务端原序 */
  eligible: PaperCandidateEntry[];
  /** 未达线条目（折叠区只读集合），保持服务端原序 */
  excluded: ShortlistExcluded[];
  /** 达线但已采纳／已在库的条目（折叠区只读，注明剔除原因） */
  settled: ShortlistExcluded[];
  /** 段④头部一行：候选 N ｜ 待选区间 M（未达线 X）｜ 已剔除 J */
  summaryLine: string;
  /** 待选区间为空时的空态文案，否则空串 */
  emptyText: string;
}

/** 条目的 arXiv 标识（与按需回源、书行匹配同一口径） */
export function candidateArxivId(item: PaperCandidateEntry): string {
  return item.candidate.identifiers?.arxiv ?? item.candidate.provider_id;
}

/** 入选返回空串；未入选返回按序取到的第一个不满足项归因 */
export function shortlistReason(item: PaperCandidateEntry): string {
  const goalFit = item.assessment.goal_fit;
  if (goalFit < SHORTLIST_GOAL_FIT_MIN) return `相关度 ${goalFit}＜${SHORTLIST_GOAL_FIT_MIN}`;
  if (item.score < SHORTLIST_SCORE_MIN) return `总分 ${item.score}＜${SHORTLIST_SCORE_MIN}`;
  if (!item.recommended) return '超出本次推荐上限';
  return '';
}

/**
 * `stockArxivIds`＝后端已入库（报告 `excluded_existing`）∪ 前端已采纳（本地 paper 书行命中）的
 * arXiv 标识并集；不传或为空＝第一轮行为（只按三门槛分区）。
 */
export function buildShortlist(
  items: PaperCandidateEntry[],
  stockArxivIds: Set<string> = new Set(),
): ShortlistResult {
  const eligible: PaperCandidateEntry[] = [];
  const excluded: ShortlistExcluded[] = [];
  const settled: ShortlistExcluded[] = [];
  for (const item of items) {
    const reason = shortlistReason(item);
    if (reason) excluded.push({ item, reason });
    else if (stockArxivIds.has(candidateArxivId(item))) settled.push({ item, reason: SHORTLIST_SETTLED_REASON });
    else eligible.push(item);
  }
  const emptyText = eligible.length === 0
    ? (settled.length > 0 ? SHORTLIST_SETTLED_EMPTY_TEXT : SHORTLIST_EMPTY_TEXT)
    : '';
  return {
    eligible,
    excluded,
    settled,
    summaryLine: `候选 ${items.length} 篇 ｜ 待选区间 ${eligible.length} 篇（未达线 ${excluded.length} 篇）`
      + ` ｜ 已剔除 ${settled.length} 篇（${SHORTLIST_SETTLED_REASON}）`,
    emptyText,
  };
}
