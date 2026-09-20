/**
 * 解析块渲染工具（ARCH-020-D 组件拆分：自 BlockView 抽离，BlockView 已退役）
 * 设计：docs/design/parsing-ui.md §3/§8——流式与版式两渲染模式共用块级渲染。
 */
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { Block } from '../../api/axiom';

/** KaTeX 渲染（失败返回 null，调用方降级原样文本） */
export function tryRenderKatex(latex: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false });
  } catch {
    return null;
  }
}

/** 行内公式：$...$ → KaTeX；返回 HTML 片段（非公式部分做 HTML 转义） */
export function renderInlineMath(text: string): string {
  return text
    .split(/(\$[^$\n]+\$)/g)
    .map((part) => {
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        const html = tryRenderKatex(part.slice(1, -1), false);
        return html ?? part;
      }
      return part
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    })
    .join('');
}

export const TYPE_LABELS: Record<string, string> = {
  heading: '标题', paragraph: '段落', formula: '公式', table: '表格', image: '图片',
  list: '列表', caption: '图注', header: '页眉', footer: '页脚', page_number: '页码',
};

/** 块的可编辑/展示文本（公式=LaTeX 源码，表格=HTML，列表=换行拼接） */
export function blockText(block: Block): string {
  switch (block.type) {
    case 'formula':
      return block.latex ?? '';
    case 'table':
      return block.html ?? '';
    case 'list':
      return (block.items ?? []).join('\n');
    default:
      return block.text ?? '';
  }
}

/** bbox 是否有效（4 元、正面积、非全零占位） */
export function hasBbox(block: Block): boolean {
  const b = block.bbox;
  return Array.isArray(b) && b.length === 4 && b[2] > b[0] && b[3] > b[1];
}

/** 生效 bbox（编辑修正优先） */
export function effectiveBbox(block: Block): [number, number, number, number] {
  return (block.corrected_bbox ?? block.bbox) as [number, number, number, number];
}

/** 块类型固定色板（bbox overlay / 版式模式边框着色，设计 §9） */
const TYPE_COLORS: Record<string, string> = {
  heading: '#722ed1', paragraph: '#1677ff', formula: '#fa8c16', table: '#13c2c2',
  image: '#52c41a', list: '#2f54eb', caption: '#eb2f96', header: '#8c8c8c',
  footer: '#8c8c8c', page_number: '#bfbfbf',
};

export function blockColor(type: string): string {
  return TYPE_COLORS[type] ?? '#1677ff';
}
