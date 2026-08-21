import { useMemo } from 'react';
import { Button, Popover, Space, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { Block, BlockReview } from '../api/axiom';

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

const TYPE_LABELS: Record<string, string> = {
  heading: '标题', paragraph: '段落', formula: '公式', table: '表格', image: '图片',
  list: '列表', caption: '图注', header: '页眉', footer: '页脚', page_number: '页码',
};

function blockText(block: Block): string {
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

interface BlockViewProps {
  blocks: Block[];
  /** 选中块下标（-1 无选中） */
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** 判定提交（verdict: ok 一致 / bad 不一致） */
  onSubmit: (index: number, verdict: 'ok' | 'bad', note?: string) => void;
  /** 已有判定（key 由调用方以 book:page:index 传入） */
  reviews: Record<string, BlockReview>;
  reviewKey: (index: number) => string;
  submitting?: boolean;
}

/**
 * 块级渲染视图（文档解析管理对照右侧）：逐块渲染段落/公式（KaTeX）/表格/列表…
 * 块可点击选中，选中后弹判定操作（一致/不一致 + 备注）。
 */
export default function BlockView({ blocks, selectedIndex, onSelect, onSubmit, reviews, reviewKey, submitting }: BlockViewProps) {
  const items = useMemo(
    () => blocks.map((b, idx) => ({ block: b, idx })),
    [blocks],
  );

  if (blocks.length === 0) {
    return <Text type="secondary">暂无结构化块（该页可能未解析或产物为空）</Text>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(({ block, idx }) => {
        const selected = idx === selectedIndex;
        const review = reviews[reviewKey(idx)];
        const isFormula = block.type === 'formula';
        const isTable = block.type === 'table';
        const isHeading = block.type === 'heading';
        const content = blockText(block);

        const boxStyle: React.CSSProperties = {
          padding: '6px 10px',
          borderRadius: 6,
          border: `1px solid ${selected ? '#1677ff' : '#eee'}`,
          background: selected ? '#e6f4ff' : '#fff',
          cursor: 'pointer',
          transition: 'border-color .2s, background .2s',
          lineHeight: 1.7,
        };

        const actions = (
          <Space direction="vertical" size={4}>
            <Space size={4}>
              <Button size="small" type="primary" icon={<CheckOutlined />} loading={submitting} onClick={() => onSubmit(idx, 'ok')}>
                一致
              </Button>
              <Button size="small" danger icon={<CloseOutlined />} loading={submitting} onClick={() => onSubmit(idx, 'bad')}>
                不一致
              </Button>
            </Space>
            {review && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                已判定：{review.verdict === 'ok' ? '一致' : '不一致'}{review.note ? `（${review.note}）` : ''}
              </Text>
            )}
          </Space>
        );

        let body: React.ReactNode;
        if (isFormula) {
          const html = tryRenderKatex(content, true);
          body = html ? (
            <div style={{ overflowX: 'auto', textAlign: 'center', padding: '4px 0' }}>
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          ) : (
            <Text code style={{ whiteSpace: 'pre-wrap' }}>{`$$${content}$$`}</Text>
          );
        } else if (isTable) {
          body = <div style={{ overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: content }} />;
        } else if (isHeading) {
          const level = block.level ?? 3;
          const Tag = (`h${Math.min(Math.max(level, 1), 6)}`) as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
          body = <Tag style={{ margin: 0 }}>{content}</Tag>;
        } else {
          body = <div><span dangerouslySetInnerHTML={{ __html: renderInlineMath(content) }} /></div>;
        }

        const blockEl = (
          <div
            role="button"
            aria-label={`块 ${idx + 1}（${TYPE_LABELS[block.type] ?? block.type}）`}
            style={boxStyle}
            onClick={() => onSelect(idx)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isFormula || isTable ? 4 : 0 }}>
              <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                #{idx + 1} · {TYPE_LABELS[block.type] ?? block.type}
              </Text>
              {review && (
                <Tag color={review.verdict === 'ok' ? 'success' : 'error'} style={{ marginInlineEnd: 0 }}>
                  {review.verdict === 'ok' ? '一致' : '不一致'}
                </Tag>
              )}
            </div>
            {body}
          </div>
        );

        return (
          <div key={idx}>
            {selected ? (
              <Popover content={actions} trigger="click" open={selected} onOpenChange={(open) => { if (!open) onSelect(-1); }}>
                {blockEl}
              </Popover>
            ) : blockEl}
          </div>
        );
      })}
    </div>
  );
}