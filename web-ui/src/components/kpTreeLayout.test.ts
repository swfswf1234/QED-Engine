/**
 * 课程层级星图布局纯函数单测（REQ-113 W2，设计稿 A §9 七审改判 2026-10-15）
 * 口径：两级粒度＝大知识点虚框（outline depth1）纵向堆叠 + 框内条目（outline depth2 与归入的 point）
 * 行优先网格；归属由虚框几何承载（**无边集、无 ownership**）；定序＝order_hint 升序 → 来源锚最小页码
 * → 名称码点 → 行 id；`parent_kp_id` 空／悬空的 point 不进图（学习面不出现「未归档」）；
 * 节点只带名称＋摘要＋几何（编辑侧 type／锚数／下辖数不进布局）。
 */
import { describe, it, expect } from 'vitest';
import {
  KP_BOX_GAP, KP_BOX_INSET, KP_CANVAS_PAD, KP_CELL_H, KP_CELL_W, KP_ITEM_R,
  KP_NAME_BAND_H, kpTreeLayout, type KpTreeRow,
} from './kpTreeLayout';

function row(over: Partial<KpTreeRow> & { kp_id: string; name: string }): KpTreeRow {
  return {
    node_kind: 'point',
    parent_kp_id: null,
    depth: null,
    order_hint: null,
    summary: '',
    source_ref: null,
    anchors: [],
    ...over,
  };
}

const CHAPTER1 = row({ kp_id: 'k1', name: '第1章 函数与极限', node_kind: 'outline', depth: 1, order_hint: 1 });
const CHAPTER2 = row({ kp_id: 'k2', name: '第9章 级数', node_kind: 'outline', depth: 1, order_hint: 9 });
const SECTION = row({
  kp_id: 'k11', name: '1.1 映射', node_kind: 'outline', depth: 2,
  parent_kp_id: 'k1', order_hint: 1, summary: '集合与对应关系',
});
const SECTION2 = row({ kp_id: 'k12', name: '1.2 函数', node_kind: 'outline', depth: 2, parent_kp_id: 'k1', order_hint: 2 });
// point 的父是「节」→ 归到该节所在的大知识点框
const P1 = row({ kp_id: 'p1', name: '确界原理', parent_kp_id: 'k11', summary: '有上界数集必有上确界', anchors: [{ kind: 'book', ref_id: 'b05', page: 5 }] });
const P2 = row({ kp_id: 'p2', name: '单调有界原理', parent_kp_id: 'k11', anchors: [{ kind: 'book', ref_id: 'b05', page: 8 }] });
// 直挂章的 point：仍是该章框内条目，不另立第三层
const P3 = row({ kp_id: 'p3', name: '极限定义', parent_kp_id: 'k2', order_hint: 1 });
const ORPHAN = row({ kp_id: 'p4', name: '散落的知识点' });
const DANGLING = row({ kp_id: 'p5', name: '悬空的知识点', parent_kp_id: 'nope' });

const ALL = [CHAPTER2, CHAPTER1, SECTION, SECTION2, P1, P2, P3, ORPHAN, DANGLING];

/** 框宽由内容区实测宽推出（画布左右各留 KP_CANVAS_PAD） */
const W = 1200;
const boxOf = (layout: ReturnType<typeof kpTreeLayout>, id: string) =>
  layout.boxes.find((b) => b.id === id)!;
const itemOf = (layout: ReturnType<typeof kpTreeLayout>, id: string) =>
  layout.items.find((n) => n.id === id)!;
const contains = (box: ReturnType<typeof kpTreeLayout>['boxes'][number], n: { x: number; y: number }) =>
  n.x >= box.x - box.w / 2 && n.x <= box.x + box.w / 2
  && n.y >= box.y - box.h / 2 && n.y <= box.y + box.h / 2;

