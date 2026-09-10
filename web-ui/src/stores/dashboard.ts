/**
 * 仪表盘 store（2026-09-07 重构：三行图表 + 统计数字）
 * - 新增 /courses 拉取领域课程体系（DomainSystem[]）
 * - 三行图表：领域探索进度 / 课程进度 / 文档下载进度（均按领域分组）
 * - 四统计数字：已探明领域数 / 课程数 / 书籍卷数 / 验收书目数
 * - 独立降级：8901 不可达 → 三行图表降级；8900 不可达 → 整体横幅
 */
import { create } from 'zustand';
import { ApiError } from '../api/client';
import { getKnowledge, listCourseSystem, listKnowledge } from '../api/tracker';
import type { BookRecord, DomainSystem, KnowledgeDetail, KnowledgeRecord } from './index';

// --- 辅助类型 ---

export interface DownloadSlice {
  name: string;
  value: number;
}

/** 按领域分组的多饼图输出：领域名 → 饼图切片 */
export type DomainCoursesSlice = Record<string, DownloadSlice[]>;

export interface DashboardStats {
  exploredDomains: number;   // 已探明领域数
  totalCourses: number;      // 课程数
  totalBooks: number;        // 书籍卷数
  verifiedBooks: number;     // 验收书目数
}

// --- 辅助函数 ---

/** 构建 course_id → DomainSystem 映射（用于域归属反查） */
function buildCourseToDomainMap(courseSystem: DomainSystem[]): Map<string, DomainSystem> {
  const map = new Map<string, DomainSystem>();
  for (const domain of courseSystem) {
    for (const course of domain.courses ?? []) {
      map.set(course.course_id, domain);
    }
  }
  return map;
}

// --- 聚合纯函数（独立可测） ---

/**
 * 领域探索进度饼图（聚合所有领域为单个饼图）：
 * - 新建（灰色）= exploration_stage === '未开始'
 * - 探索中（绿色）= exploration_stage in ['已生成', '探索中', '待确认']
 * - 完成（蓝色）= exploration_stage === '已完成'
 */
export function buildDomainProgress(courseSystem: DomainSystem[]): DownloadSlice[] {
  const counts = { '新建': 0, '探索中': 0, '完成': 0 };
  for (const domain of courseSystem) {
    const stage = domain.exploration_stage ?? '未开始';
    if (stage === '未开始') {
      counts['新建']++;
    } else if (['已生成', '探索中', '待确认'].includes(stage)) {
      counts['探索中']++;
    } else if (stage === '已完成') {
      counts['完成']++;
    } else {
      counts['新建']++;
    }
  }
  return (Object.entries(counts) as [string, number][])
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));
}

/**
 * 课程进度饼图（按领域分组）：
 * - 探索中（灰色）= course.exploration_stage !== '已完成'
 * - 探索完成（绿色）= 已完成但该课程下无 owned 书籍
 * - 下载中（橙色）= 已完成且有 owned 书籍但非全部已决定书籍
 * - 完成（蓝色）= 已完成且所有已决定书籍均为 owned
 */
export function buildCourseProgress(
  courseSystem: DomainSystem[],
  details: Record<string, KnowledgeDetail>,
): DomainCoursesSlice {
  // 从 details 收集每个 course_id 下的书籍状态
  const booksByCourse = new Map<string, BookRecord[]>();
  for (const d of Object.values(details)) {
    const existing = booksByCourse.get(d.course_id) ?? [];
    existing.push(...(d.books ?? []));
    booksByCourse.set(d.course_id, existing);
  }

  const result: DomainCoursesSlice = {};
  for (const domain of courseSystem) {
    const slices: DownloadSlice[] = [
      { name: '探索中', value: 0 },
      { name: '探索完成', value: 0 },
      { name: '下载中', value: 0 },
      { name: '完成', value: 0 },
    ];
    const sliceMap = new Map(slices.map((s) => [s.name, s]));

    for (const course of domain.courses ?? []) {
      const stage = course.exploration_stage ?? '未开始';
      if (stage !== '已完成') {
        sliceMap.get('探索中')!.value++;
        continue;
      }
      // exploration_stage === '已完成'，检查书籍状态
      const books = booksByCourse.get(course.course_id) ?? [];
      const decidedBooks = books.filter((b) => b.status === 'decided' || b.status === 'parallel');
      const ownedBooks = decidedBooks.filter((b) => b.holding === 'owned');

      if (decidedBooks.length === 0) {
        // 无已决定书籍 → 探索完成但尚未开始下载
        sliceMap.get('探索完成')!.value++;
      } else if (ownedBooks.length < decidedBooks.length) {
        // 部分已持有 → 下载中
        sliceMap.get('下载中')!.value++;
      } else {
        // 全部已持有 → 完成
        sliceMap.get('完成')!.value++;
      }
    }

    result[domain.name] = slices.filter((s) => s.value > 0);
  }
  return result;
}

/**
 * 课程进度饼图（空安全版本）：courseSystem 为空时返回空对象
 */
export function buildCourseProgressSafe(
  courseSystem: DomainSystem[] | undefined | null,
  details: Record<string, KnowledgeDetail>,
): DomainCoursesSlice {
  if (!courseSystem || !Array.isArray(courseSystem)) return {};
  return buildCourseProgress(courseSystem, details);
}

