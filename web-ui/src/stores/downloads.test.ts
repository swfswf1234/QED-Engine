import { describe, it, expect } from 'vitest';
import {
  buildTreeNodes, tutorialLabel,
  sortBooks, bookInStage, STAGE_OPTIONS,
} from './downloads';
import type { BookRecord, CourseRecord, DomainSystem, KnowledgeDetail, KnowledgeRecord } from './index';

function course(partial: Partial<CourseRecord> & { course_id: string; name: string }): CourseRecord {
  return {
    aliases: [], stage: '', prerequisites: [], related_targets: [],
    ...partial,
  };
}

function domain(partial: Partial<DomainSystem> & { domain_id: string; name: string }): DomainSystem {
  return {
    description: '', stages: [], courses: [],
    ...partial,
  };
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
    status: 'confirmed',
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
    language: '',
    roles: ['textbook'],
    status: 'candidate',
    retire_reason: '',
    holding: 'missing',
    file_path: null,
    priority: null,
    notes: null,
    domain_id: '',
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

function detail(k: KnowledgeRecord, books: BookRecord[]): KnowledgeDetail {
  return { ...k, books };
}

describe('教程节点标签 tutorialLabel（五层）', () => {
  it('name 优先，其次套标记，最后 knowledge_id 兜底', () => {
    expect(tutorialLabel(kn({ knowledge_id: 'k1', course_id: 'c', name: '教程1：数学分析原理（Rudin）' }))).toBe('教程1：数学分析原理（Rudin）');
    expect(tutorialLabel(kn({ knowledge_id: 'k1', course_id: 'c', set_no: '2' }))).toBe('教程2');
    expect(tutorialLabel(kn({ knowledge_id: 'k1', course_id: 'c' }))).toBe('k1');
  });
});

describe('文档下载管理左树构建 v2（真实领域课程体系，2026-08-24 REQ-059 交互改版）', () => {
  it('领域 → 课程 → 教程三层结构：数据源为 GET /courses 领域体系，保持服务端排序', () => {
    const systems = [
      domain({
        domain_id: 'dm_math', name: '高等数学',
        courses: [course({ course_id: '01_math_analysis', name: '数学分析' }), course({ course_id: '02_linear_algebra', name: '线性代数' })],
      }),
      domain({ domain_id: 'dm_cs', name: '计算机科学', courses: [course({ course_id: '10_ml', name: '机器学习' })] }),
    ];
    const k1 = kn({ knowledge_id: 'k1', domain_id: 'dm_math', course_id: '01_math_analysis', set_no: '1', name: '教程1：数学分析原理（Rudin）' });
    const k2 = kn({ knowledge_id: 'k2', domain_id: 'dm_math', course_id: '01_math_analysis', set_no: '2', name: '教程2：微积分学教程（菲赫金哥尔茨）' });
    const k3 = kn({ knowledge_id: 'k3', domain_id: 'dm_math', course_id: '02_linear_algebra', kind: 'other_material', name: '线性代数延展资料' });
    const tree = buildTreeNodes(systems, [k1, k2, k3]);
    // 多领域并列，顺序 = 服务端返回序
    expect(tree.map((d) => d.name)).toEqual(['高等数学', '计算机科学']);
    expect(tree[0].domainId).toBe('dm_math');
    expect(tree[0].key).toBe('d:dm_math');
    // 课程按体系内顺序
    expect(tree[0].courses.map((c) => c.name)).toEqual(['数学分析', '线性代数']);
    const analysis = tree[0].courses[0];
    expect(analysis.id).toBe('01_math_analysis');
    expect(analysis.domainId).toBe('dm_math');
    // 套号数值升序：套1 → 套2；教程名 = 教程 name
    expect(analysis.tutorials.map((t) => t.label)).toEqual(['教程1：数学分析原理（Rudin）', '教程2：微积分学教程（菲赫金哥尔茨）']);
    expect(analysis.tutorials[0].items).toEqual([]);
    expect(analysis.tutorials[0].isSet).toBe(true);
    // other_material 为叶子（isSet=false）
    expect(tree[0].courses[1].tutorials[0]).toMatchObject({ label: '线性代数延展资料', isSet: false });
  });

  it('教程叶子进度：verified 书籍数/总数（来自详情缓存）', () => {
    const systems = [domain({ domain_id: 'd1', name: '高等数学', courses: [course({ course_id: 'c1', name: '数学分析' })] })];
    const k1 = kn({ knowledge_id: 'k1', domain_id: 'd1', course_id: 'c1', set_no: '1', name: '教程1' });
    const b1 = book({ book_id: 'b1', knowledge_id: 'k1', status: 'verified', display_title: 'Rudin 中译' });
    const b2 = book({ book_id: 'b2', knowledge_id: 'k1', status: 'downloaded', display_title: '吉米多维奇' });
    const b3 = book({ book_id: 'b3', knowledge_id: 'k1', status: 'candidate', display_title: '题解' });
    const tree = buildTreeNodes(systems, [k1], { k1: detail(k1, [b1, b2, b3]) });
    const t = tree[0].courses[0].tutorials[0];
    expect(t.items.map((b) => b.book_id)).toEqual(['b1', 'b2', 'b3']);
    expect(t.verified).toBe(1);
    expect(t.total).toBe(3);
  });

  it('教程叶子进度：无详情缓存时 0/0', () => {
    const systems = [domain({ domain_id: 'd1', name: '高等数学', courses: [course({ course_id: 'c1', name: '数学分析' })] })];
    const k1 = kn({ knowledge_id: 'k1', domain_id: 'd1', course_id: 'c1', set_no: '1', name: '教程1' });
    const tree = buildTreeNodes(systems, [k1], {});
    const t = tree[0].courses[0].tutorials[0];
    expect(t.verified).toBe(0);
    expect(t.total).toBe(0);
  });

  it('教程所属课程不在课程体系中 → 不进树（不再虚构兜底节点）', () => {
    const k1 = kn({ knowledge_id: 'k1', domain_id: 'ghost', course_id: '99_unknown', name: '孤儿教程' });
    const tree = buildTreeNodes([], [k1]);
    expect(tree).toEqual([]);
  });

  it('空课程体系 → 空树（即使有教程）', () => {
    const k1 = kn({ knowledge_id: 'k1', course_id: 'c1', name: 'x' });
    expect(buildTreeNodes([], [k1])).toEqual([]);
    expect(buildTreeNodes([], [])).toEqual([]);
  });
});

describe('书籍排序 sortBooks（中文教材 → 中文习题集 → 其余，组内册数递增）', () => {
  const knowledgeId = 'k1';

  it('中文教材优先、中文习题集次之、英文教材及其他最末', () => {
    const enTextbook = book({ book_id: 'b1', knowledge_id: knowledgeId, language: 'en', kind: 'textbook', title: 'PMA' });
    const zhExercise = book({ book_id: 'b2', knowledge_id: knowledgeId, language: 'zh', kind: 'exercise', title: '吉米多维奇' });
    const zhTextbook = book({ book_id: 'b3', knowledge_id: knowledgeId, language: 'zh', kind: 'textbook', title: '数学分析原理' });
    const supplement = book({ book_id: 'b4', knowledge_id: knowledgeId, language: 'zh', kind: 'supplement', title: '配套资料' });
    const sorted = sortBooks([enTextbook, zhExercise, zhTextbook, supplement]);
    // 组序：①中文教材(b3) → ②中文习题集(b2) → ③英文教材(b1) → ④其余(b4)
    expect(sorted.map((b) => b.book_id)).toEqual(['b3', 'b2', 'b1', 'b4']);
  });

  it('组内按册数递增：第一册<第二册<第三册；单册（空 part）排组首', () => {
    const v2 = book({ book_id: 'b1', knowledge_id: knowledgeId, language: 'zh', kind: 'textbook', part: '第二册', title: '微积分学教程' });
    const v1 = book({ book_id: 'b2', knowledge_id: knowledgeId, language: 'zh', kind: 'textbook', part: '第一册', title: '微积分学教程' });
    const single = book({ book_id: 'b3', knowledge_id: knowledgeId, language: 'zh', kind: 'textbook', part: '', title: '数学分析原理' });
    const sorted = sortBooks([v2, v1, single]);
    expect(sorted.map((b) => b.book_id)).toEqual(['b3', 'b2', 'b1']);
  });

  it('上/中/下册 = 1/2/3；答案册排组尾', () => {
    const lower = book({ book_id: 'b1', knowledge_id: knowledgeId, language: 'zh', kind: 'exercise', part: '下册', title: '习题课讲义' });
    const upper = book({ book_id: 'b2', knowledge_id: knowledgeId, language: 'zh', kind: 'exercise', part: '上册', title: '习题课讲义' });
    const answers = book({ book_id: 'b3', knowledge_id: knowledgeId, language: 'zh', kind: 'exercise', part: '答案册', title: '习题答案' });
    const sorted = sortBooks([lower, upper, answers]);
    expect(sorted.map((b) => b.book_id)).toEqual(['b2', 'b1', 'b3']);
  });

  it('同册数按 title 稳定序', () => {
    const a = book({ book_id: 'b1', knowledge_id: knowledgeId, language: 'zh', kind: 'exercise', title: '吉米多维奇' });
    const b = book({ book_id: 'b2', knowledge_id: knowledgeId, language: 'zh', kind: 'exercise', title: '题解' });
    const sorted = sortBooks([b, a]);
    expect(sorted.map((x) => x.book_id)).toEqual(['b1', 'b2']);
  });
});

describe('状态筛选 bookInStage（书籍生命周期四阶段，2026-08-24 用户裁决）', () => {
  const knowledgeId = 'k1';
  const mk = (status: string) => book({ book_id: 'b', knowledge_id: knowledgeId, status });

  it('待确认=candidate；decided/downloading/failed 归下载；downloaded=待验证；verified=已完成', () => {
    expect(bookInStage(mk('candidate'), 'confirm')).toBe(true);
    expect(bookInStage(mk('candidate'), 'download')).toBe(false);
    for (const status of ['decided', 'downloading', 'failed']) {
      expect(bookInStage(mk(status), 'download')).toBe(true);
      expect(bookInStage(mk(status), 'confirm')).toBe(false);
      expect(bookInStage(mk(status), 'await_verify')).toBe(false);
      expect(bookInStage(mk(status), 'completed')).toBe(false);
    }
    expect(bookInStage(mk('downloaded'), 'await_verify')).toBe(true);
    expect(bookInStage(mk('downloaded'), 'download')).toBe(false);
    expect(bookInStage(mk('verified'), 'completed')).toBe(true);
    expect(bookInStage(mk('verified'), 'await_verify')).toBe(false);
  });

  it('空阶段（全部）不过滤；STAGE_OPTIONS 四选项值与标签', () => {
    const b = book({ book_id: 'b1', knowledge_id: knowledgeId, status: 'candidate' });
    expect(bookInStage(b, '')).toBe(true);
    expect(STAGE_OPTIONS.map((o) => o.label)).toEqual(['待确认', '下载', '待验证', '已完成']);
    expect(STAGE_OPTIONS.map((o) => o.value)).toEqual(['confirm', 'download', 'await_verify', 'completed']);
  });
});
