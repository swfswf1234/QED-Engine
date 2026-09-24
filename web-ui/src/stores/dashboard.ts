/**
 * 仪表盘 store（2026-09-24 REQ-033 三块制·用户五改形态）
 * - 块二 文档下载：KPI＝领域数/课程数/书目数/验收通过；领域四态（未开始/探索中/下载中/
 *   下载完成，buildDomainDownloadState）由课程与书籍态聚合派生；课程逐行＝状态四词
 *   （未探索/探索中/下载中/完成，courseProgressState）+ 教程数 + 一书一格进度
 *   （bookDownloadBucket 四桶着色，parallel/retired 不画格）；四桶计数文本与领域汇总退役
 * - 块三 文档解析：判定基座＝af_books 书目字段（Axiom-Flow ADR 0007 三分语义：
 *   parse_status 仅进度、last_parse_result 结局、active_job_id＝可激活版本唯一事实源），
 *   页数分母＝page_count（书全量）；按课程分组、在飞课程组置顶、每页 3 课程组分页；
 *   /parse-jobs 仅供「失败 N 页」辅助展示（最新 job progress.failed），不再驱动状态
 * - 独立降级：8901 不可达 → 块二降级；8902 不可达 → 块三降级；8900 不可达 → 整体横幅
 */
import { create } from 'zustand';
import { ApiError } from '../api/client';
import { getKnowledge, listCourseSystem, listKnowledge } from '../api/tracker';
import { listBooks, listParseJobs, type BookMeta, type ParseJob } from '../api/axiom';
import type { BookRecord, CourseRecord, DomainSystem, KnowledgeDetail, KnowledgeRecord } from './index';

// --- 辅助类型 ---

/** 块二四桶固定名（顺序即展示序与图例序） */
export const BUCKET_ORDER = ['未开始下载', '下载中', '下载完成', '验证完成'] as const;

export type BucketName = typeof BUCKET_ORDER[number];

/** 块二课程进度格子（一书一格；bucket null 的书不画格） */
export interface BookCell {
  bookId: string;
  title: string;
  bucket: BucketName;
}

export interface DashboardStats {
  totalDomains: number;    // 领域数（四改：全部领域，不再限已探明）
  totalCourses: number;    // 课程数
  totalBooks: number;      // 书目数
  verifiedBooks: number;   // 验收通过
}

// --- 块二：领域四态 + 课程格子进度（五改 F2） ---

/** 课程行（五改：名称｜状态｜教程数（如有）｜格子），旧四桶计数文本与领域汇总退役 */
export interface CourseProgressRow {
  courseId: string;
  name: string;
  /** 未探索 / 探索中 / 下载中 / 完成（courseProgressState） */
  state: string;
  /** kind==='tutorial' 教程记录数；0 → 前端不显示 */
  tutorialCount: number;
  /** 一书一格（book_id 去重、入参序；未探索行恒为空） */
  cells: BookCell[];
}

export interface DomainDownloadDetail {
  domain: string;
  /** 领域四态：未开始 / 探索中 / 下载中 / 下载完成 */
  domainState: string;
  courses: CourseProgressRow[];
}

const hasEnteredExploration = (c: CourseRecord) =>
  Boolean(c.exploration_stage && c.exploration_stage !== '未开始');

/** 书是否已开始下载（decided 起算；candidate 未开始；parallel/retired 不计） */
const downloadStarted = (b: BookRecord) =>
  ['decided', 'downloading', 'downloaded', 'verified', 'failed'].includes(b.status ?? '');

/**
 * 领域四态判定（admin-dashboard.md §4.2，按序取首个命中）：
 * 未开始＝无课程进入探索；探索中＝有课程探索但无书开始下载；
 * 下载完成＝全部课程探索完成且已决定书拿齐（status ∈ downloaded/verified）；其余＝下载中。
 */
