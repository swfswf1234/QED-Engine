import { describe, it, expect } from 'vitest';
import { buildStarMapOption } from './StarMapGraph';
import { starMapLayout } from './starMapLayout';
import type { StarCourseNode, StarMapDomain, StarMapEdge, TrackCluster } from '../api/learn';

function course(id: string, name: string, track: string, stage = '', description = ''): StarCourseNode {
  return { course_id: id, name, track, stage, sort_order: null, description, kp_confirmed: 0 };
}

function cluster(track: string, courses: StarCourseNode[], kind = 'main', summary = ''): TrackCluster {
  return { track, kind, summary, courses };
}

const ANALYSIS = '分析学';
const ALGEBRA = '代数学';

const DOMAIN: StarMapDomain = {
  domain_id: 'math',
  name: '数学',
  level: '本科',
  tracks: [
    cluster(ANALYSIS, [
      course('math_analysis', '数学分析', ANALYSIS, '基础'),
      course('ode', '常微分方程', ANALYSIS, '主干'),
      course('pde', '偏微分方程', ANALYSIS, '分支'),
    ]),
    cluster(ALGEBRA, [
      course('linear_algebra', '高等代数', ALGEBRA, '基础'),
      course('abstract_algebra', '抽象代数', ALGEBRA, '主干'),
    ], 'branch'),
  ],
};

const EDGES: StarMapEdge[] = [
  { from: 'math_analysis', to: 'ode', domain_id: 'math', cross_track: false },
  { from: 'math_analysis', to: 'pde', domain_id: 'math', cross_track: false },
  { from: 'ode', to: 'pde', domain_id: 'math', cross_track: false },
  { from: 'linear_algebra', to: 'abstract_algebra', domain_id: 'math', cross_track: false },
  { from: 'linear_algebra', to: 'pde', domain_id: 'math', cross_track: true },
];

interface ItemShape {
  id: string;
  name: string;
  x: number;
  y: number;
  symbol: string;
  symbolSize: number | [number, number];
  kind: string;
  detail: string;
  itemStyle: { color: string; borderType?: string; opacity?: number };
  label: { show: boolean; position: string; formatter: string };
  emphasis?: { disabled?: boolean };
}

interface LinkShape {
  source: string;
  target: string;
  lineStyle: { type: string; curveness: number; opacity: number };
}

interface OptionShape {
  tooltip: { formatter: (params: { data?: ItemShape }) => string };
  series: Array<{
    type: string;
    layout: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
    edgeSymbol: string[];
    emphasis: {
      focus: string;
      scale: boolean;
      itemStyle: { color: string; borderColor: string; borderWidth: number };
      label: { color: string };
    };
    data: ItemShape[];
    links: LinkShape[];
  }>;
}

function build() {
  const layout = starMapLayout(DOMAIN, EDGES, { width: 1200, height: 700 });
  const option = buildStarMapOption(layout) as unknown as OptionShape;
  return { layout, option, series: option.series[0] };
}

