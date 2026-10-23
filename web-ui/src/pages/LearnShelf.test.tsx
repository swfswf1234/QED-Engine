/**
 * 书架清单单测（REQ-117 W8 面形态＋v1.0 三张化读数，ADR 0026 D4）
 * 口径：进场即服务端同步（无「新建学习课程」）；课程行只写正式名称，学习课程 ID＝共享课程 ID；
 * 教材＝课程下横排小卡片（教材级进度按知识点条数计），可进入学习（带 ?book=）或教材级忽略并可按回来；
 * 领域框在标题行右侧且默认第一个领域；页头三按钮＝使用手册／刷新／返回。
 * S4 守护：学习面可见文案不出现过程性技术术语（链路／编译／解析／同步／降级／单元／端口）。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import LearnShelf, {
  ALL_DOMAINS, courseDisplayName, shelfOrder, splitBooks, statusBadge, toggleDismissed,
} from './LearnShelf';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import type { CourseResource, LearnCourse, LearnDerived } from '../api/learn';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

/** 派生课程态（门游标＋计数一律读时派生，落列的只有 kp 行状态） */
function derived(overrides: Partial<LearnDerived> = {}): LearnDerived {
  return {
    status: 'draft', total: 0, done: 0, skipped: 0, percent: 0, current_unit_id: null,
    completed: false, mastered: 0, next_unit_id: null, provenance: { system: 0, learner: 0 }, books: [],
    ...overrides,
  };
}

function course(overrides: Partial<LearnCourse> = {}): LearnCourse {
  return {
    // D4：学习课程 ID 就是共享课程 ID，不再有两套坐标
    learn_course_id: 'ma', status: 'active', name: '数学分析',
    domain_id: 'math', track: '分析学', description: '',
    resources: [{ kind: 'book', ref_id: 'b05', label: '数学分析原理', dismissed: false }],
    kp_path: [], learner_note: '', created_at: '', updated_at: '',
    unit_count: 0, derived: derived(),
    ...overrides,
  };
}

const STAR = {
  domains: [
    {
      domain_id: 'math', name: '数学', level: 'undergrad',
      tracks: [
        {
          track: '代数学', kind: 'branch', summary: '',
          courses: [{ course_id: 'al', name: '抽象代数', track: '代数学', stage: '主干', sort_order: 1, kp_confirmed: 0 }],
        },
        {
          track: '分析学', kind: 'main', summary: '',
          courses: [
            { course_id: 'fa', name: '复分析', track: '分析学', stage: '主干', sort_order: 2, kp_confirmed: 0 },
            { course_id: 'ma', name: '数学分析', track: '分析学', stage: '基础', sort_order: 1, kp_confirmed: 0 },
          ],
        },
      ],
    },
    {
      domain_id: 'cs', name: '计算机科学', level: 'undergrad',
      tracks: [{
        track: '人工智能', kind: 'main', summary: '',
        courses: [{ course_id: 'ml', name: '机器学习', track: '人工智能', stage: '主干', sort_order: 1, kp_confirmed: 0 }],
      }],
    },
  ],
  edges: [],
};

const BOOK_META = [
  { ref_id: 'b05', label: '数学分析原理', course_id: 'ma', knowledge_id: 'k-ma', intro: '面向数学专业本科一年级的教材，先建极限与连续的直觉。', position: 'beginner', position_label: '入门', page_count: 317 },
  { ref_id: 'b07', label: '数学分析习题集', course_id: 'ma', knowledge_id: 'k-ma', intro: '配套习题', position: 'beginner', position_label: '入门', page_count: 200 },
];

const calls: string[] = [];
let patchBody: Record<string, unknown> | null = null;
let courseList: LearnCourse[] = [];
let syncStatus = 200;

function syncResult() {
  return {
    synced: courseList.reduce((sum, item) => sum + item.resources.length, 0),
    created: [],
    updated: [],
    courses: courseList,
    books: BOOK_META,
  };
}

function routes(): void {
  calls.length = 0;
  patchBody = null;
  syncStatus = 200;
  mockFetch.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push(`${method} ${url}`);
    if (url.includes('/learn/star-map')) return jsonResponse(STAR);
    if (url.includes('/learn/courses/sync') && method === 'POST') {
      if (syncStatus === 503) return jsonResponse({ detail: '解析侧书目不可达，同步未执行：ConnectError' }, 503);
      return jsonResponse(syncResult());
    }
    if (url.match(/\/learn\/courses\/[^/]+$/) && method === 'PATCH') {
      patchBody = JSON.parse(String(init?.body));
      const updated = course({
        ...courseList.find((item) => url.endsWith(item.learn_course_id)),
        resources: (patchBody?.resources ?? []) as CourseResource[],
      });
      courseList = courseList.map((item) => (item.learn_course_id === updated.learn_course_id ? updated : item));
      return jsonResponse(updated);
    }
    if (url.includes('/learn/courses')) return jsonResponse({ courses: courseList });
    return Promise.reject(new TypeError(`no route: ${method} ${url}`));
  });
}

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <span data-testid="location">{`${pathname}${search}`}</span>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/learn']}>
      <ConfigProvider theme={theme}>
        <Routes>
          <Route path="/learn" element={<LearnShelf />} />
        </Routes>
        <LocationProbe />
      </ConfigProvider>
    </MemoryRouter>,
  );
}

