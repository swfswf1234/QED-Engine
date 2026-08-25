import { useEffect, useMemo, useState } from 'react';
import { Alert, AutoComplete, Button, DatePicker, Layout, Select, Space, Table, Tag, Typography, message } from 'antd';
import { ReloadOutlined, CopyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLlmCallsStore, type LlmCallsFilters } from '../stores/llmCalls';
import type { LlmCallItem } from '../stores';

const { Title, Text } = Typography;

/** 预览单行截断长度 */
const LINE_MAX = 100;
/** hover 提示最大字符数 */
const TITLE_MAX = 500;
/** 展开行 JSON 展示行数上限 */
const JSON_PREVIEW_LINES = 10;

const SERVICE_OPTIONS = [
  { value: 'qed_engine', label: 'qed_engine' },
  { value: 'qed_tracker', label: 'qed_tracker' },
  { value: 'axiom_flow', label: 'axiom_flow' },
];

const STATUS_OPTIONS = [
  { value: 'success', label: '成功' },
  { value: 'error', label: '失败' },
];

const REVIEW_STATUS_OPTIONS = [
  { value: 'unreviewed', label: '未审核' },
  { value: 'passed', label: '通过' },
  { value: 'rejected', label: '驳回' },
];

const CALL_STATUS: Record<string, { label: string; color: string }> = {
  success: { label: '成功', color: 'green' },
  error: { label: '失败', color: 'red' },
};

const REVIEW_STATUS_TAG: Record<string, { label: string; color: string }> = {
  unreviewed: { label: '未审核', color: 'default' },
  passed: { label: '通过', color: 'green' },
  rejected: { label: '驳回', color: 'red' },
};

function truncate(text: string, max = TITLE_MAX): string {
  const t = String(text ?? '');
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** 内容预览文本：输入的前两个非空行（单行超长再截断），超出加省略号 */
function previewTwoLines(text: string): string {
  const lines = String(text ?? '').split('\n');
  const shown: string[] = [];
  for (const l of lines) {
    if (!l.trim()) continue;
    shown.push(l.length > LINE_MAX ? `${l.slice(0, LINE_MAX)}…` : l);
    if (shown.length >= 2) break;
  }
  const nonEmpty = lines.filter((l) => l.trim()).length;
  return shown.join('\n') + (nonEmpty > shown.length ? '\n…' : '');
}

/** 双向尝试 JSON 美化：可解析则缩进两格展示，否则原样 */
function prettyJson(text: string | null | undefined): string {
  const t = String(text ?? '');
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return t;
  }
}

/** 只取前 n 行展示，超出加「…（共 N 行）」尾注 */
function firstLines(text: string, n = JSON_PREVIEW_LINES): string {
  if (!text) return '';
  const lines = text.split('\n');
  return lines.length > n ? `${lines.slice(0, n).join('\n')}\n…（共 ${lines.length} 行）` : text;
}

/** 折叠阈值：超过任一即折叠（2026-08-25 用户反馈：超长单逻辑行被 pre-wrap 折成近百视觉行） */
const COLLAPSE_CHARS = 500;

/** JSON 内容区块：>500 字或 >10 行折叠为前 10 行 + 展开全部/收起；复制始终取全文（由 SectionHeader 负责） */
function JsonBlock({ raw }: { raw: string | null | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const pretty = prettyJson(raw);
  const lineCount = pretty ? pretty.split('\n').length : 0;
  const needFold = pretty.length > COLLAPSE_CHARS || lineCount > JSON_PREVIEW_LINES;
  const shown = needFold && !expanded ? firstLines(pretty) : pretty;
  return (
    <>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#fafafa', padding: 8, borderRadius: 4 }}>
        {shown || '（空）'}
      </pre>
      {needFold && !expanded && (
        <Button type="link" size="small" style={{ paddingLeft: 0 }} onClick={() => setExpanded(true)}>
          展开全部（{lineCount} 行 / {pretty.length} 字）
        </Button>
      )}
      {needFold && expanded && (
        <Button type="link" size="small" style={{ paddingLeft: 0 }} onClick={() => setExpanded(false)}>
          收起
        </Button>
      )}
    </>
  );
}

/** 复制到剪贴板并提示 */
async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text ?? '');
    message.success(`${label} 已复制`);
  } catch {
    message.error('复制失败，请手动选择');
  }
}

