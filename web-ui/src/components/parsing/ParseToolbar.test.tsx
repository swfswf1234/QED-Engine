/**
 * 顶栏四行重排与动作确认（parsing-ui §8 蓝图 D4，REQ-098 W8，2026-09-28 用户裁决）：
 * 行1 书名独行；行2 动作行（三态文案 + 确认弹窗前置 + 页码导航尾部）；
 * 行3 视图行（编辑模式｜单页/连续｜滚动同步｜流式/版式；**缩放控件已撤销**，W9 追改裁决）；
 * 行4 编辑行（框图修改=新增/合并；解析修正=整页确认+统计）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App, ConfigProvider } from 'antd';
import ParseToolbar from './ParseToolbar';
import { theme } from '../../theme';
import { mockFetch } from '../../test/setup';
import { useParsingStore } from '../../stores/parsing';
import type { BookMeta } from '../../api/axiom';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const mkBook = (extra: Record<string, unknown> = {}): BookMeta =>
  ({
    book_id: 'b1', title: '测试书目甲', display_title: '测试书目甲', author: 'A',
    page_count: 20, sha256: 's', strategy: 'local',
    file_path: 'raw/a.pdf', ingest_status: 'ingested', ...extra,
  }) as BookMeta;

const mkPages = (parsed: boolean) => ({
  1: { data: parsed ? ({ blocks: [] } as never) : null, parsed, loading: false, error: null },
});

const rows = () => Array.from(screen.getByTestId('parse-toolbar').children);

function mount(bk: BookMeta = mkBook(), pageNo = 1, blockCount = 4) {
  return render(
    <ConfigProvider theme={theme}>
      <App><ParseToolbar book={bk} pageNo={pageNo} blockCount={blockCount} /></App>
    </ConfigProvider>,
  );
}

/** 动作确认后的网络链路：POST /parse-jobs 捕获 + 轮询终态 + 页刷新回读 */
function mockJobRoutes(capture: { body?: unknown }) {
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    const m = (init?.method ?? 'GET').toUpperCase();
    if (m === 'POST' && url.includes('/parse-jobs')) {
      capture.body = JSON.parse(String(init?.body));
      return Promise.resolve(json({ id: 'j1', book_id: 'b1', status: 'queued', progress: { parsed: 0, total: 1 } }));
    }
    if (url.includes('/parse-jobs/j1')) return Promise.resolve(json({ id: 'j1', book_id: 'b1', status: 'completed', progress: { parsed: 1, total: 1 } }));
    if (url.includes('/books/b1/ingest')) return Promise.resolve(json({ book_id: 'b1', page_count: 20, ingest_status: 'ingested' }));
    if (url.includes('/pages/1/edits')) return Promise.resolve(json([]));
    if (url.includes('/pages/1')) return Promise.resolve(json({ page_no: 1, blocks: [] }));
    if (/\/books\/b1(\?|$)/.test(url)) return Promise.resolve(json(mkBook()));
    return Promise.reject(new TypeError(`no route: ${m} ${url}`));
  });
}

async function clickConfirm(user: ReturnType<typeof userEvent.setup>) {
  const ok = await screen.findByRole('button', { name: /确\s*认/ });
  await user.click(ok);
}

