/**
 * 知识梳理星图布局纯函数（设计：docs/plans/2026-09-30-knowledge-point-star-map.md 星图 UI 设计节 · 裁决 ⑧）
 * 版式＝「层＝行 × 轨迹＝列」的自上而下森林：
 * - 行＝层级 tier（max(stage 档序, 先修拓扑深度)，再沿边松弛，保证连线严格自上而下、不横向穿插）
 * - 列＝学习轨迹，主次序排列（main 优先 → 课程数降序 → 轨迹字典序）；核心列居中，次要列左右交替环绕
 * - 课程节点本体＝按课名估宽的不透明框（不画圆点），连线只连课程框
 * - 确定性：同一输入必得同一坐标（无随机源、有限轮松弛），可 vitest 断言
 * - 套满画布：坐标、框尺寸与「列框相对成员点包围盒中心的伸出量」同乘一个系数，渲染层留白与之配对，
 *   使 ECharts 自身套满系数恰为 1——否则点距被放大而框不变，框会套不住课程
 */
import type { StarCourseNode, StarMapDomain, StarMapEdge, TrackCluster } from '../api/learn';

/** 缺省视口（容器实测宽高由页面传入覆盖；此处仅兜底） */
export const STARMAP_VIEW = { width: 1200, height: 700 };

/** 课名标签字号（渲染层按套满系数缩放，此处为度量基准） */
export const NODE_FONT = 15;
/** 课程框高度：恒定，行距由 ROW_H 拉开 */
export const BOX_H = 44;
const BOX_MIN_W = 96;
const BOX_PAD_X = 22;
/** 拉丁字母/数字按半宽计（课名以中文为主，混排时不必精确） */
const NARROW_CHAR_RATIO = 0.56;
/** 行距（层级之间） */
export const ROW_H = 130;
/** 同排两门课的净间隙 */
const SLOT_GAP = 24;
/** 相邻两列（轨迹）的净间隙 */
const COL_GAP = 44;
/** 列框内边距 */
export const NEBULA_PAD = 20;
/** 列框顶部名称带占位高 */
export const NEBULA_TITLE_H = 34;
/** 绘图安全边距（等比套满后盒边超出最外成员点的距离，渲染层留白同用此值） */
export const VIEW_MARGIN = 90;
const MIN_SCALE = 0.55;
const MAX_SCALE = 1.6;
/** stage 文案 → 档序；未知文案退回先修深度 */
const STAGE_RANK: Record<string, number> = { 基础: 0, 主干: 1, 分支: 2, 前沿: 3 };

export interface StarNode {
  id: string;
  name: string;
  track: string;
  /** 框中心坐标（画布坐标系） */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 层级（行序，密集化后从 0 起） */
  tier: number;
  /** 先修拓扑深度 */
  depth: number;
  kpConfirmed: number;
  kpCandidates: number;
}

/** 轨迹列框＝竖长圆角包围盒：x/y 为盒中心，w/h 为盒宽高 */
export interface NebulaNode {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: string;
  summary: string;
  count: number;
  /** 是否核心列（居中那根） */
  core: boolean;
}

/** 先修连线（只连课程框） */
export interface StarLink {
  source: string;
  target: string;
  /** 跨轨迹边：渲染层画虚线；同轨画实线 */
  cross: boolean;
  /** ECharts 曲线弯曲度：直线会穿过无关课程框时自动取值绕行，0＝直线 */
  curveness: number;
}

export interface StarMapLayout {
  width: number;
  height: number;
  /** 列顺序（核心在首，其后为左右交替顺序；配色共用此序） */
  trackOrder: string[];
  /** 行序（升序，自上而下） */
  tiers: number[];
  nebulae: NebulaNode[];
  nodes: StarNode[];
  links: StarLink[];
  /** 套满画布的等比系数（已预乘进坐标与框尺寸） */
  scale: number;
  /** 渲染层 series 左右留白（与 scale 配对，使 ECharts 自身套满系数为 1） */
  chartMarginX: number;
  /** 渲染层 series 上下留白 */
  chartMarginY: number;
}

/** 列框节点 id 前缀（与课程 course_id 命名空间隔离，点击过滤用） */
export const NEBULA_PREFIX = 'nebula:';

export function nebulaId(track: string): string {
  return `${NEBULA_PREFIX}${track}`;
}

