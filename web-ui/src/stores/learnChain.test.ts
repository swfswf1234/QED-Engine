/**
 * 学习链路 store 单测（M1 裁决 D1~D3 的数据面）
 * 夹具＝mockFetch 上的学习域内存假后端：验证课程桥接、链路草稿带页窗、编译只补空位、勾选式推进与断点。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mockFetch } from '../test/setup';
import {
  CHAIN_PAGE_BATCH, useLearnChainStore, windowOfUnit, windowsOfUnits,
} from './learnChain';
import type { LearnCourse, LearnDerived, LearnUnit, OutlineRow } from '../api/learn';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

function outlineRow(kpId: string, name: string, opts: Partial<OutlineRow> = {}): OutlineRow {
  return { kp_id: kpId, name, source_ref: null, parent_kp_id: null, ...opts } as OutlineRow;
}

const OUTLINE: OutlineRow[] = [
  outlineRow('kp-c1', '第1章 实数系和复数系', { source_ref: { ref_id: 'b05', page_start: 7, page_end: 26 } }),
  outlineRow('kp-s1', '有序集', { parent_kp_id: 'kp-c1', source_ref: { ref_id: 'b05', page_start: 8, page_end: 9 } }),
  outlineRow('kp-s2', '域的公理', { parent_kp_id: 'kp-c1', source_ref: { ref_id: 'b05', page_start: 10, page_end: 12 } }),
];

function course(overrides: Partial<LearnCourse> = {}): LearnCourse {
  return {
    learn_course_id: 'lc-1',
    name: '数学分析',
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
    derived: {
      status: 'draft', total: 0, done: 0, skipped: 0, percent: 0, current_unit_id: null, completed: false,
    },
    ...overrides,
  };
}

const hub = {
  courses: [] as LearnCourse[],
  units: [] as LearnUnit[],
  progress: {} as Record<string, string>,
  syllabusTree: null as unknown[] | null,
  proposedWindows: null as Array<{ start: number; end: number }> | null,
  progressOverride: null as LearnDerived | null,
};

function unit(overrides: Partial<LearnUnit>): LearnUnit {
  return {
    unit_id: 'u-x',
    learn_course_id: 'lc-1',
    parent_id: null,
    level: 'unit',
    title: '块',
    sort_order: 1,
    confirmed: false,
    covered: false,
    type: 'text',
    payload: null,
    source_ref: null,
    gen_status: 'pending',
    active: true,
    ...overrides,
  } as LearnUnit;
}

/** 由 PUT 的树重建单元行（后端 replace_tree 的测试替身：草稿即 section/unit 两级） */
function rebuildUnits(tree: unknown[]): void {
  const rows: LearnUnit[] = [];
  (tree as Array<Record<string, any>>).forEach((chapter, ci) => {
    const sectionId = `u-sec-${ci}`;
    rows.push(unit({
      unit_id: sectionId, level: 'section', title: String(chapter.title), parent_id: null, sort_order: ci + 1,
    }));
    (chapter.children ?? []).forEach((child: Record<string, any>, ui: number) => {
      rows.push(unit({
        unit_id: `u-${ci}-${ui}`,
        level: 'unit',
        title: String(child.title),
        parent_id: sectionId,
        sort_order: ui + 1,
        type: child.type ?? 'text',
        source_ref: child.source_ref ?? null,
        confirmed: Boolean(child.confirmed),
      }));
    });
  });
  hub.units = rows;
}

/** 派生进度＝读时重算（与后端 derived_progress 同口径） */
function recomputeDerived(): void {
  const active = hub.units.filter((u) => u.level === 'unit' && u.active);
  const done = active.filter((u) => hub.progress[u.unit_id] === 'done').length;
  const skipped = active.filter((u) => hub.progress[u.unit_id] === 'skipped').length;
  const current = active.find((u) => !['done', 'skipped'].includes(hub.progress[u.unit_id] ?? '')) ?? null;
  const total = active.length;
  hub.courses = hub.courses.map((c) => (c.learn_course_id !== 'lc-1' ? c : {
    ...c,
    derived: {
      status: total === 0 ? 'draft' : (done + skipped === total ? 'completed' : 'learning'),
      total,
      done,
      skipped,
      percent: total === 0 ? 0 : Math.round(((done + skipped) / total) * 100),
      current_unit_id: current?.unit_id ?? null,
      completed: total > 0 && done + skipped === total,
    },
  }));
}

