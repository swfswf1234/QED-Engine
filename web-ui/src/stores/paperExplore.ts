/**
 * 论文探索 store（REQ-102 W4，downloads-ui.md §4.4 / downloads-flow.md §7.2）
 * - 三段流转：start（POST /papers/recommend 202 task_id）→ 5s 轮询 /tasks/{id}
 *   → completed 读报告 /papers/selections/{id} 进评审 → adopt（202 任务）→ 采纳结果回显
 * - 展示徽标：refreshBadges 用 GET /tasks + GET /papers/selections 联立各领域态（§7.2 派生，
 *   禁读 exploration_stage）；两路都失败时退回「仅按书行数」
 * - ⑤′ 论文没有默认桶：domain_id 一律由调用方显式给出，前端不补默认值，
 *   上游 422/404/409 detail 原样作为 error 文案
 * - 裁决 #5 adopt 不自动下载：新行停在 candidate，取书由书目详情弹窗显式发起
 */
import { create } from 'zustand';
import {
  adoptPapers, getPaperSelection, getTask, listPaperSelections, listTasks, recommendPapers,
} from '../api/tracker';
import type { PaperRecommendBody } from '../api/tracker';
import { describeError } from '../api/client';
import { useDownloadsStore } from './downloads';
import type {
  PaperAdoptedRow, PaperPick, PaperSelectionDetail, PaperSelectionSummary, TaskRecord,
} from './index';

export const PAPER_POLL_INTERVAL_MS = 5000;
export const PAPER_MAX_POLL_FAILURES = 3;

const ACTIVE_TASK_STATUSES = new Set(['queued', 'running']);

export type PaperRecipe = 'frontier' | 'core';

export interface PaperLaunchParams {
  domainId: string;
  recipe: PaperRecipe;
  goal?: string;
  categories?: string[];
}

/** §7.2 展示态（隐藏/探索中/待评审/已沉淀 k 篇/失败） */
export type PaperBadgeKey = 'hidden' | 'running' | 'review' | 'sedimented' | 'failed';

export interface PaperRowBadge {
  key: PaperBadgeKey;
  text: string;
}

/** 弹窗阶段：发起表单 / 轮询中 / 评审 / 失败 / 已采纳 */
export type PaperFlowPhase = 'form' | 'running' | 'review' | 'failed' | 'adopted';

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

export function paperFlowPhase(state: {
  task: TaskRecord | null;
  selection: PaperSelectionDetail | null;
  adopted: PaperAdoptedRow[] | null;
  error?: string | null;
}): PaperFlowPhase {
  // 评审段优先于错误提示：采纳校验失败（落位不合法）留在评审段就地改写重试
  if (state.adopted !== null) return 'adopted';
  if (state.task && ACTIVE_TASK_STATUSES.has(state.task.status)) return 'running';
  if (state.selection?.status === 'ranked') return 'review';
  if (state.error || state.task?.status === 'failed') return 'failed';
  return 'form';
}

interface PaperExploreStore {
  modalOpen: boolean;
  domainId: string | null;
  domainName: string;
  /** 当前在跟任务（recommend=探索、adopt=采纳） */
  task: TaskRecord | null;
  taskKind: 'recommend' | 'adopt' | null;
  selection: PaperSelectionDetail | null;
  adopted: PaperAdoptedRow[] | null;
  error: string | null;
  launching: boolean;
  adopting: boolean;
  pollFailures: number;
  /** domain_id → §7.2 展示态徽标 */
  badges: Record<string, PaperRowBadge>;
  /** 各领域论文书行数快照（refreshBadges 记入，供任务流转时就地改徽标） */
  counts: Record<string, number>;
  openModal: (domainId: string, domainName: string) => Promise<void>;
  closeModal: () => void;
  start: (params: PaperLaunchParams) => Promise<void>;
  pollOnce: () => Promise<void>;
  ensurePolling: () => void;
  /** 「返回修改」：清错误回发起表单（在跟任务与已读报告保留） */
  clearError: () => void;
  adopt: (picks: PaperPick[]) => Promise<void>;
  refreshBadges: (bookCountByDomain: Record<string, number>) => Promise<void>;
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
  task: null,
  taskKind: null,
  selection: null,
  adopted: null,
  error: null,
  launching: false,
  adopting: false,
  pollFailures: 0,
  badges: {},
  counts: {},

  reset: () => {
    stopPolling();
    set({
      modalOpen: false, domainId: null, domainName: '', task: null, taskKind: null,
      selection: null, adopted: null, error: null, launching: false, adopting: false,
      pollFailures: 0,
    });
  },

  openModal: async (domainId, domainName) => {
    const cur = get();
    // 切领域：丢弃上一领域的本地视图（任务仍在 8901 侧跑，徽标经 refreshBadges 续显）
    if (cur.domainId && cur.domainId !== domainId) {
      stopPolling();
      set({ task: null, taskKind: null, selection: null, adopted: null, error: null, pollFailures: 0 });
    }
    set({ modalOpen: true, domainId, domainName });
    const live = get().task;
    if (live && ACTIVE_TASK_STATUSES.has(live.status)) {
      setBadge(domainId, { key: 'running', text: '探索中' });
      startPolling();
      return;
    }
    // 无在跟任务：读该领域最近报告，ranked 直接进评审段（幂等重开，不重复发起任务）
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

  start: async ({ domainId, recipe, goal, categories }) => {
    stopPolling();
    set({
      domainId, launching: true, error: null, task: null, taskKind: null,
      selection: null, adopted: null, pollFailures: 0,
    });
    const body: PaperRecommendBody = {
      domain_id: domainId,
      recipe,
      ...(goal ? { goal } : {}),
      ...(categories && categories.length > 0 ? { categories } : {}),
    };
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
      setBadge(domainId, { key: 'running', text: '探索中' });
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
      set({ selection: detail });
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

  clearError: () => {
    // 失败段回发起表单：清错误与本轮在跟视图（报告可经重新打开弹窗按领域续读）
    stopPolling();
    set({ error: null, task: null, taskKind: null, adopted: null, pollFailures: 0 });
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
};
});

export type { PaperExploreStore };
