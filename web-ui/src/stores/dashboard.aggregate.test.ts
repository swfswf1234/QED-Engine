/**
 * 仪表盘聚合纯函数单测（2026-09-24 REQ-033 三块制·用户五改形态）
 * - 块二：buildDomainDownloadState（领域四态）+ courseProgressState（课程行状态
 *   未探索/探索中/下载中/完成）+ bookDownloadBucket（单书格子着色）+
 *   buildDomainDownloadDetail（大卡：状态/教程数/一书一格）+ buildDomainStateMap；
 *   旧四桶计数 courseDownloadBuckets、领域汇总 summarySlices、bookTotal 字段退役
 * - 块三：parseBookLabel（af_books 字段判定，ADR 0007 三分语义）+ buildParseGroups
 *   （课程分组、在飞组置顶、失败页数取最新 job）
 * - buildDashboardStats：四统计数字（领域数全量口径）
 */
import { describe, it, expect } from 'vitest';
import {
  bookDownloadBucket,
  buildDomainDownloadDetail,
  buildDomainDownloadState,
  buildDomainStateMap,
  courseProgressState,
  parseBookLabel,
  buildParseGroups,
  buildDashboardStats,
} from './dashboard';
import type { BookRecord, CourseRecord, DomainSystem, KnowledgeDetail, KnowledgeRecord } from './index';
import type { BookMeta, ParseJob } from '../api/axiom';

// --- 辅助工厂函数 ---

function domain(partial: Partial<DomainSystem> & { domain_id: string; name: string }): DomainSystem {
  return {
    courses: [],
    ...partial,
  } as DomainSystem;
}

function course(partial: Partial<CourseRecord> & { course_id: string; name: string }): CourseRecord {
  return {
    aliases: [],
    stage: '基础',
    prerequisites: [],
    ...partial,
  } as CourseRecord;
}

function kn(partial: Partial<KnowledgeRecord> & { knowledge_id: string; course_id: string }): KnowledgeRecord {
  return {
    domain_id: 'math',
    kind: 'tutorial',
    set_no: '',
    name: '',
    textbook_ref: null,
    exercise_ref: null,
    intro: '',
    status: 'draft',
    reject_reason: '',
    supersede_reason: '',
    created_at: '',
    confirmed_at: null,
    completed_at: null,
    ...partial,
  };
}

