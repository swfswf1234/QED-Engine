import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Layout, Row, Select, Space, Spin, Tag, Typography } from 'antd';
import { CaretRightFilled, ReloadOutlined } from '@ant-design/icons';
import BlockView from '../components/BlockView';
import { describeError } from '../api/client';
import { useParsingStore, type ParsingTreeNode } from '../stores/parsing';
import '../downloads.css';

const { Title, Text } = Typography;

/**
 * 文档解析管理（`#/admin/parsing`，原「解析进度」改名，2026-08-18 重构轮）
 * - 左：书目树（领域 → 课程折叠 → 书目+解析进度；ARCH-020：数据源从 /parsing/tree 获取）
 * - 右：对照分析（原页图 + 块级渲染；块可选中并判定 一致/不一致 + 备注，落库 af_block_reviews）
 * - 顶部：同步书目（前端触发）+ 刷新；进入界面自动加载树
 * - 8902 离线（503）→ 降级横幅（领域→课程仍显示，书目为空）；内容修改功能暂缓（后续轮）
 */
export default function Parsing() {
  const tree = useParsingStore((s) => s.tree);
  const treeLoading = useParsingStore((s) => s.treeLoading);
  const treeError = useParsingStore((s) => s.treeError);
  const books = useParsingStore((s) => s.books);
  const loading = useParsingStore((s) => s.loading);
  const error = useParsingStore((s) => s.error);
  const dataError = useParsingStore((s) => s.dataError);
  const syncMessage = useParsingStore((s) => s.syncMessage);
  const syncError = useParsingStore((s) => s.syncError);
  const fetchTree = useParsingStore((s) => s.fetchTree);
  const fetchBooks = useParsingStore((s) => s.fetchBooks);

  const compareBookId = useParsingStore((s) => s.compareBookId);
  const comparePageNo = useParsingStore((s) => s.comparePageNo);
  const pageData = useParsingStore((s) => s.pageData);
  const pageLoading = useParsingStore((s) => s.pageLoading);
  const pageError = useParsingStore((s) => s.pageError);
  const blockReviews = useParsingStore((s) => s.blockReviews);
  const reviewSubmitting = useParsingStore((s) => s.reviewSubmitting);
  const openCompare = useParsingStore((s) => s.openCompare);
  const loadPage = useParsingStore((s) => s.loadPage);
  const submitReview = useParsingStore((s) => s.submitReview);

  const [selectedBlock, setSelectedBlock] = useState(-1);

  // ARCH-020：进入界面时加载左侧树
  useEffect(() => {
    void fetchTree();
  }, [fetchTree]);

  const book = useMemo(
    () => books.find((b) => b.book_id === compareBookId) ?? null,
    [books, compareBookId],
  );
  const pagesTotal = book?.page_count ?? 1;

  // 块列表（BlocksPage.blocks 或平铺 blocks）
  const blocks = useMemo(() => {
    const raw = pageData?.blocks ?? null;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return raw.blocks ?? [];
  }, [pageData]);

  // 选中书目：默认第一本（树展开时亦可点击选择）
  useEffect(() => {
    if (!compareBookId && books.length > 0) {
      void openCompare(books[0].book_id);
      return;
    }
    if (compareBookId && !pageData && !pageLoading && !pageError) {
      void loadPage(compareBookId, comparePageNo ?? 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, compareBookId, pageData, pageLoading, pageError]);

  const reviewKey = useCallback(
    (index: number) => `${compareBookId}:${comparePageNo}:${index}`,
    [compareBookId, comparePageNo],
  );

  const onSelectBook = useCallback(
    (node: ParsingTreeNode) => {
      if (node.type === 'book' && node.book) {
        setSelectedBlock(-1);
        void openCompare(node.book.book_id);
      }
    },
    [openCompare],
  );

  const onReview = useCallback(
    async (index: number, verdict: 'ok' | 'bad', note?: string) => {
      const b = blocks[index];
      if (!b || !compareBookId || !comparePageNo) return;
      await submitReview(compareBookId, comparePageNo, index, b.type, verdict, note);
      setSelectedBlock(-1); // 判定完成收起弹层（块上 Tag 回显）
    },
    [blocks, compareBookId, comparePageNo, submitReview],
  );

  // ARCH-020：刷新按钮 - 同步书目后重新加载树
  const onRefresh = useCallback(async () => {
    await fetchBooks(true); // 先同步
    await fetchTree();      // 再重新加载树
  }, [fetchBooks, fetchTree]);

  // 默认展开：第一个领域 + 其下所有课程
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [treeInited, setTreeInited] = useState(false);

  useEffect(() => {
    if (!treeInited && tree.length > 0) {
      const first = tree[0];
      setExpandedDomains(new Set([first.key]));
      if (first.children?.length) {
        setExpandedCourses(new Set(first.children.map((c) => c.key)));
      }
      setTreeInited(true);
    }
  }, [tree, treeInited]);

  const toggleDomain = useCallback((key: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleCourse = useCallback((key: string) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  return (
    <Layout.Content style={{ padding: 24, maxWidth: 1600, width: '96%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>文档解析管理</Title>
        <Button icon={<ReloadOutlined />} loading={treeLoading || loading} onClick={() => void onRefresh()}>
          刷新
        </Button>
      </div>

      {error && (
          <Alert
            type="error" showIcon style={{ marginBottom: 16 }}
            message="解析数据获取失败"
            description={`${describeError(error)}。请确认 8900 管理服务已启动后点「刷新」。`}
          />
        )}
        {!error && dataError && (
          <Alert
            type="warning" showIcon style={{ marginBottom: 16 }}
            message="Axiom-Flow 数据不可达"
            description={`${describeError(dataError)}。8902 离线时仍显示领域和课程，书目暂不可用。`}
          />
        )}
        {syncMessage && !dataError && (
          <Alert type="success" showIcon style={{ marginBottom: 16 }} message={syncMessage} />
        )}
        {syncError && (
          <Alert
            type="warning" showIcon style={{ marginBottom: 16 }}
            message="书目同步未完成"
            description={`${describeError(syncError)}。同步失败不阻塞查看已同步书目。`}
          />
        )}

        <Row gutter={16}>
          <Col xs={24} lg={7}>
            <div className="dl-tree-wrap" style={{ height: '100%' }}>
              <div className="dl-tree" role="tree" aria-label="书目目录树">
                {tree.length === 0 && !treeLoading ? (
                  <div className="dl-tree-empty">
                    {treeError ? '加载失败，请点「刷新」重试' : dataError ? '8902 离线，暂无书目数据（领域和课程已加载）' : '暂无课程数据'}
                  </div>
                ) : (
                  tree.map((domain) => {
                    const dExpanded = expandedDomains.has(domain.key);
                    return (
                      <div
                        key={domain.key}
                        className={`dl-tree-node dl-tree-domain${dExpanded ? ' expanded' : ''}`}
                        role="treeitem"
                      >
                        <span
                          className="dl-tree-caret dl-tree-caret-domain"
                          onClick={() => toggleDomain(domain.key)}
                        >
                          <CaretRightFilled rotate={dExpanded ? 90 : 0} />
                        </span>
                        <span className="dl-tree-name">{domain.title}</span>
                        {domain.children?.length ? (
                          <span className="dl-tree-count">{domain.children.length} 门课程</span>
                        ) : null}
                        {dExpanded && domain.children?.length ? (
                          <div className="dl-tree-children">
                            {domain.children.map((course) => {
                              const cExpanded = expandedCourses.has(course.key);
                              return (
                                <div
                                  key={course.key}
                                  className={`dl-tree-node dl-tree-course${cExpanded ? ' expanded' : ''}`}
                                >
                                  <span
                                    className="dl-tree-caret"
                                    onClick={() => toggleCourse(course.key)}
                                  >
                                    <CaretRightFilled rotate={cExpanded ? 90 : 0} />
                                  </span>
                                  <span className="dl-tree-name">{course.title}</span>
                                  {course.children?.length ? (
                                    <span className="dl-tree-count">{course.children.length} 本</span>
                                  ) : null}
                                  {cExpanded && course.children?.length ? (
                                    <div className="dl-tree-children">
                                      {course.children.map((bookNode) => (
                                        <div
                                          key={bookNode.key}
                                          className={`dl-tree-node dl-tree-book${compareBookId && bookNode.book?.book_id === compareBookId ? ' selected' : ''}`}
                                          role="treeitem"
                                          onClick={() => bookNode.book && onSelectBook(bookNode)}
                                        >
                                          <span className="dl-tree-caret dl-tree-caret-disabled" />
                                          <span className="dl-tree-name">
                                            {bookNode.book?.display_title || bookNode.book?.title || bookNode.book?.book_id || bookNode.title}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Col>

          <Col xs={24} lg={17}>
            {!compareBookId && books.length === 0 && (
              <Empty description="暂无对照数据（8902 离线或没有已解析书目）" style={{ marginTop: 60 }} />
            )}

            {compareBookId && (
              <Card
                size="small"
                title={
                  <Space wrap>
                    <Text strong>{book?.display_title || book?.title || compareBookId}</Text>
                    <Select
                      style={{ width: 110 }} aria-label="选择页码"
                      value={comparePageNo ?? 1}
                      options={Array.from({ length: pagesTotal }, (_, i) => ({ value: i + 1, label: `第 ${i + 1} 页` }))}
                      onChange={(v) => { setSelectedBlock(-1); void loadPage(compareBookId, v); }}
                    />
                  </Space>
                }
                styles={{ body: { padding: 12 } }}
              >
                {pageError && (
                  <Alert
                    type="warning" showIcon style={{ marginBottom: 12 }}
                    message="页数据获取失败"
                    description={describeError(pageError)}
                  />
                )}

                <Spin spinning={pageLoading}>
                  <Row gutter={12}>
                    <Col xs={24} lg={11}>
                      <Card size="small" title="原页图" styles={{ body: { padding: 8 } }}>
                        {pageData?.image_url ? (
                          <img
                            src={pageData.image_url}
                            alt={`第 ${pageData.page_no} 页原图`}
                            style={{ width: '100%', border: '1px solid #eee', borderRadius: 4 }}
                          />
                        ) : (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无页图" />
                        )}
                      </Card>
                    </Col>
                    <Col xs={24} lg={13}>
                      <Card
                        size="small"
                        title={<Space>解析结果（块级）<Text type="secondary" style={{ fontSize: 12 }}>点击块可判定一致/不一致</Text></Space>}
                        styles={{ body: { padding: 12 } }}
                      >
                        {blocks.length > 0 ? (
                          <BlockView
                            blocks={blocks}
                            selectedIndex={selectedBlock}
                            onSelect={setSelectedBlock}
                            onSubmit={onReview}
                            reviews={blockReviews}
                            reviewKey={reviewKey}
                            submitting={reviewSubmitting}
                          />
                        ) : (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={pageLoading ? '加载中…' : '该页暂无解析块'} />
                        )}
                      </Card>
                    </Col>
                  </Row>
                </Spin>
              </Card>
            )}
          </Col>
        </Row>
    </Layout.Content>
  );
}
