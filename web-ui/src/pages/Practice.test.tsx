/**
 * 学习中心·课后练习独立面单测（REQ-106 W1/W3 页壳）
 * - 归属＝课级：页头课程选择器取 `GET /learn/courses`，值＝`learn_course_id`（D4 后它就是共享
 *   `qed_course.course_id`：练习三表与题源书目的 `course` 口径只有一个坐标），空 id 不进选项
 * - 层级唯一事实源＝URL（`?course=`，与 `#/knowledge` 同判例）；未选课各分区给「先选一门课」空态且不发请求
 * - 8900 不可达：顶部「练习数据不可达」告警 + 重试，不白屏
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Practice from './Practice';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { usePracticeStore } from '../stores/practice';
import type { LearnCourse } from '../api/learn';

vi.mock('../components/practice/PracticePane', () => ({
  default: ({ courseId }: { courseId: string }) => <div data-testid="practice-pane">{courseId}</div>,
}));
vi.mock('../components/practice/ChapterPractice', () => ({
  default: ({ courseId }: { courseId: string }) => <div data-testid="chapter-practice">{courseId}</div>,
}));

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <span data-testid="location">{pathname}{search}</span>;
}

function learnCourse(id: string, name: string): LearnCourse {
  return {
    learn_course_id: id, status: 'active', name, domain_id: 'math', track: '分析学', description: '',
    resources: [], kp_path: [], learner_note: '', created_at: '', updated_at: '',
    derived: {
      status: 'draft', total: 0, done: 0, skipped: 0, percent: 0, current_unit_id: null,
      completed: false, mastered: 0, next_unit_id: null, provenance: { system: 0, learner: 0 }, books: [],
    },
  };
}

const LEARN_COURSES = {
  courses: [
    learnCourse('ma', '数学分析（在学）'),
    learnCourse('al', '抽象代数'),
    learnCourse('ra', '实变函数'),
    learnCourse('', '没有坐标的行（不进选项）'),
  ],
};

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  );
}

const calls: string[] = [];

/** 只有课程列表端点可达：练习面三区（题/队列/错题）在选中课后才发，本用例只数列表请求 */
function routeCourses() {
  calls.length = 0;
  mockFetch.mockImplementation((url: string, init?: { method?: string }) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (String(url).includes('/learn/courses')) return jsonResponse(LEARN_COURSES);
    return Promise.reject(new TypeError(`no route: ${url}`));
  });
}

function renderPage(path = '/practice') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ConfigProvider theme={theme}>
        <Practice />
        <LocationProbe />
      </ConfigProvider>
    </MemoryRouter>,
  );
}

describe('学习中心·课后练习 Practice（独立面页壳）', { timeout: 15000 }, () => {
  beforeEach(() => {
    usePracticeStore.setState({ courseId: null, sourceBooks: [], questions: [], dueTasks: [], mistakes: [], totalDue: 0, error: null, notice: null });
    mockFetch.mockReset();
    routeCourses();
  });

  it('大标题＋课程选择器，未选课各分区给「先选一门课」空态且不发练习请求', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /学习中心·课后练习/ })).toBeInTheDocument();
    expect(screen.getAllByText('先选一门课')).toHaveLength(2);
    expect(screen.queryByTestId('practice-pane')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chapter-practice')).not.toBeInTheDocument();
    expect(calls.some((c) => c.includes('/learn/question-books'))).toBe(false);
    expect(calls.some((c) => c.includes('/learn/review/due'))).toBe(false);
  });

  it('选项＝学习课程清单（值即 learn_course_id），空坐标行不进选项，选择即写 `?course=`（URL 为唯一事实源）', async () => {
    renderPage();
    fireEvent.mouseDown(await screen.findByRole('combobox', { name: '课程' }));
    expect(await screen.findByText('数学分析（在学）')).toBeInTheDocument();
    expect(screen.getByText('抽象代数')).toBeInTheDocument();
    expect(screen.getByText('实变函数')).toBeInTheDocument();
    expect(screen.queryByText('没有坐标的行（不进选项）')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('实变函数'));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/practice?course=ra'));
  });

  it(`?course= 深链直达：三区按该课挂载（值喂给练习域即目录坐标）`, async () => {
    renderPage('/practice?course=ma');
    expect((await screen.findByTestId('practice-pane')).textContent).toBe('ma');
    expect(screen.getByTestId('chapter-practice').textContent).toBe('ma');
  });

  it('页头返回回主界面', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /返回/ }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'));
  });

  it('页头「使用手册」直落课后练习册（巩固复习口径，可回总册）', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /使用手册/ }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/巩固与自查的地方/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /学习中心总手册/ })).toBeInTheDocument();
  });

  it('8900 不可达：顶部「练习数据不可达」告警＋重试，重试恢复后告警消失', async () => {
    mockFetch.mockImplementation(() => Promise.reject(new TypeError('offline')));
    renderPage();
    expect(await screen.findByText('练习数据不可达')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /重\s*试/ });
    routeCourses();
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByText('练习数据不可达')).not.toBeInTheDocument());
    // 告警消失即重试重新取到了课程列表（coursesError 只有成功路径才清）
    expect(screen.getByRole('combobox', { name: '课程' })).toBeInTheDocument();
  });

  it('不放跨面跳转按钮（面间零跳转裁决）：无「去学正文」类入口', async () => {
    renderPage('/practice?course=ma');
    await screen.findByTestId('practice-pane');
    expect(screen.queryByRole('link', { name: /正文|工作台|学习/ })).not.toBeInTheDocument();
  });
});
