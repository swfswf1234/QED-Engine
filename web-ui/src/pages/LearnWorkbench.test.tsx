/**
 * 学习工作台页用例（v1.0 三张化，ADR 0026）
 * 守护七件事：页头两处返回落点、标题只写课程正式名称（无后缀无进度）、左栏两级无「修改目录」且只列名称，
 * 左栏两档左缘对齐、中栏连续正文流无页码口径＋滚动续取＋末尾三枚推进，
 * 右栏「学习交流」三段（本章总结与学习要点 → 详解＝主表 angles → 备注＝kp 行 learner_note），
 * 推进与备注一律写 kp 行（`qe_unit` 与候选池 `qe_kp_detail` 已退出，界面上不该再有它们的口径）。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import LearnWorkbench, {
  OUTLINE_INDENT_PX, outlineRowStyle, workbenchModeFor, workbenchTitleOf,
} from './LearnWorkbench';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useLearnWorkbenchStore } from '../stores/learnWorkbench';
import type {
  KpAngle, KpLearnerRow, LearnCourse, LearnDerived, LearnProgress,
  OutlineRow, PointChapter, PointUnit,
} from '../api/learn';

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
      courses: [{ course_id: 'ma', name: '数学分析', track: '分析学', stage: '', sort_order: 1, kp_confirmed: 0 }],
    }],
  }],
  edges: [],
};

/** b07 已备好正文、b01 未激活解析版本（不进目录与正文） */
const BOOKS = [
  { book_id: 'b07', title: '高等数学引论', page_count: 260, course_id: 'ma', active_job_id: 'job-7' },
  { book_id: 'b01', title: '同课未激活', page_count: 100, course_id: 'ma', active_job_id: null },
];

const CHAPTERS: PointChapter[] = [
  {
    kp_id: 'c1', name: '第1章 实数', node_kind: 'outline', unit_id: 'kp:c1', point_count: 2,
    book_ref: 'b07', depth: 1, parent_kp_id: null,
    source_ref: { ref_id: 'b07', page_start: 5, page_end: 20 }, summary: '', key_points: [],
  },
  {
    kp_id: 'c2', name: '第2章 完备性', node_kind: 'outline', unit_id: 'kp:c2', point_count: 1,
    book_ref: 'b07', depth: 1, parent_kp_id: null,
    source_ref: { ref_id: 'b07', page_start: 21, page_end: 40 },
    summary: '本章把完备性分成三条等价表述', key_points: ['单调有界原理', '闭区间套定理'],
  },
];

const POINTS: PointUnit[] = [
  {
    kp_id: 'p1', name: '实数的运算', node_kind: 'point', unit_id: 'kp:p1', parent_id: 'kp:c1',
    chapter_kp_id: 'c1', title: '实数的运算', sort_order: 0, type: 'concept',
    summary: '有序域的三条运算律', angles: [], book_ref: 'b07',
    source_ref: { ref_id: 'b07', page_start: 5, page_end: 9 }, window_source: 'point',
  },
  {
    kp_id: 'p2', name: '绝对值', node_kind: 'point', unit_id: 'kp:p2', parent_id: 'kp:c1',
    chapter_kp_id: 'c1', title: '绝对值', sort_order: 1, type: 'concept',
    summary: '', angles: [], book_ref: 'b07',
    source_ref: { ref_id: 'b07', page_start: 10, page_end: 14 }, window_source: 'anchor',
  },
  {
    kp_id: 'p3', name: '确界原理', node_kind: 'point', unit_id: 'kp:p3', parent_id: 'kp:c2',
    chapter_kp_id: 'c2', title: '确界原理', sort_order: 2, type: 'concept',
    summary: '非空有上界的实数集必有上确界', angles: [], book_ref: 'b07',
    source_ref: { ref_id: 'b07', page_start: 21, page_end: 30 }, window_source: 'chapter',
  },
];

function outlineRows(): OutlineRow[] {
  return CHAPTERS.map((chapter) => ({
    kp_id: chapter.kp_id, course_id: 'ma', node_kind: 'outline', name: chapter.name, depth: 1,
    parent_kp_id: null, book_ref: 'b07', point_count: chapter.point_count,
    source_ref: { kind: 'book', ...chapter.source_ref },
    summary: chapter.summary, anchors: [],
    meta: { chapter_key_points: chapter.key_points },
  } as OutlineRow));
}