function routes(): void {
  mockFetch.mockImplementation((rawUrl: string, init?: { method?: string; body?: string }) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const url = String(rawUrl);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.includes('/learn/courses/lc-1/syllabus') && method === 'PUT') {
      hub.syllabusTree = body.tree;
      rebuildUnits(body.tree);
      recomputeDerived();
      return jsonResponse({ tree: body.tree, unit_count: hub.units.length });
    }
    if (url.includes('/learn/courses/lc-1/compile/propose') && method === 'POST') {
      hub.proposedWindows = body.page_windows;
      hub.courses = hub.courses.map((c) => ({ ...c, compile_status: 'proposed' }));
      return jsonResponse({ compile_status: 'proposed', page_windows: body.page_windows });
    }
    if (url.includes('/learn/courses/lc-1/compile/start') && method === 'POST') {
      hub.units = hub.units.map((u) => (u.level === 'unit'
        ? {
            ...u,
            gen_status: 'generated',
            payload: u.payload ?? { text: `「${u.title}」骨架正文（M-1 占位，M-2 接生成管线）` },
          }
        : u));
      hub.courses = hub.courses.map((c) => ({ ...c, compile_status: 'completed' }));
      return jsonResponse({ compile_status: 'running', learn_course_id: 'lc-1' }, 202);
    }
    if (url.includes('/learn/courses/lc-1/compile')) {
      return jsonResponse({
        compile_status: hub.courses[0]?.compile_status ?? null,
        done: hub.units.filter((u) => u.gen_status === 'generated').length,
        total: hub.units.filter((u) => u.level === 'unit').length,
        failure_count: 0,
      });
    }
    if (url.includes('/learn/courses/lc-1/progress') && method === 'POST') {
      hub.progress[body.unit_id] = body.status;
      recomputeDerived();
      return jsonResponse({ unit_id: body.unit_id, status: body.status, derived: hub.courses[0].derived });
    }
    if (url.includes('/learn/courses/lc-1/progress')) {
      return jsonResponse(hub.progressOverride ?? hub.courses[0]?.derived ?? {});
    }
    if (url.includes('/learn/courses/lc-1/units')) {
      return jsonResponse({ units: hub.units });
    }
    if (url.includes('/learn/courses/lc-1') && method === 'GET') {
      return jsonResponse(hub.courses[0] ?? {}, 404);
    }
    if (url.includes('/learn/units/') && method === 'PATCH') {
      hub.units = hub.units.map((u) => (u.unit_id === url.split('/learn/units/')[1] ? { ...u, ...body } : u));
      return jsonResponse(hub.units.find((u) => u.unit_id === url.split('/learn/units/')[1]));
    }
    if (url.includes('/learn/courses') && method === 'GET') {
      return jsonResponse({ courses: hub.courses });
    }
    if (url.includes('/pages/')) {
      const pageNo = Number(url.match(/\/pages\/(\d+)/)?.[1]);
      return jsonResponse({
        page_no: pageNo,
        image_url: '',
        markdown: '',
        blocks: { page: pageNo, blocks: [{ type: 'paragraph', bbox: [0, 0, 10, 10], text: `链路第 ${pageNo} 页正文` }] },
      });
    }
    return Promise.reject(new TypeError(`no route: ${method} ${url}`));
  });
}

