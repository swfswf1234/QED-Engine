/**
 * 探索状态 selector（纯规则，独立模块避免 store ↔ mock 循环依赖）
 * 上限规则（2026-08-23 用户裁决固化）：
 * - 每课教程上限 4（draft+confirmed+completed 计入）
 * - 完成审核 ≥2 套 → 达标锁定（停止自动探索）
 * 颜色：0 教程=未探索(none/灰)；有教程但完成<2=不足(insufficient/黄)；完成≥2=达标(ready/绿)
 */
export const EXPLORE_MAX_TUTORIALS = 4;
export const EXPLORE_MIN_CONFIRMED = 2;

/** 轮询周期（设计正文：每 3s 轮询）与连续失败上限（3 次本地转 failed） */
export const POLL_INTERVAL_MS = 3000;
export const MAX_POLL_FAILURES = 3;

/** 探索状态三档（驱动左树与右侧按钮颜色） */
export type ExploreStatus = 'none' | 'insufficient' | 'ready';

export function exploreStatusOf(tutorialCount: number, completedCount: number): ExploreStatus {
  if (tutorialCount <= 0) return 'none';
  if (completedCount >= EXPLORE_MIN_CONFIRMED) return 'ready';
  return 'insufficient';
}

/** 剩余可增教程数 = 4 − 现有，不为负 */
export function remainingSlots(tutorialCount: number): number {
  return Math.max(0, EXPLORE_MAX_TUTORIALS - tutorialCount);
}

/** 锁定：教程满 4 或完成 ≥2（服务端 409 双闸的界面预判） */
export function isCourseLocked(tutorialCount: number, completedCount: number): boolean {
  return tutorialCount >= EXPLORE_MAX_TUTORIALS || completedCount >= EXPLORE_MIN_CONFIRMED;
}
