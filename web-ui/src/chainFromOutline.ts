/**
 * 章节目录（outline）→ 学习链路草稿树纯函数（M1 裁决 D2：块绑真实解析产物页窗）
 * 规格正本：docs/history/plans/2026-10/2026-09-23-learning-ui-rendering.md「UI-2~UI-4 实施方案」
 * 消费面：#/learn/c/{courseId} 链路模式「从目录生成链路」→ PUT /learn/courses/{id}/syllabus
 */
import type { OutlineRow } from './api/learn';

export type UnitBlockType = 'text' | 'formula' | 'figure' | 'quiz' | 'flashcard';

export interface ChainSourceRef {
  ref_id: string;
  page_start: number;
  page_end: number;
}

export interface ChainNode {
  title: string;
  type?: UnitBlockType;
  source_ref?: ChainSourceRef | null;
  confirmed?: boolean;
  children?: ChainNode[];
}

/** outline 行的 source_ref → 块页窗（缺任一端或区间非法＝不绑页窗，块走骨架占位文本） */
export function pageWindowOf(node: OutlineRow, bookRef: string): ChainSourceRef | null {
  const ref = node.source_ref ?? null;
  const start = ref?.page_start;
  const end = ref?.page_end;
  const id = ref?.ref_id ? String(ref.ref_id) : bookRef;
  if (typeof start !== 'number' || typeof end !== 'number' || start < 1 || end < start || !id) return null;
  return { ref_id: id, page_start: start, page_end: end };
}

/** 两级 outline（章→节）→ 单元树草稿（section→unit）；章下无节则整章出一个正文块 */
export function chainFromOutline(outline: OutlineRow[], bookRef: string): ChainNode[] {
  const chapters = outline.filter((node) => !node.parent_kp_id);
  const sectionsOf = (kpId: string) => outline.filter((node) => node.parent_kp_id === kpId);
  return chapters.map((chapter) => {
    const sections = sectionsOf(chapter.kp_id);
    if (sections.length === 0) {
      return {
        title: chapter.name,
        confirmed: false,
        children: [{
          title: '本章正文',
          type: 'text' as UnitBlockType,
          confirmed: false,
          source_ref: pageWindowOf(chapter, bookRef),
        }],
      };
    }
    return {
      title: chapter.name,
      confirmed: false,
      children: sections.map((section) => ({
        title: section.name,
        type: 'text' as UnitBlockType,
        confirmed: false,
        source_ref: pageWindowOf(section, bookRef),
      })),
    };
  });
}

/** 相邻/重叠页窗合并（保持升序） */
export function mergePageWindows(raw: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> | null {
  if (raw.length === 0) return null;
  const sorted = [...raw].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const window of sorted) {
    const last = merged[merged.length - 1];
    if (last && window.start <= last.end + 1) last.end = Math.max(last.end, window.end);
    else merged.push({ ...window });
  }
  return merged;
}

/** 链路全部块页窗＝propose 的页窗输入（无页窗＝null） */
export function pageWindowsOf(nodes: ChainNode[]): Array<{ start: number; end: number }> | null {
  const windows: Array<{ start: number; end: number }> = [];
  const walk = (list: ChainNode[]) => {
    for (const node of list) {
      if (node.source_ref) {
        windows.push({ start: node.source_ref.page_start, end: node.source_ref.page_end });
      }
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return mergePageWindows(windows);
}
