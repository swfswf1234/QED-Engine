/**
 * 探索 store（PLAN-022 F2 会话模型重写，2026-08-28；旧 explore-runs 轮询契约已废弃）
 * - 统一会话：startCourse / startCurriculum → POST /explore-sessions（202 + session_id，
 *   8900 后台线程执行 8901 dry-run 管线）→ refresh 轮询（3s，连续 3 次失败本地转 failed 停表）
 *   → ready → apply（领域=应用课程体系 / 课程=采纳教程）或 discard（放弃，stage 回退）
 * - 名称确认：waiting_name_confirm → confirmName(nameOverride) → 管线重跑
 * - 持久化：最近一次会话落 localStorage（刷新恢复 + 续轮询）；终态保留供回看
 * - mock 开关：localStorage qed-explore-mock=1 或 VITE_EXPLORE_MOCK=1 时走本地模拟后端
 */
import { create } from 'zustand';
import { createElement } from 'react';
import { Button, notification } from 'antd';
import {
  applyExploreSession, confirmExploreSessionName, createExploreSession,
  deleteExploreSession, fetchExploreSession,
} from '../api/tracker';
import { ApiError, describeError } from '../api/client';
import type {
  DomainExploreCourse, DomainExploreReport, ExploreApplyResult, ExploreLaunchMode,
  ExploreProposal, ExploreSessionRecord,
} from './index';
import { MAX_POLL_FAILURES, POLL_INTERVAL_MS } from './exploreRules';
import { isExploreMockEnabled } from './mockFlag';
import { exploreMockBackend } from './explore.mock';
import { useDownloadsStore } from './downloads';

export { EXPLORE_MAX_TUTORIALS, EXPLORE_MIN_CONFIRMED, POLL_INTERVAL_MS, MAX_POLL_FAILURES } from './exploreRules';
export { exploreStatusOf, remainingSlots, isCourseLocked } from './exploreRules';
export { isExploreMockEnabled };

export interface ExploreParams {
  mode: ExploreLaunchMode;
  ref_text?: string;
  ref_doc_path?: string;
}

export interface ExploreStore {
  view: 'course' | 'curriculum';
  courseId: string | null;
  domainName: string | null;
  /** 当前会话（统一会话模型，target 区分领域/课程） */
  session: ExploreSessionRecord | null;
  /** apply 成功后的本地结果（服务端会话保持 ready，applied 标记由前端持有） */
  applied: boolean;
  applyResult: ExploreApplyResult | null;
  error: string | null;
  launching: boolean;
  pollFailures: number;
  startCourse: (courseId: string, params: ExploreParams) => Promise<void>;
  startCurriculum: (domainName: string, params: ExploreParams, domainId?: string) => Promise<void>;
  refresh: () => Promise<void>;
  confirmName: (nameOverride: string) => Promise<void>;
  apply: (selected: unknown[]) => Promise<ExploreApplyResult | null>;
  discard: () => Promise<void>;
  reset: () => void;
  ensurePolling: () => void;
}

export type ExploreFlowTarget =
  | { variant: 'course'; courseId: string; courseName?: string }
  | { variant: 'curriculum'; domainId: string; domainName: string };

/** 领域探索按钮临时态（仅 running；pending/completed 由 DomainInfoCard 按 exploration_stage 实时计算，F4） */
export type DomainRunStatus = 'running';

interface ExploreUiStore {
  flowTarget: ExploreFlowTarget | null;
  /** 领域 id → 探索状态（会话进行中标记，持久化到 localStorage；stage 事实源在共享表） */
  domainRunStatus: Record<string, DomainRunStatus>;
  openFlow: (target: ExploreFlowTarget) => void;
  closeFlow: () => void;
  setDomainRunStatus: (domainId: string, status: DomainRunStatus | null) => void;
}

