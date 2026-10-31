/**
 * 知识点梳理屏（`#/admin/kp-review`，REQ-141 批次 F・第三令形态）
 * 设计关联：docs/design/frontend/kp-review-ui.md、docs/plans/2026-10-24-kp-review-screen-and-kp-passthrough.md
 * - **唯一事实源＝`af_kp` 工作区读腿**（`GET /books/{book_id}/kp`）：目录、点列表、在飞批次号都从这一条来，
 *   根侧 §⑥ 的 `/learn/*` 与 `/llm/*` 在本屏零出现（改判②换源）。写腿只有一枚在册＝`PATCH /kp/nodes/{node_id}`
 *   写 `summary`；实际写库的点击一律须人工发令
 * - **三行**＝① 只有标题 ② 选书行（领域→课程→教材三框，教材只列入选项＝解析已完成）③ 总体按钮行
 *   （一键解析／重新解析＋知识点合并梳理＋本课程已梳理教材读数＋刷新）
 *   两行都是块级行（antd `Space` 默认 `inline-flex` 会并行进同一行，故显式 `display: flex`）
 * - **第三行两枚解析钮（第三令第①部分・W9，2026-10-27 第四令改判＝同屏并列、恒只一枚点亮）**：
 *   点亮律单点在 `parseLitOf`（目录零行→亮「一键解析」；非空→亮「重新解析」；无教材→都不亮），
 *   代价如实登记＝目录非空时整本重跑在本屏点不动。「一键解析」＝整本（`page_start`／`page_end` 都不发，
 *   交 8902 取整册缺省，且不带走备注）；「重新解析」按下**才出弹窗**，区间＝弹窗内**现选**的那枚目录行
 *   （屏上选中行不算、弹窗不给整本退路），备注＝人工评审意见只在弹窗里（由 8902 注入该轮两阶段 prompt 并随批次流水存档）。
 *   提交后**只出一句弹窗**（第七令・W16＝受理／拒绝／收口／失败各一句，屏侧不常驻批次号与五格计数），
 *   在飞期间第三行下方只剩一句灰字「目录解析进行中」；在飞判据只认工作区的 `draft` 行，两枚钮都不许再叠批
 * - **三栏＝左「目录」／中「知识展示」／右「知识点详情」**（v5 形态＝antd Splitter 边栏，非抽屉／侧滑）：
 *   目录可拖宽但上限＝容器一半且不给折叠＝常驻；详情栏的收起／展开走分隔条上的箭头；
 *   左栏目录在**非编辑模式下不渲染任何编辑控件**（纯净目录），目录行只由缩进＋名称＋选中左边线承载；
 *   屏上名称走版式面同一枚清洗 `tocEntriesFromLine`（丙案・先展示净，写库另发令），编辑态才回到库里原样名
 * - 中栏未选中目录行时默认显示**第 1 页**（封面／书名页）；点目录行即跳该节页区间（行区间＝锚页最小／最大）；
 *   中栏只消费 `BlockList` 的版式分支（T2 已裁甲・共用同一渲染腿），本屏不自造段落流、不改版式判定
 * - **右栏＝三型详情面**（`KA-44` 四值类型，W27）：章节＝名称／「章节」标注／总结（可编辑＋保存结果）／导读（只读）；
 *   知识点＝名称／标注／所属章（只读）／章的导读（只读）／本点总结（可编辑）＋「重新生成总结」；
 *   习题与「其他」＝只名称与类型标注，页脚三钮（上一个／保存结果／下一个）不可用。
 *   上一个／下一个只走**同级行页序**；「本章知识点」列表与两枚「一键」钮已按令撤出（生成归内容解析批次与单点重生成）
 * - **文字取舍**＝界面只出一句最短的「发生了什么」（错误、可见拒绝、空态原因）；「怎么做／属哪批次／哪条端点在册」不进界面，
 *   也不用 Tooltip 承载
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Alert, Button, Card, Input, InputNumber, Modal, Select, Space, Splitter, Tag, Typography,
} from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import BlockList from '../components/parsing/BlockList';
import { blocksOf } from '../components/parsing/CompareView';
import { renderInlineMath } from '../components/parsing/blocks';
import { DEFAULT_TYPOGRAPHY, tocEntriesFromLine } from '../components/parsing/typography';
import {
  KP_JOB_MAX_POLLS, KP_JOB_STOP_MESSAGE, KP_REVIEW_NOTE_MAX_LEN, MERGE_MIN_DONE_BOOKS,
  bodyCutOf, bookDone, chapterRowOf, cutFromStart, pageOrderedDraft, parseLitOf, useKpReviewStore,
} from '../stores/kpReview';
import type { DraftNode } from '../stores/kpReview';
import type { KpReadNodeType } from '../api/kp';
import { PAGE_BATCH, flowPages } from '../stores/learnWorkbench';
import { outlineRowStyle } from './LearnWorkbench';

const { Text, Title } = Typography;

/** 四值类型的中文标注（`KA-44` 读键 `node_type`；屏侧只呈现） */
const NODE_TYPE_LABEL: Record<KpReadNodeType, string> = {
  chapter: '章节',
  point: '知识点',
  exercise: '习题',
  other: '其他',
};

