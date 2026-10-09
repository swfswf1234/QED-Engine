/**
 * 学习中心 · 三栏学习工作台（`#/learn/c/:courseId`，M6 裁决 ①／R7 ＋ M1 裁决 D1 双模式）
 * - 模式「阅读」＝书（active_job_id 非空者）→ 章节目录树 → 该章/节正文只读排版渲染 ＋ 批注登记（M6 原形态）
 * - 模式「链路」＝学习链路（章→节块序列，块带原书页窗）→ 块正文 → 勾选式推进与派生进度（M1 UI-2~UI-4）
 * - 左＝书 + 目录/链路树 → 导入目录 / 生成链路
 * - 中＝该章/节正文只读排版渲染（复用 parsing-ui §9/§9.1 组件，按 8 页/批懒取，不带判定与编辑 affordance）＋正文下方练习区（题源抽取 → 人工确认入库 → 作答）
 * - 右＝Tabs「批注与候选」（选区锚点 → 总结/详解 → candidate → 人工确认提升主表）/「本章练习」（到期复习 + 错题本）；链路模式下第一项换「进度与推进」
 * - 数据一律经 8900（ADR 0007）；8900 或存储不可达时逐栏降级，不白屏
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Empty, InputNumber, Layout, Modal, Segmented, Select, Space, Spin, Tabs, Typography,
} from 'antd';
import { LeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BlockList from '../components/parsing/BlockList';
import { blocksOf } from '../components/parsing/CompareView';
import { loadTypographyPrefs } from '../components/parsing/typography';
import { blockText } from '../components/parsing/blocks';
import { getBookPage } from '../api/axiom';
import { describeError } from '../api/client';
import AnnotationPane from '../components/learning/AnnotationPane';
import TocConfirmPanel from '../components/learning/TocConfirmPanel';
import { ChainBodyPane, ChainProgressPane, ChainTreePane } from '../components/learning/ChainPanes';
import ChapterPractice from '../components/practice/ChapterPractice';
import PracticePane from '../components/practice/PracticePane';
import { tocLinesFromBlockTexts, type BodyPageText } from '../tocParse';
import { PAGE_BATCH, useLearnWorkbenchStore } from '../stores/learnWorkbench';
import { useLearnChainStore } from '../stores/learnChain';

const { Title, Text } = Typography;

const paneStyle = (width: number | string): React.CSSProperties => ({
  width,
  flex: typeof width === 'string' ? 1 : undefined,
  height: 'calc(100vh - 56px)',
  overflowY: 'auto',
  padding: 12,
});

/** 试算偏移用的正文页样本数 */
const BODY_SAMPLE_PAGES = 6;