/** 内容预览单元格：输入的前两行，hover 显示前 500 字 */
function ContentPreview({ text }: { text: string | null }) {
  if (!text || !String(text).trim()) return <Text type="secondary">-</Text>;
  return (
    <span
      title={truncate(String(text))}
      style={{ cursor: 'default', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}
    >
      {previewTwoLines(String(text))}
    </span>
  );
}

/** 展开行内容区块标题：标题 + 全文复制按钮 */
function SectionHeader({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text strong>{label}</Text>
      <Button
        type="text" size="small" icon={<CopyOutlined />}
        onClick={() => void copyToClipboard(text, label)}
      >
        复制
      </Button>
    </div>
  );
}

/**
 * 模型调用记录检索（`#/admin/llm-calls`）
 * - 筛选栏：日期范围 / 服务 / 状态 / 模型（AutoComplete 可输可选）/ 审核状态
 * - 表格：展开图标在末列；内容预览=输入前两行（hover 更多）
 * - 展开行：Prompt/Response JSON 美化、只展示前 10 行、按钮复制全文；审核状态行内变更
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
  const fetchItems = useLlmCallsStore((s) => s.fetch);
  const reviewItem = useLlmCallsStore((s) => s.reviewItem);

  const [draft, setDraft] = useState<LlmCallsFilters>({});

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  // 模型候选项：当前已加载记录的 model 去重，最多 10 个
  const modelOptions = useMemo(() => {
    const uniq = Array.from(new Set(items.map((i) => i.model).filter(Boolean))) as string[];
    return uniq.slice(0, 10).map((v) => ({ value: v }));
  }, [items]);

  /** 「查询」：应用草稿筛选（自动回第 1 页）并请求 */
  const query = () => {
    setFilters(draft);
    void fetchItems();
  };

  /** 「重置」：清空草稿与 store 筛选并请求 */
  const reset = () => {
    setDraft({});
    setFilters({});
    void fetchItems();
  };

  /** 行内快速变更审核状态 */
  const handleInlineReview = async (r: LlmCallItem, newStatus: string) => {
    await reviewItem(r.id, newStatus, r.review_note || '');
  };

  const PRE_COLUMNS_COUNT = 9; // ID/时间/服务/模型/模板/耗时/状态/审核/预览 → 展开列追加为第 10 列

  return (
    <Layout.Content style={{ padding: 32, maxWidth: 1400, width: '94%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>模型调用记录</Title>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void fetchItems()}>
          刷新
        </Button>
      </div>

      {error && (
        <Alert
          type="error" showIcon style={{ marginBottom: 16 }}
          message="调用记录获取失败"
          description={`${error}。请确认 8900 管理服务已启动后点「刷新」。`}
        />
      )}

      <Space size={8} wrap style={{ marginBottom: 16 }}>
        <Text type="secondary">筛选</Text>
        <DatePicker.RangePicker
          value={
            draft.dateRange
              ? [draft.dateRange[0] ? dayjs(draft.dateRange[0]) : null, draft.dateRange[1] ? dayjs(draft.dateRange[1]) : null]
              : null
          }
          onChange={(dates) => {
            const range: [string, string] | undefined = dates
              ? [dates[0]?.format('YYYY-MM-DD') ?? '', dates[1]?.format('YYYY-MM-DD') ?? '']
              : undefined;
            setDraft({ ...draft, dateRange: range });
          }}
        />
        <Select
          allowClear placeholder="服务" style={{ width: 130 }} aria-label="服务筛选"
          value={draft.service || undefined}
          options={SERVICE_OPTIONS}
          onChange={(v) => setDraft({ ...draft, service: v ?? '' })}
        />
        <Select
          allowClear placeholder="状态" style={{ width: 110 }} aria-label="状态筛选"
          value={draft.status || undefined}
          options={STATUS_OPTIONS}
          onChange={(v) => setDraft({ ...draft, status: v ?? '' })}
        />
        <AutoComplete
          allowClear
          placeholder="模型关键字"
          style={{ width: 180 }}
          aria-label="模型筛选"
          options={modelOptions}
          value={draft.model || ''}
          onChange={(v) => setDraft({ ...draft, model: v ?? '' })}
          filterOption={(input, option) =>
            (option?.value as string | undefined)?.toLowerCase().includes(input.toLowerCase()) ?? true
          }
        />
        <Select
          allowClear placeholder="审核状态" style={{ width: 120 }} aria-label="审核状态筛选"
          value={draft.review_status || undefined}
          options={REVIEW_STATUS_OPTIONS}
          onChange={(v) => setDraft({ ...draft, review_status: v ?? '' })}
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
            void fetchItems();
          },
        }}
        expandable={{
          expandIconColumnIndex: PRE_COLUMNS_COUNT, // 展开图标置于表格末尾
          expandedRowRender: (r) => (
            <div className="llm-call-detail" style={{ padding: '8px 16px', maxWidth: 1200 }}>
              {r.task && (
                <div style={{ marginBottom: 4 }}>
                  <Text type="secondary">任务：{r.task}</Text>
                  {r.step && <Text type="secondary" style={{ marginLeft: 16 }}>步骤：{r.step}</Text>}
                </div>
              )}

              <SectionHeader label="Prompt" text={r.prompt ?? ''} />
              <JsonBlock raw={r.prompt} />

              <SectionHeader label="Response" text={r.response ?? ''} />
              <JsonBlock raw={r.response} />

              {r.error && (
                <>
                  <Text strong style={{ color: '#ff4d4f' }}>错误</Text>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#fff2f0', padding: 8, borderRadius: 4 }}>
                    {r.error}
                  </pre>
                </>
              )}

              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Text type="secondary">端点：{r.endpoint}</Text>
                {r.prompt_template != null && <Text type="secondary">模板：{r.prompt_template}</Text>}
                <span style={{ marginLeft: 'auto' }} />
                <Text type="secondary">审核：</Text>
                <Select
                  size="small"
                  value={r.review_status || 'unreviewed'}
                  style={{ width: 100 }}
                  options={REVIEW_STATUS_OPTIONS.filter((o) => o.value !== 'unreviewed')}
                  onChange={(v) => void handleInlineReview(r, v)}
                />
                {r.review_note && <Text type="secondary" style={{ marginLeft: 4 }}>备注：{r.review_note}</Text>}
              </div>
            </div>
          ),
        }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: '时间', dataIndex: 'created_at', width: 170 },
          { title: 'service', dataIndex: 'service', width: 130 },
          {
            title: '模型', key: 'model', width: 180,
            render: (_, r) => `${r.provider ?? '-'} / ${r.model ?? '-'}`,
          },
          {
            title: '模板', dataIndex: 'prompt_template', width: 160,
            render: (v: string | null) => v ? <Tag>{v}</Tag> : <Text type="secondary">-</Text>,
          },
          {
            title: '耗时', key: 'duration_ms', width: 90,
            render: (_, r) => (r.duration_ms != null ? `${r.duration_ms} ms` : '-'),
          },
          {
            title: '状态', key: 'status', width: 90,
            render: (_, r) => (
              <Tag color={CALL_STATUS[r.status]?.color} style={{ marginInlineEnd: 0 }}>
                {CALL_STATUS[r.status]?.label ?? r.status}
              </Tag>
            ),
          },
          {
            title: '审核', key: 'review_status', width: 100,
            render: (_, r) => {
              const rv = REVIEW_STATUS_TAG[r.review_status || 'unreviewed'];
              return <Tag color={rv?.color} style={{ marginInlineEnd: 0 }}>{rv?.label ?? '未审核'}</Tag>;
            },
          },
          {
            title: '内容预览', key: 'preview',
            render: (_, r) => <ContentPreview text={r.prompt} />,
          },
        ]}
      />
    </Layout.Content>
  );
}