/** 梳理屏自带的版式默认（W24／T15 甲）：不读解析屏的 `qed.parsing.typography`，眉脚页数默认隐藏 */
const BODY_TYPOGRAPHY = { ...DEFAULT_TYPOGRAPHY, showFurniture: false };

/**
 * 三栏宽度口径（批次 F v5・antd Splitter，用户 2026-10-25 裁「甲・改用 antd Splitter」）：
 * 目录 defaultSize 340／min 200／max 50%（承 v4 裁「可以拉伸，但不能拉到半屏后」）；
 * 正文 420／min 240，详情 360／min 260 且可折叠，折叠箭头常显在分隔条上（承 v4「详情可收起」，形态换成边栏条）。
 * 三档都给 defaultSize＝容器不够宽时 antd 按 340｜420｜360 的比例整体缩；只给两侧会在窄视口把正文挤成 111px 缝（真机 1050 实测）。
 */
const OUTLINE_DEFAULT_PX = 340;
const OUTLINE_MIN_PX = 200;
const BODY_DEFAULT_PX = 420;
const BODY_MIN_PX = 240;
const DETAIL_DEFAULT_PX = 360;
const DETAIL_MIN_PX = 260;
const PANE_HEIGHT = 'calc(100dvh - 56px)';

/** 面板内的卡片：宽度交给 Splitter 面板，卡片只留定高与内部滚动（与 paneStyle 同档，不再自报栏宽） */
const paneInPanelStyle: CSSProperties = { height: PANE_HEIGHT, overflowY: 'auto', padding: 12 };

/** 挂父候选＝除自己与自己的后代（防成环）；三级不预先藏掉，交校验 visibly 拒绝 */
function parentOptionsOf(nodes: readonly DraftNode[], key: string) {
  const descendants = new Set<string>();
  const walk = (parent: string) => {
    nodes.forEach((node) => {
      if (node.parentKey === parent && !descendants.has(node.key)) {
        descendants.add(node.key);
        walk(node.key);
      }
    });
  };
  walk(key);
  return nodes
    .filter((node) => node.key !== key && !descendants.has(node.key))
    .map((node) => ({ value: node.key, label: node.name }));
}

