import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Parsing from './Parsing';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useParsingStore } from '../stores/parsing';

// ── 纯合成 fixture（不依赖任何真实书目/课程数据）──────────────────────

const BOOK_A = 'test-book-alpha';
const BOOK_B = 'test-book-beta';
const TITLE_A = '测试书目甲';
const TITLE_B = '测试书目乙';
const DOMAIN_ID = 'test-domain';
const DOMAIN_TITLE = '测试领域';
const COURSE_A_ID = 'test-course-a';
const COURSE_A_TITLE = '测试课程A';

const bookA = (extra: Record<string, unknown> = {}) => ({
  book_id: BOOK_A, title: TITLE_A, display_title: TITLE_A, author: 'Author Alpha',
  page_count: 20, sha256: 'sha-a', strategy: 'local',
  file_path: 'raw/test/alpha.pdf', ingest_status: 'ingested',
  domain_id: DOMAIN_ID, course_id: COURSE_A_ID, course_name: COURSE_A_TITLE,
  ...extra,
});

const bookB = (extra: Record<string, unknown> = {}) => ({
  book_id: BOOK_B, title: TITLE_B, display_title: TITLE_B, author: 'Author Beta',
  page_count: 15, sha256: 'sha-b', strategy: 'hybrid',
  file_path: 'raw/test/beta.pdf', ingest_status: 'none',
  ...extra,
});

const booksFixture = [bookA(), bookB()];

const treeFixture = [
  {
    key: `domain:${DOMAIN_ID}`,
    type: 'domain',
    title: DOMAIN_TITLE,
    domainId: DOMAIN_ID,
    children: [
      {
        key: `course:${DOMAIN_ID}:${COURSE_A_ID}`,
        type: 'course',
        title: COURSE_A_TITLE,
        courseId: COURSE_A_ID,
        domainId: DOMAIN_ID,
        children: [
          { key: `book:${BOOK_A}`, type: 'book', title: TITLE_A, book: bookA() },
          { key: `book:${BOOK_B}`, type: 'book', title: TITLE_B, book: bookB() },
        ],
      },
    ],
  },
];

const pageFixture = {
  page_no: 1,
  image_url: '/api/v1/books/test-page.png',
  markdown: '# Test Page\n\n$$x^2+y^2=1$$',
  blocks: {
    page: 1,
    source: 'mock-source',
    blocks: [
      { type: 'heading', bbox: [50, 40, 744, 80], level: 1, text: 'Test Heading' },
      { type: 'paragraph', bbox: [50, 100, 744, 200], text: 'Test paragraph content.' },
      { type: 'formula', bbox: [150, 220, 640, 280], latex: 'x^2+y^2=1' },
    ],
  },
};

/** store 复位到初始态（单屏：左树 + 右对照） */
const resetStore = () =>
  useParsingStore.setState({
    books: [], booksLoading: false,
    tree: [], treeLoading: false, treeError: null,
    error: null, dataError: null,
    syncing: false, syncMessage: null, syncError: null,
    compareBookId: null, compareBook: null, comparePageNo: 1,
    pages: {}, selectedBlock: -1, editMode: false,
    scrollMode: 'single', renderMode: 'stream', syncScroll: true,
    zoom: 100,
    activeJob: null, jobError: null, ingestBusy: {},
    edits: {}, editSubmitting: false,
  });

/** 基础路由：books 列表 + 树 + A 书第 1 页 */
function mockBase() {
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'GET' && url.includes('/parsing/tree')) return Promise.resolve(json(treeFixture));
    if (method === 'GET' && url.includes(`/books/${BOOK_A}/pages/1/edits`)) return Promise.resolve(json([]));
    if (method === 'GET' && url.includes(`/books/${BOOK_A}/pages/1`)) return Promise.resolve(json(pageFixture));
    if (method === 'GET' && new RegExp(`/books/${BOOK_A}(\\?|$)`).test(url)) return Promise.resolve(json(bookA()));
    if (method === 'GET' && /\/books(\?|$)/.test(url)) return Promise.resolve(json(booksFixture));
    return Promise.reject(new TypeError(`no route: ${method} ${url}`));
  });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function renderP() {
  return render(
    <MemoryRouter>
      <ConfigProvider theme={theme}><Parsing /></ConfigProvider>
    </MemoryRouter>,
  );
}

