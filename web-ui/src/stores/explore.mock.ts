/**
 * 探索本地模拟后端（PLAN-022 F5 会话模型重写，2026-08-28；旧 explore-runs mock 已废弃）
 * - 与真实端点同形：createSession/fetchSession/confirmName/applySession/deleteSession
 * - 启动后 MOCK_READY_AFTER_MS 自动转 ready 并给出固定 fixtures（领域报告/教程推荐）；
 *   零网络依赖，供界面先行自测与演示（localStorage qed-explore-mock=1 开启）
 */
import type {
  CourseExploreReport, DomainExploreReport, ExploreApplyResult, ExploreLaunchMode,
  ExploreProposal, ExploreSessionRecord,
} from './index';

/** 启动后到 ready 的模拟耗时（< 一个轮询周期，保证一次轮询即见结果） */
export const MOCK_READY_AFTER_MS = 2000;

/** 模拟推荐套（对齐 ExploreProposal 契约结构，tutorials@v1 同形） */
function mockProposals(courseId: string): ExploreProposal[] {
  return [
    {
      proposal_id: 'mpp_1',
      set_no: '1',
      set_name: '套一',
      textbook: {
        title: 'Principles of Mathematical Analysis',
        authors: ['Walter Rudin'],
        version: { edition: '中译本', publisher: '机械工业出版社', year: 2004 },
        intro: '以度量空间上的分析为主线，结构严谨，经典本科分析教材。',
      },
      exercise: {
        title: '数学分析习题集',
        version: { edition: '', publisher: '', year: null },
        intro: '题量充足、难度梯度合理，配套教材使用。',
      },
      reason: '顶尖名校数学系指定教材，中译本详尽便于自学。',
    },
    {
      proposal_id: 'mpp_2',
      set_no: '2',
      set_name: '套二',
      textbook: {
        title: '数学分析原理',
        authors: ['菲赫金哥尔茨'],
        version: { edition: '第一卷', publisher: '高等教育出版社', year: null },
        intro: '叙述细致、例子丰富，适合自学打底。',
      },
      exercise: {
        title: '吉米多维奇数学分析习题集',
        version: null,
        intro: '题库庞大，可按章节选做。',
      },
      reason: '俄系经典，讲解详尽，配套习题集成体系。',
    },
    {
      proposal_id: 'mpp_3',
      set_no: '3',
      set_name: '套三',
      textbook: {
        title: 'Understanding Analysis',
        authors: ['Stephen Abbott'],
        version: { edition: '第 2 版', publisher: 'Springer', year: 2015 },
        intro: '以问题驱动展开实分析入门，可读性强。',
      },
      exercise: null,
      reason: '英文入门佳作，适合作为第二视角对照学习。',
    },
  ].map((p) => ({ ...p, textbook: { ...p.textbook, title: `${p.textbook.title}（${courseId}）` } }));
}

/** 模拟领域探索报告（对齐 DomainPipeline 输出：domain/courses/path 三段） */
function mockDomainReport(domainName: string): DomainExploreReport {
  const courses = [
    { slug: 'math_analysis', name: '数学分析', aliases: [], track: '分析', summary: '分析方向主线课', tier: 1, prerequisites: [] },
    { slug: 'linear_algebra', name: '高等代数', aliases: [], track: '代数', summary: '代数方向基础课', tier: 1, prerequisites: [] },
    { slug: 'probability', name: '概率论与数理统计', aliases: [], track: '概率', summary: '概率方向基础课', tier: 2, prerequisites: ['math_analysis'] },
  ];
  return {
    domain: {
      final_name: domainName,
      description: `由探索提议的领域：${domainName}`,
      level: 'bachelor',
      classic_tracks: [
        { name: '分析', description: '数学分析 → 实分析 → 复分析' },
        { name: '代数', description: '高等代数 → 抽象代数' },
        { name: '概率', description: '概率论 → 随机过程' },
      ],
      entry_requirements: [],
    },
    courses,
    path: {
      notes: '先修数学分析与高等代数，再进入概率方向。',
      edges: [{ from: 'math_analysis', to: 'probability' }],
      graph_td: 'graph TD; math_analysis-->probability;',
    },
  };
}

