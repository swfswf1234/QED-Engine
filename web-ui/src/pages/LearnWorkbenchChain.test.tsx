/**
 * 三栏工作台「链路」模式集成单测（M1 裁决 D1~D4 的界面面）
 * 口径：链路模式在既有三栏内切换（不另建页）；块正文＝该块页窗指向的解析产物按版式渲染；
 * 无页窗块＝骨架占位标记；推进＝学习者勾选，进度取服务端派生。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import LearnWorkbench from './LearnWorkbench';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useLearnChainStore } from '../stores/learnChain';
import { useLearnWorkbenchStore } from '../stores/learnWorkbench';
import type { LearnCourse, LearnUnit } from '../api/learn';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
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
const BOOKS = [{ book_id: 'b05', title: '数学分析原理', page_count: 317, course_id: 'ma', active_job_id: 'job-1' }];
const OUTLINE = {
  course_id: 'ma',
  book_ref: 'b05',
  outline: [
    {
      kp_id: 'kp-c1', course_id: 'ma', node_kind: 'outline', name: '第1章 实数系和复数系', depth: 1,
      parent_kp_id: null, book_ref: 'b05', point_count: 2,
      source_ref: { kind: 'book', ref_id: 'b05', page_start: 7, page_end: 12 },
    },
    {
      kp_id: 'kp-s1', course_id: 'ma', node_kind: 'outline', name: '有序集', depth: 2,
      parent_kp_id: 'kp-c1', book_ref: 'b05', point_count: 1,
      source_ref: { kind: 'book', ref_id: 'b05', page_start: 8, page_end: 9 },
    },
  ],
};

function learnCourse(overrides: Partial<LearnCourse> = {}): LearnCourse {
  return {
    learn_course_id: 'lc-1',
    name: '数学分析（教材主线）',
    domain_ref: { ref_id: 'math', label: '数学' },
    course_ref: { ref_id: 'ma', label: '数学分析' },
    direction: '',
    resources: [{ kind: 'book', ref_id: 'b05', label: '数学分析原理' }],
    compile_status: 'completed',
    compile_done: 2,
    compile_total: 2,
    failure_count: 0,
    page_windows: [{ start: 8, end: 9 }],
    compile_fingerprint: 'fp',
    instructions: '',
    agent_notes: '',
    created_at: '',
    updated_at: '',
    unit_count: 3,
    derived: {
      status: 'learning', total: 2, done: 0, skipped: 0, percent: 0, current_unit_id: 'u-1', completed: false,
    },
    ...overrides,
  };
}

function learnUnit(overrides: Partial<LearnUnit>): LearnUnit {
  return {
    unit_id: 'u-1',
    learn_course_id: 'lc-1',
    parent_id: 'u-sec',
    level: 'unit',
    title: '有序集',
    sort_order: 1,
    confirmed: true,
    covered: false,
    type: 'text',
    payload: { text: '「有序集」骨架正文（M-1 占位，M-2 接生成管线）' },
    source_ref: { ref_id: 'b05', page_start: 8, page_end: 9 },
    gen_status: 'generated',
    active: true,
    ...overrides,
  };
}

const hub = {
  registered: true,
  units: [] as LearnUnit[],
  progress: [] as Array<{ unit_id: string; status: string }>,
};

/** 派生进度按已写学习事件重算（与服务端 derived_progress 同口径） */
function derivedNow(): LearnCourse['derived'] {
  const blocks = hub.units.filter((u) => u.level === 'unit');
  const statusOf = (unitId: string) => hub.progress.find((p) => p.unit_id === unitId)?.status ?? '';
  const done = blocks.filter((u) => statusOf(u.unit_id) === 'done').length;
  const skipped = blocks.filter((u) => statusOf(u.unit_id) === 'skipped').length;
  const current = blocks.find((u) => !['done', 'skipped'].includes(statusOf(u.unit_id))) ?? null;
  const total = blocks.length;
  return {
    status: total === 0 ? 'draft' : 'learning',
    total,
    done,
    skipped,
    percent: total === 0 ? 0 : Math.round(((done + skipped) / total) * 100),
    current_unit_id: current?.unit_id ?? null,
    completed: total > 0 && done + skipped === total,
  };
}

