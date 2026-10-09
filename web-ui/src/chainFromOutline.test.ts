import { describe, expect, it } from 'vitest';
import { chainFromOutline, pageWindowOf, pageWindowsOf } from './chainFromOutline';
import type { OutlineRow } from './api/learn';

function row(kpId: string, name: string, opts: Partial<OutlineRow> = {}): OutlineRow {
  return {
    kp_id: kpId,
    name,
    source_ref: null,
    parent_kp_id: null,
    ...opts,
  } as OutlineRow;
}

describe('chainFromOutline', () => {
  it('章→节 两级映射为 section→unit，节块带页窗', () => {
    const outline = [
      row('kp-1', '第1章 极限', { source_ref: { ref_id: 'b05', page_start: 21, page_end: 40 } }),
      row('kp-2', '1.1 数列', {
        parent_kp_id: 'kp-1',
        source_ref: { ref_id: 'b05', page_start: 21, page_end: 28 },
      }),
      row('kp-3', '1.2 函数', {
        parent_kp_id: 'kp-1',
        source_ref: { ref_id: 'b05', page_start: 29, page_end: 40 },
      }),
    ];
    const tree = chainFromOutline(outline, 'b05');
    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe('第1章 极限');
    expect(tree[0].source_ref).toBeUndefined();
    expect(tree[0].children?.map((c) => c.title)).toEqual(['1.1 数列', '1.2 函数']);
    expect(tree[0].children?.[0].source_ref).toEqual({ ref_id: 'b05', page_start: 21, page_end: 28 });
    expect(tree[0].children?.every((c) => c.type === 'text' && c.confirmed === false)).toBe(true);
  });

  it('章下无节时整章出一个正文块，页窗取章自身范围', () => {
    const tree = chainFromOutline(
      [row('kp-1', '第2章', { source_ref: { ref_id: 'b05', page_start: 41, page_end: 56 } })],
      'b05',
    );
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children?.[0].title).toBe('本章正文');
    expect(tree[0].children?.[0].source_ref).toEqual({ ref_id: 'b05', page_start: 41, page_end: 56 });
  });

  it('缺页窗的节不绑页窗（块走骨架占位文本，前端给明确标记）', () => {
    const outline = [
      row('kp-1', '第3章'),
      row('kp-2', '3.1 没有页范围', { parent_kp_id: 'kp-1' }),
      row('kp-3', '3.2 区间非法', { parent_kp_id: 'kp-1', source_ref: { page_start: 9, page_end: 3 } }),
      row('kp-4', '3.3 缺止页', { parent_kp_id: 'kp-1', source_ref: { page_start: 9 } }),
    ];
    const tree = chainFromOutline(outline, 'b05');
    expect(tree[0].children?.map((c) => c.source_ref)).toEqual([null, null, null]);
    expect(pageWindowsOf(tree)).toBeNull();
  });

  it('pageWindowOf 只在两端齐备且区间合法时产出，ref_id 缺失回退选书', () => {
    expect(pageWindowOf(row('k', 'x', { source_ref: { page_start: 5, page_end: 5 } }), 'b07'))
      .toEqual({ ref_id: 'b07', page_start: 5, page_end: 5 });
    expect(pageWindowOf(row('k', 'x', { source_ref: { page_start: 0, page_end: 5 } }), 'b07')).toBeNull();
    expect(pageWindowOf(row('k', 'x'), 'b07')).toBeNull();
  });

  it('pageWindowsOf 只收块页窗并合并相邻/重叠区间，供 propose 输入', () => {
    const tree = chainFromOutline([
      row('kp-1', '第一章', { source_ref: { ref_id: 'b05', page_start: 20, page_end: 30 } }),
      row('kp-2', '1.1', { parent_kp_id: 'kp-1', source_ref: { ref_id: 'b05', page_start: 25, page_end: 28 } }),
      row('kp-3', '1.2', { parent_kp_id: 'kp-1', source_ref: { ref_id: 'b05', page_start: 29, page_end: 33 } }),
      row('kp-4', '第二章', { source_ref: { ref_id: 'b05', page_start: 60, page_end: 70 } }),
      row('kp-5', '2.1', { parent_kp_id: 'kp-4', source_ref: { ref_id: 'b05', page_start: 60, page_end: 70 } }),
    ], 'b05');
    // 章行不绑页窗（正文由节块覆盖），节块 25–28 与 29–33 相邻合并
    expect(pageWindowsOf(tree)).toEqual([{ start: 25, end: 33 }, { start: 60, end: 70 }]);
  });
});
