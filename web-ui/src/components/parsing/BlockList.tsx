/**
 * 解析文档块渲染（parsing-ui §8/§9.1 BlockList）：
 * - 流式：按块顺序排版（可读性优先，BlockView 渲染逻辑迁移）
 * - 版式=**重排版**（§9.1）：块按阅读序流入 A4 单栏纸面，高度不限、文字完整展示；
 *   字号阶梯（五号～一号）+ 标题级差推导 + 字体角色 + 目录启发式，纯函数在 typography.ts
 * - 选中/hover 与左图 PageImagePane 双向联动；内容口径下选中块弹 BlockEditor（只改内容）
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Popover, Tag, Typography } from 'antd';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { Block, BlockEdit, BlockEditInput } from '../../api/axiom';
import { editKey } from '../../stores/parsing';
import { blockText, confirmInput, hasBbox, renderInlineMath, tryRenderKatex, TYPE_LABELS, unwrapMathDelimiters } from './blocks';
import { assignRoles, layoutUnits, roleTypography, symbolLineParts, tocItemParts, type TypographyPrefs } from './typography';
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
  /** 版式偏好（§9.1；仅版式模式消费，流式不受影响） */
  typography: TypographyPrefs;
  /** 整页页图地址（8900 代理）：image 块按 bbox 内联裁切用（判据 S1 图片面）；null＝只出题注 */
  pageImageUrl?: string | null;
  selectedIndex: number;
  editMode: boolean;
  submitting?: boolean;
  onSelect: (index: number) => void;
  onHover?: (index: number) => void;
  onSubmit: (blockIndex: number, input: BlockEditInput) => Promise<boolean>;
}

/**
 * 块图＝整页页图按 bbox 内联裁切（判据 S1 图片面，用户裁决 2026-10-09）：
 * 8900/8902 只暴露页图端点（块图 path 无 HTTP 路由），故用页图 + 百分比裁切，不改子项目。
 * 裁切比例在页图 onLoad 量得自然尺寸后换算（未量出前先出整页预览占位）。
 */
function ImageCrop({ src, bbox }: { src: string; bbox: [number, number, number, number] }) {
  const [x0, y0, x1, y1] = bbox;
  const [page, setPage] = useState<{ w: number; h: number } | null>(null);
  const bw = x1 - x0;
  const bh = y1 - y0;
  const boxStyle: React.CSSProperties = {
    position: 'relative',
    display: 'block',
    width: '100%',
    overflow: 'hidden',
    border: '1px solid #f0f0f0',
    borderRadius: 4,
  };
  if (page && bw > 0 && bh > 0) {
    boxStyle.aspectRatio = `${bw / bh}`;
  }
  const imgStyle: React.CSSProperties = page && bw > 0 && bh > 0
    ? {
        position: 'absolute',
        maxWidth: 'none',
        width: `${(page.w / bw) * 100}%`,
        height: `${(page.h / bh) * 100}%`,
        left: `${(-x0 / bw) * 100}%`,
        top: `${(-y0 / bh) * 100}%`,
      }
    : { width: '100%', opacity: 0.35 };
  return (
    <span data-testid="block-image-crop" style={boxStyle}>
      <img
        src={src}
        alt="块图（页图裁切）"
        loading="lazy"
        style={imgStyle}
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth > 0) setPage({ w: img.naturalWidth, h: img.naturalHeight });
        }}
      />
    </span>
  );
}

