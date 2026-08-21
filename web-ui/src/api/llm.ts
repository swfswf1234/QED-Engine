/**
 * LLM 网关端点封装（8900）
 * 契约来源：backend/qed_engine/api/control.py（llm-gateway-and-model-management）
 */
import { api, type ApiRequestOptions } from './client';
import type { CallsResponse, LlmCallsQuery, LlmTestResult } from '../stores';

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
