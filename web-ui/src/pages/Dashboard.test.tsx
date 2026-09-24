/**
 * 仪表盘页面测试（2026-09-24 REQ-033 三块制·用户五改形态）
 * - 块一＝一张卡上下两段：「服务详情」徽章段（extra 用户原文逐字保留）+
 *   「本地模型列表」分节（左右两栏文字先、模型名非空即显示、三态徽章）
 * - 块二 文档下载情况（**无 extra**，五改）：四统计数字 + 领域按钮（>5 折叠「更多 ▾」）
 *   + 大卡课程行＝名称｜状态四词｜教程数（如有）｜一书一格 + 末尾颜色图例；
 *   旧四桶计数文本/「领域书籍」汇总/extra 全部断言不出现
 * - 块三 文档解析情况（**无 extra 无描述**）：KPI 顺序＝课程数/书目数/解析中/已完成；
 *   af_books 字段判定、分组分页与降级逻辑与四改一致
 * - 三块卡标题 Title level 4（渲染为 h4.ant-typography，参照控制台「服务管理」）
 * - 降级矩阵：8901（块二）/8900（整体横幅）；刷新按钮；30s 轮询 fetchSlots+fetchParse
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Dashboard from './Dashboard';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useDashboardStore } from '../stores/dashboard';
import { useRuntimeStore } from '../stores/runtime';
import type { BookRecord, DomainSystem, KnowledgeDetail, KnowledgeRecord, ServiceStatus } from '../stores';
import type { BookMeta, ParseJob } from '../api/axiom';
import type { SlotStatus } from '../stores';

function kn(partial: Partial<KnowledgeRecord> & { knowledge_id: string; course_id: string }): KnowledgeRecord {
  return {
    domain_id: 'math',
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
    domain_id: 'math',
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

const k1 = kn({ knowledge_id: 'k1', course_id: 'math', status: 'draft' });
const k2 = kn({ knowledge_id: 'k2', course_id: 'math', status: 'confirmed' });
const k3 = kn({ knowledge_id: 'k3', course_id: 'analysis', status: 'confirmed' });
const knowledgeFixture: KnowledgeRecord[] = [k1, k2, k3];
const detailsFixture: Record<string, KnowledgeDetail> = {
  k1: { ...k1, books: [book({ book_id: 'b1', knowledge_id: 'k1', status: 'parallel', holding: 'owned' })] },
  k2: { ...k2, books: [book({ book_id: 'b2', knowledge_id: 'k2', status: 'decided', holding: 'missing' })] },
  k3: { ...k3, books: [] },
};

// 领域课程体系：math 和 analysis 两个领域
const courseSystemFixture: DomainSystem[] = [
  {
    domain_id: 'math',
    name: '数学',
    exploration_stage: '已完成',
    courses: [
      { course_id: 'math', name: '数学分析', aliases: [], stage: '', prerequisites: [], exploration_stage: '已完成' },
      { course_id: 'math-adv', name: '高等数学', aliases: [], stage: '', prerequisites: [], exploration_stage: '未开始' },
    ],
  },
  {
    domain_id: 'analysis',
    name: '分析学',
    exploration_stage: '探索中',
    courses: [
      { course_id: 'analysis', name: '实分析', aliases: [], stage: '', prerequisites: [], exploration_stage: '已完成' },
    ],
  },
];

// 块三数据源：af_books 书目字段判定（真机缺陷场景建模：页齐未激活≠已完成、分母=全书页数）
function afBook(partial: Partial<BookMeta> & { book_id: string }): BookMeta {
  return {
    title: '书目', page_count: null, sha256: '', strategy: 'local',
    ingest_status: 'ingested', parse_status: 'pending', pages_done: 0,
    last_parse_result: '', active_job_id: null,
    ...partial,
  } as BookMeta;
}

const afBooksFixture: BookMeta[] = [
  afBook({ book_id: 'bk-pde', title: '偏微分方程', course_id: 'pde', course_name: '偏微分方程', parse_status: 'parsing', page_count: 317, pages_done: 120 }),
  afBook({ book_id: 'bk-mth', title: '数学分析原理', course_id: 'mth', course_name: '数学分析', active_job_id: 'j-mth', last_parse_result: 'completed', page_count: 300, pages_done: 300 }),
  afBook({ book_id: 'bk-lin', title: '线性代数及其应用', course_id: 'lin', course_name: '线性代数及其应用', page_count: 457, pages_done: 1 }),
  afBook({ book_id: 'bk-topo', title: '拓扑学', course_id: 'topo', course_name: '拓扑学', last_parse_result: 'interrupted', page_count: 200, pages_done: 180 }),
  afBook({ book_id: 'bk-fun', title: '实变函数论', course_id: 'fun', course_name: '实变函数论', ingest_status: 'none' }),
];
const parseJobsFixture = {
  jobs: [
    { id: 'j1', book_id: 'bk-pde', status: 'running', progress: { parsed: 120, total: 317, failed: 2 }, created_at: '2026-09-23T00:00:00' },
  ] as ParseJob[],
  total: 1, limit: 50, offset: 0,
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

function fullMockApi() {
  mockApi({
    '/courses': courseSystemFixture,
    '/knowledge/': (url: string) => detailsFixture[url.split('/').pop() ?? ''],
    '/knowledge': knowledgeFixture,
    '/parse-jobs': parseJobsFixture,
    '/books': afBooksFixture,
  });
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <ConfigProvider theme={theme}>
        <Dashboard />
      </ConfigProvider>
    </MemoryRouter>,
  );
}

/** runtime store 预置服务快照（仪表盘只读消费共享数据，不发请求） */
const runtimeServices: ServiceStatus[] = [
  { name: 'config', label: 'QED 管理服务（配置中心）', port: 8900, log_path: '', status: 'online', pid: null, started_at: null, reason: '' },
  { name: 'tracker', label: 'QED-Tracker 文档下载服务', port: 8901, log_path: '', status: 'offline', pid: null, started_at: null, reason: '未启动' },
  { name: 'axiom', label: 'Axiom-Flow 文档解析服务', port: 8902, log_path: '', status: 'online', pid: 9, started_at: '', reason: '' },
];

