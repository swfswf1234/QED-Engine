/**
 * 原文页 + bbox 叠加（parsing-ui §8/§9 PageImagePane）：
 * - 页图 URL 直构（不依赖页数据请求成功）；自然尺寸回传给父级做坐标换算与字号
 * - 每块一框按类型着色；hover/选中双向联动；点击空白 → 选中最近块
 * - 拖拽改 bbox 暂缓（第一轮以 BlockEditor 数值修正替代，收尾登记设计偏差）
 */
import { useState } from 'react';
import type { Block } from '../../api/axiom';
import { bookPageImageUrl } from '../../api/axiom';
import { blockColor, effectiveBbox, hasBbox } from './blocks';

const A4_W = 794;
const A4_H = 1123;

export interface PageImagePaneProps {
  bookId: string;
  pageNo: number;
  blocks: Block[];
  /** bbox 坐标基准（自然像素）尺寸（本页无块时可省） */
  onImageSize?: (size: { w: number; h: number }) => void;
  selectedIndex: number;
  hoveredIndex: number;
  zoom: number;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
}

export default function PageImagePane({
  bookId, pageNo, blocks, onImageSize, selectedIndex, hoveredIndex, zoom, onSelect, onHover,
}: PageImagePaneProps) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const width = Math.round(A4_W * (zoom / 100));
  const height = Math.round(A4_H * (zoom / 100));
  const base = natural ?? { w: 794, h: 1123 };

  const onPaneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!natural || blocks.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * base.w;
    const y = ((e.clientY - rect.top) / rect.height) * base.h;
    let best = -1;
    let bestDist = Infinity;
    blocks.forEach((b, i) => {
      if (!hasBbox(b)) return;
      const [bx0, by0, bx1, by1] = effectiveBbox(b);
      const cx = (bx0 + bx1) / 2;
      const cy = (by0 + by1) / 2;
      const inBox = bx0 <= x && x <= bx1 && by0 <= y && y <= by1;
      const dist = inBox ? 0 : Math.hypot(cx - x, cy - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    if (best >= 0) onSelect(best === selectedIndex ? -1 : best);
  };

  return (
    <div
      data-testid={`page-image-${pageNo}`}
      onClick={onPaneClick}
      style={{ position: 'relative', width, height, background: '#fff', border: '1px solid #eee', borderRadius: 4, cursor: 'crosshair' }}
    >
      <img
        src={bookPageImageUrl(bookId, pageNo)}
        alt={`第 ${pageNo} 页原图`}
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth > 0) {
            setNatural({ w: img.naturalWidth, h: img.naturalHeight });
            onImageSize?.({ w: img.naturalWidth, h: img.naturalHeight });
          }
        }}
        style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', position: 'absolute', inset: 0 }}
      />
      {blocks.map((b, idx) => {
        if (!hasBbox(b)) return null;
        const [x0, y0, x1, y1] = effectiveBbox(b);
        const pct = (v: number, total: number) => `${Math.max(0, Math.min(100, (v / total) * 100))}%`;
        const span = (lo: number, hi: number, total: number) =>
          `${Math.max(0, Math.min(100, ((hi - lo) / total) * 100))}%`;
        const active = idx === selectedIndex || idx === hoveredIndex;
        const selected = idx === selectedIndex;
        return (
          <div
            key={idx}
            role="button"
            aria-label={`bbox ${idx + 1}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(selected ? -1 : idx);
            }}
            onMouseEnter={() => onHover(idx)}
            onMouseLeave={() => onHover(-1)}
            style={{
              position: 'absolute',
              left: pct(x0, base.w),
              top: pct(y0, base.h),
              width: span(x0, x1, base.w),
              height: span(y0, y1, base.h),
              border: `${selected ? 2 : 1}px solid ${selected ? '#1677ff' : blockColor(b.type)}`,
              background: active ? `${blockColor(b.type)}26` : `${blockColor(b.type)}0d`,
              borderRadius: 2,
              pointerEvents: 'auto',
            }}
          />
        );
      })}
    </div>
  );
}
