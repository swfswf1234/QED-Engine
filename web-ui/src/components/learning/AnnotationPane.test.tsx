import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import AnnotationPane from './AnnotationPane';
import { theme } from '../../theme';
import { mockFetch } from '../../test/setup';
import { useLearnWorkbenchStore } from '../../stores/learnWorkbench';
import type { KpDetailRow } from '../../api/learn';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

function candidate(overrides: Partial<KpDetailRow> = {}): KpDetailRow {
  return {
    detail_id: 'd1', course_id: 'ma', name: '确界原理', norm_key: '确界原理', type: 'concept',
    narrative: '非空有上界的实数集必有上确界', payload: {}, anchors: [], gen_batch: 'learn-workbench',
    model_ref: '', gen_status: 'candidate', kp_id: null, dedup_of: null, map_seed: null,
    parent_kp_id: 'kp-c1', intent: 'summary', book_ref: 'b05',
    domain_id: 'math', domain_label: '数学', course_label: '数学分析', confirmed: 0,
    created_at: '', updated_at: '', ...overrides,
  };
}

const calls: string[] = [];
let posted: Record<string, unknown> | null = null;

function routes(pool: KpDetailRow[]) {
  calls.length = 0;
  posted = null;
  mockFetch.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('/learn/courses/ma/outline')) return jsonResponse({ course_id: 'ma', book_ref: 'b05', outline: [] });
    if (url.includes('/confirm')) {
      return jsonResponse({ point: { kp_id: 'kp-9', name: String(posted?.name ?? '确界原理') } });
    }
    if (url.includes('/reject')) return jsonResponse({ detail: { gen_status: 'rejected' } });
    if (url.includes('/learn/kp-details')) {
      if (init?.method === 'POST') posted = JSON.parse(String(init.body));
      return jsonResponse({ details: pool, total: pool.length });
    }
    return Promise.reject(new TypeError(`no route: ${url}`));
  });
}

function renderPane() {
  return render(
    <ConfigProvider theme={theme}>
      <AnnotationPane />
    </ConfigProvider>,
  );
}

function presetState(patch: Record<string, unknown>) {
  useLearnWorkbenchStore.setState({
    courseId: 'ma', bookId: 'b05', selectedKpId: 'kp-c1',
    selectedBlock: { page: 8, index: 2, snippet: '有序集：满足序关系与完备性的集合' },
    candidates: [], notice: null, ...patch,
  });
}

describe('批注登记面板 AnnotationPane（M6 右栏：批注 → 候选 → 确认）', () => {
  beforeEach(() => {
    presetState({});
    routes([candidate()]);
  });

  it('锚点提示跟随中栏选区，未选块时给出「不选＝无锚点」口径', () => {
    const { unmount } = renderPane();
    expect(screen.getByText('锚点＝第 8 页：有序集：满足序关系与完备性的集合')).toBeInTheDocument();
    unmount();
    presetState({ selectedBlock: null });
    renderPane();
    expect(screen.getByText('在中栏点选一个内容块作为锚点（不选＝无锚点登记）')).toBeInTheDocument();
  });

  it('本章候选按「用途·状态」标注，开放态行给确认/驳回入口', () => {
    presetState({ candidates: [candidate(), candidate({ detail_id: 'd2', name: '闭区间套', narrative: '一列嵌套闭区间的交非空', intent: 'explanation', gen_status: 'adopted' })] });
    renderPane();
    expect(screen.getByText('本章候选（2）')).toBeInTheDocument();
    expect(screen.getByText('总结·待确认')).toBeInTheDocument();
    expect(screen.getByText('非空有上界的实数集必有上确界')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '确认入库' })).toHaveLength(1);
    expect(screen.getByText('详解·已入库')).toBeInTheDocument();
  });

  it('候选为空时给空态，不显示确认入口', () => {
    presetState({ candidates: [] });
    renderPane();
    expect(screen.getByText('本章暂无候选')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '确认入库' })).not.toBeInTheDocument();
  });

  it('填知识点名与正文后保留为候选：POST 带章归属/用途/页锚点，写后清空输入并刷新列表', async () => {
    renderPane();
    const keep = screen.getByRole('button', { name: '保留为候选' });
    expect(keep).toBeDisabled();
    fireEvent.change(screen.getByLabelText('知识点名'), { target: { value: '确界原理' } });
    fireEvent.change(screen.getByLabelText('批注正文'), { target: { value: '非空有上界的实数集必有上确界' } });
    expect(keep).toBeEnabled();
    fireEvent.click(keep);
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({
      course_id: 'ma', name: '确界原理', narrative: '非空有上界的实数集必有上确界',
      intent: 'explanation', gen_status: 'candidate', parent_kp_id: 'kp-c1', book_ref: 'b05',
      anchors: [{ kind: 'book', ref_id: 'b05', page: 8, snippet: '有序集：满足序关系与完备性的集合' }],
    });
    expect(await screen.findByText('本章候选（1）')).toBeInTheDocument();
    expect(screen.getByLabelText('知识点名')).toHaveValue('');
  });

  it('切到「总结」并以概念分类登记：intent/type 随 POST 落库', async () => {
    renderPane();
    fireEvent.click(screen.getByText('总结'));
    fireEvent.change(screen.getByLabelText('知识点名'), { target: { value: '上确界定义' } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '四分类' }));
    fireEvent.click(await screen.findByText('概念'));
    fireEvent.click(screen.getByRole('button', { name: '保留为候选' }));
    await waitFor(() => expect(posted).toMatchObject({ intent: 'summary', type: 'concept' }));
  });

  it('未选中章/节时禁用登记并提示归属来源', () => {
    presetState({ selectedKpId: null, candidates: [] });
    renderPane();
    fireEvent.change(screen.getByLabelText('知识点名'), { target: { value: '无处归属' } });
    expect(screen.getByRole('button', { name: '保留为候选' })).toBeDisabled();
    expect(screen.getByText('先在左栏选中章/节，批注才有归属。')).toBeInTheDocument();
  });

  it('确认入库走 confirm 端点并回执；重复提升（409）按状态冲突提示', async () => {
    presetState({ candidates: [candidate()] });
    renderPane();
    fireEvent.click(screen.getByRole('button', { name: '确认入库' }));
    await waitFor(() =>
      expect(calls.some((c) => c.startsWith('POST ') && c.endsWith('/learn/kp-details/d1/confirm'))).toBe(true),
    );
    expect(await screen.findByText(/已确认并提升/)).toBeInTheDocument();

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/confirm')) {
        return jsonResponse({ detail: '同名知识点已确认，不能重复提升' }, 409);
      }
      if (url.includes('/learn/courses/ma/outline')) {
        return jsonResponse({ course_id: 'ma', book_ref: 'b05', outline: [] });
      }
      return jsonResponse({ details: [candidate()], total: 1 });
    });
    fireEvent.click(screen.getByRole('button', { name: '确认入库' }));
    expect(await screen.findByText('状态冲突：同名知识点已确认，不能重复提升')).toBeInTheDocument();
  });

  it('驳回走 reject 端点并提示不落主表', async () => {
    presetState({ candidates: [candidate()] });
    renderPane();
    fireEvent.click(screen.getByRole('button', { name: /驳\s*回/ }));
    await waitFor(() =>
      expect(calls.some((c) => c.startsWith('POST ') && c.endsWith('/learn/kp-details/d1/reject'))).toBe(true),
    );
    expect(await screen.findByText('已驳回（不落主表，可重新批注）')).toBeInTheDocument();
  });
});
