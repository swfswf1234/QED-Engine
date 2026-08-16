/**
 * 服务域 / 配置域端点封装（8900，ADR 0007 唯一入口）
 * 契约来源：backend/qed_engine/api/service_manager.py、api/main.py
 */
import { api, type ApiRequestOptions } from './client';
import type { DatabaseStatus, ServiceStatus, ServicesResponse } from '../stores';

export interface ServiceActionResponse {
  name: string;
  status: 'starting' | 'stopping';
  pid: number | null;
}

/** GET /api/v1/services：四服务状态快照（config 恒 online） */
export async function listServices(opts?: ApiRequestOptions): Promise<ServiceStatus[]> {
  const data = await api.get<ServicesResponse>('/services', opts);
  return data.services;
}

export type ServiceOp = 'start' | 'stop' | 'restart';

/** POST /api/v1/services/{name}/{op}：启停托管（409 冲突透传） */
export async function operateService(name: string, op: ServiceOp): Promise<ServiceActionResponse> {
  return api.post<ServiceActionResponse>(`/services/${name}/${op}`);
}

/** GET /api/v1/config/database：本地 MySQL 真实连接状态（pymysql 探测，60s 缓存） */
export async function getDatabaseStatus(opts?: ApiRequestOptions): Promise<DatabaseStatus> {
  return api.get<DatabaseStatus>('/config/database', opts);
}