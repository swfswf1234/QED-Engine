/**
 * 下载管理 store（Phase 4a + 五层化，QED-031；2026-08-18 ARCH-015 重构）
 * - 数据源：/catalogs/math-qe（课程结构）+ /knowledge（知识行列表）+ 并行拉取
 *   /knowledge/{id} 详情（含书行 books，逐行独立降级）
 * - 独立降级：8900 不可达 → 整体错误；catalog / knowledge 各自失败互不拖累；
 *   详情拉取失败仅该知识行书行缺失（树/状态不受影响）
 * - 树构建（buildTreeNodes 纯函数）：领域(DOMAIN_NAME) → 分类(DOMAIN_MAP/DOMAIN_ORDER)
 *   → 课程(COURSE_ORDER) → 教程（叶子，展示 label + 验收进度 verified/total；
 *   kind=tutorial 套节点 isSet=true，kind=other_material 单条目教程）
 * - 书行展示顺序 sortBooks：中文教材 → 中文习题集 → 其余；组内册数递增
 * - 流程筛选 bookInFlow：搜索=候选 / 确认=已决定 / 下载=下载中+已下载+失败 / 验收=已验证
 * - 树宽拖拽：280–640px，localStorage 记忆（DOWNLOADS_TREE_WIDTH_KEY）
 * - 领域/分类/排序常量自 courseMeta 公共模块（学习中心共用）
 */
import { create } from 'zustand';
import {
  listCatalog, listKnowledge, getKnowledge,
} from '../api/tracker';
import type { BookRecord, CatalogTarget, KnowledgeDetail, KnowledgeRecord } from './index';

// 公共课程元数据（领域/分类/排序），与学习中心共用；历史导出名保持兼容
import { COURSE_ORDER, DOMAIN_MAP, DOMAIN_NAME, DOMAIN_ORDER, DOMAIN_OTHER, courseOrderCmp, domainOf } from './courseMeta';
export { COURSE_ORDER, DOMAIN_MAP, DOMAIN_NAME, DOMAIN_ORDER, DOMAIN_OTHER, courseOrderCmp, domainOf };

/** 树宽 localStorage 键 */
export const DOWNLOADS_TREE_WIDTH_KEY = 'qed-downloads-tree-w';
export const TREE_WIDTH_MIN = 280;
export const TREE_WIDTH_MAX = 640;
export const TREE_WIDTH_DEFAULT = 400;

/** 教程节点 label：知识行 name 优先（QED-Tracker 侧统一命名），空则「教程N」兜底 */
export function tutorialLabel(k: KnowledgeRecord): string {
  const name = String(k.name ?? '').trim();
  if (name) return name;
  const setNo = String(k.set_no ?? '').trim();
  if (setNo) return `教程${setNo}`;
  return k.knowledge_id;
}

// --- 流程筛选（ARCH-015 D2 用户裁决） ---

/** 流程筛选选项（生命周期四段） */
export const FLOW_OPTIONS = [
  { value: 'search', label: '搜索' },
  { value: 'confirm', label: '确认' },
  { value: 'download', label: '下载' },
  { value: 'verify', label: '验收' },
] as const;

/** 书行是否属于某流程；flow=''（全部）不过滤 */
export function bookInFlow(b: BookRecord, flow: string): boolean {
  switch (flow) {
    case 'search': return b.status === 'candidate';
    case 'confirm': return b.status === 'decided';
    case 'download': return b.status === 'downloading' || b.status === 'downloaded' || b.status === 'failed';
    case 'verify': return b.status === 'verified';
    default: return true;
  }
}

// --- 书行排序（ARCH-015 D3 用户裁决） ---

/** 册号数值：第一~五册=1~5、上/中/下册=1/2/3、单册（空）=0（组首）、答案册=99（组尾） */
export function partNumber(part: string): number {
  const p = String(part ?? '').trim();
  if (!p) return 0;
  const seq = ['第一册', '第二册', '第三册', '第四册', '第五册'];
  const idx = seq.indexOf(p);
  if (idx >= 0) return idx + 1;
  if (p === '上册') return 1;
  if (p === '中册') return 2;
  if (p === '下册') return 3;
  if (p === '答案册') return 99;
  return 0;
}

/**
 * 书行排序（纯函数，不修改入参）：
 * 组序 ①中文教材(zh+textbook) → ②中文习题集(zh+exercise) → ③其余(英文教材/配套资料等)；
 * 组内册数递增（partNumber），同册数按 title 稳定序。
 */