describe('星图渲染 buildStarMapOption（课程＝框本体、连线只连框）', () => {
  it('课程节点＝不透明圆角框（取消圆点），标签写在框内且带课名', () => {
    const { layout, series } = build();
    const courses = series.data.filter((d) => d.kind === 'course');
    expect(courses).toHaveLength(layout.nodes.length);
    expect(series.data.some((d) => d.symbol === 'circle')).toBe(false);
    for (const item of courses) {
      const node = layout.nodes.find((n) => n.id === item.id)!;
      expect(item.symbol).toBe('roundRect');
      expect(item.symbolSize).toEqual([node.w, node.h]);
      expect(item.x).toBe(node.x);
      expect(item.y).toBe(node.y);
      expect(item.label.position).toBe('inside');
      expect(item.label.formatter).toBe(node.name);
      // 不透明：连线从框下穿过时不会透出来
      expect(item.itemStyle.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(item.itemStyle.opacity ?? 1).toBe(1);
    }
  });

  it('连线只连课程框：同轨实线、跨轨虚线、无箭头、弯曲度透传', () => {
    const { layout, series } = build();
    expect(series.links).toHaveLength(layout.links.length);
    expect(series.edgeSymbol).toEqual(['none', 'none']);
    for (const link of series.links) {
      const plan = layout.links.find((l) => l.source === link.source && l.target === link.target)!;
      expect(plan).toBeDefined();
      expect(link.source.startsWith('nebula:')).toBe(false);
      expect(link.target.startsWith('nebula:')).toBe(false);
      expect(link.lineStyle.type).toBe(plan.cross ? 'dashed' : 'solid');
      expect(link.lineStyle.curveness).toBe(plan.curveness);
    }
    expect(series.links.some((l) => l.lineStyle.type === 'dashed')).toBe(true);
  });

  it('轨迹列框：虚线描边、透明填充、名称写在顶部名称带，且不响应悬停', () => {
    const { layout, series } = build();
    const nebulae = series.data.filter((d) => d.kind === 'nebula');
    expect(nebulae).toHaveLength(layout.nebulae.length);
    for (const item of nebulae) {
      const box = layout.nebulae.find((n) => n.id === item.id)!;
      expect(item.symbol).toBe('roundRect');
      expect(item.symbolSize).toEqual([box.w, box.h]);
      expect(item.itemStyle.borderType).toBe('dashed');
      expect(item.itemStyle.color.startsWith('rgba')).toBe(true);
      expect(item.label.formatter).toBe(box.name);
      expect(item.emphasis?.disabled).toBe(true);
      // 名称带在框内顶部：标签中心落在上半部
      const labelOffsetY = (item as unknown as { label: { offset: [number, number] } }).label.offset[1];
      expect(labelOffsetY).toBeLessThan(0);
      expect(box.y + labelOffsetY).toBeGreaterThan(box.y - box.h / 2);
    }
    expect(series.emphasis.focus).toBe('none');
  });

  it('课程悬停高亮走 series 级 emphasis，课程项不自带 emphasis', () => {
    const { series } = build();
    const courses = series.data.filter((d) => d.kind === 'course');
    expect(courses.length).toBeGreaterThan(0);
    // graph 符号的高亮态只认 series 级 emphasis；逐项 emphasis 会被 hasItemOption 分支覆盖成继承值
    for (const item of courses) {
      expect(item.emphasis).toBeUndefined();
      expect(item.itemStyle.color).not.toBe(series.emphasis.itemStyle.color);
    }
    expect(series.emphasis.scale).toBe(false);
    expect(series.emphasis.itemStyle.borderColor).toBe('#ffffff');
    expect(series.emphasis.itemStyle.borderWidth).toBeGreaterThan(1.4);
    expect(series.emphasis.label.color).toBe('#ffffff');
  });

  it('课程悬停提示＝课名（加粗）＋课程叙述两行，计数段与复习段都不出现（REQ-110 四审裁决）', () => {
    const layout = starMapLayout(
      { ...DOMAIN, tracks: [cluster(ANALYSIS, [course('math_analysis', '数学分析', ANALYSIS, '基础', '极限、连续与一元微积分')], 'main')] },
      [],
      { width: 1200, height: 700 },
    );
    const option = buildStarMapOption(layout) as unknown as OptionShape;
    const item = option.series[0].data.find((d) => d.kind === 'course')!;
    const html = option.tooltip.formatter({ data: item });
    expect(html).toContain('<b>数学分析</b>');
    expect(html).toContain('极限、连续与一元微积分');
    // 叙述限宽折行、不截字符
    expect(html).toContain('white-space:pre-wrap');
    expect(html).not.toContain('已确认');
    expect(html).not.toContain('待选');
    expect(html).not.toContain('复习');
  });

  it('叙述为空只显课名一行；列框与空数据不给提示', () => {
    const { option, series } = build();
    const nebula = series.data.find((d) => d.kind === 'nebula')!;
    const course = series.data.find((d) => d.kind === 'course')!;
    expect(option.tooltip.formatter({ data: nebula })).toBe('');
    expect(option.tooltip.formatter({})).toBe('');
    // 布局夹具无 description → 提示只有课名一行，不留空行占位
    const html = option.tooltip.formatter({ data: course });
    expect(html).toBe(`<b>${course.name}</b>`);
    expect(html).not.toContain('<br/>');
  });

  it('series 四边留白与布局系数配对（渲染套满系数为 1），列框画在课程框之下', () => {
    const { layout, series } = build();
    expect(series.type).toBe('graph');
    expect(series.layout).toBe('none');
    expect(series.left).toBe(layout.chartMarginX);
    expect(series.right).toBe(layout.chartMarginX);
    expect(series.top).toBe(layout.chartMarginY);
    expect(series.bottom).toBe(layout.chartMarginY);
    expect(series.data[0].kind).toBe('nebula');
    expect(series.data[series.data.length - 1].kind).toBe('course');
  });
});
