import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import LlmCalls from './LlmCalls';
import { theme } from '../theme';
import { useLlmCallsStore } from '../stores/llmCalls';
import { llmCalls as apiLlmCalls } from '../api/llm';

vi.mock('../api/llm', () => ({ llmCalls: vi.fn() }));

const longPrompt = '甲'.repeat(100);

const itemsFixture = [
  {
    id: 1, service: 'qed_engine', mode: 'api', provider: 'qwen', model: 'qwen-plus',
    endpoint: 'text', prompt: longPrompt, response: 'OK 回复',
    duration_ms: 120, status: 'success', created_at: '2026-08-20 10:00:00',
  },
  {
    id: 2, service: 'qed_tracker', mode: 'local', provider: 'lm-studio', model: 'qwen2.5-7b',
    endpoint: 'summarize', prompt: '短 prompt', response: '',
    duration_ms: null, status: 'error', error: '超时', created_at: '2026-08-20 11:00:00',
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

const mockApi = () => {
  (apiLlmCalls as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    items: itemsFixture, total: 2, page: 1, size: 10,
  });
};

describe('模型调用记录检索页 LlmCalls（#/admin/llm-calls）', () => {
  beforeEach(() => {
    useLlmCallsStore.setState({
      items: [], total: 0, page: 1, size: 10, filters: {}, loading: false, error: null,
    });
    (apiLlmCalls as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it('渲染筛选栏与表格：服务/模式/状态筛选、模型关键字、日期、查询/重置、状态 Tag 着色', async () => {
    mockApi();
    renderLlmCalls();
    // 表格数据（fetch on mount）
    expect(await screen.findByText('qed_engine')).toBeInTheDocument();
    expect(screen.getByText('qed_tracker')).toBeInTheDocument();
    expect(screen.getByText('api')).toBeInTheDocument();
    expect(screen.getByText('local')).toBeInTheDocument();
    expect(screen.getByText('qwen / qwen-plus')).toBeInTheDocument();
    expect(screen.getByText('120 ms')).toBeInTheDocument();
    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(screen.getByText('失败')).toBeInTheDocument();
    // 摘要截断 80 字 + 省略号（prompt → response 拼接）
    expect(screen.getByText(`${'甲'.repeat(80)}… → OK 回复`)).toBeInTheDocument();
    // 筛选栏控件
    expect(screen.getByRole('combobox', { name: '服务筛选' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '模式筛选' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '状态筛选' })).toBeInTheDocument();
    expect(screen.getByLabelText('模型筛选')).toBeInTheDocument();
    expect(screen.getByLabelText('开始日期')).toBeInTheDocument();
    expect(screen.getByLabelText('结束日期')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查\s*询/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重\s*置/ })).toBeInTheDocument();
  });

  it('选择服务筛选后点「查询」→ fetch 携带 service 且重置 page', async () => {
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

  it('点「重置」→ 清空筛选并重新 fetch（不带 service）', async () => {
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

  it('翻页：Pagination 点第二页 → fetch 携带 page=2', async () => {
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

  it('展开行显示完整 prompt/response/error', async () => {
    mockApi();
    renderLlmCalls();
    await screen.findByText('qed_engine');
    const icons = document.querySelectorAll('.ant-table-row-expand-icon');
    expect(icons.length).toBeGreaterThanOrEqual(2);
    // 第一条：完整 prompt + response
    fireEvent.click(icons[0] as Element);
    expect(await screen.findByText(longPrompt)).toBeInTheDocument();
    expect(screen.getByText('OK 回复')).toBeInTheDocument();
    // 第二条（error）：完整错误信息
    fireEvent.click(icons[1] as Element);
    expect(await screen.findByText('超时')).toBeInTheDocument();
  });
});
