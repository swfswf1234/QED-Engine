/**
 * 论文探索 store（REQ-102 W4 + REQ-108 I3 五段，downloads-ui.md §4.4 / downloads-flow.md §7.2 /
 * REQ-107 壳 §5）
 * - 五段流转：段①探索设置 → 段②轮询（POST /papers/recommend 202 task_id，5s /tasks/{id}）
 *   → 段③检索口径（任务成功读报告，先看怎么检索）→ `进入候选评审` 才到段④
 *   → adopt（202 任务）→ 段⑤采纳回执
 * - 首屏纪律：任何入口打开弹窗都落段①；旧报告经段①「历史探索清单」进段③（REQ-109 I10）
 * - 展示徽标：refreshBadges 用 GET /tasks + GET /papers/selections 联立各领域态（§7.2 派生，
 *   禁读 exploration_stage）；两路都失败时退回「仅按书行数」
 * - ⑤′ 论文没有默认桶：domain_id 一律由调用方显式给出，前端不补默认值，
 *   上游 422/404/409 detail 原样作为 error 文案
 * - 裁决 #5 adopt 不自动下载：新行停在 candidate，取书由书目详情弹窗显式发起
 * - 已入库论文按需回源（tracePaperOrigin）：只在点开论文书行详情时发，单领域、报告 ≤20 份、
 *   失败静默转 miss、不缓存全量报告
 */
import { create } from 'zustand';
import {
  adoptPapers, getPaperSelection, getTask, listPaperSelections, listTasks, recommendPapers,
} from '../api/tracker';
import type { PaperRecommendBody } from '../api/tracker';
import { describeError } from '../api/client';
import { useDownloadsStore } from './downloads';
import type {
  PaperAdoptedRow, PaperCandidateEntry, PaperCandidateInfo, PaperPick,
  PaperSelectionDetail, PaperSelectionSummary, TaskRecord,
} from './index';

export const PAPER_POLL_INTERVAL_MS = 5000;
export const PAPER_MAX_POLL_FAILURES = 3;

/** 历史探索清单一次拉取的报告条数上限（REQ-107 壳 §11.4） */
export const PAPER_HISTORY_LIMIT = 10;

/** 已入库论文按需回源的报告扫描上限（§7 纪律：单领域、≤20 份、只在点击时发） */
export const PAPER_TRACE_MAX_REPORTS = 20;

const ACTIVE_TASK_STATUSES = new Set(['queued', 'running']);

/** 段④只对这两种报告开放：有推荐 / 有候选但无推荐（no_candidates 停在段③调参） */
const REVIEWABLE_REPORT_STATUSES = new Set(['ranked', 'no_recommendations']);

/**
 * 历史探索清单的「待决定」集合（REQ-107 壳 §11.4 第二轮修订）：
 * 只保留可继续确认／否定的报告，按时间新的在前，超出上限截断。
 */
export function pendingDecisionRows(rows: PaperSelectionSummary[]): PaperSelectionSummary[] {
  return rows
    .filter((row) => REVIEWABLE_REPORT_STATUSES.has(row.status))
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : (a.created_at > b.created_at ? -1 : 0)))
    .slice(0, PAPER_HISTORY_LIMIT);
}

/** §7.2 展示态（隐藏/探索中/待评审/已沉淀 k 篇/失败） */
export type PaperBadgeKey = 'hidden' | 'running' | 'review' | 'sedimented' | 'failed';

export interface PaperRowBadge {
  key: PaperBadgeKey;
  text: string;
}

/** 弹窗五段中由用户推进的那三段（段②轮询与段⑤回执由任务态派生） */
export type PaperFlowStage = 'settings' | 'plan' | 'review';

/** 弹窗阶段：段①设置 / 段②轮询 / 段③检索口径 / 段④候选评审 / 失败 / 段⑤采纳回执 */
export type PaperFlowPhase = 'form' | 'running' | 'plan' | 'review' | 'failed' | 'adopted';

