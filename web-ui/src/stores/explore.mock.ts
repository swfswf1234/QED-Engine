/**
 * 探索本地模拟后端（QED-Tracker 未就绪留白，exploration-ui 工作项 6）
 * - 与真实端点同形：launch/fetch/adopt/discard/list/curriculum 全套
 * - 启动后 READY_AFTER_MS 自动转 ready 并给出固定推荐 fixtures；
 *   零网络依赖，供界面先行自测与演示（localStorage qed-explore-mock=1 开启）
 */
import type {
  CurriculumChange, CurriculumRun, ExploreAdoptResult, ExploreLaunchMode,
  ExploreLaunchResult, ExploreProposal, ExploreRun, ExploreRunSummary,
} from './index';
import { EXPLORE_MAX_TUTORIALS } from './exploreRules';

/** 启动后到 ready 的模拟耗时（< 一个轮询周期，保证一次轮询即见结果） */
export const MOCK_READY_AFTER_MS = 2000;

/** 模拟推荐套（对齐 Proposal 契约结构） */
function mockProposals(courseId: string): ExploreProposal[] {
  return [
    {
      proposal_id: 'mpp_1',
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

/** 模拟领域探索变更（对齐「高等数学探索.txt」：分析/代数/概率三方向） */
function mockChanges(domainName: string): CurriculumChange[] {
  return [
    {
      change_id: 'mch_0',
      action: 'create_domain',
      entity: 'domain',
      target_id: 'mock_domain',
      payload: { name: domainName, description: `由探索提议的新领域：${domainName}` },
      reason: '领域/范围/备注 参考文档指向新建领域',
    },
    {
      change_id: 'mch_1',
      action: 'create_course',
      entity: 'course',
      target_id: '01_math_analysis',
      payload: { name: '数学分析', stage: '大一~大二', sort_order: 1, note: '分析方向主线课' },
      reason: '范围文档：从基础的数学分析开始，按学习顺序梳理',
    },
    {
      change_id: 'mch_2',
      action: 'create_course',
      entity: 'course',
      target_id: '02_linear_algebra',
      payload: { name: '高等代数', stage: '大一~大二', sort_order: 2, note: '代数方向主线课' },
      reason: '范围文档：代数方向基础课',
    },
    {
      change_id: 'mch_3',
      action: 'create_course',
      entity: 'course',
      target_id: '00_probability',
      payload: { name: '概率论与数理统计', stage: '大二~大三', sort_order: 3, note: '概率方向主线课' },
      reason: '范围文档：概率方向基础课，附课程介绍',
    },
  ];
}

interface MockEntry {
  kind: 'course' | 'curriculum';
  createdAt: number;
  courseId?: string;
  domainName?: string;
  mode: ExploreLaunchMode;
  refText?: string;
  refDocPath?: string;
  status: string;
  adoptedIds: string[];
}

const registry = new Map<string, MockEntry>();
let seq = 0;

function baseFields(e: MockEntry, runId: string) {
  return {
    run_id: runId,
    params: { mode: e.mode, ...(e.refText ? { ref_text: e.refText } : {}), ...(e.refDocPath ? { ref_doc_path: e.refDocPath } : {}) },
    error: null,
    created_at: new Date(e.createdAt).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function readyAfter(entry: MockEntry): boolean {
  return Date.now() - entry.createdAt >= MOCK_READY_AFTER_MS;
}

export const exploreMockBackend = {
  launchCourse(courseId: string, body: { mode: ExploreLaunchMode; ref_text?: string; ref_doc_path?: string }): ExploreLaunchResult {
    const runId = `mock_exp_${++seq}`;
    registry.set(runId, {
      kind: 'course', createdAt: Date.now(), courseId,
      mode: body.mode, refText: body.ref_text, refDocPath: body.ref_doc_path,
      status: 'running', adoptedIds: [],
    });
    return { run_id: runId, task_id: `mock_tk_${seq}`, status: 'running' };
  },

  fetchRun(runId: string): ExploreRun {
    const e = registry.get(runId)!;
    if (e.status !== 'running') {
      // 终态：原样返回（adopted 保留已采纳集合）
      return {
        ...baseFields(e, runId), scope: 'course', course_id: e.courseId!, status: e.status as ExploreRun['status'],
        proposals: e.status === 'discarded' ? [] : mockProposals(e.courseId!),
        adopted_proposal_ids: e.adoptedIds,
      };
    }
    if (!readyAfter(e)) {
      return { ...baseFields(e, runId), scope: 'course', course_id: e.courseId!, status: 'running', proposals: [], adopted_proposal_ids: [] };
    }
    return { ...baseFields(e, runId), scope: 'course', course_id: e.courseId!, status: 'ready', proposals: mockProposals(e.courseId!), adopted_proposal_ids: [] };
  },

  adopt(runId: string, selected: string[]): ExploreAdoptResult {
    const e = registry.get(runId)!;
    e.status = 'adopted';
    e.adoptedIds = [...selected];
    return {
      adopted: selected.map((_pid, i) => ({ knowledge_id: `mock_kn_${seq}_${i}`, set_name: `套${i + 1}` })),
      remaining_slots: Math.max(0, EXPLORE_MAX_TUTORIALS - selected.length),
      run: exploreMockBackend.fetchRun(runId),
    };
  },

  discard(runId: string): ExploreRun {
    const e = registry.get(runId)!;
    e.status = 'discarded';
    return exploreMockBackend.fetchRun(runId);
  },

  listRuns(courseId: string): ExploreRunSummary[] {
    const out: ExploreRunSummary[] = [];
    for (const [runId, e] of registry.entries()) {
      if (e.kind === 'course' && e.courseId === courseId) {
        const proposals = e.status === 'ready' || e.status === 'adopted' ? mockProposals(courseId) : [];
        out.push({
          run_id: runId, scope: 'course', course_id: courseId,
          status: e.status as ExploreRunSummary['status'],
          created_at: new Date(e.createdAt).toISOString(), updated_at: new Date().toISOString(),
          proposal_count: proposals.length, adopted_count: e.adoptedIds.length,
        });
      }
    }
    return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  launchCurriculum(domainName: string, body: { mode: ExploreLaunchMode; ref_text?: string; ref_doc_path?: string }): ExploreLaunchResult {
    const runId = `mock_cur_${++seq}`;
    registry.set(runId, {
      kind: 'curriculum', createdAt: Date.now(), domainName,
      mode: body.mode, refText: body.ref_text, refDocPath: body.ref_doc_path,
      status: 'running', adoptedIds: [],
    });
    return { run_id: runId, task_id: `mock_tk_${seq}`, status: 'running' };
  },

  fetchCurriculum(runId: string): CurriculumRun {
    const e = registry.get(runId)!;
    const common = { ...baseFields(e, runId), scope: 'curriculum' as const, adopted_proposal_ids: e.adoptedIds, conflicts: [], error: null };
    if (e.status !== 'running') {
      return {
        ...common, status: e.status as CurriculumRun['status'],
        params: { ...common.params, domain_name: e.domainName! },
        proposals: mockChanges(e.domainName!),
      } as CurriculumRun;
    }
    if (!readyAfter(e)) {
      return {
        ...common, status: 'running',
        params: { ...common.params, domain_name: e.domainName! }, proposals: [],
      } as CurriculumRun;
    }
    return {
      ...common, status: 'ready',
      params: { ...common.params, domain_name: e.domainName! }, proposals: mockChanges(e.domainName!),
    } as CurriculumRun;
  },

  applyCurriculum(runId: string, selected: string[]): { applied: { change_id: string; entity: string; target_id: string }[]; conflicts: { change_id: string; reason: string }[]; run: CurriculumRun } {
    const e = registry.get(runId)!;
    e.status = 'applied';
    e.adoptedIds = [...selected];
    const changes = mockChanges(e.domainName!).filter((c) => selected.includes(c.change_id));
    return {
      applied: changes.map((c) => ({ change_id: c.change_id, entity: c.entity, target_id: c.target_id })),
      conflicts: [],
      run: exploreMockBackend.fetchCurriculum(runId),
    };
  },

  /** 测试辅助：清空注册表 */
  _resetRegistry(): void {
    registry.clear();
    seq = 0;
  },
};
