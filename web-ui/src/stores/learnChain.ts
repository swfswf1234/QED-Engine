/**
 * 学习链路 store（M1 裁决 D1/D2/D3：三栏工作台「链路」模式的数据面）
 * - 课程桥接：共享课程 id（星图/目录用）→ 学习课程行（`course_ref.ref_id`），未登记走明确空态
 * - 生成：章节目录（outline）→ 单元树草稿（PUT …/syllabus，块带 source_ref 页窗）→ 两级确认 → 编译（propose+start+轮询）
 * - 学习：块序列逐块渲染（有页窗＝按 8 页/批取解析产物；无页窗＝骨架占位文本＋待生成标记）
 * - 推进：`POST …/progress`（done/skipped/pending）＋ `PATCH /learn/units/{id}` 的 covered；看板与结课位取只读 `GET …/progress`，续学定位取 `derived.current_unit_id`
 * - 数据一律经 8900（ADR 0007）；写后整体重取，不做乐观更新（判例 stores/learnWorkbench）
 */
import { create } from 'zustand';
import { getBookPage, type PageData } from '../api/axiom';
import { ApiError, describeError } from '../api/client';
import {
  findLearnCourseFor, getCompileStatus, getLearnProgress, listLearnCourses, listLearnUnits, patchLearnUnit,
  proposeCompile, setLearnProgress, startCompile, putSyllabus,
  type LearnCourse, type LearnDerived, type LearnUnit, type OutlineRow, type PageWindow,
} from '../api/learn';
import { chainFromOutline, mergePageWindows, type ChainSourceRef } from '../chainFromOutline';

/** 块正文每批懒取页数（与中栏阅读态同节拍） */
export const CHAIN_PAGE_BATCH = 8;

/** 编译轮询上限（骨架编译是一次性同步动作，轮询只为对齐 202+轮询契约） */
export const COMPILE_POLL_LIMIT = 40;

export interface ChainPageEntry {
  loading: boolean;
  parsed: boolean;
  data: PageData | null;
  error: string | null;
}

const emptyEntry: ChainPageEntry = { loading: false, parsed: false, data: null, error: null };

/** 块的溯源页窗（缺任一端＝null，渲染走 payload 占位文本） */
export function windowOfUnit(unit: LearnUnit | null): ChainSourceRef | null {
  const ref = unit?.source_ref ?? null;
  if (!ref) return null;
  const start = ref.page_start;
  const end = ref.page_end;
  if (typeof start !== 'number' || typeof end !== 'number' || start < 1 || end < start) return null;
  return { ref_id: String(ref.ref_id ?? ''), page_start: start, page_end: end };
}

/** 单元行 → propose 页窗输入（合并重叠/相邻区间） */
export function windowsOfUnits(units: LearnUnit[]): PageWindow[] | null {
  const raw: PageWindow[] = [];
  for (const unit of units) {
    const window = windowOfUnit(unit);
    if (window) raw.push({ start: window.page_start, end: window.page_end });
  }
  return mergePageWindows(raw);
}

export interface LearnChainStore {
  courseId: string | null;
  learnCourse: LearnCourse | null;
  units: LearnUnit[];
  progress: LearnDerived | null;
  selectedUnitId: string | null;
  bookId: string | null;
  range: ChainSourceRef | null;
  pages: Record<number, ChainPageEntry>;
  loadedThrough: number;
  busy: boolean;
  compiling: boolean;
  error: string | null;
  notice: string | null;
  load: (courseId: string) => Promise<void>;
  generateFromOutline: (outline: OutlineRow[], bookRef: string) => Promise<boolean>;
  confirmAll: () => Promise<boolean>;
  compile: () => Promise<boolean>;
  selectUnit: (unitId: string | null) => Promise<void>;
  loadMorePages: () => Promise<void>;
  mark: (unitId: string, status: 'done' | 'skipped' | 'pending') => Promise<void>;
  jumpToCurrent: () => Promise<void>;
  clearNotice: () => void;
}