/** 编辑态里选中行的编辑器（T1 暂定甲＝改名＋补起止页＋改挂父＋上下移＋新增子节＋删除，一次一条） */
function RowEditor({ node }: { node: DraftNode }) {
  const draft = useKpReviewStore((s) => s.draft);
  const renameDraft = useKpReviewStore((s) => s.renameDraft);
  const setDraftRange = useKpReviewStore((s) => s.setDraftRange);
  const setDraftParent = useKpReviewStore((s) => s.setDraftParent);
  const moveDraft = useKpReviewStore((s) => s.moveDraft);
  const addDraft = useKpReviewStore((s) => s.addDraft);
  const removeDraft = useKpReviewStore((s) => s.removeDraft);
  const selectNode = useKpReviewStore((s) => s.selectNode);

  const [name, setName] = useState(node.name);
  const [start, setStart] = useState<number | null>(node.pageStart);
  const [end, setEnd] = useState<number | null>(node.pageEnd);

  useEffect(() => {
    setName(node.name);
    setStart(node.pageStart);
    setEnd(node.pageEnd);
  }, [node.name, node.pageStart, node.pageEnd]);

  const commitName = () => {
    if (name === node.name) return;
    if (!renameDraft(node.key, name)) setName(node.name);
  };

  const commitRange = () => {
    const nextStart = Number.isInteger(start) ? (start as number) : 0;
    const nextEnd = Number.isInteger(end) ? (end as number) : 0;
    if (nextStart === node.pageStart && nextEnd === node.pageEnd) return;
    if (!setDraftRange(node.key, nextStart, nextEnd)) {
      setStart(node.pageStart);
      setEnd(node.pageEnd);
    }
  };

  const addChild = () => {
    const key = addDraft(node.key);
    void selectNode(key);
  };

  return (
    <div
      data-testid={`editor-${node.key}`}
      onClick={(event) => event.stopPropagation()}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 8px', background: '#fafafa' }}
    >
      <Space.Compact block>
        <Input
          size="small"
          data-testid="editor-name"
          aria-label="目录名"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onPressEnter={commitName}
        />
        <InputNumber
          size="small"
          data-testid="editor-start"
          aria-label="起始页"
          min={1}
          controls={false}
          style={{ width: 64 }}
          value={start}
          onChange={(value) => setStart(value === null ? null : Number(value))}
          onBlur={commitRange}
        />
        <InputNumber
          size="small"
          data-testid="editor-end"
          aria-label="结束页"
          min={1}
          controls={false}
          style={{ width: 64 }}
          value={end}
          onChange={(value) => setEnd(value === null ? null : Number(value))}
          onBlur={commitRange}
        />
      </Space.Compact>
      <Space size={6} wrap>
        <Select
          size="small"
          data-testid="editor-parent"
          aria-label="改挂父级"
          style={{ width: 150 }}
          value={node.parentKey ?? ''}
          onChange={(value: string) => setDraftParent(node.key, value || null)}
          options={[{ value: '', label: '（作为章・无父级）' }, ...parentOptionsOf(draft, node.key)]}
        />
        <Button size="small" data-testid="editor-up" icon={<ArrowUpOutlined />} onClick={() => moveDraft(node.key, -1)}>上移</Button>
        <Button size="small" data-testid="editor-down" icon={<ArrowDownOutlined />} onClick={() => moveDraft(node.key, 1)}>下移</Button>
        <Button size="small" data-testid="editor-add-child" icon={<PlusOutlined />} onClick={addChild}>＋子节</Button>
        <Button size="small" data-testid="editor-remove" danger icon={<DeleteOutlined />} onClick={() => removeDraft(node.key)}>删除</Button>
      </Space>
    </div>
  );
}

/**
 * 屏上目录行的名称清洗（丙案・先展示净，写库另发令）：与版式面共用 `tocEntriesFromLine` 一枚判据，
 * 把库里目录行的引导点与残留页码剥掉；一条库行拆出几条就铺几行，选中与页区间仍归同一条库行。
 * 拆空时（名称只剩点线）交回原样，保证行仍可点、仍可进编辑态改写。
 */
function outlineDisplayTitles(name: string): string[] {
  const titles = tocEntriesFromLine(name).map((entry) => entry.title);
  return titles.length > 0 ? titles : [name];
}

