import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import LearnWorkbench from './LearnWorkbench';
import { theme } from '../theme';
import { mockFetch } from '../test/setup';
import { useLearnWorkbenchStore } from '../stores/learnWorkbench';
import { PAGE_BATCH } from '../stores/learnWorkbench';
import { usePracticeStore } from '../stores/practice';
import type { KpDetailRow } from '../api/learn';

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

/** b01 未激活解析版本、b09 属别课 ⇒ 只有 b05 可选 */
const BOOKS = [
  { book_id: 'b05', title: '数学分析原理', page_count: 317, course_id: 'ma', active_job_id: 'job-1' },
  { book_id: 'b01', title: '同课未激活', page_count: 100, course_id: 'ma', active_job_id: null },
  { book_id: 'b09', title: '别课的书', page_count: 50, course_id: 'cs', active_job_id: 'job-9' },
];

const CHAPTER = {
  kp_id: 'kp-c1', course_id: 'ma', node_kind: 'outline', name: '第1章 实数系和复数系',
  depth: 1, parent_kp_id: null, book_ref: 'b05', point_count: 2,
  source_ref: { kind: 'book', ref_id: 'b05', page_start: 7, page_end: 26 },
};
const SECTION = {
  kp_id: 'kp-s1', course_id: 'ma', node_kind: 'outline', name: '有序集',
  depth: 2, parent_kp_id: 'kp-c1', book_ref: 'b05', point_count: 1,
  source_ref: { kind: 'book', ref_id: 'b05', page_start: 8, page_end: 9 },
};
/** 人工补录前的 outline 行：没有页范围＝中栏给明确空态 */
const SECTION_NO_RANGE = { ...SECTION, kp_id: 'kp-s2', name: '域', source_ref: null };

const OUTLINE = { course_id: 'ma', book_ref: 'b05', outline: [CHAPTER, SECTION, SECTION_NO_RANGE] };
const EMPTY_OUTLINE = { course_id: 'ma', book_ref: 'b05', outline: [] };

const POOL = {
  details: [{
    detail_id: 'd1', course_id: 'ma', name: '确界原理', norm_key: '确界原理', type: 'concept',
    narrative: '非空有上界的实数集必有上确界', payload: {}, anchors: [], gen_batch: 'learn-workbench',
    model_ref: '', gen_status: 'candidate', kp_id: null, dedup_of: null, map_seed: null,
    parent_kp_id: 'kp-c1', intent: 'summary', book_ref: 'b05',
    domain_id: 'math', domain_label: '数学', course_label: '数学分析', confirmed: 0,
    created_at: '', updated_at: '',
  } satisfies KpDetailRow],
  total: 1,
};

/** 题源书（练习区）：只有带 roles **且** 已解析出页产物的书可选 */
const QUESTION_BOOKS = {
  course_id: 'ma',
  books: [
    { book_id: 'b07', title: '数学习题集', roles: ['exercises'], course_id: 'ma', parse_status: 'pending', page_count: 200, parsed_pages: 200 },
    { book_id: 'b09', title: '无角色书', roles: [], course_id: 'ma', parse_status: 'pending', page_count: 50, parsed_pages: 50 },
    { book_id: 'b10', title: '未解析习题集', roles: ['exercises'], course_id: 'ma', parse_status: 'pending', page_count: 439, parsed_pages: 0 },
  ],
};
const QUESTION_ROW = {
  question_id: 'q-1', course_id: 'ma', kind: 'quiz', question_type: 'short',
  stem: '叙述确界原理', options: null, answer_back: '', difficulty: 'medium',
  kp_type: 'concept', kp_id: 'kp-c1', source_kind: 'exercise_book', book_ref: 'b07',
  source_ref: null, answer_source: 'solution_section', gen_batch: 'workbench-extract',
  model_ref: '', meta: {}, retired: false, created_at: '', updated_at: '',
};
const DUE = { course_id: 'ma', tasks: [], total_due: 3 };
const MISTAKES = {
  items: [], total: 0, stats: { total: 0, wrong: 0, unresolved: 0, bookmarked: 0, due_today: 0 },
};