/** 学习者落笔态（kp 行）：status＋learner_note 两件，其余按契约给空位 */
interface LearnerCell {
  status: string;
  note: string;
}

interface Hub {
  points: PointUnit[];
  chapters: PointChapter[];
  /** 服务端唯一的落笔存储：kp_id → 行（没有这一格＝没落过笔） */
  kpRows: Record<string, LearnerCell>;
  progressPosts: Array<Record<string, unknown>>;
  generate: Array<Record<string, unknown>>;
  generateStatus: number;
}

const hub = {} as Hub;

function resetHub() {
  hub.points = POINTS.map((point) => ({ ...point, angles: [...(point.angles ?? [])] }));
  hub.chapters = CHAPTERS.map((chapter) => ({ ...chapter, key_points: [...chapter.key_points] }));
  hub.kpRows = {};
  hub.progressPosts = [];
  hub.generate = [];
  hub.generateStatus = 200;
}

function learnerRow(kpId: string): KpLearnerRow | null {
  const cell = hub.kpRows[kpId];
  if (!cell) return null;
  return {
    kp_id: kpId, status: cell.status as KpLearnerRow['status'], qualitative_passed: null,
    qualitative_note: '', assessed_by: '', assessed_at: null, learner_note: cell.note, updated_at: '',
  };
}

/** 门游标与计数一律读时派生（服务端同口径：第一个未掌握且未让位的条） */
function progressOut(): LearnProgress {
  const units = hub.points;
  const statusOf = (kpId: string) => hub.kpRows[kpId]?.status ?? '';
  const done = units.filter((unit) => statusOf(unit.kp_id) === 'done').length;
  const skipped = units.filter((unit) => statusOf(unit.kp_id) === 'skipped').length;
  const gate = units.find((unit) => !['done', 'skipped'].includes(statusOf(unit.kp_id)));
  const total = units.length;
  return {
    total, done, skipped,
    percent: total > 0 ? Math.round(((done + skipped) / total) * 100) : 0,
    current_unit_id: gate ? `kp:${gate.kp_id}` : null,
    completed: total > 0 && done + skipped === total,
    mastered: done,
    next_unit_id: gate ? `kp:${gate.kp_id}` : null,
    provenance: { system: 0, learner: done + skipped },
  };
}

function derivedOut(): LearnDerived {
  const base = progressOut();
  return {
    ...base,
    status: base.completed ? 'completed' : 'learning',
    books: [{
      ref_id: 'b07', label: '高等数学引论', total: base.total, done: base.done,
      skipped: base.skipped, percent: base.percent,
    }],
  };
}

function sequenceOut() {
  return {
    enrolled: true,
    units: hub.points.map((unit) => ({ ...unit, learner: learnerRow(unit.kp_id) })),
    chapters: hub.chapters,
    kp_path: [],
  };
}

const calls: string[] = [];

/** 句末带「。」：中栏连续流按§V2.4.2 只在未收尾时缝续段，夹具文本保持逐页独立便于断言 */
const pageText = (pageNo: number) => `第 ${pageNo} 页正文。`;

