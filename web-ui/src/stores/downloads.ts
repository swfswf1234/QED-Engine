/**
 * 文档下载管理 store v2（2026-08-24 REQ-059 交互改版：左树真实领域课程体系）
 * - 数据源：/courses（GET，QED-Tracker 领域课程体系，math-qe 冻结目录退出 UI）
 *   + /knowledge（教程列表）+ 并行拉取 /knowledge/{id} 详情（逐行独立降级）
 * - 独立降级：8900 不可达 → 整体错误；课程体系 / knowledge 各自失败互不拖累；
 *   详情拉取失败仅该教程书籍缺失（树/状态不受影响）
 * - 树构建（buildTreeNodes 纯函数）：领域（真实 domain_id）→ 课程 → 教程叶子
 *   （label + 验收进度 verified/total；kind=tutorial 套节点 isSet=true，
 *   kind=other_material 单条目教程）；教程所属课程不在体系中时不进树
 * - 书籍展示顺序 sortBooks：中文教材 → 中文习题集 → 其余；组内册数递增
 * - 状态筛选 bookInStage：待确认=candidate / 下载=decided+downloading+failed /
 *   待验证=downloaded / 已完成=verified（2026-08-24 用户裁决三栏收敛）
 * - 树宽拖拽：280–640px，localStorage 记忆（DOWNLOADS_TREE_WIDTH_KEY）
 */
import { create } from 'zustand';
import { message } from 'antd';
import {
  listCourseSystem, listKnowledge, getKnowledge,
} from '../api/tracker';
import type { BookRecord, DomainSystem, KnowledgeDetail, KnowledgeRecord } from './index';

/** 轮询定时器引用（模块级，zustand store 不存储非序列化值） */
let _pollingTimer: ReturnType<typeof setInterval> | null = null;
/** 领域进入「探索中」的时刻（超时失效提示用，PLAN-033 §6） */
const _runningSince = new Map<string, number>();
/** 已提示过超时的领域（每次悬挂只提示一次） */
const _staleWarned = new Set<string>();
/** 探索中超时阈值：超过视为任务可能已失效（8900/8901 重启悬挂） */
export const RUNNING_STALE_MS = 30 * 60 * 1000;

/**
 * explore_pending 归一（8901 返回 dict / 共享表直读返回 JSON 字符串）。
 * 非法值返回 null（调用方按无 pending 处理）。
 */
export function parseExplorePending(raw: DomainSystem['explore_pending']): DomainSystem['explore_pending'] {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as DomainSystem['explore_pending']) : null;
    } catch {
      return null;
    }
  }
  return raw;
}

/** 树宽 localStorage 键 */
export const DOWNLOADS_TREE_WIDTH_KEY = 'qed-downloads-tree-w';
export const TREE_WIDTH_MIN = 280;
export const TREE_WIDTH_MAX = 640;
export const TREE_WIDTH_DEFAULT = 400;

/** 教程节点 label：name 优先（QED-Tracker 侧统一命名），空则「教程N」兜底 */
export function tutorialLabel(k: KnowledgeRecord): string {
  const name = String(k.name ?? '').trim();
  if (name) return name;
  const setNo = String(k.set_no ?? '').trim();
  if (setNo) return `教程${setNo}`;
  return k.knowledge_id;
}

// --- 状态筛选（书籍生命周期五阶段，2026-09-10 用户裁决：筛选收敛为 领域/课程/状态 三栏） ---

