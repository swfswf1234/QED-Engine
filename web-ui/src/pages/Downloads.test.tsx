import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import Downloads from './Downloads';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useDownloadsStore } from '../stores/downloads';
import type { BookRecord, Catalog, KnowledgeDetail, KnowledgeRecord } from '../stores';

const catalogFixture: Catalog = {
  id: 'math-qe',
  name: '突破朗道位垒',
  description: '博士资格考试目录',
  status: 'frozen',
  targets: [
    { id: '01-rudin', course_id: '01_math_analysis', course_name: '数学分析', kind: 'book', title: '数学分析原理', authors: [], language: 'zh', edition: '', query: '', required: true, file_hint: '', note: '', roles: ['textbook'] },
    { id: '02-axler', course_id: '02_linear_algebra', course_name: '线性代数', kind: 'book', title: '线性代数应该这样学', authors: [], language: 'zh', edition: '', query: '', required: true, file_hint: '', note: '', roles: ['textbook'] },
  ],
};

function kn(partial: Partial<KnowledgeRecord> & { knowledge_id: string; course_id: string }): KnowledgeRecord {
  return {
    domain_id: 'math',
    kind: 'tutorial',
    set_no: '',
    name: partial.name ?? '',
    textbook_ref: null,
    exercise_ref: null,
    textbook_intro: '',
    exercise_intro: '',
    materials_intro: '',
    status: 'draft',
    reject_reason: '',
    supersede_reason: '',
    created_at: '',
    confirmed_at: null,
    completed_at: null,
    ...partial,
  };
}

function book(partial: Partial<BookRecord> & { book_id: string; knowledge_id: string }): BookRecord {
  return {
    kind: 'textbook',
    roles: ['textbook'],
    title: 't',
    part: '',
    display_title: 't',
    file_name: '',
    authors: [],
    language: '',
    version: {},
    source: null,
    original_url: '',
    sha256: null,
    relative_path: '',
    absolute_path: '',
    page_count: null,
    status: 'candidate',
    reject_reason: '',
    supersede_reason: '',
    review_note: '',
    created_at: '',
    decided_at: null,
    downloaded_at: null,
    verified_at: null,
    ...partial,
  };
}

const k1 = kn({ knowledge_id: 'k1', course_id: '01_math_analysis', set_no: '1', name: 'Rudin 教程', status: 'confirmed' });
const k2 = kn({ knowledge_id: 'k2', course_id: '01_math_analysis', name: '候选教程', status: 'draft' });
const k3 = kn({ knowledge_id: 'k3', course_id: '02_linear_algebra', name: '线性代数教程', status: 'draft' });
const knowledgeFixture: KnowledgeRecord[] = [k1, k2, k3];
const detailsFixture: Record<string, KnowledgeDetail> = {
  k1: {
    ...k1,
    books: [book({ book_id: 'b1', knowledge_id: 'k1', display_title: 'Rudin 中译', status: 'verified' })],
  },
  k2: { ...k2, books: [] },
  k3: { ...k3, books: [] },
};

