import { describe, it, expect } from 'vitest';
import {
  courseBoxSize,
  linkPoint,
  nebulaId,
  starMapLayout,
  tierOf,
  STARMAP_VIEW,
  ROW_H,
} from './starMapLayout';
import type { StarCourseNode, StarMapDomain, StarMapEdge, TrackCluster } from '../api/learn';

function course(id: string, name: string, track: string, stage = ''): StarCourseNode {
  return { course_id: id, name, track, stage, sort_order: null, kp_confirmed: 0, kp_candidates: 0 };
}

function cluster(track: string, courses: StarCourseNode[], kind = 'main', summary = ''): TrackCluster {
  return { track, kind, summary, courses };
}

function domain(tracks: TrackCluster[]): StarMapDomain {
  return { domain_id: 'math', name: '数学', level: '本科', tracks };
}

const ANALYSIS = '分析学';
const ALGEBRA = '代数学';
const TOPOLOGY = '几何与拓扑';
const PROBABILITY = '概率与统计';

/** 与真实 demo 数据同构：三门「基础」跨三条轨迹 */
function forestDomain(): StarMapDomain {
  return domain([
    cluster(ANALYSIS, [
      course('math_analysis', '数学分析', ANALYSIS, '基础'),
      course('real_analysis', '实变函数', ANALYSIS, '主干'),
      course('complex_analysis', '复变函数', ANALYSIS, '主干'),
      course('ode', '常微分方程', ANALYSIS, '主干'),
      course('functional_analysis', '泛函分析', ANALYSIS, '分支'),
      course('pde', '偏微分方程', ANALYSIS, '分支'),
    ]),
    cluster(ALGEBRA, [
      course('linear_algebra', '高等代数', ALGEBRA, '基础'),
      course('abstract_algebra', '抽象代数', ALGEBRA, '主干'),
    ]),
    cluster(PROBABILITY, [
      course('probability', '概率论与数理统计', PROBABILITY, '基础'),
      course('stochastic_processes', '随机过程', PROBABILITY, '分支'),
    ]),
    cluster(TOPOLOGY, [
      course('point_set_topology', '点集拓扑', TOPOLOGY, '主干'),
      course('differential_geometry', '微分几何', TOPOLOGY, '分支'),
    ], 'branch'),
  ]);
}

const EDGES: StarMapEdge[] = [
  { from: 'math_analysis', to: 'real_analysis', domain_id: 'math', cross_track: false },
  { from: 'math_analysis', to: 'complex_analysis', domain_id: 'math', cross_track: false },
  { from: 'math_analysis', to: 'ode', domain_id: 'math', cross_track: false },
  { from: 'math_analysis', to: 'pde', domain_id: 'math', cross_track: false },
  { from: 'math_analysis', to: 'point_set_topology', domain_id: 'math', cross_track: true },
  { from: 'real_analysis', to: 'functional_analysis', domain_id: 'math', cross_track: false },
  { from: 'linear_algebra', to: 'abstract_algebra', domain_id: 'math', cross_track: false },
  { from: 'linear_algebra', to: 'functional_analysis', domain_id: 'math', cross_track: true },
  { from: 'linear_algebra', to: 'differential_geometry', domain_id: 'math', cross_track: true },
  { from: 'ode', to: 'pde', domain_id: 'math', cross_track: false },
  { from: 'probability', to: 'stochastic_processes', domain_id: 'math', cross_track: false },
];

function byId(layout: ReturnType<typeof starMapLayout>) {
  return new Map(layout.nodes.map((n) => [n.id, n]));
}

function overlapsX(a: { x: number; w: number }, b: { x: number; w: number }): boolean {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w;
}