interface MockEntry {
  createdAt: number;
  body: { target: 'domain' | 'course'; mode: ExploreLaunchMode; domain_name?: string; course_id?: string };
  /** applied 后置 true（终态语义由前端 applied 标记持有） */
  applied: boolean;
}

const registry = new Map<string, MockEntry>();
let seq = 0;

function readyAfter(entry: MockEntry): boolean {
  return Date.now() - entry.createdAt >= MOCK_READY_AFTER_MS;
}

function toRecord(id: string, e: MockEntry): ExploreSessionRecord {
  const ready = readyAfter(e);
  const status: ExploreSessionRecord['status'] = ready ? 'ready' : 'running';
  const report = ready
    ? (e.body.target === 'domain'
      ? mockDomainReport(e.body.domain_name ?? '未命名领域')
      : ({ course: { course_id: e.body.course_id ?? '' }, tutorials: mockProposals(e.body.course_id ?? '') } as CourseExploreReport))
    : null;
  return {
    session_id: id,
    target: e.body.target,
    status,
    domain_name: e.body.domain_name ?? '',
    domain_id: '',
    course_id: e.body.course_id ?? '',
    mode: e.body.mode,
    report,
    name_check: null,
    error: null,
    steps: ready ? [{ step: e.body.target === 'domain' ? 'path' : 'tutorials', template_id: 'mock', duration_ms: 1 }] : [],
  };
}

export const exploreMockBackend = {
  /** POST /explore-sessions 同形：返回完整会话记录（status=running） */
  createSession(body: { target: 'domain' | 'course'; mode: ExploreLaunchMode; domain_name?: string; course_id?: string; ref_text?: string; ref_doc_path?: string }): ExploreSessionRecord {
    const id = `mock_es_${++seq}`;
    registry.set(id, { createdAt: Date.now(), body, applied: false });
    return { ...toRecord(id, registry.get(id)!), report: null, steps: [] };
  },

  /** GET /explore-sessions/{id} 同形 */
  fetchSession(sessionId: string): ExploreSessionRecord {
    const e = registry.get(sessionId);
    if (!e) throw new Error(`会话不存在：${sessionId}`);
    return toRecord(sessionId, e);
  },

  /** POST /explore-sessions/{id}/confirm-name 同形：mock 无名称校验，直接转 ready */
  confirmName(sessionId: string, nameOverride: string): ExploreSessionRecord {
    const e = registry.get(sessionId)!;
    if (e.body.target === 'domain') e.body.domain_name = nameOverride;
    // 直接置 ready（跳过等待窗口）
    e.createdAt = Date.now() - MOCK_READY_AFTER_MS;
    return toRecord(sessionId, e);
  },

  /** POST /explore-sessions/{id}/apply 同形 */
  applySession(sessionId: string, selected: unknown[]): ExploreApplyResult {
    const e = registry.get(sessionId)!;
    e.applied = true;
    if (e.body.target === 'domain') {
      return {
        applied: (selected as { name: string }[]).map((c, i) => ({
          entity: i === 0 ? 'domain' : 'course',
          target_id: `mock-c-${c.name}`,
          name: c.name,
        })),
        conflicts: [],
      };
    }
    return {
      applied: (selected as ExploreProposal[]).map((p, i) => ({
        knowledge_id: `mock_kn_${seq}_${i}`,
        set_name: p.set_name,
      })),
      conflicts: [],
    };
  },

  /** DELETE /explore-sessions/{id} 同形 */
  deleteSession(sessionId: string): void {
    registry.delete(sessionId);
  },

  /** 测试辅助：清空注册表 */
  _resetRegistry(): void {
    registry.clear();
    seq = 0;
  },
};
