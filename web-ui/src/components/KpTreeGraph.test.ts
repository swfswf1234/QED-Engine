/**
 * 课程知识点层级星图渲染层单测（REQ-113 W3，设计稿 A §9 七审改判 2026-10-15）
 * 口径：大知识点＝虚框图元（roundRect＋dashed 描边＋透明填充＋框内顶部名称带），
 * 框内条目＝发光圆点＋常驻名称标签；**画布不出现边图元**（归属由虚框承载）；
 * 悬停两类语义＝虚框（大知识点名称＋摘要）与条目（小知识点名称＋摘要），编辑侧字段一律不进提示；
 * 取景锚（两个不可见的角点）把数据坐标钉成像素，圆点不被拉成椭圆。
 * jsdom 无 canvas：只拍 option 纯数据与 formatter（同 StarMapGraph.test 处理）。
 */
import { describe, it, expect } from 'vitest';
import { buildKpTreeOption, kpTreeCanvas } from './KpTreeGraph';
import { KP_CANVAS_PAD, KP_ITEM_R, kpTreeLayout, type KpTreeRow } from './kpTreeLayout';

const ROWS: KpTreeRow[] = [
  { kp_id: 'k1', name: '第1章 函数与极限', node_kind: 'outline', depth: 1, order_hint: 1, summary: '极限是本章的唯一主角' },
  { kp_id: 'k11', name: '1.1 映射', node_kind: 'outline', depth: 2, parent_kp_id: 'k1', order_hint: 1, summary: '集合与对应关系' },
  { kp_id: 'p1', name: '确界原理', node_kind: 'point', parent_kp_id: 'k11', order_hint: 1, summary: '有上界数集必有上确界', anchors: [{ kind: 'book', page: 5 }] },
  { kp_id: 'p2', name: '无介绍知识点', node_kind: 'point', parent_kp_id: 'k11', order_hint: 2 },
  { kp_id: 'p3', name: '散落的知识点', node_kind: 'point', parent_kp_id: null },
];

const LAYOUT = kpTreeLayout(ROWS, 1200);

const seriesOf = (option: ReturnType<typeof buildKpTreeOption>) =>
  (option.series as Array<Record<string, unknown>>)[0];

const dataOf = (option: ReturnType<typeof buildKpTreeOption>) =>
  seriesOf(option).data as Array<Record<string, any>>;

const byId = (option: ReturnType<typeof buildKpTreeOption>, id: string) =>
  dataOf(option).find((d) => d.id === id)!;

const tooltipOf = (option: ReturnType<typeof buildKpTreeOption>, params: unknown) =>
  (option.tooltip as { formatter: (p: unknown) => string }).formatter(params);