export default function LearnWorkbench() {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const course = useLearnWorkbenchStore((s) => s.course);
  const books = useLearnWorkbenchStore((s) => s.books);
  const book = useLearnWorkbenchStore((s) => s.book);
  const bookId = useLearnWorkbenchStore((s) => s.bookId);
  const outline = useLearnWorkbenchStore((s) => s.outline);
  const selectedKpId = useLearnWorkbenchStore((s) => s.selectedKpId);
  const range = useLearnWorkbenchStore((s) => s.range);
  const loadedThrough = useLearnWorkbenchStore((s) => s.loadedThrough);
  const pages = useLearnWorkbenchStore((s) => s.pages);
  const selectedBlock = useLearnWorkbenchStore((s) => s.selectedBlock);
  const loading = useLearnWorkbenchStore((s) => s.loading);
  const error = useLearnWorkbenchStore((s) => s.error);
  const fetchCourse = useLearnWorkbenchStore((s) => s.fetchCourse);
  const selectBook = useLearnWorkbenchStore((s) => s.selectBook);
  const selectNode = useLearnWorkbenchStore((s) => s.selectNode);
  const selectBlock = useLearnWorkbenchStore((s) => s.selectBlock);
  const loadMorePages = useLearnWorkbenchStore((s) => s.loadMorePages);
  const reloadOutline = useLearnWorkbenchStore((s) => s.reloadOutline);

  const typography = useMemo(() => loadTypographyPrefs(), []);
  const [mode, setMode] = useState<'read' | 'chain'>('read');
  const [rightTab, setRightTab] = useState('annotation');
  const loadChain = useLearnChainStore((s) => s.load);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [tocTofStart, setTocStart] = useState<number | null>(null);
  const [tocTofEnd, setTocEnd] = useState<number | null>(null);
  const [bodyStart, setBodyStart] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ lines: string[]; bodyPages: BodyPageText[] } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (courseId) void fetchCourse(courseId);
  }, [courseId, fetchCourse]);

  /** 链路模式进场：取学习课程与单元树；未选书时自动选第一本已激活解析版本的书（生成链路需要目录页窗） */
  useEffect(() => {
    if (mode !== 'chain' || !courseId) return;
    void loadChain(courseId);
    if (!bookId && books.length > 0) void selectBook(books[0].book_id);
  }, [mode, courseId, loadChain, bookId, books, selectBook]);

  const pageNumbers = useMemo(
    () => Object.keys(pages).map(Number).sort((a, b) => a - b),
    [pages],
  );

  /** 读目录页文本 + 正文样本页 → 交目录确认面板（裁决 ②：纯函数解析后人工确认） */
  const readTocPages = async () => {
    if (!bookId || !tocTofStart || !tocTofEnd || tocTofEnd < tocTofStart) {
      setImportError('请填写目录起页与止页（止页不早于起页）');
      return;
    }
    setImportBusy(true);
    setImportError(null);
    try {
      const tocPages = [];
      for (let pageNo = tocTofStart; pageNo <= tocTofEnd; pageNo += 1) {
        tocPages.push(await getBookPage(bookId, pageNo));
      }
      const lines = tocLinesFromBlockTexts(
        tocPages.flatMap((data) => blocksOf(data).map((block) => blockText(block))),
      );
      const from = bodyStart ?? tocTofEnd + 1;
      const bodyPages: BodyPageText[] = [];
      for (let i = 0; i < BODY_SAMPLE_PAGES; i += 1) {
        const pageNo = from + i;
        try {
          const data = await getBookPage(bookId, pageNo);
          bodyPages.push({ page: pageNo, text: blocksOf(data).map((b) => blockText(b)).join('\n') });
        } catch {
          break;
        }
      }
      if (lines.length === 0) setImportError('目录页没有可用文本块（确认页码或先完成解析）');
      setDraft({ lines, bodyPages });
    } catch (err) {
      setImportError(describeError(err));
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader
        actions={
          <Space>
            <Button icon={<LeftOutlined />} onClick={() => navigate('/learn')}>返回书架</Button>
            <Button onClick={() => navigate('/knowledge')}>返回星图</Button>
          </Space>
        }
      />
      <Layout.Content style={{ background: '#f5f7fa' }}>
        <div style={{ padding: '12px 16px 0' }}>
          <Title level={4} style={{ margin: 0 }}>
            {course?.name || courseId} · 学习工作台
          </Title>
          <Space size={10} align="center" style={{ marginTop: 8 }}>
            <Segmented
              value={mode}
              onChange={(value) => {
                const next = value as 'read' | 'chain';
                setMode(next);
                setRightTab(next === 'chain' ? 'progress' : 'annotation');
              }}
              options={[
                { label: '阅读（章节目录＋批注）', value: 'read' },
                { label: '链路（块序列＋推进）', value: 'chain' },
              ]}
            />
            {course?.track && <Text type="secondary">{course.track}</Text>}
          </Space>
        </div>
        {error && (
          <Alert
            style={{ margin: '12px 16px' }}
            type="warning"
            showIcon
            message="工作台数据不可达"
            description={`${describeError(error)}。8900 / 解析服务离线时逐栏降级，其他界面不受影响。`}
            action={<Button size="small" onClick={() => void fetchCourse(courseId)}>重试</Button>}
          />
        )}

        <div style={{ display: 'flex', gap: 12, padding: 16, alignItems: 'flex-start' }}>
          <Card size="small" title={mode === 'chain' ? '学习链路' : '目录'} style={paneStyle(280)}>
            {mode === 'chain' ? (
              <ChainTreePane courseId={courseId} outline={outline} bookId={bookId} typography={typography} />
            ) : (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Select
                size="small"
                aria-label="书籍"
                style={{ width: '100%' }}
                placeholder={books.length === 0 ? '本课暂无已激活解析版本的书' : '选择书籍'}
                value={bookId ?? undefined}
                onChange={(v: string) => void selectBook(v)}
                options={books.map((b) => ({ value: b.book_id, label: b.display_title || b.title || b.book_id }))}
              />
              <Button size="small" icon={<LeftOutlined rotate={180} />} disabled={!bookId} onClick={() => setImportOpen(true)}>
                导入目录
              </Button>
              {outline.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  这本书还没有章节目录：点「导入目录」从目录页解析后人工确认。
                </Text>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                  {outline.map((node) => (
                    <li key={node.kp_id} style={{ marginLeft: (node.depth ?? 1) === 2 ? 14 : 0 }}>
                      <Button
                        type={node.kp_id === selectedKpId ? 'primary' : 'text'}
                        size="small"
                        block
                        style={{ textAlign: 'left' }}
                        onClick={() => void selectNode(node.kp_id)}
                      >
                        {node.name}
                        <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
                          {node.point_count ?? 0}
                        </Text>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {loading && <Spin size="small" />}
            </Space>
            )}
          </Card>

          <Card
            size="small"
            title={mode === 'chain' ? '链路正文' : (range ? `正文 · 第 ${range.start}–${range.end} 页` : '正文')}
            style={paneStyle('1px')}
          >
            {mode === 'chain' ? (
              <ChainBodyPane courseId={courseId} outline={outline} bookId={bookId} typography={typography} />
            ) : (
            <>
            {!bookId || !selectedKpId ? (
              <Empty description="先在左栏选书并选中一章/一节" />
            ) : !range ? (
              <Empty description="该章节没有页范围（source_ref 缺失），请在管理面补录" />
            ) : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {pageNumbers.map((pageNo) => {
                  const entry = pages[pageNo];
                  if (!entry || entry.loading) return <Spin key={pageNo} size="small" />;
                  if (!entry.parsed) {
                    return (
                      <Text key={pageNo} type="secondary">
                        第 {pageNo} 页：{entry.error ?? '无解析产物'}
                      </Text>
                    );
                  }
                  const blocks = blocksOf(entry.data);
                  return (
                    <div key={pageNo}>
                      <Text type="secondary" style={{ fontSize: 12 }}>第 {pageNo} 页</Text>
                      <BlockList
                        bookId={bookId}
                        pageNo={pageNo}
                        blocks={blocks}
                        edits={{}}
                        renderMode="layout"
                        imageSize={null}
                        pageImageUrl={entry.data?.image_url ?? null}
                        typography={typography}
                        selectedIndex={selectedBlock?.page === pageNo ? selectedBlock.index : -1}
                        editMode={false}
                        onSelect={(index) => selectBlock({
                          page: pageNo,
                          index,
                          snippet: blockText(blocks[index] ?? { type: 'paragraph', bbox: [0, 0, 0, 0] }),
                        })}
                        onSubmit={async () => false}
                      />
                    </div>
                  );
                })}
                {loadedThrough < range.end && (
                  <Button size="small" onClick={() => void loadMorePages()}>
                    继续加载 {Math.min(PAGE_BATCH, range.end - loadedThrough)} 页
                  </Button>
                )}
              </Space>
            )}
            {selectedKpId && (
              <div style={{ marginTop: 16 }}>
                <Text strong style={{ fontSize: 13 }}>练习</Text>
                <PracticePane courseId={courseId} kpId={selectedKpId} />
              </div>
            )}
            </>
            )}
          </Card>

          <Card size="small" style={paneStyle(320)}>
            <Tabs
              size="small"
              activeKey={rightTab}
              onChange={setRightTab}
              items={[
                ...(mode === 'chain'
                  ? [{ key: 'progress', label: '进度与推进', children: <ChainProgressPane /> }]
                  : []),
                { key: 'annotation', label: '批注与候选', children: <AnnotationPane /> },
                {
                  key: 'practice',
                  label: '本章练习',
                  children: <ChapterPractice courseId={courseId} kpId={selectedKpId} />,
                },
              ]}
            />
          </Card>
        </div>
      </Layout.Content>

      <Modal
        open={importOpen}
        title="从目录页导入章节"
        width={720}
        footer={null}
        onCancel={() => setImportOpen(false)}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space size={6} wrap>
            <Text type="secondary" style={{ fontSize: 12 }}>目录起页</Text>
            <InputNumber size="small" aria-label="目录起页" min={1} value={tocTofStart} onChange={(v) => setTocStart(typeof v === 'number' ? v : null)} />
            <Text type="secondary" style={{ fontSize: 12 }}>目录止页</Text>
            <InputNumber size="small" aria-label="目录止页" min={1} value={tocTofEnd} onChange={(v) => setTocEnd(typeof v === 'number' ? v : null)} />
            <Text type="secondary" style={{ fontSize: 12 }}>正文起页（留空＝目录止页后一页，用于试算偏移）</Text>
            <InputNumber size="small" aria-label="正文起页" min={1} value={bodyStart} onChange={(v) => setBodyStart(typeof v === 'number' ? v : null)} />
          </Space>
          <Space size={6}>
            <Button size="small" type="primary" loading={importBusy} onClick={() => void readTocPages()}>
              读取目录页
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>全书 {book?.page_count ?? '?'} 页</Text>
          </Space>
          {importError && <Text type="warning" style={{ fontSize: 12 }}>{importError}</Text>}
          {draft && book && (
            <TocConfirmPanel
              courseId={courseId}
              bookRef={bookId ?? ''}
              initialLines={draft.lines}
              pageCount={book.page_count ?? draft.lines.length}
              bodyPages={draft.bodyPages}
              onSaved={() => {
                setImportOpen(false);
                void reloadOutline();
              }}
            />
          )}
        </Space>
      </Modal>
    </Layout>
  );
}
