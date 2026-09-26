import { describe, it, expect } from 'vitest';
import {
  applyResize, bboxUnion, clampBbox, clientToNaturalPx, HANDLES, mergeTexts,
  moveBbox, pointInBbox, sortByReadingOrder,
  type BBox,
} from './regions';

const BOUNDS = { w: 800, h: 1123 };
const BOX: BBox = [100, 100, 300, 200];

describe('clampBbox（夹紧 + 最小尺寸防退化，parsing-ui §10）', () => {
  it('越界夹紧到 [0, w] / [0, h]', () => {
    expect(clampBbox([-5, 10, 100, 50], BOUNDS)).toEqual([0, 10, 100, 50]);
    expect(clampBbox([0, 0, 900, 1200], BOUNDS)).toEqual([0, 0, 800, 1123]);
  });

  it('坐标倒置先归一（保证 x0<x1、y0<y1）', () => {
    expect(clampBbox([100, 200, 50, 80], BOUNDS)).toEqual([50, 80, 100, 200]);
  });

  it('过小时从左上角向右下扩到最小 8px', () => {
    expect(clampBbox([100, 100, 104, 104], BOUNDS)).toEqual([100, 100, 108, 108]);
  });

  it('贴边过小→回推另一端，仍夹紧在界内', () => {
    expect(clampBbox([795, 1120, 797, 1121], BOUNDS)).toEqual([792, 1115, 800, 1123]);
  });
});

describe('applyResize（8 手柄拉伸：锚定对边，位移进对应轴）', () => {
  it('8 手柄齐备', () => {
    expect([...HANDLES].sort()).toEqual(['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w'].sort());
  });

  it('se：两轴同时移动', () => {
    expect(applyResize(BOX, 'se', 20, 30, BOUNDS)).toEqual([100, 100, 320, 230]);
  });

  it('n / s / e / w：单轴移动，对边锚定', () => {
    expect(applyResize(BOX, 'n', 5, 10, BOUNDS)).toEqual([100, 110, 300, 200]);
    expect(applyResize(BOX, 's', 5, 10, BOUNDS)).toEqual([100, 100, 300, 210]);
    expect(applyResize(BOX, 'e', 30, 0, BOUNDS)).toEqual([100, 100, 330, 200]);
    expect(applyResize(BOX, 'w', 30, 0, BOUNDS)).toEqual([130, 100, 300, 200]);
  });

  it('nw：左上角双轴', () => {
    expect(applyResize(BOX, 'nw', 10, -5, BOUNDS)).toEqual([110, 95, 300, 200]);
  });

  it('越界夹紧；拉过对边时保持最小尺寸', () => {
    expect(applyResize(BOX, 'e', 500, 0, BOUNDS)).toEqual([100, 100, 800, 200]);
    expect(applyResize(BOX, 'w', 250, 0, BOUNDS)).toEqual([292, 100, 300, 200]);
  });
});

describe('moveBbox（框体整体拖移，尺寸不变、夹紧在界内）', () => {
  it('普通位移', () => {
    expect(moveBbox(BOX, 50, -20, BOUNDS)).toEqual([150, 80, 350, 180]);
  });
  it('右越界回推：x1 贴界、x0 相应左移', () => {
    expect(moveBbox(BOX, 700, 0, BOUNDS)).toEqual([600, 100, 800, 200]);
  });
  it('上越界回推', () => {
    expect(moveBbox(BOX, 0, -150, BOUNDS)).toEqual([100, 0, 300, 100]);
  });
});

describe('bboxUnion / 阅读序 / 文本拼接（合并预览）', () => {
  it('并集', () => {
    expect(bboxUnion([10, 10, 20, 20], [0, 5, 15, 30])).toEqual([0, 5, 20, 30]);
  });

  it('阅读序：y0 主序、x0 次序', () => {
    const entries: { index: number; bbox: BBox }[] = [
      { index: 0, bbox: [100, 200, 200, 260] },
      { index: 1, bbox: [20, 50, 90, 80] },
      { index: 2, bbox: [30, 210, 90, 250] },
      { index: 3, bbox: [20, 200, 90, 240] },
    ];
    expect(sortByReadingOrder(entries)).toEqual([1, 3, 0, 2]);
  });

  it('文本按阅读序拼接：跳空、换行连接', () => {
    expect(mergeTexts(['a', '', 'b\n', 'c'])).toBe('a\nb\nc');
    expect(mergeTexts([])).toBe('');
  });
});

describe('坐标换算与命中判定（页图 client → 原图像素）', () => {
  it('clientToNaturalPx 按 rect 比例换算', () => {
    const rect = { left: 25, top: 10, width: 500, height: 700 };
    const p = clientToNaturalPx(125, 80, rect, { w: 800, h: 1123 });
    expect(p.x).toBeCloseTo(160, 6);
    expect(p.y).toBeCloseTo(112.3, 6);
  });

  it('pointInBbox：闭区间命中', () => {
    expect(pointInBbox(150, 150, BOX)).toBe(true);
    expect(pointInBbox(100, 100, BOX)).toBe(true);
    expect(pointInBbox(99, 150, BOX)).toBe(false);
  });
});