/** 块内容节点（流式/版式共用；formula=KaTeX、table=HTML、heading=级别标签、image=页图裁切） */
function blockBody(block: Block, fontSizePx?: number, pageImageUrl?: string | null): React.ReactNode {
  const content = blockText(block);
  if (block.type === 'image' && pageImageUrl && hasBbox(block)) {
    return <ImageCrop src={pageImageUrl} bbox={block.bbox as [number, number, number, number]} />;
  }
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
    <span style={{ fontSize: fontSizePx, whiteSpace: 'pre-wrap' }}>
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

/** 目录条目行（§9.1）：标题 + 点线引导 + 页码右对齐 */
function TocRows({ block }: { block: Block }) {
  const raw = block.type === 'list' ? (block.items ?? []) : blockText(block).split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingInlineStart: '1em' }}>
      {raw.map((line, i) => {
        const { title, page } = tocItemParts(line);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span>{title}</span>
            {page !== '' && (
              <>
                <span style={{ flex: 1, minWidth: 24, borderBottom: '1px dotted #999', transform: 'translateY(-0.25em)' }} />
                <span data-toc-page={page} style={{ textAlign: 'right' }}>{page}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 符号表三列行（§9.1）：符号列自适应 / 说明列左对齐 / 页码列右对齐；未命中行整行进说明列 */
function SymbolRows({ block }: { block: Block }) {
  const lines = (block.type === 'list' ? (block.items ?? []) : blockText(block).split('\n'))
    .filter((l) => l.trim() !== '');
  return (
    <div data-testid="symbol-table" style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingInlineStart: '1em' }}>
      {lines.map((line, i) => {
        const parts = symbolLineParts(line);
        return (
          <div key={i} data-testid="symbol-row" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', columnGap: 12, alignItems: 'baseline' }}>
            <span data-symbol-col style={{ whiteSpace: 'pre' }}>{parts?.symbol ?? ''}</span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{parts ? parts.desc : line.trim()}</span>
            <span data-symbol-page style={{ textAlign: 'right', whiteSpace: 'pre' }}>{parts?.page ?? ''}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function BlockList(props: BlockListProps) {
  const {
    bookId, pageNo, blocks, edits, renderMode, typography, pageImageUrl,
    selectedIndex, editMode, submitting, onSelect, onHover, onSubmit,
  } = props;

  const refs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    // jsdom 无 scrollIntoView（真实浏览器选中块滚动到可视区）
    refs.current[selectedIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIndex]);

  const keys = useMemo(() => blocks.map((_, i) => editKey(bookId, pageNo, i)), [blocks, bookId, pageNo]);

  /** 单块「确认」= 落 verdict=ok（§4.6 解析修正）；已判定一致的块不再出钮 */
  const confirmBtn = (idx: number, edit?: BlockEdit) => (
    editMode && edit?.verdict !== 'ok' ? (
      <Button
        size="small"
        type="link"
        aria-label={`确认块 ${idx + 1}`}
        onClick={(e) => {
          e.stopPropagation();
          void onSubmit(idx, confirmInput(edit));
        }}
      >
        确认
      </Button>
    ) : null
  );

  /** 编辑模式 + 选中 → 弹 BlockEditor（流式/版式两分支共用；外层 div 承载 key） */
  const withEditor = (idx: number, el: React.ReactElement) => {
    const b = blocks[idx];
    if (!(editMode && idx === selectedIndex) || !b) return el;
    return (
      <div key={`ed-${idx}`}>
        <Popover
          content={<BlockEditor block={b} edit={edits[keys[idx]]} submitting={submitting} onSubmit={(input) => onSubmit(idx, input)} />}
          trigger="click"
          open
          onOpenChange={(open) => { if (!open) onSelect(-1); }}
        >
          {el}
        </Popover>
      </div>
    );
  };

  if (renderMode === 'layout') {
    // 排版单元序列（§V2.4.1~3）：层级左偏移随最近上级标题定档、跨页断句合并、标题重印去重
    const units = layoutUnits(blocks, assignRoles(blocks));
    return (
      <div data-testid="layout-flow" style={{ color: '#222' }}>
        {units.map((unit) => {
          const b = unit.block;
          const idx = unit.indices[0];
          const role = unit.role;
          if (role === 'furniture' && !typography.showFurniture) return null;
          // 空文本块（解析侧取字丢失等）不渲染，避免版式面出空行
          if (b.type !== 'image' && blockText(b).trim() === '') return null;
          const st = roleTypography(role, b, typography);
          const selected = idx === selectedIndex;
          const boxStyle: React.CSSProperties = {
            fontSize: st.fontSizePx,
            fontFamily: st.fontFamily,
            fontWeight: st.fontWeight,
            lineHeight: 1.6,
            padding: '4px 8px',
            marginLeft: unit.indentPx,
            borderRadius: 4,
            border: `1px solid ${selected ? '#1677ff' : 'transparent'}`,
            background: selected ? '#e6f4ff' : 'transparent',
            cursor: 'pointer',
            marginTop: role === 'heading' ? '0.8em' : 0,
            marginBottom: role === 'heading' ? '0.3em' : '0.2em',
            wordBreak: 'break-word',
            textAlign: role === 'furniture' ? 'center' : 'left',
          };
          return withEditor(idx, (
            <div
              key={idx}
              ref={(el) => { refs.current[idx] = el; }}
              role="button"
              data-block-role={role}
              aria-label={`块 ${idx + 1}（${TYPE_LABELS[b.type] ?? b.type}）`}
              style={boxStyle}
              onClick={() => onSelect(selected ? -1 : idx)}
              onMouseEnter={() => onHover?.(idx)}
              onMouseLeave={() => onHover?.(-1)}
            >
              {role === 'toc' ? <TocRows block={b} />
                : role === 'symbolTable' ? <SymbolRows block={b} />
                : blockBody(b, st.fontSizePx, pageImageUrl)}
              {confirmBtn(idx, edits[keys[idx]])}
            </div>
          ));
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
              {confirmBtn(idx, edit)}
            </div>
            {blockBody(b, undefined, pageImageUrl)}
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
