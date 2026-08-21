import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Layout, Progress, Row, Select, Space, Spin, Tag, Tree, Typography } from 'antd';
import { ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import AppHeader from '../components/AppHeader';
import BlockView from '../components/BlockView';
import { describeError } from '../api/client';
import { useParsingStore, buildParsingTree, type ParsingBook, type ParsingTreeNode } from '../stores/parsing';

const { Title, Text } = Typography;

const PAGE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '待解析', color: 'default' },
  parsing: { label: '解析中', color: 'processing' },
  completed: { label: '已解析', color: 'success' },
  failed: { label: '失败', color: 'error' },
};

/** 书目节点 title：书名 + 进度 x/y + 状态标签 + 策略 */
function BookNodeTitle({ book }: { book: ParsingBook }) {
  const total = book.page_count ?? 0;
  const done = book.pages_done ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const st = PAGE_STATUS_LABELS[book.parse_status ?? (total > 0 && done >= total ? 'completed' : 'pending')];
  return (
    <Space size={6} style={{ width: '100%' }}>
      <Text style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
        {book.display_title || book.title || book.book_id}
      </Text>
      <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
        {done}/{total || '?'} 页
      </Text>
      <Progress percent={pct} size="small" style={{ width: 48, flexShrink: 0 }} />
      <Tag color={st.color} style={{ flexShrink: 0, marginInlineEnd: 0 }}>{st.label}</Tag>
      <Tag style={{ flexShrink: 0, marginInlineEnd: 0 }}>{book.strategy === 'hybrid' ? '混合兜底' : '本地引擎'}</Tag>
    </Space>
  );
}

/** 树 title（领域/课程/书目） */
function treeTitle(node: ParsingTreeNode): React.ReactNode {
  if (node.type === 'book' && node.book) return <BookNodeTitle book={node.book} />;
  return node.title;
}

/**
 * 文档解析管理（`#/admin/parsing`，原「解析进度」改名，2026-08-18 重构轮）
 * - 左：书目树（领域 → 课程折叠 → 书目+解析进度；数据源 af_books 冗余课程字段，REQ-042）
 * - 右：对照分析（原页图 + 块级渲染；块可选中并判定 一致/不一致 + 备注，落库 af_block_reviews）
 * - 顶部：同步书目（前端触发）+ 刷新；进入界面自动同步一次
 * - 8902 离线（503）→ 降级横幅；内容修改功能暂缓（后续轮）
 */
export default function Parsing() {
  const books = useParsingStore((s) => s.books);
  const loading = useParsingStore((s) => s.loading);
  const error = useParsingStore((s) => s.error);
  const dataError = useParsingStore((s) => s.dataError);
  const syncing = useParsingStore((s) => s.syncing);
  const syncMessage = useParsingStore((s) => s.syncMessage);
  const syncError = useParsingStore((s) => s.syncError);
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

  useEffect(() => {
    void fetchBooks(true);
  }, [fetchBooks]);

  const tree = useMemo(() => buildParsingTree(books), [books]);

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

  return (
    <Layout style={{ minHeight: '100vh', background: '#eef3fb' }}>
      <AppHeader
        actions={
          <Space>
            <Button
              type="primary" ghost icon={<SyncOutlined />} loading={syncing}
              style={{ color: '#ffffff', borderColor: '#ffffff' }}
              onClick={() => void fetchBooks(true)}
            >
              同步书目
            </Button>
            <Button
              type="primary" ghost icon={<ReloadOutlined />} loading={loading}
              style={{ color: '#ffffff', borderColor: '#ffffff' }}
              onClick={() => void fetchBooks(false)}
            >
              刷新
            </Button>
          </Space>
        }
      />
      <Layout.Content style={{ padding: 24, maxWidth: 1600, width: '96%', margin: '0 auto' }}>
        <Title level={2} style={{ marginTop: 0 }}>文档解析管理</Title>

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
            description={`${describeError(dataError)}。8902 离线时展示降级，不阻塞其他界面。`}
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
            <Card size="small" title="书目（按课程）" styles={{ body: { padding: 8 } }}>
              {books.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={loading ? '加载中…' : dataError ? '8902 离线，暂无书目数据' : '暂无书目（点「同步书目」拉取已验证文档）'} />
              ) : (
                <Tree
                  blockNode
                  defaultExpandAll
                  showLine={false}
                  treeData={tree.map((n) => ({
                    key: n.key,
                    title: treeTitle(n),
                    children: n.children?.map((c) => ({
                      key: c.key,
                      title: treeTitle(c),
                      children: c.children?.map((b) => ({ key: b.key, title: treeTitle(b) })),
                    })),
                  }))}
                  onSelect={(_keys, info) => {
                    if (info.node && info.node.key) {
                      const node = findNode(tree, String(info.node.key));
                      if (node) onSelectBook(node);
                    }
                  }}
                  style={{ background: 'transparent' }}
                />
              )}
            </Card>
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
    </Layout>
  );
}

/** 从树中按 key 找节点 */
function findNode(nodes: ParsingTreeNode[], key: string): ParsingTreeNode | null {
  for (const n of nodes) {
    if (n.key === key) return n;
    if (n.children) {
      const hit = findNode(n.children, key);
      if (hit) return hit;
    }
  }
  return null;
}