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
const COURSE_B_ID = 'test-course-b';
const COURSE_B_TITLE = '测试课程B';

/** 无课程归属的树（全部归入一个兜底域） */
const treeUngroupedFixture = [
  {
    key: `domain:ungrouped`,
    type: 'domain',
    title: '未分课程',
    domainId: 'ungrouped',
    children: [
      {
        key: 'course:ungrouped:',
        type: 'course',
        title: '',
        courseId: '',
        domainId: 'ungrouped',
        children: [
          {
            key: `book:${BOOK_A}`,
            type: 'book',
            title: TITLE_A,
            book: { book_id: BOOK_A, title: TITLE_A, author: 'Author Alpha', page_count: 20, sha256: 'sha-a', strategy: 'local' },
          },
          {
            key: `book:${BOOK_B}`,
            type: 'book',
            title: TITLE_B,
            book: { book_id: BOOK_B, title: TITLE_B, author: 'Author Beta', page_count: 15, sha256: 'sha-b', strategy: 'hybrid' },
          },
        ],
      },
    ],
  },
];

/** 有课程归属的树（领域→课程→书目） */
const treeGroupedFixture = [
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
          {
            key: `book:${BOOK_A}`,
            type: 'book',
            title: TITLE_A,
            book: { book_id: BOOK_A, title: TITLE_A, author: 'Author Alpha', page_count: 20, sha256: 'sha-a', strategy: 'local', domain_id: DOMAIN_ID, course_id: COURSE_A_ID, course_name: COURSE_A_TITLE },
          },
        ],
      },
      {
        key: `course:${DOMAIN_ID}:${COURSE_B_ID}`,
        type: 'course',
        title: COURSE_B_TITLE,
        courseId: COURSE_B_ID,
        domainId: DOMAIN_ID,
        children: [
          {
            key: `book:${BOOK_B}`,
            type: 'book',
            title: TITLE_B,
            book: { book_id: BOOK_B, title: TITLE_B, author: 'Author Beta', page_count: 15, sha256: 'sha-b', strategy: 'hybrid', domain_id: DOMAIN_ID, course_id: COURSE_B_ID, course_name: COURSE_B_TITLE },
          },
        ],
      },
    ],
  },
];

/** 8902 离线降级树（领域→课程存在，书目为空） */
const treeDegradedFixture = [
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
        children: [],
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
      { type: 'heading', bbox: [0, 0, 0, 0], level: 1, text: 'Test Heading' },
      { type: 'paragraph', bbox: [0, 0, 0, 0], text: 'Test paragraph content.' },
      { type: 'formula', bbox: [0, 0, 0, 0], latex: 'x^2+y^2=1' },
    ],
  },
};

// ── 工具函数 ─────────────────────────────────────────────────────────

function mockApi(routes: Array<{ method?: string; match: string; body: unknown }>) {
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const hit = routes.find((r) => (r.method ?? 'GET') === method && url.includes(r.match));
    if (!hit) return Promise.reject(new TypeError(`no route: ${method} ${url}`));
    return Promise.resolve(
      new Response(JSON.stringify(hit.body), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });
}

/** 等待 store 中 tree 加载完成（不依赖 DOM 渲染） */
async function waitForTreeLoaded() {
  await waitFor(() => {
    expect(useParsingStore.getState().tree.length).toBeGreaterThan(0);
  });
}

// ── 测试 ─────────────────────────────────────────────────────────────

