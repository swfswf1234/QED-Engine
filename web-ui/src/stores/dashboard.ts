/**
 * 仪表盘 store（Phase 3 + 五层化，QED-031）
 * - 五层聚合：/knowledge 一次拉取教程列表 + 并行拉取 /knowledge/{id} 详情（含书籍）
 * - 服务在线卡（2026-08-24 恢复·轻量版）不在此拉取 /services：只读消费共享 runtime store
 *   （AdminLayout 进入管理台已统一拉取）；整体错误横幅改由教程请求的错误类别判定
 *   （offline 类 = 8900 不可达）
 * - 独立降级：8901 不可达 → 文档下载进度卡离线提示；8900 不可达 → 整体横幅
 */
import { create } from 'zustand';
import { ApiError } from '../api/client';
import { getKnowledge, listCatalog, listKnowledge } from '../api/tracker';
import type { BookRecord, CatalogTarget, KnowledgeDetail, KnowledgeRecord } from './index';

export const KNOWLEDGE_TIMEOUT_MS = 8000;

// --- 聚合纯函数（独立可测） ---

export interface BookSummary {
  total: number;
  downloaded: number;
  verified: number;
  remaining: number;
  /** 教程数 = kind=tutorial 的教程数（用户裁决 2026-08-17：教程总数→教程数） */
  tutorials: number;
}

/** 书籍汇总：跨教程聚合书籍下载/验收进度与教程数（books 来自详情缓存） */
export function buildBookSummary(details: Record<string, KnowledgeDetail>): BookSummary {
  const books = Object.values(details).flatMap((d) => d.books ?? []);
  const total = books.length;
  const downloaded = books.filter((b) => b.status === 'downloaded' || b.status === 'verified').length;
  const verified = books.filter((b) => b.status === 'verified').length;
  const tutorials = Object.values(details).filter((d) => d.kind === 'tutorial').length;
  return { total, downloaded, verified, remaining: total - verified, tutorials };
}

export interface DownloadSlice {
  name: string;
  value: number;
}

/** 已下载判定：downloaded 或 verified（与 buildBookSummary 口径一致） */
function isDownloaded(b: BookRecord): boolean {
  return b.status === 'downloaded' || b.status === 'verified';
}

/**
 * 文档下载进度饼图（按课程）：每个课程（course_id）一块扇区，值 = 该书籍的已下载书籍数
 * （downloaded+verified）——看各课程的下载工作量分布（用户裁决 2026-08-17）。
 * 课程名取该课程下任一教程 course_id（数据层无课程中文名时用 course_id 展示）。
 */
export function buildCourseDownloadPie(details: Record<string, KnowledgeDetail>): DownloadSlice[] {
  const byCourse = new Map<string, number>();
  for (const d of Object.values(details)) {
    for (const b of d.books ?? []) {
      if (!isDownloaded(b)) continue;
      byCourse.set(d.course_id, (byCourse.get(d.course_id) ?? 0) + 1);
    }
  }
  return [...byCourse.entries()].map(([name, value]) => ({ name, value }));
}

/**
 * 文档下载进度饼图（按教程）：每个教程（教程）一块扇区，值 = 该书籍的已下载书籍数
 * （downloaded+verified）——看各教程的下载工作量分布（用户裁决 2026-08-17）。
 * 教程名取教程 name；name 为空时回退 knowledge_id。
 */
export function buildKnowledgeDownloadPie(details: Record<string, KnowledgeDetail>): DownloadSlice[] {
  return Object.values(details)
    .map((d) => ({
      name: d.name || d.knowledge_id,
      value: (d.books ?? []).filter(isDownloaded).length,
    }))
    .filter((s) => s.value > 0);
}

export interface CourseCompletion {
  /** 已探索课程数（分母）= catalog targets 的 course_id 去重数 */
  total: number;
  /** 完成下载课程数（分子）= 该课程 ≥2 套教程完成验收（书籍全部 verified）的课程数 */
  completed: number;
}

/** 教程完成验收：kind=tutorial 且所辖 books 非空且全部 status=verified */
function isTutorialVerified(d: KnowledgeDetail): boolean {
  if (d.kind !== 'tutorial') return false;
  const books = d.books ?? [];
  return books.length > 0 && books.every((b) => b.status === 'verified');
}

/**
 * 课程下载完成度（用户裁决 2026-08-17）：
 * - 分母 = 已探索课程数（catalog targets course_id 去重，如数学 13 门）
 * - 分子 = 完成下载课程数（该课程下 ≥2 套教程完成验收 → 计为完成下载）
 */
export function buildCourseCompletion(
  catalogTargets: CatalogTarget[],
  details: Record<string, KnowledgeDetail>,
): CourseCompletion {
  const courses = new Set(catalogTargets.map((t) => t.course_id));
  const verifiedCountByCourse = new Map<string, number>();
  for (const d of Object.values(details)) {
    if (!isTutorialVerified(d)) continue;
    verifiedCountByCourse.set(d.course_id, (verifiedCountByCourse.get(d.course_id) ?? 0) + 1);
  }
  const completed = [...verifiedCountByCourse.values()].filter((n) => n >= 2).length;
  return { total: courses.size, completed };
}

// --- store ---

export interface DashboardStore {
  knowledge: KnowledgeRecord[];
  details: Record<string, KnowledgeDetail>;
  /** catalog targets（课程清单，课程饼图分母来源；独立降级） */
  catalogTargets: CatalogTarget[];
  loading: boolean;
  /** 整体错误（教程请求为 offline 类错误 → 8900 不可达；替代原 /services 判定） */
  error: string | null;
  /** 数据域独立错误（8901 不可达等） */
  dataError: string | null;
  /** catalog 独立错误（课程饼图降级用，不阻塞其他卡） */
  catalogError: string | null;
  fetchAll: () => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  knowledge: [],
  details: {},
  catalogTargets: [],
  loading: false,
  error: null,
  dataError: null,
  catalogError: null,

  fetchAll: async () => {
    if (get().loading) return;
    set({ loading: true });
    const [list, dataErr] = await listKnowledge()
      .then((k) => [k, null] as const)
      .catch((err) => [null, err] as const);

    // 并行拉取每行详情（含 books），逐行独立降级
    let details: Record<string, KnowledgeDetail> = {};
    if (list && list.length > 0) {
      const settled = await Promise.allSettled(list.map((k) => getKnowledge(k.knowledge_id)));
      details = {};
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') details[list[index].knowledge_id] = result.value;
      });
    }

    // catalog（课程饼图分母）；独立降级：失败仅课程饼图提示，不阻塞其他卡
    const [catalog, catalogErr] = await listCatalog()
      .then((c) => [c, null] as const)
      .catch((err) => [null, err] as const);

    // 整体横幅判定：教程请求为 offline 类错误 → 8900 管理服务不可达；
    // http 类（如 8901 经 8900 透传的 503）不算整体离线，仅数据卡降级
    const isOffline = dataErr instanceof ApiError && dataErr.kind === 'offline';

    set({
      knowledge: list ?? get().knowledge,
      details,
      catalogTargets: catalog?.targets ?? get().catalogTargets,
      dataError: dataErr ? (dataErr instanceof Error ? dataErr.message : String(dataErr)) : null,
      catalogError: catalogErr ? (catalogErr instanceof Error ? catalogErr.message : String(catalogErr)) : null,
      error: isOffline ? (dataErr as ApiError).message : null,
    });
    set({ loading: false });
  },
}));
