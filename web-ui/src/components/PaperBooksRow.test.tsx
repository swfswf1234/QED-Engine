/**
 * PaperBooksRow 论文展示行测试（REQ-102 W3，downloads-ui.md §4.4）
 * - 空清单（含筛选后为空）整行隐藏；标题「论文（k）」
 * - 条目=标题 + 年 + 五档状态徽标（含平行读物）；点击条目回调该书
 * - stage 筛选照用 bookInStage 五档口径（§4.2）
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigProvider, App as AntApp } from 'antd';
import PaperBooksRow from './PaperBooksRow';
import { theme } from '../theme';
import type { BookRecord } from '../stores';
import type { PaperRowBadge } from '../stores/paperExplore';

function paper(id: string, overrides?: Partial<BookRecord>): BookRecord {
  return {
    book_id: id,
    title: `论文 ${id}`,
    original_title: null,
    part: '',
    authors: [],
    publisher: '',
    edition: '',
    year: 2024,
    language: 'en',
    roles: [],
    status: 'verified',
    retire_reason: '',
    holding: 'owned',
    file_path: null,
    priority: null,
    notes: null,
    domain_id: 'math',
    created_at: '',
    updated_at: '',
    kind: 'paper',
    ...overrides,
  };
}

function renderRow(books: BookRecord[], stage = '', onBookClick = vi.fn()) {
  return render(
    <ConfigProvider theme={theme}>
      <AntApp>
        <PaperBooksRow books={books} stage={stage} onBookClick={onBookClick} />
      </AntApp>
    </ConfigProvider>,
  );
}

describe('PaperBooksRow 论文展示行', () => {
  it('空清单不渲染整行', () => {
    renderRow([]);
    expect(screen.queryByTestId('paper-books-row')).toBeNull();
  });

  it('非空渲染「论文（k）」标题与条目（标题+年+徽标）', () => {
    renderRow([paper('p1', { status: 'verified' }), paper('p2', { status: 'downloaded', year: 2025 })]);
    expect(screen.getByText('论文（2）')).toBeInTheDocument();
    expect(screen.getByText('论文 p1')).toBeInTheDocument();
    expect(screen.getByText('论文 p2')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('待验证')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();
  });

  it('五档徽标口径：candidate/decided=待下载、downloading=下载中、parallel=平行读物', () => {
    renderRow([
      paper('a', { status: 'candidate' }),
      paper('b', { status: 'decided' }),
      paper('c', { status: 'downloading' }),
      paper('d', { status: 'failed' }),
      paper('e', { status: 'parallel' }),
    ]);
    expect(screen.getAllByText('待下载')).toHaveLength(2);
    expect(screen.getByText('下载中')).toBeInTheDocument();
    expect(screen.getByText('失败')).toBeInTheDocument();
    expect(screen.getByText('平行读物')).toBeInTheDocument();
  });

  it('stage 筛选：仅保留匹配档', () => {
    renderRow([paper('a', { status: 'verified' }), paper('b', { status: 'failed' })], 'completed');
    expect(screen.getByText('论文（1）')).toBeInTheDocument();
    expect(screen.queryByText('论文 b')).toBeNull();
  });

  it('stage 筛空则整行隐藏', () => {
    renderRow([paper('a', { status: 'verified' })], 'failed');
    expect(screen.queryByTestId('paper-books-row')).toBeNull();
  });

  it('点击条目回调对应书籍', () => {
    const onBookClick = vi.fn();
    const b = paper('p1');
    renderRow([b], '', onBookClick);
    fireEvent.click(screen.getByText('论文 p1'));
    expect(onBookClick).toHaveBeenCalledWith(b);
  });
});

describe('PaperBooksRow §7.2 活动态徽标与入口（REQ-102 W4）', () => {
  function renderWithStatus(books: BookRecord[], status: PaperRowBadge, onExplore = vi.fn()) {
    return render(
      <ConfigProvider theme={theme}>
        <AntApp>
          <PaperBooksRow books={books} stage="" onBookClick={vi.fn()} status={status} onExplore={onExplore} />
        </AntApp>
      </ConfigProvider>,
    );
  }

  it('无书行 + hidden 徽标 → 仍整行隐藏', () => {
    renderWithStatus([], { key: 'hidden', text: '' });
    expect(screen.queryByTestId('paper-books-row')).toBeNull();
  });

  it('无书行但探索中/失败/待评审 → 出行且行名即徽标文案', () => {
    renderWithStatus([], { key: 'running', text: '探索中' });
    expect(screen.getByTestId('paper-books-row')).toBeInTheDocument();
    expect(screen.getByText('探索中')).toBeInTheDocument();
  });

  it('已沉淀态不重复出徽标（行名已带篇数）', () => {
    renderWithStatus([paper('p1')], { key: 'sedimented', text: '已沉淀 1 篇' });
    expect(screen.getByText('论文（1）')).toBeInTheDocument();
    expect(screen.queryByTestId('paper-row-badge')).toBeNull();
  });

  it('待评审徽标可点击直达弹窗；探索中徽标不可点', () => {
    const onExplore = vi.fn();
    renderWithStatus([paper('p1')], { key: 'review', text: '待评审' }, onExplore);
    const badge = screen.getByTestId('paper-row-badge');
    expect(badge).toBeEnabled();
    fireEvent.click(badge);
    expect(onExplore).toHaveBeenCalled();
    renderWithStatus([paper('p1')], { key: 'running', text: '探索中' });
    expect(screen.getAllByTestId('paper-row-badge').at(-1)).toBeDisabled();
  });

  it('入口按钮「论文探索」仅领域级挂载点（传 onExplore）出现', () => {
    renderRow([paper('p1')]);
    expect(screen.queryByRole('button', { name: '论文探索' })).toBeNull();
    renderWithStatus([paper('p1')], { key: 'sedimented', text: '已沉淀 1 篇' });
    expect(screen.getByRole('button', { name: '论文探索' })).toBeInTheDocument();
  });
});
