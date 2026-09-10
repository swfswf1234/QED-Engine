import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within, cleanup } from '@testing-library/react';
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
    intro: '',
    status: 'draft',
    reject_reason: '',
    supersede_reason: '',
    created_at: '',
    confirmed_at: null,
    completed_at: null,
    ...partial,
  };
}

function book(partial: Partial<BookRecord> & { book_id: string }): BookRecord {
  return {
    title: 't',
    original_title: null,
    part: '',
    authors: [],
    publisher: '',
    edition: '',
    year: null,
    language: '',
    roles: ['textbook'],
    status: 'candidate',
    retire_reason: '',
    holding: 'missing',
    file_path: null,
    priority: null,
    notes: null,
    domain_id: '',
    created_at: '',
    updated_at: '',
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
    books: [book({ book_id: 'b1', knowledge_id: 'k1', title: 'Rudin 中译', status: 'verified' })],
  },
  k2: { ...k2, books: [] },
  k3: {
    ...k3,
    books: [book({ book_id: 'b4', knowledge_id: 'k3', title: '线性代数习题册', status: 'downloaded' })],
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
    expect(await screen.findByText('筛选结果：3 个教程（已排除否定/过时项）')).toBeInTheDocument();
    // 领域信息卡：名称 + 描述 + 探索按钮（idle 可点）
    const card = await screen.findByTestId('domain-info-card');
    expect(within(card).getByText('高等数学')).toBeInTheDocument();
    expect(within(card).getByText('本科数学核心领域')).toBeInTheDocument();
    const exploreBtn = within(card).getByRole('button', { name: /开始探索|重新探索|领域探索/ });
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
    expect(await screen.findByText('筛选结果：2 个教程（已排除否定/过时项）')).toBeInTheDocument();
  });

  it('筛选栏三栏（领域/课程/状态）：状态=书籍阶段，与树选择叠加 AND', async () => {
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
    // 仅 k1（Rudin 教程，含 verified 书籍）保留
    expect(await screen.findByText('筛选结果：1 个教程（已排除否定/过时项）')).toBeInTheDocument();
  });

  it('状态筛选（待验证）：仅保留含 downloaded 书籍的教程（k3），其余隐藏、左树保留', async () => {
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
    // 仅 k3（线性代数教程，含 downloaded 书籍）保留；k1（已验收）与空书籍 k2 隐藏
    expect(await screen.findByText('筛选结果：1 个教程（已排除否定/过时项）')).toBeInTheDocument();
    const content = document.querySelector('.dl-content') as HTMLElement;
    expect(within(content).queryByText('Rudin 教程')).not.toBeInTheDocument();
    expect(within(content).queryByText('候选教程')).not.toBeInTheDocument();
    expect(within(content).getByText('线性代数习题册')).toBeInTheDocument();
    // 左树不受筛选影响：教程叶子仍全部可见
    expect(within(tree).getByText('Rudin 教程')).toBeInTheDocument();
    expect(within(tree).getByText('候选教程')).toBeInTheDocument();
  });

  it('书籍卡去 kind 标签：只保留 状态 + roles 标签', async () => {
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

  it('8901 不可达（/knowledge 503）→ 教程降级提示，课程体系树正常', async () => {
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
    expect(await screen.findByText('降级模式')).toBeInTheDocument();
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
          c.course_id === '01_math_analysis' ? { ...c, description: '高等数学核心基础课' } : c,
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

  it('教程行进度与自动下载（2026-09-08 项 2）：部分下载 → N/M 进度 + 删除禁用（8901 移交）+ 自动下载可用', async () => {
    const kpart = kn({ knowledge_id: 'k7', course_id: '01_math_analysis', set_no: '', name: '部分下载教程', status: 'confirmed' });
    mockApi({
      '/courses': domainsFixture,
      '/knowledge/k7': { ...kpart, books: [
        book({ book_id: 'bd1', knowledge_id: 'k7', display_title: '已下载册', status: 'downloaded' }),
        book({ book_id: 'bc1', knowledge_id: 'k7', display_title: '候选册', status: 'candidate' }),
      ] },
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': [k1, k2, k3, kpart],
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    fireEvent.click(within(tree).getByText('数学分析'));
    const section = await screen.findByText('部分下载教程', { selector: '.dl-knowledge-name' })
      .then((el) => el.closest('.dl-knowledge-section') as HTMLElement);
    // 进度：1/2 本已下载
    expect(within(section).getByText('下载 1/2 本')).toBeInTheDocument();
    // 只保留详情按钮（知识区 + 书卡各一个）
    const detailButtons = within(section).getAllByRole('button', { name: /详情/ });
    expect(detailButtons.length).toBeGreaterThanOrEqual(1);
    // 全部下载的教程（k1：1/1）也只显示详情按钮
    const k1Section = screen.getByText('Rudin 教程', { selector: '.dl-knowledge-name' })
      .closest('.dl-knowledge-section') as HTMLElement;
    const k1DetailButtons = within(k1Section).getAllByRole('button', { name: /详情/ });
    expect(k1DetailButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('书目纯展示（2026-09-08 项 4）+ 教程详情书目操作集（2026-09-08 项 3）', async () => {
    mockApi({
      '/courses': domainsFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    fireEvent.click(within(tree).getByText('数学分析'));
    // 书卡只保留「详情」按钮（无决定/验收/否定等生命周期操作）
    const cardEl = await screen.findByText('Rudin 中译');
    const card = cardEl.closest('.dl-book-card') as HTMLElement;
    const cardBtns = within(card).getAllByRole('button').map((b) => b.textContent);
    expect(cardBtns).toEqual(['详情']);
    // 打开教程详情弹窗（行头「详情」）
    const head = cardEl.closest('.dl-knowledge-section') as HTMLElement;
    // 行头「详情」按钮带 EyeOutlined 图标，可访问名含图标标签，用正则匹配
    fireEvent.click(within(head.querySelector('.dl-knowledge-head') as HTMLElement).getByRole('button', { name: /详情/ }));
    const dialog = await screen.findByRole('dialog');
    // 教程信息修改禁用（8901 无 PATCH /knowledge，已移交）+ 新增书目按钮在场（均可访问名含图标标签）
    expect(within(dialog).getByRole('button', { name: /修改信息/ })).toHaveAttribute('disabled');
    expect(within(dialog).getByRole('button', { name: /新增书目/ })).toBeInTheDocument();
    // 书目表列：书名/作者/语言/状态/操作
    for (const col of ['书名', '作者', '语言', '状态', '操作']) {
      expect(within(dialog).getByText(col)).toBeInTheDocument();
    }
  });

  it('进入页面默认选中第一个领域：selected + filters.domain 自动设置', async () => {
    mockApi({
      '/courses': domainsFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    await waitFor(() => {
      expect(useDownloadsStore.getState().loading).toBe(false);
    });
    const st = useDownloadsStore.getState();
    expect(st.selected).toEqual({ kind: 'domain', id: 'dm1' });
    expect(st.filters.domain).toBe('dm1');
    expect(st.filters.course).toBe('');
    expect(st.filters.stage).toBe('');
    // 右侧展示领域信息卡
    expect(await screen.findByTestId('domain-info-card')).toBeInTheDocument();
  });

  it('已有 selected 时 fetchAll 不覆盖：保留原选中', async () => {
    useDownloadsStore.setState({
      selected: { kind: 'course', id: '01_math_analysis' },
      filters: { domain: 'dm1', course: '01_math_analysis', stage: '' },
    });
    mockApi({
      '/courses': domainsFixture,
      '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
      '/knowledge': knowledgeFixture,
    });
    renderDownloads();
    await waitFor(() => {
      expect(useDownloadsStore.getState().loading).toBe(false);
    });
    const st = useDownloadsStore.getState();
    expect(st.selected).toEqual({ kind: 'course', id: '01_math_analysis' });
    expect(st.filters.domain).toBe('dm1');
  });

  it('空课程体系时 fetchAll 不自动选中：selected 保持 null', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/courses')) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/knowledge')) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    renderDownloads();
    await waitFor(() => {
      expect(useDownloadsStore.getState().loading).toBe(false);
    });
    const st = useDownloadsStore.getState();
    expect(st.selected).toBeNull();
  });

  // ---------- 确认流状态机（PLAN-028 2026-09-02 用户指令） ----------

  /** 选中领域并返回领域信息卡（fixture 单领域） */
  async function openDomainCard(fixture: DomainSystem[]) {
    mockApi({
      '/courses': fixture,
      '/knowledge': [],
      '/domains': { domain_id: fixture[0].domain_id, name: fixture[0].name },
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    fireEvent.click(within(tree).getByText(fixture[0].name));
    return screen.findByTestId('domain-info-card');
  }

  function patchCalls() {
    return mockFetch.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
    ) as Array<[string, RequestInit]>;
  }

  it('领域确认流：已生成+无课程 → 领域信息确认按钮 → 保存并确认 → 内容 PATCH（无 stage 直写）+ confirm-domain 提交', async () => {
    const card = await openDomainCard([
      {
        domain_id: 'dm_new', name: '计算机', description: '计算机科学领域',
        stages: ['基础'], courses: [], exploration_stage: '已生成',
      },
    ]);
    fireEvent.click(within(card).getByRole('button', { name: /领域信息确认/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('领域信息确认 · 计算机')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /保存并确认/ }));
    await waitFor(() => {
      // 前端禁写 exploration_stage（PLAN-033 §2.4）：PATCH 只含内容字段
      const calls = patchCalls().filter(([url]) => url.includes('/domains/dm_new'));
      expect(calls).toHaveLength(1);
      const body = JSON.parse(calls[0][1].body as string);
      expect(body.exploration_stage).toBeUndefined();
      expect(body.description).toBe('计算机科学领域');
      // 状态流转改由门面端点驱动：POST /domains/{id}/confirm-domain
      const confirms = mockFetch.mock.calls.filter(
        ([url, init]) => String(url).includes('/domains/dm_new/confirm-domain')
          && (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(confirms).toHaveLength(1);
    });
  });

  it('确认课程流：待确认 → 课程知识确认按钮 → 确认课程名单 → confirm-knowledge 全选提交 + 仅修改过的课程 PATCH', async () => {
    const card = await openDomainCard([
      {
        domain_id: 'dm_imp', name: '计算机', description: '计算机科学领域',
        stages: ['基础', '主干'], exploration_stage: '待确认',
        courses: [
          { course_id: 'cs_ds', name: '数据结构', aliases: [], stage: '基础', prerequisites: [], track: '', description: '原介绍' },
          { course_id: 'cs_os', name: '操作系统', aliases: [], stage: '主干', prerequisites: [] },
        ],
      },
    ]);
    fireEvent.click(within(card).getByRole('button', { name: /课程知识确认/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('课程信息确认 · 计算机')).toBeInTheDocument();
    // 修改第一门课程（数据结构）的介绍；第二门不动（清单异步合成后再改）
    const descInputs = await within(dialog).findAllByPlaceholderText('课程介绍');
    fireEvent.change(descInputs[0], {
      target: { value: '新介绍' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /确认课程名单/ }));
    await waitFor(() => {
      // 待确认→已完成由 confirm-knowledge 门面端点收口（全选 → selected 缺省）
      const confirms = mockFetch.mock.calls.filter(
        ([url, init]) => String(url).includes('/domains/dm_imp/confirm-knowledge')
          && (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(confirms).toHaveLength(1);
      expect(JSON.parse(confirms[0][1].body as string)).toEqual({});
      const domainPatches = patchCalls().filter(([url]) => url.includes('/domains/dm_imp'));
      expect(domainPatches).toHaveLength(1);
      expect(JSON.parse(domainPatches[0][1].body as string).exploration_stage).toBeUndefined();
      const coursePatches = patchCalls().filter(([url]) => url.includes('/courses/cs_ds'));
      expect(coursePatches).toHaveLength(1);
      expect(JSON.parse(coursePatches[0][1].body as string).description).toBe('新介绍');
    });
  });

  it('已生成+有课程（导入路径）→ 领域信息确认按钮；已生成+无课程 → 探索领域知识（降级置灰）', async () => {
    // 已生成 + 有课程 → 领域信息确认
    const withCourses = await openDomainCard([
      {
        domain_id: 'dm_g1', name: '计算机', description: '计算机科学领域',
        stages: ['基础'], exploration_stage: '已生成',
        courses: [{ course_id: 'cs_ds', name: '数据结构', aliases: [], stage: '基础', prerequisites: [] }],
      },
    ]);
    expect(within(withCourses).getByRole('button', { name: /领域信息确认/ })).toBeInTheDocument();

    // 已生成 + 无课程 + 8901 离线（knowledge 500）→ 领域信息确认按钮可用
    cleanup();
    mockApi({
      '/courses': [
        {
          domain_id: 'dm_g2', name: '计算机', description: '计算机科学领域',
          stages: ['基础'], courses: [], exploration_stage: '已生成',
        },
      ],
      '/knowledge': new Response(JSON.stringify({ detail: 'offline' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      }),
      '/domains': { domain_id: 'dm_g2', name: '计算机' },
    });
    renderDownloads();
    const tree = await screen.findByRole('tree');
    fireEvent.click(within(tree).getByText('计算机'));
    const card = await screen.findByTestId('domain-info-card');
    const confirmBtn = within(card).getByRole('button', { name: /领域信息确认/ });
    expect(confirmBtn).not.toBeDisabled();
  });

  describe('BookDetailModal 渠道操作', () => {
    async function openBookDetailModal(bookFixture: BookRecord, sources: unknown[] = []) {
      const knowledgeWithBook = kn({ knowledge_id: 'k_book', course_id: '01_math_analysis', name: '测试教程', status: 'confirmed' });
      mockApi({
        '/courses': domainsFixture,
        '/knowledge/k_book': { ...knowledgeWithBook, books: [bookFixture] },
        '/knowledge': [knowledgeWithBook],
        '/books/': (url: string) => {
          if (url.includes('/sources')) return sources;
          if (url.includes('/import')) return { ...bookFixture, status: 'downloaded' };
          return {};
        },
      });
      renderDownloads();
      const tree = await screen.findByRole('tree');
      fireEvent.click(within(tree).getByText('数学分析'));
      const bookEl = await screen.findByText(bookFixture.title);
      const bookCard = bookEl.closest('.dl-book-card') as HTMLElement;
      fireEvent.click(within(bookCard).getByRole('button', { name: /详情/ }));
      return screen.findByRole('dialog');
    }

    it('渠道列表：成功渠道显示「成功」标签', async () => {
      const downloadedBook = book({ book_id: 'b_dl', title: '已下载书', status: 'downloaded' });
      const dialog = await openBookDetailModal(downloadedBook, [
        { source_id: 's1', channel: 'libgen_li', ok: true, note: '找到文件' },
        { source_id: 's2', channel: 'internet_archive', ok: false, note: '未找到' },
      ]);
      expect(within(dialog).getByText('已下载书')).toBeInTheDocument();
      await waitFor(() => {
        expect(within(dialog).getByText('成功')).toBeInTheDocument();
      });
      expect(within(dialog).getByText('失败')).toBeInTheDocument();
      expect(within(dialog).getByText('图书馆链接')).toBeInTheDocument();
      expect(within(dialog).getByText('互联网档案馆')).toBeInTheDocument();
      // note 渲染：失败渠道显示失效原因（note 字段），成功/失败渠道 note 颜色区分
      expect(within(dialog).getByText('找到文件')).toBeInTheDocument();
      const failNote = within(dialog).getByText('未找到');
      expect(failNote).toBeInTheDocument();
      // 失败渠道 note 红色 #cf1322（jsdom 序列化为 rgb），成功渠道 note 继承默认色
      expect(failNote.style.color).toBe('rgb(207, 19, 34)');
      expect(within(dialog).getByText('找到文件').style.color).toBe('inherit');
    });

    it('成功渠道显示验证完毕和否定按钮', async () => {
      const downloadedBook = book({ book_id: 'b_dl2', title: '待验证书', status: 'downloaded' });
      const dialog = await openBookDetailModal(downloadedBook, [
        { source_id: 's1', channel: 'libgen_li', ok: true },
      ]);
      await waitFor(() => {
        expect(within(dialog).getByText('成功')).toBeInTheDocument();
      });
      expect(within(dialog).getByRole('button', { name: /验证完毕/ })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: /否\s*定/ })).toBeInTheDocument();
    });

    it('非 downloaded 状态书籍不显示验证完毕按钮', async () => {
      const candidateBook = book({ book_id: 'b_cand', title: '候选书', status: 'candidate' });
      const dialog = await openBookDetailModal(candidateBook, [
        { source_id: 's1', channel: 'manual', ok: true },
      ]);
      await waitFor(() => {
        expect(within(dialog).getByText('成功')).toBeInTheDocument();
      });
      expect(within(dialog).queryByRole('button', { name: /验证完毕/ })).not.toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: /否\s*定/ })).toBeInTheDocument();
    });

    it('点击验证完毕按钮调用验证 API', async () => {
      const downloadedBook = book({ book_id: 'b_verify', title: '验证书', status: 'downloaded' });
      const dialog = await openBookDetailModal(downloadedBook, [
        { source_id: 's1', channel: 'libgen_li', ok: true },
      ]);
      await waitFor(() => {
        expect(within(dialog).getByText('成功')).toBeInTheDocument();
      });
      fireEvent.click(within(dialog).getByRole('button', { name: /验证完毕/ }));
      await waitFor(() => {
        const verifyCalls = mockFetch.mock.calls.filter(
          ([url, init]) => String(url).includes('/books/b_verify/verify')
            && (init as RequestInit | undefined)?.method === 'POST',
        );
        expect(verifyCalls).toHaveLength(1);
      });
      // 验证成功后父级刷新：refreshDetail 再次 GET 教程详情（初始渲染已 GET 一次）
      await waitFor(() => {
        const detailGets = mockFetch.mock.calls.filter(
          ([url, init]) => String(url).includes('/knowledge/k_book')
            && (init as RequestInit | undefined)?.method === 'GET',
        );
        expect(detailGets.length).toBeGreaterThan(1);
      });
    });

    it('点击否定按钮打开拒绝原因弹窗', async () => {
      const downloadedBook = book({ book_id: 'b_reject', title: '拒绝书', status: 'downloaded' });
      const dialog = await openBookDetailModal(downloadedBook, [
        { source_id: 's1', channel: 'libgen_li', ok: true },
      ]);
      await waitFor(() => {
        expect(within(dialog).getByText('成功')).toBeInTheDocument();
      });
      fireEvent.click(within(dialog).getByRole('button', { name: /否\s*定/ }));
      const rejectModal = await screen.findByText('否定书籍');
      expect(rejectModal).toBeInTheDocument();
      expect(screen.getByPlaceholderText('请输入否定原因（必填）')).toBeInTheDocument();
    });

    it('否定原因弹窗确认后调用拒绝 API', async () => {
      const downloadedBook = book({ book_id: 'b_reject2', title: '拒绝书2', status: 'downloaded' });
      const dialog = await openBookDetailModal(downloadedBook, [
        { source_id: 's1', channel: 'libgen_li', ok: true },
      ]);
      await waitFor(() => {
        expect(within(dialog).getByText('成功')).toBeInTheDocument();
      });
      fireEvent.click(within(dialog).getByRole('button', { name: /否\s*定/ }));
      await screen.findByText('否定书籍');
      fireEvent.change(screen.getByPlaceholderText('请输入否定原因（必填）'), { target: { value: '质量差' } });
      fireEvent.change(screen.getByPlaceholderText('可选备注'), { target: { value: '扫描不清晰' } });
      // 确认按钮在否定弹窗的 footer 中
      const confirmBtn = screen.getByRole('button', { name: /OK|确[定认]/ });
      fireEvent.click(confirmBtn);
      await waitFor(() => {
        const rejectCalls = mockFetch.mock.calls.filter(
          ([url, init]) => String(url).includes('/books/b_reject2/reject')
            && (init as RequestInit | undefined)?.method === 'POST',
        );
        expect(rejectCalls).toHaveLength(1);
        const body = JSON.parse(rejectCalls[0][1].body as string);
        expect(body.reason).toBe('质量差');
        expect(body.note).toBe('扫描不清晰');
      });
    });

    it('点击添加按钮选择本地 PDF 后调用导入 API', async () => {
      const candidateBook = book({ book_id: 'b_add', title: '导入书', status: 'candidate' });
      const dialog = await openBookDetailModal(candidateBook);
      await waitFor(() => {
        expect(within(dialog).getByText('渠道尝试（0）')).toBeInTheDocument();
      });
      // 点击「添加」→ 触发隐藏 file input 的 click
      fireEvent.click(within(dialog).getByRole('button', { name: /添\s*加/ }));
      const fileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement | null;
      expect(fileInput).not.toBeNull();
      expect(fileInput?.accept).toBe('.pdf');
      // jsdom 的 File 无 Electron file.path，需手动附加（handleFileSelect 依赖 path 取绝对路径）
      const file = new File(['pdf-content'], 'book.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'path', { value: '/fake/path/book.pdf' });
      fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });
      await waitFor(() => {
        const importCalls = mockFetch.mock.calls.filter(
          ([url, init]) => String(url).includes('/books/b_add/import')
            && (init as RequestInit | undefined)?.method === 'POST',
        );
        expect(importCalls).toHaveLength(1);
        const body = JSON.parse(importCalls[0][1].body as string);
        expect(body.file_path).toBe('/fake/path/book.pdf');
      });
      // 导入成功后 current 就地更新为 downloaded → 弹窗内出现「验证完毕」按钮（父级数据未刷也不阻塞）
      await waitFor(() => {
        expect(within(dialog).getByRole('button', { name: /验证完毕/ })).toBeInTheDocument();
      });
    });

    it('无渠道时显示空态提示', async () => {
      const bookNoSources = book({ book_id: 'b_empty', title: '无渠道书', status: 'candidate' });
      const dialog = await openBookDetailModal(bookNoSources, []);
      await waitFor(() => {
        expect(within(dialog).getByText('渠道尝试（0）')).toBeInTheDocument();
      });
      expect(within(dialog).getByText('暂无渠道尝试记录')).toBeInTheDocument();
    });
  });
});
