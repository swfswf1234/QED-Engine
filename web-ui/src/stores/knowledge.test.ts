import { describe, it, expect } from 'vitest';
import { buildCourseGraph } from './knowledge';
import { layoutBubbles, BUBBLE_R, LAYER_H } from '../components/CourseGraph';
import { COURSE_PREREQUISITES, COURSE_STAGE, COURSE_ORDER, STAGE_ORDER } from './courseMeta';
import type { CatalogTarget } from './index';

function target(courseId: string, courseName: string): CatalogTarget {
  return {
    id: `${courseId}-t`, course_id: courseId, course_name: courseName, kind: 'book', title: courseName,
    authors: [], language: 'zh', edition: '', query: '', required: true, file_hint: '', note: '', roles: ['textbook'],
  };
}

/** 13 门课（对齐 catalog math-qe） */
const TARGETS: CatalogTarget[] = COURSE_ORDER.map((cid, i) => target(cid, `课${i}`));

describe('课程依赖常量完整性（对齐 courses/math.json）', () => {
  it('COURSE_STAGE 覆盖 catalog 13 门课且 stage 合法', () => {
    for (const cid of COURSE_ORDER) {
      expect(COURSE_STAGE[cid], cid).toBeDefined();
      expect(STAGE_ORDER).toContain(COURSE_STAGE[cid]);
    }
  });

  it('COURSE_PREREQUISITES 覆盖全部课程且依赖在 catalog 内闭合', () => {
    for (const cid of COURSE_ORDER) {
      expect(COURSE_PREREQUISITES[cid], cid).toBeDefined();
      for (const pre of COURSE_PREREQUISITES[cid]) {
        expect(COURSE_ORDER, `${cid} 先修 ${pre}`).toContain(pre);
      }
    }
  });
});

describe('课程图构建 buildCourseGraph', () => {
  it('13 门课程按 COURSE_ORDER 排序，依赖边只含 catalog 内课程', () => {
    const graph = buildCourseGraph(TARGETS);
    expect(graph.courses.map((c) => c.id)).toEqual(COURSE_ORDER);
    expect(graph.courses).toHaveLength(13);
    // 边数 = 各课先修数之和（QE 冲刺 10 门先修）
    const expected = Object.values(COURSE_PREREQUISITES).reduce((n, pre) => n + pre.length, 0);
    expect(graph.edges).toHaveLength(expected);
    for (const e of graph.edges) {
      expect(COURSE_ORDER).toContain(e.from);
      expect(COURSE_ORDER).toContain(e.to);
    }
  });

  it('课程依赖方向正确：03 点集拓扑 先修 01/02', () => {
    const graph = buildCourseGraph(TARGETS);
    const topology = graph.courses.find((c) => c.id === '03_topology')!;
    expect(topology.prerequisites).toEqual(['01_math_analysis', '02_linear_algebra']);
    expect(graph.edges.filter((e) => e.to === '03_topology').map((e) => e.from).sort())
      .toEqual(['01_math_analysis', '02_linear_algebra']);
  });

  it('catalog 为空 → 空课程图', () => {
    expect(buildCourseGraph([])).toEqual({ courses: [], edges: [] });
  });
});

describe('泡泡布局 layoutBubbles', () => {
  it('按 stage 四层排布：层序号递增，层内 x 递增', () => {
    const graph = buildCourseGraph(TARGETS);
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