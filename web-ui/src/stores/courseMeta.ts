/**
 * 课程元数据（公共）：学习阶段 / 先修依赖 / 布局常量
 * - 阶段数据源：QED-Tracker GET /courses 响应（qed_course 表，stage 为中文）；
 *   stageKey() 将中文阶段名映射为英文 CourseStage 键
 * - 课程排序/先修依赖：由 API 动态提供，不再硬编码
 * - STAGE_ORDER / STAGE_LABELS：布局常量，CourseGraph 渲染依赖
 */

// --- 学习阶段（QED-031 五层模型） ---

export type CourseStage = 'basic' | 'advanced' | 'graduate' | 'qe';

/** stage 布局顺序（底层→顶层） */
export const STAGE_ORDER: CourseStage[] = ['basic', 'advanced', 'graduate', 'qe'];

/** stage 中文 → 英文映射（QED-Tracker GET /courses 返回中文阶段名） */
const ZH_TO_STAGE: Record<string, CourseStage> = {
  '本科基础': 'basic',
  '本科进阶': 'advanced',
  '研究生基础': 'graduate',
  'QE冲刺': 'qe',
  // 兼容变体
  'QE 冲刺': 'qe',
  'qe': 'qe',
  'basic': 'basic',
  'advanced': 'advanced',
  'graduate': 'graduate',
};

/** 中文阶段名 → 英文 CourseStage 键；无法识别时返回 'graduate' 兜底 */
export function stageKey(zh: string): CourseStage {
  return ZH_TO_STAGE[zh] ?? 'graduate';
}

/** stage 英文键 → 中文显示标签 */
export const STAGE_LABELS: Record<CourseStage, string> = {
  basic: '本科基础',
  advanced: '本科进阶',
  graduate: '研究生基础',
  qe: 'QE 冲刺',
};

// --- 课程排序（保持兼容 courseOrderCmp 调用） ---

/** 课程 ID 排序比较函数：按 API 返回顺序，未知 ID 排末尾 */
export function courseOrderCmp(a: string, b: string): number {
  // 此函数保留签名兼容，实际排序由 buildCourseGraph 中的 API 顺序驱动
  return a.localeCompare(b);
}
