/**
 * 课程书架单测（M1 判据 S2 第一步：书架 + 引用式注册）
 * 口径：状态徽章词本身承载课程态；注册只存引用与标签快照；进入学习走共享课程 id。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import LearnShelf, { courseOptions, statusBadge } from './LearnShelf';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import type { LearnCourse } from '../api/learn';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

function course(overrides: Partial<LearnCourse>): LearnCourse {
  return {
    learn_course_id: 'lc-1',
    name: '数学分析（教材主线）',
    domain_ref: { ref_id: 'math', label: '数学' },
    course_ref: { ref_id: 'ma', label: '数学分析' },
    direction: '',
    resources: [{ kind: 'book', ref_id: 'b05', label: '数学分析原理' }],
    compile_status: null,
    compile_done: 0,
    compile_total: 0,
    failure_count: 0,
    page_windows: null,
    compile_fingerprint: null,
    instructions: '',
    agent_notes: '',
    created_at: '',
    updated_at: '',
    unit_count: 0,
    derived: {
      status: 'draft', total: 0, done: 0, skipped: 0, percent: 0, current_unit_id: null, completed: false,
    },
    ...overrides,
  };
}

const STAR = {
  domains: [{
    domain_id: 'math', name: '数学', level: 'undergrad',
    tracks: [{
      track: '分析学', kind: 'main', summary: '',
      courses: [{ course_id: 'ma', name: '数学分析', track: '分析学', stage: '', sort_order: 1, kp_confirmed: 0, kp_candidates: 0 }],
    }],
  }],
  edges: [],
};

const BOOKS = [
  { book_id: 'b05', title: '数学分析原理', page_count: 317, course_id: 'ma', active_job_id: 'job-1' },
  { book_id: 'b01', title: '未激活的书', page_count: 100, course_id: 'ma', active_job_id: null },
];

const calls: string[] = [];
let postBody: Record<string, unknown> | null = null;
let courseList: LearnCourse[] = [];

function routes(): void {
  calls.length = 0;
  postBody = null;
  mockFetch.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push(`${method} ${url}`);
    if (url.includes('/learn/star-map')) return jsonResponse(STAR);
    if (url.includes('/learn/courses') && method === 'POST') {
      postBody = JSON.parse(String(init?.body));
      courseList = [...courseList, course({ learn_course_id: 'lc-new' })];
      return jsonResponse(courseList[courseList.length - 1]);
    }
    if (url.includes('/learn/courses/') && method === 'DELETE') return jsonResponse({ deleted: 'lc-1' });
    if (url.includes('/learn/courses')) return jsonResponse({ courses: courseList });
    if (url.includes('/api/v1/books')) return jsonResponse(BOOKS);
    return Promise.reject(new TypeError(`no route: ${method} ${url}`));
  });
}

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
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

/** 弹窗内两个下拉按顺序＝[共享课程, 主素材书]（antd Select 以 mousedown 展开） */
async function selectOption(optionIndex: number, optionText: string): Promise<void> {
  fireEvent.mouseDown(screen.getAllByRole('combobox')[optionIndex]);
  fireEvent.click(await screen.findByText(optionText, { selector: '.ant-select-item-option-content' }));
}

