/**
 * 右栏论文卡片列测试（REQ-108 I6，壳 §8）
 * - 卡面＝标题（两行截断）+ 年 + 首位作者 + 五层态徽标 + 页数（有则显示）；点卡 → 详情（§7 回源）
 * - 卡内不放批量操作（与教程列一致，操作留在详情弹窗）
 * - 空态＝「该领域还没有已采纳论文」+ 发起论文探索出口
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ConfigProvider, App as AntApp } from 'antd';
import PaperColumn from './PaperColumn';
import { theme } from '../theme';
import type { BookRecord } from '../stores';

function paper(partial: Partial<BookRecord> & { book_id: string }): BookRecord {
  return {
    title: '论文标题',
    original_title: null,
    part: '',
    authors: [{ name: 'A. Author', role: 'author' }],
    publisher: 'arXiv',
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
    domain_id: 'dm1',
    created_at: '',
    updated_at: '',
    kind: 'paper',
    ...partial,
  };
}

function renderColumn(props: Partial<React.ComponentProps<typeof PaperColumn>> = {}) {
  const onBookClick = vi.fn();
  const onExplore = vi.fn();
  render(
    <ConfigProvider theme={theme}>
      <AntApp>
        <PaperColumn
          books={[]}
          courseNameById={{}}
          onBookClick={onBookClick}
          onExplore={onExplore}
          {...props}
        />
      </AntApp>
    </ConfigProvider>,
  );
  return { onBookClick, onExplore };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('PaperColumn', () => {
  it('卡面给出标题/年/首位作者/五层态徽标/页数，点卡回调带上该书', () => {
    const books = [paper({ book_id: 'p1', title: '注意力机制的一种解释', year: 2021, page_count: 18 })];
    const { onBookClick } = renderColumn({ books });
    const card = screen.getByTestId('paper-card');
    expect(within(card).getByText('注意力机制的一种解释')).toBeInTheDocument();
    expect(within(card).getByText('2021')).toBeInTheDocument();
    expect(within(card).getByText('A. Author')).toBeInTheDocument();
    expect(within(card).getByText('已完成')).toBeInTheDocument();
    expect(within(card).getByText('18 页')).toBeInTheDocument();
    fireEvent.click(card);
    expect(onBookClick).toHaveBeenCalledWith(books[0]);
  });

  it('落位到课程的论文带课程归属标签；无页数不显示页码位', () => {
    const books = [paper({ book_id: 'p2', course_id: '01_analysis', page_count: null, status: 'candidate' })];
    renderColumn({ books, courseNameById: { '01_analysis': '数学分析' } });
    const card = screen.getByTestId('paper-card');
    expect(within(card).getByText('数学分析')).toBeInTheDocument();
    expect(within(card).getByText('待下载')).toBeInTheDocument();
    expect(within(card).queryByText(/页$/)).not.toBeInTheDocument();
  });

  it('卡内不放操作按钮（操作留在详情弹窗）', () => {
    renderColumn({ books: [paper({ book_id: 'p3' })] });
    expect(within(screen.getByTestId('paper-card')).queryAllByRole('button')).toHaveLength(0);
  });

  it('头部一行计数（领域全量含课程落位）', () => {
    renderColumn({ books: [paper({ book_id: 'p4' }), paper({ book_id: 'p5', course_id: 'c1' })] });
    expect(screen.getByTestId('paper-column-title')).toHaveTextContent('论文（2）');
  });

  it('空态：该行文案 + 发起论文探索出口', () => {
    const { onExplore } = renderColumn({ books: [] });
    expect(screen.getByTestId('paper-column-empty')).toHaveTextContent('该领域还没有已采纳论文');
    fireEvent.click(screen.getByRole('button', { name: /发起论文探索/ }));
    expect(onExplore).toHaveBeenCalledTimes(1);
  });
});
