/**
 * 检索方向 → 论文探索请求参数映射（REQ-109 I8，REQ-107 壳 §11.2＝唯一正本）
 * - 「检索方向」是界面概念：深度复用 `core`、匹配复用 `frontier`，只用现成字段覆盖参数，
 *   不向 8901 提请求、不扩 `recipe` 值域（R8 已裁＝根侧参数映射）
 * - 一次探索恒 `top=5`，推荐上限不进界面（R9 已裁）
 * - 深度／匹配的 goal 追加语**实际下发**并原样回显（口径透明纪律）
 * - 匹配方向要求探索目标必填：8901 允许 goal 空，故拦在发起前的界面层
 * - 表中数值是对 8901 校验边界（limit 1–25、years_limit ≥ 0、top 1–20）的**取值**，
 *   不是把服务端阈值抄成前端判定
 */
import type { PaperRecommendBody } from './api/tracker';

export type PaperDirection = 'frontier' | 'core' | 'depth' | 'match';

/** 一次探索的推荐篇数（R9：固定 5 篇，界面不露调配面） */
export const PAPER_TOP_PER_LAUNCH = 5;

/** 深度方向的 goal 追加语（实际下发，段①摘要与段③都要显示同一串） */
export const PAPER_DEPTH_GOAL_SUFFIX = '侧重证明细节、方法论与理论深度';

export interface PaperDirectionPolicy {
  direction: PaperDirection;
  label: string;
  /** 段①选中后显示的说明行 */
  hint: string;
  /** 复用对方封闭值域内的配方 */
  recipe: 'frontier' | 'core';
  /** null＝随配方缺省，不下发该字段 */
  yearsLimit: number | null;
  limit: number | null;
  goalSuffix: string;
  goalRequired: boolean;
}

export const PAPER_DIRECTIONS: PaperDirectionPolicy[] = [
  {
    direction: 'frontier', label: '前沿', recipe: 'frontier',
    yearsLimit: null, limit: null, goalSuffix: '', goalRequired: false,
    hint: '近 3 年内的新工作，按配方缺省年窗与抓取量检索。',
  },
  {
    direction: 'core', label: '核心', recipe: 'core',
    yearsLimit: null, limit: null, goalSuffix: '', goalRequired: false,
    hint: '不限年份、少而稳的经典与工作版文献，按配方缺省抓取量检索。',
  },
  {
    direction: 'depth', label: '深度', recipe: 'core',
    yearsLimit: 0, limit: 25, goalSuffix: PAPER_DEPTH_GOAL_SUFFIX, goalRequired: false,
    hint: '不限年 + 每组抓取量拉满，并在探索目标上追加「侧重证明细节、方法论与理论深度」。',
  },
  {
    direction: 'match', label: '匹配', recipe: 'frontier',
    yearsLimit: 10, limit: 20, goalSuffix: '', goalRequired: true,
    hint: '放宽到近 10 年，优先与本次探索目标契合的条目；探索目标必填。',
  },
];

export function directionPolicy(direction: PaperDirection): PaperDirectionPolicy {
  const found = PAPER_DIRECTIONS.find((item) => item.direction === direction);
  if (!found) throw new Error(`未知检索方向：${direction}`);
  return found;
}

export interface PaperLaunchInput {
  domainId: string;
  direction: PaperDirection;
  /** 段①「探索目标」输入，可空 */
  goal: string;
  /** 领域描述（段①只读展示，探索目标留空时的缺省基底） */
  domainDescription: string;
  categories: string[];
}

export interface PaperLaunchResult {
  /** 非空＝发起前的界面拦截原因，此时 body 为 null */
  error: string;
  body: PaperRecommendBody | null;
  /** 实际下发的探索目标全文（未下发＝领域描述），供段①摘要与段③如实回显 */
  effectiveGoal: string;
}

export function composePaperLaunch(input: PaperLaunchInput): PaperLaunchResult {
  const policy = directionPolicy(input.direction);
  const userGoal = input.goal.trim();
  // 领域描述常以句号结尾，追加语用「，」衔接会出「。，」，故先去尾随句读
  const base = (userGoal || input.domainDescription.trim()).replace(/[。．.；;，,]+$/u, '');
  const effectiveGoal = policy.goalSuffix
    ? (base ? `${base}，${policy.goalSuffix}` : policy.goalSuffix)
    : base;
  if (!input.domainId.trim()) {
    return { error: '需要先选择领域（论文没有默认桶）', body: null, effectiveGoal };
  }
  if (policy.goalRequired && !userGoal) {
    return { error: '匹配方向需要填写本次探索目标', body: null, effectiveGoal };
  }
  const categories = input.categories.map((item) => item.trim()).filter(Boolean);
  const body: PaperRecommendBody = {
    domain_id: input.domainId.trim(),
    recipe: policy.recipe,
    top: PAPER_TOP_PER_LAUNCH,
    ...(userGoal || policy.goalSuffix ? { goal: effectiveGoal } : {}),
    ...(categories.length > 0 ? { categories } : {}),
    ...(policy.yearsLimit === null ? {} : { years_limit: policy.yearsLimit }),
    ...(policy.limit === null ? {} : { limit: policy.limit }),
  };
  return { error: '', body, effectiveGoal };
}
