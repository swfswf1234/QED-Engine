/**
 * 学习工作台 store 用例（v1.0 三张化：章 → 知识点两级、逐条推进、注解三段）
 * 守护四件事：推进序列一次进面一次读（`knowledge-points` 的 `sequence`，零写入）、
 * 落笔只写 `kp_id`＋状态（covered 列随 qe_unit 退出，「已学」＝kp 行终态位）、
 * 条级注解＝主表 `angles` 追加后整行回灌序列（候选池已退役）、备注＝kp 行 `learner_note`。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mockFetch } from '../test/setup';
import {
  PAGE_BATCH, POINT_KEY_PREFIX, anglesOf, chapterOf, chapterOfUnit, flowPages, isCovered,
  pointsOfChapter, rangeOfRef, useLearnWorkbenchStore,
} from './learnWorkbench';
import type { FlowPage } from './learnWorkbench';
import type { KpAngle, LearnProgress, LearnerKpStatus, OutlineRow, PointChapter, PointUnit } from '../api/learn';

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

/** 教材注册顺序＝b07 在前、b05 其次；b01 未激活解析版本 */
const BOOKS = [
  { book_id: 'b05', title: '数学分析原理', page_count: 317, course_id: 'ma', active_job_id: 'job-1' },
  { book_id: 'b07', title: '高等数学引论', page_count: 260, course_id: 'ma', active_job_id: 'job-7' },
  { book_id: 'b01', title: '同课未激活', page_count: 100, course_id: 'ma', active_job_id: null },
];

const CHAPTERS: PointChapter[] = [
  {
    node_kind: 'outline', unit_id: 'kp:c1', kp_id: 'c1', name: '第1章 实数', point_count: 2, book_ref: 'b07',
    source_ref: { ref_id: 'b07', page_start: 5, page_end: 20 }, summary: '', key_points: [],
  },
  {
    node_kind: 'outline', unit_id: 'kp:c2', kp_id: 'c2', name: '第2章 完备性', point_count: 1, book_ref: 'b07',
    source_ref: { ref_id: 'b07', page_start: 21, page_end: 40 }, summary: '已有本章总结',
    key_points: ['确界原理', '单调有界'],
  },
];

const UNITS: PointUnit[] = [
  {
    node_kind: 'point', unit_id: 'kp:p1', parent_id: 'kp:c1', chapter_kp_id: 'c1', kp_id: 'p1',
    name: '实数的运算', title: '实数的运算', sort_order: 0, type: 'concept', book_ref: 'b07',
    source_ref: { ref_id: 'b07', page_start: 5, page_end: 9 }, window_source: 'point',
    summary: '有序域的三条运算律', angles: [], learner: null,
  },
  {
    node_kind: 'point', unit_id: 'kp:p2', parent_id: 'kp:c1', chapter_kp_id: 'c1', kp_id: 'p2',
    name: '绝对值', title: '绝对值', sort_order: 1, type: 'concept', book_ref: 'b07',
    source_ref: { ref_id: 'b07', page_start: 10, page_end: 14 }, window_source: 'anchor',
    summary: '', angles: [], learner: null,
  },
  {
    node_kind: 'point', unit_id: 'kp:p3', parent_id: 'kp:c2', chapter_kp_id: 'c2', kp_id: 'p3',
    name: '确界原理', title: '确界原理', sort_order: 2, type: 'concept', book_ref: 'b07',
    source_ref: { ref_id: 'b07', page_start: 21, page_end: 30 }, window_source: 'chapter',
    summary: '非空有上界的实数集必有上确界', angles: [{ angle: 'summary', note: '已有的一条本条总结' }],
    learner: null,
  },
];

/** b07 的 outline 行（章层，节层不显形） */
function outlineRows(bookId: string): OutlineRow[] {
  return CHAPTERS.map((chapter) => ({
    kp_id: chapter.kp_id, course_id: 'ma', node_kind: 'outline', name: chapter.name, depth: 1,
    parent_kp_id: null, book_ref: bookId, point_count: chapter.point_count,
    source_ref: { kind: 'book', ...chapter.source_ref },
    type: null, order_hint: null, summary: chapter.summary, anchors: [],
    meta: { chapter_key_points: chapter.key_points },
  } as OutlineRow));
}

