import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import Downloads from './Downloads';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useDownloadsStore } from '../stores/downloads';
import type { BookRecord, DomainSystem, KnowledgeDetail, KnowledgeRecord } from '../stores';

const domainsFixture: DomainSystem[] = [
  {
    domain_id: 'dm1',
    name: '高等数学',
    description: '本科数学核心领域',
    stages: ['基础', '进阶'],
    courses: [
      { course_id: '01_math_analysis', name: '数学分析', aliases: [], stage: '', prerequisites: [] },
      { course_id: '02_linear_algebra', name: '线性代数', aliases: [], stage: '', prerequisites: [] },
    ],
  },
];

function kn(partial: Partial<KnowledgeRecord> & { knowledge_id: string; course_id: string }): KnowledgeRecord {
  return {
    domain_id: 'dm1',
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
  k3: {
    ...k3,
    books: [book({ book_id: 'b4', knowledge_id: 'k3', display_title: '线性代数习题册', status: 'downloaded' })],
  },
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

describe('文档下载管理 Downloads v2（真实领域课程体系，2026-08-24 REQ-059）', () => {
  beforeEach(() => {
    useDownloadsStore.setState({
      domains: [], knowledge: [], details: {}, loading: false, error: null,
      systemError: null, knowledgeError: null,
      filters: { domain: '', course: '', stage: '' }, selected: null, treeWidth: 400,
    });
  });

  it('渲染左树：领域展开、课程默认折叠、点击课程展开显示教程叶子+验收进度', async () => {
    mockApi({
      '/courses': domainsFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    expect(await screen.findByText('文档下载管理')).toBeInTheDocument();
    const tree = await screen.findByRole('tree');
    // 真实体系：领域 + 课程（无分类层）
    expect(within(tree).getByText('高等数学')).toBeInTheDocument();
    expect(within(tree).getByText('数学分析')).toBeInTheDocument();
    expect(within(tree).queryByText('分析')).not.toBeInTheDocument();
    // 课程默认折叠：教程叶子不可见
    expect(within(tree).queryByText('Rudin 教程')).not.toBeInTheDocument();
    // 点击课程展开 → 教程叶子展示 name + 验收进度
    fireEvent.click(within(tree).getByText('数学分析'));
    expect(await within(tree).findByText('Rudin 教程')).toBeInTheDocument();
    expect(within(tree).getByText('1/1 已验收')).toBeInTheDocument();
    expect(within(tree).getByText('候选教程')).toBeInTheDocument();
    // 教程叶子不改变选中（选中保持课程）
    fireEvent.click(within(tree).getByText('Rudin 教程'));
    expect(useDownloadsStore.getState().selected).toEqual({ kind: 'course', id: '01_math_analysis' });
  });

  it('领域可折叠：点击领域折叠箭头后隐藏课程，再点恢复', async () => {
    mockApi({
      '/courses': domainsFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    expect(within(tree).getByText('数学分析')).toBeInTheDocument();
    const domainCaret = tree.querySelector('.dl-tree-domain .dl-tree-caret');
    expect(domainCaret).not.toBeNull();
    fireEvent.click(domainCaret as Element);
    expect(within(tree).queryByText('数学分析')).not.toBeInTheDocument();
    fireEvent.click(domainCaret as Element);
    expect(await within(tree).findByText('数学分析')).toBeInTheDocument();
  });

  it('领域点击 → 选中 domain_id + 领域筛选 + 右侧领域信息卡（探索按钮状态机 idle 态）', async () => {
    mockApi({
      '/courses': domainsFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    fireEvent.click(within(tree).getByText('高等数学'));
    const st = useDownloadsStore.getState();
    expect(st.selected).toEqual({ kind: 'domain', id: 'dm1' });
    expect(st.filters).toEqual({ domain: 'dm1', course: '', stage: '' });
    expect(await screen.findByText('筛选结果：3 条知识行（rejected/superseded 由数据层隐藏）')).toBeInTheDocument();
    // 领域信息卡：名称 + 描述 + 探索按钮（idle 可点）
    const card = await screen.findByTestId('domain-info-card');
    expect(within(card).getByText('高等数学')).toBeInTheDocument();
    expect(within(card).getByText('本科数学核心领域')).toBeInTheDocument();
    expect(within(card).getByText('2 门课程')).toBeInTheDocument();
    const exploreBtn = within(card).getByRole('button', { name: /探索课程体系/ });
    expect(exploreBtn).not.toBeDisabled();
  });

  it('课程点击 → 展开 + 选中 + 联动筛选（domain=真实 domain_id）', async () => {
    mockApi({
      '/courses': domainsFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    fireEvent.click(within(tree).getByText('数学分析'));
    const st = useDownloadsStore.getState();
    expect(st.selected).toEqual({ kind: 'course', id: '01_math_analysis' });
    expect(st.filters).toEqual({ domain: 'dm1', course: '01_math_analysis', stage: '' });
    expect(await screen.findByText('筛选结果：2 条知识行（rejected/superseded 由数据层隐藏）')).toBeInTheDocument();
  });

  it('筛选栏三栏（领域/课程/状态）：状态=书行阶段，与树选择叠加 AND', async () => {
    mockApi({
      '/courses': domainsFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    // 三栏契约：领域/课程/状态三个下拉，流程筛选已移除（2026-08-24 用户裁决）
    expect(screen.getByRole('combobox', { name: '领域筛选' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '课程筛选' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '状态筛选' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '流程筛选' })).not.toBeInTheDocument();
    fireEvent.click(within(tree).getByText('数学分析'));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '状态筛选' }));
    fireEvent.click(await screen.findByTitle('已完成'));
    await waitFor(() => {
      expect(useDownloadsStore.getState().filters.stage).toBe('completed');
    });
    // 仅 k1（Rudin 教程，含 verified 书行）保留
    expect(await screen.findByText('筛选结果：1 条知识行（rejected/superseded 由数据层隐藏）')).toBeInTheDocument();
  });

  it('状态筛选（待验证）：仅保留含 downloaded 书行的知识行（k3），其余隐藏、左树保留', async () => {
    mockApi({
      '/courses': domainsFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    // 展开两门课程（默认折叠），使教程叶子可见后再筛选
    fireEvent.click(within(tree).getByText('数学分析'));
    fireEvent.click(within(tree).getByText('线性代数'));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '状态筛选' }));
    fireEvent.click(await screen.findByTitle('待验证'));
    await waitFor(() => {
      expect(useDownloadsStore.getState().filters.stage).toBe('await_verify');
    });
    // 仅 k3（线性代数教程，含 downloaded 书行）保留；k1（已验收）与空书行 k2 隐藏
    expect(await screen.findByText('筛选结果：1 条知识行（rejected/superseded 由数据层隐藏）')).toBeInTheDocument();
    const content = document.querySelector('.dl-content') as HTMLElement;
    expect(within(content).queryByText('Rudin 教程')).not.toBeInTheDocument();
    expect(within(content).queryByText('候选教程')).not.toBeInTheDocument();
    expect(within(content).getByText('线性代数习题册')).toBeInTheDocument();
    // 左树不受筛选影响：教程叶子仍全部可见
    expect(within(tree).getByText('Rudin 教程')).toBeInTheDocument();
    expect(within(tree).getByText('候选教程')).toBeInTheDocument();
  });

  it('书行卡去 kind 标签：只保留 状态 + roles 标签', async () => {
    mockApi({
      '/courses': domainsFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    fireEvent.click(within(tree).getByText('数学分析'));
    const card = (await screen.findByText('Rudin 中译')).closest('.dl-book-card') as HTMLElement;
    expect(card).not.toBeNull();
    expect(within(card).getAllByText('教材')).toHaveLength(1);
    expect(within(card).getByText('已验证')).toBeInTheDocument();
  });

  it('8901 不可达（/knowledge 503）→ 知识行降级提示，课程体系树正常', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/courses')) {
        return Promise.resolve(
          new Response(JSON.stringify(domainsFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }),
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
    const tree = screen.getByRole('tree');
    expect(within(tree).getByText('高等数学')).toBeInTheDocument();
    expect(within(tree).getByText('数学分析')).toBeInTheDocument();
    expect(within(tree).getByText('线性代数')).toBeInTheDocument();
    expect(screen.queryByText('文档下载管理数据获取失败')).not.toBeInTheDocument();
  });

  it('8900 不可达 → 整体错误横幅 + 树区空态（v2 文案）', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    renderDownloads();
    expect(await screen.findByText('文档下载管理数据获取失败')).toBeInTheDocument();
    expect(await screen.findByText('课程体系数据不可达（8900/8901 未启动或离线）')).toBeInTheDocument();
  });

  it('课程头：右面板置顶展示一次——课程名一行 + 课程介绍一行（2026-08-25 #3）', async () => {
    const withNote: DomainSystem[] = [
      {
        ...domainsFixture[0],
        courses: domainsFixture[0].courses.map((c) =>
          c.course_id === '01_math_analysis' ? { ...c, note: '高等数学核心基础课' } : c,
        ),
      },
    ];
    mockApi({
      '/courses': withNote,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    fireEvent.click(within(tree).getByText('数学分析'));
    // 课程介绍只在课程头出现一次（不随教程数量重复）
    const notes = await screen.findAllByText('高等数学核心基础课');
    expect(notes.length).toBe(1);
  });

  it('确认知识行 → 自动按决定引用生成两册候选书行（2026-08-25 #4 改造）', async () => {
    const kdraft = kn({
      knowledge_id: 'k9', course_id: '01_math_analysis', set_no: '', name: '待确认教程',
      status: 'draft',
      textbook_ref: { title: '数学分析教程（中文）' },
      exercise_ref: { title: '数学分析习题集（中文）' },
    });
    let booksCalls = 0;
    mockApi({
      '/courses': domainsFixture,
      '/knowledge/k9': { ...kdraft, books: [] },
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': [kdraft],
      '/confirm': { ok: true, knowledge_id: 'k9', status: 'confirmed' },
      '/books': () => {
        booksCalls += 1;
        return book({ book_id: `bnew${booksCalls}`, knowledge_id: 'k9' });
      },
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    fireEvent.click(within(tree).getByText('数学分析'));
    // 点「确认」打开弹窗（antd 两字按钮渲染为「确 认」）
    fireEvent.click(await screen.findByRole('button', { name: /确\s*认/ }));
    // 提交弹窗（书名已从决定引用预填）
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => {
      expect(booksCalls).toBe(2);
    });
  });

  it('confirmed 无书行且有决定引用 → 显示「按决定引用补建书行」兜底并可生成', async () => {
    const kconf = kn({
      knowledge_id: 'k8', course_id: '01_math_analysis', set_no: '', name: '已定稿教程',
      status: 'confirmed',
      textbook_ref: { title: '数学分析教程（中文）' },
    });
    let booksCalls = 0;
    mockApi({
      '/courses': domainsFixture,
      '/knowledge/k8': { ...kconf, books: [] },
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': [kconf],
      '/books': () => {
        booksCalls += 1;
        return book({ book_id: `bb${booksCalls}`, knowledge_id: 'k8' });
      },
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    fireEvent.click(within(tree).getByText('数学分析'));
    const btn = await screen.findByRole('button', { name: '按决定引用补建书行' });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(booksCalls).toBe(1);
    });
  });
});