async function renderAndAwait() {
  fullMockApi();
  renderDashboard();
  await screen.findByText('数学分析原理'); // 块三数据到位锚点
}

function blockCard(name: string): HTMLElement {
  return screen.getByText(name).closest('.ant-card')!;
}

describe('仪表盘 Dashboard（REQ-033 三块制·五改形态）', () => {
  beforeEach(() => {
    useDashboardStore.setState({
      knowledge: [], details: {}, courseSystem: [], parseBooks: [], parseJobs: [],
      loading: false, error: null, dataError: null, courseError: null, parseError: null,
    });
    useRuntimeStore.setState({
      services: runtimeServices, dbStatus: null, gpu: null, gpuError: null,
      slots: { text: null, vision: null, embedding: null },
      slotErrors: { text: null, vision: null, embedding: null },
      keys: null,
    });
  });

  it('三块自上而下：服务详情 → 文档下载情况 → 文档解析情况；块二块三无 extra；标题 h4；不发 /services', async () => {
    await renderAndAwait();
    const block1 = screen.getByText('服务详情');
    const block2 = screen.getByText('文档下载情况');
    const block3 = screen.getByText('文档解析情况');
    expect(block1.compareDocumentPosition(block2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(block2.compareDocumentPosition(block3) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 五改裁决 8：三块标题参照控制台「服务管理」＝ Title level 4 → h4.ant-typography
    for (const t of [block1, block2, block3]) {
      const h4 = t.closest('h4');
      expect(h4).not.toBeNull();
      expect(h4!.className).toContain('ant-typography');
    }
    // 零额外请求契约：渲染过程不发出 /services
    expect(mockFetch.mock.calls.some((c) => String(c[0]).includes('/services'))).toBe(false);
    // 水位行按裁决删除（MySQL/显存/当前在跑不出现）
    expect(screen.getByText('QED 管理服务（配置中心）')).toBeInTheDocument();
    const card1 = blockCard('服务详情');
    expect(within(card1).queryByText('MySQL')).not.toBeInTheDocument();
    expect(within(card1).queryByText('当前在跑')).not.toBeInTheDocument();
    expect(within(card1).queryByText('显存 / 利用率')).not.toBeInTheDocument();
    // 块一 extra 保留（裁决 3）；块二/块三 extra 删除（裁决 7）
    expect(within(card1).getByText('QED服务及本地模型启动详情')).toBeInTheDocument();
    expect(within(blockCard('文档下载情况')).queryByText('查看各领域课程与书籍下载推进')).not.toBeInTheDocument();
    expect(within(blockCard('文档解析情况')).queryByText('查看每本书解析进度与结果')).not.toBeInTheDocument();
  });

  it('块一（五改）：一张卡内「本地模型列表」居中标题 + 左右两栏（文字在左），旧「本地模型服务」退役', async () => {
    await renderAndAwait();
    const card1 = blockCard('服务详情');
    expect(within(card1).getByText('本地模型列表')).toBeInTheDocument();
    expect(within(card1).queryByText('本地模型服务')).not.toBeInTheDocument();
    expect(within(card1).queryByText('本地模型状况')).not.toBeInTheDocument();
    // slots 未加载（全 null）→ 两栏恒在、恒显未启动（不再整卡隐藏、不再上下两行）
    const cols = [...card1.querySelectorAll('[data-slot-column]')];
    expect(cols.map((c) => (c as HTMLElement).dataset.slotColumn)).toEqual(['text', 'vision']);
    expect(within(card1).getAllByText('未启动')).toHaveLength(2);
    expect(within(card1).queryByText(/显存/)).not.toBeInTheDocument();
  });

  it('块一：local 已加载显示模型名；api 槽未加载但 slot.model 非空也显示模型名（裁决 2）', async () => {
    useRuntimeStore.setState({
      slots: {
        text: { slot: 'text', source: 'local', channel: 'lmstudio', model: 'qwen2.5-14b-instruct',
          ready: true, health_state: 'ready', health_reason: '', last_flip: '' } as SlotStatus,
        vision: { slot: 'vision', source: 'api', channel: 'direct', ready: true, model: 'qwen-vl' } as SlotStatus,
        embedding: null,
      },
    });
    await renderAndAwait();
    const card1 = blockCard('服务详情');
    expect(within(card1).getByText('已加载')).toBeInTheDocument();
    expect(within(card1).getByText('qwen2.5-14b-instruct')).toBeInTheDocument();
    expect(within(card1).getByText('未加载')).toBeInTheDocument();
    // api 不算已加载，但模型名非空即显示（五改裁决）
    expect(within(card1).getByText('qwen-vl')).toBeInTheDocument();
    expect(within(card1).queryByText(/LM Studio|翻转于/)).not.toBeInTheDocument();
  });

  it('块二（五改）：四统计 + 大卡课程行＝名称｜状态｜教程数｜格子 + 图例；旧计数/汇总/extra 退役', async () => {
    await renderAndAwait();
    const card2 = blockCard('文档下载情况');
    expect(within(card2).getByText('领域数')).toBeInTheDocument();
    expect(within(card2).getByText('书目数')).toBeInTheDocument();
    expect(within(card2).getByText('验收通过')).toBeInTheDocument();
    // 数学领域默认大卡：领域态「下载中」标题 Tag；课程行状态四词
    expect(within(card2).getByText('数学分析')).toBeInTheDocument();
    // 数学分析：k1/k2 两套教程 → 教程×2；b2 decided → 状态「下载中」、1 格（b1 parallel 不画）
    expect(within(card2).getByText('教程×2')).toBeInTheDocument();
    expect(within(card2).getByText('高等数学')).toBeInTheDocument();
    expect(within(card2).getByText('未探索')).toBeInTheDocument(); // 高等数学 exploration_stage 未开始
    // 一书一格：仅 b2 一格（b1 parallel 无格；未探索行无格）
    expect(card2.querySelectorAll('[data-book-cell]')).toHaveLength(1);
    expect(card2.querySelector('[data-book-cell="b2"]')).not.toBeNull();
    // 旧形态全部退役：四桶计数文本、领域汇总、五态计数
    expect(within(card2).queryByText(/未\d+·下\d+·完\d+·验\d+/)).not.toBeInTheDocument();
    expect(within(card2).queryByText('领域书籍')).not.toBeInTheDocument();
    expect(within(card2).queryByText('下载中 ×1')).not.toBeInTheDocument();
    // 末尾一行颜色图例（四桶固定文案）
    expect(within(card2).getByText('未开始下载')).toBeInTheDocument();
    expect(within(card2).getByText('下载中(含失败)')).toBeInTheDocument();
    expect(within(card2).getByText('下载完成')).toBeInTheDocument();
    expect(within(card2).getByText('验证完成')).toBeInTheDocument();
    // 点领域按钮切到分析学：实分析出现（探索完成但无书 → 行状态「探索中」）、教程×1
    await userEvent.setup().click(within(card2).getByText('分析学'));
    expect(within(card2).getByText('实分析')).toBeInTheDocument();
    expect(within(card2).queryByText('数学分析')).not.toBeInTheDocument();
    expect(within(card2).getByText('教程×1')).toBeInTheDocument();
  });

  it('块二：领域 >5 折叠为前 5 +「更多 ▾」下拉，点选切换', async () => {
    const many: DomainSystem[] = ['数学', '物理', '化学', '计算机', '生物', '地理', '统计'].map((name, i) => ({
      domain_id: `d${i}`, name, exploration_stage: '未开始', courses: [],
    }));
    mockApi({ '/courses': many, '/knowledge': [], '/parse-jobs': parseJobsFixture, '/books': afBooksFixture });
    renderDashboard();
    await screen.findByText('文档下载情况');
    const card = blockCard('文档下载情况');
    // 前 5 直排，第 6/7 折叠不可见
    expect(within(card).getByText('生物')).toBeInTheDocument();
    expect(within(card).queryByText('地理')).not.toBeInTheDocument();
    expect(within(card).queryByText('统计')).not.toBeInTheDocument();
    // 更多 ▾ 下拉：含折叠领域与四态
    await userEvent.setup().click(within(card).getByText('更多 ▾'));
    expect(await screen.findByText('统计（未开始）')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText('统计（未开始）'));
    // 选中后大卡标题＝统计（按钮已折叠，卡内出现一处即可）
    await waitFor(() => {
      expect(within(card).getByText('统计')).toBeInTheDocument();
    });
  });

  it('块三：课程分组在飞置顶 + af_books 判定（生效版本=已完成、页齐未激活=未生效、分母=page_count）', async () => {
    await renderAndAwait();
    const card3 = blockCard('文档解析情况');
    // KPI（五改顺序）：课程数 5 / 书目数 5 / 解析中 1 / 已完成 1（仅生效版本）
    expect(within(card3).getByText('课程数')).toBeInTheDocument();
    expect(within(card3).getByText('书目数')).toBeInTheDocument();
    expect(within(card3).queryByText('书目总数')).not.toBeInTheDocument();
    // 在飞组「偏微分方程」置顶，展示 book 级进度与失败页备注
    const rows = within(card3).getAllByText('解析中');
    expect(rows.length).toBeGreaterThan(0);
    expect(within(card3).getByText('120/317 页 · 失败 2')).toBeInTheDocument();
    // 「偏微分方程」同时是课程组标题与书名，取首个（组头）做序断言
    expect(within(card3).getAllByText('偏微分方程')[0].compareDocumentPosition(
      within(card3).getByText('数学分析原理'),
    ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 真机缺陷场景：线性代数分母＝全书 457 页（非最新 job 的页数）
    expect(within(card3).getByText('1/457 页')).toBeInTheDocument();
    expect(within(card3).getByText('未开始')).toBeInTheDocument();
    // 数学分析原理＝生效版本完成 → 已完成（KPI 标题 + 行 Tag 各一处）
    expect(within(card3).getAllByText('已完成').length).toBe(2);
    // 拓扑学（interrupted）在第 2 页（每页 3 组），中断判定由聚合纯函数测试覆盖
  });

  it('块三分页：每页 3 课程组，第 2 页含未入库书目', async () => {
    await renderAndAwait();
    const card3 = blockCard('文档解析情况');
    // 第 1 页＝在飞组 + 前 2 个非在飞组；第 4 组「实变函数论」在第二页
    expect(within(card3).queryByText('实变函数论')).not.toBeInTheDocument();
    await userEvent.setup().click(within(card3).getByText('2'));
    // 第 2 页含「实变函数论」组（组头 + 书名各一处）与其未入库状态 Tag
    expect(within(card3).getAllByText('实变函数论').length).toBeGreaterThanOrEqual(2);
    expect(within(card3).getByText('未入库')).toBeInTheDocument();
    // 第 2 页同时含拓扑学组（last_parse_result=interrupted → 中断）
    expect(within(card3).getByText('中断')).toBeInTheDocument();
  });

  it('8902 不可达（/books·/parse-jobs 503）→ 块三独立降级横幅，块一块二不受阻', async () => {
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/books') || url.includes('/parse-jobs')) {
        return Promise.resolve(
          new Response(JSON.stringify({ detail: 'Axiom-Flow 服务不可达' }), { status: 503, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/knowledge/')) return Promise.resolve(json(detailsFixture[url.split('/').pop() ?? '']));
      if (url.includes('/knowledge')) return Promise.resolve(json(knowledgeFixture));
      if (url.includes('/courses')) return Promise.resolve(json(courseSystemFixture));
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    renderDashboard();
    expect(await screen.findByText('文档解析数据不可达')).toBeInTheDocument();
    // 块一/块二照常
    expect(screen.getByText('服务详情')).toBeInTheDocument();
    const card2 = blockCard('文档下载情况');
    expect(within(card2).getByText('高等数学')).toBeInTheDocument();
  });

  it('8901 不可达（/knowledge 503）→ 块二降级提示，无整体横幅；块一/解析块照常', async () => {
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/knowledge')) {
        return Promise.resolve(
          new Response(JSON.stringify({ detail: 'QED-Tracker 服务不可达' }), { status: 503, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/courses')) return Promise.resolve(json(courseSystemFixture));
      if (url.includes('/parse-jobs')) return Promise.resolve(json(parseJobsFixture));
      if (url.includes('/books')) return Promise.resolve(json(afBooksFixture));
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    renderDashboard();
    expect(await screen.findByText('QED-Tracker 数据不可达')).toBeInTheDocument();
    // 无整体错误横幅（503 为 http 类错误，不等同 8900 离线）
    expect(screen.queryByText('仪表盘数据获取失败')).not.toBeInTheDocument();
    expect(screen.getByText('服务详情')).toBeInTheDocument();
    // 块三照常渲染（独立降级互不串扰）
    expect(await screen.findByText('数学分析原理')).toBeInTheDocument();
  });

  it('8900 不可达 → 整体错误横幅', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    renderDashboard();
    expect(await screen.findByText('仪表盘数据获取失败')).toBeInTheDocument();
  });

  it('刷新按钮触发重新拉取', async () => {
    await renderAndAwait();
    await waitFor(() => {
      expect(useDashboardStore.getState().knowledge.length).toBe(3);
    });
    const callsBefore = mockFetch.mock.calls.length;
    await userEvent.setup().click(screen.getByRole('button', { name: /刷新/ }));
    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('30s 保鲜轮询：tick 调 fetchSlots+fetchParse（fetchSlots 供块一「本地模型列表」分节保鲜；不轮询 GPU）；document.hidden 时跳过', async () => {
    fullMockApi();
    const original = { fetchSlots: useRuntimeStore.getState().fetchSlots };
    const originalFetchParse = useDashboardStore.getState().fetchParse;
    const slotsSpy = vi.fn().mockResolvedValue(undefined);
    const parseSpy = vi.fn().mockResolvedValue(undefined);
    useRuntimeStore.setState({ fetchSlots: slotsSpy });
    useDashboardStore.setState({ fetchParse: parseSpy });
    const ticks: (() => void)[] = [];
    const intervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((fn: () => void, ms?: number) => {
      if (ms === 30_000) ticks.push(fn);
      return 0 as unknown as ReturnType<typeof setInterval>;
    }) as typeof window.setInterval);
    try {
      renderDashboard();
      await screen.findByText('仪表盘');
      // mount 期 fetchAll 已并行调过一次 fetchParse，轮询断言以挂载后为基线
      const parseBase = parseSpy.mock.calls.length;
      expect(ticks).toHaveLength(1);
      ticks[0]();
      expect(slotsSpy).toHaveBeenCalledTimes(1);
      expect(parseSpy).toHaveBeenCalledTimes(parseBase + 1);
      // 隐藏页跳过（浏览器实测中隐身视口 document.hidden=true 即此分支）
      Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
      ticks[0]();
      expect(slotsSpy).toHaveBeenCalledTimes(1);
      Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
      ticks[0]();
      expect(slotsSpy).toHaveBeenCalledTimes(2);
      expect(parseSpy).toHaveBeenCalledTimes(parseBase + 2);
    } finally {
      intervalSpy.mockRestore();
      useRuntimeStore.setState(original);
      useDashboardStore.setState({ fetchParse: originalFetchParse });
    }
  });
});