function routes(): void {
  mockFetch.mockImplementation((rawUrl: string, init?: { method?: string; body?: string }) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const url = String(rawUrl);
    if (url.includes('/learn/star-map')) return jsonResponse(STAR);
    if (url.includes('/learn/courses/lc-1/progress') && method === 'POST') {
      const body = JSON.parse(String(init?.body));
      hub.progress.push({ unit_id: body.unit_id, status: body.status });
      return jsonResponse({ unit_id: body.unit_id, status: body.status, derived: derivedNow() });
    }
    if (url.includes('/learn/courses/lc-1/progress')) return jsonResponse(derivedNow());
    if (url.includes('/learn/courses/lc-1/units')) return jsonResponse({ units: hub.units });
    if (url.includes('/learn/courses/lc-1/compile')) {
      return jsonResponse({ compile_status: 'completed', done: 2, total: 2, failure_count: 0 });
    }
    if (url.includes('/learn/units/')) {
      const target = hub.units.find((u) => url.endsWith(u.unit_id));
      if (target && method === 'PATCH') Object.assign(target, JSON.parse(String(init?.body)));
      return jsonResponse(target ?? learnUnit({}));
    }
    if (url.includes('/learn/courses')) {
      return jsonResponse({ courses: hub.registered ? [learnCourse({ derived: derivedNow() })] : [] });
    }
    if (url.includes('/learn/kp-details')) return jsonResponse({ details: [], total: 0 });
    if (url.includes('/outline')) return jsonResponse(OUTLINE);
    if (url.includes('/pages/')) {
      const pageNo = Number(url.match(/\/pages\/(\d+)/)?.[1]);
      return jsonResponse({
        page_no: pageNo,
        image_url: '',
        markdown: '',
        blocks: { page: pageNo, blocks: [{ type: 'paragraph', bbox: [0, 0, 10, 10], text: `链路第 ${pageNo} 页正文` }] },
      });
    }
    if (url.includes('/api/v1/books')) return jsonResponse(BOOKS);
    return Promise.reject(new TypeError(`no route: ${method} ${url}`));
  });
}

function renderPage(path = '/learn/c/ma') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ConfigProvider theme={theme}>
        <Routes>
          <Route path="/learn/c/:courseId" element={<LearnWorkbench />} />
          <Route path="/learn" element={<span data-testid="shelf-page">书架</span>} />
          <Route path="/knowledge" element={<span data-testid="star-page">星图</span>} />
        </Routes>
      </ConfigProvider>
    </MemoryRouter>,
  );
}

/** antd Segmented：点内层 radio 才会触发 onChange（label 文本节点不派发） */
function switchMode(index: number): void {
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.ant-segmented-item-input'));
  fireEvent.click(inputs[index]);
}

async function toChainMode(): Promise<void> {
  renderPage();
  await screen.findByText('数学分析 · 学习工作台');
  switchMode(1);
}

