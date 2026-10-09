/**
 * 原文页 + bbox 叠加（parsing-ui §9/§10 PageImagePane）：
 * - 页图 URL 直构（不依赖页数据请求成功）；自然尺寸回传父级做坐标换算
 * - 尺寸口径（§4.6 追改：无缩放控件）：容器宽＝宿主栏宽 100%，高由 `aspect-ratio` 按自然尺寸推
 *   （未载入前按 A4 比例回退）；bbox 仍百分比定位，坐标换算走宿主 rect→原图像素
 * - 每块一框按类型着色；hover/选中双向联动；点击空白 → 选中最近块
 * - 框编辑口径（boxEdit）：8 手柄拉伸 + 框体拖移（松手经 onBoxCommit 落 corrected_bbox）、
 *   **画框模式（drawMode）**下空白拖拽画新框（onNewBox→regionDraft 本地预览）、
 *   Ctrl/Shift 多选（onMultiSelect）、**右键菜单**（修改=选中出手柄 / 删除 / 恢复，§4.6）
 * - regionDraft 预览：新框虚线（draft-added-*）、删除块淡出虚线、合并组并集框（draft-merged-*）
 */
import { useRef, useState } from 'react';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import type { Block, BlockEditInput } from '../../api/axiom';
import { bookPageImageUrl } from '../../api/axiom';
import { blockColor, effectiveBbox, hasBbox } from './blocks';
import {
  applyResize, bboxUnion, clampBbox, clientToNaturalPx, HANDLES, moveBbox, pointInBbox,
  type BBox, type Bounds, type HandleId,
} from './regions';
import type { RegionDraft } from '../../stores/parsing';

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
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
  /** 编辑口径=框图修改时开启（parsing-ui §10） */
  boxEdit?: boolean;
  /** 画框模式（§4.6「新增」开关）：仅开启时空白拖拽画新框 */
  drawMode?: boolean;
  /** 本地预览草稿（新框/删除/合并组） */
  regionDraft?: RegionDraft;
  /** 拉伸/移动提交（原图像素 bbox；父级落 submitEdit corrected_bbox） */
  onBoxCommit?: (blockIndex: number, bbox: BBox, input?: BlockEditInput) => void;
  /** 画框模式空白拖拽画新框（进 regionDraft.added，落库禁用） */
  onNewBox?: (bbox: BBox) => void;
  /** Ctrl/Shift 点框多选 */
  onMultiSelect?: (blockIndex: number) => void;
  /** 右键菜单「删除」→ 入删除草稿 */
  onDeleteRegion?: (blockIndex: number) => void;
  /** 右键菜单「恢复」→ 撤出删除草稿 */
  onRestoreRegion?: (blockIndex: number) => void;
}

// 位移判定用**屏像素**（cx/cy 为按下时 client 坐标）：页图按栏宽自适应后 1 屏 px ≠ 1 自然 px，
// 用自然像素阈值会把点击抖动误判成拖拽并落库。
type Drag =
  | { kind: 'resize'; index: number; handle: HandleId; start: BBox; sx: number; sy: number; cx: number; cy: number }
  | { kind: 'move'; index: number; start: BBox; sx: number; sy: number; cx: number; cy: number }
  | { kind: 'new'; sx: number; sy: number; cx: number; cy: number }
  | null;

const movedByClient = (e: MouseEvent, d: NonNullable<Drag>, min: number) =>
  Math.abs(e.clientX - d.cx) > min || Math.abs(e.clientY - d.cy) > min;