/** 左栏＝目录（非编辑模式＝纯净目录；栏底常驻一枚「解析目录」＋一枚按钮切换编辑态；行＝缩进＋名称） */
function OutlinePane() {
  const draft = useKpReviewStore((s) => s.draft);
  const bookId = useKpReviewStore((s) => s.bookId);
  const selectedKey = useKpReviewStore((s) => s.selectedKey);
  const outlineEmpty = useKpReviewStore((s) => s.outlineEmpty);
  const draftError = useKpReviewStore((s) => s.draftError);
  const editMode = useKpReviewStore((s) => s.editMode);
  const addDraft = useKpReviewStore((s) => s.addDraft);
  const selectNode = useKpReviewStore((s) => s.selectNode);
  const submitParseAll = useKpReviewStore((s) => s.submitParseAll);

  // 第八令 W17＝整本解析那枚从第三行挪到目录下方常驻；点亮律仍走 `parseLitOf` 那一句判据
  const lit = parseLitOf(bookId, outlineEmpty);

  const addRoot = () => {
    const key = addDraft(null);
    void selectNode(key);
  };

  return (
    <div data-testid="outline-pane">
      <Space size={6} style={{ marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }}>目录</Text>
        {editMode && (
          <Button size="small" data-testid="footer-add-root" icon={<PlusOutlined />} onClick={addRoot}>＋新章</Button>
        )}
      </Space>
      {draftError && <Alert data-testid="draft-error" type="error" showIcon style={{ marginBottom: 8 }} message={draftError} />}
      {outlineEmpty && draft.length === 0 && (
        <div data-testid="outline-empty">
          <Text type="secondary" style={{ fontSize: 12 }}>这本书还没有目录行</Text>
        </div>
      )}
      {draft.map((node) => {
        // 非编辑态＝屏上净名（清洗只在展示腿）；编辑态回到库里原样名，交人改写
        const titles = editMode ? [node.name] : outlineDisplayTitles(node.name);
        return (
          <div
            key={node.key}
            data-testid={`outline-row-${node.key}`}
            data-key={node.key}
            data-depth={node.depth}
            onClick={() => {
              if (node.key !== selectedKey) void selectNode(node.key);
            }}
            style={{
              cursor: 'pointer',
              marginBottom: 4,
              borderLeft: node.key === selectedKey ? '2px solid #1677ff' : '2px solid transparent',
            }}
          >
            <span data-testid={`outline-name-${node.key}`} style={outlineRowStyle(node.depth === 1 ? 'chapter' : 'point')}>
              {titles.map((title, i) => (
                <span key={i} data-outline-entry style={{ display: 'block' }}>
                  <Text strong={node.depth === 1} style={{ fontSize: 13 }}>
                    <span dangerouslySetInnerHTML={{ __html: renderInlineMath(title) }} />
                  </Text>
                </span>
              ))}
            </span>
            {editMode && node.key === selectedKey && <RowEditor node={node} />}
          </div>
        );
      })}
      <div style={{ marginTop: 8 }}>
        <Button
          size="small"
          type={lit.all ? 'primary' : 'default'}
          disabled={!lit.all}
          data-testid="parse-outline"
          data-lit={lit.all}
          onClick={() => void submitParseAll()}
        >
          解析目录
        </Button>
      </div>
    </div>
  );
}

/** 中栏＝知识展示行（未选中目录行＝第 1 页封面；选中＝该节连续正文流） */
function BodyPane() {
  const bookId = useKpReviewStore((s) => s.bookId);
  const draft = useKpReviewStore((s) => s.draft);
  const selectedKey = useKpReviewStore((s) => s.selectedKey);
  const range = useKpReviewStore((s) => s.range);
  const pages = useKpReviewStore((s) => s.pages);
  const loadedThrough = useKpReviewStore((s) => s.loadedThrough);
  const sectionStats = useKpReviewStore((s) => s.sectionStats);
  const loadMorePages = useKpReviewStore((s) => s.loadMorePages);
  const [selectedBlock, setSelectedBlock] = useState<{ page: number; index: number } | null>(null);

  const pageNumbers = useMemo(() => Object.keys(pages).map(Number).sort((a, b) => a - b), [pages]);

  const selected = draft.find((node) => node.key === selectedKey);
  const cut = useMemo(() => bodyCutOf(selected), [selected]);

  const flowByPage = useMemo(() => {
    const parsed = pageNumbers
      .map((pageNo) => ({ pageNo, entry: pages[pageNo] }))
      .filter((item) => item.entry?.parsed && item.entry.data)
      .map((item) => ({ page: item.pageNo, blocks: cutFromStart(blocksOf(item.entry?.data ?? null), item.pageNo, cut) }));
    return new Map(flowPages(parsed).map((group) => [group.page, group.blocks]));
  }, [pages, pageNumbers, cut]);

  const done = !!range && loadedThrough >= range.end;

  return (
    <Card
      size="small"
      data-testid="body-pane"
      style={{ ...paneInPanelStyle, minWidth: 0 }}
      title={(
        <span data-testid="body-title">
          {selected
            ? outlineDisplayTitles(selected.name)[0]
            : (bookId ? '知识展示・第 1 页（封面）' : '知识展示')}
        </span>
      )}
    >
      <div data-testid="section-stats" style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
        {sectionStats.pages} 页 · {sectionStats.blocks} 块 · {sectionStats.chars} 字
      </div>
      {!bookId && (
        <div data-testid="body-no-book">
          <Text type="secondary" style={{ fontSize: 12 }}>没有可选教材，取不到正文</Text>
        </div>
      )}
      {selected && !range && (
        <div data-testid="body-no-range">
          <Text type="secondary" style={{ fontSize: 12 }}>这一节还没有页区间，取不到正文</Text>
        </div>
      )}
      {pageNumbers.map((pageNo) => {
        const entry = pages[pageNo];
        if (!entry) return null;
        if (entry.loading) return <Text key={pageNo} type="secondary" style={{ fontSize: 12 }}>第 {pageNo} 页取字中…</Text>;
        if (!entry.parsed) {
          return (
            <Text key={pageNo} type="secondary" style={{ display: 'block', fontSize: 12 }}>
              {`第 ${pageNo} 页：${entry.error ?? '正文还没准备好'}`}
            </Text>
          );
        }
        const blocks = flowByPage.get(pageNo);
        if (!blocks || blocks.length === 0) return null;
        return (
          <BlockList
            key={pageNo}
            bookId={bookId ?? ''}
            pageNo={pageNo}
            blocks={blocks}
            edits={{}}
            renderMode="layout"
            imageSize={null}
            pageImageUrl={entry.data?.image_url ?? null}
            typography={BODY_TYPOGRAPHY}
            selectedIndex={selectedBlock?.page === pageNo ? selectedBlock.index : -1}
            editMode={false}
            onSelect={(index) => setSelectedBlock(index < 0 ? null : { page: pageNo, index })}
            onSubmit={async () => false}
          />
        );
      })}
      {range && (
        <div style={{ marginTop: 10 }}>
          <Button
            size="small"
            data-testid="load-more"
            disabled={done}
            onClick={() => void loadMorePages()}
          >
            {done ? '本节点已取完' : `续取下一批（${PAGE_BATCH} 页／批）`}
          </Button>
        </div>
      )}
    </Card>
  );
}