describe('kpTreeLayout（课程层级星图：大知识点虚框堆叠＋框内条目网格）', () => {
  it('两级粒度：outline depth1＝虚框，depth2 与归入的 point＝框内条目；point 不另立第三层', () => {
    const layout = kpTreeLayout(ALL, W);
    expect(layout.boxes.map((b) => b.id)).toEqual(['k1', 'k2']);
    expect(layout.items.map((n) => n.id).sort()).toEqual(['k11', 'k12', 'p1', 'p2', 'p3']);
    // 节 k11／k12 与它们的 point 同在第1章框内
    const ch1 = boxOf(layout, 'k1');
    for (const id of ['k11', 'k12', 'p1', 'p2']) expect(contains(ch1, itemOf(layout, id))).toBe(true);
    expect(contains(boxOf(layout, 'k2'), itemOf(layout, 'p3'))).toBe(true);
  });

  it('学习面不出现「未归档」：parent 空或悬空的 point 既不补虚框也不画该 point', () => {
    const layout = kpTreeLayout(ALL, W);
    expect(layout.items.some((n) => n.id === 'p4' || n.id === 'p5')).toBe(false);
    expect(JSON.stringify(layout)).not.toContain('未归档');
    expect(JSON.stringify(layout)).not.toContain('kp-unarchived');
    // outline depth2 的父悬空 → 无所属框，同样不进图（不补画框）
    const noParent = kpTreeLayout([row({ kp_id: 's9', name: '无父的节', node_kind: 'outline', depth: 2 })], W);
    expect(noParent.boxes).toEqual([]);
    expect(noParent.items).toEqual([]);
  });

  it('虚框单列纵向堆叠：x 同轴、按定序自上而下、框间不重叠且各含其条目', () => {
    const layout = kpTreeLayout(ALL, W);
    const [a, b] = layout.boxes;
    expect(a.x).toBe(b.x);
    expect(a.y).toBeLessThan(b.y);
    expect(b.y - b.h / 2).toBeGreaterThanOrEqual(a.y + a.h / 2 + KP_BOX_GAP - 0.001);
    // 框高＝名称带＋条目网格（1.1/1.2 两节加两个 point → 框内 4 条）
    const colsOf = (box: typeof a) => Math.floor((box.w - 2 * KP_BOX_INSET) / KP_CELL_W);
    expect(a.h).toBe(KP_NAME_BAND_H + 2 * KP_BOX_INSET + Math.ceil(4 / colsOf(a)) * KP_CELL_H);
    expect(b.h).toBe(KP_NAME_BAND_H + 2 * KP_BOX_INSET + Math.ceil(1 / colsOf(b)) * KP_CELL_H);
    for (const box of layout.boxes) {
      for (const n of layout.items) if (contains(box, n)) expect(n.x).toBeLessThanOrEqual(box.x + box.w / 2);
    }
  });

  it('框宽＝内容区实测宽 − 2×画布留白；框内条目按框宽折行成行优先网格', () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      row({ kp_id: `m${i}`, name: `条目${i}`, parent_kp_id: 'k1', order_hint: i }));
    const layout = kpTreeLayout([CHAPTER1, ...many], W);
    const box = boxOf(layout, 'k1');
    expect(box.w).toBe(W - 2 * KP_CANVAS_PAD);
    expect(layout.width).toBe(W - 2 * KP_CANVAS_PAD);
    expect(layout.height).toBe(box.h);
    const cols = Math.floor((box.w - 2 * KP_BOX_INSET) / KP_CELL_W);
    expect(cols).toBeGreaterThan(1);
    const xs = layout.items.map((n) => n.x);
    // 行优先：前 cols 条同一行（y 相同、x 递增），溢出换行
    expect(layout.items[0].y).toBe(layout.items[cols - 1].y);
    expect(layout.items[0].y).toBeLessThan(layout.items[cols].y);
    expect(Math.max(...xs)).toBe(KP_BOX_INSET + (cols - 1) * KP_CELL_W + KP_ITEM_R);
    expect(Math.min(...xs)).toBe(KP_ITEM_R + KP_BOX_INSET);
    // 格心坐标与常量同源（数据坐标原点＝内容左上角，渲染层再套画布留白）
    expect(layout.items[0].x).toBe(KP_BOX_INSET + KP_ITEM_R);
    expect(layout.items[0].y).toBe(KP_NAME_BAND_H + KP_BOX_INSET + KP_CELL_H / 2);
  });

  it('定序＝order_hint 升序 → 空值按来源锚最小页码 → 名称码点 → 行 id（框与条目同一口径）', () => {
    const layout = kpTreeLayout(ALL, W);
    // 框：k1(order_hint 1) 先于 k2(9)
    expect(layout.boxes.map((b) => b.id)).toEqual(['k1', 'k2']);
    // 框内：节有 order_hint（1,2）先排；point 无 order_hint 走页码兜底（p1 第5页 < p2 第8页）
    expect(layout.items.filter((n) => contains(boxOf(layout, 'k1'), n)).map((n) => n.id))
      .toEqual(['k11', 'k12', 'p1', 'p2']);
    // order_hint 同为空的行按名称码点，再按 id
    const tie = kpTreeLayout([
      CHAPTER2,
      row({ kp_id: 'z2', name: '乙', parent_kp_id: 'k2' }),
      row({ kp_id: 'z1', name: '丙', parent_kp_id: 'k2' }),
      row({ kp_id: 'z3', name: '丙', parent_kp_id: 'k2' }),
    ], W);
    expect(tie.items.map((n) => n.id)).toEqual(['z1', 'z3', 'z2']);
  });

  it('摘要随行 carry（框与条目同字段，空值留空串由渲染层只显名称）；编辑侧字段不进布局', () => {
    const layout = kpTreeLayout(ALL, W);
    expect(boxOf(layout, 'k1').summary).toBe('');
    expect(itemOf(layout, 'k11').summary).toBe('集合与对应关系');
    expect(itemOf(layout, 'p1').summary).toBe('有上界数集必有上确界');
    for (const n of [...layout.boxes, ...layout.items]) {
      expect(n).not.toHaveProperty('type');
      expect(n).not.toHaveProperty('anchorCount');
      expect(n).not.toHaveProperty('childCount');
      expect(n).not.toHaveProperty('kind');
    }
    // 归属不再产生边集与归属文案
    expect(layout).not.toHaveProperty('links');
    expect(JSON.stringify(layout)).not.toContain('ownership');
  });

  it('内容区未测得（首帧／jsdom 宽度 0）→ 用兜底框宽出图，不留白屏', () => {
    const fallback = kpTreeLayout(ALL, 0);
    expect(fallback.width).toBeGreaterThanOrEqual(480);
    expect(fallback.boxes.length).toBe(2);
    expect(fallback.height).toBeGreaterThan(0);
  });

  it('确定性：同一数据乱序输入必得同一张图', () => {
    const a = kpTreeLayout(ALL, W);
    const b = kpTreeLayout([...ALL].reverse(), W);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('空输入＝空图（课程无已确认知识点由页面走空态）', () => {
    const layout = kpTreeLayout([], W);
    expect(layout.boxes).toEqual([]);
    expect(layout.items).toEqual([]);
    expect(layout.height).toBe(0);
  });
});