describe('buildKpTreeOption（课程层级星图：大知识点虚框＋框内条目，暗底无边）', () => {
  it('图元两层：虚框＝dashed 圆角框＋框内顶部名称带，条目＝发光圆点＋右侧常驻标签', () => {
    const option = buildKpTreeOption(LAYOUT);
    const series = seriesOf(option);
    expect(series.type).toBe('graph');
    expect(series.layout).toBe('none');
    expect(option.backgroundColor).toBe('transparent');

    const box = byId(option, 'k1');
    expect(box.symbol).toBe('roundRect');
    expect(box.itemStyle.borderType).toBe('dashed');
    // 虚框只作容器：填充近透明，不铺不透明白底
    expect(String(box.itemStyle.color)).toContain('0.0');
    expect(box.symbolSize).toEqual([LAYOUT.boxes[0].w, LAYOUT.boxes[0].h]);
    expect(box.label.show).toBe(true);
    expect(box.label.position).toBe('inside');
    // 名称带落在框内顶部那条带里
    expect(box.label.offset[1]).toBeCloseTo(-LAYOUT.boxes[0].h / 2 + 34 / 2);

    const item = byId(option, 'p1');
    expect(item.symbol).toBe('circle');
    expect(item.label.show).toBe(true);
    expect(item.label.position).toBe('right');
    expect(item.label.formatter).toBe('确界原理');
    expect(item.itemStyle.shadowBlur).toBeGreaterThan(0);
    // 层级身份由虚框承载，条目半径一律同值
    expect(item.symbolSize[0]).toBe(KP_ITEM_R * 2);
  });

  it('无边图元：series.links 为空数组，edgeSymbol 两端都无箭头', () => {
    const option = buildKpTreeOption(LAYOUT);
    expect(seriesOf(option).links).toEqual([]);
    expect(seriesOf(option).edgeSymbol).toEqual(['none', 'none']);
  });

  it('取景锚＋画布尺寸：内容尺寸外扩 2×留白，套满比为 1（数据坐标＝像素，正圆不拉伸）', () => {
    const canvas = kpTreeCanvas(LAYOUT);
    expect(canvas.width).toBe(LAYOUT.width + 2 * KP_CANVAS_PAD);
    expect(canvas.height).toBe(LAYOUT.height + 2 * KP_CANVAS_PAD);
    expect(canvas.aspect).toBeCloseTo(1);
    const option = buildKpTreeOption(LAYOUT, canvas.aspect);
    const frames = dataOf(option).filter((d) => d.kind === 'frame');
    expect(frames).toHaveLength(2);
    for (const f of frames) {
      expect(f.symbolSize).toEqual([0, 0]);
      expect(f.label.show).toBe(false);
      expect(f.itemStyle.opacity).toBe(0);
    }
    const series = seriesOf(option);
    expect(series.left).toBe(KP_CANVAS_PAD);
    expect(series.right).toBe(KP_CANVAS_PAD);
    expect(series.top).toBe(KP_CANVAS_PAD);
    expect(series.bottom).toBe(KP_CANVAS_PAD);
    // 九框纵向堆叠高于视口，缩放／平移是可达出口（真机 8903 实测口径）
    expect(series.roam).toBe(true);
    expect(series.scaleLimit).toEqual({ min: 0.5, max: 3 });
  });

  it('两轴套满比不为 1 时按 aspect 补偿 y 分量（REQ-111 正圆补偿保留）', () => {
    const plain = byId(buildKpTreeOption(LAYOUT, 1), 'p1').symbolSize;
    const fixed = byId(buildKpTreeOption(LAYOUT, 1.5), 'p1').symbolSize;
    expect(plain).toEqual([KP_ITEM_R * 2, KP_ITEM_R * 2]);
    expect(fixed[0]).toBe(KP_ITEM_R * 2);
    expect(fixed[1]).toBeCloseTo(KP_ITEM_R * 2 * 1.5);
    // 虚框的纵向同样按 aspect 出图，否则框高被拉伸
    expect(byId(buildKpTreeOption(LAYOUT, 1.5), 'k1').symbolSize[1])
      .toBeCloseTo(LAYOUT.boxes[0].h * 1.5);
  });

  it('悬停＝名称＋摘要（框与条目同口径），空摘要只显名称；编辑侧字段与「未归档」都不出现', () => {
    const option = buildKpTreeOption(LAYOUT);
    const box = tooltipOf(option, { dataType: 'node', data: byId(option, 'k1') });
    expect(box).toContain('第1章 函数与极限');
    expect(box).toContain('极限是本章的唯一主角');
    const item = tooltipOf(option, { dataType: 'node', data: byId(option, 'p1') });
    expect(item).toContain('确界原理');
    expect(item).toContain('有上界数集必有上确界');
    const bare = tooltipOf(option, { dataType: 'node', data: byId(option, 'p2') });
    expect(bare).toBe('<b>无介绍知识点</b>');
    for (const text of [box, item, bare]) {
      expect(text).not.toContain('来源锚');
      expect(text).not.toContain('下辖');
      expect(text).not.toContain('概念性');
      expect(text).not.toContain('层级＝');
      expect(text).not.toContain('未归档');
    }
    // 无父的 point 不进图（学习面不出现该概念）
    expect(dataOf(option).some((d) => d.id === 'p3')).toBe(false);
    // 取景锚不出提示
    expect(tooltipOf(option, { dataType: 'node', data: byId(option, 'kp-frame-min') })).toBe('');
  });

  it('提示走 HTML 渲染故转义：名称与摘要含标签字符不注入', () => {
    const injected = buildKpTreeOption(kpTreeLayout([
      { kp_id: 'x1', name: '<img src=x>', node_kind: 'outline', depth: 1, summary: '<b>粗</b>' },
    ], 1200));
    const text = tooltipOf(injected, { dataType: 'node', data: byId(injected, 'x1') });
    expect(text).not.toContain('<img');
    expect(text).toContain('&lt;img');
    expect(text).toContain('&lt;b&gt;');
  });

  it('点击口径：层级星图无跳转出口（组件不接 onSelect），数据项 id 与布局一致', () => {
    const option = buildKpTreeOption(LAYOUT);
    const ids = dataOf(option).filter((d) => d.kind !== 'frame').map((d) => d.id);
    expect(ids).toEqual(['k1', 'k11', 'p1', 'p2']);
  });

  it('空布局（课程无已确认知识点）不画任何图元，由页面走空态', () => {
    const option = buildKpTreeOption(kpTreeLayout([], 1200));
    expect(dataOf(option).filter((d) => d.kind !== 'frame')).toEqual([]);
  });
});
