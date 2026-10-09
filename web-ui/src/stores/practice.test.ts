/**
 * 练习域 store 单测（M2 Batch B：题源抽取 → 人工确认入库 → 作答判分 → 复习/错题）。
 * 夹具只走 mock fetch，不连 8900、不读真实数据根。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mockFetch } from '../test/setup';
import { usePracticeStore } from './practice';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

/** 题源书目：教材 / 习题集 / 题解书各一本，外加一本无 roles、一本未解析的（前端各兜一层过滤掉） */
const QUESTION_BOOKS = {
  course_id: 'ma',
  books: [
    { book_id: 'b05', title: '数学分析（教材）', roles: ['textbook'], course_id: 'ma', parse_status: 'pending', page_count: 317, parsed_pages: 317 },
    { book_id: 'b07', title: '吉米多维奇习题选', roles: ['exercises'], course_id: 'ma', parse_status: 'pending', page_count: 400, parsed_pages: 400 },
    { book_id: 'b08', title: '题解书', roles: ['solutions'], course_id: 'ma', parse_status: 'pending', page_count: 200, parsed_pages: 200 },
    { book_id: 'b09', title: '无 roles 的书', roles: [], course_id: 'ma', parse_status: '', page_count: 0, parsed_pages: 0 },
    { book_id: 'b10', title: '未解析的习题集', roles: ['exercises'], course_id: 'ma', parse_status: 'pending', page_count: 439, parsed_pages: 0 },
  ],
};

const PAGE_12 = {
  page_no: 12,
  image_url: '',
  markdown: '',
  blocks: {
    page: 12,
    blocks: [
      { type: 'paragraph', bbox: [0, 0, 10, 10], text: '1、求极限 lim(x→0) sin x / x（A．1 B．0 C．不存在 D．∞）。' },
      { type: 'paragraph', bbox: [0, 0, 10, 10], text: '2、叙述确界原理。' },
    ],
  },
};

const PAGE_13 = {
  page_no: 13,
  image_url: '',
  markdown: '',
  blocks: {
    page: 13,
    blocks: [
      { type: 'paragraph', bbox: [0, 0, 10, 10], text: '3、计算不定积分。' },
      { type: 'paragraph', bbox: [0, 0, 10, 10], text: '答案与提示' },
      { type: 'paragraph', bbox: [0, 0, 10, 10], text: '1、解：B。' },
      { type: 'paragraph', bbox: [0, 0, 10, 10], text: '3、解答：因为该极限存在且唯一，所以所求值为该上确界。' },
    ],
  },
};

const PAGE_SOLUTION_12 = {
  page_no: 12,
  image_url: '',
  markdown: '',
  blocks: {
    page: 12,
    blocks: [{ type: 'paragraph', bbox: [0, 0, 10, 10], text: '2、解答：非空有上界的实数集必有上确界' }],
  },
};

const QUESTION_ROW = {
  question_id: 'q-1', course_id: 'ma', kind: 'quiz', question_type: 'choice',
  stem: '求极限 lim(x→0) sin x / x', options: null, answer_back: '', difficulty: 'medium',
  kp_type: 'memory', kp_id: 'kp-c1', source_kind: 'exercise_book', book_ref: 'b07',
  source_ref: null, answer_source: 'solution_section', gen_batch: 'workbench-extract', model_ref: '',
  meta: {}, retired: false, created_at: '', updated_at: '',
};

const ATTEMPT_RESULT = {
  attempt_id: 7, question_id: 'q-1', is_correct: false, method: 'rule', judge_note: '关键词未命中',
  score_trend: 'new', resolved: false, answered_at: '2026-10-05T00:00:00',
  expected_answer: 'B', explanation: '夹逼准则', review: {
    target_kind: 'question', target_id: 'q-1', course_id: 'ma', kp_type: 'memory',
    interval_index: 0, due_at: '2026-10-06T00:00:00', next_due_at: '2026-10-06T00:00:00',
  },
};

