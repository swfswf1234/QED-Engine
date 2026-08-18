import { describe, it, expect } from 'vitest';
import {
  buildTreeNodes, domainOf, courseOrderCmp, DOMAIN_OTHER, DOMAIN_NAME, tutorialLabel,
  sortBooks, bookInFlow,
} from './downloads';
import type { BookRecord, CatalogTarget, KnowledgeDetail, KnowledgeRecord } from './index';

function target(courseId: string, courseName: string, id = `${courseId}-t`): CatalogTarget {
  return {
    id, course_id: courseId, course_name: courseName, kind: 'book', title: courseName,
    authors: [], language: 'zh', edition: '', query: '', required: true, file_hint: '', note: '', roles: ['textbook'],
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
    textbook_intro: '',
    exercise_intro: '',
    materials_intro: '',
    status: 'confirmed',
    reject_reason: '',
    supersede_reason: '',
    created_at: '',
    confirmed_at: null,
    completed_at: null,
    ...partial,
  };
}

function book(partial: Partial<BookRecord> & { book_id: string; knowledge_id: string }): BookRecord {
  return {
    kind: 'textbook',
    roles: ['textbook'],
    title: 't',
    part: '',
    display_title: 't',
    file_name: '',
    authors: [],
    language: '',
    version: {},
    source: null,
    original_url: '',
    sha256: null,
    relative_path: '',
    absolute_path: '',
    page_count: null,
    status: 'candidate',
    reject_reason: '',
    supersede_reason: '',
    review_note: '',
    created_at: '',
    decided_at: null,
    downloaded_at: null,
    verified_at: null,
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

describe('下载管理左树构建（Phase 4a + 五层化 + 2026-08-18 重构）', () => {
  it('领域常量与分类映射：领域=高等数学，分类=分析/代数/概率，未映射归「其他」', () => {
    expect(DOMAIN_NAME).toBe('高等数学');
    expect(domainOf('01_math_analysis')).toBe('分析');
    expect(domainOf('02_linear_algebra')).toBe('代数');
    expect(domainOf('11_probability')).toBe('概率');
    expect(domainOf('99_unknown')).toBe(DOMAIN_OTHER);
  });

  it('课程排序：COURSE_ORDER 优先，未知课程靠后', () => {
    expect(courseOrderCmp('01_math_analysis', '02_linear_algebra')).toBeLessThan(0);
    // 10_qe_prep 在 COURSE_ORDER 末尾（QE 冲刺排最后）
    expect(courseOrderCmp('10_qe_prep', '11_probability')).toBeGreaterThan(0);
    expect(courseOrderCmp('99_unknown', '01_math_analysis')).toBeGreaterThan(0);
  });

  it('领域 → 分类 → 课程 → 教程四层结构：分类仅展示、教程为叶子', () => {
    const targets = [target('01_math_analysis', '数学分析'), target('02_linear_algebra', '线性代数')];
    const k1 = kn({ knowledge_id: 'k1', course_id: '01_math_analysis', set_no: '1', name: '教程1：数学分析原理（Rudin）' });
    const k2 = kn({ knowledge_id: 'k2', course_id: '01_math_analysis', set_no: '2', name: '教程2：微积分学教程（菲赫金哥尔茨）' });
    const k3 = kn({ knowledge_id: 'k3', course_id: '02_linear_algebra', kind: 'other_material', name: '线性代数延展资料' });
    const tree = buildTreeNodes(targets, [k1, k2, k3]);
    // 单一领域：高等数学
    expect(tree.map((d) => d.name)).toEqual([DOMAIN_NAME]);
    const domain = tree[0];
    // 分类按顺序：分析 / 代数
    expect(domain.categories.map((c) => c.name)).toEqual(['分析', '代数']);
    const analysis = domain.categories[0];
    expect(analysis.courses).toHaveLength(1);
    expect(analysis.courses[0].name).toBe('数学分析');
    const tutorials = analysis.courses[0].tutorials;
    // 套号数值升序：套1 → 套2；教程名 = 知识行 name
    expect(tutorials.map((t) => t.label)).toEqual(['教程1：数学分析原理（Rudin）', '教程2：微积分学教程（菲赫金哥尔茨）']);
    expect(tutorials[0].items).toEqual([]);
    expect(tutorials[0].isSet).toBe(true);
    // other_material 为叶子（isSet=false），归入代数分类
    const algebra = domain.categories[1];
    expect(algebra.courses[0].tutorials[0]).toMatchObject({ label: '线性代数延展资料', isSet: false });
  });

  it('教程叶子进度：verified 书行数/总数（来自详情缓存）', () => {
    const targets = [target('01_math_analysis', '数学分析')];
    const k1 = kn({ knowledge_id: 'k1', course_id: '01_math_analysis', set_no: '1', name: '教程1' });
    const b1 = book({ book_id: 'b1', knowledge_id: 'k1', status: 'verified', display_title: 'Rudin 中译' });
    const b2 = book({ book_id: 'b2', knowledge_id: 'k1', status: 'downloaded', display_title: '吉米多维奇' });
    const b3 = book({ book_id: 'b3', knowledge_id: 'k1', status: 'candidate', display_title: '题解' });
    const tree = buildTreeNodes(targets, [k1], { k1: detail(k1, [b1, b2, b3]) });
    const t = tree[0].categories[0].courses[0].tutorials[0];
    expect(t.items.map((b) => b.book_id)).toEqual(['b1', 'b2', 'b3']);
    expect(t.verified).toBe(1);
    expect(t.total).toBe(3);
  });

  it('教程叶子进度：无详情缓存时 0/0', () => {
    const targets = [target('01_math_analysis', '数学分析')];
    const k1 = kn({ knowledge_id: 'k1', course_id: '01_math_analysis', set_no: '1', name: '教程1' });
    const tree = buildTreeNodes(targets, [k1], {});
    const t = tree[0].categories[0].courses[0].tutorials[0];
    expect(t.verified).toBe(0);
    expect(t.total).toBe(0);
  });

  it('知识行独有课程（catalog 未列出）兜底加入「其他」分类', () => {
    const k1 = kn({ knowledge_id: 'k1', course_id: '99_unknown', name: '未知课程教程' });
    const tree = buildTreeNodes([], [k1]);
    expect(tree.map((d) => d.name)).toEqual([DOMAIN_NAME]);
    expect(tree[0].categories.map((c) => c.name)).toEqual([DOMAIN_OTHER]);
    expect(tree[0].categories[0].courses[0]).toMatchObject({ id: '99_unknown', name: '99_unknown' });
  });

  it('无数据 → 空树', () => {
    expect(buildTreeNodes([], [])).toEqual([]);
  });
});

describe('书行排序 sortBooks（中文教材 → 中文习题集 → 其余，组内册数递增）', () => {
  const knowledgeId = 'k1';

  it('中文教材优先、中文习题集次之、英文教材及其他最末', () => {
    const enTextbook = book({ book_id: 'b1', knowledge_id: knowledgeId, language: 'en', kind: 'textbook', title: 'PMA' });
    const zhExercise = book({ book_id: 'b2', knowledge_id: knowledgeId, language: 'zh', kind: 'exercise', title: '吉米多维奇' });
    const zhTextbook = book({ book_id: 'b3', knowledge_id: knowledgeId, language: 'zh', kind: 'textbook', title: '数学分析原理' });
    const supplement = book({ book_id: 'b4', knowledge_id: knowledgeId, language: 'zh', kind: 'supplement', title: '配套资料' });
    const sorted = sortBooks([enTextbook, zhExercise, zhTextbook, supplement]);
    // 组③（英文教材/配套资料）内部按 title 稳定序（zh-Hans-CN 词典序）
    expect(sorted.map((b) => b.book_id)).toEqual(['b3', 'b2', 'b4', 'b1']);
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

describe('流程筛选 bookInFlow（搜索/确认/下载/验收）', () => {
  const knowledgeId = 'k1';

  it('搜索=候选；确认=已决定', () => {
    const candidate = book({ book_id: 'b1', knowledge_id: knowledgeId, status: 'candidate' });
    const decided = book({ book_id: 'b2', knowledge_id: knowledgeId, status: 'decided' });
    expect(bookInFlow(candidate, 'search')).toBe(true);
    expect(bookInFlow(candidate, 'confirm')).toBe(false);
    expect(bookInFlow(decided, 'confirm')).toBe(true);
    expect(bookInFlow(decided, 'search')).toBe(false);
  });

  it('下载=下载中+已下载+失败；验收=已验证', () => {
    for (const status of ['downloading', 'downloaded', 'failed']) {
      expect(bookInFlow(book({ book_id: 'b', knowledge_id: knowledgeId, status }), 'download')).toBe(true);
      expect(bookInFlow(book({ book_id: 'b', knowledge_id: knowledgeId, status }), 'verify')).toBe(false);
    }
    expect(bookInFlow(book({ book_id: 'b1', knowledge_id: knowledgeId, status: 'verified' }), 'verify')).toBe(true);
    expect(bookInFlow(book({ book_id: 'b1', knowledge_id: knowledgeId, status: 'verified' }), 'download')).toBe(false);
  });

  it('空流程（全部）不过滤', () => {
    const b = book({ book_id: 'b1', knowledge_id: knowledgeId, status: 'candidate' });
    expect(bookInFlow(b, '')).toBe(true);
  });
});