export function buildDomainDownloadState(courses: CourseRecord[], books: BookRecord[]): string {
  if (!courses.some(hasEnteredExploration)) return '未开始';
  if (!books.some(downloadStarted)) return '探索中';
  const allExplored = courses.length > 0 && courses.every((c) => c.exploration_stage === '已完成');
  // 拿齐＝没有仍在下载生命周期中途的书（decided/downloading/failed 未了结即未完成）
  const allFetched = books.every((b) => !['decided', 'downloading', 'failed'].includes(b.status ?? ''));
  if (allExplored && allFetched) return '下载完成';
  return '下载中';
}

/** 单书格子着色（四桶口径；parallel/retired 等不画格 → null） */
export function bookDownloadBucket(b: BookRecord): BucketName | null {
  const status = b.status ?? 'candidate';
  if (status === 'candidate') return '未开始下载';
  if (status === 'decided' || status === 'downloading' || status === 'failed') return '下载中';
  if (status === 'downloaded') return '下载完成';
  if (status === 'verified') return '验证完成';
  return null;
}

const bookCell = (b: BookRecord): BookCell | null => {
  const bucket = bookDownloadBucket(b);
  if (!bucket) return null;
  return {
    bookId: b.book_id,
    title: [b.title, b.part].filter(Boolean).join(' ') || b.book_id,
    bucket,
  };
};

/**
 * 课程行状态（五改 F2 口径，按序取首个命中）：
 * 未探索＝exploration_stage 未开始；完成＝探索完成且书目全部验证完成（有书）；
 * 下载中＝有书已开始下载；其余＝探索中。
 */
export function courseProgressState(course: CourseRecord, books: BookRecord[]): string {
  const st = course.exploration_stage ?? '';
  if (!st || st === '未开始') return '未探索';
  const counted = books.filter((b) => bookDownloadBucket(b) !== null);
  if (st === '已完成' && counted.length > 0 && counted.every((b) => b.status === 'verified')) return '完成';
  if (books.some(downloadStarted)) return '下载中';
  return '探索中';
}

function domainBookMap(details: Record<string, KnowledgeDetail>) {
  const booksByCourse = new Map<string, BookRecord[]>();
  for (const d of Object.values(details)) {
    const existing = booksByCourse.get(d.course_id) ?? [];
    existing.push(...(d.books ?? []));
    booksByCourse.set(d.course_id, existing);
  }
  return booksByCourse;
}

/**
 * 块二聚合（五改 F2）：所选领域的「领域四态 + 课程行（状态/教程数/格子）」大卡数据；
 * 领域不存在 → null。旧四桶计数文本与「领域书籍」汇总段退役（其他不写）。
 */
export function buildDomainDownloadDetail(
  courseSystem: DomainSystem[],
  details: Record<string, KnowledgeDetail>,
  domainId: string,
  knowledge: KnowledgeRecord[] = [],
): DomainDownloadDetail | null {
  const dm = courseSystem.find((d) => d.domain_id === domainId);
  if (!dm) return null;
  const booksByCourse = domainBookMap(details);
  const domainCourses = dm.courses ?? [];
  const domainBooks: BookRecord[] = [];
  for (const c of domainCourses) domainBooks.push(...(booksByCourse.get(c.course_id) ?? []));
  return {
    domain: dm.name,
    domainState: buildDomainDownloadState(domainCourses, domainBooks),
    courses: domainCourses.map((c) => {
      const cBooks = booksByCourse.get(c.course_id) ?? [];
      const state = courseProgressState(c, cBooks);
      const cells = state === '未探索'
        ? []
        : [...new Map(cBooks.map((b) => [b.book_id, b])).values()]
          .map(bookCell).filter((x): x is BookCell => x !== null);
      return {
        courseId: c.course_id,
        name: c.name || c.course_id,
        state,
        tutorialCount: knowledge.filter((k) => k.course_id === c.course_id && k.kind === 'tutorial').length,
        cells,
      };
    }),
  };
}

/** 全部领域的四态映射（领域按钮小圆点数据源） */
export function buildDomainStateMap(
  courseSystem: DomainSystem[],
  details: Record<string, KnowledgeDetail>,
): Record<string, string> {
  const booksByCourse = domainBookMap(details);
  const map: Record<string, string> = {};
  for (const dm of courseSystem) {
    const courses = dm.courses ?? [];
    const books: BookRecord[] = [];
    for (const c of courses) books.push(...(booksByCourse.get(c.course_id) ?? []));
    map[dm.domain_id] = buildDomainDownloadState(courses, books);
  }
  return map;
}