describe('文档解析管理 Parsing（#/admin/parsing）', () => {
  beforeEach(() => {
    useParsingStore.setState({
      tree: [], treeLoading: false, treeError: null,
      books: [], loading: false, error: null, dataError: null,
      syncing: false, syncMessage: null, syncError: null, lastSyncedAt: null,
      compareBookId: null, comparePageNo: null, pageData: null, pageLoading: false, pageError: null, manifest: [],
      blockReviews: {}, reviewSubmitting: false,
    });
  });

  it('进入加载树 → store 有树 + 书目 + 左树领域名渲染', async () => {
    mockApi([
      { match: '/parsing/tree', body: treeUngroupedFixture },
      { match: `/books/${BOOK_A}/pages/1`, body: pageFixture },
      { match: `/books/${BOOK_B}/pages/1`, body: pageFixture },
    ]);
    render(
      <MemoryRouter>
        <ConfigProvider theme={theme}><Parsing /></ConfigProvider>
      </MemoryRouter>,
    );
    await waitForTreeLoaded();
    // store 验证：树和书目均正确加载
    const state = useParsingStore.getState();
    expect(state.tree).toHaveLength(1);
    expect(state.books).toHaveLength(2);
    expect(state.books[0].book_id).toBe(BOOK_A);
    expect(state.books[1].book_id).toBe(BOOK_B);
    // DOM 验证：左树领域名渲染
    expect(screen.getByText('未分课程')).toBeInTheDocument();
  });

  it('课程字段就绪 → store 中树结构为领域→课程→书目', async () => {
    mockApi([
      { match: '/parsing/tree', body: treeGroupedFixture },
      { match: `/books/${BOOK_A}/pages/1`, body: pageFixture },
      { match: `/books/${BOOK_B}/pages/1`, body: pageFixture },
    ]);
    render(
      <MemoryRouter>
        <ConfigProvider theme={theme}><Parsing /></ConfigProvider>
      </MemoryRouter>,
    );
    await waitForTreeLoaded();
    // store 验证：树结构为 1 个领域 → 2 个课程 → 各 1 本书
    const state = useParsingStore.getState();
    expect(state.tree).toHaveLength(1);
    expect(state.tree[0].children).toHaveLength(2);
    expect(state.tree[0].children![0].children).toHaveLength(1);
    expect(state.tree[0].children![1].children).toHaveLength(1);
    expect(state.tree[0].children![0].children![0].book?.book_id).toBe(BOOK_A);
    expect(state.tree[0].children![1].children![0].book?.book_id).toBe(BOOK_B);
    // DOM 验证：领域名和课程名渲染
    expect(screen.getByText(DOMAIN_TITLE)).toBeInTheDocument();
    expect(screen.getByText(COURSE_A_TITLE)).toBeInTheDocument();
    expect(screen.getByText(COURSE_B_TITLE)).toBeInTheDocument();
  });

  it('8902 离线 → /parsing/tree 优雅降级：领域课程存在 + 书目为空', async () => {
    // 后端 /parsing/tree 在 8902 离线时仍返回 200（领域→课程+空书目），不触发 dataError
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/parsing/tree')) {
        return Promise.resolve(new Response(JSON.stringify(treeDegradedFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ detail: 'service unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
    });
    render(
      <MemoryRouter>
        <ConfigProvider theme={theme}><Parsing /></ConfigProvider>
      </MemoryRouter>,
    );
    await waitForTreeLoaded();
    // store 验证：领域→课程结构存在，书目为空
    const state = useParsingStore.getState();
    expect(state.tree).toHaveLength(1);
    expect(state.tree[0].children).toHaveLength(1);
    expect(state.tree[0].children![0].children).toHaveLength(0);
    expect(state.books).toHaveLength(0);
    // DOM 验证：领域名和课程名渲染（树因 tree 非空而渲染）
    expect(screen.getByText(DOMAIN_TITLE)).toBeInTheDocument();
    expect(screen.getByText(COURSE_A_TITLE)).toBeInTheDocument();
    // 无整体错误（/parsing/tree 返回 200，error 和 dataError 均为 null）
    expect(state.error).toBeNull();
    expect(state.dataError).toBeNull();
  });

  it('对照：自动选中第一本 + 加载第 1 页（原页图 + 块级渲染）', async () => {
    mockApi([
      { match: '/parsing/tree', body: treeUngroupedFixture },
      { match: `/books/${BOOK_A}/pages/1`, body: pageFixture },
      { match: `/books/${BOOK_B}/pages/1`, body: pageFixture },
    ]);
    render(
      <MemoryRouter>
        <ConfigProvider theme={theme}><Parsing /></ConfigProvider>
      </MemoryRouter>,
    );
    // 自动选中第一本书
    await waitFor(() => {
      expect(useParsingStore.getState().compareBookId).toBe(BOOK_A);
    });
    // 右侧对照：原页图 + 3 个块（BlockView 渲染，非 Ant Tree）
    expect(await screen.findByAltText('第 1 页原图')).toBeInTheDocument();
    expect(await screen.findByText('#1 · 标题')).toBeInTheDocument();
    expect(screen.getByText('#2 · 段落')).toBeInTheDocument();
    expect(screen.getByText('#3 · 公式')).toBeInTheDocument();
  });

  it('块判定：点击块 → 弹层 → 点「不一致」→ PUT review 落库', async () => {
    let putCalled = false;
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PUT' && url.includes('/blocks/1/review')) {
        putCalled = true;
        return Promise.resolve(new Response(JSON.stringify({ review_id: 'r1', book_id: BOOK_A, page_no: 1, block_index: 1, block_type: 'paragraph', verdict: 'bad', note: '' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/parsing/tree')) {
        return Promise.resolve(new Response(JSON.stringify(treeUngroupedFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes(`/books/${BOOK_A}/pages/1`)) {
        return Promise.resolve(new Response(JSON.stringify(pageFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes(`/books/${BOOK_B}/pages/1`)) {
        return Promise.resolve(new Response(JSON.stringify(pageFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.reject(new TypeError(`no route: ${method} ${url}`));
    });
    render(
      <MemoryRouter>
        <ConfigProvider theme={theme}><Parsing /></ConfigProvider>
      </MemoryRouter>,
    );
    // 等待块渲染（BlockView，非 Ant Tree）
    await screen.findByText('#2 · 段落');
    const user = userEvent.setup();
    // 点击第 2 块（段落）→ 打开 Popover
    await user.click(screen.getByRole('button', { name: '块 2（段落）' }));
    // 点击「不一致」按钮
    await user.click(await screen.findByRole('button', { name: /不一致/ }));
    // PUT 已调用
    await waitFor(() => {
      expect(putCalled).toBe(true);
    });
    // store 中判定已回显
    expect(useParsingStore.getState().blockReviews[`${BOOK_A}:1:1`]?.verdict).toBe('bad');
    // DOM 中块上 Tag 回显
    expect((await screen.findAllByText('不一致')).length).toBeGreaterThanOrEqual(1);
  });

  it('8900 不可达（offline）→ 整体错误横幅', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    render(
      <MemoryRouter>
        <ConfigProvider theme={theme}><Parsing /></ConfigProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('解析数据获取失败')).toBeInTheDocument();
  });

  it('默认展开：第一个领域 + 其下所有课程 + 书目可见', async () => {
    mockApi([
      { match: '/parsing/tree', body: treeGroupedFixture },
      { match: `/books/${BOOK_A}/pages/1`, body: pageFixture },
      { match: `/books/${BOOK_B}/pages/1`, body: pageFixture },
    ]);
    render(
      <MemoryRouter>
        <ConfigProvider theme={theme}><Parsing /></ConfigProvider>
      </MemoryRouter>,
    );
    await waitForTreeLoaded();
    // DOM 验证：第一个领域展开（展开态 class）
    const domainNode = document.querySelector('.dl-tree-domain');
    expect(domainNode).not.toBeNull();
    expect(domainNode!.classList.contains('expanded')).toBe(true);
    // DOM 验证：课程名可见（说明课程也展开了）
    expect(screen.getByText(COURSE_A_TITLE)).toBeInTheDocument();
    expect(screen.getByText(COURSE_B_TITLE)).toBeInTheDocument();
    // DOM 验证：书名可见（说明课程树也展开了；书名同时出现在左树和右侧对照标题，用 getAllByText）
    expect(screen.getAllByText(TITLE_A).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(TITLE_B).length).toBeGreaterThanOrEqual(1);
  });
});
