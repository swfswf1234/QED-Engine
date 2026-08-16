import { useEffect, useMemo } from 'react';
import {
  Alert, Button, Card, Col, Layout, Row, Space, Statistic, Typography,
} from 'antd';
import { ReloadOutlined, DatabaseOutlined, CloudServerOutlined, FileSearchOutlined } from '@ant-design/icons';
import type { EChartsCoreOption } from 'echarts/core';
import AppHeader from '../components/AppHeader';
import EChart from '../components/EChart';
import { statusBadge } from '../components/StatusBadge';
import { describeError } from '../api/client';
import {
  useDashboardStore,
  buildSelectionDistribution,
  buildDownloadSummary,
  buildCourseProgress,
} from '../stores/dashboard';
import { WEB_SERVICE } from '../stores/webService';

const { Title, Text } = Typography;

const STATUS_LABELS: Record<string, string> = {
  candidate: '候选',
  confirmed: '确认',
  backup: '备选',
};

function buildDistributionOption(dist: { status: string; count: number }[]): EChartsCoreOption {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 16, top: 24, bottom: 32 },
    xAxis: {
      type: 'category',
      data: dist.map((d) => STATUS_LABELS[d.status] ?? d.status),
      axisLabel: { color: '#333', fontSize: 12 },
    },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { color: '#333' } },
    series: [
      {
        type: 'bar',
        data: dist.map((d) => d.count),
        barWidth: 40,
        itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}

function buildProgressOption(progress: { course_id: string; progress: number; total: number }[]): EChartsCoreOption {
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = (params as { data: { value: number; raw: { total: number } } }[])[0];
        return `${p.data.raw.total} 套`;
      },
    },
    grid: { left: 90, right: 32, top: 24, bottom: 32 },
    xAxis: { type: 'value', max: 1, axisLabel: { color: '#333', formatter: (v: number) => `${Math.round(v * 100)}%` } },
    yAxis: {
      type: 'category',
      data: progress.map((p) => p.course_id),
      axisLabel: { color: '#333', fontSize: 12 },
    },
    series: [
      {
        type: 'bar',
        data: progress.map((p) => ({ value: p.progress, raw: { total: p.total } })),
        barWidth: 16,
        itemStyle: { color: '#52c41a', borderRadius: [0, 4, 4, 0] },
      },
    ],
  };
}

/**
 * 仪表盘（`#/admin/dashboard`）
 * - 服务健康摘要：四服务（/services，8903 本地判定）
 * - 文档下载状况大盘（/selections 单次拉取：表1 状态分布 + 表2 汇总 + 课程完成进度）
 * - 解析状况大盘：8902 parse-jobs 数据源后置（离线占位）
 * - 布局：上下分列（下载在上、解析在下）；独立降级：8901 不可达 → 下载大盘离线提示
 * - 过渡形态：整体梳理待后台服务正常后优化（todo 低优先级）
 */
export default function Dashboard() {
  const {
    selections, services, loading, error, dataError, fetchAll,
  } = useDashboardStore();

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const distribution = useMemo(() => buildSelectionDistribution(selections), [selections]);
  const summary = useMemo(() => buildDownloadSummary(selections), [selections]);
  const progress = useMemo(() => buildCourseProgress(selections), [selections]);

  const healthItems = useMemo(() => [...services, WEB_SERVICE].sort((a, b) => a.port - b.port), [services]);

  return (
    <Layout style={{ minHeight: '100vh', background: '#eef3fb' }}>
      <AppHeader
        actions={
          <Button
            type="primary" ghost icon={<ReloadOutlined />} loading={loading}
            style={{ color: '#ffffff', borderColor: '#ffffff' }} onClick={() => void fetchAll()}
          >
            刷新
          </Button>
        }
      />
      <Layout.Content style={{ padding: 32, maxWidth: 1280, width: '92%', margin: '0 auto' }}>
        <Title level={2} style={{ marginTop: 0 }}>仪表盘</Title>

        {error && (
          <Alert
            type="error" showIcon style={{ marginBottom: 16 }}
            message="仪表盘数据获取失败"
            description={`${error}。请确认 8900 管理服务已启动后点「刷新」。`}
          />
        )}

        <Card size="small" title={<Space><CloudServerOutlined />服务健康摘要</Space>} style={{ marginBottom: 16 }}>
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
          title={<Space><DatabaseOutlined />文档下载状况</Space>}
          extra={<Text type="secondary">数据源 /selections（表1 内嵌表2 明细）</Text>}
          style={{ marginBottom: 16 }}
        >
          {dataError ? (
            <Space direction="vertical" size={8}>
              <Alert
                type="warning" showIcon
                message="QED-Tracker 数据不可达"
                description={`${describeError(dataError)}。8901 离线时展示降级，不阻塞其他卡片。`}
              />
              {selections.length === 0 && <Text type="secondary">暂无缓存数据，点「刷新」重试。</Text>}
            </Space>
          ) : selections.length === 0 ? (
            <Text type="secondary">暂无书目数据（表1 为空）。</Text>
          ) : (
            <>
              <Row gutter={16}>
                <Col xs={24} lg={12}>
                  <Text strong>表1 状态分布（套）</Text>
                  <EChart option={buildDistributionOption(distribution)} height={260} />
                </Col>
                <Col xs={24} lg={12}>
                  <Text strong>课程完成进度（非候选占比）</Text>
                  <EChart option={buildProgressOption(progress)} height={260} />
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 12 }}>
                <Col xs={12} md={6}><Statistic title="套书总数" value={selections.length} /></Col>
                <Col xs={12} md={6}><Statistic title="册级总数" value={summary.total} /></Col>
                <Col xs={12} md={6}><Statistic title="已下载" value={summary.downloaded} /></Col>
                <Col xs={12} md={6}><Statistic title="已验收" value={summary.approved} /></Col>
              </Row>
            </>
          )}
        </Card>

        <Card
          size="small"
          title={<Space><FileSearchOutlined />文档解析状况</Space>}
          extra={<Text type="secondary">Axiom-Flow</Text>}
        >
          <Alert
            type="info" showIcon
            message="解析任务数据源后置"
            description="parse-jobs 端点随 backend-domain-split 后续轮接入；8902 离线时此处保持离线提示（不占位拉取）。"
          />
        </Card>
      </Layout.Content>
    </Layout>
  );
}