describe('星图布局纯函数 starMapLayout（层＝行 × 轨迹＝列 森林）', () => {
  it('空域 / 无轨 → 空布局（不抛错）', () => {
    const empty = starMapLayout(null, []);
    expect(empty.nodes).toEqual([]);
    expect(empty.nebulae).toEqual([]);
    expect(empty.links).toEqual([]);
    expect(starMapLayout(domain([{ track: 'x', kind: 'main', summary: '', courses: [] }]), []).nebulae).toEqual([]);
  });

  it('确定性：同一输入两次调用坐标完全一致', () => {
    const d = forestDomain();
    expect(starMapLayout(d, EDGES)).toEqual(starMapLayout(d, EDGES));
  });

  it('tier＝max(stage 档序, 先修深度)：未知 stage 退回深度', () => {
    expect(tierOf('基础', 0)).toBe(0);
    expect(tierOf('主干', 1)).toBe(1);
    expect(tierOf('分支', 1)).toBe(2);
    expect(tierOf('前沿', 1)).toBe(3);
    expect(tierOf('', 2)).toBe(2);
    expect(tierOf('课外', 3)).toBe(3);
  });

  it('同 tier 共用一条 y：三门「基础」跨三轨仍对齐成一排', () => {
    const layout = starMapLayout(forestDomain(), EDGES);
    const nodes = byId(layout);
    const roots = ['math_analysis', 'linear_algebra', 'probability'].map((id) => nodes.get(id)!);
    expect(roots.every((n) => n.tier === 0)).toBe(true);
    expect(new Set(roots.map((n) => n.y)).size).toBe(1);
    const tier1 = layout.nodes.filter((n) => n.tier === 1).map((n) => n.id).sort();
    expect(tier1).toEqual(['abstract_algebra', 'complex_analysis', 'ode', 'point_set_topology', 'real_analysis']);
    expect(new Set(tier1.map((id) => nodes.get(id)!.y)).size).toBe(1);
    expect(layout.tiers).toEqual([0, 1, 2]);
  });

  it('行等距自上而下：行距＝ROW_H × 套满系数', () => {
    const layout = starMapLayout(forestDomain(), EDGES);
    const ys = layout.tiers.map((t) => layout.nodes.find((n) => n.tier === t)!.y);
    expect(ys.length).toBe(3);
    for (let i = 1; i < ys.length; i += 1) {
      expect(ys[i] - ys[i - 1]).toBeCloseTo(ROW_H * layout.scale, 1);
    }
  });

  it('轨迹＝列：同轨课程落在同一列框内，列框水平互不压叠', () => {
    const layout = starMapLayout(forestDomain(), EDGES);
    expect(layout.nebulae).toHaveLength(4);
    for (const nebula of layout.nebulae) {
      expect(nebula.w).toBeGreaterThan(0);
      expect(nebula.h).toBeGreaterThan(0);
      for (const node of layout.nodes.filter((n) => n.track === nebula.name)) {
        expect(Math.abs(node.x - nebula.x)).toBeLessThanOrEqual(nebula.w / 2);
      }
    }
    for (let i = 0; i < layout.nebulae.length; i += 1) {
      for (let j = i + 1; j < layout.nebulae.length; j += 1) {
        expect(overlapsX(layout.nebulae[i], layout.nebulae[j])).toBe(false);
      }
    }
  });

  it('核心列居中、次要列左右交替环绕', () => {
    const view = { width: 1400, height: 900 };
    const layout = starMapLayout(forestDomain(), EDGES, view);
    expect(layout.nebulae.find((n) => n.core)!.name).toBe(ANALYSIS);
    let nearest = layout.nebulae[0];
    for (const n of layout.nebulae) {
      if (Math.abs(n.x - view.width / 2) < Math.abs(nearest.x - view.width / 2)) nearest = n;
    }
    expect(nearest.name).toBe(ANALYSIS);
    expect(layout.trackOrder[0]).toBe(ANALYSIS);
    // 主次序：main 优先 → 课程数降序 → 轨迹字典序
    expect(layout.trackOrder).toEqual([ANALYSIS, ALGEBRA, PROBABILITY, TOPOLOGY]);
    const xs = new Map(layout.nebulae.map((n) => [n.name, n.x]));
    expect(xs.get(ALGEBRA)! > xs.get(ANALYSIS)!).toBe(true);
    expect(xs.get(PROBABILITY)! < xs.get(ANALYSIS)!).toBe(true);
  });

  it('列框纵向包住本轨全部课程框（含标题带余量）', () => {
    const layout = starMapLayout(forestDomain(), EDGES);
    for (const nebula of layout.nebulae) {
      const members = layout.nodes.filter((n) => n.track === nebula.name);
      expect(members.length).toBeGreaterThan(0);
      for (const node of members) {
        expect(node.y + node.h / 2).toBeLessThanOrEqual(nebula.y + nebula.h / 2);
        expect(node.y - node.h / 2).toBeGreaterThanOrEqual(nebula.y - nebula.h / 2);
      }
    }
  });

  it('连线只连课程框、必然下行；跨轨边标 cross；不含星云端点', () => {
    const layout = starMapLayout(forestDomain(), EDGES);
    const nodes = byId(layout);
    expect(layout.links).toHaveLength(EDGES.length);
    for (const link of layout.links) {
      const from = nodes.get(link.source)!;
      const to = nodes.get(link.target)!;
      expect(from).toBeDefined();
      expect(to).toBeDefined();
      expect(to.y).toBeGreaterThan(from.y);
      expect(link.cross).toBe(from.track !== to.track);
    }
    expect(layout.links.some((l) => l.source.startsWith('nebula:') || l.target.startsWith('nebula:'))).toBe(false);
  });

  it('列内同排多门课并排不重叠；课名越长框越宽', () => {
    const layout = starMapLayout(forestDomain(), EDGES);
    const nodes = byId(layout);
    const tier1 = layout.nodes.filter((n) => n.track === ANALYSIS && n.tier === 1);
    expect(tier1.length).toBe(3);
    const sorted = [...tier1].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].x - sorted[i - 1].x).toBeGreaterThan(sorted[i].w / 2 + sorted[i - 1].w / 2 - 1);
    }
    expect(nodes.get('probability')!.w).toBeGreaterThan(nodes.get('pde')!.w);
  });

  it('连线不斜穿无关课程框：跨行长边自动取弯曲度绕行，相邻行仍是直线', () => {
    const layout = starMapLayout(forestDomain(), EDGES);
    const nodes = byId(layout);
    for (const link of layout.links) {
      expect(Number.isFinite(link.curveness)).toBe(true);
      const from = nodes.get(link.source)!;
      const to = nodes.get(link.target)!;
      for (const box of layout.nodes) {
        if (box.id === from.id || box.id === to.id) continue;
        for (let i = 1; i < 24; i += 1) {
          const p = linkPoint(from, to, link.curveness, i / 24);
          const inside = Math.abs(p.x - box.x) < box.w / 2 && Math.abs(p.y - box.y) < box.h / 2;
          expect(inside, `${link.source}→${link.target} 第 ${i} 段穿过 ${box.id}`).toBe(false);
        }
      }
    }
    // 数学分析→偏微分方程跨两行、正下方被常微分方程挡着 → 必须绕行
    expect(layout.links.find((l) => l.source === 'math_analysis' && l.target === 'pde')!.curveness).not.toBe(0);
    // 同列纵向边无遮挡 → 保持直线
    expect(layout.links.find((l) => l.source === 'probability' && l.target === 'stochastic_processes')!.curveness).toBe(0);
  });

  it('课框尺寸可估：宽度随字数单调、高度恒定、有下限', () => {
    const short = courseBoxSize('偏微分方程');
    const long = courseBoxSize('概率论与数理统计');
    expect(long.w).toBeGreaterThan(short.w);
    expect(long.h).toBe(short.h);
    expect(courseBoxSize('').w).toBeGreaterThanOrEqual(60);
  });

  it('先修环不断链：环上节点仍全部落位且坐标有限', () => {
    const d = domain([cluster(ANALYSIS, [
      course('a', '甲', ANALYSIS, '基础'),
      course('b', '乙', ANALYSIS, '主干'),
    ])]);
    const layout = starMapLayout(d, [
      { from: 'a', to: 'b', domain_id: 'math', cross_track: false },
      { from: 'b', to: 'a', domain_id: 'math', cross_track: false },
    ]);
    expect(layout.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
    for (const n of layout.nodes) expect(Number.isFinite(n.x + n.y)).toBe(true);
  });

  it('端点不在本域的先修边被忽略', () => {
    const d = domain([cluster(ANALYSIS, [
      course('ma', '数学分析', ANALYSIS, '基础'),
      course('child', '后继课', ANALYSIS, '主干'),
    ])]);
    const layout = starMapLayout(d, [{ from: 'ma', to: 'ghost', domain_id: 'math', cross_track: false }]);
    expect(layout.links).toEqual([]);
  });

  it('套满画布：留白与预乘系数配对，列框整体落在视口内', () => {
    const view = { width: 1200, height: 700 };
    const layout = starMapLayout(forestDomain(), EDGES, view);
    const xs = layout.nodes.map((n) => n.x);
    const ys = layout.nodes.map((n) => n.y);
    const spreadX = Math.max(...xs) - Math.min(...xs);
    const spreadY = Math.max(...ys) - Math.min(...ys);
    expect(layout.chartMarginX).toBeCloseTo((view.width - spreadX) / 2, 1);
    expect(layout.chartMarginY).toBeCloseTo((view.height - spreadY) / 2, 1);
    expect(layout.scale).toBeGreaterThan(0.7);
    for (const n of layout.nebulae) {
      expect(n.x - n.w / 2).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w / 2).toBeLessThanOrEqual(view.width);
      expect(n.y - n.h / 2).toBeGreaterThanOrEqual(0);
      expect(n.y + n.h / 2).toBeLessThanOrEqual(view.height);
    }
  });

  it('缺省视口常量存在且为横向以上画布（页面未测得容器宽高时的兜底）', () => {
    expect(STARMAP_VIEW.width).toBeGreaterThan(800);
    expect(STARMAP_VIEW.height).toBeGreaterThan(500);
    expect(nebulaId('x')).toBe('nebula:x');
  });
});
