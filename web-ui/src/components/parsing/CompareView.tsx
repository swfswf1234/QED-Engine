/**
 * 双栏对照区（parsing-ui §8 CompareView）：态分流（原始文件优先）+ 单页/连续滚动两模式。
 * - 单页：左原文页（PageImagePane + bbox overlay）｜右解析文档（BlockList），两列各自滚动 + 滚动同步
 * - 连续：视口页窗口 [cur-2, cur+8] 纵向流，每页一个双栏单元，页码随视口联动
 * - 态分流（G 轮裁决：无视图模式切换，恒为对照）：已解析→双栏；已入库未解析→原页图占满；
 *   未入库有 file_path→iframe PDF 直显；否则明确空态
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Empty, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { Block, BlockEditInput, BookMeta, PageData } from '../../api/axiom';
import { bookFileUrl } from '../../api/axiom';
import { useParsingStore, type PageEntry, type ScrollMode } from '../../stores/parsing';
import { describeError } from '../../api/client';
import BlockList, { type RenderMode } from './BlockList';
import PageImagePane from './PageImagePane';

const { Text } = Typography;

/** A4 @96dpi ≈ Word 100% 页面尺寸（展示基准；超宽容器出横向滚动条） */
export const A4_W = 794;
export const A4_H = 1123;

/** 连续模式每页单元高度（A4 纸面 + 页签/边距） */
const UNIT_H = 1180;

const paneScrollStyle: React.CSSProperties = {
  height: UNIT_H - 40,
  overflowY: 'auto',
  overflowX: 'auto',
  background: '#f5f5f5',
};

const paperStyle: React.CSSProperties = {
  width: A4_W,
  minHeight: A4_H,
  boxSizing: 'border-box',
  padding: '36px 34px',
  background: '#fff',
  border: '1px solid #eee',
  borderRadius: 4,
};

/** 页数据 → 块数组（BlocksPage.blocks 或平铺 blocks） */
export function blocksOf(data: PageData | null): Block[] {
  const raw = data?.blocks ?? null;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw.blocks ?? [];
}

interface PagePairProps {
  book: BookMeta;
  pageNo: number;
  entry: PageEntry | undefined;
  zoom: number;
  renderMode: RenderMode;
  selected: number;
  hovered: number;
  editMode: boolean;
  imageSize: { w: number; h: number } | null;
  paneRefs?: { left: (el: HTMLDivElement | null) => void; right: (el: HTMLDivElement | null) => void };
  onSubmit: (blockIndex: number, input: BlockEditInput) => Promise<boolean>;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
  onImageSize: (size: { w: number; h: number }) => void;
}

/** 单页/连续单元共用的态分流双栏呈现 */
function PagePair(props: PagePairProps) {
  const {
    book, pageNo, entry, zoom, renderMode, selected, hovered, editMode,
    imageSize, paneRefs, onSubmit, onSelect, onHover, onImageSize,
  } = props;
  const edits = useParsingStore((s) => s.edits);
  const editSubmitting = useParsingStore((s) => s.editSubmitting);
  const loadPage = useParsingStore((s) => s.loadPage);

  const blocks = entry?.data ? blocksOf(entry.data) : [];
  const parsed = Boolean(entry?.parsed) && blocks.length > 0;
  const ingested = book.ingest_status === 'ingested';

  const originalPane = (
    <div style={paneScrollStyle} ref={paneRefs?.left} data-testid={`pane-original-${pageNo}`}>
      {entry?.error ? (
        <Alert
          type="warning" showIcon style={{ margin: 8 }}
          message="页数据获取失败"
          description={describeError(entry.error)}
          action={<Button size="small" icon={<ReloadOutlined />} onClick={() => void loadPage(pageNo)}>重试</Button>}
        />
      ) : parsed || ingested ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}>
          <PageImagePane
            bookId={book.book_id}
            pageNo={pageNo}
            blocks={blocks}
            selectedIndex={selected}
            hoveredIndex={hovered}
            zoom={zoom}
            onSelect={onSelect}
            onHover={onHover}
            onImageSize={onImageSize}
          />
        </div>
      ) : book.file_path ? (
        <div style={{ padding: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>尚未书页入库，直显原始 PDF（入库后才能逐页对照）</Text>
          <iframe
            title="原始 PDF"
            src={bookFileUrl(book.book_id)}
            style={{ width: A4_W, height: UNIT_H - 80, border: '1px solid #eee', borderRadius: 4, display: 'block', marginTop: 4 }}
          />
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={entry?.loading ? '加载中…' : '暂无原始文件（书目未登记 PDF 路径）'}
          style={{ marginTop: 60 }}
        />
      )}
    </div>
  );

  const parsedPane = (
    <div style={paneScrollStyle} ref={paneRefs?.right} data-testid={`pane-parsed-${pageNo}`}>
      <div style={{ padding: 8 }}>
        <div style={paperStyle}>
          {parsed ? (
            <BlockList
              bookId={book.book_id}
              pageNo={pageNo}
              blocks={blocks}
              edits={edits}
              renderMode={renderMode}
              imageSize={imageSize}
              selectedIndex={selected}
              editMode={editMode}
              submitting={editSubmitting}
              onSelect={onSelect}
              onHover={onHover}
              onSubmit={onSubmit}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={entry?.loading ? '加载中…' : '该页暂无解析块（可用顶栏「解析本页」）'}
            />
          )}
        </div>
      </div>
    </div>
  );

  // 对照态分流：未解析页解析栏隐藏，原页图占满（§8 态分流 2）
  if (!parsed) return originalPane;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {originalPane}
      {parsedPane}
    </div>
  );
}

