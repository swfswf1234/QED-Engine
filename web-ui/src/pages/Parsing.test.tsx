import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Parsing from './Parsing';
import Compare from './Compare';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useParsingStore } from '../stores/parsing';

const booksFixture = [
  { book_id: '01-rudin', title: '数学分析原理', author: 'Walter Rudin', page_count: 20, sha256: 'x', strategy: 'local' },
  { book_id: '02-axler', title: '线性代数应该这样学', author: 'Axler', page_count: 20, sha256: 'y', strategy: 'hybrid' },
];

function mockApi(routes: Record<string, unknown>) {
  mockFetch.mockImplementation((url: string) => {
    const hit = Object.keys(routes).find((k) => url.includes(k));
    if (!hit) return Promise.reject(new TypeError(`no route: ${url}`));
    return Promise.resolve(
      new Response(JSON.stringify(routes[hit]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });
}

describe('解析进度 Parsing（#/admin/parsing）', () => {
  beforeEach(() => {
    useParsingStore.setState({
      books: [], loading: false, error: null, dataError: null,
      compareBookId: null, comparePageNo: null, pageData: null, pageLoading: false, pageError: null, manifest: [],
    });
  });

  it('渲染书目列表 + manifest 推导解析进度 + 策略标注', async () => {
    mockApi({
      '/books/01-rudin/manifest': [
        { path: 'pages\\p0001.md', size: 1, sha256: 'a' },
        { path: 'pages\\p0002.md', size: 1, sha256: 'b' },
        { path: 'pages\\p0001.png', size: 1, sha256: 'c' },
        { path: 'book.json', size: 1, sha256: 'd' },
      ],
      '/books/02-axler/manifest': [{ path: 'pages\\p0001.md', size: 1, sha256: 'e' }],
      '/books': booksFixture,
    });
    render(
      <MemoryRouter>
        <ConfigProvider theme={theme}><Parsing /></ConfigProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('文档解析管理')).toBeInTheDocument();
    expect(await screen.findByText('数学分析原理')).toBeInTheDocument();
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

  it('8902 离线（503）→ 降级横幅 + 表格空态文案', async () => {
    mockFetch.mockImplementation((url: string) => {
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
});

describe('原始文档对照 Compare（#/admin/compare）', () => {
  beforeEach(() => {
    useParsingStore.setState({
      books: [], loading: false, error: null, dataError: null,
      compareBookId: null, comparePageNo: null, pageData: null, pageLoading: false, pageError: null, manifest: [],
    });
  });

  it('进入后自动选中第一本并加载第 1 页（原页图 + markdown 渲染）', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/books/01-rudin/manifest')) {
        return Promise.resolve(new Response(JSON.stringify([{ path: 'p0001.md', size: 100, sha256: 'x' }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/books/01-rudin/pages/1')) {
        return Promise.resolve(new Response(JSON.stringify({ page_no: 1, image_url: '/api/v1/books/01-rudin/pages/1/image', markdown: '# 第一章\n\n$$x^2+y^2=1$$', blocks: { page: 1, source: 'qwen-vl-plus', blocks: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    useParsingStore.setState({ books: booksFixture.map((b) => ({ ...b, pages_done: 0, progressUnknown: false })) });
    render(
      <MemoryRouter>
        <ConfigProvider theme={theme}><Compare /></ConfigProvider>
      </MemoryRouter>,
    );
    // 自动选中第一本（01-rudin）并加载第 1 页
    await waitFor(() => {
      expect(useParsingStore.getState().compareBookId).toBe('01-rudin');
    });
    expect(await screen.findByAltText('第 1 页原图')).toBeInTheDocument();
    expect(screen.queryByText('# 第一章')).not.toBeInTheDocument(); // markdown 渲染为标题
    expect(screen.getByRole('heading', { name: '第一章' })).toBeInTheDocument();
  });

  it('8902 离线 → 页数据降级提示', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    useParsingStore.setState({ books: booksFixture.map((b) => ({ ...b, pages_done: 0, progressUnknown: false })), compareBookId: '01-rudin', comparePageNo: 1 });
    render(
      <MemoryRouter>
        <ConfigProvider theme={theme}><Compare /></ConfigProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('页数据获取失败')).toBeInTheDocument();
  });
});