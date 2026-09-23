/**
 * 解析文档块渲染（parsing-ui §8 BlockList）：
 * - 流式：按块顺序排版（可读性优先，BlockView 渲染逻辑迁移）
 * - 版式：块按 bbox 绝对定位到纸面（字号取 bbox 高度），还原接近原页便于逐块判定
 * - 选中/hover 与左图 PageImagePane 双向联动；编辑模式下选中块弹 BlockEditor
 */
import { Fragment, useEffect, useMemo, useRef } from 'react';
import { Popover, Tag, Typography } from 'antd';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { Block, BlockEdit, BlockEditInput } from '../../api/axiom';
import { editKey } from '../../stores/parsing';
import { blockColor, blockText, effectiveBbox, hasBbox, renderInlineMath, tryRenderKatex, TYPE_LABELS, unwrapMathDelimiters } from './blocks';
import BlockEditor from './BlockEditor';

const { Text } = Typography;

export type RenderMode = 'stream' | 'layout';

export interface BlockListProps {
  bookId: string;
  pageNo: number;
  blocks: Block[];
  edits: Record<string, BlockEdit>;
  renderMode: RenderMode;
  /** 页图自然尺寸（版式模式坐标换算；null=尺寸未知，回退 A4@96dpi） */
  imageSize: { w: number; h: number } | null;
  selectedIndex: number;
  editMode: boolean;
  submitting?: boolean;
  onSelect: (index: number) => void;
  onHover?: (index: number) => void;
  onSubmit: (blockIndex: number, input: BlockEditInput) => Promise<boolean>;
}

/** 版式模式坐标换算：像素 bbox → 百分比（自然尺寸未知时按 A4@96dpi 近似） */
function bboxToPct(bbox: [number, number, number, number], size: { w: number; h: number } | null) {
  const w = size?.w ?? 794;
  const h = size?.h ?? 1123;
  const [x0, y0, x1, y1] = bbox;
  const pct = (v: number, total: number) => Math.max(0, Math.min(100, (v / total) * 100));
  return {
    left: `${pct(x0, w)}%`,
    top: `${pct(y0, h)}%`,
    width: `${pct(x1, w) - pct(x0, w)}%`,
    height: `${pct(y1, h) - pct(y0, h)}%`,
  };
}

