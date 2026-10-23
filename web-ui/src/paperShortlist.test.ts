/**
 * 待选区间门槛纯函数测试（REQ-108 I4 + REQ-109 I11，REQ-107 壳 §6 / §11.5 / S3）
 * - 门槛三条且仅三条：goal_fit ≥ 4 ∧ score ≥ 80 ∧ recommended（R6 已裁双门槛 + 服务端推荐）
 * - 达线之上再叠「未在库」（R10 已裁）：命中 stockArxivIds 的达线条目进 settled 并计入剔除 J
 * - 未入选按序取第一个不满足项给**唯一**归因：相关度 → 总分 → 超出本次推荐上限
 * - 头部三段计数：候选 N ｜ 待选区间 M（未达线 X）｜ 已剔除 J（已采纳／已在库）
 * - 纯函数不读 exploration_stage、不重算服务端权重与阈值
 */
import { describe, it, expect } from 'vitest';
import {
  SHORTLIST_GOAL_FIT_MIN, SHORTLIST_SCORE_MIN, SHORTLIST_SETTLED_REASON,
  candidateArxivId, shortlistReason, buildShortlist,
} from './paperShortlist';
import type { PaperCandidateEntry } from './stores';

function entry(
  rank: number,
  overrides: Partial<Pick<PaperCandidateEntry, 'score' | 'recommended'>> = {},
  assessment: Partial<PaperCandidateEntry['assessment']> = {},
): PaperCandidateEntry {
  return {
    rank,
    plan_index: 1,
    candidate: {
      provider: 'arxiv', provider_id: `2401.0000${rank}`, title: `论文${rank}`, authors: [],
      language: 'en', year: '2024', page_url: '', download_url: '', identifiers: { arxiv: `2401.0000${rank}` },
    },
    assessment: {
      arxiv_id: `2401.0000${rank}`, goal_fit: 4, foundational_value: 5, readability: 5,
      reason: '理由', risks: [], ...assessment,
    },
    score: 80,
    recommended: true,
    ...overrides,
  };
}

describe('门槛常量', () => {
  it('界面门槛＝相关度 4 / 总分 80（不抄服务端阈值 70 与权重 10/6/4）', () => {
    expect(SHORTLIST_GOAL_FIT_MIN).toBe(4);
    expect(SHORTLIST_SCORE_MIN).toBe(80);
  });
});

describe('shortlistReason 逐条唯一归因', () => {
  it('三条全满足 → 空串（入选）', () => {
    expect(shortlistReason(entry(1))).toBe('');
  });

  it('相关度不达 → 「相关度 x＜4」，且优先于其他不达项', () => {
    expect(shortlistReason(entry(1, { score: 60, recommended: false }, { goal_fit: 3 })))
      .toBe('相关度 3＜4');
  });

  it('相关度达、总分不达 → 「总分 y＜80」', () => {
    expect(shortlistReason(entry(1, { score: 79 }, { goal_fit: 5 }))).toBe('总分 79＜80');
  });

  it('两条门槛都达但服务端未推荐 → 「超出本次推荐上限」', () => {
    expect(shortlistReason(entry(1, { score: 95, recommended: false }, { goal_fit: 5 })))
      .toBe('超出本次推荐上限');
  });

  it('边界值算达线：goal_fit=4 且 score=80 且 recommended → 入选', () => {
    expect(shortlistReason(entry(1))).toBe('');
  });
});

describe('candidateArxivId 标识口径', () => {
  it('取 identifiers.arxiv，缺失时退回 provider_id（与书行匹配、按需回源同一口径）', () => {
    expect(candidateArxivId(entry(1))).toBe('2401.00001');
    const noIdentifiers = entry(3);
    noIdentifiers.candidate.identifiers = {};
    expect(candidateArxivId(noIdentifiers)).toBe(noIdentifiers.candidate.provider_id);
  });
});

