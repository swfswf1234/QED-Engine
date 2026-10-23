/**
 * 学习中心 · 课程学习单屏（`#/learn/c/:courseId`，REQ-117 v2）
 * 设计关联：docs/design/frontend/learning-course-ui.md §4~§7（课程学习面形态正本；总纲见 frontend-overview.md §5）
 * - 左＝章 → 知识点两级（节层不显形，C15）：点知识点读那一条，点零知识点的章行走整章阅读；
 *   栏内只列名称与自己的「已学」标记，不显示处理进度类说明（C23），行左缘两档对齐（C24）
 * - 中＝选中那一条的连续正文流（无页码口径、无续取按钮，滚动即续）；标题下先直排该条摘要
 * - 右＝学习交流三段：本章总结／学习要点 → 本条详解（主表 angles）与长文（narrative_ref 读文件腿）→ 备注（kp 行 learner_note）
 * - 推进在正文末尾三枚（上一条／下一条／已掌握并下一条），右栏不再单独成段
 * - 返回两级（C22＋C29 改判）＝导航右上角「返回」回根页面（与书架／知识探索／练习三面同位同序）、课程正式名称右侧「返回书架」
 * - 标题只写课程正式名称，不显示进度；窄屏按断点收栏：≥1400 三栏／1000~1400 右栏改侧滑／<1000 左右两栏都改侧滑，正文始终优先
 * - 数据一律经 8900；服务离线时逐栏降级，不白屏
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Drawer, Layout, Space, Spin, Typography,
} from 'antd';
import { LeftOutlined, QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import HelpModal from '../components/HelpModal';
import BlockList from '../components/parsing/BlockList';
import { blocksOf } from '../components/parsing/CompareView';
import { loadTypographyPrefs } from '../components/parsing/typography';
import { blockText, renderInlineMath } from '../components/parsing/blocks';
import ChapterNotePane from '../components/learning/ChapterNotePane';
import AnnotationPane from '../components/learning/AnnotationPane';
import AdvancePane from '../components/learning/AdvancePane';
import AnnotationForm from '../components/learning/AnnotationForm';
import type { LearnCourse, OutlineRow, PointChapter, PointUnit } from '../api/learn';
import {
  POINT_KEY_PREFIX, flowPages, isCovered, pointsOfChapter, useLearnWorkbenchStore,
} from '../stores/learnWorkbench';

const { Title, Text } = Typography;

/** 按钮组白字描边（蓝底页头上的统一样式，与书架／知识探索两面同款） */
const headerButtonStyle = { color: '#ffffff', borderColor: '#ffffff', background: 'transparent' };

/** 滚动续取判定：距底不足这些像素就取下一批 */
const SCROLL_AHEAD_PX = 80;

/** 目录知识点行相对章行的缩进量（DEFECT-016：两档左缘的单一常量来源） */
export const OUTLINE_INDENT_PX = 14;

/** 目录行左缘基准（章行） */
const OUTLINE_EDGE_PX = 8;

/**
 * 目录行的左对齐出口：antd `Button` 内容容器是 `inline-flex; justify-content:center`，
 * 只写 `textAlign:'left'` 对 flex 主轴无效（真机实测同档章行文本左缘随名称长度漂移），
 * 故必须同时给 `justifyContent:'flex-start'`；缩进改由本函数的左内边距表达，不再靠外层容器 margin。
 */
export function outlineRowStyle(level: 'chapter' | 'point'): React.CSSProperties {
  return {
    textAlign: 'left',
    justifyContent: 'flex-start',
    paddingLeft: OUTLINE_EDGE_PX + (level === 'point' ? OUTLINE_INDENT_PX : 0),
    fontWeight: level === 'chapter' ? 600 : undefined,
  };
}

const paneStyle = (width: number | string): React.CSSProperties => ({
  width,
  flex: typeof width === 'string' ? 1 : undefined,
  minWidth: typeof width === 'string' ? 560 : undefined,
  height: 'calc(100dvh - 56px)',
  overflowY: 'auto',
  padding: 12,
});

