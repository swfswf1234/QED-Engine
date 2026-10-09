import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TocConfirmPanel from './TocConfirmPanel';
import { mockFetch } from '../../test/setup';

/** 夹具＝b05 目录页实测文本（解析产物 paragraph 块，页 7） */
const B05_P7 = [
  '目录',
  '第1章 实数系和复数系…… 1',
  '导引 …… 1',
  '有序集 …… 2',
  '域 …… 4',
  '实数域 …… 7',
  '复数域 …… 10',
  '附录 …… 15',
  '习题 …… 18',
  '第2章 基础拓扑 …… 21',
];

const OUTLINE_SAVED = { course_id: 'ma', book_ref: 'b05', outline: [{ kp_id: 'kp-1', name: '第1章 实数系和复数系' }] };

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

const renderPanel = (props: Partial<React.ComponentProps<typeof TocConfirmPanel>> = {}) => render(
  <TocConfirmPanel
    courseId="ma"
    bookRef="b05"
    initialLines={B05_P7}
    pageCount={317}
    bodyPages={[{ page: 7, text: '第1章 实数系和复数系' }]}
    {...props}
  />,
);

afterEach(cleanup);

describe('目录确认面板（M6 裁决 ②：解析 + 人工确认）', () => {
  it('章/节预览按 PDF 页序显示范围，未识别行逐条列出', () => {
    renderPanel();
    expect(screen.getByText('第1章 实数系和复数系')).toBeTruthy();
    expect(screen.getByText('7–26')).toBeTruthy();
    expect(screen.getByText('导引')).toBeTruthy();
    expect(screen.getByText('附录 …… 15')).toBeTruthy();
    expect(screen.getByText('未识别 2 行')).toBeTruthy();
    expect(screen.getAllByText('设计内剔除')).toHaveLength(2);
  });

  it('自动试算命中时提示偏移值（bodyPages 首章正文侧出现页）', () => {
    renderPanel();
    expect(screen.getByText(/自动试算 6/)).toBeTruthy();
    expect(screen.getByText('7–26')).toBeTruthy();
  });

  it('试算未命中时提示人工填', () => {
    renderPanel({ bodyPages: [{ page: 300, text: '与首章无关的正文' }] });
    expect(screen.getByText(/自动试算未命中/)).toBeTruthy();
  });

  it('偏移人工覆盖 → 预览页范围随之改', () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('页码偏移'), { target: { value: '10' } });
    expect(screen.getByText('11–30')).toBeTruthy();
  });

  it('目录行可改可删：补页码后该行不再列在未识别里', () => {
    renderPanel({ initialLines: ['第一章 甲 …… 1', '乙'] });
    expect(screen.getByText('未识别 1 行')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('目录行'), { target: { value: '第一章 甲 …… 1\n乙 …… 2' } });
    expect(screen.getByText('未识别 0 行')).toBeTruthy();
    expect(screen.getByText('乙')).toBeTruthy();
  });

  it('确认写入＝整树 PUT outline（book_ref + 章/节页范围，最深两级）', async () => {
    let posted: { book_ref?: string; tree?: unknown } | null = null;
    const onSaved = vi.fn();
    mockFetch.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
      if (String(url).endsWith('/learn/courses/ma/outline') && init?.method === 'PUT') {
        posted = JSON.parse(String(init.body));
        return jsonResponse(OUTLINE_SAVED);
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    renderPanel({ onSaved });
    fireEvent.click(screen.getByRole('button', { name: '确认写入' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const body = posted as unknown as { book_ref: string; tree: Array<{ name: string; page_start: number; page_end: number; children: unknown[] }> };
    expect(body.book_ref).toBe('b05');
    expect(body.tree).toHaveLength(2);
    expect(body.tree[0]).toMatchObject({ name: '第1章 实数系和复数系', page_start: 7, page_end: 26 });
    expect(body.tree[0].children).toHaveLength(5);
    expect(body.tree[1]).toMatchObject({ name: '第2章 基础拓扑', page_start: 27, page_end: 317 });
    await waitFor(() => expect(screen.getByText('目录已写入：2 章')).toBeTruthy());
  });

  it('写入失败走 8900 错误包络提示，不抛异常', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ detail: '目录树最深两级（章→节）' }, 422));
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '确认写入' }));
    await waitFor(() => expect(screen.getByText(/校验失败：目录树最深两级/)).toBeTruthy());
  });

  it('解析不出章题时确认按钮禁用（空树不写入）', () => {
    renderPanel({ initialLines: ['（目录页尚未识别）'] });
    expect(screen.getByRole('button', { name: '确认写入' }).closest('button')?.disabled).toBe(true);
  });
});