/** 层级＝stage 档序与先修深度取大（stage 缺失/未知时完全由拓扑决定） */
export function tierOf(stage: string, depth: number): number {
  const rank = STAGE_RANK[(stage ?? '').trim()];
  return rank === undefined ? depth : Math.max(rank, depth);
}

/** 课程框尺寸：宽按课名逐字估量（中文整宽、拉丁半宽）+ 左右内边距，高恒定 */
export function courseBoxSize(name: string): { w: number; h: number } {
  let units = 0;
  for (const ch of name ?? '') units += ch.charCodeAt(0) > 0x2e7f ? 1 : NARROW_CHAR_RATIO;
  return {
    w: Math.max(BOX_MIN_W, Math.round(units * NODE_FONT) + BOX_PAD_X * 2),
    h: BOX_H,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 绕行候选弯曲度：先直后弯、幅度递增、左右交替（取值顺序固定 → 确定性） */
const CURVE_CANDIDATES = [0, 0.14, -0.14, 0.28, -0.28, 0.45, -0.45, 0.65, -0.65];
/** 曲线采样段数（采样点落进无关框内即判为穿框） */
const CURVE_SAMPLES = 24;

/**
 * 连线上的点：与 ECharts graph 的 curveness 约定同源（控制点＝中点沿法向偏移，二次贝塞尔），
 * 布局侧算出的绕行在渲染时才是同一条曲线。弯曲度是长度比值，等比套满前后同值。
 */
export function linkPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  curveness: number,
  t: number,
): { x: number; y: number } {
  const cx = (from.x + to.x) / 2 - (from.y - to.y) * curveness;
  const cy = (from.y + to.y) / 2 - (to.x - from.x) * curveness;
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * cx + t * t * to.x,
    y: u * u * from.y + 2 * u * t * cy + t * t * to.y,
  };
}

interface Rect { x: number; y: number; w: number; h: number }

function insideBox(point: { x: number; y: number }, box: Rect): boolean {
  return Math.abs(point.x - box.x) < box.w / 2 && Math.abs(point.y - box.y) < box.h / 2;
}

/**
 * 跨行长边会斜穿中间那排课程框（视觉上像「连错了框」）。这里给每条边挑一个弯曲度绕开：
 * 采样点（不含两端，端点本就在自己框内）全部落在无关框外才算通过；全都绕不开则退回直线，
 * 中段由不透明课程框遮住，不会压住课名。
 */
function pickCurveness(from: Rect, to: Rect, blockers: Rect[]): number {
  for (const curveness of CURVE_CANDIDATES) {
    let clear = true;
    for (let i = 1; i < CURVE_SAMPLES && clear; i += 1) {
      const point = linkPoint(from, to, curveness, i / CURVE_SAMPLES);
      for (const box of blockers) {
        if (insideBox(point, box)) {
          clear = false;
          break;
        }
      }
    }
    if (clear) return curveness;
  }
  return 0;
}

/**
 * 先修拓扑深度：无先修=0，否则 1 + 先修最大深度。
 * 环按断环处理（回访中的节点记 0 层），保证纯函数一定收敛。
 */
function depthOf(prereqs: Map<string, string[]>): Map<string, number> {
  const memo = new Map<string, number>();
  const walking = new Set<string>();
  const resolve = (id: string): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (walking.has(id)) return 0;
    walking.add(id);
    let depth = 0;
    for (const pre of prereqs.get(id) ?? []) depth = Math.max(depth, resolve(pre) + 1);
    walking.delete(id);
    memo.set(id, depth);
    return depth;
  };
  return new Map([...prereqs.keys()].map((id) => [id, resolve(id)]));
}

/**
 * 沿先修边松弛层级，保证每条边严格下行（tier(to) > tier(from)）。
 * 有限轮封顶：DAG 一轮即收敛；含环时留在封顶值，连线上下穿插交给缩放与平移，不影响落位。
 */
function relaxTiers(
  tiers: Map<string, number>,
  pairs: { from: string; to: string }[],
  passes: number,
): void {
  for (let pass = 0; pass < passes; pass += 1) {
    let changed = false;
    for (const { from, to } of pairs) {
      const need = (tiers.get(from) ?? 0) + 1;
      if ((tiers.get(to) ?? 0) < need) {
        tiers.set(to, need);
        changed = true;
      }
    }
    if (!changed) break;
  }
}

interface Slot {
  course: StarCourseNode;
  tier: number;
  /** 列内横向偏移（相对列中心） */
  dx: number;
  w: number;
  h: number;
}

