import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Typography } from 'antd';

const { Text } = Typography;

/** KaTeX 渲染（失败返回 null，调用方降级原样文本） */
function tryRenderKatex(latex: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false });
  } catch {
    return null;
  }
}

/** 行内公式：$...$ → KaTeX；返回 HTML 片段 */
function renderInlineMath(text: string): string {
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

interface MarkdownSegment {
  kind: 'heading' | 'formula' | 'paragraph';
  level?: number;
  text: string;
}

/** 分段：公式块 $$...$$（同行或跨行）优先；其余按标题/段落 */
function segmentMarkdown(md: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  const lines = md.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 同行公式块：$$...$$
    const inlineBlock = line.match(/^\$\$(.*)\$\$$/);
    if (inlineBlock && inlineBlock[1].trim()) {
      segments.push({ kind: 'formula', text: inlineBlock[1].trim() });
      i += 1;
      continue;
    }
    // 跨行公式块：以 $$ 开头，收集到下一个 $$（含同行闭）
    if (line.trim().startsWith('$$')) {
      const buf: string[] = [];
      let closed = false;
      const head = line.trim().slice(2).trim();
      if (head) buf.push(head);
      i += 1;
      while (i < lines.length) {
        const cur = lines[i];
        const closeIdx = cur.indexOf('$$');
        if (closeIdx >= 0) {
          const rest = cur.slice(closeIdx + 2).trim();
          if (cur.slice(0, closeIdx).trim()) buf.push(cur.slice(0, closeIdx).trim());
          if (rest) buf.push(rest);
          closed = true;
          i += 1;
          break;
        }
        buf.push(cur);
        i += 1;
      }
      segments.push({ kind: 'formula', text: buf.join('\n').trim() || (closed ? '' : line.trim()) });
      continue;
    }
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      segments.push({ kind: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
      i += 1;
      continue;
    }
    // 多行段落（空行分隔）
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].match(/^\$\$/) && !lines[i].match(/^#{1,4}\s/)) {
      buf.push(lines[i]);
      i += 1;
    }
    if (buf.length) segments.push({ kind: 'paragraph', text: buf.join(' ') });
    else i += 1;
  }
  return segments;
}

/**
 * Markdown 视图（原始文档对照用）：标题 / 段落 / 公式块（KaTeX）
 * - 公式解析失败 → 原样 LaTeX 文本（不崩，联调可发现问题页）
 */
export default function MarkdownView({ markdown }: { markdown: string }) {
  const segments = useMemo(() => segmentMarkdown(markdown ?? ''), [markdown]);

  return (
    <div className="md-view">
      {segments.map((seg, idx) => {
        if (seg.kind === 'heading') {
          const Tag = `h${seg.level ?? 3}` as 'h1' | 'h2' | 'h3' | 'h4';
          return <Tag key={idx} style={{ margin: '8px 0 4px' }}>{seg.text}</Tag>;
        }
        if (seg.kind === 'formula') {
          const html = tryRenderKatex(seg.text, true);
          return (
            <div key={idx} style={{ margin: '8px 0', overflowX: 'auto' }}>
              {html ? (
                <span dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <Text code style={{ whiteSpace: 'pre-wrap' }}>{`$$${seg.text}$$`}</Text>
              )}
            </div>
          );
        }
        return (
          <p key={idx} style={{ margin: '6px 0', lineHeight: 1.7 }}>
            <span dangerouslySetInnerHTML={{ __html: renderInlineMath(seg.text) }} />
          </p>
        );
      })}
    </div>
  );
}