/**
 * 右栏＝知识点详情，按行类型三形（W27）：章节＝总结可改＋导读只读；知识点＝所属章的总结与导读只读＋
 * 本点总结可改＋「重新生成总结」；习题／其他＝只名称与类型标注，页脚三钮不可用。
 * 上一个／下一个只走同级行页序；「本章知识点」列表与两枚「一键」钮已按令撤出。
 */
function DetailPane() {
  const detail = useKpReviewStore((s) => s.detail);
  const narrative = useKpReviewStore((s) => s.detailNarrative);
  const saving = useKpReviewStore((s) => s.detailSaving);
  const detailError = useKpReviewStore((s) => s.detailError);
  const draft = useKpReviewStore((s) => s.draft);
  const setDetailSummary = useKpReviewStore((s) => s.setDetailSummary);
  const saveDetail = useKpReviewStore((s) => s.saveDetail);
  const regenerateSummary = useKpReviewStore((s) => s.regenerateSummary);
  const stepDetail = useKpReviewStore((s) => s.stepDetail);

  const chapterRow = chapterRowOf(detail, draft);
  const summaryEditable = detail?.nodeType === 'chapter' || detail?.nodeType === 'point';
  const narrativeVisible = summaryEditable;

  return (
    <div data-testid="detail-pane" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!detail && (
        <div data-testid="detail-empty">
          <Text type="secondary" style={{ fontSize: 12 }}>还没有选中目录行或知识点</Text>
        </div>
      )}
      {detail && (
        <>
          <Space size={6} wrap>
            <Text strong style={{ fontSize: 13 }} data-testid="detail-name">
              {detail.nodeType === 'chapter' ? outlineDisplayTitles(detail.name)[0] : detail.name}
            </Text>
            <Tag data-testid="detail-kind">{NODE_TYPE_LABEL[detail.nodeType]}</Tag>
          </Space>
          {detail.nodeType === 'point' && chapterRow && (
            <div data-testid="detail-chapter">
              <Text type="secondary" style={{ fontSize: 12 }}>所属章节</Text>
              <div style={{ fontSize: 13 }}>{outlineDisplayTitles(chapterRow.name)[0]}</div>
              <div data-testid="detail-chapter-summary" style={{ fontSize: 12, color: '#666' }}>
                {chapterRow.summary || '这一章还没有总结。'}
              </div>
            </div>
          )}
          {summaryEditable && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>总结</Text>
                {detail.nodeType === 'point' && (
                  <Button
                    size="small"
                    data-testid="detail-regenerate"
                    icon={<ThunderboltOutlined />}
                    disabled={saving}
                    onClick={() => void regenerateSummary()}
                  >
                    重新生成总结
                  </Button>
                )}
              </div>
              <Input.TextArea
                size="small"
                data-testid="detail-summary"
                aria-label="总结"
                autoSize={{ minRows: 3, maxRows: 8 }}
                maxLength={KP_REVIEW_NOTE_MAX_LEN}
                value={detail.summary}
                disabled={saving}
                onChange={(event) => setDetailSummary(event.target.value)}
              />
            </div>
          )}
          {narrativeVisible && (
            <div>
              <div style={{ marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>导读</Text>
              </div>
              {narrative.loading && (
                <Text type="secondary" data-testid="detail-narrative-loading" style={{ display: 'block', fontSize: 12 }}>
                  导读正文取字中…
                </Text>
              )}
              {!narrative.loading && narrative.available && (
                <div
                  data-testid="detail-narrative"
                  style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
                  dangerouslySetInnerHTML={{ __html: renderInlineMath(narrative.content) }}
                />
              )}
              {!narrative.loading && !narrative.available && (
                <Text type="secondary" data-testid="detail-narrative-empty" style={{ display: 'block', fontSize: 12 }}>
                  {narrative.reason || '这一条还没有导读正文。'}
                </Text>
              )}
            </div>
          )}
          {detailError && <Alert data-testid="detail-error" type="error" showIcon message={detailError} />}
          <Space size={6} wrap data-testid="detail-footer">
            <Button size="small" data-testid="detail-prev" disabled={!summaryEditable || saving} onClick={() => void stepDetail(-1)}>上一个</Button>
            <Button
              size="small"
              type="primary"
              data-testid="detail-save"
              loading={saving}
              disabled={!summaryEditable || detail.summary.trim() === '' || saving}
              onClick={() => void saveDetail()}
            >
              保存结果
            </Button>
            <Button size="small" data-testid="detail-next" disabled={!summaryEditable || saving} onClick={() => void stepDetail(1)}>下一个</Button>
          </Space>
        </>
      )}
    </div>
  );
}