const DUE = {
  course_id: 'ma',
  tasks: [
    {
      target_kind: 'question', target_id: 'q-1', course_id: 'ma', kp_type: 'memory',
      interval_index: 1, due_at: '', priority: 1, reason: 'wrong', overdue_days: 0,
      question: QUESTION_ROW,
    },
    {
      target_kind: 'question', target_id: 'q-9', course_id: 'ma', kp_type: 'concept',
      interval_index: 0, due_at: '', priority: 3, reason: 'type', overdue_days: 0,
      question: { ...QUESTION_ROW, question_id: 'q-9', kp_id: 'kp-other' },
    },
  ],
  total_due: 12,
};

const MISTAKES = {
  items: [{
    question: QUESTION_ROW,
    last_attempt: {
      attempt_id: 7, question_id: 'q-1', user_answer: 'C', is_correct: false, method: 'rule',
      judge_note: '', score_trend: 'new', resolved: false, bookmarked: false, origin: 'new',
      review_date: null, answered_at: '',
    },
    attempt_count: 1, wrong_count: 1, is_correct: false, resolved: false, bookmarked: false,
    score_trend: 'new', due_today: true,
  }],
  total: 1,
  stats: { total: 1, wrong: 1, unresolved: 1, bookmarked: 0, due_today: 1 },
};

/** 错题本人工位（bookmarked）由 PATCH 改写，错题本重取时反映该位 */
let bookmarkFlag = false;
function mistakesPayload() {
  MISTAKES.items[0].bookmarked = bookmarkFlag;
  MISTAKES.stats.bookmarked = bookmarkFlag ? 1 : 0;
  return MISTAKES;
}

const calls: string[] = [];
let postedQuestions: Record<string, unknown> | null = null;
let postedAttempt: Record<string, unknown> | null = null;

function routes(opts: { withSolutionBook?: boolean } = {}) {
  calls.length = 0;
  postedQuestions = null;
  postedAttempt = null;
  bookmarkFlag = false;
  mockFetch.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('/learn/question-books')) return jsonResponse(QUESTION_BOOKS);
    if (url.includes('/pages/')) {
      const bookId = url.match(/\/books\/([^/]+)\/pages/)?.[1];
      const pageNo = Number(url.match(/\/pages\/(\d+)/)?.[1]);
      if (opts.withSolutionBook && bookId === 'b08' && pageNo === 12) return jsonResponse(PAGE_SOLUTION_12);
      if (pageNo === 12) return jsonResponse(PAGE_12);
      if (pageNo === 13) return jsonResponse(PAGE_13);
      return jsonResponse({ detail: '该页无解析产物' }, 404);
    }
    if (url.includes('/learn/questions') && init?.method === 'POST') {
      postedQuestions = JSON.parse(String(init.body));
      return jsonResponse({
        created: 3, skipped_duplicates: 1, gen_batch: 'workbench-extract', model_ref: '',
        questions: [QUESTION_ROW],
      });
    }
    if (url.includes('/learn/questions')) return jsonResponse({ questions: [QUESTION_ROW], total: 1 });
    if (url.includes('/learn/attempts') && init?.method === 'POST') {
      postedAttempt = JSON.parse(String(init.body));
      return jsonResponse(ATTEMPT_RESULT);
    }
    if (url.includes('/learn/attempts/7')) {
      const patch = JSON.parse(String(init?.body ?? '{}')) as { bookmarked?: boolean };
      if (typeof patch.bookmarked === 'boolean') bookmarkFlag = patch.bookmarked;
      return jsonResponse({ ...QUESTION_ROW, attempt_id: 7, bookmarked: bookmarkFlag });
    }
    if (url.includes('/learn/review/due')) return jsonResponse(DUE);
    if (url.includes('/learn/mistakes')) return jsonResponse(mistakesPayload());
    return Promise.reject(new TypeError(`no route: ${url}`));
  });
}

const store = () => usePracticeStore.getState();
const pageCalls = () => calls.filter((c) => c.includes('/pages/'));

