import type { ServiceStatus } from './index';

/**
 * 8903 前端服务兜底（控制台/仪表盘共用）。
 * 后端 /services 注册表已含 web 单元（8900 在线时以真实状态为准，经去重不重复渲染）；
 * 8900 离线时前端无法经 /services 获取，此本地判定兜底（页面能显示即在线）。
 */
export const WEB_SERVICE: ServiceStatus = {
  name: 'web',
  label: 'QED 前端服务',
  port: 8903,
  log_path: '',
  status: 'online',
  pid: null,
  started_at: null,
  reason: '',
};