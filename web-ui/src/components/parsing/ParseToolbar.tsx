/**
 * 对照区顶栏（parsing-ui §7 ParseToolbar，G 轮单屏版）：
 * 书名｜页码导航（输入跳页 + 上/下页）｜渲染模式（流式/版式）｜
 * 滚动模式 + 滚动同步｜缩放｜编辑模式开关｜审阅统计｜解析本页/全本 + 书页入库 + 任务进度。
 * 无「返回列表」（单屏无列表态）；无 engine 选择（服务端默认引擎）；
 * 无视图模式切换（G 轮裁决：固定对照，未解析页天然只显示书页图）。
 * 键盘 ←/→ 翻页由页面容器处理（弹层/输入聚焦时禁用）。
 */
import { useState } from 'react';
import { Button, InputNumber, Progress, Segmented, Slider, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { editKey, useParsingStore } from '../../stores/parsing';
import type { BookMeta } from '../../api/axiom';
import { parsingBookLabel } from './BookTree';

const { Text } = Typography;

export interface ParseToolbarProps {
  book: BookMeta;
  pageNo: number;
  blockCount: number;
}

export default function ParseToolbar({ book, pageNo, blockCount }: ParseToolbarProps) {
  const scrollMode = useParsingStore((s) => s.scrollMode);
  const renderMode = useParsingStore((s) => s.renderMode);
  const syncScroll = useParsingStore((s) => s.syncScroll);
  const zoom = useParsingStore((s) => s.zoom);
  const editMode = useParsingStore((s) => s.editMode);
  const activeJob = useParsingStore((s) => s.activeJob);
  const jobError = useParsingStore((s) => s.jobError);
  const edits = useParsingStore((s) => s.edits);
  const compareBookId = useParsingStore((s) => s.compareBookId);
  const setScrollMode = useParsingStore((s) => s.setScrollMode);
  const setRenderMode = useParsingStore((s) => s.setRenderMode);
  const setSyncScroll = useParsingStore((s) => s.setSyncScroll);
  const setZoom = useParsingStore((s) => s.setZoom);
  const setEditMode = useParsingStore((s) => s.setEditMode);
  const loadPage = useParsingStore((s) => s.loadPage);
  const gotoPage = useParsingStore((s) => s.gotoPage);
  const createParseJob = useParsingStore((s) => s.createParseJob);
  const ingestBook = useParsingStore((s) => s.ingestBook);
  const ingestBusy = useParsingStore((s) => s.ingestBusy);

  const [pageInput, setPageInput] = useState<number | null>(null);

  const total = Math.max(book.page_count ?? 1, 1);
  const running = Boolean(activeJob && (activeJob.status === 'queued' || activeJob.status === 'running'));
  const judged = compareBookId
    ? Array.from({ length: blockCount }, (_, i) => edits[editKey(compareBookId, pageNo, i)]).filter((e) => e?.verdict).length
    : 0;

  const jump = (v: number | null) => {
    if (v == null) return;
    const p = Math.min(Math.max(Math.round(v), 1), total);
    setPageInput(null);
    if (p !== pageNo) void loadPage(p);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
      <Space wrap size={8}>
        <Text strong style={{ fontSize: 15 }}>{parsingBookLabel(book) || book.book_id}</Text>
        <Space size={4}>
          <Button size="small" icon={<LeftOutlined />} aria-label="上一页" disabled={pageNo <= 1} onClick={() => gotoPage(-1)} />
          <InputNumber
            size="small" min={1} max={total} style={{ width: 110 }}
            aria-label="页码"
            value={pageInput ?? pageNo}
            formatter={(v) => `${v ?? ''} / ${total}`}
            parser={(d) => Number((d ?? '').split('/')[0].trim()) || 1}
            onChange={(v) => setPageInput(v)}
            onPressEnter={() => jump(pageInput ?? pageNo)}
          />
          <Button size="small" icon={<RightOutlined />} aria-label="下一页" disabled={pageNo >= total} onClick={() => gotoPage(1)} />
        </Space>
        <Segmented
          size="small"
          options={[{ label: '流式', value: 'stream' }, { label: '版式', value: 'layout' }]}
          value={renderMode}
          onChange={(v) => setRenderMode(v as 'stream' | 'layout')}
        />
      </Space>
      <Space wrap size={8}>
        <Segmented
          size="small"
          options={[{ label: '单页', value: 'single' }, { label: '连续', value: 'continuous' }]}
          value={scrollMode}
          onChange={(v) => setScrollMode(v as typeof scrollMode)}
        />
        <Space size={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>滚动同步</Text>
          <Switch size="small" checked={syncScroll} disabled={scrollMode === 'continuous'} onChange={setSyncScroll} />
        </Space>
        <Space size={6}>
          <Text type="secondary" style={{ fontSize: 12 }}>缩放</Text>
          <Slider
            style={{ width: 120, margin: '0 4px' }}
            min={50} max={200} step={10}
            marks={{ 50: '50', 100: '100', 200: '200' }}
            tooltip={{ formatter: (v) => `${v}%` }}
            value={zoom}
            onChange={setZoom}
          />
        </Space>
        <Space size={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>编辑模式</Text>
          <Switch size="small" aria-label="编辑模式开关" checked={editMode} onChange={setEditMode} checkedChildren="编辑" unCheckedChildren="只读" />
        </Space>
        <Tag>已判定 {judged} / 共 {blockCount} 块</Tag>
      </Space>
      <Space wrap size={8}>
        <Tooltip title={book.file_path ? '把原始 PDF 逐页转成书页图并登记页数（解析的前置步骤，不调用模型）' : '书目未登记源 PDF 路径，无法入库'}>
          <Button size="small" disabled={!book.file_path} onClick={() => void ingestBook(book.book_id)} loading={Boolean(ingestBusy[book.book_id])}>
            书页入库
          </Button>
        </Tooltip>
        <Button size="small" type="primary" disabled={running || book.ingest_status !== 'ingested'} onClick={() => void createParseJob([pageNo])}>
          解析本页
        </Button>
        <Button size="small" disabled={running || book.ingest_status !== 'ingested' || !book.file_path} onClick={() => void createParseJob(undefined)}>
          全本解析
        </Button>
        {running && activeJob && (
          <Space size={6}>
            <Progress
              size="small" type="line" style={{ width: 140 }}
              percent={activeJob.progress.total ? Math.round((activeJob.progress.parsed / activeJob.progress.total) * 100) : 0}
              format={() => `${activeJob.progress.parsed}/${activeJob.progress.total}`}
            />
          </Space>
        )}
        {jobError && <Text type="danger" style={{ fontSize: 12 }}>{jobError}</Text>}
      </Space>
    </div>
  );
}