function routes() {
  calls.length = 0;
  resetHub();
  mockFetch.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.includes('/learn/star-map')) return jsonResponse(STAR);
    if (url.includes('/outline')) {
      return jsonResponse({ course_id: 'ma', book_ref: 'b07', outline: outlineRows() });
    }
    if (url.includes('/knowledge-points')) {
      if (url.includes('/narrative')) {
        return jsonResponse({ kp_id: 'p1', narrative_ref: '', available: false, reason: '这一条没有长文正文', content: '' });
      }
      return jsonResponse({
        course: { course_id: 'ma', name: '数学分析', track: '分析学', domain_id: 'math', description: '' },
        points: hub.points, total: hub.points.length, sequence: sequenceOut(),
      });
    }
    if (url.match(/\/learn\/courses\/[^/]+\/progress/)) {
      if (init?.method === 'POST') {
        hub.progressPosts.push({ kp_id: body.kp_id, status: body.status, note: body.note ?? null });
        // 撤销（pending 且没带备注）＝整行删除；pending 带备注＝留着备注
        if (body.status === 'pending' && !body.note) delete hub.kpRows[String(body.kp_id)];
        else {
          hub.kpRows[String(body.kp_id)] = {
            status: String(body.status),
            note: String(body.note ?? hub.kpRows[String(body.kp_id)]?.note ?? ''),
          };
        }
        return jsonResponse({ ...learnerRow(String(body.kp_id)), derived: progressOut() });
      }
      return jsonResponse(progressOut());
    }
    if (url.includes('/learn/annotations/generate')) {
      hub.generate.push(body);
      if (hub.generateStatus !== 200) {
        return jsonResponse({ detail: '这一条的正文还没准备好，暂时生成不了' }, hub.generateStatus);
      }
      const part = String(body.part);
      if (part === 'annotation') {
        const kpId = String(body.kp_id);
        hub.points = hub.points.map((unit) => {
          if (unit.kp_id !== kpId) return unit;
          const angles = [...(unit.angles ?? [])];
          const next: KpAngle = { angle: 'explanation', note: '本次生成的注解正文' };
          const at = angles.findIndex((item) => item.angle === next.angle);
          if (at >= 0) angles[at] = next;
          else angles.push(next);
          return { ...unit, angles };
        });
        const row = hub.points.find((unit) => unit.kp_id === kpId) ?? null;
        return jsonResponse({
          ok: true, target: { kind: 'point', kp_id: kpId, name: row?.name ?? '' }, point: row,
        });
      }
      const chapter = hub.chapters.find((row) => row.kp_id === body.kp_id);
      if (chapter) {
        if (part === 'summary') chapter.summary = `《${chapter.name}》本章总结`;
        else chapter.key_points = ['要点一', '要点二'];
      }
      return jsonResponse({
        ok: true, target: { kind: 'chapter', kp_id: body.kp_id, name: chapter?.name ?? '' },
        chapter: { kp_id: body.kp_id, summary: chapter?.summary ?? '', key_points: [...(chapter?.key_points ?? [])] },
      });
    }
    if (url.match(/\/learn\/kp-details/)) return jsonResponse({ detail: '候选池端点已退役' }, 404);
    if (url.endsWith('/learn/courses')) {
      return jsonResponse({
        courses: [{
          learn_course_id: 'ma', status: 'active', name: '数学分析',
          domain_id: 'math', track: '分析学', description: '',
          resources: [
            { kind: 'book', ref_id: 'b07', label: '高等数学引论' },
            { kind: 'book', ref_id: 'b01', label: '同课未激活' },
          ],
          kp_path: [], learner_note: '', created_at: '', updated_at: '',
          unit_count: hub.points.length, derived: derivedOut(),
        } as LearnCourse],
      });
    }
    if (url.includes('/api/v1/books')) {
      if (url.includes('/pages/')) {
        const pageNo = Number(url.match(/\/books\/[^/]+\/pages\/(\d+)/)?.[1]);
        if (pageNo === 25) return jsonResponse({ detail: '该页无解析产物' }, 404);
        return jsonResponse({
          page_no: pageNo, image_url: '', markdown: '',
          blocks: { page: pageNo, blocks: [{ type: 'paragraph', bbox: [0, 0, 10, 10], text: pageText(pageNo) }] },
        });
      }
      return jsonResponse(BOOKS);
    }
    return Promise.reject(new TypeError(`no route: ${url}`));
  });
}

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
}

function renderPage(path = '/learn/c/ma', width = 1600) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ConfigProvider theme={theme}>
        <Routes>
          <Route path="/learn/c/:courseId" element={<LearnWorkbench />} />
        </Routes>
        <LocationProbe />
      </ConfigProvider>
    </MemoryRouter>,
  );
}

/** 进面完成态：标题落定、首条知识点的正文已排开（窄屏下目录在侧滑里，故只等中栏） */
async function readyScreen(path = '/learn/c/ma', width = 1600) {
  renderPage(path, width);
  expect((await screen.findByTestId('workbench-title')).textContent).toBe('数学分析');
  await waitFor(() => expect(screen.getByTestId('body-title').textContent).toBe('实数的运算'));
}

