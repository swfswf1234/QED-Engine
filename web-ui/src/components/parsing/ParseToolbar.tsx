/**
 * 对照区顶栏（parsing-ui §7/§8 + §4.6 四行重排，REQ-098 W8）：
 * 行1 书名独行｜行2 动作（书页入库/解析本页/全本族，**均先弹窗确认**）+ 任务进度 + 页码导航（尾部）｜
 * 行3 视图（编辑模式开关｜单页/连续｜滚动同步｜流式/版式 + 排版；不设缩放控件，§4.6 追改）｜
 * 行4 编辑行（口径=框图修改／解析修正；框图：新增（画框模式）+ 合并，删除与修改走框右键菜单；
 *     解析修正：整页确认 + 审阅统计，单块确认在右栏块上）。
 * 动作按钮文案按状态三态选择（壳 §4.6 判定表）；「解析全部未完成页」在引擎侧 R6 承接前禁用 + tooltip。
 * 框图口径的新框/删除/合并落库沿 §4.5 降级（本地预览）；拉伸/移动落库走既有 corrected_bbox `/edit` 链。
 * 无「返回列表」（单屏无列表态）；无 engine 选择（服务端默认引擎）。
 * 键盘 ←/→ 翻页由页面容器处理（弹层/输入聚焦时禁用）。
 */
