import { useEffect, useMemo } from 'react';
import { Alert, Button, Card, Col, Empty, Layout, Row, Select, Space, Spin, Typography } from 'antd';
import { LeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import MarkdownView from '../components/MarkdownView';
import { useParsingStore } from '../stores/parsing';
import { describeError } from '../api/client';

const { Title, Text } = Typography;

/**
 * 文档解析管理 · 原始文档对照（`#/admin/compare`）
 * - 左：原页图（8902 页图 URL）；右：markdown 渲染（KaTeX 公式）
 * - 页选择：Select（1..pages_total）；8902 离线 → 降级提示
 */
export default function Compare() {
  const books = useParsingStore((s) => s.books);
  const compareBookId = useParsingStore((s) => s.compareBookId);
  const comparePageNo = useParsingStore((s) => s.comparePageNo);
  const pageData = useParsingStore((s) => s.pageData);
  const pageLoading = useParsingStore((s) => s.pageLoading);
  const pageError = useParsingStore((s) => s.pageError);
  const manifest = useParsingStore((s) => s.manifest);
  const openCompare = useParsingStore((s) => s.openCompare);
  const loadPage = useParsingStore((s) => s.loadPage);
  const clearCompare = useParsingStore((s) => s.clearCompare);
  const navigate = useNavigate();

  const book = useMemo(
    () => books.find((b) => b.book_id === compareBookId) ?? null,
    [books, compareBookId],
  );
  const pagesTotal = book?.page_count ?? 1;

  useEffect(() => {
    // 直接进入（无选中书）→ 默认第一本
    if (!compareBookId && books.length > 0) {
      void openCompare(books[0].book_id);
      return;
    }
    // 深链/刷新后：已选中书但页数据未加载 → 自动加载当前页
    if (compareBookId && !pageData && !pageLoading && !pageError) {
      void loadPage(compareBookId, comparePageNo ?? 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, compareBookId, pageData, pageLoading, pageError]);

  return (
    <Layout style={{ minHeight: '100vh', background: '#eef3fb' }}>
      <AppHeader
        actions={
          <Space>
            <Button ghost style={{ color: '#ffffff', borderColor: '#ffffff' }} onClick={() => navigate('/admin/parsing')}>
              返回解析进度
            </Button>
            <Button
              type="primary" ghost icon={<ReloadOutlined />}
              style={{ color: '#ffffff', borderColor: '#ffffff' }}
              onClick={() => compareBookId && void loadPage(compareBookId, comparePageNo ?? 1)}
            >
              刷新
            </Button>
          </Space>
        }
      />
      <Layout.Content style={{ padding: 32, maxWidth: 1400, width: '94%', margin: '0 auto' }}>
        <Title level={2} style={{ marginTop: 0 }}>
          <Space>
            原始文档对照
            <Button size="small" icon={<LeftOutlined />} onClick={() => { clearCompare(); navigate('/admin/parsing'); }}>
              返回
            </Button>
          </Space>
        </Title>

        {!compareBookId && books.length === 0 && (
          <Empty description="暂无对照数据（8902 离线或没有已解析书目）" style={{ marginTop: 60 }} />
        )}

        {compareBookId && (
          <>
            <Space style={{ marginBottom: 16 }} wrap>
              <Select
                style={{ width: 260 }} aria-label="选择书目"
                value={compareBookId}
                options={books.map((b) => ({ value: b.book_id, label: b.title || b.book_id }))}
                onChange={(v) => void openCompare(v)}
              />
              <Text strong>{book?.title ?? compareBookId}</Text>
              <Select
                style={{ width: 120 }} aria-label="选择页码"
                value={comparePageNo ?? 1}
                options={Array.from({ length: pagesTotal }, (_, i) => ({ value: i + 1, label: `第 ${i + 1} 页` }))}
                onChange={(v) => compareBookId && void loadPage(compareBookId, v)}
              />
              <Text type="secondary">产物 {manifest.length} 项</Text>
            </Space>

            {pageError && (
              <Alert
                type="warning" showIcon style={{ marginBottom: 16 }}
                message="页数据获取失败"
                description={describeError(pageError)}
              />
            )}

            <Spin spinning={pageLoading}>
              <Row gutter={16}>
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
                  <Card size="small" title="解析结果（markdown + 公式渲染）" styles={{ body: { padding: 12 } }}>
                    {pageData?.markdown ? (
                      <MarkdownView markdown={pageData.markdown} />
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={pageLoading ? '加载中…' : '暂无解析内容'} />
                    )}
                  </Card>
                </Col>
              </Row>
            </Spin>
          </>
        )}
      </Layout.Content>
    </Layout>
  );
}