export interface CompareViewProps {
  book: BookMeta;
  pageNo: number;
  entry: PageEntry | undefined;
  scrollMode: ScrollMode;
  syncScroll: boolean;
  zoom: number;
  renderMode: RenderMode;
}

export default function CompareView(props: CompareViewProps) {
  const { book, pageNo, entry, scrollMode, syncScroll, zoom, renderMode } = props;
  const pages = useParsingStore((s) => s.pages);
  const selectedBlock = useParsingStore((s) => s.selectedBlock);
  const editMode = useParsingStore((s) => s.editMode);
  const selectBlock = useParsingStore((s) => s.selectBlock);
  const submitEdit = useParsingStore((s) => s.submitEdit);
  const loadPage = useParsingStore((s) => s.loadPage);
  const ensurePage = useParsingStore((s) => s.ensurePage);

  const [hovered, setHovered] = useState(-1);
  const [imageSizes, setImageSizes] = useState<Record<number, { w: number; h: number }>>({});
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const scrollHostRef = useRef<HTMLDivElement | null>(null);

  const rememberSize = (p: number) => (sz: { w: number; h: number }) =>
    setImageSizes((prev) => (prev[p]?.w === sz.w && prev[p]?.h === sz.h ? prev : { ...prev, [p]: sz }));

  // 单页对照模式滚动同步（两栏按比例联动）
  useEffect(() => {
    if (scrollMode !== 'single' || !syncScroll) return;
    const l = leftRef.current;
    const r = rightRef.current;
    if (!l || !r) return;
    const ratio = (el: HTMLElement) => {
      const max = el.scrollHeight - el.clientHeight;
      return max > 0 ? el.scrollTop / max : 0;
    };
    let lock = false;
    const sync = (from: HTMLElement, to: HTMLElement) => {
      if (lock) return;
      lock = true;
      const max = to.scrollHeight - to.clientHeight;
      to.scrollTop = ratio(from) * Math.max(0, max);
      requestAnimationFrame(() => { lock = false; });
    };
    const onL = () => sync(l, r);
    const onR = () => sync(r, l);
    l.addEventListener('scroll', onL);
    r.addEventListener('scroll', onR);
    return () => {
      l.removeEventListener('scroll', onL);
      r.removeEventListener('scroll', onR);
    };
  }, [scrollMode, syncScroll, pageNo]);

  const total = Math.max(book.page_count ?? 1, 1);

  const windowPages = useMemo(() => {
    if (scrollMode !== 'continuous') return [pageNo];
    const start = Math.max(1, pageNo - 2);
    const end = Math.min(total, pageNo + 8);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [scrollMode, pageNo, total]);

  useEffect(() => {
    if (scrollMode !== 'continuous') return;
    for (const p of windowPages) void ensurePage(p);
  }, [scrollMode, windowPages, ensurePage]);

  /** 连续模式：视口中心所在页 → 顶栏页码联动 */
  const onContinuousScroll = () => {
    const host = scrollHostRef.current;
    if (!host) return;
    const center = host.scrollTop + host.clientHeight / 2;
    let best = pageNo;
    let bestDist = Infinity;
    for (const el of Array.from(host.querySelectorAll<HTMLElement>('[data-page-unit]'))) {
      const p = Number(el.dataset.pageUnit);
      if (!Number.isFinite(p)) continue;
      const d = Math.abs(el.offsetTop + el.offsetHeight / 2 - center);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    if (best !== pageNo) void loadPage(best);
  };

  if (scrollMode === 'continuous') {
    return (
      <div
        ref={scrollHostRef}
        onScroll={onContinuousScroll}
        data-testid="continuous-host"
        style={{ height: 'calc(100vh - 210px)', overflowY: 'auto', background: '#f5f5f5' }}
      >
        {windowPages.map((p) => (
          <div key={p} data-page-unit={p} style={{ marginBottom: 12 }}>
            <div style={{ padding: '2px 8px' }}>
              <Tag color={p === pageNo ? 'blue' : undefined}>第 {p} 页</Tag>
            </div>
            <PagePair
              book={book}
              pageNo={p}
              entry={pages[p]}
              zoom={zoom}
              renderMode={renderMode}
              selected={p === pageNo ? selectedBlock : -1}
              hovered={p === pageNo ? hovered : -1}
              editMode={editMode && p === pageNo}
              imageSize={imageSizes[p] ?? null}
              onSubmit={(i, input) => (p === pageNo ? submitEdit(i, input) : Promise.resolve(false))}
              onSelect={selectBlock}
              onHover={setHovered}
              onImageSize={rememberSize(p)}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <PagePair
      book={book}
      pageNo={pageNo}
      entry={entry}
      zoom={zoom}
      renderMode={renderMode}
      selected={selectedBlock}
      hovered={hovered}
      editMode={editMode}
      imageSize={imageSizes[pageNo] ?? null}
      paneRefs={{
        left: (el) => { leftRef.current = el; },
        right: (el) => { rightRef.current = el; },
      }}
      onSubmit={submitEdit}
      onSelect={selectBlock}
      onHover={setHovered}
      onImageSize={rememberSize(pageNo)}
    />
  );
}