interface Hub {
  units: PointUnit[];
  chapters: PointChapter[];
  /** kp 行（qe_learning 的知识点行）：落笔态与备注的唯一落点 */
  kpRows: Record<string, { status: LearnerKpStatus; learner_note: string }>;
  progress: Array<{ kp_id: string; status: string; note: string | null }>;
  putOutline: Array<{ book_ref: string; tree: unknown }>;
  generate: Array<Record<string, unknown>>;
  pageTexts: Record<string, string>;
  registered: boolean;
  generateStatus: number;
  generateDetail: string;
}

const hub = {} as Hub;

function resetHub() {
  hub.units = UNITS.map((unit) => ({ ...unit, angles: [...(unit.angles ?? [])], learner: null }));
  hub.chapters = CHAPTERS.map((chapter) => ({ ...chapter, key_points: [...chapter.key_points] }));
  hub.kpRows = {};
  hub.progress = [];
  hub.putOutline = [];
  hub.generate = [];
  hub.pageTexts = {};
  hub.registered = true;
  hub.generateStatus = 200;
  hub.generateDetail = '';
}

/** 门游标与计数一律按 kp 行现算（服务端同口径：读时派生，不落列） */
function progressOut(): LearnProgress {
  const total = hub.units.length;
  const statusOf = (kpId: string) => hub.kpRows[kpId]?.status;
  const done = hub.units.filter((unit) => statusOf(unit.kp_id) === 'done').length;
  const skipped = hub.units.filter((unit) => statusOf(unit.kp_id) === 'skipped').length;
  const gate = hub.units.find((unit) => statusOf(unit.kp_id) !== 'done' && statusOf(unit.kp_id) !== 'skipped');
  const current = gate ? `${POINT_KEY_PREFIX}${gate.kp_id}` : null;
  return {
    total, done, skipped, percent: total === 0 ? 0 : Math.round(((done + skipped) / total) * 100),
    current_unit_id: current, completed: total > 0 && done + skipped === total,
    mastered: done, next_unit_id: current, provenance: { system: 0, learner: done + skipped },
  };
}

function learnerRow(kpId: string) {
  const row = hub.kpRows[kpId];
  if (!row) return null;
  return {
    kp_id: kpId, status: row.status, qualitative_passed: null, qualitative_note: '',
    assessed_by: '', assessed_at: null, learner_note: row.learner_note, updated_at: '2026-10-21T00:00:00',
  };
}

const calls: string[] = [];

