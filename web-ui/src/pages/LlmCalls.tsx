import { useEffect, useState } from 'react';
import { Alert, Button, Input, Layout, Select, Space, Table, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import AppHeader from '../components/AppHeader';
import { useLlmCallsStore, type LlmCallsFilters } from '../stores/llmCalls';
import type { LlmCallItem } from '../stores';

const { Title, Text } = Typography;

/** 摘要截断长度 */
const SUMMARY_MAX = 80;

const SERVICE_OPTIONS = [
  { value: 'qed_engine', label: 'qed_engine' },
  { value: 'qed_tracker', label: 'qed_tracker' },
  { value: 'axiom_flow', label: 'axiom_flow' },
];

const MODE_OPTIONS = [
  { value: 'api', label: 'api' },
  { value: 'local', label: 'local' },
];

const STATUS_OPTIONS = [
  { value: 'success', label: '成功' },
  { value: 'error', label: '失败' },
];

const CALL_STATUS: Record<string, { label: string; color: string }> = {
  success: { label: '成功', color: 'green' },
  error: { label: '失败', color: 'red' },
};

/** 摘要截断：超过 max 字加省略号 */
function truncate(text: string, max = SUMMARY_MAX): string {
  const t = String(text ?? '');
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * 模型调用记录检索（`#/admin/llm-calls`，LLM 网关改造轮 P2 收尾）
 * - 数据源：GET /api/v1/llm/calls（qed_llm_calls 表，分页 + 过滤）
 * - 筛选栏：service / mode / status / model 关键字 / start-end 日期；「查询」应用，「重置」清空
 * - 表格：ID / 时间 / service / mode / 模型 / 耗时 / 状态（Tag 着色）/ 摘要（截断 80 字）
 * - 展开行显示完整 prompt / response / error（含端点与模板）
 */
export default function LlmCalls() {
  const items = useLlmCallsStore((s) => s.items);
  const total = useLlmCallsStore((s) => s.total);
  const page = useLlmCallsStore((s) => s.page);
  const size = useLlmCallsStore((s) => s.size);
  const loading = useLlmCallsStore((s) => s.loading);
  const error = useLlmCallsStore((s) => s.error);
  const setFilters = useLlmCallsStore((s) => s.setFilters);
  const setPage = useLlmCallsStore((s) => s.setPage);
  const fetch = useLlmCallsStore((s) => s.fetch);

  const [draft, setDraft] = useState<LlmCallsFilters>({});

  useEffect(() => {
    void fetch();
  }, [fetch]);

  /** 「查询」：应用草稿筛选（自动回第 1 页）并请求 */
  const query = () => {
    setFilters(draft);
    void fetch();
  };

  /** 「重置」：清空草稿与 store 筛选并请求 */
  const reset = () => {
    setDraft({});
    setFilters({});
    void fetch();
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#eef3fb' }}>
      <AppHeader
        actions={
          <Button
            type="primary" ghost icon={<ReloadOutlined />} loading={loading}
            style={{ color: '#ffffff', borderColor: '#ffffff' }} onClick={() => void fetch()}
          >
            刷新
          </Button>
        }
      />
      <Layout.Content style={{ padding: 32, maxWidth: 1400, width: '94%', margin: '0 auto' }}>
        <Title level={2} style={{ marginTop: 0 }}>模型调用记录</Title>

        {error && (
          <Alert
            type="error" showIcon style={{ marginBottom: 16 }}
            message="调用记录获取失败"
            description={`${error}。请确认 8900 管理服务已启动后点「刷新」。`}
          />
        )}

        <Space size={8} wrap style={{ marginBottom: 16 }}>
          <Text type="secondary">筛选</Text>
          <Select
            allowClear placeholder="服务" style={{ width: 130 }} aria-label="服务筛选"
            value={draft.service || undefined}
            options={SERVICE_OPTIONS}
            onChange={(v) => setDraft({ ...draft, service: v ?? '' })}
          />
          <Select
            allowClear placeholder="模式" style={{ width: 110 }} aria-label="模式筛选"
            value={draft.mode || undefined}
            options={MODE_OPTIONS}
            onChange={(v) => setDraft({ ...draft, mode: v ?? '' })}
          />
          <Select
            allowClear placeholder="状态" style={{ width: 110 }} aria-label="状态筛选"
            value={draft.status || undefined}
            options={STATUS_OPTIONS}
            onChange={(v) => setDraft({ ...draft, status: v ?? '' })}
          />
          <Input
            allowClear placeholder="模型关键字" style={{ width: 150 }} aria-label="模型筛选"
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
          />
          <Input
            type="date" style={{ width: 140 }} aria-label="开始日期"
            value={draft.start}
            onChange={(e) => setDraft({ ...draft, start: e.target.value })}
          />
          <Input
            type="date" style={{ width: 140 }} aria-label="结束日期"
            value={draft.end}
            onChange={(e) => setDraft({ ...draft, end: e.target.value })}
          />
          <Button type="primary" onClick={query}>查询</Button>
          <Button onClick={reset}>重置</Button>
        </Space>

        <Table<LlmCallItem>
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={items}
          pagination={{
            current: page,
            pageSize: size,
            total,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p) => {
              setPage(p);
              void fetch();
            },
          }}
          expandable={{
            expandedRowRender: (r) => (
              <div className="llm-call-detail" style={{ padding: '8px 16px', maxWidth: 1200 }}>
                <Text strong>Prompt</Text>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{r.prompt || '（空）'}</pre>
                <Text strong>Response</Text>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{r.response || '（空）'}</pre>
                {r.error && (
                  <>
                    <Text strong>错误</Text>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{r.error}</pre>
                  </>
                )}
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">端点：{r.endpoint}</Text>
                  {r.prompt_template != null && (
                    <Text type="secondary" style={{ marginLeft: 16 }}>模板：{r.prompt_template}</Text>
                  )}
                </div>
              </div>
            ),
          }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 60 },
            { title: '时间', dataIndex: 'created_at', width: 170 },
            { title: 'service', dataIndex: 'service', width: 130 },
            { title: 'mode', dataIndex: 'mode', width: 90 },
            {
              title: '模型',
              key: 'model',
              width: 180,
              render: (_, r) => `${r.provider ?? '-'} / ${r.model ?? '-'}`,
            },
            {
              title: '耗时',
              key: 'duration_ms',
              width: 90,
              render: (_, r) => (r.duration_ms != null ? `${r.duration_ms} ms` : '-'),
            },
            {
              title: '状态',
              key: 'status',
              width: 90,
              render: (_, r) => (
                <Tag color={CALL_STATUS[r.status]?.color} style={{ marginInlineEnd: 0 }}>
                  {CALL_STATUS[r.status]?.label ?? r.status}
                </Tag>
              ),
            },
            {
              title: '摘要',
              key: 'summary',
              render: (_, r) => (
                <span title={[r.prompt, r.response].filter(Boolean).join('\n')}>
                  {[truncate(r.prompt), truncate(r.response)].filter(Boolean).join(' → ')}
                </span>
              ),
            },
          ]}
        />
      </Layout.Content>
    </Layout>
  );
}
