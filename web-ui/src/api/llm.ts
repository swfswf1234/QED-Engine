/**
 * LLM 网关端点封装（8900）
 * 契约来源：backend/qed_engine/api/control.py（llm-gateway-and-model-management）
 */
import { api, type ApiRequestOptions } from './client';
import type { CallsResponse, KeysStatus, LlmCallsQuery, LlmTestResult } from '../stores';

/** GET /api/v1/config/keys：供应商配置状态 + 运行模式（不含密钥值；控制台依赖卡模式感知用） */
export async function getKeys(opts?: ApiRequestOptions): Promise<KeysStatus> {
  return api.get<KeysStatus>('/config/keys', opts);
}

/** POST /api/v1/llm/test/text：文字模型测试（控制台测试按钮） */
export async function llmTestText(opts?: ApiRequestOptions): Promise<LlmTestResult> {
  return api.post<LlmTestResult>('/llm/test/text', undefined, opts);
}

/** POST /api/v1/llm/test/vision：图像模型测试（控制台测试按钮） */
export async function llmTestVision(opts?: ApiRequestOptions): Promise<LlmTestResult> {
  return api.post<LlmTestResult>('/llm/test/vision', undefined, opts);
}

/** POST /api/v1/database/test：MySQL 即时连接探测（控制台测试按钮） */
export async function databaseTest(opts?: ApiRequestOptions): Promise<{
  reachable: boolean;
  reason?: string;
}> {
  return api.post<{ reachable: boolean; reason?: string }>('/database/test', undefined, opts);
}

/** GET /api/v1/llm/calls：调用记录检索（分页+过滤） */
export async function llmCalls(query: LlmCallsQuery, opts?: ApiRequestOptions): Promise<CallsResponse> {
  const params = new URLSearchParams();
  (Object.entries(query) as Array<[string, string | number | undefined]>).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return api.get<CallsResponse>(`/llm/calls${qs ? `?${qs}` : ''}`, opts);
}

/** PATCH /api/v1/llm/calls/{id}/review：审核标注（REQ-060） */
export async function reviewCall(
  callId: number,
  data: { review_status: string; review_note?: string },
  opts?: ApiRequestOptions,
): Promise<{ ok: boolean; call_id: number }> {
  return api.patch<{ ok: boolean; call_id: number }>(`/llm/calls/${callId}/review`, data, opts);
}
