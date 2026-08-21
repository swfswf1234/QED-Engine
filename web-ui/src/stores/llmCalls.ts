/**
 * 模型调用记录检索 store（/admin/llm-calls）
 * 数据源：GET /api/v1/llm/calls（qed_llm_calls 表，分页+过滤）
 */
import { create } from 'zustand';
import { llmCalls as apiLlmCalls } from '../api/llm';
import type { LlmCallItem, LlmCallsQuery } from './index';

export const LLM_CALLS_PAGE_SIZE = 10;

export interface LlmCallsFilters {
  service?: string;
  mode?: string;
  model?: string;
  status?: string;
  start?: string;
  end?: string;
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
      const query: LlmCallsQuery = { ...filters, page, size };
      const data = await apiLlmCalls(query);
      set({ items: data.items, total: data.total, page: data.page, size: data.size, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },
}));
