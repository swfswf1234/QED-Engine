import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Parsing from './Parsing';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useParsingStore } from '../stores/parsing';

const booksFixture = [
  { book_id: '01-rudin', title: '数学分析原理', author: 'Walter Rudin', page_count: 20, sha256: 'x', strategy: 'local' },
  { book_id: '02-axler', title: '线性代数应该这样学', author: 'Axler', page_count: 20, sha256: 'y', strategy: 'hybrid' },
];

/** 路由式 mock：按 method+keyword 匹配 */
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

const pageFixture = {
  page_no: 1,
  image_url: '/api/v1/books/01-rudin/pages/1/image',
  markdown: '# 第一章\n\n$$x^2+y^2=1$$',
  blocks: {
    page: 1,
    source: 'qwen-vl-plus',
    blocks: [
      { type: 'heading', bbox: [0, 0, 0, 0], level: 1, text: '第一章' },
      { type: 'paragraph', bbox: [0, 0, 0, 0], text: '设 $a$ 为正数。' },
      { type: 'formula', bbox: [0, 0, 0, 0], latex: 'x^2+y^2=1' },
    ],
  },
};

describe('文档解析管理 Parsing（#/admin/parsing，原解析进度改名）', () => {
  beforeEach(() => {
    useParsingStore.setState({
      books: [], loading: false, error: null, dataError: null,
      syncing: false, syncMessage: null, syncError: null, lastSyncedAt: null,
      compareBookId: null, comparePageNo: null, pageData: null, pageLoading: false, pageError: null, manifest: [],
      blockReviews: {}, reviewSubmitting: false,
    });
  });

  it('进入自动同步 → 渲染书目树 + manifest 推导进度 + 策略标注', async () => {
    mockApi([
      { method: 'POST', match: '/books/sync', body: { synced: 2, updated: 0 } },
      { match: '/books/01-rudin/manifest', body: [
        { path: 'pages\\p0001.md', size: 1, sha256: 'a' },
        { path: 'pages\\p0002.md', size: 1, sha256: 'b' },
        { path: 'pages\\p0001.png', size: 1, sha256: 'c' },
        { path: 'book.json', size: 1, sha256: 'd' },
      ] },
      { match: '/books/02-axler/manifest', body: [{ path: 'pages\\p0001.md', size: 1, sha256: 'e' }] },
      { match: '/books/01-rudin/pages/1', body: pageFixture },
      { match: '/books/02-axler/pages/1', body: pageFixture },
      { match: '/books', body: booksFixture },
    ]);
    render(
      <MemoryRouter>
        <ConfigProvider theme={theme}><Parsing /></ConfigProvider>
      </MemoryRouter>,
    );
    // 同步请求已发出并展示成功提示
    expect(await screen.findByText('已同步 2 本新书目（更新 0）')).toBeInTheDocument();
    // 左树：未分课程兜底（af_books 课程字段未就绪）；树节点 + 对照卡标题各一处
    const titles = await screen.findAllByText('数学分析原理');
    expect(titles.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('线性代数应该这样学')).toBeInTheDocument();
    // manifest 推导：01-rudin 2 个 md（20 页中 2 已解析）；02-axler 1 个 md
    await waitFor(() => {
      expect(useParsingStore.getState().books[0].pages_done).toBe(2);
    });
    expect(await screen.findByText('2/20 页')).toBeInTheDocument();
    expect(screen.getByText('1/20 页')).toBeInTheDocument();
    expect(screen.getByText('本地引擎')).toBeInTheDocument();
    expect(screen.getByText('混合兜底')).toBeInTheDocument();
  });

  it('af_books 课程字段就绪 → 领域/课程分组树', async () => {
    const withCourse = [
      { ...booksFixture[0], domain_id: 'math', course_id: 'analysis', course_name: '数学分析' },
      { ...booksFixture[1], domain_id: 'math', course_id: 'algebra', course_name: '高等代数' },
    ];
    mockApi([
      { method: 'POST', match: '/books/sync', body: { synced: 2, updated: 0 } },
      { match: '/books/01-rudin/pages/1', body: pageFixture },
      { match: '/books/02-axler/pages/1', body: pageFixture },
      { match: '/books', body: withCourse },
    ]);
    render(
      <MemoryRouter>
        <ConfigProvider theme={theme}><Parsing /></ConfigProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('数学分析')).toBeInTheDocument();
    expect(screen.getByText('高等代数')).toBeInTheDocument();
    expect(useParsingStore.getState().books[0].pages_done).toBe(0); // 无 manifest 路由 → progressUnknown 兜底
  });

  it('8902 离线（503）→ 降级横幅 + 书目空态', async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && url.includes('/books/sync')) {
        return Promise.resolve(new Response(JSON.stringify({ synced: 0, updated: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/books')) {
        return Promise.resolve(new Response(JSON.stringify({ detail: 'Axiom-Flow 服务不可达：8902 连接失败' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    render(
      <MemoryRouter>
        <ConfigProvider theme={theme}><Parsing /></ConfigProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Axiom-Flow 数据不可达')).toBeInTheDocument();
    expect(screen.getByText('8902 离线，暂无书目数据')).toBeInTheDocument();
  });

  it('对照：自动选中第一本加载第 1 页（原页图 + 块级渲染）', async () => {
    mockApi([
      { method: 'POST', match: '/books/sync', body: { synced: 0, updated: 0 } },
      { match: '/books/01-rudin/manifest', body: [{ path: 'p0001.md', size: 1, sha256: 'x' }] },
      { match: '/books/01-rudin/pages/1', body: pageFixture },
      { match: '/books/02-axler/pages/1', body: pageFixture },
      { match: '/books', body: booksFixture },
    ]);
    useParsingStore.setState({ books: booksFixture.map((b) => ({ ...b, pages_done: 0, progressUnknown: false })) });
    render(
      <MemoryRouter>
        <ConfigProvider theme={theme}><Parsing /></ConfigProvider>
      </MemoryRouter>,
    );
    // 自动选中第一本（01-rudin）并加载第 1 页
    await waitFor(() => {
      expect(useParsingStore.getState().compareBookId).toBe('01-rudin');
    });
    expect(await screen.findByAltText('第 1 页原图')).toBeInTheDocument();
    // 块级渲染：标题/段落/公式
    expect(await screen.findByText('#1 · 标题')).toBeInTheDocument();
    expect(screen.getByText('#2 · 段落')).toBeInTheDocument();
    expect(screen.getByText('#3 · 公式')).toBeInTheDocument();
  });

  it('块判定：点击块 → 弹层 → 点「不一致」→ PUT review 落库并回显', async () => {
    let putCalled = false;
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'POST' && url.includes('/books/sync')) {
        return Promise.resolve(new Response(JSON.stringify({ synced: 0, updated: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (method === 'PUT' && url.includes('/blocks/1/review')) {
        putCalled = true;
        return Promise.resolve(new Response(JSON.stringify({ review_id: 'r1', book_id: '01-rudin', page_no: 1, block_index: 1, block_type: 'paragraph', verdict: 'bad', note: '' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/books/01-rudin/manifest')) {
        return Promise.resolve(new Response(JSON.stringify([{ path: 'p0001.md', size: 1, sha256: 'x' }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/books/01-rudin/pages/1')) {
        return Promise.resolve(new Response(JSON.stringify(pageFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/books/02-axler/pages/1')) {
        return Promise.resolve(new Response(JSON.stringify(pageFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/books')) {
        return Promise.resolve(new Response(JSON.stringify(booksFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.reject(new TypeError(`no route: ${method} ${url}`));
    });
    useParsingStore.setState({ books: booksFixture.map((b) => ({ ...b, pages_done: 0, progressUnknown: false })) });
    render(
      <MemoryRouter>
        <ConfigProvider theme={theme}><Parsing /></ConfigProvider>
      </MemoryRouter>,
    );
    await screen.findByText('#2 · 段落');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '块 2（段落）' }));
    await user.click(await screen.findByRole('button', { name: /不一致/ }));
    await waitFor(() => {
      expect(putCalled).toBe(true);
    });
    // 判定回显：块上 Tag「不一致」（弹层已收起）
    expect((await screen.findAllByText('不一致')).length).toBeGreaterThanOrEqual(1);
    expect(useParsingStore.getState().blockReviews['01-rudin:1:1']?.verdict).toBe('bad');
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
});