function book(partial: Partial<BookRecord> & { book_id: string }): BookRecord {
  return {
    title: 't',
    original_title: null,
    part: '',
    authors: [],
    publisher: '',
    edition: '',
    year: null,
    language: 'zh',
    roles: ['textbook'],
    status: 'candidate',
    retire_reason: '',
    holding: 'missing',
    file_path: null,
    priority: null,
    notes: null,
    domain_id: 'math',
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

function detail(k: KnowledgeRecord, books: BookRecord[]): KnowledgeDetail {
  return { ...k, books };
}

function afBook(partial: Partial<BookMeta> & { book_id: string }): BookMeta {
  return {
    title: '书目',
    page_count: null,
    sha256: '',
    strategy: 'local',
    ingest_status: 'ingested',
    parse_status: 'pending',
    pages_done: 0,
    last_parse_result: '',
    active_job_id: null,
    ...partial,
  } as BookMeta;
}

function job(partial: Partial<ParseJob> & { id: string }): ParseJob {
  return {
    status: 'completed',
    progress: { parsed: 10, total: 10, failed: 0 },
    created_at: '2026-09-20T00:00:00',
    ...partial,
  } as ParseJob;
}

// --- 块二：领域四态 + 课程格子进度（五改 F2） ---

describe('bookDownloadBucket（单书格子着色，四桶口径）', () => {
  it('candidate=未开始下载；decided/downloading/failed=下载中；downloaded=下载完成；verified=验证完成；parallel/retired 不画格', () => {
    expect(bookDownloadBucket(book({ book_id: 'b1', status: 'candidate' }))).toBe('未开始下载');
    expect(bookDownloadBucket({ book_id: 'b2' } as BookRecord)).toBe('未开始下载'); // 无 status 按 candidate
    expect(bookDownloadBucket(book({ book_id: 'b3', status: 'decided' }))).toBe('下载中');
    expect(bookDownloadBucket(book({ book_id: 'b4', status: 'downloading' }))).toBe('下载中');
    expect(bookDownloadBucket(book({ book_id: 'b5', status: 'failed' }))).toBe('下载中');
    expect(bookDownloadBucket(book({ book_id: 'b6', status: 'downloaded' }))).toBe('下载完成');
    expect(bookDownloadBucket(book({ book_id: 'b7', status: 'verified' }))).toBe('验证完成');
    expect(bookDownloadBucket(book({ book_id: 'b8', status: 'parallel' }))).toBeNull();
    expect(bookDownloadBucket(book({ book_id: 'b9', status: 'retired' }))).toBeNull();
  });
});

describe('courseProgressState（课程行状态四词，按序命中）', () => {
  it('exploration_stage 未开始/缺省 → 未探索（有书也不画格）', () => {
    expect(courseProgressState(course({ course_id: 'c1', name: 'C1' }), [])).toBe('未探索');
    expect(courseProgressState(course({ course_id: 'c1', name: 'C1', exploration_stage: '未开始' }),
      [book({ book_id: 'b1', status: 'decided' })])).toBe('未探索');
  });

  it('完成＝探索完成且书目（计入格子的书）全部验证完成；验证完成+candidate 混合＝下载中（有书已开始下载）', () => {
    expect(courseProgressState(course({ course_id: 'c1', name: 'C1', exploration_stage: '已完成' }),
      [book({ book_id: 'b1', status: 'verified' }), book({ book_id: 'b2', status: 'retired' })])).toBe('完成');
    expect(courseProgressState(course({ course_id: 'c1', name: 'C1', exploration_stage: '已完成' }),
      [book({ book_id: 'b1', status: 'verified' }), book({ book_id: 'b2', status: 'candidate' })])).toBe('下载中');
    // 探索完成但全部 candidate（无书开始下载）→ 探索中
    expect(courseProgressState(course({ course_id: 'c1', name: 'C1', exploration_stage: '已完成' }),
      [book({ book_id: 'b2', status: 'candidate' })])).toBe('探索中');
  });

  it('有书开始下载（decided 起算含 downloaded）→ 下载中；探索中但无书 → 探索中', () => {
    expect(courseProgressState(course({ course_id: 'c1', name: 'C1', exploration_stage: '探索中' }),
      [book({ book_id: 'b1', status: 'decided' })])).toBe('下载中');
    expect(courseProgressState(course({ course_id: 'c1', name: 'C1', exploration_stage: '已完成' }),
      [book({ book_id: 'b1', status: 'downloaded' })])).toBe('下载中');
    expect(courseProgressState(course({ course_id: 'c1', name: 'C1', exploration_stage: '探索中' }), [])).toBe('探索中');
    // 探索完成但零书 → 探索中（不冒完成）
    expect(courseProgressState(course({ course_id: 'c1', name: 'C1', exploration_stage: '已完成' }), [])).toBe('探索中');
  });
});

describe('buildDomainDownloadState（领域四态，按序命中）', () => {
  it('无课程进入探索 → 未开始（新建）', () => {
    expect(buildDomainDownloadState(
      [course({ course_id: 'c1', name: 'C1', exploration_stage: '未开始' })], [],
    )).toBe('未开始');
    expect(buildDomainDownloadState([], [])).toBe('未开始');
  });

  it('有课程进入探索但无书开始下载 → 探索中（含探索完成但全 candidate）', () => {
    expect(buildDomainDownloadState(
      [course({ course_id: 'c1', name: 'C1', exploration_stage: '探索中' })], [],
    )).toBe('探索中');
    expect(buildDomainDownloadState(
      [course({ course_id: 'c1', name: 'C1', exploration_stage: '已完成' })],
      [book({ book_id: 'b1', status: 'candidate' })],
    )).toBe('探索中');
  });

  it('有书开始下载（decided 起算）且未拿齐 → 下载中', () => {
    expect(buildDomainDownloadState(
      [course({ course_id: 'c1', name: 'C1', exploration_stage: '已完成' })],
      [book({ book_id: 'b1', status: 'decided' }), book({ book_id: 'b2', status: 'verified' })],
    )).toBe('下载中');
    // 失败未了结也算下载中
    expect(buildDomainDownloadState(
      [course({ course_id: 'c1', name: 'C1', exploration_stage: '已完成' })],
      [book({ book_id: 'b1', status: 'failed' })],
    )).toBe('下载中');
  });

  it('全部课程探索完成且已决定书拿齐（downloaded/verified）→ 下载完成；剩余 candidate 不阻塞', () => {
    expect(buildDomainDownloadState(
      [
        course({ course_id: 'c1', name: 'C1', exploration_stage: '已完成' }),
        course({ course_id: 'c2', name: 'C2', exploration_stage: '已完成' }),
      ],
      [
        book({ book_id: 'b1', status: 'verified' }),
        book({ book_id: 'b2', status: 'downloaded' }),
        book({ book_id: 'b3', status: 'candidate' }),
        book({ book_id: 'b4', status: 'retired' }),
      ],
    )).toBe('下载完成');
  });

  it('书拿齐但有课程仍在探索 → 不算下载完成（下载中）', () => {
    expect(buildDomainDownloadState(
      [
        course({ course_id: 'c1', name: 'C1', exploration_stage: '已完成' }),
        course({ course_id: 'c2', name: 'C2', exploration_stage: '待确认' }),
      ],
      [book({ book_id: 'b1', status: 'verified' })],
    )).toBe('下载中');
  });
});

describe('buildDomainDownloadDetail（块二：所选领域大卡·五改格子形态）', () => {
  const cs: DomainSystem[] = [
    domain({
      domain_id: 'math',
      name: '数学',
      exploration_stage: '已完成',
      courses: [
        course({ course_id: 'c1', name: 'C1', exploration_stage: '未开始' }),
        course({ course_id: 'c2', name: 'C2', exploration_stage: '已完成' }),
        course({ course_id: 'c3', name: 'C3', exploration_stage: '已完成' }),
      ],
    }),
  ];
  const details: Record<string, KnowledgeDetail> = {
    k1: detail(kn({ knowledge_id: 'k1', course_id: 'c2' }), [
      book({ book_id: 'b1', status: 'verified', holding: 'owned', title: '教材甲' }),
      book({ book_id: 'b2', status: 'downloaded', title: '教材乙' }),
    ]),
    k1a: detail(kn({ knowledge_id: 'k1a', course_id: 'c2' }), [
      // 同一 book 被两套教程引用 → 格子按 book_id 去重
      book({ book_id: 'b1', status: 'verified', title: '教材甲' }),
    ]),
    k2: detail(kn({ knowledge_id: 'k2', course_id: 'c3' }), [
      book({ book_id: 'b3', status: 'decided', holding: 'owned' }),
      book({ book_id: 'b4', status: 'parallel', holding: 'owned' }),
      book({ book_id: 'b5', status: 'retired' }),
      book({ book_id: 'b6', status: 'failed' }),
    ]),
    k3: detail(kn({ knowledge_id: 'k3', course_id: 'ghost' }), [
      book({ book_id: 'b9', status: 'verified' }),
    ]),
  };
  const knowledge: KnowledgeRecord[] = [
    kn({ knowledge_id: 'k1', course_id: 'c2' }),
    kn({ knowledge_id: 'k1a', course_id: 'c2' }),
    kn({ knowledge_id: 'k1b', course_id: 'c2', kind: 'other_material' }), // 延展资料不计教程数
    kn({ knowledge_id: 'k2', course_id: 'c3' }),
  ];

  it('课程行＝状态四词 + 教程数 + 格子（一书一格、book_id 去重、parallel/retired 不画格）；ghost 书不计入', () => {
    const d = buildDomainDownloadDetail(cs, details, 'math', knowledge)!;
    expect(d.domain).toBe('数学');
    expect(d.domainState).toBe('下载中');
    expect(d.courses).toEqual([
      { courseId: 'c1', name: 'C1', state: '未探索', tutorialCount: 0, cells: [] },
      {
        courseId: 'c2', name: 'C2', state: '下载中', tutorialCount: 2,
        cells: [
          { bookId: 'b1', title: '教材甲', bucket: '验证完成' },
          { bookId: 'b2', title: '教材乙', bucket: '下载完成' },
        ],
      },
      {
        courseId: 'c3', name: 'C3', state: '下载中', tutorialCount: 1,
        cells: [
          { bookId: 'b3', title: 't', bucket: '下载中' },
          { bookId: 'b6', title: 't', bucket: '下载中' },
        ],
      },
    ]);
  });

  it('探索完成且全部书验证完成 → 完成行', () => {
    const d = buildDomainDownloadDetail(
      [domain({ domain_id: 'a', name: 'A', courses: [course({ course_id: 'c1', name: 'C1', exploration_stage: '已完成' })] })],
      { k1: detail(kn({ knowledge_id: 'k1', course_id: 'c1' }), [book({ book_id: 'b1', status: 'verified' })]) },
      'a', [],
    )!;
    expect(d.courses[0].state).toBe('完成');
  });

  it('buildDomainStateMap：全部领域按钮四态映射', () => {
    const cs2: DomainSystem[] = [
      ...cs,
      domain({ domain_id: 'cs', name: '计算机', courses: [course({ course_id: 'k1', name: 'K1', exploration_stage: '探索中' })] }),
      domain({ domain_id: 'phy', name: '物理', courses: [] }),
    ];
    expect(buildDomainStateMap(cs2, details)).toEqual({
      math: '下载中',
      cs: '探索中',
      phy: '未开始',
    });
  });

  it('领域不存在 → null；空课程领域输出空行', () => {
    expect(buildDomainDownloadDetail(cs, details, 'nope')).toBeNull();
    const d = buildDomainDownloadDetail([domain({ domain_id: 'e', name: 'E' })], {}, 'e')!;
    expect(d.domainState).toBe('未开始');
    expect(d.courses).toEqual([]);
  });
});

// --- 块三：解析进度（af_books 字段基座） ---

describe('parseBookLabel（ADR 0007 三分语义判定）', () => {
  it('裁决序：解析中 > 生效版本（页齐=已完成/页不齐=部分生效）> 页齐未激活=未生效 > partial/失败/中断 > 未入库/未开始', () => {
    expect(parseBookLabel(afBook({ book_id: 'x', parse_status: 'parsing', page_count: 400, pages_done: 120 })))
      .toEqual({ label: '解析中', running: true });
    expect(parseBookLabel(afBook({ book_id: 'x', active_job_id: 'j9', last_parse_result: 'completed' })).label)
      .toBe('已完成');
    // 真机场景（0924 仪表盘实测）：线性代数及其应用生效版本仅 3 页（pages_done
    // 描述的是 active_job_id 所指版本，Axiom-Flow database-design 既定义）→ 部分生效
    expect(parseBookLabel(afBook({ book_id: 'x', active_job_id: 'j3', last_parse_result: 'completed', page_count: 486, pages_done: 3 })).label)
      .toBe('部分生效');
    // 生效版本在手时最新结局即便是失败族（后续局部重跑失败），书级仍按生效版本判
    expect(parseBookLabel(afBook({ book_id: 'x', active_job_id: 'j3', last_parse_result: 'failed', page_count: 486, pages_done: 486 })).label)
      .toBe('已完成');
    // b05 legacy：全书页齐但从未激活版本——不得判「已完成」（用户点名误判场景）
    expect(parseBookLabel(afBook({ book_id: 'x', page_count: 317, pages_done: 317, last_parse_result: 'completed', active_job_id: null })).label)
      .toBe('未生效');
    expect(parseBookLabel(afBook({ book_id: 'x', page_count: 400, pages_done: 300, last_parse_result: 'partial' })).label).toBe('partial');
    expect(parseBookLabel(afBook({ book_id: 'x', page_count: 400, pages_done: 3, last_parse_result: 'failed' })).label).toBe('失败');
    expect(parseBookLabel(afBook({ book_id: 'x', page_count: 400, pages_done: 312, last_parse_result: 'interrupted' })).label).toBe('中断');
    expect(parseBookLabel(afBook({ book_id: 'x', ingest_status: 'none', page_count: null })).label).toBe('未入库');
    expect(parseBookLabel(afBook({ book_id: 'x', page_count: 400, pages_done: 0 })).label).toBe('未开始');
  });

  it('单页复测 job 不影响书级页数（分母恒为 page_count，无页齐判据时不冒完成）', () => {
    // 线性代数场景：全书 457 页、只跑过 1 页任务、无任何终态 → 未开始 1/457
    const b = afBook({ book_id: 'x', page_count: 457, pages_done: 1, last_parse_result: '' });
    expect(parseBookLabel(b).label).toBe('未开始');
  });
});

describe('buildParseGroups（块三：课程分组 + KPI + 在飞组置顶）', () => {
  const books = [
    afBook({ book_id: 'bk1', title: '数学分析原理', course_id: 'math', course_name: '数学分析', active_job_id: 'j-a', last_parse_result: 'completed', page_count: 300, pages_done: 300 }),
    afBook({ book_id: 'bk2', title: '实变函数', course_id: 'real', course_name: '实变函数', parse_status: 'parsing', page_count: 317, pages_done: 120 }),
    afBook({ book_id: 'bk3', title: '线性代数及其应用', course_id: 'math', course_name: '数学分析', page_count: 457, pages_done: 1 }),
    afBook({ book_id: 'bk4', title: '拓扑学', course_id: 'topo', course_name: '拓扑', last_parse_result: 'interrupted', page_count: 200, pages_done: 180 }),
    afBook({ book_id: 'bk5', title: '未归属书', page_count: null, ingest_status: 'none' }),
  ];
  const jobs: ParseJob[] = [
    job({ id: 'j1', book_id: 'bk2', status: 'running', created_at: '2026-09-23T00:00:00', progress: { parsed: 120, total: 317, failed: 2 } }),
    job({ id: 'j0', book_id: 'bk2', status: 'completed', created_at: '2026-09-01T00:00:00', progress: { parsed: 5, total: 5, failed: 9 } }),
  ];

  it('按课程分组保持首现序；在飞课程组整体置顶；组内书保持入参序', () => {
    const { groups } = buildParseGroups(books, jobs);
    expect(groups.map((g) => g.courseName)).toEqual(['实变函数', '数学分析', '拓扑', '未归属课程']);
    expect(groups[1].books.map((b) => b.bookId)).toEqual(['bk1', 'bk3']);
    expect(groups[0].running).toBe(true);
  });

  it('每书行：done/total 用 af_books 字段；failed 取最新 job（bk2 最新 j1 failed=2 而非 j0 的 9）', () => {
    const { groups } = buildParseGroups(books, jobs);
    const bk2 = groups[0].books[0];
    expect(bk2).toMatchObject({ label: '解析中', done: 120, total: 317, failed: 2, running: true });
    const bk3 = groups[1].books.find((b) => b.bookId === 'bk3')!;
    expect(bk3).toMatchObject({ label: '未开始', done: 1, total: 457, failed: 0 });
  });

  it('KPI：课程数/书目数/解析中/已完成（已完成仅生效版本）', () => {
    const { stats } = buildParseGroups(books, jobs);
    expect(stats).toEqual({ totalBooks: 5, totalCourses: 4, finishedBooks: 1, runningBooks: 1 });
  });

  it('空输入 → 空分组零 KPI', () => {
    expect(buildParseGroups([], [])).toEqual({
      groups: [],
      stats: { totalBooks: 0, totalCourses: 0, finishedBooks: 0, runningBooks: 0 },
    });
  });
});

// --- 统计数字（四改口径） ---

describe('buildDashboardStats', () => {
  it('领域数（全量口径）/课程数/书目数/验收通过', () => {
    const cs: DomainSystem[] = [
      domain({
        domain_id: 'math',
        name: '数学',
        exploration_stage: '已完成',
        courses: [course({ course_id: 'c1', name: 'C1' }), course({ course_id: 'c2', name: 'C2' })],
      }),
      domain({
        domain_id: 'cs',
        name: '计算机',
        exploration_stage: '未开始',
        courses: [course({ course_id: 'c3', name: 'C3' })],
      }),
    ];
    const details: Record<string, KnowledgeDetail> = {
      k1: detail(kn({ knowledge_id: 'k1', course_id: 'c1' }), [
        book({ book_id: 'b1', holding: 'owned' }),
        book({ book_id: 'b2', holding: 'missing' }),
      ]),
      k2: detail(kn({ knowledge_id: 'k2', course_id: 'c2' }), [
        book({ book_id: 'b3', holding: 'owned' }),
      ]),
    };
    const stats = buildDashboardStats(cs, details);
    expect(stats).toEqual({
      totalDomains: 2,       // 四改：全部领域（含未开始）
      totalCourses: 3,       // math 2 + cs 1
      totalBooks: 3,         // b1 + b2 + b3
      verifiedBooks: 2,      // b1 + b3 holding=owned
    });
  });

  it('空数据 → 全零', () => {
    expect(buildDashboardStats([], {})).toEqual({
      totalDomains: 0,
      totalCourses: 0,
      totalBooks: 0,
      verifiedBooks: 0,
    });
  });
});
