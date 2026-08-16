import { Badge } from 'antd';
import type { ServiceStatus } from '../stores';

/** 服务状态点（设计：frontend-react-refactor 通用组件「状态点」；黑字高对比） */
export function statusBadge(status: ServiceStatus['status'] | 'online' | 'offline', reason?: string) {
  const map: Record<string, { color: string; text: string }> = {
    online: { color: '#52c41a', text: '在线' },
    offline: { color: '#ff4d4f', text: '离线' },
    starting: { color: '#faad14', text: '启动中' },
    stopping: { color: '#faad14', text: '停止中' },
  };
  const item = map[status] ?? { color: '#999', text: status };
  return <Badge color={item.color} text={reason ? `${item.text}（${reason}）` : item.text} />;
}

/** 布尔状态点（可达性，如 MySQL/LLM） */
export function reachableBadge(reachable: boolean, reason?: string) {
  return statusBadge(reachable ? 'online' : 'offline', reason);
}