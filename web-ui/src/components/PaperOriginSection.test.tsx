/**
 * 已入库论文详情按需回源小节测试（REQ-108 I5 ②，REQ-107 壳 §7）
 * - 纪律：只在点击时发请求；命中显示摘要/评审小结，未命中给「该论文没有探索记录」
 * - 缺 arXiv 标识（早期采纳/渠道记录无 arxiv）→ 不发请求，直接给无标识文案
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { ConfigProvider, App as AntApp } from 'antd';
import PaperOriginSection from './PaperOriginSection';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { usePaperExploreStore } from '../stores/paperExplore';
import type { PaperCandidateEntry } from '../stores';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function route(handler: (url: string) => [number, unknown]): void {
  mockFetch.mockImplementation(async (url: string) => {
    const [status, body] = handler(String(url));
    return jsonResponse(body, status);
  });
}

function entry(rank: number, arxiv: string, title: string): PaperCandidateEntry {
  return {
    rank,
    plan_index: 1,
    candidate: {
      provider: 'arxiv', provider_id: arxiv, title, authors: ['A. Author'], language: 'en',
      year: '2024', page_url: '', download_url: '', identifiers: { arxiv },
      abstract: '这篇论文的英文摘要原文。',
    },
    assessment: {
      arxiv_id: arxiv, goal_fit: 5, foundational_value: 5, readability: 5,
      reason: '对齐领域目标', risks: ['样本量小'],
    },
    score: 132,
    recommended: true,
  };
}

const REPORT = {
  selection_id: 'sel-9', status: 'ranked', created_at: '', domain_id: 'math', recipe: 'frontier',
  assessments: [entry(1, '2401.00009', '命中的那篇')],
  recommendations: [1],
};

function selectionCount(): number {
  return mockFetch.mock.calls.filter(([url]) => String(url).includes('/papers/selections')).length;
}

function renderSection(props = { bookId: 'math-b19', domainId: 'math', arxivId: '2401.00009' }) {
  return render(
    <ConfigProvider theme={theme}>
      <AntApp>
        <PaperOriginSection {...props} />
      </AntApp>
    </ConfigProvider>,
  );
}

beforeEach(() => {
  usePaperExploreStore.getState().reset();
  mockFetch.mockReset();
});

describe('PaperOriginSection', () => {
  it('挂载只渲染按钮，不发任何请求（点击才发）', () => {
    route(() => [200, { selections: [] }]);
    renderSection();
    expect(screen.getByRole('button', { name: /查看探索记录/ })).toBeInTheDocument();
    expect(selectionCount()).toBe(0);
  });

  it('命中：显示摘要、评审小结与三维分，引用数位不渲染', async () => {
    route((url) => {
      if (url.includes('/papers/selections?')) return [200, { selections: [{ selection_id: 'sel-9', domain_id: 'math', recipe: 'frontier', status: 'ranked', created_at: '', recommendation_count: 1 }] }];
      if (url.includes('/papers/selections/sel-9')) return [200, REPORT];
      return [404, { detail: 'unexpected' }];
    });
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: /查看探索记录/ }));
    const detail = await screen.findByTestId('paper-origin-detail');
    expect(within(detail).getByText('这篇论文的英文摘要原文。')).toBeInTheDocument();
    expect(within(detail).getByText('对齐领域目标')).toBeInTheDocument();
    expect(within(detail).getByText(/相关度 5 ｜ 基础性 5 ｜ 可读性 5 ｜ 总分 132/)).toBeInTheDocument();
    expect(screen.queryByText(/引用/)).not.toBeInTheDocument();
  });

  it('未命中：给「该论文没有探索记录」，不编造摘要', async () => {
    route((url) => (url.includes('/papers/selections?') ? [200, { selections: [{ selection_id: 'sel-9', domain_id: 'math', recipe: 'frontier', status: 'ranked', created_at: '', recommendation_count: 1 }] }] : [200, REPORT]));
    renderSection({ bookId: 'b', domainId: 'math', arxivId: '9999.99999' });
    fireEvent.click(screen.getByRole('button', { name: /查看探索记录/ }));
    await waitFor(() => expect(screen.getByTestId('paper-origin-miss')).toBeInTheDocument());
    expect(screen.queryByTestId('paper-origin-detail')).not.toBeInTheDocument();
  });

  it('缺 arXiv 标识 → 不发请求，直接给无标识文案', async () => {
    route(() => [200, { selections: [] }]);
    renderSection({ bookId: 'b', domainId: 'math', arxivId: '' });
    fireEvent.click(screen.getByRole('button', { name: /查看探索记录/ }));
    expect(await screen.findByTestId('paper-origin-no-source')).toHaveTextContent('无法取得 arXiv 标识');
    expect(selectionCount()).toBe(0);
  });

  it('8901 离线（503）→ 静默未命中，不弹错', async () => {
    route(() => [503, { detail: 'QED-Tracker 服务不可达' }]);
    renderSection({ bookId: 'b', domainId: 'math', arxivId: '2401.1' });
    fireEvent.click(screen.getByRole('button', { name: /查看探索记录/ }));
    await waitFor(() => expect(screen.getByTestId('paper-origin-miss')).toBeInTheDocument());
    expect(usePaperExploreStore.getState().error).toBeNull();
  });
});
