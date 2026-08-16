import type { ServiceStatus } from './index';

/** 8903 前端本地判定服务（页面能显示即在线；不来自 /services，控制台/仪表盘共用） */
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