/** 状态筛选选项（书籍阶段；candidate/decided 归「待下载」，downloading 归「下载中」，downloaded 归「待验证」，verified 归「已完成」，failed 归「失败」） */
export const STAGE_OPTIONS = [
  { value: 'to_download', label: '待下载' },
  { value: 'downloading', label: '下载中' },
  { value: 'to_verify', label: '待验证' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
] as const;

/** 书籍是否属于某阶段；stage=''（全部）不过滤 */
export function bookInStage(b: BookRecord, stage: string): boolean {
  switch (stage) {
    case 'to_download': return b.status === 'candidate' || b.status === 'decided';
    case 'downloading': return b.status === 'downloading';
    case 'to_verify': return b.status === 'downloaded';
    case 'completed': return b.status === 'verified';
    case 'failed': return b.status === 'failed';
    default: return true;
  }
}

// --- 书籍排序（ARCH-015 D3 用户裁决） ---

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
 * 书籍排序（纯函数，不修改入参）：
 * 组序 ①中文教材(zh+textbook) → ②中文习题集(zh+exercise) → ③英文教材(en+textbook) → ④其余；
 * 组内册数递增（partNumber），同册数按 title 稳定序。
 */
export function sortBooks(books: BookRecord[]): BookRecord[] {
  const group = (b: BookRecord): number => {
    const lang = (b.language ?? '').toLowerCase();
    if (lang === 'zh' && b.kind === 'textbook') return 0;   // 中文教材
    if (lang === 'zh' && b.kind === 'exercise') return 1;   // 中文习题集
    if (lang === 'en' && b.kind === 'textbook') return 2;   // 英文教材
    return 3;                                                // 其余
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
  /** 教程显示名：教程 name / 教程N / knowledge_id */
  label: string;
  knowledge: KnowledgeRecord;
  /** 所辖书籍（来自详情缓存，可能为空/加载失败） */
  items: BookRecord[];
  /** 是否套节点（kind=tutorial）；other_material 单条目教程为叶子 */
  isSet: boolean;
  /** 已验收书籍数（status=verified） */
  verified: number;
  /** 书籍总数 */
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

/** 教程 → 教程叶子节点（kind=tutorial 按 set_no 数值升序，其余按 name） */
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
 * - 课程按 sort_order 排序（服务端保证），前端无需额外排序
 * - 教程按 course_id 归组挂到对应课程；教程所属课程不在体系中时不进树（不虚构兜底节点）
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
  /** 详情缓存（knowledge_id → 含 books），拉取失败的教程无条目 */
  details: Record<string, KnowledgeDetail>;
  loading: boolean;
  /** 整体错误（8900 不可达） */
  error: string | null;
  /** 课程体系独立错误（8901 离线等） */
  systemError: string | null;
  /** knowledge 独立错误 */
  knowledgeError: string | null;
  /** 降级模式：课程体系成功但教程失败（8901不可用） */
  isDegraded: boolean;
  /** 筛选栏三栏（2026-08-24 收敛）：领域/课程 + 状态=书籍阶段（stage，空=全部）；
   *  与树选择单向联动：树 → 筛选；domain 存 domain_id */
  filters: { domain: string; course: string; stage: string };
  selected: NodeSelection | null;
  treeWidth: number;
  setFilter: (key: 'domain' | 'course' | 'stage', value: string) => void;
  selectNode: (sel: NodeSelection) => void;
  setTreeWidth: (width: number) => void;
  fetchAll: () => Promise<void>;
  /** 局部刷新单个教程详情（操作成功后调用） */
  refreshDetail: (knowledgeId: string) => Promise<void>;
  /** REQ-067 B8：启动 exploration_stage 轮询（5s 间隔） */
  startPolling: () => void;
  /** 停止轮询 */
  stopPolling: () => void;
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
  isDegraded: false,
  filters: { domain: '', course: '', stage: '' },
  selected: null,
  treeWidth: readTreeWidth(),

  setFilter: (key, value) => {
    // 领域/课程互斥：选领域清课程；选课程保留领域；状态（书籍阶段）独立叠加
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

    // 并行拉取每行详情（含 books），逐行独立降级：失败仅该行书籍缺失
    let details: Record<string, KnowledgeDetail> = {};
    if (list && list.length > 0) {
      const settled = await Promise.allSettled(list.map((k) => getKnowledge(k.knowledge_id)));
      details = {};
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') details[list[index].knowledge_id] = result.value;
      });
    }

    const newDomains = system ?? get().domains;
    const currentSelected = get().selected;
    const newSelected = currentSelected === null && newDomains.length > 0
      ? { kind: 'domain' as const, id: newDomains[0].domain_id }
      : currentSelected;

    // 检测降级状态：课程体系成功但教程失败（8901不可用）
    const isDegraded = system !== null && knErr !== null;
    
    set({
      domains: newDomains,
      knowledge: list ?? get().knowledge,
      details,
      systemError: sysErr ? messageOf(sysErr) : null,
      knowledgeError: knErr ? messageOf(knErr) : null,
      error: sysErr && knErr ? '8900 数据获取失败（课程体系与教程均不可达）' : null,
      selected: newSelected,
      isDegraded,
      ...(newSelected && newSelected !== currentSelected && newSelected.kind === 'domain' ? {
        filters: { domain: newSelected.id, course: '', stage: get().filters.stage },
      } : {}),
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

  // --- REQ-067 B8 + PLAN-033 §6：exploration_stage 轮询（5s 间隔） ---
  // explore_pending 变化检测 + 探索中超时失效提示（不做自动回写，刷新/重试承接）
  startPolling: () => {
    const { stopPolling } = get();
    stopPolling(); // 先清除旧轮询
    const timer = setInterval(async () => {
      const currentDomains = get().domains;
      if (currentDomains.length === 0) return;
      try {
        const latest = await listCourseSystem();
        // 检查是否有领域从探索中变为其他态（终态通知按 explore_pending.kind 细分）
        for (const fresh of latest) {
          const old = currentDomains.find((d) => d.domain_id === fresh.domain_id);
          if (old && old.exploration_stage === '探索中' && fresh.exploration_stage !== '探索中') {
            _runningSince.delete(fresh.domain_id);
            const pending = parseExplorePending(fresh.explore_pending);
            if (fresh.exploration_stage === '已完成') {
              message.success(`领域「${fresh.name}」探索完成`);
            } else if (fresh.exploration_stage === '待确认') {
              if (pending?.kind === 'name_confirmation' || pending?.kind === 'name_confirm') {
                message.info(`领域「${fresh.name}」探索完成，需确认名称`);
              } else if (pending?.kind === 'error') {
                message.warning(`领域「${fresh.name}」探索中断：${pending.error ?? '未知错误'}`);
              } else {
                const courseCount = pending?.kind === 'review_results' || pending?.kind === 'import_courses'
                  ? pending.courses.length
                  : fresh.courses.length;
                message.info(`领域「${fresh.name}」课程名单待确认（${courseCount} 门）`);
              }
            } else if (fresh.exploration_stage === '失败') {
              message.warning(`领域「${fresh.name}」探索失败，可重试`);
            }
          }
        }
        // 探索中超时失效提示（PLAN-033 §6：8900/8901 重启可能致悬挂，提示人工重试）
        const now = Date.now();
        for (const fresh of latest) {
          if (fresh.exploration_stage === '探索中') {
            const since = _runningSince.get(fresh.domain_id) ?? now;
            _runningSince.set(fresh.domain_id, since);
            if (now - since > RUNNING_STALE_MS && !_staleWarned.has(fresh.domain_id)) {
              _staleWarned.add(fresh.domain_id);
              message.warning(`领域「${fresh.name}」长时间处于探索中，任务可能已失效，可重试探索`);
            }
          } else {
            _runningSince.delete(fresh.domain_id);
            _staleWarned.delete(fresh.domain_id);
          }
        }
        // 更新 domains（含 explore_pending 字段，驱动右侧提示条）
        set({ domains: latest });
      } catch {
        // 轮询失败静默忽略（fetchAll 会处理离线状态）
      }
    }, 5000);
    // 存储 timer 到一个外部变量（zustand store 无法直接存储非序列化值）
    _pollingTimer = timer;
  },

  stopPolling: () => {
    if (_pollingTimer !== null) {
      clearInterval(_pollingTimer);
      _pollingTimer = null;
    }
  },
}));
