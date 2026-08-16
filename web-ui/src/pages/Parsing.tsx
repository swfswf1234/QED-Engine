import { useEffect } from 'react';
import { Alert, Button, Layout, Progress, Space, Table, Tag, Typography } from 'antd';
import { ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useParsingStore } from '../stores/parsing';
import type { ParsingBook } from '../stores/parsing';
import { describeError } from '../api/client';

const { Title, Text } = Typography;

const STATUS_LABELS: Record<string, string> = {
  completed: '已解析',
  parsing: '解析中',
  pending: '待解析',
  failed: '失败',
};

/**
 * 文档解析管理 · 解析进度（`#/admin/parsing`）
 * - 书目列表（8902 /books）：页完成进度 + 状态
 * - 8902 离线（503）→ 降级横幅；「原始文档对照」入口进对比视图
 */
export default function Parsing() {
  const books = useParsingStore((s) => s.books);
  const loading = useParsingStore((s) => s.loading);
  const error = useParsingStore((s) => s.error);
  const dataError = useParsingStore((s) => s.dataError);
  const fetchBooks = useParsingStore((s) => s.fetchBooks);
  const openCompare = useParsingStore((s) => s.openCompare);
  const navigate = useNavigate();

  useEffect(() => {
    void fetchBooks();
  }, [fetchBooks]);

  return (
    <Layout style={{ minHeight: '100vh', background: '#eef3fb' }}>
      <AppHeader
        actions={
          <Button
            type="primary" ghost icon={<ReloadOutlined />} loading={loading}
            style={{ color: '#ffffff', borderColor: '#ffffff' }} onClick={() => void fetchBooks()}
          >
            刷新
          </Button>
        }
      />
      <Layout.Content style={{ padding: 32, maxWidth: 1280, width: '92%', margin: '0 auto' }}>
        <Title level={2} style={{ marginTop: 0 }}>文档解析管理</Title>

        {error && (
          <Alert
            type="error" showIcon style={{ marginBottom: 16 }}
            message="解析进度数据获取失败"
            description={`${error}。请确认 8900 管理服务已启动后点「刷新」。`}
          />
        )}
        {!error && dataError && (
          <Alert
            type="warning" showIcon style={{ marginBottom: 16 }}
            message="Axiom-Flow 数据不可达"
            description={`${describeError(dataError)}。8902 离线时展示降级，不阻塞其他界面。`}
          />
        )}

        <Table<ParsingBook>
          rowKey="book_id"
          loading={loading}
          dataSource={books}
          locale={{ emptyText: dataError ? '8902 离线，暂无书目数据' : '暂无解析书目' }}
          pagination={false}
          columns={[
            {
              title: '书目',
              dataIndex: 'title',
              render: (title: string, row) => (
                <Space direction="vertical" size={0}>
                  <Text strong>{title || row.book_id}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{row.book_id}</Text>
                </Space>
              ),
            },
            {
              title: '作者 / 策略',
              dataIndex: 'author',
              render: (author: string, row) => (
                <Space direction="vertical" size={0}>
                  <Text>{author || '—'}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {row.strategy === 'local' ? '本地引擎' : row.strategy === 'hybrid' ? '混合兜底' : row.strategy}
                  </Text>
                </Space>
              ),
            },
            {
              title: '解析进度',
              dataIndex: 'pages_done',
              render: (done: number, row) => {
                const total = row.page_count ?? 0;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <Space>
                    <Progress percent={pct} size="small" style={{ width: 160 }} />
                    <Text type="secondary">
                      {done}/{total} 页{row.progressUnknown ? '（进度未知）' : ''}
                    </Text>
                  </Space>
                );
              },
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (status?: string) => {
                const label = STATUS_LABELS[status ?? ''] ?? status ?? '未知';
                const color = status === 'completed' ? 'success' : status === 'parsing' ? 'processing' : status === 'failed' ? 'error' : 'default';
                return <Tag color={color}>{label}</Tag>;
              },
            },
            {
              title: '操作',
              render: (_, row) => (
                <Button
                  size="small" icon={<EyeOutlined />}
                  onClick={() => {
                    void openCompare(row.book_id);
                    navigate('/admin/compare');
                  }}
                >
                  原始文档对照
                </Button>
              ),
            },
          ]}
        />
      </Layout.Content>
    </Layout>
  );
}