/**
 * 探索 store（exploration-ui 设计正文 §2/§3/§4；exploration-api 冻结契约消费方）
 * - 课程层：startCourse → 内部轮询（3s，连续 3 次失败本地转 failed 并停表）→ ready
 *   → adopt/discard 终态；历史列表 loadHistory
 * - 领域层：startCurriculum（新建领域）→ applyChanges（applied/partially_applied）
 * - mock 开关：localStorage qed-explore-mock=1 或 VITE_EXPLORE_MOCK=1 时走本地模拟后端
 *   （QED-Tracker 未就绪留白，端点就绪后无需改界面）
 */
import { create } from 'zustand';
import {
  launchCourseExplore, fetchExploreRun, adoptExploreRun, discardExploreRun,
  listCourseExploreRuns, launchCurriculumExplore, fetchCurriculumRun, applyCurriculumRun,
} from '../api/tracker';
import { describeError } from '../api/client';
import type {
  CurriculumRun, ExploreAdoptResult, ExploreLaunchMode, ExploreProposal, ExploreRun, ExploreRunSummary,
  KnowledgeRecord,
} from './index';
import { MAX_POLL_FAILURES, POLL_INTERVAL_MS } from './exploreRules';
import { isExploreMockEnabled } from './mockFlag';
import { exploreMockBackend } from './explore.mock';
import { useDownloadsStore } from './downloads';

export { EXPLORE_MAX_TUTORIALS, EXPLORE_MIN_CONFIRMED, POLL_INTERVAL_MS, MAX_POLL_FAILURES } from './exploreRules';
export { exploreStatusOf, remainingSlots, isCourseLocked } from './exploreRules';
export { isExploreMockEnabled };

/** 领域探索 apply 响应 */
export interface CurriculumApplyResult {
  applied: { change_id: string; entity: string; target_id: string }[];
  conflicts: { change_id: string; reason: string }[];
  run: CurriculumRun;
}

export interface ExploreParams {
  mode: ExploreLaunchMode;
  ref_text?: string;
  ref_doc_path?: string;
}

export interface ExploreStore {
  view: 'course' | 'curriculum';
  courseId: string | null;
  domainName: string | null;
  /** 当前运行（课程层 ExploreRun / 领域层 CurriculumRun） */
  run: ExploreRun | CurriculumRun | null;
  history: ExploreRunSummary[];
  error: string | null;
  launching: boolean;
  pollFailures: number;
  startCourse: (courseId: string, params: ExploreParams) => Promise<void>;
  startCurriculum: (domainName: string, params: ExploreParams) => Promise<void>;
  refresh: () => Promise<void>;
  adopt: (selected: string[]) => Promise<ExploreAdoptResult | null>;
  discard: () => Promise<void>;
  applyChanges: (selected: string[]) => Promise<CurriculumApplyResult | null>;
  loadHistory: (courseId?: string) => Promise<void>;
  /** 按 run_id 恢复查看历史运行（课程层；历史下拉入口） */
  openRun: (runId: string) => Promise<void>;
  /** 持久化恢复后续轮询（未终态 run 存在时重启定时器） */
  ensurePolling: () => void;
  reset: () => void;
}

/**
 * 探索流入口（2026-08-24 REQ-059 全弹窗流）：
 * - course：课程层探索（左树课程右键「探索教程」）
 * - curriculum：既有领域课程体系探索/重探（右面板按钮 + 领域右键「探索」；
 *   添加领域为纯手工表单，不再经探索流）
 */
export type ExploreFlowTarget =
  | { variant: 'course'; courseId: string; courseName?: string }
  | { variant: 'curriculum'; domainId: string; domainName: string };

/** 右面板探索按钮状态机（会话内）：running 置灰 / ready「查看探索结果」 / applied 终态置灰 */
export type DomainRunStatus = 'running' | 'ready' | 'applied';