interface ColumnPlan {
  track: string;
  kind: string;
  summary: string;
  slots: Slot[];
  /** 本列最宽一排的宽度（不含内边距） */
  contentW: number;
}

/**
 * 一轨一列：按层级分行，整行以列中心对称展开。
 * 行内序＝先修者的横向重心（`barycenter`，无先修者排末尾），再按 course_id 定序：
 * 把子课程挪到父课程正下方附近，跨行长边就不会斜穿中间那排课程框。
 * 行宽与列宽与行内序无关，故两趟排序不会改变列的位置。
 */
function planColumn(
  cluster: TrackCluster,
  tiers: Map<string, number>,
  barycenter: Map<string, number> | null,
): ColumnPlan {
  const rows = new Map<number, StarCourseNode[]>();
  for (const course of cluster.courses) {
    const tier = tiers.get(course.course_id) ?? 0;
    const row = rows.get(tier);
    if (row) row.push(course);
    else rows.set(tier, [course]);
  }
  const slots: Slot[] = [];
  let contentW = 0;
  for (const tier of [...rows.keys()].sort((a, b) => a - b)) {
    const row = [...rows.get(tier)!].sort((a, b) => {
      const ba = barycenter?.get(a.course_id);
      const bb = barycenter?.get(b.course_id);
      if (ba === undefined || bb === undefined) {
        if (ba !== bb) return ba === undefined ? 1 : -1;
      } else if (ba !== bb) {
        return ba - bb;
      }
      return a.course_id.localeCompare(b.course_id);
    });
    const boxes = row.map((course) => courseBoxSize(course.name));
    const rowW = boxes.reduce((sum, box) => sum + box.w, 0) + SLOT_GAP * (row.length - 1);
    contentW = Math.max(contentW, rowW);
    let cursor = -rowW / 2;
    row.forEach((course, i) => {
      slots.push({ course, tier, dx: round(cursor + boxes[i].w / 2), w: boxes[i].w, h: boxes[i].h });
      cursor += boxes[i].w + SLOT_GAP;
    });
  }
  return {
    track: cluster.track,
    kind: cluster.kind,
    summary: cluster.summary,
    slots,
    contentW,
  };
}

const columnBoxWidth = (plan: ColumnPlan) => plan.contentW + NEBULA_PAD * 2;

export function starMapLayout(
  domain: StarMapDomain | null | undefined,
  edges: StarMapEdge[],
  view = STARMAP_VIEW,
): StarMapLayout {
  const width = view.width;
  const height = view.height;
  const empty: StarMapLayout = {
    width, height, trackOrder: [], tiers: [], nebulae: [], nodes: [], links: [],
    scale: 1, chartMarginX: VIEW_MARGIN, chartMarginY: VIEW_MARGIN,
  };
  const tracks = (domain?.tracks ?? []).filter((t) => t.courses.length > 0);
  if (tracks.length === 0) return empty;

  const prereqs = new Map<string, string[]>();
  const trackOfCourse = new Map<string, string>();
  for (const t of tracks) {
    for (const c of t.courses) {
      prereqs.set(c.course_id, []);
      trackOfCourse.set(c.course_id, t.track);
    }
  }
  const pairs: { from: string; to: string }[] = [];
  for (const e of edges) {
    if (e.from === e.to || !prereqs.has(e.from) || !prereqs.has(e.to)) continue;
    pairs.push({ from: e.from, to: e.to });
    prereqs.get(e.to)?.push(e.from);
  }

  const depths = depthOf(prereqs);
  const tiers = new Map<string, number>();
  for (const t of tracks) {
    for (const c of t.courses) tiers.set(c.course_id, tierOf(c.stage, depths.get(c.course_id) ?? 0));
  }
  relaxTiers(tiers, pairs, prereqs.size);

  const seenPair = new Set<string>();
  const links: StarLink[] = [];
  for (const { from, to } of [...pairs].sort((a, b) => `${a.from}→${a.to}`.localeCompare(`${b.from}→${b.to}`))) {
    const key = `${from}→${to}`;
    if (seenPair.has(key)) continue;
    seenPair.add(key);
    links.push({ source: from, target: to, cross: trackOfCourse.get(from) !== trackOfCourse.get(to), curveness: 0 });
  }

  const plans = tracks.map((cluster) => planColumn(cluster, tiers, null));
  const tierValues = [...new Set(plans.flatMap((p) => p.slots.map((s) => s.tier)))].sort((a, b) => a - b);
  const rowIndex = new Map(tierValues.map((t, i) => [t, i]));

  /** 主次序：main 优先 → 课程数降序 → 轨迹字典序 */
  const orderOf = (list: ColumnPlan[]) =>
    [...list].sort((a, b) => {
      const aMain = a.kind === 'main' ? 0 : 1;
      const bMain = b.kind === 'main' ? 0 : 1;
      return aMain - bMain || b.slots.length - a.slots.length || a.track.localeCompare(b.track);
    });
  const ordered = orderOf(plans);
  const centerX = columnCenters(ordered);

  // 两趟：首趟按 course_id 落位取父节点横坐标，再按重心定行内序重排（列宽与行内序无关，列位不变）
  const draft = placeColumns(ordered, rowIndex, centerX, depths);
  const settled = placeColumns(
    orderOf(tracks.map((cluster) => planColumn(cluster, tiers, parentBarycenter(pairs, draft.nodes)))),
    rowIndex,
    centerX,
    depths,
  );
  const { nodes, nebulae } = settled;

  // 连线绕行：等比套满是均匀缩放，弯曲度（长度比值）前后同值，故在套满前算即可
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  for (const link of links) {
    const from = nodeById.get(link.source);
    const to = nodeById.get(link.target);
    if (!from || !to) continue;
    link.curveness = pickCurveness(
      from,
      to,
      nodes.filter((n) => n.id !== link.source && n.id !== link.target),
    );
  }

  const fit = fitToCanvas(nodes, nebulae, width, height);

  return {
    width,
    height,
    trackOrder: ordered.map((p) => p.track),
    tiers: tierValues,
    nebulae,
    nodes,
    links,
    scale: fit.scale,
    chartMarginX: fit.marginX,
    chartMarginY: fit.marginY,
  };
}

