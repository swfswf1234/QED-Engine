/**
 * 框图几何纯函数（parsing-ui §10，REQ-098 框编辑工作台）：
 * 夹紧/8 手柄拉伸/整体拖移/并集/阅读序/文本拼接/client→原图像素换算。
 * 坐标系=原页图像素 [x0,y0,x1,y1]（左上原点）；最小尺寸 8px 防退化。
 */

export type BBox = [number, number, number, number];
export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export interface Bounds { w: number; h: number }
export interface ClientRectLike { left: number; top: number; width: number; height: number }

export const HANDLES: readonly HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export const MIN_BOX = 8;

/** 坐标取整到 2 位小数（消除 client→natural 换算浮点尾差，落库值干净） */
const r2 = (v: number): number => Math.round(v * 100) / 100;

/** 归一（x0<x1、y0<y1）→ 夹紧到图内 → 最小尺寸（先扩右下，贴界则回推左上） */
export function clampBbox(bbox: BBox, bounds: Bounds, minSize = MIN_BOX): BBox {
  let [x0, y0, x1, y1] = bbox.map(r2) as BBox;
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 < y0) [y0, y1] = [y1, y0];
  const cx = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  x0 = cx(x0, bounds.w); x1 = cx(x1, bounds.w);
  y0 = cx(y0, bounds.h); y1 = cx(y1, bounds.h);
  if (x1 - x0 < minSize) {
    x1 = Math.min(bounds.w, Math.max(x1, x0 + minSize));
    x0 = Math.max(0, x1 - minSize);
  }
  if (y1 - y0 < minSize) {
    y1 = Math.min(bounds.h, Math.max(y1, y0 + minSize));
    y0 = Math.max(0, y1 - minSize);
  }
  return [x0, y0, x1, y1];
}

/**
 * 8 手柄拉伸：手柄名即移动边/角（n 带上边、e 带右边…），对边锚定。
 * 拉过对边时按锚边保持最小尺寸（w/n 系锚定 x1/y1，e/s 系锚定 x0/y0）。
 */
export function applyResize(bbox: BBox, handle: HandleId, dx: number, dy: number, bounds: Bounds, minSize = MIN_BOX): BBox {
  let [x0, y0, x1, y1] = bbox;
  if (handle.includes('w')) x0 += dx;
  if (handle.includes('e')) x1 += dx;
  if (handle.includes('n')) y0 += dy;
  if (handle.includes('s')) y1 += dy;
  if (x1 - x0 < minSize) {
    if (handle.includes('w')) x0 = x1 - minSize;
    else x1 = x0 + minSize;
  }
  if (y1 - y0 < minSize) {
    if (handle.includes('n')) y0 = y1 - minSize;
    else y1 = y0 + minSize;
  }
  return clampBbox([x0, y0, x1, y1], bounds, minSize);
}

/** 整体拖移：尺寸恒定，越界沿轴回推 */
export function moveBbox(bbox: BBox, dx: number, dy: number, bounds: Bounds): BBox {
  const [x0o, y0o, x1o, y1o] = bbox;
  const w = x1o - x0o;
  const h = y1o - y0o;
  let x0 = x0o + dx;
  let y0 = y0o + dy;
  if (x0 + w > bounds.w) x0 = bounds.w - w;
  if (x0 < 0) x0 = 0;
  if (y0 + h > bounds.h) y0 = bounds.h - h;
  if (y0 < 0) y0 = 0;
  return [r2(x0), r2(y0), r2(x0 + w), r2(y0 + h)];
}

export function bboxUnion(a: BBox, b: BBox): BBox {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

/** 阅读序：y0 主序、x0 次序，返回 index 序列 */
export function sortByReadingOrder(entries: { index: number; bbox: BBox }[]): number[] {
  return [...entries]
    .sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0])
    .map((e) => e.index);
}

/** 合并文本拼接：去空、逐块剥尾部换行后按行连接 */
export function mergeTexts(texts: string[]): string {
  return texts.map((t) => (t ?? '').replace(/\s+$/, '')).filter((t) => t !== '').join('\n');
}

export function pointInBbox(x: number, y: number, bbox: BBox): boolean {
  return x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3];
}

/** 页图 client 坐标 → 原图像素坐标（rect=渲染后 img 容器，natural=自然尺寸） */
export function clientToNaturalPx(
  clientX: number,
  clientY: number,
  rect: ClientRectLike,
  natural: Bounds,
): { x: number; y: number } {
  return {
    x: ((clientX - rect.left) / rect.width) * natural.w,
    y: ((clientY - rect.top) / rect.height) * natural.h,
  };
}