export function sortBooks(books: BookRecord[]): BookRecord[] {
  const group = (b: BookRecord): number => {
    const zh = (b.language ?? '') === 'zh';
    if (zh && b.kind === 'textbook') return 0;
    if (zh && b.kind === 'exercise') return 1;
    return 2;
  };
  return [...books].sort((a, b) => {
    const ga = group(a);
    const gb = group(b);
    if (ga !== gb) return ga - gb;
    const na = partNumber(a.part);
    const nb = partNumber(b.part);
    if (na !== nb) return na - nb;
    return (a.title ?? '').localeCompare(b.title ?? '', 'zh-Hans-CN');
  });
}

// --- 树结构 ---

export interface TutorialNode {
  /** 教程 key（选中用）：courseId::kn:<knowledge_id> */
  key: string;
  /** 教程显示名：知识行 name / 教程N / knowledge_id */
  label: string;
  knowledge: KnowledgeRecord;
  /** 所辖书行（来自详情缓存，可能为空/加载失败） */
  items: BookRecord[];
  /** 是否套节点（kind=tutorial）；other_material 单条目教程为叶子 */
  isSet: boolean;
  /** 已验收书行数（status=verified） */
  verified: number;
  /** 书行总数 */
  total: number;
}

export interface CourseNode {
  id: string;
  name: string;
  domain: string;
  tutorials: TutorialNode[];
}

/** 分类节点（分析/代数/概率/其他）：仅展示分组，不可点击 */
export interface CategoryNode {
  name: string;
  courses: CourseNode[];
}

export interface DomainNode {
  name: string;
  categories: CategoryNode[];
}

/** 知识行 → 教程叶子节点（kind=tutorial 按 set_no 数值升序，其余按 name） */
function buildTutorials(courseId: string, knowledge: KnowledgeRecord[], details: Record<string, KnowledgeDetail>): TutorialNode[] {
  const nodes: TutorialNode[] = knowledge.map((k) => {
    const items = details[k.knowledge_id]?.books ?? [];
    return {
      key: `${courseId}::kn:${k.knowledge_id}`,
      label: tutorialLabel(k),
      knowledge: k,
      items,
      isSet: k.kind === 'tutorial',
      verified: items.filter((b) => b.status === 'verified').length,
      total: items.length,
    };
  });
  nodes.sort((a, b) => {
    const an = Number(a.knowledge.set_no) || 0;
    const bn = Number(b.knowledge.set_no) || 0;
    if (an !== bn) return an - bn;
    // 英文套排中文套后（套号 0 且 set_no 非空，如 en）
    const ao = a.knowledge.set_no && Number(a.knowledge.set_no) === 0 ? 1 : 0;
    const bo = b.knowledge.set_no && Number(b.knowledge.set_no) === 0 ? 1 : 0;
    if (ao !== bo) return ao - bo;
    return a.label.localeCompare(b.label, 'zh-Hans-CN');
  });
  return nodes;
}

/**
 * 构建左树（纯函数）：领域 → 分类 → 课程 → 教程
 * - 课程：catalog targets 去重 course_id（name 取 course_name）；知识行独有课程兜底（name=course_id）
 * - 分类：DOMAIN_MAP 映射 + DOMAIN_ORDER 排序；未映射课程归「其他」（最后）
 * - 领域：唯一「高等数学」（DOMAIN_NAME）；无数据返回空数组
 */
export function buildTreeNodes(
  catalogTargets: CatalogTarget[],
  knowledge: KnowledgeRecord[],
  details: Record<string, KnowledgeDetail> = {},
): DomainNode[] {
  const byCourse = new Map<string, KnowledgeRecord[]>();
  for (const k of knowledge) {
    if (!byCourse.has(k.course_id)) byCourse.set(k.course_id, []);
    byCourse.get(k.course_id)!.push(k);
  }

  const courses = new Map<string, { id: string; name: string }>();
  for (const t of catalogTargets) {
    if (!courses.has(t.course_id)) courses.set(t.course_id, { id: t.course_id, name: t.course_name });
  }
  for (const cid of byCourse.keys()) {
    if (!courses.has(cid)) courses.set(cid, { id: cid, name: cid });
  }

  const byCategory = new Map<string, CourseNode[]>();
  for (const course of courses.values()) {
    const category = domainOf(course.id);
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push({
      id: course.id,
      name: course.name,
      domain: category,
      tutorials: buildTutorials(course.id, byCourse.get(course.id) ?? [], details),
    });
  }

  if (byCategory.size === 0) return [];

  const categoryOrder = [...DOMAIN_ORDER, DOMAIN_OTHER];
  const categories: CategoryNode[] = [...byCategory.entries()]
    .sort(([a], [b]) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      return ((ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)) || a.localeCompare(b);
    })
    .map(([name, courseList]) => ({
      name,
      courses: courseList.sort((a, b) => courseOrderCmp(a.id, b.id)),
    }));

  return [{ name: DOMAIN_NAME, categories }];
}