describe('buildShortlist 分区与计数', () => {
  const list: PaperCandidateEntry[] = [
    entry(1, { score: 132 }),
    entry(2, { score: 90, recommended: false }, { goal_fit: 5 }),
    entry(3, { score: 70 }, { goal_fit: 5 }),
    entry(4, {}, { goal_fit: 2 }),
  ];

  it('达线进 eligible（默认全选集合），其余进 excluded 并带归因', () => {
    const r = buildShortlist(list);
    expect(r.eligible.map((e) => e.rank)).toEqual([1]);
    expect(r.excluded.map((e) => e.item.rank)).toEqual([2, 3, 4]);
    expect(r.excluded.map((e) => e.reason)).toEqual([
      '超出本次推荐上限', '总分 70＜80', '相关度 2＜4',
    ]);
  });

  it('头部三段计数（不传剔除集合时 J＝0）', () => {
    expect(buildShortlist(list).summaryLine)
      .toBe('候选 4 篇 ｜ 待选区间 1 篇（未达线 3 篇） ｜ 已剔除 0 篇（已采纳／已在库）');
  });

  it('一条都不达线 → eligible 空 + 门槛取值空态文案', () => {
    const r = buildShortlist([entry(1, { score: 50 }, { goal_fit: 1 })]);
    expect(r.eligible).toHaveLength(0);
    expect(r.emptyText).toBe('本次没有达到待选门槛的论文（相关度需 ≥4 且总分需 ≥80）');
    expect(r.summaryLine).toBe('候选 1 篇 ｜ 待选区间 0 篇（未达线 1 篇） ｜ 已剔除 0 篇（已采纳／已在库）');
  });

  it('空报告 → 全零且不炸', () => {
    const r = buildShortlist([]);
    expect(r.eligible).toEqual([]);
    expect(r.excluded).toEqual([]);
    expect(r.summaryLine).toBe('候选 0 篇 ｜ 待选区间 0 篇（未达线 0 篇） ｜ 已剔除 0 篇（已采纳／已在库）');
  });

  it('保持服务端排序（按数组原序，不按分数重排）', () => {
    const r = buildShortlist([entry(9, { score: 81 }), entry(2, { score: 120 })]);
    expect(r.eligible.map((e) => e.rank)).toEqual([9, 2]);
  });
});

describe('buildShortlist 剔除已采纳／已在库（REQ-109 I11）', () => {
  const all: PaperCandidateEntry[] = [
    entry(1, { score: 132 }),          // 达线、在库（后端 excluded_existing）
    entry(2, { score: 120 }),          // 达线、已采纳（本地书行）
    entry(3, { score: 100 }),          // 达线、未判别 → 待选
    entry(4, {}, { goal_fit: 2 }),     // 未达线
  ];
  const stock = new Set(['2401.00001', '2401.00002']);

  it('达线且在库/已采纳 → 进 settled 带「已采纳／已在库」归因，不进待选区间', () => {
    const r = buildShortlist(all, stock);
    expect(r.eligible.map((e) => e.rank)).toEqual([3]);
    expect(r.settled.map((e) => e.item.rank)).toEqual([1, 2]);
    expect(r.settled.map((e) => e.reason)).toEqual([SHORTLIST_SETTLED_REASON, SHORTLIST_SETTLED_REASON]);
    expect(SHORTLIST_SETTLED_REASON).toBe('已采纳／已在库');
  });

  it('三段计数各按来源分列，后端 excluded_existing 与前端剔除不重复计', () => {
    expect(buildShortlist(all, stock).summaryLine)
      .toBe('候选 4 篇 ｜ 待选区间 1 篇（未达线 1 篇） ｜ 已剔除 2 篇（已采纳／已在库）');
  });

  it('达线全被剔除（M＝0 且 J＞0）→ 专门空态文案', () => {
    const r = buildShortlist(all.slice(0, 2), stock);
    expect(r.eligible).toHaveLength(0);
    expect(r.emptyText).toBe('本领域达线的论文都已采纳或已在库，换个检索方向再探索');
  });

  it('未达线条目不因在库而重复计：settled 只收达线的', () => {
    const r = buildShortlist([entry(4, {}, { goal_fit: 1 })], new Set(['2401.00004']));
    expect(r.settled).toHaveLength(0);
    expect(r.excluded.map((e) => e.reason)).toEqual(['相关度 1＜4']);
    expect(r.emptyText).toBe('本次没有达到待选门槛的论文（相关度需 ≥4 且总分需 ≥80）');
  });

  it('剔除集合按 arXiv 标识匹配（不看 rank、不看标题）', () => {
    expect(buildShortlist([entry(5, { score: 130 })], new Set(['2401.00005'])).eligible).toHaveLength(0);
    expect(buildShortlist([entry(5, { score: 130 })], new Set(['2401.99999'])).eligible).toHaveLength(1);
  });
});