describe('ParseToolbar 四行重排（§8 蓝图 D4）', () => {
  beforeEach(() => {
    useParsingStore.setState({
      compareBookId: 'b1', compareBook: mkBook(), comparePageNo: 1, pages: mkPages(false),
      selectedBlock: -1, editMode: false, editPane: 'box', boxSelection: [],
      regionDraft: { added: [], deleted: [], merged: [] }, drawMode: false,
      scrollMode: 'single', renderMode: 'stream', syncScroll: true,
      activeJob: null, jobError: null, jobSubmitting: false, ingestBusy: {}, edits: {},
    });
  });

  afterEach(() => {
    cleanup();
    mockFetch.mockReset();
  });

  it('行结构：只读=3 行、行1 仅书名、行2 含页码导航（尾部）、行3 无缩放控件（W9 撤销）', () => {
    mount();
    const r = rows();
    expect(r).toHaveLength(3);
    expect(r[0].textContent).toBe('测试书目甲');
    // 页码导航居行2 尾部（antd InputNumber 的「n / 总数」在 input.value，非 textContent）
    const nav = r[1].lastElementChild as HTMLElement;
    expect(nav.querySelector('input')?.value).toContain('/ 20');
    // 行3=编辑模式｜单页/连续｜滚动同步｜流式/版式；缩放滑杆已按追改裁决撤除
    expect(r[2].textContent).toContain('编辑模式');
    expect(r[2].textContent).not.toContain('缩放');
    expect(r[2].querySelector('.ant-slider')).toBeNull();
  });

  it('开编辑模式=4 行；行4（框图修改）=新增/合并两动作钮，无「删除选中」「保存框图修改」', async () => {
    mount();
    const user = userEvent.setup();
    await user.click(document.querySelector<HTMLElement>('[aria-label="编辑模式开关"]')!);
    expect(rows()).toHaveLength(4);
    const row4 = rows()[3];
    expect(row4.textContent).toContain('框图修改');
    expect(row4.querySelector('button')!.parentElement).toBeTruthy();
    expect(screen.getByRole('button', { name: /新\s*增/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /合\s*并/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '删除选中' })).toBeNull();
    expect(screen.queryByRole('button', { name: '保存框图修改' })).toBeNull();
  });

  it('行4（解析修正）=整页确认 + 审阅统计', async () => {
    mount();
    const user = userEvent.setup();
    await user.click(document.querySelector<HTMLElement>('[aria-label="编辑模式开关"]')!);
    await user.click(await screen.findByText('解析修正'));
    expect(screen.getByRole('button', { name: '整页确认' })).toBeInTheDocument();
    expect(screen.getByText(/已判定 \d+ \/ 共 4 块/)).toBeInTheDocument();
  });

  it('未解析页→「解析本页」点击先弹确认，确认后才 POST pages:[1]', async () => {
    const capture: { body?: unknown } = {};
    mockJobRoutes(capture);
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '解析本页' }));
    expect(await screen.findByText(/识别第 1 页并生成块/)).toBeInTheDocument();
    expect(capture.body).toBeUndefined(); // 未确认不发任务
    await clickConfirm(user);
    await waitFor(() => expect(capture.body).toEqual({ book_id: 'b1', pages: [1] }));
  });

  it('已解析页→文案「重新解析本页」且确认文案含覆盖警示', async () => {
    useParsingStore.setState({ pages: mkPages(true) });
    mount();
    expect(screen.getByRole('button', { name: '重新解析本页' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '重新解析本页' }));
    expect(await screen.findByText(/覆盖第 1 页现有解析结果/)).toBeInTheDocument();
  });

  it('已入库→「重新书页入库」，确认文案含重渲染覆盖警示', async () => {
    mockJobRoutes({});
    mount();
    expect(screen.getByRole('button', { name: '重新书页入库' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '重新书页入库' }));
    expect(await screen.findByText(/重渲染并覆盖全部页图/)).toBeInTheDocument();
    await clickConfirm(user);
    await waitFor(() => expect(mockFetch.mock.calls.some((c) => String(c[0]).includes('/ingest'))).toBe(true));
  });

  it('部分完成（0<pages_done<总）→「解析全部未完成页」禁用（待 R6）+「重新全部解析」并列', () => {
    mount(mkBook({ pages_done: 7 }));
    expect(screen.getByRole('button', { name: '解析全部未完成页' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '重新全部解析' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '全本解析' })).toBeNull();
  });

  it('全部完成（pages_done≥总）→「重新全部解析」确认后才 POST（pages 缺省）', async () => {
    const capture: { body?: unknown } = {};
    mockJobRoutes(capture);
    mount(mkBook({ pages_done: 20 }));
    expect(screen.getByRole('button', { name: '重新全部解析' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '解析全部未完成页' })).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '重新全部解析' }));
    expect(await screen.findByText(/覆盖全部 20 页/)).toBeInTheDocument();
    await clickConfirm(user);
    await waitFor(() => expect(capture.body).toEqual({ book_id: 'b1' }));
  });

  it('未入库（ingest_status=none）→「书页入库」可点、「解析本页」禁用', () => {
    mount(mkBook({ ingest_status: 'none', pages_done: undefined }));
    expect(screen.getByRole('button', { name: '书页入库' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '解析本页' })).toBeDisabled();
  });
});
