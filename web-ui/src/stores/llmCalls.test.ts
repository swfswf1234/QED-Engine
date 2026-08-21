import { useLlmCallsStore } from './llmCalls';
import { llmCalls as apiLlmCalls } from '../api/llm';

vi.mock('../api/llm', () => ({ llmCalls: vi.fn() }));

describe('llmCalls store', () => {
  beforeEach(() => {
    useLlmCallsStore.setState({ items: [], total: 0, page: 1, size: 10, filters: {}, loading: false });
    vi.clearAllMocks();
  });

  it('fetch 携带过滤器并落 items/total', async () => {
    (apiLlmCalls as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [{ id: 1, service: 'qed_engine', mode: 'api', provider: 'qwen', model: 'qwen-plus',
        endpoint: 'text', prompt: 'p', response: 'r', duration_ms: 100, status: 'success',
        created_at: '2026-08-20 10:00:00' }],
      total: 1, page: 1, size: 10,
    });
    useLlmCallsStore.getState().setFilters({ service: 'qed_engine' });
    await useLlmCallsStore.getState().fetch();
    const s = useLlmCallsStore.getState();
    expect(s.total).toBe(1);
    expect(s.items[0].service).toBe('qed_engine');
  });

  it('翻页：setPage 后 fetch 携带 page', async () => {
    (apiLlmCalls as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [], total: 0, page: 2, size: 10,
    });
    useLlmCallsStore.getState().setPage(2);
    await useLlmCallsStore.getState().fetch();
    expect(apiLlmCalls).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });
});