export const useLearnChainStore = create<LearnChainStore>((set, get) => {
  const loadUnits = async (learnCourseId: string) => {
    try {
      const { units } = await listLearnUnits(learnCourseId);
      set({ units });
      return units;
    } catch (err) {
      set({ error: describeError(err) });
      return [];
    }
  };

  const refreshDerived = async (courseId: string | null, learnCourseId: string | null) => {
    if (!courseId || !learnCourseId) return;
    try {
      const [courseList, progress] = await Promise.all([listLearnCourses(), getLearnProgress(learnCourseId)]);
      const found = findLearnCourseFor(courseList.courses, courseId);
      if (found) set({ learnCourse: found, progress });
    } catch (err) {
      set({ notice: describeError(err) });
    }
  };

  const loadPage = async (bookId: string, pageNo: number) => {
    set((s) => ({ pages: { ...s.pages, [pageNo]: { ...emptyEntry, loading: true } } }));
    try {
      const data = await getBookPage(bookId, pageNo);
      set((s) => ({ pages: { ...s.pages, [pageNo]: { loading: false, parsed: true, data, error: null } } }));
    } catch (err) {
      const missing = err instanceof ApiError && err.status === 404;
      set((s) => ({
        pages: {
          ...s.pages,
          [pageNo]: { loading: false, parsed: false, data: null, error: missing ? null : describeError(err) },
        },
      }));
    }
  };

  const advanceBatch = async () => {
    const { bookId, range, loadedThrough } = get();
    if (!bookId || !range) return;
    const from = Math.max(range.page_start, loadedThrough + 1);
    if (from > range.page_end) return;
    const to = Math.min(range.page_end, from + CHAIN_PAGE_BATCH - 1);
    set({ loadedThrough: to });
    await Promise.all(Array.from({ length: to - from + 1 }, (_, i) => loadPage(bookId, from + i)));
  };

  return {
    courseId: null,
    learnCourse: null,
    units: [],
    progress: null,
    selectedUnitId: null,
    bookId: null,
    range: null,
    pages: {},
    loadedThrough: 0,
    busy: false,
    compiling: false,
    error: null,
    notice: null,

    load: async (courseId) => {
      set({ courseId, error: null });
      try {
        const { courses } = await listLearnCourses();
        const learnCourse = findLearnCourseFor(courses, courseId);
        if (!learnCourse) {
          set({ learnCourse: null, units: [], progress: null });
          return;
        }
        set({ learnCourse });
        await Promise.all([
          loadUnits(learnCourse.learn_course_id),
          getLearnProgress(learnCourse.learn_course_id).then((progress) => set({ progress })),
        ]);
      } catch (err) {
        set({ error: describeError(err), learnCourse: null, units: [] });
      }
    },

    generateFromOutline: async (outline, bookRef) => {
      const learnCourse = get().learnCourse;
      if (!learnCourse) return false;
      const tree = chainFromOutline(outline, bookRef);
      if (tree.length === 0) {
        set({ notice: '还没有章节目录：先在「阅读」模式导入目录' });
        return false;
      }
      set({ busy: true });
      try {
        await putSyllabus(learnCourse.learn_course_id, tree);
        await loadUnits(learnCourse.learn_course_id);
        await refreshDerived(get().courseId, learnCourse.learn_course_id);
        set({ notice: `链路草稿已生成（${tree.length} 章）：确认后编译` });
        return true;
      } catch (err) {
        set({ notice: describeError(err) });
        return false;
      } finally {
        set({ busy: false });
      }
    },

    confirmAll: async () => {
      const { learnCourse, units } = get();
      if (!learnCourse) return false;
      set({ busy: true });
      try {
        for (const unit of units) {
          if (!unit.confirmed) await patchLearnUnit(unit.unit_id, { confirmed: true });
        }
        await loadUnits(learnCourse.learn_course_id);
        set({ notice: '两级确认已齐备，可以编译' });
        return true;
      } catch (err) {
        set({ notice: describeError(err) });
        return false;
      } finally {
        set({ busy: false });
      }
    },

    compile: async () => {
      const { learnCourse, units } = get();
      if (!learnCourse) return false;
      const windows = windowsOfUnits(units);
      if (!windows) {
        set({ notice: '链路块都没有页窗，无法登记编译页窗（先重新从目录生成链路）' });
        return false;
      }
      set({ busy: true, compiling: true });
      try {
        await proposeCompile(learnCourse.learn_course_id, windows);
        await startCompile(learnCourse.learn_course_id);
        for (let i = 0; i < COMPILE_POLL_LIMIT; i += 1) {
          const status = await getCompileStatus(learnCourse.learn_course_id);
          if (status.compile_status !== 'running') break;
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        await loadUnits(learnCourse.learn_course_id);
        await refreshDerived(get().courseId, learnCourse.learn_course_id);
        set({ notice: '编译完成：块序列可读' });
        return true;
      } catch (err) {
        set({ notice: describeError(err) });
        return false;
      } finally {
        set({ busy: false, compiling: false });
      }
    },

    selectUnit: async (unitId) => {
      if (unitId === get().selectedUnitId) return;
      const unit = get().units.find((u) => u.unit_id === unitId) ?? null;
      const range = windowOfUnit(unit);
      set({
        selectedUnitId: unitId,
        range,
        bookId: range?.ref_id ?? null,
        pages: {},
        loadedThrough: 0,
      });
      if (range && range.ref_id) await advanceBatch();
    },

    loadMorePages: () => advanceBatch(),

    mark: async (unitId, status) => {
      const { learnCourse } = get();
      if (!learnCourse) return;
      set({ busy: true });
      try {
        await setLearnProgress(learnCourse.learn_course_id, unitId, status);
        // covered 是学习者勾选位（判据 S2「断点标记」），只随人工推进写
        if (unitConfirmed(get().units, unitId)) {
          await patchLearnUnit(unitId, { covered: status === 'done' });
        }
        await refreshDerived(get().courseId, learnCourse.learn_course_id);
        await loadUnits(learnCourse.learn_course_id);
      } catch (err) {
        set({ notice: describeError(err) });
      } finally {
        set({ busy: false });
      }
    },

    jumpToCurrent: async () => {
      const current = get().progress?.current_unit_id ?? null;
      if (!current) {
        set({ notice: '本课还没有进度（先从目录生成链路并编译）' });
        return;
      }
      await get().selectUnit(current);
    },

    clearNotice: () => set({ notice: null }),
  };
});

function unitConfirmed(units: LearnUnit[], unitId: string): boolean {
  return Boolean(units.find((u) => u.unit_id === unitId)?.confirmed);
}
