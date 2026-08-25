/**
 * 文档下载管理 store v2（2026-08-24 REQ-059 交互改版：左树真实领域课程体系）
 * - 数据源：/courses（GET，QED-Tracker 领域课程体系，math-qe 冻结目录退出 UI）
 *   + /knowledge（知识行列表）+ 并行拉取 /knowledge/{id} 详情（逐行独立降级）
 * - 独立降级：8900 不可达 → 整体错误；课程体系 / knowledge 各自失败互不拖累；
 *   详情拉取失败仅该知识行书行缺失（树/状态不受影响）
 * - 树构建（buildTreeNodes 纯函数）：领域（真实 domain_id）→ 课程 → 教程叶子
 *   （label + 验收进度 verified/total；kind=tutorial 套节点 isSet=true，
 *   kind=other_material 单条目教程）；知识行所属课程不在体系中时不进树
 * - 书行展示顺序 sortBooks：中文教材 → 中文习题集 → 其余；组内册数递增
 * - 状态筛选 bookInStage：待确认=candidate / 下载=decided+downloading+failed /
 *   待验证=downloaded / 已完成=verified（2026-08-24 用户裁决三栏收敛）
 * - 树宽拖拽：280–640px，localStorage 记忆（DOWNLOADS_TREE_WIDTH_KEY）
 */
import { create } from 'zustand';
import {
  listCourseSystem, listKnowledge, getKnowledge,
} from '../api/tracker';
import type { BookRecord, DomainSystem, KnowledgeDetail, KnowledgeRecord } from './index';

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

// --- 状态筛选（书行生命周期四阶段，2026-08-24 用户裁决：筛选收敛为 领域/课程/状态 三栏） ---

/** 状态筛选选项（书行阶段；decided/downloading/failed 归「下载」，failed 可在此重试） */
export const STAGE_OPTIONS = [
  { value: 'confirm', label: '待确认' },
  { value: 'download', label: '下载' },
  { value: 'await_verify', label: '待验证' },
  { value: 'completed', label: '已完成' },
] as const;

/** 书行是否属于某阶段；stage=''（全部）不过滤 */
export function bookInStage(b: BookRecord, stage: string): boolean {
  switch (stage) {
    case 'confirm': return b.status === 'candidate';
    case 'download': return b.status === 'decided' || b.status === 'downloading' || b.status === 'failed';
    case 'await_verify': return b.status === 'downloaded';
    case 'completed': return b.status === 'verified';
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

// --- 树结构（v2：领域 → 课程 → 教程，无分类层） ---

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
  /** 所属领域 id（真实 domain_id，非分类名） */
  domainId: string;
  tutorials: TutorialNode[];
}

export interface DomainNode {
  /** 树节点 key：d:<domain_id> */
  key: string;
  domainId: string;
  name: string;
  description: string;
  courses: CourseNode[];
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
 * 构建左树（纯函数，v2）：领域 → 课程 → 教程
 * - 数据源为 GET /courses 的领域课程体系（服务端已按 sort_order 排序），顺序保持返回序
 * - 教程按 course_id 归组挂到对应课程；知识行所属课程不在体系中时不进树（不虚构兜底节点）
 * - 无课程体系返回空数组
 */
export function buildTreeNodes(
  domains: DomainSystem[],
  knowledge: KnowledgeRecord[],
  details: Record<string, KnowledgeDetail> = {},
): DomainNode[] {
  if (domains.length === 0) return [];
  const byCourse = new Map<string, KnowledgeRecord[]>();
  for (const k of knowledge) {
    if (!byCourse.has(k.course_id)) byCourse.set(k.course_id, []);
    byCourse.get(k.course_id)!.push(k);
  }

  return domains.map((d) => ({
    key: `d:${d.domain_id}`,
    domainId: d.domain_id,
    name: d.name,
    description: d.description ?? '',
    courses: d.courses.map((c) => ({
      id: c.course_id,
      name: c.name,
      domainId: d.domain_id,
      tutorials: buildTutorials(c.course_id, byCourse.get(c.course_id) ?? [], details),
    })),
  }));
}

// --- store ---

export type NodeSelection = { kind: 'domain'; id: string } | { kind: 'course'; id: string } | { kind: 'tutorial'; key: string };

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface DownloadsStore {
  /** 领域课程体系（GET /courses 原样，v2 左树数据源） */
  domains: DomainSystem[];
  knowledge: KnowledgeRecord[];
  /** 详情缓存（knowledge_id → 含 books），拉取失败的知识行无条目 */
  details: Record<string, KnowledgeDetail>;
  loading: boolean;
  /** 整体错误（8900 不可达） */
  error: string | null;
  /** 课程体系独立错误（8901 离线等） */
  systemError: string | null;
  /** knowledge 独立错误 */
  knowledgeError: string | null;
  /** 筛选栏三栏（2026-08-24 收敛）：领域/课程 + 状态=书行阶段（stage，空=全部）；
   *  与树选择单向联动：树 → 筛选；domain 存 domain_id */
  filters: { domain: string; course: string; stage: string };
  selected: NodeSelection | null;
  treeWidth: number;
  setFilter: (key: 'domain' | 'course' | 'stage', value: string) => void;
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
  domains: [],
  knowledge: [],
  details: {},
  loading: false,
  error: null,
  systemError: null,
  knowledgeError: null,
  filters: { domain: '', course: '', stage: '' },
  selected: null,
  treeWidth: readTreeWidth(),

  setFilter: (key, value) => {
    // 领域/课程互斥：选领域清课程；选课程保留领域；状态（书行阶段）独立叠加
    const f = get().filters;
    const filters: DownloadsStore['filters'] = { ...f };
    if (key === 'domain') {
      filters.domain = value;
      filters.course = '';
    } else if (key === 'course') {
      filters.course = value;
    } else {
      filters.stage = value;
    }
    set({ filters });
  },

  selectNode: (sel) => {
    const { stage } = get().filters;
    set({ selected: sel });
    if (sel.kind === 'domain') {
      // 领域 → 领域筛选（清课程筛选；保留状态）
      set({ filters: { domain: sel.id, course: '', stage } });
    } else if (sel.kind === 'course') {
      const dom = get().domains.find((d) => d.courses.some((c) => c.course_id === sel.id));
      set({ filters: { domain: dom?.domain_id ?? '', course: sel.id, stage } });
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
    const [system, sysErr] = await listCourseSystem()
      .then((s) => [s, null] as const)
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
      domains: system ?? get().domains,
      knowledge: list ?? get().knowledge,
      details,
      systemError: sysErr ? messageOf(sysErr) : null,
      knowledgeError: knErr ? messageOf(knErr) : null,
      error: sysErr && knErr ? '8900 数据获取失败（课程体系与知识行均不可达）' : null,
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