import { useState } from 'react';
import { App, Button, InputNumber, Popover, Progress, Segmented, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { editKey, useParsingStore } from '../../stores/parsing';
import type { BookMeta } from '../../api/axiom';
import { parsingBookLabel } from './BookTree';
import TypographyPanel from './TypographyPanel';

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
  const editMode = useParsingStore((s) => s.editMode);
  const editPane = useParsingStore((s) => s.editPane);
  const drawMode = useParsingStore((s) => s.drawMode);
  const boxSelection = useParsingStore((s) => s.boxSelection);
  const regionDraft = useParsingStore((s) => s.regionDraft);
  const typography = useParsingStore((s) => s.typography);
  const activeJob = useParsingStore((s) => s.activeJob);
  const jobError = useParsingStore((s) => s.jobError);
  const jobSubmitting = useParsingStore((s) => s.jobSubmitting);
  const edits = useParsingStore((s) => s.edits);
  const pages = useParsingStore((s) => s.pages);
  const selectedBlock = useParsingStore((s) => s.selectedBlock);
  const compareBookId = useParsingStore((s) => s.compareBookId);
  const setScrollMode = useParsingStore((s) => s.setScrollMode);
  const setRenderMode = useParsingStore((s) => s.setRenderMode);
  const setSyncScroll = useParsingStore((s) => s.setSyncScroll);
  const setEditMode = useParsingStore((s) => s.setEditMode);
  const setEditPane = useParsingStore((s) => s.setEditPane);
  const setDrawMode = useParsingStore((s) => s.setDrawMode);
  const setTypography = useParsingStore((s) => s.setTypography);
  const mergeSelectedBlocks = useParsingStore((s) => s.mergeSelectedBlocks);
  const resetRegionDraft = useParsingStore((s) => s.resetRegionDraft);
  const loadPage = useParsingStore((s) => s.loadPage);
  const gotoPage = useParsingStore((s) => s.gotoPage);
  const createParseJob = useParsingStore((s) => s.createParseJob);
  const ingestBook = useParsingStore((s) => s.ingestBook);
  const ingestBusy = useParsingStore((s) => s.ingestBusy);
  const confirmPageBlocks = useParsingStore((s) => s.confirmPageBlocks);

  const { modal, message } = App.useApp();
  const [pageInput, setPageInput] = useState<number | null>(null);

  const total = Math.max(book.page_count ?? 1, 1);
  const done = book.pages_done ?? 0;
  const ingested = book.ingest_status === 'ingested';
  const pageParsed = Boolean(pages[pageNo]?.parsed);
  const running = Boolean(activeJob && (activeJob.status === 'queued' || activeJob.status === 'running'));
  const busy = running || jobSubmitting;
  const judged = compareBookId
    ? Array.from({ length: blockCount }, (_, i) => edits[editKey(compareBookId, pageNo, i)]).filter((e) => e?.verdict).length
    : 0;
  const draftDirty = regionDraft.added.length + regionDraft.deleted.length + regionDraft.merged.length > 0;

  /** 动作确认弹窗（§4.6：全动作前置确认，风险写在正文） */
  const ask = (title: string, content: string, run: () => void | Promise<void>) =>
    modal.confirm({ title, content, okText: '确认', cancelText: '取消', onOk: run });

  const jump = (v: number | null) => {
    if (v == null) return;
    const p = Math.min(Math.max(Math.round(v), 1), total);
    setPageInput(null);
    if (p !== pageNo) void loadPage(p);
  };

  const ingestLabel = ingested ? '重新书页入库' : '书页入库';
  const onIngest = () => ask(
    ingestLabel,
    ingested
      ? '将重渲染并覆盖全部页图，已解析页的页图与块 bbox 基准可能错位。确认？'
      : '逐页渲染书页图并登记页数（不调模型），确认？',
    () => ingestBook(book.book_id),
  );

  const parsePageLabel = pageParsed ? '重新解析本页' : '解析本页';
  const onParsePage = () => ask(
    parsePageLabel,
    pageParsed
      ? `将覆盖第 ${pageNo} 页现有解析结果，确认？`
      : `识别第 ${pageNo} 页并生成块，确认？`,
    () => createParseJob([pageNo]),
  );

  const onParseAll = () => ask(
    '重新全部解析',
    `将覆盖全部 ${total} 页现有解析结果并生成新版本，确认？`,
    () => createParseJob(undefined),
  );

  const onFirstParseAll = () => ask(
    '全本解析',
    `将解析全部 ${total} 页并生成解析产物，确认？`,
    () => createParseJob(undefined),
  );

  const onConfirmPage = () => ask(
    '整页确认',
    `将确认本页 ${blockCount} 块（未逐块复核，判定=一致），确认？`,
    async () => {
      const skip = selectedBlock >= 0 ? selectedBlock : -1;
      const { confirmed, skipped } = await confirmPageBlocks(blockCount, skip);
      message.success(`已确认 ${confirmed} 块${skipped ? `，跳过 ${skipped} 块` : ''}`);
    },
  );

  return (
    <div data-testid="parse-toolbar" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
      {/* 行1：书名独行 */}
      <div>
        <Text strong style={{ fontSize: 15 }}>{parsingBookLabel(book) || book.book_id}</Text>
      </div>

      {/* 行2：动作（均先确认）+ 任务进度 + 页码导航（尾部） */}
      <Space wrap size={8}>
        <Tooltip title={book.file_path ? undefined : '书目未登记源 PDF 路径，无法入库'}>
          <Button size="small" disabled={!book.file_path} loading={Boolean(ingestBusy[book.book_id])} onClick={onIngest}>
            {ingestLabel}
          </Button>
        </Tooltip>
        <Button size="small" type="primary" disabled={busy || !ingested} onClick={onParsePage}>
          {parsePageLabel}
        </Button>
        {done === 0 ? (
          <Button size="small" disabled={busy || !ingested || !book.file_path} onClick={onFirstParseAll}>
            全本解析
          </Button>
        ) : (
          <>
            {done < total && (
              <Tooltip title="等待解析引擎侧承接（REQ-099 R6：未完成页清单 / skip_parsed），承接后可只补未完成页">
                <Button size="small" disabled>解析全部未完成页</Button>
              </Tooltip>
            )}
            <Button size="small" disabled={busy || !ingested || !book.file_path} onClick={onParseAll}>
              重新全部解析
            </Button>
          </>
        )}
        {running && activeJob && (
          <Progress
            size="small" type="line" style={{ width: 140 }}
            percent={activeJob.progress.total ? Math.round((activeJob.progress.parsed / activeJob.progress.total) * 100) : 0}
            format={() => `${activeJob.progress.parsed}/${activeJob.progress.total}`}
          />
        )}
        {jobError && <Text type="danger" style={{ fontSize: 12 }}>{jobError}</Text>}
        <Space size={4} style={{ marginLeft: 'auto' }}>
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
      </Space>

      {/* 行3：编辑模式｜单页/连续｜滚动同步｜流式/版式（不设缩放控件，§4.6 追改） */}
      <Space wrap size={8}>
        <Space size={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>编辑模式</Text>
          <Switch size="small" aria-label="编辑模式开关" checked={editMode} onChange={setEditMode} checkedChildren="编辑" unCheckedChildren="只读" />
        </Space>
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
        <Segmented
          size="small"
          options={[{ label: '流式', value: 'stream' }, { label: '版式', value: 'layout' }]}
          value={renderMode}
          onChange={(v) => setRenderMode(v as 'stream' | 'layout')}
        />
        {renderMode === 'layout' && (
          <Popover trigger="click" content={<TypographyPanel prefs={typography} onChange={setTypography} />}>
            <Button size="small" aria-label="版式样式面板">排版</Button>
          </Popover>
        )}
      </Space>

      {/* 行4：编辑口径 + 该口径的动作 */}
      {editMode && (
        <Space wrap size={8}>
          <Segmented
            size="small"
            aria-label="编辑口径"
            options={[{ label: '框图修改', value: 'box' }, { label: '解析修正', value: 'content' }]}
            value={editPane}
            onChange={(v) => setEditPane(v as 'box' | 'content')}
          />
          {editPane === 'box' ? (
            <>
              <Tooltip title="开启后在页图空白处拖拽画新框（本地预览）">
                <Button size="small" type={drawMode ? 'primary' : 'default'} onClick={() => setDrawMode(!drawMode)}>新增</Button>
              </Tooltip>
              <Button size="small" disabled={boxSelection.length < 2} onClick={mergeSelectedBlocks}>合并</Button>
              {draftDirty && (
                <>
                  <Button size="small" onClick={resetRegionDraft}>清空草稿</Button>
                  <Text type="secondary" style={{ fontSize: 12 }}>框图修改暂未生效（本地预览，落库等待引擎承接）</Text>
                </>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>拉伸/移动即时落库；右键框可修改范围或删除</Text>
            </>
          ) : (
            <Button size="small" onClick={onConfirmPage}>整页确认</Button>
          )}
          <Tag>已判定 {judged} / 共 {blockCount} 块</Tag>
        </Space>
      )}
    </div>
  );
}