const canvasStyle: React.CSSProperties = { width: '100%', padding: 0 };

export type WorkbenchMode = 'three' | 'side' | 'single';

/** 版式断点：窄屏让目录／学习交流走侧滑，正文始终独占可用宽度 */
export function workbenchModeFor(width: number): WorkbenchMode {
  if (width >= 1400) return 'three';
  return width >= 1000 ? 'side' : 'single';
}

/** 页头标题＝课程正式名称（名称只在共享 `qed_course`，R5 引用不复制；读不到课程行为空串） */
export function workbenchTitleOf(course: LearnCourse | null): string {
  return course?.name ?? '';
}

/** 左栏两级行：一章 + 章下已整理好的知识点 */
interface TreeChapter {
  kpId: string;
  name: string;
  unitId: string;
  points: PointUnit[];
}

/**
 * 章行优先取推进投影（服务端按目录深度 1 给出，带章级注解成品位）；
 * 学习课程没登记时回落目录行，保证章节名与整章阅读仍可读。
 */
export function treeOf(
  chapters: readonly PointChapter[],
  outline: readonly OutlineRow[],
  units: readonly PointUnit[],
): TreeChapter[] {
  const rows = chapters.length > 0
    ? chapters.map((row) => ({ kpId: row.kp_id, name: row.name, unitId: row.unit_id }))
    : outline
      .filter((row) => (row.depth ?? 1) === 1)
      .map((row) => ({ kpId: row.kp_id, name: row.name, unitId: `${POINT_KEY_PREFIX}${row.kp_id}` }));
  return rows.map((row) => ({ ...row, points: pointsOfChapter(units, row.unitId) }));
}

function useViewportWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

interface PaneProps {
  inline: boolean;
  open: boolean;
  onClose: () => void;
  placement: 'left' | 'right';
  title: string;
  width: number | string;
  children: React.ReactNode;
}

/** 一栏的两种形态：宽屏＝页面内定宽卡片，窄屏＝点标题栏按钮唤出的侧滑面板 */
function Pane({
  inline, open, onClose, placement, title, width, children,
}: PaneProps) {
  if (inline) {
    return (
      <Card size="small" title={title} style={paneStyle(width)}>
        {children}
      </Card>
    );
  }
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement={placement}
      title={title}
      width={Math.min(420, Math.max(300, window.innerWidth * 0.82))}
      styles={{ body: { padding: 12, overflowY: 'auto' } }}
    >
      <Card size="small" style={canvasStyle}>{children}</Card>
    </Drawer>
  );
}