// ── 测试 ─────────────────────────────────────────────────────────────

describe('文档解析管理 Parsing（#/admin/parsing · 单屏左树+右对照）', () => {
  beforeEach(() => {
    resetStore();
    sessionStorage.clear();
  });

  it('落地单屏：左树渲染领域/课程/书目 + 右侧空态引导，无列表/筛选/引擎选择', async () => {
    mockBase();
    renderP();
    expect(await screen.findByText('文档解析管理')).toBeInTheDocument();
    // 左树：领域 → 课程（默认展开）→ 书目
    expect(await screen.findByText(DOMAIN_TITLE)).toBeInTheDocument();
    expect(screen.getByText(COURSE_A_TITLE)).toBeInTheDocument();
    expect(screen.getByText(TITLE_A)).toBeInTheDocument();
    expect(screen.getByText(TITLE_B)).toBeInTheDocument();
    // 右侧未选中：引导空态
    expect(screen.getByText('从左侧书目树选择一本书，开始原文与解析文档对照')).toBeInTheDocument();
    // G 轮裁决：无列表态/筛选行/引擎下拉/返回按钮
    expect(screen.queryByRole('button', { name: '进入对照' })).toBeNull();
    expect(screen.queryByLabelText('书名关键词')).toBeNull();
    expect(screen.queryByLabelText('解析引擎')).toBeNull();
    expect(screen.queryByText('返回列表')).toBeNull();
    // BUGFIX-007：单一「刷新」（含同步书目），不再单列「同步书目」按钮
    expect(screen.queryByRole('button', { name: /同步书目/ })).toBeNull();
    expect(screen.getByRole('button', { name: /刷\s*新/ })).toBeInTheDocument();
  });

  it('同名多卷：display_title 为空时左树按 title + part 拼接区分卷标识', async () => {
    const volTitle = '微积分学教程';
    const mk = (id: string, part: string) => ({
      key: `book:${id}`, type: 'book', title: volTitle,
      book: bookA({ book_id: id, display_title: '', title: volTitle, part }),
    });
    const tree = [{
      ...treeFixture[0],
      children: [{ ...treeFixture[0].children![0], children: [mk('vol-1', 'Vol.1'), mk('vol-2', 'Vol.2')] }],
    }];
    mockFetch.mockImplementation((url: string) =>
      url.includes('/parsing/tree')
        ? Promise.resolve(json(tree))
        : Promise.reject(new TypeError(`no route: ${url}`)));
    renderP();
    expect(await screen.findByText('微积分学教程 Vol.1')).toBeInTheDocument();
    expect(screen.getByText('微积分学教程 Vol.2')).toBeInTheDocument();
  });

  it('点击树书目 → 右栏对照呈现原页图 + 解析块', async () => {
    mockBase();
    renderP();
    await screen.findByText(TITLE_A);
    const user = userEvent.setup();
    await user.click(screen.getByText(TITLE_A));
    expect(await screen.findByAltText('第 1 页原图')).toBeInTheDocument();
    expect(await screen.findByText('#1 · 标题')).toBeInTheDocument();
    expect(screen.getByText('#2 · 段落')).toBeInTheDocument();
    expect(screen.getByText('#3 · 公式')).toBeInTheDocument();
    expect(screen.queryByText('返回列表')).toBeNull();
    expect(useParsingStore.getState().compareBookId).toBe(BOOK_A);
  });

  it('已 ingest 未解析（页数据 404）→ 原页图占满 + 解析栏空态引导', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/parsing/tree')) return Promise.resolve(json(treeFixture));
      if (url.includes('/pages/1/edits')) return Promise.resolve(json([]));
      if (url.match(/\/pages\/1(\?|$)/)) return Promise.resolve(json({ detail: '页产物不存在' }, 404));
      if (url.includes(`/books/${BOOK_A}`)) return Promise.resolve(json(bookA()));
      if (url.includes('/books')) return Promise.resolve(json(booksFixture));
      return Promise.reject(new TypeError(`no route: GET ${url}`));
    });
    renderP();
    await screen.findByText(TITLE_A);
    const user = userEvent.setup();
    await user.click(screen.getByText(TITLE_A));
    expect(await screen.findByAltText('第 1 页原图')).toBeInTheDocument();
    // §8 态分流 2：未解析 → 解析栏整体隐藏（误导性空态不呈现）
    expect(screen.queryByText('解析结果')).toBeNull();
    expect(screen.queryByText('该页暂无解析块（可用顶栏「解析本页」）')).toBeNull();
    // 未解析不算错误
    await waitFor(() => {
      expect(useParsingStore.getState().pages[1]?.parsed).toBe(false);
    });
    expect(useParsingStore.getState().pages[1]?.error).toBeNull();
  });

  it('未入库有 file_path → iframe 直显源 PDF + 入库引导', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/parsing/tree')) return Promise.resolve(json(treeFixture));
      if (url.match(/\/pages\/1\/edits/)) return Promise.resolve(json([]));
      if (url.match(/\/pages\/1(\?|$)/)) return Promise.resolve(json({ detail: '页产物不存在' }, 404));
      if (new RegExp(`/books/${BOOK_B}(\\?|$)`).test(url)) return Promise.resolve(json(bookB()));
      if (url.includes('/books')) return Promise.resolve(json(booksFixture));
      return Promise.reject(new TypeError(`no route: GET ${url}`));
    });
    renderP();
    await screen.findByText(TITLE_B);
    const user = userEvent.setup();
    await user.click(screen.getByText(TITLE_B));
    const frame = (await screen.findByTitle('原始 PDF')) as HTMLIFrameElement;
    expect(frame.src).toContain(`/books/${BOOK_B}/file`);
    expect(screen.getByText('尚未书页入库，直显原始 PDF（入库后才能逐页对照）')).toBeInTheDocument();
  });

  it('8902 离线（/books 503）→ 黄色降级横幅 + 树仍显示领域课程', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/parsing/tree')) return Promise.resolve(json(treeFixture));
      if (url.includes('/books')) {
        return Promise.resolve(new Response(JSON.stringify({ detail: 'service unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.reject(new TypeError(`no route: GET ${url}`));
    });
    renderP();
    expect(await screen.findByText('Axiom-Flow 数据不可达')).toBeInTheDocument();
    await waitFor(() => {
      expect(useParsingStore.getState().dataError).not.toBeNull();
      expect(useParsingStore.getState().error).toBeNull();
    });
    expect(screen.getByText(DOMAIN_TITLE)).toBeInTheDocument();
  });

  it('块编辑：开编辑模式 → 点块 → 弹层 → 「不一致」PUT /edit 落库回显', async () => {
    let putUrl = '';
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PUT' && url.includes('/blocks/1/edit')) {
        putUrl = url;
        return Promise.resolve(json({
          edit_id: 'e1', book_id: BOOK_A, page_no: 1, block_index: 1,
          block_type: 'paragraph', verdict: 'bad', note: '', corrected_text: null, corrected_bbox: null,
        }));
      }
      if (url.includes('/parsing/tree')) return Promise.resolve(json(treeFixture));
      if (url.includes('/pages/1/edits')) return Promise.resolve(json([]));
      if (url.includes(`/books/${BOOK_A}/pages/1`)) return Promise.resolve(json(pageFixture));
      if (new RegExp(`/books/${BOOK_A}(\\?|$)`).test(url)) return Promise.resolve(json(bookA()));
      if (url.includes('/books')) return Promise.resolve(json(booksFixture));
      return Promise.reject(new TypeError(`no route: ${method} ${url}`));
    });
    renderP();
    await screen.findByText(TITLE_A);
    const user = userEvent.setup();
    await user.click(screen.getByText(TITLE_A));
    await screen.findByText('#2 · 段落');
    // 开编辑模式（Switch 用 aria-label 定位）
    await user.click(document.querySelector<HTMLElement>('[aria-label="编辑模式开关"]')!);
    await user.click(screen.getByRole('button', { name: '块 2（段落）' }));
    await user.click(await screen.findByRole('button', { name: /不一致/ }));
    await waitFor(() => expect(putUrl).not.toBe(''));
    expect(putUrl).toContain(`/books/${BOOK_A}/pages/1/blocks/1/edit`);
    await waitFor(() => {
      expect(useParsingStore.getState().edits[`${BOOK_A}:1:1`]?.verdict).toBe('bad');
    });
    expect((await screen.findAllByText('不一致')).length).toBeGreaterThanOrEqual(1);
  });

  it('版式模式同样可弹编辑层（回归：layout 分支曾缺 Popover）', async () => {
    let putUrl = '';
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PUT' && url.includes('/blocks/1/edit')) {
        putUrl = url;
        return Promise.resolve(json({
          edit_id: 'e1', book_id: BOOK_A, page_no: 1, block_index: 1,
          block_type: 'paragraph', verdict: 'bad', note: '', corrected_text: null, corrected_bbox: null,
        }));
      }
      if (url.includes('/parsing/tree')) return Promise.resolve(json(treeFixture));
      if (url.includes('/pages/1/edits')) return Promise.resolve(json([]));
      if (url.includes(`/books/${BOOK_A}/pages/1`)) return Promise.resolve(json(pageFixture));
      if (new RegExp(`/books/${BOOK_A}(\\?|$)`).test(url)) return Promise.resolve(json(bookA()));
      if (url.includes('/books')) return Promise.resolve(json(booksFixture));
      return Promise.reject(new TypeError(`no route: ${method} ${url}`));
    });
    renderP();
    await screen.findByText(TITLE_A);
    const user = userEvent.setup();
    await user.click(screen.getByText(TITLE_A));
    await screen.findByText('Test paragraph content.');
    await user.click(screen.getByText('版式'));
    await user.click(document.querySelector<HTMLElement>('[aria-label="编辑模式开关"]')!);
    await user.click(screen.getByRole('button', { name: '块 2（段落）' }));
    await user.click(await screen.findByRole('button', { name: /不一致/ }));
    await waitFor(() => expect(putUrl).not.toBe(''));
  });

  it('「解析本页」→ POST /parse-jobs pages:[n] + 轮询进度', async () => {
    let posted: { pages?: number[] } | null = null;
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'POST' && url.includes('/parse-jobs')) {
        posted = JSON.parse(String(init?.body));
        return Promise.resolve(json({ id: 'j1', book_id: BOOK_A, status: 'running', progress: { parsed: 0, total: 1 } }));
      }
      if (method === 'GET' && url.includes('/parse-jobs/j1')) {
        return Promise.resolve(json({ id: 'j1', book_id: BOOK_A, status: 'completed', progress: { parsed: 1, total: 1 } }));
      }
      if (url.includes('/parsing/tree')) return Promise.resolve(json(treeFixture));
      if (url.includes('/pages/1/edits')) return Promise.resolve(json([]));
      if (url.includes(`/books/${BOOK_A}/pages/1`)) return Promise.resolve(json(pageFixture));
      if (new RegExp(`/books/${BOOK_A}(\\?|$)`).test(url)) return Promise.resolve(json(bookA()));
      if (url.includes('/books')) return Promise.resolve(json(booksFixture));
      return Promise.reject(new TypeError(`no route: ${method} ${url}`));
    });
    renderP();
    await screen.findByText(TITLE_A);
    const user = userEvent.setup();
    await user.click(screen.getByText(TITLE_A));
    await screen.findByText('#2 · 段落');
    await user.click(screen.getByText('解析本页'));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted!.pages).toEqual([1]);
    await waitFor(() => {
      expect(useParsingStore.getState().activeJob?.status).toBe('completed');
    });
  });

});