export default function PageImagePane({
  bookId, pageNo, blocks, onImageSize, selectedIndex, hoveredIndex, onSelect, onHover,
  boxEdit = false, drawMode = false, regionDraft, onBoxCommit, onNewBox, onMultiSelect,
  onDeleteRegion, onRestoreRegion,
}: PageImagePaneProps) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [live, setLive] = useState<BBox | null>(null); // 在途拖拽预览
  const [ctxIdx, setCtxIdx] = useState<number | null>(null); // 右键菜单打开的框
  const dragRef = useRef<Drag>(null);
  const movedRef = useRef(false);
  const base: Bounds = natural ?? { w: A4_W, h: A4_H };

  const toNatural = (clientX: number, clientY: number) => {
    const host = hostRef.current;
    if (!host) return { x: 0, y: 0 };
    return clientToNaturalPx(clientX, clientY, host.getBoundingClientRect(), base);
  };
  const hostRef = useRef<HTMLDivElement | null>(null);

  const beginWindowDrag = (onMove: (e: MouseEvent) => void, onUp: (e: MouseEvent) => void) => {
    const move = (e: MouseEvent) => onMove(e);
    const up = (e: MouseEvent) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      onUp(e);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onBoxMouseDown = (e: React.MouseEvent, idx: number) => {
    if (!boxEdit || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    movedRef.current = false;
    const start = effectiveBbox(blocks[idx]);
    const p0 = toNatural(e.clientX, e.clientY);
    dragRef.current = { kind: 'move', index: idx, start, sx: p0.x, sy: p0.y, cx: e.clientX, cy: e.clientY };
    beginWindowDrag(
      (ev) => {
        const d = dragRef.current;
        if (!d || d.kind !== 'move') return;
        const p = toNatural(ev.clientX, ev.clientY);
        const dx = p.x - d.sx;
        const dy = p.y - d.sy;
        if (movedByClient(ev, d, 3)) movedRef.current = true;
        setLive(moveBbox(d.start, dx, dy, base));
      },
      (ev) => {
        const d = dragRef.current;
        dragRef.current = null;
        if (!d || d.kind !== 'move') return;
        const p = toNatural(ev.clientX, ev.clientY);
        const nb = moveBbox(d.start, p.x - d.sx, p.y - d.sy, base);
        setLive(null);
        // 未位移 → 交给 click（单选切换/Ctrl·Shift 多选）处理，不重复触发
        if (!movedRef.current) return;
        onBoxCommit?.(d.index, nb, { corrected_bbox: nb });
      },
    );
  };

  const onHandleMouseDown = (e: React.MouseEvent, idx: number, handle: HandleId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    movedRef.current = false;
    const start = effectiveBbox(blocks[idx]);
    const p0 = toNatural(e.clientX, e.clientY);
    dragRef.current = { kind: 'resize', index: idx, handle, start, sx: p0.x, sy: p0.y, cx: e.clientX, cy: e.clientY };
    beginWindowDrag(
      (ev) => {
        const d = dragRef.current;
        if (!d || d.kind !== 'resize') return;
        const p = toNatural(ev.clientX, ev.clientY);
        const dx = p.x - d.sx;
        const dy = p.y - d.sy;
        if (movedByClient(ev, d, 3)) movedRef.current = true;
        setLive(applyResize(d.start, d.handle, dx, dy, base));
      },
      (ev) => {
        const d = dragRef.current;
        dragRef.current = null;
        if (!d || d.kind !== 'resize') return;
        const p = toNatural(ev.clientX, ev.clientY);
        const nb = applyResize(d.start, d.handle, p.x - d.sx, p.y - d.sy, base);
        setLive(null);
        if (movedRef.current) onBoxCommit?.(d.index, nb, { corrected_bbox: nb });
      },
    );
  };

  const onPaneMouseDown = (e: React.MouseEvent) => {
    if (!boxEdit || !drawMode || e.button !== 0) return;
    const p0 = toNatural(e.clientX, e.clientY);
    // 命中已有框（含草稿）的按下交给框自身处理
    const hit = blocks.some((b) => hasBbox(b) && pointInBbox(p0.x, p0.y, effectiveBbox(b)))
      || (regionDraft?.added ?? []).some((bb) => pointInBbox(p0.x, p0.y, bb));
    if (hit) return;
    movedRef.current = false;
    dragRef.current = { kind: 'new', sx: p0.x, sy: p0.y, cx: e.clientX, cy: e.clientY };
    beginWindowDrag(
      (ev) => {
        const d = dragRef.current;
        if (!d || d.kind !== 'new') return;
        const p = toNatural(ev.clientX, ev.clientY);
        movedRef.current = movedByClient(ev, d, 2);
        setLive(clampBbox([Math.min(d.sx, p.x), Math.min(d.sy, p.y), Math.max(d.sx, p.x), Math.max(d.sy, p.y)], base));
      },
      (ev) => {
        const d = dragRef.current;
        dragRef.current = null;
        if (!d || d.kind !== 'new') return;
        const p = toNatural(ev.clientX, ev.clientY);
        setLive(null);
        if (movedRef.current) {
          onNewBox?.(clampBbox(
            [Math.min(d.sx, p.x), Math.min(d.sy, p.y), Math.max(d.sx, p.x), Math.max(d.sy, p.y)],
            base,
          ));
        }
      },
    );
  };

  const pct = (v: number, total: number) => `${Math.max(0, Math.min(100, (v / total) * 100))}%`;
  const span = (lo: number, hi: number, total: number) => `${Math.max(0, Math.min(100, ((hi - lo) / total) * 100))}%`;

  const draft = regionDraft ?? { added: [], deleted: [], merged: [] };
  const unionOf = (group: number[]): BBox | null => {
    let acc: BBox | null = null;
    for (const i of group) {
      const b = blocks[i];
      if (!b || !hasBbox(b)) continue;
      acc = acc ? bboxUnion(acc, effectiveBbox(b)) : effectiveBbox(b);
    }
    return acc;
  };

  const onPaneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (movedRef.current) return; // 拖拽结束自带 click，不作为选择点击
    if (!natural || blocks.length === 0) return;
    const { x, y } = clientToNaturalPx(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), base);
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
      ref={hostRef}
      data-testid={`page-image-${pageNo}`}
      onClick={onPaneClick}
      onMouseDown={onPaneMouseDown}
      style={{ position: 'relative', width: '100%', aspectRatio: `${base.w} / ${base.h}`, background: '#fff', border: '1px solid #eee', borderRadius: 4, cursor: boxEdit && drawMode ? 'crosshair' : 'default' }}
    >
      <img
        src={bookPageImageUrl(bookId, pageNo)}
        alt={`第 ${pageNo} 页原图`}
        draggable={false}
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
        const deleted = draft.deleted.includes(idx);
        const active = idx === selectedIndex || idx === hoveredIndex;
        const selected = idx === selectedIndex;
        const inBoxEdit = boxEdit && selected && !deleted;
        const box = (
          <div
            role="button"
            aria-label={`bbox ${idx + 1}`}
            onClick={(e) => {
              e.stopPropagation();
              if (movedRef.current) return; // 拖拽收尾的浏览器 click 不作为选择
              if (e.ctrlKey || e.shiftKey) { onMultiSelect?.(idx); return; }
              onSelect(selected ? -1 : idx);
            }}
            onMouseDown={(e) => onBoxMouseDown(e, idx)}
            onMouseEnter={() => onHover(idx)}
            onMouseLeave={() => onHover(-1)}
            style={{
              position: 'absolute',
              left: pct(x0, base.w),
              top: pct(y0, base.h),
              width: span(x0, x1, base.w),
              height: span(y0, y1, base.h),
              border: `${selected ? 2 : 1}px solid ${selected ? '#1677ff' : blockColor(b.type)}`,
              borderStyle: deleted ? 'dashed' : 'solid',
              opacity: deleted ? 0.25 : 1,
              background: active ? `${blockColor(b.type)}26` : `${blockColor(b.type)}0d`,
              borderRadius: 2,
              pointerEvents: 'auto',
              cursor: boxEdit && !deleted ? 'move' : 'pointer',
            }}
          >
            {inBoxEdit && HANDLES.map((h) => (
              <div
                key={h}
                data-testid={`handle-${h}`}
                onMouseDown={(e) => onHandleMouseDown(e, idx, h)}
                style={{
                  position: 'absolute',
                  width: 8,
                  height: 8,
                  background: '#fff',
                  border: '1.5px solid #1677ff',
                  borderRadius: 1,
                  ...handlePos(h),
                }}
              />
            ))}
          </div>
        );
        if (!boxEdit) return <div key={idx}>{box}</div>;
        // 右键菜单（§4.6 框图修改）：修改=选中出 8 手柄 / 删除 / 恢复（草稿已删框）
        const items: MenuProps['items'] = deleted
          ? [{ key: 'restore', label: '恢复' }]
          : [
            { key: 'edit', label: '修改' },
            { key: 'delete', label: '删除' },
          ];
        return (
          <Dropdown
            key={idx}
            trigger={['contextMenu']}
            open={ctxIdx === idx}
            onOpenChange={(open) => setCtxIdx(open ? idx : null)}
            destroyOnHidden
            menu={{
              items,
              onClick: ({ key, domEvent }) => {
                // 弹层经 React 树冒泡回页图，不停止会触发「空白就近选块」覆盖菜单动作
                domEvent.stopPropagation();
                setCtxIdx(null);
                if (key === 'edit') onSelect(idx);
                else if (key === 'delete') onDeleteRegion?.(idx);
                else if (key === 'restore') onRestoreRegion?.(idx);
              },
            }}
          >
            {box}
          </Dropdown>
        );
      })}
      {draft.added.map((bb, i) => (
        <div
          key={`add-${i}`}
          data-testid={`draft-added-${i}`}
          style={{
            position: 'absolute',
            left: pct(bb[0], base.w),
            top: pct(bb[1], base.h),
            width: span(bb[0], bb[2], base.w),
            height: span(bb[1], bb[3], base.h),
            border: '2px dashed #fa8c16',
            background: 'rgba(250,140,22,.10)',
            borderRadius: 2,
            pointerEvents: 'none',
          }}
        />
      ))}
      {draft.merged.map((group, i) => {
        const u = unionOf(group);
        if (!u) return null;
        return (
          <div
            key={`mrg-${i}`}
            data-testid={`draft-merged-${i}`}
            style={{
              position: 'absolute',
              left: pct(u[0], base.w),
              top: pct(u[1], base.h),
              width: span(u[0], u[2], base.w),
              height: span(u[1], u[3], base.h),
              border: '2px dashed #722ed1',
              background: 'rgba(114,46,209,.10)',
              borderRadius: 2,
              pointerEvents: 'none',
            }}
          />
        );
      })}
      {live && (
        <div
          data-testid="draft-live"
          style={{
            position: 'absolute',
            left: pct(live[0], base.w),
            top: pct(live[1], base.h),
            width: span(live[0], live[2], base.w),
            height: span(live[1], live[3], base.h),
            border: '2px dashed #1677ff',
            background: 'rgba(22,119,255,.08)',
            borderRadius: 2,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

function handlePos(h: HandleId): React.CSSProperties {
  const pos: Record<HandleId, React.CSSProperties> = {
    nw: { left: -4, top: -4, cursor: 'nwse-resize' },
    n: { left: 'calc(50% - 4px)', top: -4, cursor: 'ns-resize' },
    ne: { right: -4, top: -4, cursor: 'nesw-resize' },
    e: { right: -4, top: 'calc(50% - 4px)', cursor: 'ew-resize' },
    se: { right: -4, bottom: -4, cursor: 'nwse-resize' },
    s: { left: 'calc(50% - 4px)', bottom: -4, cursor: 'ns-resize' },
    sw: { left: -4, bottom: -4, cursor: 'nesw-resize' },
    w: { left: -4, top: 'calc(50% - 4px)', cursor: 'ew-resize' },
  };
  return pos[h];
}
