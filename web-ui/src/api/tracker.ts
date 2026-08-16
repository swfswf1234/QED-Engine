/**
 * 数据域·QED-Tracker 端点封装（8900 唯一入口，ADR 0007）
 * 契约来源：backend/qed_engine/api/tracker.py（透传 8901 /api/v1）
 * - /catalogs/{catalog_id}：课程目录（targets 提供课程结构，下载管理主数据源）
 * - /selections：表1 选课条目（内嵌表2 downloads + download_stats；可 course_id/status 过滤）
 */
import { api, type ApiRequestOptions } from './client';
import type { Catalog, SelectionRecord } from '../stores';

/** 内置目录 id（冻结目录 math-qe，QED-Tracker catalog.py） */
export const CATALOG_ID = 'math-qe';

/** GET /api/v1/catalogs/{catalog_id}：课程目录详情 */
export async function listCatalog(catalogId: string = CATALOG_ID, opts?: ApiRequestOptions): Promise<Catalog> {
  return api.get<Catalog>(`/catalogs/${catalogId}`, opts);
}

export interface ListSelectionsParams {
  course_id?: string;
  status?: string;
}

/** GET /api/v1/selections：表1 列表（rejected/superseded 由上游数据层彻底隐藏） */
export async function listSelections(
  params?: ListSelectionsParams,
  opts?: ApiRequestOptions,
): Promise<SelectionRecord[]> {
  return api.get<SelectionRecord[]>('/selections', { ...opts, params: params as Record<string, string | undefined> | undefined });
}