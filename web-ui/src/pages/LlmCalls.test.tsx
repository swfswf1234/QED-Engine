import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import LlmCalls from './LlmCalls';
import { theme } from '../theme';
import { useLlmCallsStore } from '../stores/llmCalls';
import { llmCalls as apiLlmCalls, reviewCall as apiReviewCall } from '../api/llm';

vi.mock('../api/llm', () => ({ llmCalls: vi.fn(), reviewCall: vi.fn() }));

const longPrompt = '甲'.repeat(100);

const itemsFixture = [
  {
    id: 1, service: 'qed_engine', mode: 'api', provider: 'qwen', model: 'qwen-plus',
    endpoint: 'text', prompt: longPrompt, response: 'OK 回复', prompt_template: 'paper-plan/plan@v1',
    duration_ms: 120, status: 'success', created_at: '2026-08-20 10:00:00',
    task: 'paper-plan', step: 'plan', review_status: 'unreviewed', review_note: '',
  },
  {
    id: 2, service: 'qed_tracker', mode: 'local', provider: 'lm-studio', model: 'qwen2.5-7b',
    endpoint: 'summarize', prompt: '短 prompt', response: '', prompt_template: 'paper-plan/plan@v1',
    duration_ms: null, status: 'error', error: '超时', created_at: '2026-08-20 11:00:00',
    task: 'paper-plan', step: 'assess', review_status: 'passed', review_note: '效果好',
  },
  {
    id: 3, service: 'qed_engine', mode: 'api', provider: 'qwen', model: 'qwen-plus',
    endpoint: 'text', prompt: '无模板 prompt', response: 'OK',
    duration_ms: 50, status: 'success', created_at: '2026-08-20 12:00:00',
    review_status: 'unreviewed',
  },
];

function renderLlmCalls() {
  return render(
    <MemoryRouter>
      <ConfigProvider theme={theme}>
        <AntApp>
          <LlmCalls />
        </AntApp>
      </ConfigProvider>
    </MemoryRouter>,
  );
}

const mockApi = (items = itemsFixture) => {
  (apiLlmCalls as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    items, total: items.length, page: 1, size: 10,
  });
};