/** 第二行＝选书行三枚选框（教材入选项一律限定「解析已完成」，用户 2026-10-25 补充令） */
function PickerRow() {
  const domains = useKpReviewStore((s) => s.domains);
  const domainId = useKpReviewStore((s) => s.domainId);
  const courseId = useKpReviewStore((s) => s.courseId);
  const bookId = useKpReviewStore((s) => s.bookId);
  const progress = useKpReviewStore((s) => s.progress);
  const pickDomain = useKpReviewStore((s) => s.pickDomain);
  const pickCourse = useKpReviewStore((s) => s.pickCourse);
  const pickBook = useKpReviewStore((s) => s.pickBook);

  const courses = useMemo(() => domains.find((row) => row.domain_id === domainId)?.courses ?? [], [domains, domainId]);
  const books = useMemo(() => courses.find((row) => row.course_id === courseId)?.books ?? [], [courses, courseId]);
  const courseProgress = progress.get(courseId ?? '');

  return (
    <Space align="center" size={10} wrap data-testid="picker-row" style={{ display: 'flex', marginBottom: 6 }}>
      <span data-testid="domain-picker">
        <Text type="secondary" style={{ fontSize: 12 }}>领域</Text>
        <Select
          size="small"
          aria-label="领域"
          style={{ width: 150, marginLeft: 6 }}
          value={domainId}
          onChange={(value) => void pickDomain(value)}
          options={domains.map((row) => ({ value: row.domain_id, label: row.name }))}
        />
      </span>
      <span data-testid="course-picker">
        <Text type="secondary" style={{ fontSize: 12 }}>课程</Text>
        <Select
          size="small"
          aria-label="课程"
          style={{ width: 180, marginLeft: 6 }}
          value={courseId}
          onChange={(value) => void pickCourse(value)}
          options={courses.map((row) => ({ value: row.course_id, label: row.name }))}
        />
      </span>
      <span data-testid="book-picker">
        <Text type="secondary" style={{ fontSize: 12 }}>教材</Text>
        <Select
          size="small"
          aria-label="教材"
          placeholder={books.length === 0 ? '没有解析完成的教材' : undefined}
          style={{ width: 220, marginLeft: 6 }}
          value={bookId}
          onChange={(value) => void pickBook(value)}
          options={books.map((row) => ({
            value: row.book_id,
            label: `${row.label}${bookDone(courseProgress?.get(row.book_id)) ? '・已梳理' : '・未梳理'}`,
          }))}
        />
        {books.length === 0 && (
          <Text data-testid="book-empty-hint" type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
            本课没有解析完成的教材
          </Text>
        )}
      </span>
    </Space>
  );
}

