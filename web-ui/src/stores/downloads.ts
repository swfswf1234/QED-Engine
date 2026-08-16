/**
 * 下载管理 store（Phase 4a：左树 + 筛选 + 选中 + 树宽）
 * - 数据源：/catalogs/math-qe（课程结构）+ /selections（表1，含 set_no/roles/downloads）
 * - 独立降级：8900 不可达 → 整体错误；catalog/selections 各自失败互不拖累
 * - 树构建（buildTreeNodes 纯函数）：领域(DOMAIN_MAP) → 课程(COURSE_ORDER) → 教程
 *   （confirmed+set_no 合并为「套N」；confirmed 无 set_no / candidate / backup 单条目教程）
 * - 树宽拖拽：280–640px，localStorage 记忆（DOWNLOADS_TREE_WIDTH_KEY）
 * - 领域/排序常量自 courseMeta 公共模块（学习中心共用）
 */
import { create } from 'zustand';
import { listCatalog, listSelections } from '../api/tracker';
import type { CatalogTarget, SelectionRecord } from './index';

// 公共课程元数据（领域/排序），与学习中心共用；历史导出名保持兼容
import { COURSE_ORDER, DOMAIN_MAP, DOMAIN_ORDER, DOMAIN_OTHER, courseOrderCmp, domainOf } from './courseMeta';
export { COURSE_ORDER, DOMAIN_MAP, DOMAIN_ORDER, DOMAIN_OTHER, courseOrderCmp, domainOf };

/** 树宽 localStorage 键 */
export const DOWNLOADS_TREE_WIDTH_KEY = 'qed-downloads-tree-w';
export const TREE_WIDTH_MIN = 280;
export const TREE_WIDTH_MAX = 640;
export const TREE_WIDTH_DEFAULT = 400;

// --- 树结构 ---

export interface TutorialNode {
  /** 教程 key（选中用）：courseId::set:<set_no> | courseId::sel:<selection_id> */
  key: string;
  /** 教程显示名：套N / 单条目书名 */
  label: string;
  items: SelectionRecord[];
  /** 是否套分组（confirmed+set_no） */
  isSet: boolean;
}

export interface CourseNode {
  id: string;
  name: string;
  domain: string;
  tutorials: TutorialNode[];
}

export interface DomainNode {
  name: string;
  courses: CourseNode[];
}

/** 表1 条目 → 教程分组（confirmed 按 set_no 合并；其余单条目） */
function buildTutorials(courseId: string, selections: SelectionRecord[]): TutorialNode[] {
  const sets = new Map<string, SelectionRecord[]>();
  const singles: SelectionRecord[] = [];
  for (const s of selections) {
    const sn = String(s.set_no ?? '').trim();
    if (s.status === 'confirmed' && sn) {
      if (!sets.has(sn)) sets.set(sn, []);
      sets.get(sn)!.push(s);
    } else {
      singles.push(s);
    }
  }
  const nodes: TutorialNode[] = [...sets.entries()]
    .sort(([a], [b]) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(b))
    .map(([sn, items]) => ({
      key: `${courseId}::set:${sn}`,
      label: `套${sn}`,
      items,
      isSet: true,
    }));
  for (const s of singles) {
    nodes.push({
      key: `${courseId}::sel:${s.selection_id}`,
      label: s.title,
      items: [s],
      isSet: false,
    });
  }
  return nodes;
}

/**
 * 构建左树（纯函数）：领域 → 课程 → 教程
 * - 课程：catalog targets 去重 course_id（name 取 course_name）；表1 独有课程兜底（name=course_id）
 * - 领域：DOMAIN_MAP 映射 + DOMAIN_ORDER 排序；未映射课程归「其他」（最后）
 */
export function buildTreeNodes(catalogTargets: CatalogTarget[], selections: SelectionRecord[]): DomainNode[] {
  const byCourseSel = new Map<string, SelectionRecord[]>();
  for (const s of selections) {
    if (!byCourseSel.has(s.course_id)) byCourseSel.set(s.course_id, []);
    byCourseSel.get(s.course_id)!.push(s);
  }

  const courses = new Map<string, { id: string; name: string }>();
  for (const t of catalogTargets) {
    if (!courses.has(t.course_id)) courses.set(t.course_id, { id: t.course_id, name: t.course_name });
  }
  for (const cid of byCourseSel.keys()) {
    if (!courses.has(cid)) courses.set(cid, { id: cid, name: cid });
  }

  const byDomain = new Map<string, CourseNode[]>();
  for (const course of courses.values()) {
    const domain = domainOf(course.id);
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push({
      id: course.id,
      name: course.name,
      domain,
      tutorials: buildTutorials(course.id, byCourseSel.get(course.id) ?? []),
    });
  }

  const domainOrder = [...DOMAIN_ORDER, DOMAIN_OTHER];
  return [...byDomain.entries()]
    .sort(([a], [b]) => {
      const ia = domainOrder.indexOf(a);
      const ib = domainOrder.indexOf(b);
      return ((ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)) || a.localeCompare(b);
    })
    .map(([name, courseList]) => ({
      name,
      courses: courseList.sort((a, b) => courseOrderCmp(a.id, b.id)),
    }));
}