export default function LearnWorkbench() {
  const { courseId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const learnCourse = useLearnWorkbenchStore((s) => s.learnCourse);
  const outline = useLearnWorkbenchStore((s) => s.outline);
  const bookId = useLearnWorkbenchStore((s) => s.bookId);
  const pointUnits = useLearnWorkbenchStore((s) => s.pointUnits);
  const chapters = useLearnWorkbenchStore((s) => s.chapters);
  const selected = useLearnWorkbenchStore((s) => s.selected);
  const selectedPoint = useLearnWorkbenchStore((s) => s.selectedPoint);
  const range = useLearnWorkbenchStore((s) => s.range);
  const loadedThrough = useLearnWorkbenchStore((s) => s.loadedThrough);
  const pages = useLearnWorkbenchStore((s) => s.pages);
  const selectedBlock = useLearnWorkbenchStore((s) => s.selectedBlock);
  const loading = useLearnWorkbenchStore((s) => s.loading);
  const error = useLearnWorkbenchStore((s) => s.error);
  const fetchCourse = useLearnWorkbenchStore((s) => s.fetchCourse);
  const refresh = useLearnWorkbenchStore((s) => s.refresh);
  const selectPoint = useLearnWorkbenchStore((s) => s.selectPoint);
  const selectChapter = useLearnWorkbenchStore((s) => s.selectChapter);
  const loadMorePages = useLearnWorkbenchStore((s) => s.loadMorePages);
  const selectBlock = useLearnWorkbenchStore((s) => s.selectBlock);

  const typography = useMemo(() => loadTypographyPrefs(), []);
  const [helpOpen, setHelpOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const mode = workbenchModeFor(useViewportWidth());
  const inlineOutline = mode !== 'single';
  const inlineAnnotation = mode === 'three';

  useEffect(() => {
    // ?book= 由书架清单的教材卡带入（REQ-117 W8）：进场直接落在那一本，无参则取首本可读
    if (courseId) void fetchCourse(courseId, searchParams.get('book') ?? undefined);
  }, [courseId, searchParams, fetchCourse]);

  const title = workbenchTitleOf(learnCourse) || courseId;
  const tree = useMemo(() => treeOf(chapters, outline, pointUnits), [chapters, outline, pointUnits]);

  const pageNumbers = useMemo(
    () => Object.keys(pages).map(Number).sort((a, b) => a - b),
    [pages],
  );

  /** 跨页缝合后的逐页渲染单元（页只作归属，不作界面上的口径） */
  const flowByPage = useMemo(() => {
    const parsed = pageNumbers
      .map((pageNo) => ({ pageNo, entry: pages[pageNo] }))
      .filter((item) => item.entry?.parsed && item.entry.data)
      .map((item) => ({ page: item.pageNo, blocks: blocksOf(item.entry?.data ?? null) }));
    return new Map(flowPages(parsed).map((group) => [group.page, group.blocks]));
  }, [pages, pageNumbers]);

  const bodyLabel = selected?.kind === 'chapter'
    ? tree.find((row) => row.kpId === selected.kpId)?.name ?? ''
    : selectedPoint?.title ?? '';

  const onBodyScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (!range || loadedThrough >= range.end) return;
    if (el.scrollHeight - el.clientHeight - el.scrollTop < SCROLL_AHEAD_PX) void loadMorePages();
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader
        actions={
          <Space>
            <Button icon={<QuestionCircleOutlined />} style={headerButtonStyle} onClick={() => setHelpOpen(true)}>
              使用手册
            </Button>
            <Button icon={<ReloadOutlined />} style={headerButtonStyle} loading={loading} onClick={() => void refresh()}>
              刷新
            </Button>
            <Button icon={<LeftOutlined />} style={headerButtonStyle} onClick={() => navigate('/')}>
              返回
            </Button>
          </Space>
        }
      />
      <Layout.Content style={{ background: '#f5f7fa' }}>
        <div data-testid="workbench-heading" style={{ padding: '12px 16px 0' }}>
          <Space align="center" size={10}>
            <Title level={4} style={{ margin: 0 }}>
              <span data-testid="workbench-title">{title}</span>
            </Title>
            <Button icon={<LeftOutlined />} onClick={() => navigate('/learn')}>
              返回书架
            </Button>
          </Space>
        </div>
        {(!inlineOutline || !inlineAnnotation) && (
          <Space size={8} style={{ padding: '8px 16px 0' }}>
            {!inlineOutline && <Button size="small" onClick={() => setOutlineOpen(true)}>打开目录</Button>}
            {!inlineAnnotation && <Button size="small" onClick={() => setAnnotationOpen(true)}>打开学习交流</Button>}
          </Space>
        )}
        {error && (
          <Alert
            style={{ margin: '12px 16px' }}
            type="warning"
            showIcon
            message="工作台数据不可达"
            description={`暂未能读到本课的学习数据（${error}）。其他界面不受影响，稍后点右上「刷新」即可。`}
          />
        )}
        <div style={{ display: 'flex', gap: 12, padding: 16, alignItems: 'flex-start' }}>
          <Pane
            inline={inlineOutline}
            open={outlineOpen}
            onClose={() => setOutlineOpen(false)}
            placement="left"
            title="目录"
            width={300}
          >
            <div data-testid="outline-tree">
              {loading && <Spin size="small" />}
              {tree.map((chapter) => (
                <div key={chapter.kpId} style={{ marginBottom: 6 }}>
                  <Button
                    type={selected?.kind === 'chapter' && selected.kpId === chapter.kpId ? 'primary' : 'text'}
                    size="small"
                    block
                    data-outline-name={chapter.name}
                    data-outline-level="chapter"
                    style={outlineRowStyle('chapter')}
                    onClick={() => {
                      void selectChapter(chapter.kpId);
                      if (!inlineOutline) setOutlineOpen(false);
                    }}
                  >
                    {chapter.name}
                  </Button>
                  {chapter.points.map((point) => (
                    <Button
                      key={point.unit_id}
                      type={selected?.kind === 'point' && selected.kpId === point.kp_id ? 'primary' : 'text'}
                      size="small"
                      block
                      data-outline-name={point.title}
                      data-outline-level="point"
                      style={outlineRowStyle('point')}
                      onClick={() => {
                        void selectPoint(point.kp_id);
                        if (!inlineOutline) setOutlineOpen(false);
                      }}
                    >
                      {point.title}
                      {isCovered(point) && (
                        <Text type="success" style={{ marginLeft: 6, fontSize: 12 }}>已学</Text>
                      )}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
          </Pane>

          <Card
            size="small"
            data-testid="body-pane"
            title={<span data-testid="body-title">{bodyLabel}</span>}
            style={paneStyle('1px')}
          >
            <div data-testid="body-scroll" onScroll={onBodyScroll} style={{ maxHeight: 'calc(100dvh - 150px)', overflowY: 'auto', paddingRight: 4 }}>
              {!selected ? (
                <Text type="secondary" style={{ fontSize: 12 }}>在左栏选中一条知识点，正文就排在这里。</Text>
              ) : (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {selected.kind === 'chapter' && (
                    <Text type="secondary" style={{ fontSize: 12 }}>正文按整章呈现</Text>
                  )}
                  {selectedPoint?.summary && (
                    <div
                      data-testid="body-summary"
                      style={{ fontSize: 13, lineHeight: 1.7, color: '#333' }}
                      dangerouslySetInnerHTML={{ __html: renderInlineMath(selectedPoint.summary) }}
                    />
                  )}
                  {!range && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      这一条还没有定位到书页：等这一章的知识点整理好就能读正文，也可以先在右栏记一条备注。
                    </Text>
                  )}
                  {pageNumbers.map((pageNo) => {
                    const entry = pages[pageNo];
                    if (!entry) return null;
                    if (entry.loading) return <Spin key={pageNo} size="small" />;
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
                        typography={typography}
                        selectedIndex={selectedBlock?.page === pageNo ? selectedBlock.index : -1}
                        editMode={false}
                        onSelect={(index) => selectBlock(index < 0 ? null : {
                          page: pageNo,
                          index,
                          snippet: blockText(blocks[index] ?? { type: 'paragraph', bbox: [0, 0, 0, 0] }),
                        })}
                        onSubmit={async () => false}
                      />
                    );
                  })}
                  {range && loadedThrough >= range.end && (
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      这一条读完了：点「下一条」接着学。
                    </Text>
                  )}
                </Space>
              )}
              <div style={{ marginTop: 12 }}>
                <AdvancePane />
              </div>
            </div>
          </Card>

          <Pane
            inline={inlineAnnotation}
            open={annotationOpen}
            onClose={() => setAnnotationOpen(false)}
            placement="right"
            title="学习交流"
            width={340}
          >
            <div data-testid="annotation-pane">
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                <ChapterNotePane />
                <AnnotationPane />
                <AnnotationForm />
              </Space>
            </div>
          </Pane>
        </div>
      </Layout.Content>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} page="course" />
    </Layout>
  );
}