/** 目录页实测形态：一个 paragraph 块内含多行（b05 p7；p8 是续列，文本不同） */
const TOC_BLOCK_TEXT = [
  '目录',
  '第1章 实数系和复数系…… 1',
  '导引 …… 1',
  '有序集 …… 2',
  '第2章 基础拓扑 …… 21',
  '附录 …… 15',
  '习题 …… 18',
].join('\n');
const TOC_BLOCK_TEXT_P8 = [
  'VII',
  '第3章 微分学 …… 25',
  '偏导数 …… 26',
  '高阶微分 …… 30',
].join('\n');

function pageBody(pageNo: number) {
  return {
    page_no: pageNo,
    image_url: `http://127.0.0.1:8900/api/v1/books/b05/pages/${pageNo}/image`,
    markdown: '',
    blocks: { page: pageNo, blocks: [{ type: 'paragraph', bbox: [0, 0, 10, 10], text: `第 ${pageNo} 页正文` }] },
  };
}

const hub = { outlineEmpty: true, tocMode: false };
const calls: string[] = [];
let putBody: Record<string, unknown> | null = null;

function routes() {
  calls.length = 0;
  putBody = null;
  hub.outlineEmpty = true;
  hub.tocMode = false;
  mockFetch.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('/learn/star-map')) return jsonResponse(STAR);
    if (url.includes('/learn/question-books')) return jsonResponse(QUESTION_BOOKS);
    if (url.includes('/learn/review/due')) return jsonResponse(DUE);
    if (url.includes('/learn/mistakes')) return jsonResponse(MISTAKES);
    if (url.includes('/learn/questions')) return jsonResponse({ questions: [QUESTION_ROW], total: 1 });
    if (url.includes('/outline')) {
      if (init?.method === 'PUT') {
        putBody = JSON.parse(String(init.body));
        hub.outlineEmpty = false;
        return jsonResponse(OUTLINE);
      }
      return jsonResponse(hub.outlineEmpty ? EMPTY_OUTLINE : OUTLINE);
    }
    if (url.includes('/learn/kp-details')) return jsonResponse(POOL);
    if (url.includes('/pages/')) {
      const pageNo = Number(url.match(/\/pages\/(\d+)/)?.[1]);
      if (pageNo === 26) return jsonResponse({ detail: '该页无解析产物' }, 404);
      if (hub.tocMode && (pageNo === 7 || pageNo === 8)) {
        return jsonResponse({
          page_no: pageNo, image_url: '', markdown: '',
          blocks: {
            page: pageNo,
            blocks: [{ type: 'paragraph', bbox: [0, 0, 10, 10], text: pageNo === 7 ? TOC_BLOCK_TEXT : TOC_BLOCK_TEXT_P8 }],
          },
        });
      }
      if (hub.tocMode && pageNo === 9) {
        // 偏移试算夹具：印刷页 1 的章题出现在 PDF 页 9
        return jsonResponse({
          page_no: pageNo, image_url: '', markdown: '',
          blocks: { page: pageNo, blocks: [{ type: 'heading', bbox: [0, 0, 10, 10], text: '第1章 实数系和复数系' }] },
        });
      }
      return jsonResponse(pageBody(pageNo));
    }
    if (url.includes('/api/v1/books')) return jsonResponse(BOOKS);
    return Promise.reject(new TypeError(`no route: ${url}`));
  });
}

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
}