/** 列中心：核心列 x=0，其余按「右、左、右、左」交替排开（游标＝已排内容边界＋列间隙） */
function columnCenters(ordered: ColumnPlan[]): Map<string, number> {
  const centerX = new Map<string, number>();
  const coreHalf = columnBoxWidth(ordered[0]) / 2 + COL_GAP;
  let right = coreHalf;
  let left = -coreHalf;
  ordered.forEach((plan, i) => {
    if (i === 0) {
      centerX.set(plan.track, 0);
      return;
    }
    const half = columnBoxWidth(plan) / 2;
    if (i % 2 === 1) {
      centerX.set(plan.track, round(right + half));
      right += half * 2 + COL_GAP;
    } else {
      centerX.set(plan.track, round(left - half));
      left -= half * 2 + COL_GAP;
    }
  });
  return centerX;
}

/** 行内序用的重心：每门课取其全部先修者横坐标的均值（无先修者不入表，排序时落到末尾） */
function parentBarycenter(pairs: { from: string; to: string }[], nodes: StarNode[]): Map<string, number> {
  const xOf = new Map(nodes.map((n) => [n.id, n.x]));
  const sums = new Map<string, { sum: number; count: number }>();
  for (const { from, to } of pairs) {
    const x = xOf.get(from);
    if (x === undefined) continue;
    const acc = sums.get(to) ?? { sum: 0, count: 0 };
    acc.sum += x;
    acc.count += 1;
    sums.set(to, acc);
  }
  return new Map([...sums].map(([id, { sum, count }]) => [id, sum / count]));
}

/** 按列中心与行序落位：课程框 + 竖长列框（名称带留在顶部，上沿比最上排成员再多让出一行） */
function placeColumns(
  ordered: ColumnPlan[],
  rowIndex: Map<number, number>,
  centerX: Map<string, number>,
  depths: Map<string, number>,
): { nodes: StarNode[]; nebulae: NebulaNode[] } {
  const nodes: StarNode[] = [];
  const nebulae: NebulaNode[] = [];
  ordered.forEach((plan, index) => {
    const cx = centerX.get(plan.track) ?? 0;
    let top = Infinity;
    let bottom = -Infinity;
    for (const slot of plan.slots) {
      const y = (rowIndex.get(slot.tier) ?? 0) * ROW_H;
      nodes.push({
        id: slot.course.course_id,
        name: slot.course.name,
        track: plan.track,
        x: round(cx + slot.dx),
        y,
        w: slot.w,
        h: slot.h,
        tier: slot.tier,
        depth: depths.get(slot.course.course_id) ?? 0,
        kpConfirmed: slot.course.kp_confirmed,
        kpCandidates: slot.course.kp_candidates,
      });
      top = Math.min(top, y - slot.h / 2);
      bottom = Math.max(bottom, y + slot.h / 2);
    }
    const boxTop = top - NEBULA_PAD - NEBULA_TITLE_H;
    const boxBottom = bottom + NEBULA_PAD;
    nebulae.push({
      id: nebulaId(plan.track),
      name: plan.track,
      x: cx,
      y: round((boxTop + boxBottom) / 2),
      w: round(columnBoxWidth(plan)),
      h: round(boxBottom - boxTop),
      kind: plan.kind,
      summary: plan.summary,
      count: plan.slots.length,
      core: index === 0,
    });
  });
  return { nodes, nebulae };
}

