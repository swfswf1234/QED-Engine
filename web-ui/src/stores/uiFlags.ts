/**
 * 探索界面展示开关（2026-08-23 用户裁决：余量为默认参数不对外展示）
 * - showExploreSlots() 默认 false：界面不出现「上限余量 / 已勾选 n/N / 可勾数=4−…」等数字
 * - 需要调试查看时设环境变量 VITE_SHOW_EXPLORE_SLOTS=1 打开（勾选上限的禁用逻辑不受影响）
 */
export function showExploreSlots(): boolean {
  return import.meta.env.VITE_SHOW_EXPLORE_SLOTS === '1';
}