interface ExploreUiStore {
  flowTarget: ExploreFlowTarget | null;
  /** 领域 id → 会话内探索状态（页面刷新后清零；服务端运行经幂等启动自然恢复） */
  domainRunStatus: Record<string, DomainRunStatus>;
  openFlow: (target: ExploreFlowTarget) => void;
  closeFlow: () => void;
  setDomainRunStatus: (domainId: string, status: DomainRunStatus | null) => void;
}

export const useExploreUiStore = create<ExploreUiStore>((set) => ({
  flowTarget: null,
  domainRunStatus: {},
  openFlow: (target) => set({ flowTarget: target }),
  closeFlow: () => set({ flowTarget: null }),
  setDomainRunStatus: (domainId, status) =>
    set((st) => {
      const next = { ...st.domainRunStatus };
      if (status === null) delete next[domainId];
      else next[domainId] = status;
      return { domainRunStatus: next };
    }),
}));

// 轮询定时器（模块级，不入 state 以免引用不可序列化告警）
let pollTimer: ReturnType<typeof setInterval> | null = null;

// 运行态持久化（2026-08-24 用户反馈：页面刷新即丢探索结果）：只存最近一条 run，
// 终态也保留供回看；新发起自动覆盖，reset 清除。
const RUN_STATE_KEY = 'qed-explore-run';

function persistRun(run: ExploreRun | CurriculumRun | null): void {
  try {
    if (run) localStorage.setItem(RUN_STATE_KEY, JSON.stringify(run));
    else localStorage.removeItem(RUN_STATE_KEY);
  } catch {
    /* localStorage 不可用：静默降级为会话内行为 */
  }
}

