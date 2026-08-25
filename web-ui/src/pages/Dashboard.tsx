import { useEffect, useMemo } from 'react';
import {
  Alert, Button, Card, Col, Layout, Row, Space, Statistic, Typography,
} from 'antd';
import { ReloadOutlined, CloudServerOutlined, DatabaseOutlined, FileSearchOutlined } from '@ant-design/icons';
import type { EChartsCoreOption } from 'echarts/core';
import EChart from '../components/EChart';
import { statusBadge } from '../components/StatusBadge';
import { describeError } from '../api/client';
import { useRuntimeStore, withWebServiceFallback } from '../stores/runtime';
import {
  useDashboardStore,
  buildBookSummary,
  buildCourseCompletion,
  buildKnowledgeDownloadPie,
  type DownloadSlice,
} from '../stores/dashboard';

const { Title, Text } = Typography;

/** 教程扇区配色（固定色板，扇区数多时 ECharts 回退默认 palette） */
const SLICE_COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2', '#fa8c16'];

function buildPieOption(slices: DownloadSlice[], title: string): EChartsCoreOption {
  return {
    title: { text: title, left: 'center', top: 0, textStyle: { fontSize: 13, color: '#333' } },
    tooltip: { trigger: 'item', formatter: '{b}：{c} 本' },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        type: 'pie',
        radius: ['38%', '66%'],
        center: ['50%', '52%'],
        label: { color: '#333', fontSize: 12 },
        data: slices.map((s, i) => ({
          name: s.name,
          value: s.value,
          itemStyle: { color: SLICE_COLORS[i % SLICE_COLORS.length] },
        })),
      },
    ],
  };
}

/**
 * 课程下载完成度饼图（两段式）：已完成下载课程（绿）/ 未完成下载课程（灰），
 * 标题显示 完成数/课程总数（分母 = catalog targets 课程数，分子 = ≥2 套教程验收的课程数）。
 */
function buildCompletionOption(completed: number, total: number): EChartsCoreOption {
  return {
    title: {
      text: `课程下载完成度 ${completed}/${total}`,
      left: 'center',
      top: 0,
      textStyle: { fontSize: 13, color: '#333' },
    },
    tooltip: { trigger: 'item', formatter: '{b}：{c} 门' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['38%', '66%'],
        center: ['50%', '52%'],
        label: { color: '#333', fontSize: 12 },
        data: [
          { name: '已完成下载', value: completed, itemStyle: { color: '#52c41a' } },
          { name: '未完成下载', value: Math.max(total - completed, 0), itemStyle: { color: '#d9d9d9' } },
        ],
      },
    ],
  };
}

/**
 * 仪表盘（`#/admin/dashboard`，五层化 QED-031）
 * - 服务在线（2026-08-24 二次裁决恢复·轻量版）：只读展示共享 runtime store 的服务快照
 *   （不发请求；启停操作在控制台）
 * - 文档下载进度（/knowledge + /catalogs + 并行 /knowledge/{id}：课程完成度两段饼图
 *   + 教程下载工作量饼图 + 汇总统计：教程数 / 目标书目 / 已下载 / 已验收）
 * - 整体横幅由知识行请求 offline 类错误判定（8900 不可达），见 dashboard store
 * - 文档解析进度：8902 parse-jobs 数据源后置（离线占位）
 * - 布局：服务在线 → 下载在上、解析在下；独立降级：8901 不可达 → 下载大盘离线提示
 */
export default function Dashboard() {
  const {
    knowledge, details, catalogTargets, loading, error, dataError, catalogError, fetchAll,
  } = useDashboardStore();
  const services = useRuntimeStore((s) => s.services);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const summary = useMemo(() => buildBookSummary(details), [details]);
  const completion = useMemo(() => buildCourseCompletion(catalogTargets, details), [catalogTargets, details]);
  const knowledgePie = useMemo(() => buildKnowledgeDownloadPie(details), [details]);
  /** web 兜底 + 端口排序（纯函数；数据来自共享 runtime store，零额外请求） */
  const healthItems = useMemo(() => withWebServiceFallback(services), [services]);

  return (
    <Layout.Content style={{ padding: 32, maxWidth: 1280, width: '92%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>仪表盘</Title>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void fetchAll()}>
          刷新
        </Button>
      </div>

      {error && (
          <Alert
            type="error" showIcon style={{ marginBottom: 16 }}
            message="仪表盘数据获取失败"
            description={`${error}。请确认 8900 管理服务已启动后点「刷新」。`}
          />
        )}

        <Card
          size="small"
          title={<Space><CloudServerOutlined />服务在线</Space>}
          extra={<Text type="secondary">数据与控制台共享 · 启停操作请到控制台</Text>}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={[16, 8]}>
            {healthItems.map((svc) => (
              <Col xs={12} md={6} key={svc.name}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Text strong>{svc.label}</Text>
                  {statusBadge(svc.status, svc.reason)}
                </Space>
              </Col>
            ))}
          </Row>
        </Card>

        <Card
          size="small"
          title={<Space><DatabaseOutlined />文档下载进度</Space>}
          extra={<Text type="secondary">QED-Tracker监控</Text>}
          style={{ marginBottom: 16 }}
        >
          {dataError ? (
            <Space direction="vertical" size={8}>
              <Alert
                type="warning" showIcon
                message="QED-Tracker 数据不可达"
                description={`${describeError(dataError)}。8901 离线时展示降级，不阻塞其他卡片。`}
              />
              {knowledge.length === 0 && <Text type="secondary">暂无缓存数据，点「刷新」重试。</Text>}
            </Space>
          ) : knowledge.length === 0 ? (
            <Text type="secondary">暂无知识行数据（/knowledge 为空）。</Text>
          ) : (
            <>
              <Row gutter={16}>
                <Col xs={24} lg={12}>
                  {catalogError ? (
                    <Alert
                      type="warning" showIcon style={{ marginBottom: 8 }}
                      message="课程清单不可达"
                      description={`${describeError(catalogError)}。课程完成度饼图暂不可用。`}
                    />
                  ) : (
                    <EChart option={buildCompletionOption(completion.completed, completion.total)} height={300} />
                  )}
                </Col>
                <Col xs={24} lg={12}>
                  <EChart option={buildPieOption(knowledgePie, '文档下载进度（本）· 按教程')} height={300} />
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 12 }}>
                <Col xs={12} md={6}><Statistic title="教程数" value={summary.tutorials} /></Col>
                <Col xs={12} md={6}><Statistic title="目标书目" value={summary.total} /></Col>
                <Col xs={12} md={6}><Statistic title="已下载" value={summary.downloaded} /></Col>
                <Col xs={12} md={6}><Statistic title="已验收" value={summary.verified} /></Col>
              </Row>
            </>
          )}
        </Card>

        <Card
          size="small"
          title={<Space><FileSearchOutlined />文档解析进度</Space>}
          extra={<Text type="secondary">Axiom-Flow监控</Text>}
        >
          <Alert
            type="info" showIcon
            message="解析任务数据源后置"
            description="parse-jobs 端点随 backend-domain-split 后续轮接入；8902 离线时此处保持离线提示（不占位拉取）。"
          />
        </Card>
    </Layout.Content>
  );
}