function routes() {
  calls.length = 0;
  resetHub();
  mockFetch.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.includes('/learn/star-map')) return jsonResponse(STAR);
    if (url.includes('/outline')) {
      if (init?.method === 'PUT') {
        hub.putOutline.push(body);
        return jsonResponse({ course_id: 'ma', book_ref: body.book_ref, outline: outlineRows(body.book_ref) });
      }
      const book = String(url.match(/[?&]book=([^&]+)/)?.[1] ?? 'b07');
      // b07 有目录、b05 零目录（自动整理通路按既有口径保留）
      return jsonResponse({ course_id: 'ma', book_ref: book, outline: book === 'b07' ? outlineRows(book) : [] });
    }
    if (url.includes('/learn/courses/ma/knowledge-points')) {
      return jsonResponse({
        course: { course_id: 'ma', name: '数学分析', track: '分析学', domain_id: 'math', description: '' },
        points: hub.units,
        total: hub.units.length,
        sequence: {
          enrolled: hub.registered,
          units: hub.units.map((unit) => ({ ...unit, learner: learnerRow(unit.kp_id) })),
          chapters: hub.chapters,
          kp_path: [],
        },
      });
    }
    if (url.includes('/learn/courses/ma/progress')) {
      if (init?.method === 'POST') {
        const kpId = String(body.kp_id);
        const status = String(body.status) as LearnerKpStatus;
        hub.progress.push({ kp_id: kpId, status, note: body.note === undefined ? null : String(body.note) });
        if (status === 'pending') {
          // 服务端不为撤销起新行：无行即整笔作废
          if (hub.kpRows[kpId]) delete hub.kpRows[kpId];
        } else {
          hub.kpRows[kpId] = {
            status,
            learner_note: body.note === undefined ? (hub.kpRows[kpId]?.learner_note ?? '') : String(body.note),
          };
        }
        return jsonResponse({ kp_id: kpId, status, derived: progressOut() });
      }
      return jsonResponse(progressOut());
    }
    if (url.includes('/learn/annotations/generate')) {
      hub.generate.push(body);
      if (hub.generateStatus !== 200) return jsonResponse({ detail: hub.generateDetail }, hub.generateStatus);
      const part = String(body.part);
      if (part === 'annotation') {
        const unit = hub.units.find((row) => row.kp_id === body.kp_id);
        const angles: KpAngle[] = [...(unit?.angles ?? []), { angle: 'explanation', note: '本次生成的注解正文' }];
        if (unit) unit.angles = angles;
        return jsonResponse({
          ok: true, target: { kind: 'point', kp_id: body.kp_id, name: unit?.name ?? '' },
          point: { ...(unit ?? {}), node_kind: 'point', angles },
        });
      }
      const chapter = hub.chapters.find((row) => row.kp_id === body.kp_id);
      if (chapter) {
        if (part === 'summary') chapter.summary = `《${chapter.name}》本章总结`;
        else chapter.key_points = ['要点一', '要点二', '要点三'];
      }
      return jsonResponse({
        ok: true, target: { kind: 'chapter', kp_id: body.kp_id, name: chapter?.name ?? '' },
        chapter: { kp_id: body.kp_id, summary: chapter?.summary ?? '', key_points: [...(chapter?.key_points ?? [])] },
      });
    }
    if (url.includes('/learn/courses')) {
      if (!hub.registered) return jsonResponse({ courses: [] });
      return jsonResponse({
        courses: [{
          learn_course_id: 'ma', course_id: 'ma', name: '数学分析', status: 'active',
          domain_id: 'math', track: '分析学', description: '', learner_note: '',
          kp_path: [], created_at: '', updated_at: '',
          resources: [
            { kind: 'book', ref_id: 'b07', label: '高等数学引论' },
            { kind: 'book', ref_id: 'b05', label: '数学分析原理' },
            { kind: 'book', ref_id: 'b01', label: '同课未激活' },
          ],
          derived: progressOut(), unit_count: hub.units.length,
        }],
      });
    }
    if (url.includes('/api/v1/books')) {
      if (url.includes('/pages/')) {
        const book = String(url.match(/\/books\/([^/]+)\/pages\/(\d+)/)?.[1]);
        const pageNo = Number(url.match(/\/books\/[^/]+\/pages\/(\d+)/)?.[1]);
        return jsonResponse({
          page_no: pageNo, image_url: '', markdown: '',
          blocks: {
            page: pageNo,
            blocks: [{ type: 'paragraph', bbox: [0, 0, 10, 10], text: hub.pageTexts[`${book}:${pageNo}`] ?? `第 ${pageNo} 页正文` }],
          },
        });
      }
      return jsonResponse(BOOKS);
    }
    return Promise.reject(new TypeError(`no route: ${url}`));
  });
}

const store = () => useLearnWorkbenchStore.getState();

async function openWorkbench() {
  await store().fetchCourse('ma');
}