/** 左栏点某一行（章或知识点） */
async function openRow(name: string) {
  const tree = await waitFor(() => {
    const node = document.querySelector(`[data-outline-name="${name}"]`);
    if (!node) throw new Error(`目录里还没有「${name}」`);
    return node.closest('[data-testid="outline-tree"]') as HTMLElement;
  });
  fireEvent.click(tree.querySelector(`[data-outline-name="${name}"]`) as Element);
}

async function pickPoint(kpId: string) {
  await openRow(pointTitleOf(kpId));
}

function pointTitleOf(kpId: string): string {
  return POINTS.find((unit) => unit.kp_id === kpId)?.title ?? '';
}

/**
 * 末尾「已掌握」那一枚：antd 在 `loading` 期间给按钮加 `disabled`，而 RTL 的 `getByRole` 默认
 * 排除 disabled 元素（loading 关得比 store 慢一帧），故按 testid 取并等它不再禁用；
 * 文案用 textContent 断言，含 `·` 的可及名精确匹配在 jsdom 里不稳。
 */
async function masterButton(label: string) {
  return waitFor(() => {
    const el = screen.getByTestId('advance-master');
    expect(el).not.toBeDisabled();
    expect(el.textContent).toContain(label);
    return el;
  });
}

async function scrollBodyToBottom() {
  const pane = screen.getByTestId('body-scroll');
  Object.defineProperty(pane, 'scrollHeight', { configurable: true, value: 1000 });
  Object.defineProperty(pane, 'clientHeight', { configurable: true, value: 300 });
  fireEvent.scroll(pane, { target: { scrollTop: 760 } });
}

