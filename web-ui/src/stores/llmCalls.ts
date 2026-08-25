/**
 * 模型调用记录检索 store（/admin/llm-calls）
 * 数据源：GET /api/v1/llm/calls（qed_llm_calls 表，分页+过滤）
 * 2026-08-25 精简：去掉 task/step（全 NULL）/mode（审核无价值），日期范围合并为 RangePicker
 */
import { create } from 'zustand';
import { llmCalls as apiLlmCalls, reviewCall as apiReviewCall } from '../api/llm';
import type { LlmCallItem, LlmCallsQuery } from './index';

export const LLM_CALLS_PAGE_SIZE = 10;

export interface LlmCallsFilters {
  service?: string;
  model?: string;
  status?: string;
  dateRange?: [string, string]; // [start, end] — DatePicker.RangePicker 输出
  review_status?: string;
}

export interface LlmCallsStore {
  items: LlmCallItem[];
  total: number;
  page: number;
  size: number;
  filters: LlmCallsFilters;
  loading: boolean;
  error: string | null;
  setFilters: (filters: LlmCallsFilters) => void;
  setPage: (page: number) => void;
  fetch: () => Promise<void>;
  reviewItem: (callId: number, reviewStatus: string, reviewNote?: string) => Promise<void>;
}

export const useLlmCallsStore = create<LlmCallsStore>((set, get) => ({
  items: [],
  total: 0,
  page: 1,
  size: LLM_CALLS_PAGE_SIZE,
  filters: {},
  loading: false,
  error: null,

  setFilters: (filters) => set({ filters, page: 1 }),
  setPage: (page) => set({ page }),

  fetch: async () => {
    const { filters, page, size } = get();
    set({ loading: true });
    try {
      // dateRange [start, end] → 拆分为后端 start/end 参数
      const { dateRange, ...rest } = filters;
      const query: LlmCallsQuery = { ...rest, page, size };
      if (dateRange) {
        if (dateRange[0]) query.start = dateRange[0];
        if (dateRange[1]) query.end = dateRange[1];
      }
      const data = await apiLlmCalls(query);
      set({ items: data.items, total: data.total, page: data.page, size: data.size, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  reviewItem: async (callId, reviewStatus, reviewNote = '') => {
    await apiReviewCall(callId, { review_status: reviewStatus, review_note: reviewNote });
    // 刷新当前列表
    await get().fetch();
  },
}));