/**
 * 第三行＝总体按钮行（第三令的按钮清单・2026-10-28 第八令改判形态・第九令⑤补内容解析腿）：
 * 整本那枚「解析目录」已挪进左栏目录下方常驻（W17），这一行留「重新解析目录」＋「内容解析」＋「合并梳理」；
 * 两枚解析钮共用同一枚弹窗（起止两行 + 备注），只是 `stage` 不同：`outline` 重跑目录、`content` 只补内容（`KA-43`）；
 * 范围与备注不在这一行常驻——按下才出弹窗，区间由弹窗内**现选的起止两行**给（W21）、不给整本退路。
 * 下拉与倒挂判据都走页序（`pageOrderedDraft`）：行序 `order_hint` 不等于正文页序（第九令③）。
 * 解析钮是在册写腿的受理口（`POST /kp-jobs`），一按即向 8902 发批次，实际写库的点击一律须人工发令。
 */
function ActionRow() {
  const bookId = useKpReviewStore((s) => s.bookId);
  const draft = useKpReviewStore((s) => s.draft);
  const outlineEmpty = useKpReviewStore((s) => s.outlineEmpty);
  const reviewNote = useKpReviewStore((s) => s.reviewNote);
  const modalOpen = useKpReviewStore((s) => s.reparseModalOpen);
  const modalStage = useKpReviewStore((s) => s.reparseStage);
  const startKey = useKpReviewStore((s) => s.reparseStartKey);
  const endKey = useKpReviewStore((s) => s.reparseEndKey);
  const doneBooksInCourse = useKpReviewStore((s) => s.doneBooksInCourse);
  const loading = useKpReviewStore((s) => s.loading);
  const setReviewNote = useKpReviewStore((s) => s.setReviewNote);
  const openReparseModal = useKpReviewStore((s) => s.openReparseModal);
  const closeReparseModal = useKpReviewStore((s) => s.closeReparseModal);
  const setReparseTarget = useKpReviewStore((s) => s.setReparseTarget);
  const submitReparse = useKpReviewStore((s) => s.submitReparse);
  const reload = useKpReviewStore((s) => s.reload);

  const lit = parseLitOf(bookId, outlineEmpty);
  const mergeEnabled = doneBooksInCourse >= MERGE_MIN_DONE_BOOKS;
  /** 弹窗候选＝本书全部目录行按页序（起点页升序）；没有锚页的行排在最后，不偷偷滤掉（选了出可见拒绝，比屏上少一行诚实） */
  const targetOptions = pageOrderedDraft(draft).map((node) => {
    const title = outlineDisplayTitles(node.name)[0];
    return {
      value: node.key,
      label: node.pageStart !== null && node.pageEnd !== null
        ? `${title}（第 ${node.pageStart}–${node.pageEnd} 页）`
        : title,
    };
  });

  return (
    <>
      <Space align="center" size={10} wrap data-testid="action-row" style={{ display: 'flex', marginBottom: 6 }}>
        <Button
          size="small"
          type={lit.reparse ? 'primary' : 'default'}
          disabled={!lit.reparse}
          data-testid="reparse"
          data-lit={lit.reparse}
          onClick={() => openReparseModal('outline')}
        >
          重新解析目录
        </Button>
        <Button
          size="small"
          type={lit.content ? 'primary' : 'default'}
          disabled={!lit.content}
          data-testid="parse-content"
          data-lit={lit.content}
          onClick={() => openReparseModal('content')}
        >
          内容解析
        </Button>
        <Button
          size="small"
          disabled
          type={mergeEnabled ? 'primary' : 'default'}
          data-testid="merge-button"
          data-lit={mergeEnabled}
        >
          知识点合并梳理
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }} data-testid="done-books">
          {`本课程已梳理教材 ${doneBooksInCourse} 本`}
        </Text>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void reload()}
        >
          刷新
        </Button>
      </Space>
      {modalOpen && (
        <Modal
          open
          title={modalStage === 'content' ? '内容解析' : '重新解析目录'}
          onCancel={() => closeReparseModal()}
          footer={[
            <Button key="cancel" data-testid="reparse-cancel" onClick={() => closeReparseModal()}>取消</Button>,
            <Button key="submit" type="primary" data-testid="reparse-submit" onClick={() => void submitReparse()}>提交</Button>,
          ]}
        >
          <div data-testid="reparse-modal" data-stage={modalStage} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>起始目录行</Text>
              <Select
                size="small"
                data-testid="reparse-start"
                aria-label="起始目录行"
                placeholder="从这一行开始"
                style={{ width: '100%' }}
                value={startKey ?? undefined}
                options={targetOptions}
                onChange={(value: string) => setReparseTarget('start', value)}
              />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>结束目录行</Text>
              <Select
                size="small"
                data-testid="reparse-end"
                aria-label="结束目录行"
                placeholder="到这一行为止"
                style={{ width: '100%' }}
                value={endKey ?? undefined}
                options={targetOptions}
                onChange={(value: string) => setReparseTarget('end', value)}
              />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>人工评审意见</Text>
              <Input.TextArea
                size="small"
                data-testid="reparse-note"
                aria-label="人工评审意见"
                placeholder="备注・这一轮请优先遵守（可留空）"
                autoSize={{ minRows: 3, maxRows: 8 }}
                maxLength={KP_REVIEW_NOTE_MAX_LEN}
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/** 在飞痕迹（第七令・W16）＝第三行下方只剩一句灰字：批次号、五格计数与关闭钮一律不进界面 */
function JobProgressLine() {
  const job = useKpReviewStore((s) => s.job);
  const inFlightBatch = useKpReviewStore((s) => s.inFlightBatch);
  if (job?.phase !== 'running' && !inFlightBatch) return null;
  const stopped = job !== null && job.phase === 'running' && job.polls >= KP_JOB_MAX_POLLS;
  return (
    <div data-testid="job-running" style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, marginBottom: 8 }}>
      {stopped ? `目录解析进行中：${KP_JOB_STOP_MESSAGE}` : '目录解析进行中'}
    </div>
  );
}