export function derivePaperRowBadge(input: {
  bookCount: number;
  task?: { status: string } | null;
  selection?: { status: string } | null;
}): PaperRowBadge {
  const { bookCount, task, selection } = input;
  // 优先级：探索中 > 待评审 > 失败 > 已沉淀 > 隐藏（同一领域只有一套活动，冲突时取可动作者）
  if (task && ACTIVE_TASK_STATUSES.has(task.status)) return { key: 'running', text: '探索中' };
  if (selection?.status === 'ranked') return { key: 'review', text: '待评审' };
  if (task?.status === 'failed') return { key: 'failed', text: '失败' };
  if (bookCount > 0) return { key: 'sedimented', text: `已沉淀 ${bookCount} 篇` };
  return { key: 'hidden', text: '' };
}

/** 待评审/失败态徽标可点击直达弹窗评审段；其余仅展示 */
export function paperBadgeIsActionable(key: PaperBadgeKey): boolean {
  return key === 'review' || key === 'failed';
}

/** I14：旧展示行删除后，汇总行只渲染活动态徽标（已沉淀/隐藏不进汇总行） */
export function paperBadgeShowsInSummary(key: PaperBadgeKey | undefined): boolean {
  return key === 'running' || key === 'review' || key === 'failed';
}

/** 报告候选标题归一（已在库去重标记用；8901 已按 arXiv ID 排除，此处补标题级线索） */
function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isCandidateInStock(
  entry: { candidate: { title: string } },
  stockTitles: string[],
): boolean {
  const key = normalizeTitle(entry.candidate.title);
  return key.length > 0 && stockTitles.some((title) => normalizeTitle(title) === key);
}

/** 按需回源命中：报告侧的候选 + 评审结论（早期记录缺评审时 assessment 为空） */
export interface PaperTraceHit {
  selection_id: string;
  candidate: PaperCandidateInfo;
  assessment: PaperCandidateEntry['assessment'] | null;
  score: number | null;
  recommended: boolean | null;
}

export type PaperTraceState = 'loading' | 'hit' | 'miss' | 'no_source';

/** 已入库论文详情的按需回源态（书目弹窗内独立挂载，不影响探索段位） */
export interface PaperTrace {
  bookId: string;
  state: PaperTraceState;
  hit: PaperTraceHit | null;
}

function matchesArxivId(entry: PaperCandidateEntry, arxivId: string): boolean {
  return (entry.candidate.identifiers?.arxiv ?? entry.candidate.provider_id) === arxivId;
}

export function paperFlowPhase(state: {
  task: TaskRecord | null;
  selection: PaperSelectionDetail | null;
  adopted: PaperAdoptedRow[] | null;
  error?: string | null;
  stage?: PaperFlowStage;
}): PaperFlowPhase {
  // 评审段优先于错误提示：采纳校验失败（落位不合法）留在评审段就地改写重试
  if (state.adopted !== null) return 'adopted';
  if (state.task && ACTIVE_TASK_STATUSES.has(state.task.status)) return 'running';
  if (state.selection) {
    // 段③→段④ 是显式动作；候选评审只对「有推荐」与「有候选但无推荐」两种报告开放
    if (state.stage === 'review' && REVIEWABLE_REPORT_STATUSES.has(state.selection.status)) return 'review';
    if (state.stage === 'plan') return 'plan';
  }
  if (state.error || state.task?.status === 'failed') return 'failed';
  return 'form';
}