export const useExploreUiStore = create<ExploreUiStore>((set) => ({
  flowTarget: null,
  domainRunStatus: restoreDomainRunStatus(),
  openFlow: (target) => set({ flowTarget: target }),
  closeFlow: () => set({ flowTarget: null }),
  setDomainRunStatus: (domainId, status) =>
    set((st) => {
      const next = { ...st.domainRunStatus };
      if (status === null) delete next[domainId];
      else next[domainId] = status;
      persistDomainRunStatus(next);
      return { domainRunStatus: next };
    }),
}));

// 轮询定时器（模块级，不入 state 以免引用不可序列化告警）
let pollTimer: ReturnType<typeof setInterval> | null = null;

// 会话持久化（刷新恢复 + 续轮询；终态保留供回看，新发起自动覆盖）
const RUN_STATE_KEY = 'qed-explore-run';

function persistSession(session: ExploreSessionRecord | null): void {
  try {
    if (session) localStorage.setItem(RUN_STATE_KEY, JSON.stringify(session));
    else localStorage.removeItem(RUN_STATE_KEY);
  } catch {
    /* localStorage 不可用：静默降级为会话内行为 */
  }
}

/** 页面加载时恢复最近一次探索会话（含终态回看与 running 续轮询） */
export function restorePersistedSession(): ExploreSessionRecord | null {
  try {
    const raw = localStorage.getItem(RUN_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExploreSessionRecord;
  } catch {
    return null;
  }
}

// 领域探索按钮状态机持久化（会话进行中标记；stage 事实在共享表）
const DOMAIN_RUN_STATUS_KEY = 'qed-explore-domain-status';

function persistDomainRunStatus(status: Record<string, DomainRunStatus>): void {
  try {
    if (Object.keys(status).length > 0) {
      localStorage.setItem(DOMAIN_RUN_STATUS_KEY, JSON.stringify(status));
    } else {
      localStorage.removeItem(DOMAIN_RUN_STATUS_KEY);
    }
  } catch {
    /* localStorage 不可用：静默降级 */
  }
}

function restoreDomainRunStatus(): Record<string, DomainRunStatus> {
  try {
    const raw = localStorage.getItem(DOMAIN_RUN_STATUS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, DomainRunStatus>;
  } catch {
    return {};
  }
}

function stopPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

const TERMINAL_STATUSES = new Set(['ready', 'failed', 'waiting_name_confirm']);

/** session.report 收敛为领域报告（target=domain 时） */
export function asDomainReport(session: ExploreSessionRecord | null): DomainExploreReport | null {
  return session?.report && 'domain' in session.report ? session.report : null;
}

/** session.report 收敛为课程报告（target=course 时） */
export function asCourseTutorials(session: ExploreSessionRecord | null): ExploreProposal[] {
  return session?.report && 'tutorials' in session.report ? session.report.tutorials : [];
}

function nowIso(): string {
  return new Date().toISOString();
}

/** mock 模式专用：把采纳结果以 draft 教程行注入下载树（仅内存演示，刷新即消失） */
function injectMockAdoption(
  courseId: string,
  adopted: { knowledge_id: string; set_name: string }[],
  proposals: ExploreProposal[],
): void {
  const ds = useDownloadsStore.getState();
  const rows = adopted.map((a) => {
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

/** mock 模式专用：领域探索应用后把新课程注入下载树领域体系（仅内存演示） */
function injectMockCurriculum(
  domainName: string,
  courses: DomainExploreCourse[],
): void {
  const ds = useDownloadsStore.getState();
  const added = courses.map((c) => ({
    course_id: `mock-c-${c.slug}`,
    name: c.name,
    aliases: c.aliases ?? [],
    stage: '',
    prerequisites: c.prerequisites ?? [],
    note: c.summary ?? '',
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
  // 页面刷新后恢复最近一次探索会话（running 由弹窗打开时续轮询）
  session: restorePersistedSession(),
  applied: false,
  applyResult: null,
  error: null,
  launching: false,
  pollFailures: 0,

  reset: () => {
    stopPolling();
    set({
      view: 'course', courseId: null, domainName: null, session: null,
      applied: false, applyResult: null, error: null, launching: false, pollFailures: 0,
    });
    exploreMockBackend._resetRegistry();
  },

  startCourse: async (courseId, params) => {
    // 同课程已有未终态会话：不重复发起，续看/续轮询
    const cur0 = get().session;
    if (cur0?.target === 'course' && cur0.course_id === courseId && !TERMINAL_STATUSES.has(cur0.status)) {
      get().ensurePolling();
      return;
    }
    stopPolling();
    set({
      view: 'course', courseId, domainName: null, applied: false, applyResult: null,
      error: null, launching: true, pollFailures: 0,
    });
    try {
      const session = isExploreMockEnabled()
        ? exploreMockBackend.createSession({ target: 'course', course_id: courseId, ...params })
        : await createExploreSession({ target: 'course', course_id: courseId, ...params });
      set({ session, launching: false });
      pollTimer = setInterval(() => void get().refresh(), POLL_INTERVAL_MS);
    } catch (err) {
      set({ error: describeError(err), launching: false });
    }
  },

  startCurriculum: async (domainName, params, domainId?) => {
    // 同领域已有未终态会话：不重复发起（避免 ready 后连点叠加新会话）
    const cur0 = get().session;
    if (cur0?.target === 'domain' && cur0.domain_name === domainName && !TERMINAL_STATUSES.has(cur0.status)) {
      get().ensurePolling();
      return;
    }
    stopPolling();
    set({
      view: 'curriculum', domainName, courseId: null, applied: false, applyResult: null,
      error: null, launching: true, pollFailures: 0,
    });
    try {
      const session = isExploreMockEnabled()
        ? exploreMockBackend.createSession({ target: 'domain', domain_name: domainName, ...params })
        : await createExploreSession({ target: 'domain', domain_name: domainName, domain_id: domainId, ...params });
      set({ session, launching: false });
      // 发起即标记领域按钮「探索进行中」（stage=探索中由 8900 写共享表）
      if (domainId) {
        const { setDomainRunStatus } = useExploreUiStore.getState();
        setDomainRunStatus(domainId, 'running');
      }
      pollTimer = setInterval(() => void get().refresh(), POLL_INTERVAL_MS);
    } catch (err) {
      set({ error: describeError(err), launching: false });
    }
  },

  refresh: async () => {
    const current = get().session;
    if (!current || TERMINAL_STATUSES.has(current.status)) return;
    try {
      const next = isExploreMockEnabled()
        ? exploreMockBackend.fetchSession(current.session_id)
        : await fetchExploreSession(current.session_id);
      set({ session: next, pollFailures: 0, error: null });
      if (TERMINAL_STATUSES.has(next.status)) {
        stopPolling();
        // 弹窗关闭时触发通知：加「查看结果」按钮重新打开弹窗进结果视图
        const { flowTarget, openFlow } = useExploreUiStore.getState();
        if (flowTarget === null) {
          const label = next.target === 'domain' ? next.domain_name : next.course_id;
          const openResult = (): void => {
            if (next.target === 'domain') {
              // 领域：从下载树按名称回查 domainId（新领域 apply 后才会出现在树中）
              const domId = useDownloadsStore.getState().domains.find((d) => d.name === next.domain_name)?.domain_id
                ?? next.domain_name;
              openFlow({ variant: 'curriculum', domainId: domId, domainName: next.domain_name });
            } else {
              openFlow({ variant: 'course', courseId: next.course_id });
            }
          };
          const actionBtn = createElement(
            Button,
            { size: 'small', type: 'primary', onClick: openResult },
            next.status === 'failed' ? '查看详情' : '查看结果',
          );
          if (next.status === 'failed') {
            notification.error({
              message: `「${label}」探索失败`,
              description: next.error ?? '请稍后重试',
              btn: actionBtn,
              duration: 0,
            });
          } else {
            notification.success({
              message: `「${label}」探索完成`,
              description: '探索结果已就绪',
              btn: actionBtn,
              duration: 5,
            });
          }
        }
      }
    } catch (err) {
      // 自愈清障：会话已不存在（404，如 localStorage 残留旧会话且服务端重启丢失）
      // → 清持久化 + 置空，弹窗回落到发起表单态（不再卡在旧结果/无限轮询）
      if (err instanceof ApiError && err.status === 404) {
        stopPolling();
        persistSession(null);
        set({ session: null, error: null, pollFailures: 0 });
        return;
      }
      const failures = get().pollFailures + 1;
      if (failures >= MAX_POLL_FAILURES) {
        // 连续失败上限：本地转 failed（保留 session_id 供恢复查询），停止轮询
        stopPolling();
        set({
          pollFailures: failures,
          error: `探索轮询连续 ${MAX_POLL_FAILURES} 次失败已停止（session_id=${current.session_id} 已保留，可重试或稍后恢复查询）`,
          session: { ...current, status: 'failed', error: current.error ?? '轮询连续失败' },
        });
      } else {
        set({ pollFailures: failures });
      }
    }
  },

  confirmName: async (nameOverride) => {
    const current = get().session;
    if (!current || current.status !== 'waiting_name_confirm') return;
    try {
      const next = isExploreMockEnabled()
        ? exploreMockBackend.confirmName(current.session_id, nameOverride)
        : await confirmExploreSessionName(current.session_id, nameOverride);
      set({ session: next, error: null, pollFailures: 0 });
      pollTimer = setInterval(() => void get().refresh(), POLL_INTERVAL_MS);
    } catch (err) {
      set({ error: describeError(err) });
    }
  },

  apply: async (selected) => {
    const current = get().session;
    if (!current || current.status !== 'ready') return null;
    try {
      const result = isExploreMockEnabled()
        ? exploreMockBackend.applySession(current.session_id, selected)
        : await applyExploreSession(current.session_id, selected);
      stopPolling();
      // mock 模式：本地注入草稿教程/新课程，令「应用 → 文档下载管理可见」闭环可预览
      if (isExploreMockEnabled()) {
        if (current.target === 'course') {
          injectMockAdoption(
            current.course_id,
            result.applied.map((a, i) => ({
              knowledge_id: a.knowledge_id ?? `mock_kn_${i}`,
              set_name: a.set_name ?? `套${i + 1}`,
            })),
            asCourseTutorials(current),
          );
        } else {
          const report = asDomainReport(current);
          injectMockCurriculum(current.domain_name, report?.courses ?? []);
        }
      }
      set({ applied: true, applyResult: result });
      // 真实模式：apply 落库后刷新下载树（新课程/新教程可见）
      if (!isExploreMockEnabled()) {
        void useDownloadsStore.getState().fetchAll();
      }
      return result;
    } catch (err) {
      set({ error: describeError(err) });
      return null;
    }
  },

  discard: async () => {
    const current = get().session;
    if (!current) return;
    stopPolling();
    try {
      if (!isExploreMockEnabled()) {
        await deleteExploreSession(current.session_id);
      } else {
        exploreMockBackend.deleteSession(current.session_id);
      }
    } catch (err) {
      // 404（会话已过期清理）：视为放弃成功
      if (!(err instanceof ApiError && err.status === 404)) {
        set({ error: describeError(err) });
        return;
      }
    }
    persistSession(null);
    set({ session: null, applied: false, applyResult: null, error: null });
  },

  /** 恢复场景续轮询：session 来自 localStorage 且未终态时重启定时器（弹窗打开时调用） */
  ensurePolling: () => {
    const cur = get().session;
    if (!cur || TERMINAL_STATUSES.has(cur.status)) return;
    stopPolling();
    pollTimer = setInterval(() => void get().refresh(), POLL_INTERVAL_MS);
  },
}));

// 任一会话变更即落盘（刷新/重开页面可恢复最近一次探索结果）
useExploreStore.subscribe((st) => {
  persistSession(st.session);
});