export default function KpReview() {
  const [searchParams] = useSearchParams();
  const error = useKpReviewStore((s) => s.error);
  const notice = useKpReviewStore((s) => s.notice);

  useEffect(() => {
    void useKpReviewStore.getState().enter({
      domain: searchParams.get('domain') ?? undefined,
      course: searchParams.get('course') ?? undefined,
      book: searchParams.get('book') ?? undefined,
    });
    // 离屏即停表：定时器留着会把「解析完成」那句弹窗弹在别的屏上
    return () => useKpReviewStore.getState().dismissJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: '12px 12px 0' }}>
      <div data-testid="title-row" style={{ marginBottom: 6 }}>
        <Title level={2} style={{ margin: 0 }}>知识点梳理</Title>
      </div>
      <PickerRow />
      <ActionRow />
      <JobProgressLine />
      {error && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          message="梳理屏数据不可达"
          description={`${error}。其他界面不受影响，稍后点「刷新」再试。`}
        />
      )}
      {notice && <Alert data-testid="notice" type="info" showIcon style={{ marginBottom: 8 }} message={notice} />}
      <Splitter style={{ marginTop: 4 }}>
        <Splitter.Panel defaultSize={OUTLINE_DEFAULT_PX} min={OUTLINE_MIN_PX} max="50%">
          <Card size="small" title="目录" data-testid="outline-card" style={paneInPanelStyle}>
            <OutlinePane />
          </Card>
        </Splitter.Panel>
        <Splitter.Panel defaultSize={BODY_DEFAULT_PX} min={BODY_MIN_PX}>
          <BodyPane />
        </Splitter.Panel>
        <Splitter.Panel
          defaultSize={DETAIL_DEFAULT_PX}
          min={DETAIL_MIN_PX}
          collapsible={{ start: true, end: true, showCollapsibleIcon: true }}
        >
          <Card size="small" title="知识点详情" data-testid="detail-card" style={paneInPanelStyle}>
            <DetailPane />
          </Card>
        </Splitter.Panel>
      </Splitter>
    </div>
  );
}