/** 页面加载时恢复最近一次探索运行（含终态回看与 running 续轮询） */
export function restorePersistedRun(): ExploreRun | CurriculumRun | null {
  try {
    const raw = localStorage.getItem(RUN_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExploreRun | CurriculumRun;
  } catch {
    return null;
  }
}

function stopPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

const TERMINAL_STATUSES = new Set(['ready', 'adopted', 'discarded', 'failed', 'applied', 'partially_applied']);

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * mock 模式专用：把采纳结果以 draft 教程行注入下载树（仅内存演示，刷新即消失；
 * 真实模式走 8901 adopt 落库后经 fetchAll 刷新）——2026-08-23 用户裁决方案 A
 */
function injectMockAdoption(
  courseId: string,
  adopted: { knowledge_id: string; set_name: string }[],
  proposals: ExploreProposal[],
): void {
  const ds = useDownloadsStore.getState();
  const rows: KnowledgeRecord[] = adopted.map((a) => {
    const p = proposals.find((x) => x.set_name === a.set_name);
    return {
      knowledge_id: a.knowledge_id,
      domain_id: 'math',
      course_id: courseId,
      kind: 'tutorial',
      set_no: '',
      name: [a.set_name, p?.textbook.title].filter(Boolean).join('：'),
      textbook_ref: p ? { title: p.textbook.title, ...(p.textbook.version ? { version: p.textbook.version } : {}) } : null,
      exercise_ref: p?.exercise ? { title: p.exercise.title } : null,
      textbook_intro: p?.textbook.intro ?? '',
      exercise_intro: p?.exercise?.intro ?? '',
      materials_intro: '',
      status: 'draft',
      reject_reason: '',
      supersede_reason: '',
      created_at: nowIso(),
      confirmed_at: null,
      completed_at: null,
    };
  });
  const details = { ...ds.details };
  for (const k of rows) details[k.knowledge_id] = { ...k, books: [] };
  useDownloadsStore.setState({ knowledge: [...ds.knowledge, ...rows], details });
}

/** mock 模式专用：领域探索应用后把新课程注入下载树领域体系（仅内存演示；create_domain 落新领域分组） */
function injectMockCurriculum(
  domainName: string,
  changes: { action: string; target_id: string; payload: Record<string, unknown> }[],
): void {
  const ds = useDownloadsStore.getState();
  const added = changes
    .filter((c) => c.action === 'create_course')
    .map((c) => ({
      course_id: c.target_id,
      name: String(c.payload?.name ?? c.target_id),
      aliases: [], stage: '', prerequisites: [], note: '',
    }));
  if (added.length === 0) return;
  const idx = ds.domains.findIndex((d) => d.name === domainName);
  if (idx >= 0) {
    const domains = ds.domains.map((d, i) =>
      i === idx ? { ...d, courses: [...d.courses.filter((c) => !added.some((a) => a.course_id === c.course_id)), ...added] } : d,
    );
    useDownloadsStore.setState({ domains });
  } else {
    // mock 初探（领域尚不存在）：追加新领域分组
    useDownloadsStore.setState({
      domains: [
        ...ds.domains,
        { domain_id: `mock-domain-${domainName}`, name: domainName, description: '', stages: [], courses: added },
      ],
    });
  }
}

export const useExploreStore = create<ExploreStore>((set, get) => ({
  view: 'course',
  courseId: null,
  domainName: null,
  // 2026-08-24：页面刷新后恢复最近一次探索运行（running 由弹窗打开时续轮询）
  run: restorePersistedRun(),
  history: [],
  error: null,
  launching: false,
  pollFailures: 0,

  reset: () => {
    stopPolling();
    set({
      view: 'course', courseId: null, domainName: null, run: null, history: [],
      error: null, launching: false, pollFailures: 0,
    });
    exploreMockBackend._resetRegistry();
  },

  startCourse: async (courseId, params) => {
    // 同课程已有未终态运行：不重复发起，续看/续轮询
    const cur0 = get().run;
    if (cur0?.scope === 'course' && cur0.course_id === courseId && !TERMINAL_STATUSES.has(cur0.status)) {
      get().ensurePolling();
      return;
    }
    stopPolling();
    set({ view: 'course', courseId, run: null, error: null, launching: true, pollFailures: 0 });
    try {
      const launched = isExploreMockEnabled()
        ? exploreMockBackend.launchCourse(courseId, params)
        : await launchCourseExplore(courseId, params);
      const run: ExploreRun = {
        run_id: launched.run_id, scope: 'course', course_id: courseId,
        status: 'running', params,
        proposals: [], adopted_proposal_ids: [], error: null,
        created_at: nowIso(), updated_at: nowIso(),
      };
      set({ run, launching: false });
      pollTimer = setInterval(() => void get().refresh(), POLL_INTERVAL_MS);
    } catch (err) {
      set({ error: describeError(err), launching: false });
    }
  },

  startCurriculum: async (domainName, params) => {
    // 同领域已有未终态运行：不重复发起（避免 ready 后连点叠加新运行）
    const cur0 = get().run;
    if (cur0?.scope === 'curriculum' && cur0.params.domain_name === domainName && !TERMINAL_STATUSES.has(cur0.status)) {
      get().ensurePolling();
      return;
    }
    stopPolling();
    set({ view: 'curriculum', domainName, run: null, error: null, launching: true, pollFailures: 0 });
    try {
      const launched = isExploreMockEnabled()
        ? exploreMockBackend.launchCurriculum(domainName, params)
        : await launchCurriculumExplore({ domain_name: domainName, ...params });
      const run: CurriculumRun = {
        run_id: launched.run_id, scope: 'curriculum', status: 'running',
        params: { domain_name: domainName, ...params },
        proposals: [], adopted_proposal_ids: [], conflicts: [], error: null,
        created_at: nowIso(), updated_at: nowIso(),
      };
      set({ run, launching: false });
      pollTimer = setInterval(() => void get().refresh(), POLL_INTERVAL_MS);
    } catch (err) {
      set({ error: describeError(err), launching: false });
    }
  },

  refresh: async () => {
    const current = get().run;
    if (!current || TERMINAL_STATUSES.has(current.status)) return;
    try {
      const next = current.scope === 'course'
        ? await (isExploreMockEnabled() ? Promise.resolve(exploreMockBackend.fetchRun(current.run_id)) : fetchExploreRun(current.run_id))
        : await (isExploreMockEnabled() ? Promise.resolve(exploreMockBackend.fetchCurriculum(current.run_id)) : fetchCurriculumRun(current.run_id));
      set({ run: next, pollFailures: 0, error: null });
      if (TERMINAL_STATUSES.has(next.status)) stopPolling();
    } catch (err) {
      const failures = get().pollFailures + 1;
      if (failures >= MAX_POLL_FAILURES) {
        // 连续失败上限：本地转 failed（保留 run_id 供恢复查询），停止轮询
        stopPolling();
        set({
          pollFailures: failures,
          error: `探索轮询连续 ${MAX_POLL_FAILURES} 次失败已停止（run_id=${current.run_id} 已保留，可重试或稍后恢复查询）`,
          run: { ...current, status: 'failed' } as ExploreRun | CurriculumRun,
        });
      } else {
        set({ pollFailures: failures });
      }
    }
  },

  adopt: async (selected) => {
    const current = get().run;
    if (!current || current.scope !== 'course' || current.status !== 'ready') return null;
    try {
      const result = isExploreMockEnabled()
        ? exploreMockBackend.adopt(current.run_id, selected)
        : await adoptExploreRun(current.run_id, selected);
      set({ run: result.run });
      stopPolling();
      // mock 模式：本地注入草稿教程，令「采纳 → 文档下载管理可见」闭环可预览（方案 A）
      if (isExploreMockEnabled()) {
        injectMockAdoption(current.course_id, result.adopted, current.proposals);
      }
      return result;
    } catch (err) {
      set({ error: describeError(err) });
      return null;
    }
  },

  discard: async () => {
    const current = get().run;
    if (!current || current.scope !== 'course' || current.status === 'discarded') return;
    try {
      const run = isExploreMockEnabled()
        ? exploreMockBackend.discard(current.run_id)
        : await discardExploreRun(current.run_id);
      set({ run });
      stopPolling();
    } catch (err) {
      set({ error: describeError(err) });
    }
  },

  applyChanges: async (selected) => {
    const current = get().run;
    if (!current || current.scope !== 'curriculum' || current.status !== 'ready') return null;
    try {
      let result: CurriculumApplyResult;
      if (isExploreMockEnabled()) {
        result = exploreMockBackend.applyCurriculum(current.run_id, selected);
      } else {
        result = await applyCurriculumRun(current.run_id, selected);
      }
      set({ run: result.run });
      stopPolling();
      // mock 模式：把新课程注入下载树领域体系（仅内存演示）
      if (isExploreMockEnabled()) {
        injectMockCurriculum(current.params.domain_name, current.proposals.filter((c) => selected.includes(c.change_id)));
      }
      return result;
    } catch (err) {
      set({ error: describeError(err) });
      return null;
    }
  },

  loadHistory: async (courseId) => {
    const target = courseId ?? get().courseId;
    if (!target) return;
    try {
      const history = isExploreMockEnabled()
        ? exploreMockBackend.listRuns(target)
        : await listCourseExploreRuns(target, { limit: 20 });
      set({ history });
    } catch (err) {
      set({ error: describeError(err) });
    }
  },

  openRun: async (runId) => {
    stopPolling();
    try {
      const run = isExploreMockEnabled()
        ? exploreMockBackend.fetchRun(runId)
        : await fetchExploreRun(runId);
      set({ view: 'course', courseId: run.course_id, run, pollFailures: 0 });
    } catch (err) {
      set({ error: describeError(err) });
    }
  },

  /** 恢复场景续轮询：run 来自 localStorage 且未终态时重启定时器（弹窗打开时调用） */
  ensurePolling: () => {
    const cur = get().run;
    if (!cur || TERMINAL_STATUSES.has(cur.status)) return;
    stopPolling();
    pollTimer = setInterval(() => void get().refresh(), POLL_INTERVAL_MS);
  },
}));

// 任一 run 变更即落盘（2026-08-24：刷新/重开页面可恢复最近一次探索结果）
useExploreStore.subscribe((st) => {
  persistRun(st.run);
});