describe('工作台链路模式（M1：三栏内双模式）', { timeout: 20000 }, () => {
  beforeEach(() => {
    hub.registered = true;
    hub.units = [
      learnUnit({ unit_id: 'u-sec', level: 'section', title: '第1章 实数系和复数系', parent_id: null, source_ref: null }),
      learnUnit({ unit_id: 'u-1', title: '有序集', source_ref: { ref_id: 'b05', page_start: 8, page_end: 9 } }),
      learnUnit({ unit_id: 'u-2', title: '域的公理', sort_order: 2, source_ref: null }),
    ];
    hub.progress = [];
    mockFetch.mockReset();
    routes();
    useLearnChainStore.setState({
      courseId: null, learnCourse: null, units: [], progress: null, selectedUnitId: null, bookId: null,
      range: null, pages: {}, loadedThrough: 0, busy: false, compiling: false, error: null, notice: null,
    });
    useLearnWorkbenchStore.setState({
      courseId: null, course: null, bookId: null, book: null, books: [], outline: [], selectedKpId: null,
      range: null, pages: {}, loadedThrough: 0, selectedBlock: null, candidates: [], loading: false, error: null, notice: null,
    });
  });

  it('默认阅读模式不请求学习课程；切到链路模式才加载', async () => {
    renderPage();
    expect(await screen.findByText('目录')).toBeInTheDocument();
    expect(screen.queryByText('学习链路')).not.toBeInTheDocument();
    switchMode(1);
    expect(await screen.findByText('学习链路')).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: '进度与推进' })).toBeInTheDocument();
  });

  it('未登记学习课程＝空态并给出创建入口', async () => {
    hub.registered = false;
    await toChainMode();
    expect(await screen.findByText('这门课还没有登记学习课程')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '去书架创建' })).toBeInTheDocument();
    expect(screen.getByText('本课未登记学习课程，无进度可读')).toBeInTheDocument();
  });

  it('链路树按章→块渲染并带确认/编译标记', async () => {
    await toChainMode();
    expect(await screen.findByTestId('chain-tree')).toBeInTheDocument();
    expect(screen.getByText('第1章 实数系和复数系')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /有序集/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /域的公理/ })).toBeInTheDocument();
    expect(screen.getAllByText('待学')).toHaveLength(2);
  });

  it('有页窗的块＝按版式渲染该页解析产物（D2）', async () => {
    await toChainMode();
    fireEvent.click(await screen.findByRole('button', { name: /有序集/ }));
    expect(await screen.findByText('链路第 8 页正文')).toBeInTheDocument();
    expect(screen.getByText('链路第 9 页正文')).toBeInTheDocument();
    expect(screen.queryByTestId('chain-skeleton-body')).not.toBeInTheDocument();
  });

  it('无页窗的块＝骨架占位文本并标「待生成」，不假装有正文', async () => {
    await toChainMode();
    fireEvent.click(await screen.findByRole('button', { name: /域的公理/ }));
    expect(await screen.findByTestId('chain-skeleton-body')).toBeInTheDocument();
    expect(screen.getByText('骨架占位（M-2 生成后替换）')).toBeInTheDocument();
  });

  it('勾选学完＝写学习事件并刷新派生进度（断点续学指针随之后移）', async () => {
    await toChainMode();
    fireEvent.click(await screen.findByRole('button', { name: /有序集/ }));
    fireEvent.click(await screen.findByRole('button', { name: '标记学完' }));
    await waitFor(() => expect(hub.progress).toHaveLength(1));
    expect(hub.progress[0]).toEqual({ unit_id: 'u-1', status: 'done' });
    expect(await screen.findByText('已学 1/2 · 跳过 0')).toBeInTheDocument();
  });

  it('回到断点＝跳到服务端派生的 current_unit_id（续学定位）', async () => {
    await toChainMode();
    fireEvent.click(await screen.findByRole('button', { name: '回到断点' }));
    expect(useLearnChainStore.getState().selectedUnitId).toBe('u-1');
    expect(await screen.findByText('链路第 8 页正文')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '标记学完' }));
    await waitFor(() => expect(useLearnChainStore.getState().progress?.current_unit_id).toBe('u-2'));
    fireEvent.click(screen.getByRole('button', { name: '回到断点' }));
    expect(useLearnChainStore.getState().selectedUnitId).toBe('u-2');
    expect(await screen.findByTestId('chain-skeleton-body')).toBeInTheDocument();
  });

  it('结课视图＝全部推进完后只读渲染派生进度端点的结课位（S3）', async () => {
    await toChainMode();
    fireEvent.click(await screen.findByRole('button', { name: /有序集/ }));
    fireEvent.click(screen.getByRole('button', { name: '标记学完' }));
    await waitFor(() => expect(hub.progress).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: /域的公理/ }));
    fireEvent.click(screen.getByRole('button', { name: '标记学完' }));
    await waitFor(() => expect(hub.progress).toHaveLength(2));

    const panel = await screen.findByTestId('chain-completion');
    expect(panel).toHaveTextContent('已结课');
    expect(panel).toHaveTextContent('已学 2/2 · 跳过 0');
  });
});