function renderPage(path = '/learn/c/ma') {
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

async function pickBook() {
  fireEvent.mouseDown(await screen.findByRole('combobox', { name: '书籍' }));
  fireEvent.click(await screen.findByText('数学分析原理'));
}

async function openChapter() {
  await pickBook();
  fireEvent.click(await screen.findByRole('button', { name: /第1章 实数系和复数系/ }));
}

describe('三栏学习工作台 LearnWorkbench（M6：目录 / 正文 / 批注）', { timeout: 20000 }, () => {
  beforeEach(() => {
    useLearnWorkbenchStore.setState({
      courseId: null, course: null, bookId: null, book: null, books: [], outline: [],
      selectedKpId: null, range: null, pages: {}, loadedThrough: 0, selectedBlock: null,
      candidates: [], loading: false, error: null, notice: null,
    });
    mockFetch.mockReset();
    routes();
    usePracticeStore.setState({
      courseId: null, kpId: null, sourceBooks: [], sourceBookId: null, answerBookId: null,
      range: null, answerRange: null, extracting: false, drafts: [], unrecognized: [],
      extractNotices: [], questions: [], dueTasks: [], mistakes: [], mistakeStats: null,
      lastResult: null, loading: false, error: null, notice: null, courseDueCounts: {},
    });
  });

  it('三栏齐备：书列表只含已激活解析版本的本课书，未选章时中栏给空态', async () => {
    renderPage();
    expect(await screen.findByText('数学分析 · 学习工作台')).toBeInTheDocument();
    expect(screen.getByText('目录')).toBeInTheDocument();
    expect(screen.getByText('批注与候选')).toBeInTheDocument();
    expect(screen.getByText('这本书还没有章节目录：点「导入目录」从目录页解析后人工确认。')).toBeInTheDocument();
    expect(screen.getByText('先在左栏选书并选中一章/一节')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /导入目录/ })).toBeDisabled();
    await pickBook();
    expect(screen.getByRole('button', { name: /导入目录/ })).toBeEnabled();
  });

  it('选章后中栏按 source_ref 逐页排版并首批懒取 8 页，页头标 PDF 页序', async () => {
    hub.outlineEmpty = false;
    renderPage();
    await openChapter();
    expect(await screen.findByText('正文 · 第 7–26 页')).toBeInTheDocument();
    expect(await screen.findByText('第 7 页正文')).toBeInTheDocument();
    expect(screen.getByText('第 14 页正文')).toBeInTheDocument();
    expect(screen.queryByText(`第 ${7 + PAGE_BATCH} 页正文`)).not.toBeInTheDocument();
    expect(calls.filter((c) => c.includes('/pages/'))).toHaveLength(PAGE_BATCH);
    expect(screen.getByRole('button', { name: /继续加载 8 页/ })).toBeInTheDocument();
    expect(screen.getByText('在中栏点选一个内容块作为锚点（不选＝无锚点登记）')).toBeInTheDocument();
  });

  it('继续加载推进批次，缺解析产物的页按空态展示而非报错', async () => {
    hub.outlineEmpty = false;
    renderPage();
    await openChapter();
    expect(await screen.findByText('第 14 页正文')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /继续加载 8 页/ }));
    expect(await screen.findByText('第 22 页正文')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /继续加载 4 页/ }));
    expect(await screen.findByText('第 26 页：无解析产物')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /继续加载/ })).not.toBeInTheDocument();
  });

  it('outline 行缺 source_ref 时中栏提示补录，不误请求页面', async () => {
    hub.outlineEmpty = false;
    renderPage();
    await pickBook();
    const before = calls.filter((c) => c.includes('/pages/')).length;
    fireEvent.click(await screen.findByRole('button', { name: /^域/ }));
    expect(await screen.findByText('该章节没有页范围（source_ref 缺失），请在管理面补录')).toBeInTheDocument();
    expect(calls.filter((c) => c.includes('/pages/'))).toHaveLength(before);
  });

  it('点中栏内容块 → 右栏锚点提示带页与片段，填名后可保留为候选', async () => {
    hub.outlineEmpty = false;
    renderPage();
    await openChapter();
    const firstBlock = (await screen.findAllByRole('button', { name: /^块 1（/ }))[0] as HTMLElement;
    fireEvent.click(firstBlock);
    expect(await screen.findByText('锚点＝第 7 页：第 7 页正文')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('知识点名'), { target: { value: '确界原理' } });
    fireEvent.change(screen.getByLabelText('批注正文'), { target: { value: '非空有上界的实数集必有上确界' } });
    fireEvent.click(screen.getByRole('button', { name: '保留为候选' }));
    await waitFor(() =>
      expect(calls.some((c) => c.startsWith('POST ') && c.includes('/learn/kp-details'))).toBe(true),
    );
    expect(await screen.findByText('本章候选（1）')).toBeInTheDocument();
    expect(screen.getByText('确界原理')).toBeInTheDocument();
  });

  it('导入目录：读目录页 → 解析预览与未识别行 → 确认写入 PUT 并刷新左栏', async () => {
    renderPage();
    await pickBook();
    fireEvent.click(screen.getByRole('button', { name: /导入目录/ }));
    fireEvent.change(screen.getByLabelText('目录起页'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('目录止页'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('正文起页'), { target: { value: '9' } });
    hub.tocMode = true;
    fireEvent.click(screen.getByRole('button', { name: /读取目录页/ }));

    expect(await screen.findByText('未识别 2 行')).toBeInTheDocument();
    expect(screen.getAllByText('设计内剔除')).toHaveLength(2);
    // 偏移由正文样本页试算：印刷页 1 出现在 PDF 页 9 ⇒ 章 1＝9–28，章 2＝29–317
    expect(screen.getByText('9–28')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认写入' }));
    await waitFor(() => expect(putBody).not.toBeNull());
    const body = putBody as unknown as { book_ref: string; tree: Array<{ name: string; page_start: number; page_end: number }> };
    expect(body.book_ref).toBe('b05');
    expect(body.tree).toHaveLength(3);
    expect(body.tree[0]).toMatchObject({ name: '第1章 实数系和复数系', page_start: 9, page_end: 28 });
    expect(body.tree[1]).toMatchObject({ name: '第2章 基础拓扑', page_start: 29, page_end: 32 });
    expect(body.tree[2]).toMatchObject({ name: '第3章 微分学', page_start: 33, page_end: 317 });
    expect(await screen.findByRole('button', { name: /第1章 实数系和复数系/ })).toBeInTheDocument();
  });

  it('8900 不可达时给出降级提示与重试，不白屏', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ detail: '无法连接服务' }, 503));
    renderPage();
    expect(await screen.findByText('工作台数据不可达')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重\s*试/ })).toBeInTheDocument();
    expect(screen.getByText('批注与候选')).toBeInTheDocument();
  });

  it('返回星图回到 #/knowledge', async () => {
    renderPage();
    await screen.findByText('数学分析 · 学习工作台');
    fireEvent.click(screen.getByRole('button', { name: /返回星图/ }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/knowledge'));
  });

  it('选章后中栏正文下方出现练习区：本章题卡按题面投影渲染，题源书只列带角色且已解析的书', async () => {
    hub.outlineEmpty = false;
    renderPage();
    await openChapter();
    expect(await screen.findByText('练习')).toBeInTheDocument();
    expect(await screen.findByText('叙述确界原理')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '题源书' }));
    expect(await screen.findByText('数学习题集（exercises）')).toBeInTheDocument();
    expect(screen.queryByText('无角色书（无角色）')).not.toBeInTheDocument();
    expect(screen.queryByText('未解析习题集（exercises）')).not.toBeInTheDocument();
  });

  it('右栏页签切到「本章练习」：到期复习与错题本按本章口径给计数与空态', async () => {
    hub.outlineEmpty = false;
    renderPage();
    await openChapter();
    fireEvent.click(screen.getByRole('tab', { name: '本章练习' }));
    expect(await screen.findByText('到期 0／错题 0 未解决（共 0）')).toBeInTheDocument();
    expect(screen.getByText('到期复习（0）')).toBeInTheDocument();
    expect(screen.getByText('错题本（0）')).toBeInTheDocument();
    expect(screen.getByText('本章没有到期项')).toBeInTheDocument();
  });
});
