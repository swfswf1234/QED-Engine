/**
 * 探索 mock 开关（QED-Tracker 未就绪留白）
 * - localStorage qed-explore-mock=1 强制开启 / =0 或缺省关闭
 * - 构建期环境变量 VITE_EXPLORE_MOCK=1 亦可全局开启
 * - 端点就绪联调后关闭即切回真实 API，界面零改动
 */
export function isExploreMockEnabled(): boolean {
  try {
    const v = localStorage.getItem('qed-explore-mock');
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    /* localStorage 不可用 → 走环境变量 */
  }
  return import.meta.env.VITE_EXPLORE_MOCK === '1';
}