// --- 块三：解析进度（af_books 字段基座，Axiom-Flow ADR 0007 口径） ---

export interface ParseBookRow {
  bookId: string;
  title: string;
  courseId: string;
  courseName: string;
  /** af_books.parse_status === 'parsing'（任务在飞，优先于其他判定） */
  running: boolean;
  /** 解析中 / 已完成 / 部分生效 / 未生效 / partial / 失败 / 中断 / 未入库 / 未开始 */
  label: string;
  /** 已解析页数（af_books.pages_done） */
  done: number;
  /** 全书总页数（af_books.page_count，ingest 后回填；0=未入库/未知） */
  total: number;
  /** 最新 job 的 progress.failed（辅助展示，不驱动状态） */
  failed: number;
}

export interface ParseCourseGroup {
  courseId: string;
  courseName: string;
  books: ParseBookRow[];
  /** 组内任一书在飞 */
  running: boolean;
}

export interface ParseStats {
  totalBooks: number;
  /** 课程分组数（含未归属） */
  totalCourses: number;
  /** 「已完成」口径＝生效版本在位且覆盖全书（生效版本页不齐=部分生效，不计入） */
  finishedBooks: number;
  runningBooks: number;
}

/**
 * 书级解析状态判定（裁决序：在飞 > 生效版本三分页齐/不齐 > 页齐未激活 > 结局失败族 > 未入库/未开始）。
 * pages_done 描述的是 active_job_id 所指生效版本（Axiom-Flow database-design 口径），
 * 生效版本在手时书级结局只按版本页覆盖判，不受后续失败任务残留的 last_parse_result 影响。
 */
export function parseBookLabel(b: BookMeta): { label: string; running: boolean } {
  const total = b.page_count ?? 0;
  const done = b.pages_done ?? 0;
  const running = b.parse_status === 'parsing';
  if (running) return { label: '解析中', running };
  if (b.active_job_id) {
    return { label: total > 0 && done < total ? '部分生效' : '已完成', running };
  }
  if (total > 0 && done >= total) return { label: '未生效', running };
  if (b.last_parse_result === 'partial') return { label: 'partial', running };
  if (b.last_parse_result === 'failed') return { label: '失败', running };
  if (b.last_parse_result === 'interrupted') return { label: '中断', running };
  if (b.ingest_status !== 'ingested' && total === 0) return { label: '未入库', running };
  return { label: '未开始', running };
}

/**
 * 块三聚合：书目 → 每书进度行 → 按课程分组（保持书目首现序）；
 * 在飞课程组整体置顶；「失败 N 页」取该书最新 job（created_at 字典序最大）。
 */
export function buildParseGroups(
  books: BookMeta[],
  jobs: ParseJob[],
): { groups: ParseCourseGroup[]; stats: ParseStats } {
  const latestByBook = new Map<string, ParseJob>();
  for (const j of jobs) {
    if (!j.book_id) continue;
    const cur = latestByBook.get(j.book_id);
    if (!cur || (j.created_at ?? '') > (cur.created_at ?? '')) latestByBook.set(j.book_id, j);
  }
  const rows: ParseBookRow[] = books.map((b) => {
    const { label, running } = parseBookLabel(b);
    return {
      bookId: b.book_id,
      title: b.display_title || [b.title, b.part].filter(Boolean).join(' ') || b.book_id,
      courseId: b.course_id ?? '',
      courseName: b.course_name || b.course_id || '未归属课程',
      running,
      label,
      done: b.pages_done ?? 0,
      total: b.page_count ?? 0,
      failed: latestByBook.get(b.book_id)?.progress?.failed ?? 0,
    };
  });
  const groupMap = new Map<string, ParseCourseGroup>();
  for (const r of rows) {
    const g = groupMap.get(r.courseId) ?? { courseId: r.courseId, courseName: r.courseName, books: [], running: false };
    g.books.push(r);
    g.running ||= r.running;
    groupMap.set(r.courseId, g);
  }
  const groups = [...groupMap.values()];
  groups.sort((a, b) => Number(b.running) - Number(a.running));
  return {
    groups,
    stats: {
      totalBooks: rows.length,
      totalCourses: groups.length,
      finishedBooks: rows.filter((r) => r.label === '已完成').length,
      runningBooks: rows.filter((r) => r.running).length,
    },
  };
}