describe('学习工作台 store（v1.0：sequence 读源＋kp 行落笔＋angles 注解）', () => {
  beforeEach(() => {
    useLearnWorkbenchStore.setState(useLearnWorkbenchStore.getInitialState(), true);
    mockFetch.mockReset();
    routes();
  });

  it('进面一次读：sequence 的知识点与章行落定，落点＝第一条知识点并首批取正文', async () => {
    await openWorkbench();
    expect(calls.filter((c) => c.startsWith('GET') && c.includes('/knowledge-points'))).toHaveLength(1);
    expect(store().pointUnits.map((unit) => unit.kp_id)).toEqual(['p1', 'p2', 'p3']);
    expect(store().chapters.map((row) => row.kp_id)).toEqual(['c1', 'c2']);
    expect(store().selected).toEqual({ kind: 'point', kpId: 'p1' });
    expect(store().range).toEqual({ start: 5, end: 9 });
    expect(store().bookId).toBe('b07');
    expect(store().windowSource).toBe('point');
    expect(store().loadedThrough).toBe(9);
  });

  it('章行没有章级成品位时补齐空值：旧返回不缺字段也不崩右栏', async () => {
    hub.chapters = hub.chapters.map(
      (row) => ({ ...row, summary: undefined, key_points: undefined }) as unknown as PointChapter,
    );
    await openWorkbench();
    expect(store().chapters[0].summary).toBe('');
    expect(store().chapters[0].key_points).toEqual([]);
  });

  it('教材按注册顺序并标注可读态；零目录者进场自动整理，未激活者不贡献', async () => {
    hub.pageTexts = {
      'b05:2': '目录\n第1章 实数 1\n第2章 完备性 17',
      'b05:3': '第1章 实数\n1.1 有理数与无理数',
    };
    await openWorkbench();
    expect(store().texts.map((t) => [t.bookId, t.active])).toEqual([['b07', true], ['b05', true], ['b01', false]]);
    expect(hub.putOutline.map((p) => p.book_ref)).toEqual(['b05']);
  });

  it('选条即读：正文范围与书切到那一条，页请求从该条起页开始', async () => {
    await openWorkbench();
    const before = calls.length;
    await store().selectPoint('p3');
    expect(store().range).toEqual({ start: 21, end: 30 });
    expect(store().windowSource).toBe('chapter');
    expect(store().selectedPoint?.summary).toBe('非空有上界的实数集必有上确界');
    const pageCalls = calls.slice(before).filter((c) => c.includes('/books/b07/pages/'));
    expect(pageCalls).toHaveLength(Math.min(PAGE_BATCH, 10));
    expect(pageCalls[0]).toContain('/pages/21');
  });

  it('整章阅读：选中章行取整章范围，归属仍指向这一章', async () => {
    await openWorkbench();
    await store().selectChapter('c2');
    expect(store().range).toEqual({ start: 21, end: 40 });
    expect(store().windowSource).toBe('chapter');
    expect(store().selectedPoint).toBeNull();
    expect(chapterOf(store().chapters, store().selectedKpId)?.kp_id).toBe('c2');
  });

  it('勾选推进只写 kp_id＋状态，写后重取不乐观更新', async () => {
    await openWorkbench();
    await store().markSelected('done');
    expect(hub.progress).toEqual([{ kp_id: 'p1', status: 'done', note: null }]);
    expect(calls.some((c) => c.includes('/learn/units/'))).toBe(false);
    expect(isCovered(store().pointUnits.find((unit) => unit.kp_id === 'p1'))).toBe(true);
    expect(store().progress?.done).toBe(1);
  });

  it('整章阅读记不进进度：给归属话术且零 progress 写入', async () => {
    await openWorkbench();
    await store().selectChapter('c1');
    await store().markSelected('done');
    expect(hub.progress).toHaveLength(0);
    expect(store().notice).toContain('整章阅读记不进进度');
  });

  it('上一条／下一条顺着左栏序走，章内读完自动跨章续走', async () => {
    await openWorkbench();
    await store().step(1);
    expect(store().selectedKpId).toBe('p2');
    await store().step(1);
    expect(store().selectedKpId).toBe('p3');
    await store().step(1);
    expect(store().notice).toContain('已经到本课最后一条');
    await store().step(-1);
    expect(store().selectedKpId).toBe('p2');
  });

  it('已掌握并下一条：写 done 后自动前进一条；已掌握的那条再点＝撤销回 pending 且不动位置', async () => {
    await openWorkbench();
    await store().masterAndNext();
    expect(hub.progress).toEqual([{ kp_id: 'p1', status: 'done', note: null }]);
    expect(store().selectedKpId).toBe('p2');
    await store().masterAndNext();
    expect(hub.progress.map((row) => row.status)).toEqual(['done', 'done']);
    expect(store().selectedKpId).toBe('p3');
    await store().selectPoint('p1');
    await store().masterAndNext();
    expect(hub.progress.at(-1)).toEqual({ kp_id: 'p1', status: 'pending', note: null });
    expect(store().selectedKpId).toBe('p1');
    expect(store().pointUnits.find((unit) => unit.kp_id === 'p1')?.learner).toBeNull();
  });

  it('整章阅读时「已掌握并下一条」记不上进度也不前进：给归属话术', async () => {
    await openWorkbench();
    await store().selectChapter('c1');
    await store().masterAndNext();
    expect(hub.progress).toHaveLength(0);
    expect(store().selectedKpId).toBe('c1');
    expect(store().notice).toContain('整章阅读记不进进度');
  });

  it('章级生成一次点齐两件：缺什么生成什么，成品合并回章行即可直读', async () => {
    await openWorkbench();
    await store().selectPoint('p1');
    expect(chapterOfUnit(store().chapters, store().selectedPoint)?.summary).toBe('');
    await store().generateChapter();
    expect(hub.generate.map((row) => row.part)).toEqual(['summary', 'key_points']);
    expect(hub.generate[0]).toMatchObject({ course_id: 'ma', target_kind: 'chapter', kp_id: 'c1' });
    const chapter = chapterOfUnit(store().chapters, store().selectedPoint);
    expect(chapter?.summary).toBe('《第1章 实数》本章总结');
    expect(chapter?.key_points).toEqual(['要点一', '要点二', '要点三']);
  });

  it('章级两件齐全时零请求：进场直读即够，不再多烧一次生成', async () => {
    await openWorkbench();
    await store().selectPoint('p3');
    await store().generateChapter();
    expect(hub.generate).toHaveLength(0);
  });

  it('条级生成＝主表 angles 追加：整行回灌序列并按数组序展示，旧的一条不被丢弃', async () => {
    await openWorkbench();
    await store().selectPoint('p3');
    expect(anglesOf(store().selectedPoint).map((item) => item.note)).toEqual(['已有的一条本条总结']);
    await store().generatePoint();
    expect(hub.generate[0]).toMatchObject({ target_kind: 'point', kp_id: 'p3', part: 'annotation' });
    expect(anglesOf(store().selectedPoint).map((item) => item.angle)).toEqual(['summary', 'explanation']);
    expect(calls.some((c) => c.includes('/kp-details'))).toBe(false);
  });

  it('生成失败话术不套运维前缀：503 直接给后端那一句', async () => {
    await openWorkbench();
    hub.generateStatus = 503;
    hub.generateDetail = '这一条的正文还没准备好，暂时生成不了';
    await store().selectPoint('p3');
    await store().generatePoint();
    expect(store().generateError).toBe('这一条的正文还没准备好，暂时生成不了');
    expect(store().generateError).not.toContain('服务');
    expect(store().generating).toBe(false);
  });

  it('生成腿遇上端点缺失（404）：给下一步话术，不把 Not Found 抛给学习者', async () => {
    await openWorkbench();
    mockFetch.mockImplementation((url: string) => (
      url.includes('/annotations/generate')
        ? jsonResponse({ detail: 'Not Found' }, 404)
        : jsonResponse({})
    ));
    await store().generatePoint();
    expect(store().generateError).not.toContain('Not Found');
    expect(store().generateError).toContain('稍后点右上「刷新」再试');
  });

  it('刷新＝重取目录与推进序列并保留当前条，不触发任何生成', async () => {
    await openWorkbench();
    await store().selectPoint('p2');
    const before = calls.filter((c) => c.includes('/annotations/generate')).length;
    await store().refresh();
    expect(store().selectedKpId).toBe('p2');
    expect(calls.filter((c) => c.startsWith('GET') && c.includes('/knowledge-points'))).toHaveLength(2);
    expect(calls.filter((c) => c.includes('/annotations/generate'))).toHaveLength(before);
  });

  it('未登记学习课程：推进区降级话术且零 progress／零生成写入', async () => {
    hub.registered = false;
    await store().fetchCourse('ma');
    expect(store().progressError).toContain('不在您的书架上');
    expect(store().pointUnits).toEqual([]);
    await store().markSelected('done');
    await store().generateChapter();
    expect(hub.progress).toHaveLength(0);
    expect(hub.generate).toHaveLength(0);
  });

  it('备注写 kp 行 learner_note：随当前终态位整笔提交，写后重取即回显', async () => {
    await openWorkbench();
    await store().selectPoint('p3');
    await store().markSelected('done');
    const ok = await store().saveNote('上确界是最小的那个上界');
    expect(ok).toBe(true);
    expect(hub.progress.at(-1)).toEqual({ kp_id: 'p3', status: 'done', note: '上确界是最小的那个上界' });
    expect(store().selectedPoint?.learner?.learner_note).toBe('上确界是最小的那个上界');
    expect(calls.some((c) => c.includes('/kp-details'))).toBe(false);
  });

  it('备注遇不上 kp 行时拒绝并给下一步话术：零 progress 写入', async () => {
    await openWorkbench();
    await store().selectPoint('p1');
    const ok = await store().saveNote('想先记一句');
    expect(ok).toBe(false);
    expect(hub.progress).toHaveLength(0);
    expect(store().notice).toContain('这一条还没有学习记录');
  });

  it('anglesOf 只收有正文的元素且保持数组序（数组序＝权威排序，前端不重排）', () => {
    const point = {
      ...UNITS[0],
      angles: [
        { angle: 'example', note: '例子正文' },
        { angle: 'summary' },
        { angle: 'definition', note: '' },
        { angle: 'proof', note: '证明正文' },
      ] as KpAngle[],
    };
    expect(anglesOf(point).map((item) => item.angle)).toEqual(['example', 'proof']);
    expect(anglesOf(null)).toEqual([]);
  });

  it('chapterOfUnit：章内按派生 parent 归组；无所属章给 null', () => {
    expect(chapterOfUnit([CHAPTERS[0]], UNITS[1])?.kp_id).toBe('c1');
    expect(chapterOfUnit([CHAPTERS[0]], null)).toBeNull();
    expect(chapterOfUnit([], UNITS[0])).toBeNull();
  });

  it('pointsOfChapter：按 parent_id 归组并沿 sort_order 排', () => {
    expect(pointsOfChapter(hub.units, 'kp:c1').map((unit) => unit.kp_id)).toEqual(['p1', 'p2']);
    expect(pointsOfChapter(hub.units, 'kp:c2').map((unit) => unit.kp_id)).toEqual(['p3']);
  });

  it('rangeOfRef：缺 source_ref 或起止倒挂＝中栏空态', () => {
    expect(rangeOfRef({ page_start: 5, page_end: 9 })).toEqual({ start: 5, end: 9 });
    expect(rangeOfRef(null)).toBeNull();
    expect(rangeOfRef({ page_start: 9, page_end: 8 })).toBeNull();
    expect(rangeOfRef({ page_start: 0, page_end: 9 })).toBeNull();
  });

  it('flowPages 缝合跨页断句：未收尾段接下一页首块，收尾段不接', () => {
    const pages: FlowPage[] = [
      { page: 5, blocks: [{ type: 'paragraph', bbox: [0, 0, 1, 1], text: '这一节说明确' }] },
      { page: 6, blocks: [{ type: 'paragraph', bbox: [0, 0, 1, 1], text: '界原理是完备性的表述。' }] },
      { page: 7, blocks: [{ type: 'paragraph', bbox: [0, 0, 1, 1], text: '单调有界必收敛。' }] },
      { page: 8, blocks: [{ type: 'paragraph', bbox: [0, 0, 1, 1], text: '接着上一页的半句' }] },
    ];
    const flow = flowPages(pages);
    expect(flow.map((entry) => [entry.page, entry.blocks.map((block) => block.text)])).toEqual([
      [5, ['这一节说明确界原理是完备性的表述。']],
      [7, ['单调有界必收敛。']],
      [8, ['接着上一页的半句']],
    ]);
  });

  it('flowPages 去掉跨页重印的同一标题，公式与图表块原样保留', () => {
    const flow = flowPages([
      { page: 5, blocks: [{ type: 'heading', bbox: [0, 0, 1, 1], text: '1.2 数域', level: 2 }] },
      {
        page: 6,
        blocks: [
          { type: 'heading', bbox: [0, 0, 1, 1], text: '1.2 数 域', level: 2 },
          { type: 'formula', bbox: [0, 0, 1, 1], latex: 'x^2' },
        ],
      },
    ]);
    expect(flow.map((entry) => entry.blocks.length)).toEqual([1, 1]);
    expect(flow[1].blocks[0].type).toBe('formula');
  });

  it('flowPages 全部并入前页时不留空栏：只剩续句的一页整组消失', () => {
    const flow = flowPages([
      { page: 5, blocks: [{ type: 'paragraph', bbox: [0, 0, 1, 1], text: '半句在前' }] },
      { page: 6, blocks: [{ type: 'paragraph', bbox: [0, 0, 1, 1], text: '半句在后。' }] },
    ]);
    expect(flow.map((entry) => entry.page)).toEqual([5]);
  });
});