/**
 * 预乘渲染系数：ECharts graph（layout:'none'）会等比把「成员点包围盒」铺满 series 矩形，
 * 但符号尺寸（课程框 / 列框宽高）按 px 原样绘制。这里先把系数乘到坐标与框尺寸上，并回传
 * 与之匹配的 series 四边留白，使渲染系数恰为 1。
 * 系数另按「列框相对成员点包围盒中心的最远伸出」封顶，保证虚线列框整体不出画布。
 */
function fitToCanvas(
  nodes: StarNode[],
  nebulae: NebulaNode[],
  width: number,
  height: number,
): { scale: number; marginX: number; marginY: number } {
  const span = (xs: number[]) => (xs.length > 1 ? Math.max(...xs) - Math.min(...xs) : 0);
  const spreadX = span(nodes.map((n) => n.x));
  const spreadY = span(nodes.map((n) => n.y));
  // 成员点包围盒中心搬回原点：缩放与后续「包围盒居中」等价，列框才不会被整体偏心推走
  const originX = (Math.max(...nodes.map((n) => n.x)) + Math.min(...nodes.map((n) => n.x))) / 2;
  const originY = (Math.max(...nodes.map((n) => n.y)) + Math.min(...nodes.map((n) => n.y))) / 2;
  const extentX = Math.max(...nebulae.map((n) => Math.abs(n.x - originX) + n.w / 2));
  const extentY = Math.max(...nebulae.map((n) => Math.abs(n.y - originY) + n.h / 2));
  // 单维退化（同排／同列）时该维不参与套满，否则系数会被推到病态大
  const ratios = [
    spreadX > 1 ? (width - 2 * VIEW_MARGIN) / spreadX : Infinity,
    spreadY > 1 ? (height - 2 * VIEW_MARGIN) / spreadY : Infinity,
    extentX > 1 ? (width / 2) * 0.99 / extentX : Infinity,
    extentY > 1 ? (height / 2) * 0.99 / extentY : Infinity,
  ];
  let scale = Math.min(...ratios);
  if (!isFinite(scale)) scale = 1;
  // 先定标再套用：导出的 scale 与坐标/框尺寸严格同源（行距恰＝ROW_H × scale）
  scale = round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)));
  for (const node of nodes) {
    node.x = round((node.x - originX) * scale);
    node.y = round((node.y - originY) * scale);
    node.w = round(node.w * scale);
    node.h = round(node.h * scale);
  }
  for (const nebula of nebulae) {
    nebula.x = round((nebula.x - originX) * scale);
    nebula.y = round((nebula.y - originY) * scale);
    nebula.w = round(nebula.w * scale);
    nebula.h = round(nebula.h * scale);
  }
  // 包围盒中心搬到画布中心；留白＝画布减去缩放后的点跨度之半 → series 矩形＝点包围盒 → 渲染系数 1
  for (const node of nodes) {
    node.x = round(node.x + width / 2);
    node.y = round(node.y + height / 2);
  }
  for (const nebula of nebulae) {
    nebula.x = round(nebula.x + width / 2);
    nebula.y = round(nebula.y + height / 2);
  }
  // 单维退化时留白封顶，避免矩形塌成 0（该维由 ECharts 视作无限比，不影响系数）
  const marginOf = (size: number, fitted: number) =>
    Math.max(4, Math.min(round((size - fitted) / 2), Math.round(size / 2) - 60));
  return {
    scale: round(scale),
    marginX: marginOf(width, span(nodes.map((n) => n.x))),
    marginY: marginOf(height, span(nodes.map((n) => n.y))),
  };
}