// --- store ---

export type NodeSelection = { kind: 'domain'; id: string } | { kind: 'course'; id: string } | { kind: 'tutorial'; key: string };

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface DownloadsStore {
  catalogTargets: CatalogTarget[];
  knowledge: KnowledgeRecord[];
  /** 详情缓存（knowledge_id → 含 books），拉取失败的知识行无条目 */
  details: Record<string, KnowledgeDetail>;
  loading: boolean;
  /** 整体错误（8900 不可达） */
  error: string | null;
  /** catalog 独立错误 */
  catalogError: string | null;
  /** knowledge 独立错误 */
  knowledgeError: string | null;
  /** 筛选栏（与树选择单向联动：树 → 筛选）；flow=流程筛选（空=全部） */
  filters: { domain: string; course: string; status: string; flow: string };
  selected: NodeSelection | null;
  treeWidth: number;
  setFilter: (key: 'domain' | 'course' | 'status' | 'flow', value: string) => void;
  selectNode: (sel: NodeSelection) => void;
  setTreeWidth: (width: number) => void;
  fetchAll: () => Promise<void>;
  /** 局部刷新单个知识行详情（操作成功后调用） */
  refreshDetail: (knowledgeId: string) => Promise<void>;
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
  knowledge: [],
  details: {},
  loading: false,
  error: null,
  catalogError: null,
  knowledgeError: null,
  filters: { domain: '', course: '', status: '', flow: '' },
  selected: null,
  treeWidth: readTreeWidth(),

  setFilter: (key, value) => {
    // 领域/课程互斥：选领域清课程；选课程保留领域
    const f = get().filters;
    const filters: DownloadsStore['filters'] = { ...f };
    if (key === 'domain') {
      filters.domain = value;
      filters.course = '';
    } else if (key === 'course') {
      filters.course = value;
    } else if (key === 'status') {
      filters.status = value;
    } else {
      filters.flow = value;
    }
    set({ filters });
  },

  selectNode: (sel) => {
    const { status, flow } = get().filters;
    set({ selected: sel });
    if (sel.kind === 'domain') {
      // 领域 → 领域筛选（清课程筛选；保留状态/流程）
      set({ filters: { domain: sel.id, course: '', status, flow } });
    } else if (sel.kind === 'course') {
      const course = get().catalogTargets.find((t) => t.course_id === sel.id);
      set({ filters: { domain: course ? domainOf(course.course_id) : '', course: sel.id, status, flow } });
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
    const [list, knErr] = await listKnowledge()
      .then((k) => [k, null] as const)
      .catch((err) => [null, err] as const);

    // 并行拉取每行详情（含 books），逐行独立降级：失败仅该行书行缺失
    let details: Record<string, KnowledgeDetail> = {};
    if (list && list.length > 0) {
      const settled = await Promise.allSettled(list.map((k) => getKnowledge(k.knowledge_id)));
      details = {};
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') details[list[index].knowledge_id] = result.value;
      });
    }

    set({
      catalogTargets: catalog?.targets ?? get().catalogTargets,
      knowledge: list ?? get().knowledge,
      details,
      catalogError: catalogErr ? messageOf(catalogErr) : null,
      knowledgeError: knErr ? messageOf(knErr) : null,
      error: catalogErr && knErr ? '8900 数据获取失败（catalog 与 knowledge 均不可达）' : null,
    });
    set({ loading: false });
  },

  refreshDetail: async (knowledgeId) => {
    const [detail, err] = await getKnowledge(knowledgeId)
      .then((d) => [d, null] as const)
      .catch((error) => [null, error] as const);
    if (detail) {
      set({ details: { ...get().details, [knowledgeId]: detail } });
    } else if (err) {
      set({ knowledgeError: messageOf(err) });
    }
  },
}));