interface PaperExploreStore {
  modalOpen: boolean;
  domainId: string | null;
  domainName: string;
  /** 课程语境名（段①标题括号内），仅显示用——探索仍只由领域发起（R2） */
  courseName: string;
  /** 当前在跟任务（recommend=探索、adopt=采纳） */
  task: TaskRecord | null;
  taskKind: 'recommend' | 'adopt' | null;
  selection: PaperSelectionDetail | null;
  adopted: PaperAdoptedRow[] | null;
  error: string | null;
  launching: boolean;
  adopting: boolean;
  pollFailures: number;
  /** 弹窗内由用户推进的段位（I3 五段：段③只作展示，进段④需显式动作） */
  stage: PaperFlowStage;
  /** domain_id → §7.2 展示态徽标 */
  badges: Record<string, PaperRowBadge>;
  /** 各领域论文书行数快照（refreshBadges 记入，供任务流转时就地改徽标） */
  counts: Record<string, number>;
  /** 段①历史探索清单（§11.4，本领域最近 ≤10 份报告摘要；拉取失败保持旧值＝静默） */
  history: PaperSelectionSummary[];
  /** 已入库论文详情的按需回源态（书目弹窗打开时点「查看探索记录」才填） */
  trace: PaperTrace | null;
  openModal: (domainId: string, domainName: string, courseName?: string) => Promise<void>;
  closeModal: () => void;
  /** 提交探索：请求体由 `composePaperLaunch` 组好，store 不再拼参数 */
  start: (body: PaperRecommendBody) => Promise<void>;
  pollOnce: () => Promise<void>;
  ensurePolling: () => void;
  /** 段③ → 段④（唯一前进路径） */
  toReview: () => void;
  /** 段①「继续上次报告」→ 段③ */
  toPlan: () => void;
  /** 段①历史探索清单：按领域拉 ≤10 份摘要（失败静默，不阻塞发起） */
  loadHistory: (domainId: string) => Promise<void>;
  /** 点历史条目：读该报告详情并进段③ */
  openReport: (selectionId: string) => Promise<void>;
  /** 「回段①调参再探」：报告与任务留在 store，只换段位 */
  toSettings: () => void;
  /** 「返回修改」：清错误回发起表单（在跟任务与已读报告保留） */
  clearError: () => void;
  adopt: (picks: PaperPick[]) => Promise<void>;
  refreshBadges: (bookCountByDomain: Record<string, number>) => Promise<void>;
  /** 已入库论文按需回源（I5 ②）：本领域报告（≤20）逐份匹配 arXiv ID */
  tracePaperOrigin: (input: { bookId: string; domainId: string; arxivId: string }) => Promise<void>;
  reset: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

function stopPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling(): void {
  stopPolling();
  pollTimer = setInterval(() => void usePaperExploreStore.getState().pollOnce(), PAPER_POLL_INTERVAL_MS);
}

export const usePaperExploreStore = create<PaperExploreStore>((set, get) => {
  /** 就地改某领域徽标（任务发起/终态用，避免等页面回灌书行数） */
  const setBadge = (domainId: string | null, badge: PaperRowBadge) => {
    if (!domainId) return;
    set((s) => ({ badges: { ...s.badges, [domainId]: badge } }));
  };
  const sedimentedBadge = (domainId: string | null): PaperRowBadge =>
    derivePaperRowBadge({ bookCount: get().counts[domainId ?? ''] ?? 0 });

  return {
  modalOpen: false,
  domainId: null,
  domainName: '',
  courseName: '',
  task: null,
  taskKind: null,
  selection: null,
  adopted: null,
  error: null,
  launching: false,
  adopting: false,
  pollFailures: 0,
  stage: 'settings',
  badges: {},
  counts: {},
  history: [],
  trace: null,

  reset: () => {
    stopPolling();
    set({
      modalOpen: false, domainId: null, domainName: '', courseName: '', task: null, taskKind: null,
      selection: null, adopted: null, error: null, launching: false, adopting: false,
      pollFailures: 0, stage: 'settings', history: [], trace: null,
    });
  },

  openModal: async (domainId, domainName, courseName = '') => {
    const cur = get();
    // 切领域：丢弃上一领域的本地视图（任务仍在 8901 侧跑，徽标经 refreshBadges 续显）
    if (cur.domainId && cur.domainId !== domainId) {
      stopPolling();
      set({ task: null, taskKind: null, selection: null, adopted: null, error: null, pollFailures: 0 });
    }
    // 首屏纪律（§4）：三处入口一律落段①探索设置；旧报告经段①历史探索清单进段③
    set({ modalOpen: true, domainId, domainName, courseName, stage: 'settings' });
    const live = get().task;
    if (live && ACTIVE_TASK_STATUSES.has(live.status)) {
      setBadge(domainId, { key: 'running', text: '探索中' });
      startPolling();
      return;
    }
    // 无在跟任务：读该领域最近 ranked 报告挂上 store（幂等重开，不重复发起任务），段位仍留段①
    const list = await listPaperSelections({ domain_id: domainId, limit: 1 }).catch(() => null);
    const latest = list?.selections?.[0];
    if (!latest || latest.status !== 'ranked') return;
    const detail = await getPaperSelection(latest.selection_id).catch(() => null);
    if (detail && get().domainId === domainId) {
      set({ selection: detail, error: null });
      if (detail.status === 'ranked') setBadge(domainId, { key: 'review', text: '待评审' });
    }
  },

  closeModal: () => {
    // 关闭不打断后台轮询（同领域重开续看）
    set({ modalOpen: false });
  },

  start: async (body) => {
    stopPolling();
    set({
      domainId: body.domain_id, launching: true, error: null, task: null, taskKind: null,
      selection: null, adopted: null, pollFailures: 0, stage: 'settings',
    });
    try {
      const { task_id } = await recommendPapers(body);
      const task = await getTask(task_id).catch(() => null);
      set({
        launching: false, taskKind: 'recommend',
        task: task ?? {
          task_id, type: 'paper_recommend', status: 'queued', progress: 0, message: '任务已提交',
          created_at: '', updated_at: '', params: null, result: null, error: '',
        },
      });
      setBadge(body.domain_id, { key: 'running', text: '探索中' });
      startPolling();
    } catch (err) {
      set({ launching: false, error: describeError(err), task: null, taskKind: null });
    }
  },

  pollOnce: async () => {
    const { task, taskKind } = get();
    if (!task) return;
    let next: TaskRecord;
    try {
      next = await getTask(task.task_id);
      set({ task: next, pollFailures: 0 });
    } catch (err) {
      const failures = get().pollFailures + 1;
      set({ pollFailures: failures });
      if (failures >= PAPER_MAX_POLL_FAILURES) {
        // 连续失败本地转 failed 并停表（与探索会话同口径；服务端任务不受影响）
        const message = describeError(err);
        stopPolling();
        set({ task: { ...task, status: 'failed', error: message }, error: message });
        setBadge(get().domainId, { key: 'failed', text: '失败' });
      }
      return;
    }
    if (ACTIVE_TASK_STATUSES.has(next.status)) return;
    stopPolling();
    if (next.status === 'failed') {
      set({ error: next.error || '论文任务失败' });
      setBadge(get().domainId, { key: 'failed', text: '失败' });
      return;
    }
    const result = next.result ?? {};
    if (taskKind === 'adopt') {
      const adopted = Array.isArray(result.adopted) ? result.adopted as PaperAdoptedRow[] : [];
      set({ adopted });
      await useDownloadsStore.getState().refreshPapers();
      setBadge(get().domainId, sedimentedBadge(get().domainId));
      return;
    }
    const selectionId = String(result.selection_id ?? '');
    if (!selectionId) {
      set({ error: '任务已完成但未返回报告编号' });
      setBadge(get().domainId, sedimentedBadge(get().domainId));
      return;
    }
    try {
      const detail = await getPaperSelection(selectionId);
      // 段②出口：任务成功自动进段③检索口径（§5，唯一前进路径，不跳过口径直接评审）
      set({ selection: detail, stage: 'plan' });
      setBadge(
        get().domainId,
        detail.status === 'ranked' ? { key: 'review', text: '待评审' } : sedimentedBadge(get().domainId),
      );
    } catch (err) {
      set({ error: describeError(err) });
    }
  },

  ensurePolling: () => {
    const { task } = get();
    if (task && ACTIVE_TASK_STATUSES.has(task.status)) startPolling();
  },

  toPlan: () => set({ stage: 'plan' }),

  loadHistory: async (domainId) => {
    // 旁路面（§11.4）：失败静默保留旧值，不弹错误、不阻塞段①主路径
    if (!domainId) return;
    const list = await listPaperSelections({ domain_id: domainId, limit: PAPER_HISTORY_LIMIT })
      .catch(() => null);
    if (!list) return;
    set({ history: pendingDecisionRows(list.selections ?? []) });
  },

  openReport: async (selectionId) => {
    const detail = await getPaperSelection(selectionId).catch(() => null);
    if (!detail) {
      set({ error: '该报告还没有可看的候选' });
      return;
    }
    // I13：历史清单点行直达段④继续确认／否定；不可评审的报告（如缺详情字段的老报告）退回段③
    const reviewable = REVIEWABLE_REPORT_STATUSES.has(detail.status);
    set({ selection: detail, adopted: null, error: null, stage: reviewable ? 'review' : 'plan' });
  },

  toReview: () => {
    if (REVIEWABLE_REPORT_STATUSES.has(get().selection?.status ?? '')) set({ stage: 'review' });
  },

  toSettings: () => set({ stage: 'settings' }),

  clearError: () => {
    // 失败段回发起表单：清错误与本轮在跟视图（报告可经重新打开弹窗按领域续读）
    stopPolling();
    set({ error: null, task: null, taskKind: null, adopted: null, pollFailures: 0, stage: 'settings' });
  },

  adopt: async (picks) => {
    const { selection, domainId } = get();
    if (!selection) return;
    stopPolling();
    set({ adopting: true, error: null, adopted: null, pollFailures: 0 });
    try {
      const { task_id } = await adoptPapers(selection.selection_id, picks);
      const task = await getTask(task_id).catch(() => null);
      set({
        adopting: false, taskKind: 'adopt',
        task: task ?? {
          task_id, type: 'paper_adopt', status: 'queued', progress: 0, message: '采纳任务已提交',
          created_at: '', updated_at: '', params: { domain_id: domainId }, result: null, error: '',
        },
      });
      await get().pollOnce();
      if (ACTIVE_TASK_STATUSES.has(get().task?.status ?? '')) startPolling();
    } catch (err) {
      set({ adopting: false, error: describeError(err) });
    }
  },

  refreshBadges: async (bookCountByDomain) => {
    // 两路来源都可能 503（8901 离线）：各自降级为空，退回「仅按书行数」派生
    const [tasks, reportList] = await Promise.all([
      listTasks().catch(() => [] as TaskRecord[]),
      listPaperSelections().catch(() => ({ selections: [] as PaperSelectionSummary[] })),
    ]);
    const latestTask: Record<string, TaskRecord> = {};
    for (const item of tasks) {
      if (item.type !== 'paper_recommend' && item.type !== 'paper_adopt') continue;
      const domainId = String((item.params as Record<string, unknown> | null)?.domain_id ?? '');
      if (domainId) latestTask[domainId] = item;
    }
    const latestReport: Record<string, PaperSelectionSummary> = {};
    for (const item of reportList.selections ?? []) {
      if (item.domain_id && !latestReport[item.domain_id]) latestReport[item.domain_id] = item;
    }
    const domainIds = new Set([...Object.keys(bookCountByDomain), ...Object.keys(latestTask), ...Object.keys(latestReport)]);
    const badges: Record<string, PaperRowBadge> = {};
    domainIds.forEach((domainId) => {
      badges[domainId] = derivePaperRowBadge({
        bookCount: bookCountByDomain[domainId] ?? 0,
        task: latestTask[domainId] ?? null,
        selection: latestReport[domainId] ?? null,
      });
    });
    // 本地在跟任务优先：8901 任务列表可能还没反映刚发起的任务，别让回读把「探索中」擦掉
    const live = get().task;
    if (live && ACTIVE_TASK_STATUSES.has(live.status) && get().domainId) {
      badges[get().domainId as string] = { key: 'running', text: '探索中' };
    }
    set({ badges, counts: bookCountByDomain });
  },

  tracePaperOrigin: async ({ bookId, domainId, arxivId }) => {
    // 纪律（REQ-107 壳 §7）：只在点开详情时发、只扫本领域、报告 ≤20 份、失败静默、不缓存全量
    if (!arxivId || !domainId) {
      set({ trace: { bookId, state: 'no_source', hit: null } });
      return;
    }
    set({ trace: { bookId, state: 'loading', hit: null } });
    const list = await listPaperSelections({ domain_id: domainId, limit: PAPER_TRACE_MAX_REPORTS })
      .catch(() => null);
    const ids = (list?.selections ?? []).slice(0, PAPER_TRACE_MAX_REPORTS).map((item) => item.selection_id);
    for (const selectionId of ids) {
      const detail = await getPaperSelection(selectionId).catch(() => null);
      const found = (detail?.assessments ?? []).find((item) => matchesArxivId(item, arxivId));
      if (!found) continue;
      set({
        trace: {
          bookId,
          state: 'hit',
          hit: {
            selection_id: selectionId,
            candidate: found.candidate,
            assessment: found.assessment ?? null,
            score: found.score ?? null,
            recommended: found.recommended ?? null,
          },
        },
      });
      return;
    }
    set({ trace: { bookId, state: 'miss', hit: null } });
  },
};
});

export type { PaperExploreStore };