describe('模型调用记录检索页 LlmCalls（REQ-060）', () => {
  beforeEach(() => {
    useLlmCallsStore.setState({
      items: [], total: 0, page: 1, size: 10, filters: {}, loading: false, error: null,
    });
    (apiLlmCalls as unknown as ReturnType<typeof vi.fn>).mockReset();
    (apiReviewCall as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it('渲染页面：标题、查询/重置按钮、模板列', async () => {
    mockApi();
    renderLlmCalls();
    await screen.findByText('模型调用记录');
    expect(screen.getByRole('button', { name: /查\s*询/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重\s*置/ })).toBeInTheDocument();
    // 模板列显示（两条记录都有同模板，模板 Tag 出现多次）
    const tags = screen.getAllByText('paper-plan/plan@v1');
    expect(tags.length).toBeGreaterThanOrEqual(2);
  });

  it('展开行：显示审核 Select、task/step、Prompt/Response 区块', async () => {
    mockApi();
    renderLlmCalls();
    await screen.findByText('模型调用记录');
    await waitFor(() => {
      expect(document.querySelectorAll('.ant-table-row-expand-icon').length).toBeGreaterThanOrEqual(1);
    });
    const icons = document.querySelectorAll('.ant-table-row-expand-icon');
    fireEvent.click(icons[0] as Element);
    // 展开行内审核状态 Select（行内快速变更，不再有「标记审核」按钮）
    await waitFor(() => {
      const selects = document.querySelectorAll('.llm-call-detail .ant-select');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText(/任务：paper-plan/)).toBeInTheDocument();
    expect(screen.getByText(/步骤：plan/)).toBeInTheDocument();
    // prompt/response 完整文本在展开行中可见（预览列也会出现同文本，故作用域限定展开行）
    const detail = document.querySelector('.llm-call-detail');
    expect(detail?.textContent).toContain(longPrompt.slice(0, 50));
    expect(detail?.textContent).toContain('OK 回复');
  });

  it('选择服务筛选后点「查询」-> fetch 携带 service 且重置 page', async () => {
    (apiLlmCalls as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [], total: 0, page: 1, size: 10,
    });
    renderLlmCalls();
    await screen.findByText('模型调用记录');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '服务筛选' }));
    fireEvent.click(await screen.findByTitle('qed_engine'));
    fireEvent.click(screen.getByRole('button', { name: /查\s*询/ }));
    await waitFor(() => {
      expect(useLlmCallsStore.getState().filters.service).toBe('qed_engine');
    });
    expect(apiLlmCalls).toHaveBeenLastCalledWith(expect.objectContaining({ service: 'qed_engine', page: 1 }));
  });

  it('点「重置」-> 清空筛选并重新 fetch', async () => {
    (apiLlmCalls as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [], total: 0, page: 1, size: 10,
    });
    renderLlmCalls();
    await screen.findByText('模型调用记录');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '服务筛选' }));
    fireEvent.click(await screen.findByTitle('qed_engine'));
    fireEvent.click(screen.getByRole('button', { name: /查\s*询/ }));
    await waitFor(() => {
      expect(useLlmCallsStore.getState().filters.service).toBe('qed_engine');
    });
    fireEvent.click(screen.getByRole('button', { name: /重\s*置/ }));
    await waitFor(() => {
      expect(useLlmCallsStore.getState().filters.service).toBeUndefined();
    });
    expect(apiLlmCalls).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 10 }));
  });

  it('翻页：Pagination 点第二页 -> fetch 携带 page=2', async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ ...itemsFixture[0], id: i + 1 }));
    (apiLlmCalls as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items, total: 25, page: 1, size: 10,
    });
    renderLlmCalls();
    await screen.findByText('模型调用记录');
    await waitFor(() => {
      expect(apiLlmCalls).toHaveBeenCalled();
    });
    const page2 = document.querySelector('.ant-pagination-item-2') as Element;
    expect(page2).not.toBeNull();
    fireEvent.click(page2);
    await waitFor(() => {
      expect(apiLlmCalls).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    });
  });

  it('行内变更审核状态 -> 调用 reviewItem', async () => {
    mockApi();
    (apiReviewCall as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, call_id: 1 });
    renderLlmCalls();
    await screen.findByText('模型调用记录');
    await waitFor(() => {
      expect(document.querySelectorAll('.ant-table-row-expand-icon').length).toBeGreaterThanOrEqual(1);
    });
    const icons = document.querySelectorAll('.ant-table-row-expand-icon');
    fireEvent.click(icons[0] as Element);
    // 展开行内审核 Select（role=combobox）— 选择「通过」触发行内变更
    await screen.findByText(/任务：paper-plan/);
    const detail = document.querySelector('.llm-call-detail') as HTMLElement;
    expect(detail).not.toBeNull();
    const combo = within(detail).getByRole('combobox');
    fireEvent.mouseDown(combo);
    fireEvent.click(await screen.findByTitle('通过'));
    await waitFor(() => {
      expect(apiReviewCall).toHaveBeenCalledWith(1, { review_status: 'passed', review_note: '' });
    });
  });

  it('展开行：JSON 输入输出美化展示且仅前 10 行，提供全文复制按钮', async () => {
    const bigPrompt = JSON.stringify({ task: 'plan', steps: Array.from({ length: 30 }, (_, i) => ({ no: i })) });
    (apiLlmCalls as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [{
        ...itemsFixture[0], id: 99,
        prompt: bigPrompt,
        response: JSON.stringify({ ok: true, rows: Array.from({ length: 25 }, (_, i) => i) }),
      }],
      total: 1, page: 1, size: 10,
    });
    renderLlmCalls();
    await screen.findByText('模型调用记录');
    await waitFor(() => {
      expect(document.querySelectorAll('.ant-table-row-expand-icon').length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.click(document.querySelectorAll('.ant-table-row-expand-icon')[0] as Element);
    await screen.findByText(/任务：paper-plan/);
    const detail = document.querySelector('.llm-call-detail') as HTMLElement;
    expect(detail).not.toBeNull();
    // JSON 美化（缩进键名）出现
    expect(detail?.textContent).toContain('"task": "plan"');
    // 超过 10 行 → 折叠态尾注出现 + 展开全部按钮（Prompt/Response 各一个，取第一个）
    expect(detail?.textContent).toContain('…（共');
    fireEvent.click(within(detail).getAllByRole('button', { name: /展开全部/ })[0]);
    // 展开后完整内容可见（末尾数据项出现）
    await waitFor(() => {
      expect(detail?.textContent).toContain('"no": 29');
    });
    // Prompt / Response 各一个「复制」按钮
    const copies = within(detail).getAllByRole('button', { name: /复制/ });
    expect(copies.length).toBe(2);
  });

  it('模型筛选：AutoComplete 输入后查询生效', async () => {
    (apiLlmCalls as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [], total: 0, page: 1, size: 10,
    });
    renderLlmCalls();
    await screen.findByText('模型调用记录');
    const input = screen.getByRole('combobox', { name: '模型筛选' });
    fireEvent.change(input, { target: { value: 'qwen' } });
    fireEvent.click(screen.getByRole('button', { name: /查\s*询/ }));
    await waitFor(() => {
      expect(useLlmCallsStore.getState().filters.model).toBe('qwen');
    });
  });
});