async function extractDefault() {
  await store().openCourse('ma');
  store().setSourceBook('b07');
  store().setRange(12, 13);
  await store().extract();
}

describe('练习域 store（M2：题源抽取 → 确认入库 → 作答 → 复习/错题）', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      courseId: null, kpId: null, sourceBooks: [], sourceBookId: null, answerBookId: null,
      range: null, answerRange: null, extracting: false, drafts: [], unrecognized: [],
      extractNotices: [], questions: [], dueTasks: [], mistakes: [], mistakeStats: null,
      lastResult: null, loading: false, error: null, notice: null, courseDueCounts: {},
    });
    routes();
  });

  it('开课拉题源书目：无 roles 与未解析出页产物（parsed_pages=0）都不进选择面', async () => {
    await store().openCourse('ma');
    expect(store().sourceBooks.map((b) => b.book_id)).toEqual(['b05', 'b07', 'b08']);
    expect(store().error).toBeNull();
  });

  it('抽取按页范围逐页取块并解析：选项拆分、同页与答案区配对、无答案转闪卡', async () => {
    await extractDefault();
    expect(store().drafts.map((d) => d.number)).toEqual(['1', '2', '3']);
    expect(store().drafts[0]).toMatchObject({
      answer_source: 'solution_section', expected_answer: 'B', kind: 'quiz', question_type: 'choice',
    });
    expect(store().drafts[0].options).toHaveLength(4);
    expect(store().drafts[1]).toMatchObject({ kind: 'flashcard' });
    expect(store().drafts[2].answer_source).toBe('solution_section');
    expect(store().extractNotices.join('\n')).toContain('题 2 未配对答案');
  });

  it('题解配对书（R-11）：另一本书同页范围的题号答案＝sibling_book', async () => {
    routes({ withSolutionBook: true });
    await store().openCourse('ma');
    store().setSourceBook('b07');
    store().setRange(12, 12);
    store().setAnswerBook('b08', 12, 12);
    await store().extract();
    expect(store().drafts[1]).toMatchObject({
      answer_source: 'sibling_book', expected_answer: '非空有上界的实数集必有上确界',
    });
  });

  it('未解析页跳过并在提示里点名，不整批失败', async () => {
    await store().openCourse('ma');
    store().setSourceBook('b07');
    store().setRange(12, 14);
    await store().extract();
    expect(store().drafts.length).toBeGreaterThan(0);
    expect(store().extractNotices.join('\n')).toContain('第 14 页无解析产物');
  });

  it('页范围非法（缺书 / 起止倒挂 / 超上限）不发抽取请求', async () => {
    await store().openCourse('ma');
    store().setSourceBook('b07');
    store().setRange(13, 12);
    await store().extract();
    expect(pageCalls()).toHaveLength(0);
    expect(store().extracting).toBe(false);
    expect(store().notice).toContain('页范围');
    store().setRange(1, 1000);
    await store().extract();
    expect(pageCalls()).toHaveLength(0);
    expect(store().notice).toContain('页范围');
  });

  it('updateDraft / removeDraft 可改可删（人工确认面板的编辑面）', async () => {
    await extractDefault();
    store().updateDraft(1, { expected_answer: '非空有上界必有上确界', answer_source: 'manual' });
    expect(store().drafts[1].expected_answer).toBe('非空有上界必有上确界');
    store().removeDraft(0);
    expect(store().drafts.map((d) => d.number)).toEqual(['2', '3']);
  });

  it('入库只提交通过校验的草稿，按 roles 决定 source_kind，写后清空草稿并重取本章题', async () => {
    await extractDefault();
    store().updateDraft(1, {
      kind: 'quiz', question_type: 'short', expected_answer: '非空有上界必有上确界', answer_source: 'manual',
    });
    const ok = await store().confirmImport('kp-c1');
    expect(ok).toBe(true);
    const items = postedQuestions?.questions as Array<Record<string, unknown>>;
    expect(items).toHaveLength(3);
    expect(postedQuestions).toMatchObject({ course_id: 'ma', gen_batch: 'workbench-extract' });
    expect(items[0]).toMatchObject({ kp_id: 'kp-c1', source_kind: 'exercise_book', book_ref: 'b07' });
    expect(store().drafts).toHaveLength(0);
    expect(store().questions.map((q) => q.question_id)).toEqual(['q-1']);
    expect(store().notice).toContain('跳重 1');
  });

  it('题解书入库时 answer_book_ref 落进 source_ref', async () => {
    routes({ withSolutionBook: true });
    await store().openCourse('ma');
    store().setSourceBook('b07');
    store().setRange(12, 12);
    store().setAnswerBook('b08', 12, 12);
    await store().extract();
    store().updateDraft(1, { kind: 'quiz', question_type: 'short' });
    await store().confirmImport(null);
    const items = postedQuestions?.questions as Array<Record<string, unknown>>;
    const target = items.find((item) => item.answer_source === 'sibling_book');
    expect(target?.source_ref).toMatchObject({ answer_book_ref: 'b08' });
  });

  it('全部草稿不合格时拒发入库请求并提示', async () => {
    await extractDefault();
    usePracticeStore.setState({
      drafts: store().drafts.map((d) => ({ ...d, kind: 'quiz' as const, expected_answer: null })),
    });
    const before = calls.filter((c) => c === 'POST /api/v1/learn/questions').length;
    expect(await store().confirmImport('kp-c1')).toBe(false);
    expect(calls.filter((c) => c === 'POST /api/v1/learn/questions').length).toBe(before);
    expect(store().notice).toContain('没有可入库');
  });

  it('submitAttempt 写后整体重取（题 + 到期队列 + 错题本）并保留判分依据', async () => {
    await store().loadChapter('ma', 'kp-c1');
    const before = calls.length;
    const result = await store().submitAttempt({ question_id: 'q-1', user_answer: 'C', origin: 'new' });
    expect(result?.is_correct).toBe(false);
    expect(store().lastResult).toMatchObject({ expected_answer: 'B', explanation: '夹逼准则' });
    expect(postedAttempt).toMatchObject({ question_id: 'q-1', user_answer: 'C', origin: 'new' });
    expect(calls.length).toBeGreaterThan(before);
    expect(calls.filter((c) => c.includes('/learn/mistakes')).length).toBeGreaterThanOrEqual(2);
    // 本章队列只保留归属本章的题（q-9 属另一节）
    expect(store().dueTasks.map((t) => t.target_id)).toEqual(['q-1']);
  });

  it('闪卡自评带 self_result 与 review_date', async () => {
    await store().submitAttempt({
      question_id: 'q-2', user_answer: '想起来了', origin: 'review',
      review_date: '2026-10-05T00:00:00', self_result: 'correct',
    });
    expect(postedAttempt).toMatchObject({
      self_result: 'correct', origin: 'review', review_date: '2026-10-05T00:00:00',
    });
  });

  it('错题本人工位 PATCH 后重取错题本', async () => {
    await store().loadChapter('ma', 'kp-c1');
    await store().setBookmark(7, true);
    expect(calls).toContain('PATCH /api/v1/learn/attempts/7');
    expect(store().mistakes[0].bookmarked).toBe(true);
  });

  it('星图复习计数：按课程聚合 total_due', async () => {
    await store().refreshCourseDueCounts(['ma', 'cs']);
    expect(store().courseDueCounts).toEqual({ ma: 12, cs: 12 });
    expect(calls.filter((c) => c.includes('/learn/review/due')).length).toBe(2);
  });

  it('接口失败降级为提示，不清空已有草稿', async () => {
    await extractDefault();
    mockFetch.mockImplementation(() => Promise.reject(new TypeError('offline')));
    await store().loadChapter('ma', 'kp-c1');
    expect(store().drafts.length).toBeGreaterThan(0);
    expect(store().notice).toBeTruthy();
  });
});