/** 块内容节点（流式/版式共用；formula=KaTeX、table=HTML、heading=级别标签） */
function blockBody(block: Block, fontSizePx?: number): React.ReactNode {
  const content = blockText(block);
  if (block.type === 'formula') {
    const body = unwrapMathDelimiters(content);
    const inline = fontSizePx !== undefined;
    const html = inline
      ? tryRenderKatex(body, false)
      : katex.renderToString(body, { displayMode: true, throwOnError: false });
    return html ? (
      <span
        style={inline ? { fontSize: fontSizePx } : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    ) : (
      <Text code style={{ whiteSpace: 'pre-wrap', fontSize: fontSizePx }}>{`$$${body}$$`}</Text>
    );
  }
  if (block.type === 'table') {
    return <div style={{ overflowX: 'auto', fontSize: fontSizePx }} dangerouslySetInnerHTML={{ __html: content }} />;
  }
  if (block.type === 'heading') {
    return (
      <span style={{ fontWeight: 600, fontSize: fontSizePx ?? 15 + (block.level ?? 3) }}>
        {content}
      </span>
    );
  }
  return (
    <span style={{ fontSize: fontSizePx }}>
      <span dangerouslySetInnerHTML={{ __html: renderInlineMath(content) }} />
    </span>
  );
}

function EditTags({ edit }: { edit?: BlockEdit }) {
  if (!edit) return null;
  return (
    <>
      {edit.verdict === 'ok' && <Tag color="success" style={{ marginInlineEnd: 0 }}>一致</Tag>}
      {edit.verdict === 'bad' && <Tag color="error" style={{ marginInlineEnd: 0 }}>不一致</Tag>}
      {edit.corrected_text ? <Tag color="blue" style={{ marginInlineEnd: 0 }}>文字修正</Tag> : null}
      {edit.corrected_bbox ? <Tag color="purple" style={{ marginInlineEnd: 0 }}>范围修正</Tag> : null}
    </>
  );
}

export default function BlockList(props: BlockListProps) {
  const {
    bookId, pageNo, blocks, edits, renderMode, imageSize,
    selectedIndex, editMode, submitting, onSelect, onHover, onSubmit,
  } = props;

  const refs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    // jsdom 无 scrollIntoView（真实浏览器选中块滚动到可视区）
    refs.current[selectedIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIndex]);

  const keys = useMemo(() => blocks.map((_, i) => editKey(bookId, pageNo, i)), [blocks, bookId, pageNo]);

  /** 编辑模式 + 选中 → 弹 BlockEditor（流式/版式两分支共用） */
  const withEditor = (idx: number, el: React.ReactElement) => {
    const b = blocks[idx];
    if (!(editMode && idx === selectedIndex) || !b) return el;
    return (
      <Popover
        content={<BlockEditor block={b} edit={edits[keys[idx]]} submitting={submitting} onSubmit={(input) => onSubmit(idx, input)} />}
        trigger="click"
        open
        onOpenChange={(open) => { if (!open) onSelect(-1); }}
      >
        {el}
      </Popover>
    );
  };

  if (renderMode === 'layout') {
    return (
      <div style={{ position: 'relative', width: '100%', aspectRatio: '794 / 1123', background: '#fff' }}>
        {blocks.map((b, idx) => {
          if (!hasBbox(b)) return null;
          const bb = effectiveBbox(b);
          const pct = bboxToPct(bb, imageSize);
          const fontPx = Math.max(10, Math.min(40, ((bb[3] - bb[1]) / (imageSize?.h ?? 1123)) * 1123 / 4));
          const selected = idx === selectedIndex;
          return (
            <Fragment key={idx}>
              {withEditor(idx, (
                <div
                  ref={(el) => { refs.current[idx] = el; }}
                  role="button"
                  aria-label={`块 ${idx + 1}（${TYPE_LABELS[b.type] ?? b.type}）`}
                  style={{
                    position: 'absolute', ...pct, boxSizing: 'border-box',
                    overflow: 'hidden', padding: 2,
                    border: `1px solid ${selected ? '#1677ff' : blockColor(b.type)}`,
                    background: selected ? 'rgba(22,119,255,.08)' : 'transparent',
                    cursor: 'pointer', lineHeight: 1.2,
                  }}
                  onClick={() => onSelect(selected ? -1 : idx)}
                  onMouseEnter={() => onHover?.(idx)}
                  onMouseLeave={() => onHover?.(-1)}
                >
                  <div style={{ fontSize: fontPx }}>{blockBody(b, fontPx)}</div>
                </div>
              ))}
            </Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {blocks.map((b, idx) => {
        const selected = idx === selectedIndex;
        const edit = edits[keys[idx]];
        const boxStyle: React.CSSProperties = {
          padding: '6px 10px',
          borderRadius: 6,
          border: `1px solid ${selected ? '#1677ff' : '#eee'}`,
          background: selected ? '#e6f4ff' : '#fff',
          cursor: 'pointer',
          transition: 'border-color .2s, background .2s',
          lineHeight: 1.7,
        };
        const blockEl = (
          <div
            ref={(el) => { refs.current[idx] = el; }}
            role="button"
            aria-label={`块 ${idx + 1}（${TYPE_LABELS[b.type] ?? b.type}）`}
            style={boxStyle}
            onClick={() => onSelect(selected ? -1 : idx)}
            onMouseEnter={() => onHover?.(idx)}
            onMouseLeave={() => onHover?.(-1)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: b.type === 'formula' || b.type === 'table' ? 4 : 0 }}>
              <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                #{idx + 1} · {TYPE_LABELS[b.type] ?? b.type}
              </Text>
              {!hasBbox(b) && <Tag style={{ marginInlineEnd: 0 }}>无坐标</Tag>}
              <EditTags edit={edit} />
            </div>
            {blockBody(b)}
          </div>
        );
        return (
          <div key={idx}>
            {editMode && selected ? (
              <Popover
                content={<BlockEditor block={b} edit={edit} submitting={submitting} onSubmit={(input) => onSubmit(idx, input)} />}
                trigger="click"
                open
                onOpenChange={(open) => { if (!open) onSelect(-1); }}
              >
                {blockEl}
              </Popover>
            ) : blockEl}
          </div>
        );
      })}
    </div>
  );
}