describe('书架清单 LearnShelf（REQ-117 W8＋v1.0 读数）', { timeout: 20000 }, () => {
  beforeEach(() => {
    courseList = [];
    mockFetch.mockReset();
    routes();
  });

  it('statusBadge 词本身承载课程态，且不出现「链路」「编译」字样', () => {
    expect(statusBadge(course({ unit_count: 0 })).label).toBe('知识点未就绪');
    expect(statusBadge(course({ unit_count: 6 })).label).toBe('未开始');
    expect(statusBadge(course({
      unit_count: 6,
      derived: derived({ status: 'learning', total: 4, done: 1, percent: 25, current_unit_id: 'kp:p1' }),
    })).label).toBe('学习进度 25%');
    expect(statusBadge(course({
      derived: derived({ status: 'completed', total: 4, done: 4, percent: 100, current_unit_id: null, completed: true }),
    })).label).toBe('已结课');
    for (const courseRow of [course({}), course({ unit_count: 6 })]) {
      expect(statusBadge(courseRow).label).not.toMatch(/链路|编译|单元/);
    }
  });

  it('课程行标题＝共享表正式名称（R5 引用不复制，界面上没有名称快照位）', () => {
    expect(courseDisplayName(course({ name: '高等代数' }))).toBe('高等代数');
    expect(courseDisplayName(course({ name: 'ma' }))).toBe('ma');
  });

  it('splitBooks 按忽略位分列（非 book 素材不参与）', () => {
    const list = course({
      resources: [
        { kind: 'book', ref_id: 'b05', label: '甲', dismissed: false },
        { kind: 'book', ref_id: 'b07', label: '乙', dismissed: true },
        { kind: 'knowledge', ref_id: 'k-ma', label: '教程套' },
      ],
    });
    expect(splitBooks(list).shown.map((r) => r.ref_id)).toEqual(['b05']);
    expect(splitBooks(list).dismissed.map((r) => r.ref_id)).toEqual(['b07']);
  });

  it('toggleDismissed 整列提交只翻目标教材，其余元素原样保留', () => {
    const resources: CourseResource[] = [
      { kind: 'book', ref_id: 'b05', label: '甲', dismissed: false },
      { kind: 'book', ref_id: 'b07', label: '乙', dismissed: true },
      { kind: 'knowledge', ref_id: 'k-ma', label: '教程套' },
    ];
    expect(toggleDismissed(resources, 'b05', true)).toEqual([
      { kind: 'book', ref_id: 'b05', label: '甲', dismissed: true },
      { kind: 'book', ref_id: 'b07', label: '乙', dismissed: true },
      { kind: 'knowledge', ref_id: 'k-ma', label: '教程套' },
    ]);
  });

  it('shelfOrder 按领域顺序＋stage 层级×主轨在前×sort_order 竖排，星图无坐标者排所属领域末尾', () => {
    const ordered = shelfOrder(STAR.domains, [
      course({ learn_course_id: 'ml', name: '机器学习', domain_id: 'cs', track: '人工智能' }),
      course({ learn_course_id: 'fa', name: '复分析' }),
      course({ learn_course_id: 'ma', name: '数学分析' }),
      course({ learn_course_id: 'zz', name: '无坐标课程' }),
    ]);
    expect(ordered.map((item) => item.learn_course_id)).toEqual(['ma', 'fa', 'zz', 'ml']);
  });

  it('进场即向服务端要同步结果（不再新建学习课程），页头＝使用手册／刷新／返回', async () => {
    renderPage();
    expect(await screen.findByText('学习中心·书架清单')).toBeInTheDocument();
    expect(calls).toContain('POST /api/v1/learn/courses/sync');
    expect(screen.queryByRole('button', { name: /新建学习课程/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /使用手册/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /刷新/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /返回/ })).toBeInTheDocument();
  });

  it('教材小卡片＝书名＋简介＋面向对象档位＋教材级进度（条数），进入学习带 ?book=', async () => {
    courseList = [course({
      unit_count: 4,
      resources: [
        { kind: 'book', ref_id: 'b05', label: '数学分析原理', dismissed: false },
        { kind: 'book', ref_id: 'b07', label: '数学分析习题集', dismissed: false },
      ],
      derived: derived({
        status: 'learning', total: 4, done: 1, percent: 25, current_unit_id: 'kp:p1',
        books: [
          { ref_id: 'b05', label: '数学分析原理', total: 3, done: 1, percent: 33.3 },
          { ref_id: 'b07', label: '数学分析习题集', total: 1, done: 0, percent: 0 },
        ],
      }),
    })];
    renderPage();
    const card = await screen.findByTestId('shelf-book-b05');
    expect(within(card).getByText('数学分析原理')).toBeInTheDocument();
    expect(within(card).getByText(/先建极限与连续的直觉/)).toBeInTheDocument();
    expect(within(card).getByText('入门')).toBeInTheDocument();
    expect(within(card).getByText('1/3 条')).toBeInTheDocument();
    expect(within(screen.getByTestId('shelf-book-b07')).getByText('0/1 条')).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: '进入学习' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/learn/c/ma?book=b05'));
  });

  it('忽略＝教材级 dismissed 落库：卡片收起并进「已忽略」区，按回来还原', async () => {
    courseList = [course({
      resources: [
        { kind: 'book', ref_id: 'b05', label: '数学分析原理', dismissed: false },
        { kind: 'book', ref_id: 'b07', label: '数学分析习题集', dismissed: false },
      ],
    })];
    renderPage();
    await screen.findByTestId('shelf-book-b05');
    fireEvent.click(within(screen.getByTestId('shelf-book-b07')).getByRole('button', { name: /忽略/ }));
    await waitFor(() => expect(patchBody).not.toBeNull());
    expect(patchBody?.resources).toEqual([
      { kind: 'book', ref_id: 'b05', label: '数学分析原理', dismissed: false },
      { kind: 'book', ref_id: 'b07', label: '数学分析习题集', dismissed: true },
    ]);
    await waitFor(() => expect(screen.queryByTestId('shelf-book-b07')).not.toBeInTheDocument());
    expect(screen.getByText('已忽略：')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /数学分析习题集/ }));
    await waitFor(() => expect(screen.getByTestId('shelf-book-b07')).toBeInTheDocument());
  });

  it('领域框默认落在第一个领域（非全部），切「全部领域」才见跨领域课程', async () => {
    courseList = [
      course({ learn_course_id: 'ma', name: '数学分析' }),
      course({
        learn_course_id: 'ml',
        name: '机器学习',
        domain_id: 'cs',
        track: '人工智能',
        resources: [{ kind: 'book', ref_id: 'b09', label: '机器学习导论', dismissed: false }],
      }),
    ];
    renderPage();
    expect(await screen.findByText('数学分析')).toBeInTheDocument();
    expect(screen.queryByText('机器学习导论')).not.toBeInTheDocument();
    expect(screen.getByText('数学', { selector: '.ant-select-selection-item' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('全部领域', { selector: '.ant-select-item-option-content' }));
    await waitFor(() => expect(screen.getByText('机器学习导论')).toBeInTheDocument());
    expect(screen.getByText('机器学习')).toBeInTheDocument();
    expect(ALL_DOMAINS).toBe('__all__');
  });

  it('同步失败不白屏：回落只读既有课程并给出可操作的浅色提示', async () => {
    courseList = [course({
      unit_count: 6,
      derived: derived({
        status: 'learning', total: 2, done: 1, percent: 50, current_unit_id: 'kp:p1',
        books: [{ ref_id: 'b05', label: '数学分析原理', total: 2, done: 1, percent: 50 }],
      }),
    })];
    syncStatus = 503;
    renderPage();
    expect(await screen.findByText('数学分析')).toBeInTheDocument();
    expect(screen.getByText('学习进度 50%')).toBeInTheDocument();
    expect(screen.getByText('1/2 条')).toBeInTheDocument();
    expect(screen.getByText('暂时读不到新准备的教材')).toBeInTheDocument();
  });

  it('空清单给出可操作空态（点「刷新」即重新取），且无新建入口', async () => {
    renderPage();
    expect(await screen.findByText(/书架还是空的/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /新建学习课程/ })).not.toBeInTheDocument();
  });

  it('S4：可见文案不出现过程性技术术语与端口号', async () => {
    courseList = [course({ unit_count: 6 })];
    renderPage();
    const main = await screen.findByText('学习中心·书架清单');
    const text = (main.closest('div')?.parentElement ?? main).textContent ?? '';
    for (const forbidden of ['链路', '编译', '解析', '同步', '降级', '单元', '8900', '8902']) {
      expect(text, `文案不应出现「${forbidden}」`).not.toContain(forbidden);
    }
  });
});
