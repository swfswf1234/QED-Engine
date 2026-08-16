import { describe, it, expect } from 'vitest';
import {
  buildTreeNodes, domainOf, courseOrderCmp, DOMAIN_OTHER,
} from './downloads';
import type { CatalogTarget, SelectionRecord } from './index';

function target(courseId: string, courseName: string, id = `${courseId}-t`): CatalogTarget {
  return {
    id, course_id: courseId, course_name: courseName, kind: 'book', title: courseName,
    authors: [], language: 'zh', edition: '', query: '', required: true, file_hint: '', note: '', roles: ['textbook'],
  };
}

function selection(partial: Partial<SelectionRecord> & { selection_id: string; course_id: string }): SelectionRecord {
  return {
    title: '书目',
    authors: [],
    roles: ['textbook'],
    version: {},
    vols: [],
    set_no: '',
    evaluation: null,
    note: '',
    review_note: '',
    status: 'candidate',
    reject_reason: '',
    supersede_reason: '',
    created_at: '',
    confirmed_at: null,
    download_stats: { total: 0, downloaded: 0, approved: 0 },
    downloads: [],
    ...partial,
  };
}

describe('下载管理左树构建（Phase 4a）', () => {
  it('领域映射：课程按 DOMAIN_MAP 归三领域，未映射归「其他」', () => {
    expect(domainOf('01_math_analysis')).toBe('分析');
    expect(domainOf('02_linear_algebra')).toBe('代数');
    expect(domainOf('11_probability')).toBe('概率论与数理统计');
    expect(domainOf('99_unknown')).toBe(DOMAIN_OTHER);
  });

  it('课程排序：COURSE_ORDER 优先，未知课程靠后', () => {
    expect(courseOrderCmp('01_math_analysis', '02_linear_algebra')).toBeLessThan(0);
    // 10_qe_prep 在 COURSE_ORDER 末尾（QE 冲刺排最后）
    expect(courseOrderCmp('10_qe_prep', '11_probability')).toBeGreaterThan(0);
    expect(courseOrderCmp('99_unknown', '01_math_analysis')).toBeGreaterThan(0);
  });

  it('领域 → 课程 → 教程三层结构：confirmed+set_no 合并为套N，其余单条目', () => {
    const targets = [target('01_math_analysis', '数学分析'), target('02_linear_algebra', '线性代数')];
    const sels = [
      selection({ selection_id: 's1', course_id: '01_math_analysis', set_no: '1', status: 'confirmed', title: 'Rudin 中译' }),
      selection({ selection_id: 's2', course_id: '01_math_analysis', set_no: '1', status: 'confirmed', title: '吉米多维奇' }),
      selection({ selection_id: 's3', course_id: '01_math_analysis', set_no: '', status: 'confirmed', title: '菲赫金哥尔茨' }),
      selection({ selection_id: 's4', course_id: '01_math_analysis', set_no: '', status: 'candidate', title: '候选书目' }),
    ];
    const tree = buildTreeNodes(targets, sels);
    // 两领域（分析 / 代数），按 DOMAIN_ORDER
    expect(tree.map((d) => d.name)).toEqual(['分析', '代数']);
    const analysis = tree[0];
    expect(analysis.courses).toHaveLength(1);
    expect(analysis.courses[0].name).toBe('数学分析');
    const tutorials = analysis.courses[0].tutorials;
    // 套1 合并 s1+s2（label 套1，isSet）；s3 单条目（label=书名）；s4 候选单条目
    expect(tutorials.map((t) => t.label)).toEqual(['套1', '菲赫金哥尔茨', '候选书目']);
    expect(tutorials[0].items.map((s) => s.selection_id)).toEqual(['s1', 's2']);
    expect(tutorials[0].isSet).toBe(true);
    expect(tutorials[1].isSet).toBe(false);
  });

  it('表1 独有课程（catalog 未列出）兜底加入树，name=course_id', () => {
    const sels = [selection({ selection_id: 's1', course_id: '99_unknown', title: '未知课程书目' })];
    const tree = buildTreeNodes([], sels);
    expect(tree.map((d) => d.name)).toEqual([DOMAIN_OTHER]);
    expect(tree[0].courses[0]).toMatchObject({ id: '99_unknown', name: '99_unknown' });
  });

  it('无数据 → 空树', () => {
    expect(buildTreeNodes([], [])).toEqual([]);
  });
});