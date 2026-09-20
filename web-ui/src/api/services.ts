/**
 * 服务域 / 配置域端点封装（8900，ADR 0007 唯一入口）
 * 契约来源：backend/qed_engine/api/service_manager.py、api/main.py
 */
import { api, type ApiRequestOptions } from './client';
import type { DatabaseStatus, GpuStatus, ServiceStatus, ServicesResponse } from '../stores';

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

export interface SelfRestartResponse {
  status: 'restarting';
}

/** POST /api/v1/self-restart：8900 自身重启（延迟 2s 绑定端口 + 后台 1s 后旧进程退出） */
export async function selfRestart(opts?: ApiRequestOptions): Promise<SelfRestartResponse> {
  return api.post<SelfRestartResponse>('/self-restart', undefined, opts);
}

/** GET /api/v1/config/database：本地 MySQL 真实连接状态（pymysql 探测，60s 缓存） */
export async function getDatabaseStatus(opts?: ApiRequestOptions): Promise<DatabaseStatus> {
  return api.get<DatabaseStatus>('/config/database', opts);
}

/** GET /api/v1/monitor/gpu：GPU + 系统内存总览（控制台总览条） */
export async function monitorGpu(opts?: ApiRequestOptions): Promise<GpuStatus> {
  return api.get<GpuStatus>('/monitor/gpu', opts);
}

export interface ModelRoute {
  model: string;
  provider: string;
  configured: boolean;
}

export interface ModelsConfig {
  default: ModelRoute;
  ocr: ModelRoute;
  embedding: ModelRoute;
}

/** GET /api/v1/config/models：模型路由表（云端模型名来源） */
export async function fetchModelsConfig(opts?: ApiRequestOptions): Promise<ModelsConfig> {
  return api.get<ModelsConfig>('/config/models', opts);
}