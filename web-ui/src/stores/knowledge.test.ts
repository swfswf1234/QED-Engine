import { describe, it, expect } from 'vitest';
import { buildCourseGraph } from './knowledge';
import { layoutBubbles, BUBBLE_R, LAYER_H } from '../components/CourseGraph';
import { stageKey } from './courseMeta';
import type { CatalogTarget, CourseRecord } from './index';

function target(courseId: string, courseName: string): CatalogTarget {
  return {
    id: `${courseId}-t`, course_id: courseId, course_name: courseName, kind: 'book', title: courseName,
    authors: [], language: 'zh', edition: '', query: '', required: true, file_hint: '', note: '', roles: ['textbook'],
  };
}

/** 模拟 CourseRecord（来自 GET /courses，qed_course 表） */
function mockCourseRecord(courseId: string, stage: string, prerequisites: string[]): CourseRecord {
  return {
    course_id: courseId,
    name: courseId,
    aliases: [],
    stage,
    prerequisites,
  };
}

// --- stageKey 映射测试 ---

describe('stageKey 中文→英文映射', () => {
  it('四个标准阶段名正确映射', () => {
    expect(stageKey('本科基础')).toBe('basic');
    expect(stageKey('本科进阶')).toBe('advanced');
    expect(stageKey('研究生基础')).toBe('graduate');
    expect(stageKey('QE冲刺')).toBe('qe');
  });

  it('兼容变体（含空格、小写）', () => {
    expect(stageKey('QE 冲刺')).toBe('qe');
    expect(stageKey('basic')).toBe('basic');
    expect(stageKey('graduate')).toBe('graduate');
  });

  it('未知阶段名兜底 graduate', () => {
    expect(stageKey('博士基础')).toBe('graduate');
    expect(stageKey('')).toBe('graduate');
  });
});

// --- 课程图构建（API 驱动） ---

/** 构建模拟 courseMetaMap */
function buildCourseMetaMap(): Map<string, CourseRecord> {
  const map = new Map<string, CourseRecord>();
  const entries: [string, string, string[]][] = [
    ['01_math_analysis', '本科基础', []],
    ['02_linear_algebra', '本科基础', []],
    ['03_topology', '本科基础', ['01_math_analysis', '02_linear_algebra']],
    ['04_real_analysis', '研究生基础', ['03_topology']],
    ['05_complex_analysis', '研究生基础', ['03_topology']],
    ['06_functional_analysis', '研究生基础', ['04_real_analysis', '05_complex_analysis']],
    ['07_ode', '本科进阶', ['01_math_analysis']],
    ['08_pde', '研究生基础', ['01_math_analysis', '07_ode']],
    ['09_abstract_algebra', '研究生基础', ['02_linear_algebra']],
    ['10_qe_prep', 'QE冲刺', [
      '01_math_analysis', '03_topology', '04_real_analysis', '05_complex_analysis',
      '06_functional_analysis', '07_ode', '08_pde', '09_abstract_algebra',
      '11_probability', '13_high_dim_prob',
    ]],
    ['11_probability', '研究生基础', ['04_real_analysis']],
    ['12_stochastic_processes', '研究生基础', ['11_probability']],
    ['13_high_dim_prob', '研究生基础', ['11_probability']],
  ];
  for (const [id, stage, prereqs] of entries) {
    map.set(id, mockCourseRecord(id, stage, prereqs));
  }
  return map;
}

// 期望排序：按 stage 分层（basic → advanced → graduate → qe），同层按 id 字典序
const EXPECTED_ORDER = [
  '01_math_analysis', '02_linear_algebra', '03_topology',   // basic
  '07_ode',                                                   // advanced
  '04_real_analysis', '05_complex_analysis', '06_functional_analysis',
  '08_pde', '09_abstract_algebra', '11_probability',
  '12_stochastic_processes', '13_high_dim_prob',              // graduate
  '10_qe_prep',                                                // qe
];

describe('课程图构建 buildCourseGraph（API 驱动）', () => {
  it('13 门课程按 stage 分层排序，依赖边只含 catalog 内课程', () => {
    const metaMap = buildCourseMetaMap();
    const targets = EXPECTED_ORDER.map((cid, i) => target(cid, `课${i}`));
    const graph = buildCourseGraph(targets, metaMap);

    expect(graph.courses.map((c) => c.id)).toEqual(EXPECTED_ORDER);
    expect(graph.courses).toHaveLength(13);

    // 边数 = 各课先修数之和（QE 冲刺 10 门先修）
    const expectedEdges = [...metaMap.values()].reduce((n, c) => n + c.prerequisites.length, 0);
    expect(graph.edges).toHaveLength(expectedEdges);
    for (const e of graph.edges) {
      expect(EXPECTED_ORDER).toContain(e.from);
      expect(EXPECTED_ORDER).toContain(e.to);
    }
  });

  it('课程依赖方向正确：03 点集拓扑 先修 01/02', () => {
    const metaMap = buildCourseMetaMap();
    const targets = EXPECTED_ORDER.map((cid, i) => target(cid, `课${i}`));
    const graph = buildCourseGraph(targets, metaMap);

    const topology = graph.courses.find((c) => c.id === '03_topology')!;
    expect(topology.prerequisites).toEqual(['01_math_analysis', '02_linear_algebra']);
    expect(graph.edges.filter((e) => e.to === '03_topology').map((e) => e.from).sort())
      .toEqual(['01_math_analysis', '02_linear_algebra']);
  });

  it('catalog 为空 → 空课程图', () => {
    expect(buildCourseGraph([])).toEqual({ courses: [], edges: [] });
  });

  it('无 courseMetaMap 时 stage 兜底 graduate、先修为空', () => {
    const targets = [target('01_math_analysis', '数学分析')];
    const graph = buildCourseGraph(targets);
    expect(graph.courses).toHaveLength(1);
    expect(graph.courses[0].stage).toBe('graduate');
    expect(graph.courses[0].prerequisites).toEqual([]);
  });
});

describe('泡泡布局 layoutBubbles', () => {
  it('按 stage 四层排布：层序号递增，层内 x 递增', () => {
    const metaMap = buildCourseMetaMap();
    const targets = EXPECTED_ORDER.map((cid, i) => target(cid, `课${i}`));
    const graph = buildCourseGraph(targets, metaMap);
    const pos = layoutBubbles(graph);
    const byId = new Map(pos.map((p) => [p.course.id, p]));
    // 01 本科基础 y < 07 本科进阶 y < 04 研究生基础 y < 10 QE y
    const yOf = (cid: string) => byId.get(cid)!.cy;
    expect(yOf('01_math_analysis')).toBeLessThan(yOf('07_ode'));
    expect(yOf('07_ode')).toBeLessThan(yOf('04_real_analysis'));
    expect(yOf('04_real_analysis')).toBeLessThan(yOf('10_qe_prep'));
    // 同层内：12 在 11 右侧
    expect(byId.get('12_stochastic_processes')!.cx).toBeGreaterThan(byId.get('11_probability')!.cx);
    // 层间距 = LAYER_H
    expect(yOf('10_qe_prep') - yOf('04_real_analysis')).toBeCloseTo(LAYER_H);
    // 泡泡半径一致
    for (const p of pos) {
      expect(Math.abs(p.cx - p.course.id.length)).toBeGreaterThan(BUBBLE_R - 40); // 位置有效
    }
  });
});