describe('学习工作台 v1.0（章＋知识点逐步学习·右栏三段走主表＋末尾三枚写 kp 行）', { timeout: 30000 }, () => {
  beforeEach(() => {
    useLearnWorkbenchStore.setState(useLearnWorkbenchStore.getInitialState(), true);
    mockFetch.mockReset();
    routes();
  });

  it('页头落点＝导航右上角使用手册／刷新／返回（与其他面同序）、课程名右侧「返回书架」（C22＋C29 改判）', async () => {
    await readyScreen();
    const header = document.querySelector('.ant-layout-header') as HTMLElement;
    const navButtons = [...header.querySelectorAll('button')].map((node) => node.textContent);
    // C29：返回挪到右上角末位，导航最左不再有按钮（AppHeader 的 leading 槽已作废删除）
    expect(navButtons).toEqual(['使用手册', '刷新', '返回']);
    for (const node of header.querySelectorAll('button')) expect(node).toHaveStyle({ color: 'rgb(255, 255, 255)' });
    const heading = screen.getByTestId('workbench-heading');
    expect((heading.querySelector('[data-testid="workbench-title"]') as HTMLElement).textContent).toBe('数学分析');
    expect([...heading.querySelectorAll('button')].map((node) => node.textContent)).toEqual(['返回书架']);
    fireEvent.click(screen.getByRole('button', { name: /返回书架/ }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/learn'));
  });

  it('右上角「返回」回根页面 `#/`（C29：与书架／知识探索／练习三面同位）', async () => {
    await readyScreen();
    fireEvent.click(screen.getByRole('button', { name: /返回$/ }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'));
  });

  it('标题只写课程正式名称：无「· 学习工作台」后缀、全页不显示学习进度', async () => {
    await readyScreen();
    const heading = (screen.getByTestId('workbench-heading').textContent ?? '').replace('返回书架', '');
    expect(heading).toBe('数学分析');
    expect(heading).not.toContain('学习工作台');
    expect(document.body.textContent).not.toContain('学习进度');
    expect(document.body.textContent).not.toMatch(/已学 \d+\/\d+/);
  });

  it('workbenchTitleOf：名称只来自共享课程行（R5 引用不复制）；没有课程行给空串', () => {
    expect(workbenchTitleOf({ learn_course_id: 'ma', name: '数学分析' } as LearnCourse)).toBe('数学分析');
    expect(workbenchTitleOf(null)).toBe('');
  });

  it('左栏两级＝章 → 知识点：节层不显形，栏头没有「修改目录」', async () => {
    await readyScreen();
    const tree = await screen.findByTestId('outline-tree');
    expect([...tree.querySelectorAll('[data-outline-name]')]
      .map((node) => node.getAttribute('data-outline-name')))
      .toEqual(['第1章 实数', '实数的运算', '绝对值', '第2章 完备性', '确界原理']);
    expect(screen.queryByRole('button', { name: /修改目录/ })).toBeNull();
  });

  it('目录只列名称与「已学」：四类当前情况说明一律不显（C23）', async () => {
    hub.points = hub.points.filter((unit) => unit.kp_id !== 'p3');
    await readyScreen();
    const tree = await screen.findByTestId('outline-tree');
    for (const phrase of ['还在整理', '正在为您整理', '暂时没整理好', '还没有可读的教材']) {
      expect(tree.textContent ?? '', `目录不该出现「${phrase}」`).not.toContain(phrase);
    }
    expect([...tree.querySelectorAll('[data-outline-name]')]
      .map((node) => node.getAttribute('data-outline-name')))
      .toEqual(['第1章 实数', '实数的运算', '绝对值', '第2章 完备性']);
    useLearnWorkbenchStore.setState({ tocPhase: { b07: 'generating' } });
    expect((await screen.findByTestId('outline-tree')).textContent ?? '').not.toContain('正在为您整理');
    useLearnWorkbenchStore.setState({ tocPhase: { b07: 'failed' } });
    expect((await screen.findByTestId('outline-tree')).textContent ?? '').not.toContain('暂时没整理好');
  });

  it('目录两档左缘：章行互相对齐、知识点缩进一档后互相对齐，且都真左对齐（C24／DEFECT-016）', async () => {
    expect(OUTLINE_INDENT_PX).toBe(14);
    const chapter = outlineRowStyle('chapter');
    const point = outlineRowStyle('point');
    expect(chapter.paddingLeft).toBe(8);
    expect(point.paddingLeft).toBe(8 + OUTLINE_INDENT_PX);
    for (const style of [chapter, point]) {
      expect(style.justifyContent).toBe('flex-start');
      expect(style.textAlign).toBe('left');
    }
    await readyScreen();
    const rows = [...(await screen.findByTestId('outline-tree')).querySelectorAll('[data-outline-name]')] as HTMLElement[];
    const edgeOf = (node: HTMLElement) => (node.getAttribute('style') ?? '').match(/padding-left:\s*(\d+)px/)?.[1];
    const byLevel = (level: string) => rows.filter((node) => node.dataset.outlineLevel === level).map(edgeOf);
    expect(new Set(byLevel('chapter'))).toEqual(new Set(['8']));
    expect(new Set(byLevel('point'))).toEqual(new Set(['22']));
    for (const node of rows) expect(node.getAttribute('style') ?? '').toContain('justify-content: flex-start');
  });

  it('中栏无页码口径：标题＝该条名，正文连续排开且没有续取按钮', async () => {
    await readyScreen();
    expect(screen.getByTestId('body-title').textContent).toBe('实数的运算');
    expect(await screen.findByText(pageText(5))).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('正文 · 第');
    expect(screen.queryByRole('button', { name: /继续加载/ })).toBeNull();
  });

  it('这一条的摘要直排在中栏标题下、正文之前', async () => {
    await readyScreen();
    const body = screen.getByTestId('body-pane');
    const summaryIndex = (body.textContent ?? '').indexOf('有序域的三条运算律');
    expect(summaryIndex).toBeGreaterThanOrEqual(0);
    expect(summaryIndex).toBeLessThan((body.textContent ?? '').indexOf(pageText(5)));
  });

  it('滚动到底自动续取下一批，读到尽头给「点下一条接着学」', async () => {
    await readyScreen();
    await pickPoint('p3');
    expect(await screen.findByText(pageText(21))).toBeInTheDocument();
    expect(screen.queryByText(pageText(29))).toBeNull();
    await scrollBodyToBottom();
    expect(await screen.findByText(pageText(29))).toBeInTheDocument();
    expect(await screen.findByText('这一条读完了：点「下一条」接着学。')).toBeInTheDocument();
  });

  it('缺产物的那一页单独给空态，其余页照常排版', async () => {
    await readyScreen();
    await pickPoint('p3');
    expect(await screen.findByText('第 25 页：正文还没准备好')).toBeInTheDocument();
    expect(screen.getByText(pageText(24))).toBeInTheDocument();
    expect(screen.getByText(pageText(26))).toBeInTheDocument();
  });

  it('右栏标题＝学习交流，三段顺序＝本章总结与学习要点 → 详解 → 备注；推进不在右栏（C25~C28 改判）', async () => {
    await readyScreen();
    expect(screen.getByText('学习交流')).toBeInTheDocument();
    const text = screen.getByTestId('annotation-pane').textContent ?? '';
    const marks = ['本章总结', '学习要点', '详解', '备注'].map((label) => text.indexOf(label));
    expect(marks.every((index) => index >= 0), text).toBe(true);
    expect(marks).toEqual([...marks].sort((a, b) => a - b));
    for (const gone of ['推进', '上一条', '下一条', '批注', '点赞', '待整理', '已保留', '本条通用', '这一块']) {
      expect(text, `右栏不该再有「${gone}」`).not.toContain(gone);
    }
  });

  it('章级两件齐备时进场直读，不再出「生成」入口', async () => {
    await readyScreen();
    await pickPoint('p3');
    expect(await screen.findByText('本章把完备性分成三条等价表述')).toBeInTheDocument();
    expect(screen.getByText('单调有界原理')).toBeInTheDocument();
    expect(screen.getByText('闭区间套定理')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /生成本章/ })).toBeNull();
  });

  it('章级缺位时出「生成本章总结与学习要点」，点了写进章行并重排右栏', async () => {
    await readyScreen();
    fireEvent.click(await screen.findByRole('button', { name: /生成本章总结与学习要点/ }));
    await waitFor(() => expect(hub.generate.map((row) => row.part)).toEqual(['summary', 'key_points']));
    expect(await screen.findByText('《第1章 实数》本章总结')).toBeInTheDocument();
    expect(screen.getByText('要点一')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /生成本章总结与学习要点/ })).toBeNull();
  });

  it('详解段零内容时空态给下一步，生成的一条按 angles 追加即直读（不再有候选池状态）', async () => {
    await readyScreen();
    expect(await screen.findByText('这一条还没有注解：点「生成本条注解」先来一条。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /生成本条注解/ }));
    await waitFor(() => expect(hub.generate.at(-1)).toMatchObject({ target_kind: 'point', kp_id: 'p1', part: 'annotation' }));
    const card = await screen.findByTestId('annotation-explanation');
    expect(card.textContent).toContain('本次生成的注解正文');
    expect(card.textContent).not.toContain('待整理');
    expect(calls.some((c) => c.includes('/kp-details'))).toBe(false);
  });

  it('条级已有注解时按 angles 数组序直读，只读面没有点赞／确认入口（保留位随候选池退出）', async () => {
    hub.points = hub.points.map((unit) => (unit.kp_id === 'p1'
      ? { ...unit, angles: [{ angle: 'summary', note: '这一条的总结' }, { angle: 'explanation', note: '这一条的注解' }] }
      : unit));
    await readyScreen();
    const list = await screen.findByTestId('detail-list');
    expect([...list.querySelectorAll('[data-testid^="annotation-"]')]
      .map((node) => node.getAttribute('data-testid')))
      .toEqual(['annotation-summary', 'annotation-explanation']);
    expect(list.textContent).toContain('这一条的总结');
    for (const label of ['点赞', '确认入库', '驳回']) expect(screen.queryByRole('button', { name: new RegExp(label) })).toBeNull();
  });

  it('备注写 kp 行的 learner_note：进场直读、保存只发 kp_id＋状态＋备注（C26）', async () => {
    hub.kpRows.p1 = { status: 'pending', note: '' };
    await readyScreen();
    fireEvent.change(screen.getByLabelText('备注正文'), { target: { value: '上确界是最小的那个上界' } });
    fireEvent.click(screen.getByRole('button', { name: '保存备注' }));
    await waitFor(() => expect(hub.progressPosts.at(-1)).toEqual({ kp_id: 'p1', status: 'pending', note: '上确界是最小的那个上界' }));
    expect(await screen.findByTestId('note-list')).toHaveTextContent('上确界是最小的那个上界');
    expect(calls.some((c) => c.includes('/kp-details'))).toBe(false);
  });

  it('这一条还没有学习记录时备注存不下：给出下一步话术且不发请求', async () => {
    await readyScreen();
    expect(screen.getByText('这一条还没有学习记录：先用正文末尾记上位置，备注就存得下了。')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('备注正文'), { target: { value: '先记一句' } });
    expect(screen.getByRole('button', { name: '保存备注' })).toBeDisabled();
    expect(calls.filter((c) => c.startsWith('POST'))).toEqual([]);
  });

  it('正文末尾三枚＝上一条／下一条／已掌握并下一条，写 kp_id 终态位并回显左栏「已学」（C25）', async () => {
    await readyScreen();
    const bar = screen.getByTestId('advance-bar');
    expect([...bar.querySelectorAll('button')].map((node) => node.textContent))
      .toEqual(['上一条', '下一条', '已掌握并下一条']);
    expect(screen.getByTestId('body-pane').contains(bar)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '下一条' }));
    await waitFor(() => expect(screen.getByTestId('body-title').textContent).toBe('绝对值'));
    fireEvent.click(await masterButton('已掌握并下一条'));
    await waitFor(() => expect(hub.progressPosts).toEqual([{ kp_id: 'p2', status: 'done', note: null }]));
    await waitFor(() => expect(screen.getByTestId('body-title').textContent).toBe('确界原理'));
    expect((await screen.findByTestId('outline-tree')).textContent).toContain('已学');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('已掌握并下一条走到最后一条时不越界，末尾给明确话术', async () => {
    await readyScreen();
    await pickPoint('p3');
    fireEvent.click(await masterButton('已掌握并下一条'));
    await waitFor(() => expect(hub.progressPosts).toHaveLength(1));
    expect(await screen.findByTestId('advance-notice')).toHaveTextContent('已经到本课最后一条');
    expect(screen.getByTestId('body-title').textContent).toBe('确界原理');
  });

  it('同一条上再点「已掌握」＝撤销，左栏「已学」跟着消失', async () => {
    await readyScreen();
    fireEvent.click(await masterButton('已掌握并下一条'));
    await waitFor(() => expect(hub.progressPosts).toHaveLength(1));
    await pickPoint('p1');
    fireEvent.click(await masterButton('点一下撤销'));
    await waitFor(() => expect(hub.progressPosts.at(-1)).toEqual({ kp_id: 'p1', status: 'pending', note: null }));
    await waitFor(() => expect((screen.getByTestId('outline-tree').textContent ?? '')).not.toContain('已学'));
  });

  it('全部推完出「已结课」，撤销那一枚后消失', async () => {
    await readyScreen();
    fireEvent.click(await masterButton('已掌握并下一条'));
    await waitFor(() => expect(screen.getByTestId('body-title').textContent).toBe('绝对值'));
    fireEvent.click(await masterButton('已掌握并下一条'));
    await waitFor(() => expect(screen.getByTestId('body-title').textContent).toBe('确界原理'));
    fireEvent.click(await masterButton('已掌握并下一条'));
    expect(await screen.findByText('已结课')).toBeInTheDocument();
    fireEvent.click(await masterButton('点一下撤销'));
    await waitFor(() => expect(screen.queryByText('已结课')).not.toBeInTheDocument());
  });

  it('提问入口只展示不联通：输入不禁用、发送置灰并注明暂未开放，零请求（C28）', async () => {
    await readyScreen();
    const input = await screen.findByLabelText('提问');
    fireEvent.change(input, { target: { value: '为什么上确界最小？' } });
    const send = screen.getByRole('button', { name: /发\s*送/ });
    expect(send).toBeDisabled();
    expect(screen.getByText('提问功能暂未开放')).toBeInTheDocument();
    expect(calls.filter((c) => c.startsWith('POST'))).toEqual([]);
  });

  it('整章阅读：点零知识点的章行走整章范围，并明确记不上进度', async () => {
    hub.points = hub.points.filter((unit) => unit.kp_id !== 'p3');
    await readyScreen();
    expect((await screen.findByTestId('outline-tree')).textContent).not.toContain('这一章的知识点还在整理');
    await openRow('第2章 完备性');
    expect(await screen.findByText('正文按整章呈现')).toBeInTheDocument();
    fireEvent.click(await masterButton('已掌握并下一条'));
    await waitFor(() => expect(hub.progressPosts).toHaveLength(0));
    expect(await screen.findByText('整章阅读记不进进度：这一章的知识点整理好后才能逐条推进。')).toBeInTheDocument();
  });

  it('知识点没定位到书页时中栏给下一步，不空白', async () => {
    await readyScreen();
    hub.points = hub.points.map((unit) => (unit.kp_id === 'p2' ? { ...unit, source_ref: null, window_source: '' } : unit));
    await useLearnWorkbenchStore.getState().reloadPoints();
    await useLearnWorkbenchStore.getState().selectPoint('p2');
    expect(await screen.findByText(/这一条还没有定位到书页/)).toBeInTheDocument();
    expect(screen.queryByText(pageText(10))).toBeNull();
  });

  it('未登记学习课程：目录与正文照常可读、进度记不上并给下一步', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/learn/star-map')) return jsonResponse(STAR);
      if (url.includes('/outline')) return jsonResponse({ course_id: 'ma', book_ref: 'b07', outline: outlineRows() });
      if (url.includes('/learn/courses')) return jsonResponse({ courses: [] });
      if (url.includes('/api/v1/books')) {
        if (url.includes('/pages/')) {
          const pageNo = Number(url.match(/\/books\/[^/]+\/pages\/(\d+)/)?.[1]);
          return jsonResponse({
            page_no: pageNo, image_url: '', markdown: '',
            blocks: { page: pageNo, blocks: [{ type: 'paragraph', bbox: [0, 0, 10, 10], text: pageText(pageNo) }] },
          });
        }
        return jsonResponse(BOOKS);
      }
      return Promise.reject(new TypeError(`no route: ${url}`));
    });
    renderPage('/learn/c/ma');
    expect(await screen.findByText(/不在您的书架上，进度暂时记不上/)).toBeInTheDocument();
    expect((await screen.findByTestId('outline-tree')).textContent).toContain('第1章 实数');
  });

  it('8900 不可达时三栏各自降级、页头「刷新」可重试，不白屏', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });
    mockFetch.mockImplementation(() => jsonResponse({ detail: '无法连接' }, 503));
    renderPage();
    expect(await screen.findByText('工作台数据不可达')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /刷\s*新/ })).toBeInTheDocument();
    expect(screen.getByText('目录')).toBeInTheDocument();
    expect(screen.getByText('学习交流')).toBeInTheDocument();
  });

  it('断点回归：进场落在第一个没记过的条（门游标读时派生）', async () => {
    hub.kpRows.p1 = { status: 'done', note: '' };
    renderPage();
    expect((await screen.findByTestId('workbench-title')).textContent).toBe('数学分析');
    await waitFor(() => expect(screen.getByTestId('body-title').textContent).toBe('绝对值'));
  });

  it('窄屏收栏：目录与学习交流改侧滑，正文独占宽度且末尾三枚始终在正文里', async () => {
    await readyScreen('/learn/c/ma', 860);
    expect(screen.queryByText('推进与批注')).toBeNull();
    expect(screen.getByTestId('advance-bar')).toBeVisible();
    fireEvent.click(await screen.findByRole('button', { name: /打开目录/ }));
    expect(await screen.findByRole('button', { name: '第1章 实数' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /打开学习交流/ }));
    expect(await screen.findByText('详解')).toBeVisible();
    expect(screen.getByText('备注')).toBeVisible();
  });

  it('workbenchModeFor 断点不动：≥1400 三栏／1000~1400 右栏侧滑／<1000 两栏侧滑', () => {
    expect(workbenchModeFor(1600)).toBe('three');
    expect(workbenchModeFor(1400)).toBe('three');
    expect(workbenchModeFor(1399)).toBe('side');
    expect(workbenchModeFor(1000)).toBe('side');
    expect(workbenchModeFor(999)).toBe('single');
  });

  it('右栏零 Tabs、零练习组件：不请求题源与到期队列', async () => {
    await readyScreen();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(calls.some((c) => c.includes('/learn/questions'))).toBe(false);
    expect(calls.some((c) => c.includes('/learn/review/due'))).toBe(false);
  });

  it('使用手册直落课程学习册，课程名右侧「返回书架」回 `#/learn`', async () => {
    await readyScreen();
    fireEvent.click(screen.getByRole('button', { name: /使用手册/ }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/章下就是您要逐条读完的知识点/)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /返回书架/ }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/learn'));
  });

});