describe('学习链路 store（M1：桥接 / 生成 / 编译 / 推进）', { timeout: 20000 }, () => {
  beforeEach(() => {
    hub.courses = [];
    hub.units = [];
    hub.progress = {};
    hub.syllabusTree = null;
    hub.proposedWindows = null;
    hub.progressOverride = null;
    useLearnChainStore.setState({
      courseId: null, learnCourse: null, units: [], progress: null, selectedUnitId: null,
      bookId: null, range: null, pages: {}, loadedThrough: 0, busy: false, compiling: false,
      error: null, notice: null,
    });
    mockFetch.mockReset();
    routes();
  });

  it('未登记学习课程＝明确空态，不请求单元树', async () => {
    await useLearnChainStore.getState().load('ma');
    const state = useLearnChainStore.getState();
    expect(state.learnCourse).toBeNull();
    expect(state.units).toEqual([]);
    expect(state.error).toBeNull();
  });

  it('共享课程 id 经 course_ref.ref_id 桥接到学习课程行并取单元树', async () => {
    hub.courses = [course({
      derived: {
        status: 'learning', total: 1, done: 0, skipped: 0, percent: 0, current_unit_id: 'u-0-0', completed: false,
      },
    })];
    hub.units = [
      unit({ unit_id: 'u-sec-0', level: 'section', title: '第1章' }),
      unit({ unit_id: 'u-0-0', level: 'unit', title: '有序集', parent_id: 'u-sec-0', gen_status: 'generated' }),
    ];
    await useLearnChainStore.getState().load('ma');
    const state = useLearnChainStore.getState();
    expect(state.learnCourse?.learn_course_id).toBe('lc-1');
    expect(state.units).toHaveLength(2);
    expect(state.progress?.total).toBe(1);
  });

  it('看板与结课位只读消费派生进度端点（GET …/progress），不取列表项 derived', async () => {
    hub.courses = [course({
      derived: {
        status: 'learning', total: 4, done: 1, skipped: 0, percent: 25, current_unit_id: 'u-0-1', completed: false,
      },
    })];
    hub.units = [
      unit({ unit_id: 'u-sec-0', level: 'section', title: '第1章' }),
      unit({ unit_id: 'u-0-0', level: 'unit', title: '有序集', parent_id: 'u-sec-0', gen_status: 'generated' }),
    ];
    hub.progressOverride = {
      status: 'completed', total: 2, done: 2, skipped: 0, percent: 100, current_unit_id: null, completed: true,
    };
    await useLearnChainStore.getState().load('ma');
    expect(useLearnChainStore.getState().progress).toEqual(hub.progressOverride);
  });

  it('从目录生成链路＝PUT 树带块级 source_ref 页窗（章→节两级）', async () => {
    hub.courses = [course()];
    await useLearnChainStore.getState().load('ma');
    const ok = await useLearnChainStore.getState().generateFromOutline(OUTLINE, 'b05');
    expect(ok).toBe(true);
    const tree = hub.syllabusTree as Array<Record<string, any>>;
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].source_ref).toEqual({ ref_id: 'b05', page_start: 8, page_end: 9 });
    expect(windowOfUnit(useLearnChainStore.getState().units.find((u) => u.level === 'unit') ?? null))
      .toEqual({ ref_id: 'b05', page_start: 8, page_end: 9 });
  });

  it('编译＝登记合并后的页窗并轮询后重载块序列', async () => {
    hub.courses = [course()];
    await useLearnChainStore.getState().load('ma');
    await useLearnChainStore.getState().generateFromOutline(OUTLINE, 'b05');
    await useLearnChainStore.getState().confirmAll();
    const ok = await useLearnChainStore.getState().compile();
    expect(ok).toBe(true);
    expect(hub.proposedWindows).toEqual([{ start: 8, end: 12 }]);
    expect(useLearnChainStore.getState().units.filter((u) => u.level === 'unit').every((u) => u.gen_status === 'generated')).toBe(true);
    expect(useLearnChainStore.getState().units.filter((u) => u.confirmed)).toHaveLength(3);
  });

  it('windowsOfUnits 只收有页窗的块（无页窗块不进编译输入）', () => {
    expect(windowsOfUnits([
      unit({ source_ref: { ref_id: 'b05', page_start: 30, page_end: 40 } }),
      unit({ unit_id: 'u-no-window', source_ref: null }),
      unit({ unit_id: 'u-bad', source_ref: { ref_id: 'b05', page_start: 0, page_end: 5 } }),
    ])).toEqual([{ start: 30, end: 40 }]);
  });

  it('选中块按页窗懒取一批解析产物（上限 CHAIN_PAGE_BATCH 页）', async () => {
    hub.courses = [course()];
    hub.units = [
      unit({ unit_id: 'u-big', level: 'unit', title: '长节', gen_status: 'generated', source_ref: { ref_id: 'b05', page_start: 7, page_end: 30 } }),
    ];
    await useLearnChainStore.getState().load('ma');
    await useLearnChainStore.getState().selectUnit('u-big');
    const state = useLearnChainStore.getState();
    expect(state.bookId).toBe('b05');
    expect(state.loadedThrough).toBe(7 + CHAIN_PAGE_BATCH - 1);
    expect(Object.keys(state.pages)).toHaveLength(CHAIN_PAGE_BATCH);
    expect(state.pages[7].data).toBeTruthy();
  });

  it('标记学完＝POST 学习事件 + 已确认块补 covered 勾选，派生进度重算', async () => {
    hub.courses = [course()];
    hub.units = [
      unit({ unit_id: 'u-0-0', level: 'unit', title: '有序集', confirmed: true }),
      unit({ unit_id: 'u-0-1', level: 'unit', title: '域的公理', confirmed: true }),
    ];
    await useLearnChainStore.getState().load('ma');
    await useLearnChainStore.getState().mark('u-0-0', 'done');
    expect(hub.progress['u-0-0']).toBe('done');
    const done = useLearnChainStore.getState().units.find((u) => u.unit_id === 'u-0-0');
    expect(done?.covered).toBe(true);
    expect(useLearnChainStore.getState().progress).toMatchObject({ total: 2, done: 1, current_unit_id: 'u-0-1' });
  });

  it('回到断点＝跳到 derived.current_unit_id，无进度时给提示不静默', async () => {
    hub.courses = [course()];
    hub.units = [
      unit({ unit_id: 'u-0-0', level: 'unit', title: '有序集', source_ref: { ref_id: 'b05', page_start: 8, page_end: 8 } }),
      unit({ unit_id: 'u-0-1', level: 'unit', title: '域的公理', source_ref: { ref_id: 'b05', page_start: 10, page_end: 10 } }),
    ];
    hub.progress['u-0-0'] = 'done';
    recomputeDerived();
    await useLearnChainStore.getState().load('ma');
    await useLearnChainStore.getState().jumpToCurrent();
    expect(useLearnChainStore.getState().selectedUnitId).toBe('u-0-1');

    useLearnChainStore.setState({ progress: null });
    await useLearnChainStore.getState().jumpToCurrent();
    expect(useLearnChainStore.getState().notice).toBe('本课还没有进度（先从目录生成链路并编译）');
  });
});