// --- store ---

export type NodeSelection = { kind: 'domain'; id: string } | { kind: 'course'; id: string } | { kind: 'tutorial'; key: string };

export interface DownloadsStore {
  catalogTargets: CatalogTarget[];
  selections: SelectionRecord[];
  loading: boolean;
  /** 整体错误（8900 不可达） */
  error: string | null;
  /** catalog 独立错误 */
  catalogError: string | null;
  /** selections 独立错误 */
  selectionsError: string | null;
  /** 筛选栏（与树选择单向联动：树 → 筛选） */
  filters: { domain: string; course: string; status: string };
  selected: NodeSelection | null;
  treeWidth: number;
  setFilter: (key: 'domain' | 'course' | 'status', value: string) => void;
  selectNode: (sel: NodeSelection) => void;
  setTreeWidth: (width: number) => void;
  fetchAll: () => Promise<void>;
}

function readTreeWidth(): number {
  try {
    const v = Number(localStorage.getItem(DOWNLOADS_TREE_WIDTH_KEY));
    if (Number.isFinite(v) && v >= TREE_WIDTH_MIN && v <= TREE_WIDTH_MAX) return v;
  } catch {
    /* localStorage 不可用（隐私模式等）→ 默认 */
  }
  return TREE_WIDTH_DEFAULT;
}

export const useDownloadsStore = create<DownloadsStore>((set, get) => ({
  catalogTargets: [],
  selections: [],
  loading: false,
  error: null,
  catalogError: null,
  selectionsError: null,
  filters: { domain: '', course: '', status: '' },
  selected: null,
  treeWidth: readTreeWidth(),

  setFilter: (key, value) => {
    // 领域/课程互斥：选领域清课程；选课程保留领域
    const f = get().filters;
    const filters: DownloadsStore['filters'] =
      key === 'domain' ? { domain: value, course: '', status: f.status }
      : key === 'course' ? { ...f, course: value }
      : { ...f, status: value };
    set({ filters });
  },

  selectNode: (sel) => {
    const status = get().filters.status;
    set({ selected: sel });
    if (sel.kind === 'domain') {
      // 领域 → 领域筛选（清课程筛选）
      set({ filters: { domain: sel.id, course: '', status } });
    } else if (sel.kind === 'course') {
      const course = get().catalogTargets.find((t) => t.course_id === sel.id);
      set({ filters: { domain: course ? domainOf(course.course_id) : '', course: sel.id, status } });
    }
    // 教程选中：只高亮，不联动筛选
  },

  setTreeWidth: (width) => {
    const clamped = Math.min(TREE_WIDTH_MAX, Math.max(TREE_WIDTH_MIN, width));
    set({ treeWidth: clamped });
    try {
      localStorage.setItem(DOWNLOADS_TREE_WIDTH_KEY, String(clamped));
    } catch {
      /* 忽略 */
    }
  },

  fetchAll: async () => {
    if (get().loading) return;
    set({ loading: true });
    const [catalog, catalogErr] = await listCatalog()
      .then((c) => [c, null] as const)
      .catch((err) => [null, err] as const);
    const [selections, selErr] = await listSelections()
      .then((s) => [s, null] as const)
      .catch((err) => [null, err] as const);
    set({
      catalogTargets: catalog?.targets ?? get().catalogTargets,
      selections: selections ?? get().selections,
      catalogError: catalogErr ? (catalogErr instanceof Error ? catalogErr.message : String(catalogErr)) : null,
      selectionsError: selErr ? (selErr instanceof Error ? selErr.message : String(selErr)) : null,
      error: catalogErr && selErr ? '8900 数据获取失败（catalog 与 selections 均不可达）' : null,
    });
    set({ loading: false });
  },
}));