/** 路由匹配：URL 包含路由 key；详情路由（更长 key）优先于列表路由；函数值按 URL 动态返回 */
function mockApi(routes: Record<string, unknown | ((url: string) => unknown)>) {
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
  mockFetch.mockImplementation((url: string) => {
    const hit = keys.find((k) => url.includes(k));
    if (!hit) return Promise.reject(new TypeError(`no route: ${url}`));
    const payload = routes[hit];
    const value = typeof payload === 'function' ? (payload as (u: string) => unknown)(url) : payload;
    return value instanceof Response
      ? Promise.resolve(value)
      : Promise.resolve(
        new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
  });
}

function renderDownloads() {
  return render(
    <MemoryRouter>
      <ConfigProvider theme={theme}>
        <AntApp>
          <Downloads />
        </AntApp>
      </ConfigProvider>
    </MemoryRouter>,
  );
}

describe('下载管理 Downloads（Phase 4a + 五层化 + 2026-08-18 ARCH-015 重构）', () => {
  beforeEach(() => {
    useDownloadsStore.setState({
      catalogTargets: [], knowledge: [], details: {}, loading: false, error: null,
      catalogError: null, knowledgeError: null,
      filters: { domain: '', course: '', status: '', flow: '' }, selected: null, treeWidth: 400,
    });
  });

  it('渲染左树：领域(高等数学)常驻展开、分类头仅展示、课程默认折叠、教程叶子只展示+进度', async () => {
    mockApi({
      '/catalogs/math-qe': catalogFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    expect(await screen.findByText('文档下载管理')).toBeInTheDocument();
    const tree = await screen.findByRole('tree');
    // 领域唯一「高等数学」+ 分类头（分析/代数，仅展示不可点）
    expect(within(tree).getByText('高等数学')).toBeInTheDocument();
    expect(within(tree).getByText('分析')).toBeInTheDocument();
    expect(within(tree).getByText('代数')).toBeInTheDocument();
    // 课程可见（分类下常驻展示），默认折叠：教程叶子不可见
    expect(within(tree).getByText('数学分析')).toBeInTheDocument();
    expect(within(tree).queryByText('Rudin 教程')).not.toBeInTheDocument();
    // 课程点击展开 → 教程叶子展示 name + 验收进度
    fireEvent.click(within(tree).getByText('数学分析'));
    expect(await within(tree).findByText('Rudin 教程')).toBeInTheDocument();
    expect(within(tree).getByText('1/1 已验收')).toBeInTheDocument();
    expect(within(tree).getByText('候选教程')).toBeInTheDocument();
    // 教程叶子不可点击、不可展开：点教程不改变选中、无书行明细
    fireEvent.click(within(tree).getByText('Rudin 教程'));
    expect(useDownloadsStore.getState().selected).toEqual({ kind: 'course', id: '01_math_analysis' });
    expect(within(tree).queryByText('《Rudin 中译》')).not.toBeInTheDocument();
    // 分类头不可点击：选中保持课程不变
    fireEvent.click(within(tree).getByText('分析'));
    expect(useDownloadsStore.getState().selected).toEqual({ kind: 'course', id: '01_math_analysis' });
  });

  it('领域可折叠：点击领域折叠箭头后隐藏分类/课程', async () => {
    mockApi({
      '/catalogs/math-qe': catalogFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    expect(within(tree).getByText('分析')).toBeInTheDocument();
    const domainCaret = tree.querySelector('.dl-tree-domain .dl-tree-caret');
    expect(domainCaret).not.toBeNull();
    fireEvent.click(domainCaret as Element);
    expect(within(tree).queryByText('分析')).not.toBeInTheDocument();
    expect(within(tree).queryByText('数学分析')).not.toBeInTheDocument();
    // 再点击展开恢复
    fireEvent.click(domainCaret as Element);
    expect(await within(tree).findByText('分析')).toBeInTheDocument();
  });

  it('领域点击 → 选中「高等数学」+ 清课程筛选（显示全部）', async () => {
    mockApi({
      '/catalogs/math-qe': catalogFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    fireEvent.click(within(tree).getByText('高等数学'));
    const st = useDownloadsStore.getState();
    expect(st.selected).toEqual({ kind: 'domain', id: '高等数学' });
    expect(st.filters).toEqual({ domain: '高等数学', course: '', status: '', flow: '' });
    expect(await screen.findByText('筛选结果：3 条知识行（rejected/superseded 由数据层隐藏）')).toBeInTheDocument();
  });

  it('课程点击 → 展开 + 选中 + 联动课程筛选（领域=分类名）', async () => {
    mockApi({
      '/catalogs/math-qe': catalogFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    fireEvent.click(within(tree).getByText('数学分析'));
    const st = useDownloadsStore.getState();
    expect(st.selected).toEqual({ kind: 'course', id: '01_math_analysis' });
    expect(st.filters).toEqual({ domain: '分析', course: '01_math_analysis', status: '', flow: '' });
    expect(await screen.findByText('筛选结果：2 条知识行（rejected/superseded 由数据层隐藏）')).toBeInTheDocument();
  });

  it('筛选栏：状态筛选与树选择独立叠加 AND', async () => {
    mockApi({
      '/catalogs/math-qe': catalogFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    // 树选课程（筛选 course=01_math_analysis）
    fireEvent.click(within(tree).getByText('数学分析'));
    // 手动改状态筛选 → confirmed
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '状态筛选' }));
    fireEvent.click(await screen.findByTitle('已定稿'));
    await waitFor(() => {
      expect(useDownloadsStore.getState().filters.status).toBe('confirmed');
    });
    expect(await screen.findByText('筛选结果：1 条知识行（rejected/superseded 由数据层隐藏）')).toBeInTheDocument();
  });

  it('流程筛选（验收）：仅保留含匹配书行的知识行，无匹配行隐藏', async () => {
    mockApi({
      '/catalogs/math-qe': catalogFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    fireEvent.click(within(tree).getByText('数学分析'));
    // 流程下拉 → 验收（k1 有 verified 书行；k2 无书行 → 整行隐藏）
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '流程筛选' }));
    fireEvent.click(await screen.findByTitle('验收'));
    await waitFor(() => {
      expect(useDownloadsStore.getState().filters.flow).toBe('verify');
    });
    expect(await screen.findByText('筛选结果：1 条知识行（rejected/superseded 由数据层隐藏）')).toBeInTheDocument();
    // 右栏知识行区：k2（无书行）整行隐藏；树中教程叶子仍展示（流程筛选仅作用于右栏）
    const content = document.querySelector('.dl-content') as HTMLElement;
    expect(within(content).queryByText('候选教程')).not.toBeInTheDocument();
    expect(within(screen.getByRole('tree')).getByText('候选教程')).toBeInTheDocument();
    // 右侧书行卡仍在（Rudin 中译 已验证）
    expect(await screen.findByText('Rudin 中译')).toBeInTheDocument();
  });

  it('书行卡去 kind 标签：只保留 状态 + roles 标签', async () => {
    mockApi({
      '/catalogs/math-qe': catalogFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    fireEvent.click(within(tree).getByText('数学分析'));
    const card = (await screen.findByText('Rudin 中译')).closest('.dl-book-card') as HTMLElement;
    expect(card).not.toBeNull();
    // roles=textbook → 「教材」标签仅出现一次（kind 标签已移除）
    expect(within(card).getAllByText('教材')).toHaveLength(1);
    expect(within(card).getByText('已验证')).toBeInTheDocument();
  });

  it('8901 不可达（/knowledge 503）→ 知识行降级提示，树目录正常', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/catalogs/math-qe')) {
        return Promise.resolve(
          new Response(JSON.stringify(catalogFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/knowledge')) {
        return Promise.resolve(
          new Response(JSON.stringify({ detail: 'QED-Tracker 服务不可达' }), { status: 503, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    renderDownloads();
    expect(await screen.findByText('知识行数据不可达')).toBeInTheDocument();
    // 树仍可用（catalog 正常）：领域+分类+课程
    const tree = screen.getByRole('tree');
    expect(within(tree).getByText('高等数学')).toBeInTheDocument();
    expect(within(tree).getByText('分析')).toBeInTheDocument();
    expect(within(tree).getByText('代数')).toBeInTheDocument();
    // 无整体错误横幅
    expect(screen.queryByText('下载管理数据获取失败')).not.toBeInTheDocument();
  });

  it('8900 不可达 → 整体错误横幅 + 树区空态', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    renderDownloads();
    expect(await screen.findByText('下载管理数据获取失败')).toBeInTheDocument();
    expect(await screen.findByText('课程目录数据不可达（8900 离线或服务未启动）')).toBeInTheDocument();
  });
});