describe('课程书架 LearnShelf（M1：书架与引用式注册）', { timeout: 20000 }, () => {
  beforeEach(() => {
    courseList = [];
    mockFetch.mockReset();
    routes();
  });

  it('statusBadge 词本身承载课程态：draft 按是否已有链路细分', () => {
    expect(statusBadge(course({ unit_count: 0 })).label).toBe('待建链路');
    expect(statusBadge(course({ unit_count: 6 })).label).toBe('草稿');
    expect(statusBadge(course({
      unit_count: 6,
      derived: { status: 'learning', total: 4, done: 1, skipped: 0, percent: 25, current_unit_id: 'u', completed: false },
    })).label).toBe('在学 25%');
    expect(statusBadge(course({
      derived: { status: 'completed', total: 4, done: 4, skipped: 0, percent: 100, current_unit_id: null, completed: true },
    })).label).toBe('已结课');
  });

  it('courseOptions 用「领域::课程」复合值回查领域坐标', () => {
    const options = courseOptions(STAR.domains);
    expect(options[0]).toMatchObject({ value: 'math::ma', course_id: 'ma', domain_id: 'math' });
  });

  it('空书架给出可操作空态（点按钮即开注册弹窗）', async () => {
    renderPage();
    expect(await screen.findByText('课程书架')).toBeInTheDocument();
    expect(screen.getByText('还没有学习课程：点右上「新建学习课程」从书目注册一门')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '新建学习课程' })[0]);
    expect(await screen.findByText('新建学习课程（引用式注册）')).toBeInTheDocument();
  });

  it('课程卡片列出派生进度与链路节点数，进入学习用共享课程 id', async () => {
    courseList = [course({
      unit_count: 12,
      derived: { status: 'learning', total: 12, done: 3, skipped: 0, percent: 25, current_unit_id: 'u-3', completed: false },
    })];
    renderPage();
    expect(await screen.findByText('在学 25%')).toBeInTheDocument();
    expect(screen.getByText('已学 3/12 块 · 链路 12 节点')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '进入学习' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/learn/c/ma'));
  });

  it('注册＝引用式写入：domain_ref/course_ref/resources 只存 ref_id + label 快照', async () => {
    renderPage();
    await screen.findByText('课程书架');
    fireEvent.click(screen.getAllByRole('button', { name: '新建学习课程' })[0]);
    fireEvent.change(await screen.findByLabelText('课程名'), { target: { value: '数学分析（教材主线）' } });
    await selectOption(0, '数学 / 数学分析');
    await selectOption(1, '数学分析原理（b05，317 页）');
    fireEvent.click(screen.getByRole('button', { name: /注.?册/ }));
    await waitFor(() => expect(postBody).not.toBeNull());
    expect(postBody).toMatchObject({
      name: '数学分析（教材主线）',
      domain_ref: { ref_id: 'math', label: '数学' },
      course_ref: { ref_id: 'ma', label: '数学分析' },
      resources: [{ kind: 'book', ref_id: 'b05', label: '数学分析原理' }],
    });
    expect(await screen.findByText('待建链路')).toBeInTheDocument();
  });

  it('未激活解析版本的书不进素材下拉', async () => {
    renderPage();
    await screen.findByText('课程书架');
    fireEvent.click(screen.getAllByRole('button', { name: '新建学习课程' })[0]);
    fireEvent.mouseDown(await screen.findByLabelText('主素材书（已激活解析版本）'));
    const options = await screen.findAllByText('数学分析原理（b05，317 页）');
    expect(options.some((node) => node.classList.contains('ant-select-item-option-content'))).toBe(true);
    expect(screen.queryByText('未激活的书（b01，100 页）')).not.toBeInTheDocument();
  });

  it('8902 书目不可达不影响书架：课程照常列出，仅在素材下拉处提示（独立性铁律）', async () => {
    courseList = [course({ unit_count: 12, derived: { status: 'learning', total: 2, done: 1, skipped: 0, percent: 50, current_unit_id: 'u-1', completed: false } })];
    mockFetch.mockImplementation((url: string, init?: { method?: string }) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/learn/star-map')) return jsonResponse(STAR);
      if (url.includes('/learn/courses')) return jsonResponse({ courses: courseList });
      if (url.includes('/api/v1/books')) return jsonResponse({ detail: 'Axiom-Flow 服务不可达：8902 连接失败' }, 503);
      return Promise.reject(new TypeError(`no route: ${method} ${url}`));
    });
    renderPage();

    expect(await screen.findByText('数学分析（教材主线）')).toBeInTheDocument();
    expect(screen.getByText('在学 50%')).toBeInTheDocument();
    expect(screen.queryByText('书架数据不可达')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent.includes('新建学习课程'))!);
    await waitFor(() => expect(screen.getByText('书目服务不可达（解析侧离线），暂不能选素材')).toBeInTheDocument());
  });

  it('8900 不可达时降级为空态并给重试，不白屏', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ detail: '无法连接服务' }, 503));
    renderPage();
    expect(await screen.findByText('书架数据不可达')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重\s*试/ })).toBeInTheDocument();
    expect(screen.getByText('课程书架')).toBeInTheDocument();
  });
});