/**
 * 文档下载进度饼图（按领域分组）：
 * - 未开始（灰色）= holding=missing 且 status=candidate
 * - 下载中（橙色）= holding=missing 且 status=decided
 * - 待确认（绿色）= holding=owned 且 status=decided
 * - 完成（蓝色）= holding=owned 且 status=parallel
 */
export function buildBookDownloadProgress(
  courseSystem: DomainSystem[],
  details: Record<string, KnowledgeDetail>,
): DomainCoursesSlice {
  const courseToDomain = buildCourseToDomainMap(courseSystem);

  // 按领域收集书籍
  const booksByDomain = new Map<string, BookRecord[]>();
  for (const d of Object.values(details)) {
    const domain = courseToDomain.get(d.course_id);
    if (!domain) continue;
    const existing = booksByDomain.get(domain.domain_id) ?? [];
    existing.push(...(d.books ?? []));
    booksByDomain.set(domain.domain_id, existing);
  }

  const result: DomainCoursesSlice = {};
  for (const domain of courseSystem) {
    const books = booksByDomain.get(domain.domain_id) ?? [];
    const slices: DownloadSlice[] = [
      { name: '未开始', value: 0 },
      { name: '下载中', value: 0 },
      { name: '待确认', value: 0 },
      { name: '完成', value: 0 },
    ];
    const sliceMap = new Map(slices.map((s) => [s.name, s]));

    for (const book of books) {
      const holding = book.holding ?? 'missing';
      const status = book.status ?? 'candidate';

      if (holding === 'missing' && status === 'candidate') {
        sliceMap.get('未开始')!.value++;
      } else if (holding === 'missing' && status === 'decided') {
        sliceMap.get('下载中')!.value++;
      } else if (holding === 'owned' && status === 'decided') {
        sliceMap.get('待确认')!.value++;
      } else if (holding === 'owned' && status === 'parallel') {
        sliceMap.get('完成')!.value++;
      } else if (holding === 'owned') {
        // holding=owned 的其他 status 归入完成
        sliceMap.get('完成')!.value++;
      } else {
        // 其他归入未开始
        sliceMap.get('未开始')!.value++;
      }
    }

    result[domain.name] = slices.filter((s) => s.value > 0);
  }
  return result;
}

/**
 * 仪表盘统计数字：
 * - 已探明领域数：exploration_stage !== '未开始' 的领域数
 * - 课程数：所有领域下课程总数
 * - 书籍卷数：所有教程详情中的 books 总数（去重）
 * - 验收书目数：holding === 'owned' 的书籍数（去重）
 */
export function buildDashboardStats(
  courseSystem: DomainSystem[],
  details: Record<string, KnowledgeDetail>,
): DashboardStats {
  const exploredDomains = courseSystem.filter(
    (d) => d.exploration_stage && d.exploration_stage !== '未开始',
  ).length;
  const totalCourses = courseSystem.reduce((sum, d) => sum + (d.courses?.length ?? 0), 0);

  // 书籍去重（book_id）
  const bookSet = new Set<string>();
  const verifiedSet = new Set<string>();
  for (const d of Object.values(details)) {
    for (const b of d.books ?? []) {
      bookSet.add(b.book_id);
      if (b.holding === 'owned') verifiedSet.add(b.book_id);
    }
  }

  return {
    exploredDomains,
    totalCourses,
    totalBooks: bookSet.size,
    verifiedBooks: verifiedSet.size,
  };
}

// --- store ---

export interface DashboardStore {
  knowledge: KnowledgeRecord[];
  details: Record<string, KnowledgeDetail>;
  /** 领域课程体系（/courses，新增） */
  courseSystem: DomainSystem[];
  loading: boolean;
  /** 整体错误（8900 不可达） */
  error: string | null;
  /** 数据域独立错误（8901 不可达等） */
  dataError: string | null;
  /** 课程体系错误（courses 不可达） */
  courseError: string | null;
  fetchAll: () => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  knowledge: [],
  details: {},
  courseSystem: [],
  loading: false,
  error: null,
  dataError: null,
  courseError: null,

  fetchAll: async () => {
    if (get().loading) return;
    set({ loading: true });

    // 并行拉取教程列表和课程体系
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

    // 课程体系（领域+课程+探索状态）；独立降级：失败 → 三行图表全部降级
    const [courseSystem, courseErr] = await listCourseSystem()
      .then((c) => [c, null] as const)
      .catch((err) => [null, err] as const);

    // 整体横幅判定
    const isOffline = dataErr instanceof ApiError && dataErr.kind === 'offline';

    set({
      knowledge: list ?? get().knowledge,
      details,
      courseSystem: courseSystem ?? get().courseSystem,
      dataError: dataErr ? (dataErr instanceof Error ? dataErr.message : String(dataErr)) : null,
      courseError: courseErr ? (courseErr instanceof Error ? courseErr.message : String(courseErr)) : null,
      error: isOffline ? (dataErr as ApiError).message : null,
    });
    set({ loading: false });
  },
}));