/**
 * 仪表盘统计数字（四改口径）：
 * - 领域数：全部领域总数；课程数：所有领域课程总数
 * - 书目数：所有教程详情 books 总数（book_id 去重）；验收通过：holding==='owned' 去重数
 */
export function buildDashboardStats(
  courseSystem: DomainSystem[],
  details: Record<string, KnowledgeDetail>,
): DashboardStats {
  const totalCourses = courseSystem.reduce((sum, d) => sum + (d.courses?.length ?? 0), 0);

  const bookSet = new Set<string>();
  const verifiedSet = new Set<string>();
  for (const d of Object.values(details)) {
    for (const b of d.books ?? []) {
      bookSet.add(b.book_id);
      if (b.holding === 'owned') verifiedSet.add(b.book_id);
    }
  }

  return {
    totalDomains: courseSystem.length,
    totalCourses,
    totalBooks: bookSet.size,
    verifiedBooks: verifiedSet.size,
  };
}

// --- store ---

export interface DashboardStore {
  knowledge: KnowledgeRecord[];
  details: Record<string, KnowledgeDetail>;
  /** 领域课程体系（/courses） */
  courseSystem: DomainSystem[];
  /** 块三数据源：af_books 书目（/books，8902 透传） */
  parseBooks: BookMeta[];
  /** 块三辅助数据源：解析任务列表（/parse-jobs，limit 50，仅失败页数展示） */
  parseJobs: ParseJob[];
  loading: boolean;
  /** 整体错误（8900 不可达） */
  error: string | null;
  /** 数据域独立错误（8901 不可达等） */
  dataError: string | null;
  /** 课程体系错误（courses 不可达） */
  courseError: string | null;
  /** 解析域独立错误（8902 不可达 → 块三降级，不阻塞块一二） */
  parseError: string | null;
  fetchAll: () => Promise<void>;
  /** 仅重拉块三数据源（30s 保鲜轮询；失败保留旧值仅置 parseError） */
  fetchParse: () => Promise<void>;
}

const settle = <T,>(p: Promise<T>) =>
  p.then((v) => [v, null] as const).catch((err) => [null, err] as const);

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  knowledge: [],
  details: {},
  courseSystem: [],
  parseBooks: [],
  parseJobs: [],
  loading: false,
  error: null,
  dataError: null,
  courseError: null,
  parseError: null,

  fetchParse: async () => {
    const [books, bErr] = await settle(listBooks());
    const [jobs, jErr] = await settle(listParseJobs());
    set({
      parseBooks: books ?? get().parseBooks,
      parseJobs: jobs?.jobs ?? get().parseJobs,
      parseError: bErr ? errText(bErr) : (jErr ? errText(jErr) : null),
    });
  },

  fetchAll: async () => {
    if (get().loading) return;
    set({ loading: true });
    // 块三与 tracker 线并行独立拉取（REQ-033 增量提交语义同 runtime store）
    void get().fetchParse();

    const [list, dataErr] = await settle(listKnowledge());

    let details: Record<string, KnowledgeDetail> = {};
    if (list && list.length > 0) {
      const settled = await Promise.allSettled(list.map((k) => getKnowledge(k.knowledge_id)));
      details = {};
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') details[list[index].knowledge_id] = result.value;
      });
    }

    const [courseSystem, courseErr] = await settle(listCourseSystem());

    const isOffline = dataErr instanceof ApiError && dataErr.kind === 'offline';

    set({
      knowledge: list ?? get().knowledge,
      details,
      courseSystem: courseSystem ?? get().courseSystem,
      dataError: dataErr ? errText(dataErr) : null,
      courseError: courseErr ? errText(courseErr) : null,
      error: isOffline ? (dataErr as ApiError).message : null,
    });
    set({ loading: false });
  },
}));
