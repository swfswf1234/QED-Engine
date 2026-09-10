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
  buildDomainProgress,
  buildCourseProgress,
  buildBookDownloadProgress,
  buildDashboardStats,
  type DownloadSlice,
  type DomainCoursesSlice,
} from '../stores/dashboard';

const { Title, Text } = Typography;

/** 三行图表配色 */
const STATUS_COLORS = {
  // 领域表
  '新建': '#d9d9d9',
  '探索中': '#52c41a',
  '完成': '#1677ff',
  // 课程表
  '探索完成': '#52c41a',
  '下载中': '#faad14',
  // 文档下载进度
  '未开始': '#d9d9d9',
  '待确认': '#52c41a',
} as const;

const SLICE_COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2', '#fa8c16'];

/** 通用饼图 option 构建 */
function buildPieOption(slices: DownloadSlice[], title: string): EChartsCoreOption {
  const data = slices.map((s) => ({
    name: s.name,
    value: s.value,
    itemStyle: { color: STATUS_COLORS[s.name as keyof typeof STATUS_COLORS] ?? SLICE_COLORS[0] },
  }));
  return {
    title: { text: title, left: 'left', top: 0, textStyle: { fontSize: 13, color: '#333' } },
    tooltip: { trigger: 'item', formatter: '{b}：{c}' },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        type: 'pie',
        radius: ['38%', '66%'],
        center: ['30%', '52%'],
        label: { color: '#333', fontSize: 12 },
        data,
      },
    ],
  };
}

/** 渲染一组领域饼图卡片（按3列换行） */
function DomainPieRow({
  sliceMap,
  emptyText,
}: {
  sliceMap: DomainCoursesSlice;
  emptyText: string;
}) {
  const domains = Object.keys(sliceMap);
  if (domains.length === 0) {
    return <Text type="secondary">{emptyText}</Text>;
  }
  return (
    <Row gutter={[16, 16]}>
      {domains.map((domainName) => (
        <Col xs={24} sm={12} lg={8} key={domainName}>
          <EChart
            option={buildPieOption(sliceMap[domainName], domainName)}
            height={260}
          />
        </Col>
      ))}
    </Row>
  );
}

/**
 * 仪表盘（`#/admin/dashboard`，2026-09-07 重构）
 * - 服务在线（只读徽章）
 * - 第一行：领域探索进度饼图（每领域一个卡片）
 * - 第二行：课程进度饼图（按领域分组）
 * - 第三行：文档下载进度饼图（按领域分组）
 * - 底部：四统计数字
 */
export default function Dashboard() {
  const {
    knowledge, details, courseSystem, loading, error, dataError, courseError, fetchAll,
  } = useDashboardStore();
  const services = useRuntimeStore((s) => s.services);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const domainProgress = useMemo(() => buildDomainProgress(courseSystem), [courseSystem]);
  const courseProgress = useMemo(() => buildCourseProgress(courseSystem, details), [courseSystem, details]);
  const bookProgress = useMemo(() => buildBookDownloadProgress(courseSystem, details), [courseSystem, details]);
  const stats = useMemo(() => buildDashboardStats(courseSystem, details), [courseSystem, details]);
  const healthItems = useMemo(() => withWebServiceFallback(services), [services]);

  const domainProgressEmpty = domainProgress.length === 0;

  const hasData = knowledge.length > 0;

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

      {/* 区域1：服务在线情况 */}
      <Card
        size="small"
        title={<Space><CloudServerOutlined />服务在线情况</Space>}
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

      {/* 区域1.5：统计数字 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={12} md={6}>
            <Statistic title="已探明领域数" value={stats.exploredDomains} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="课程数" value={stats.totalCourses} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="书籍卷数" value={stats.totalBooks} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="验收书目数" value={stats.verifiedBooks} />
          </Col>
        </Row>
      </Card>

      {dataError ? (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Alert
            type="warning" showIcon
            message="QED-Tracker 数据不可达"
            description={`${describeError(dataError)}。8901 离线时展示降级，不阻塞其他卡片。`}
          />
          {!hasData && <Text type="secondary">暂无缓存数据，点「刷新」重试。</Text>}
        </Space>
      ) : courseError ? (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Alert
            type="warning" showIcon
            message="课程体系不可达"
            description={`${describeError(courseError)}。三行图表暂时不可用。`}
          />
        </Space>
      ) : !hasData ? (
        <Text type="secondary">暂无教程数据（/knowledge 为空）。</Text>
      ) : (
        <>
          {/* 区域2：领域探索进度（第一行，聚合单饼图） */}
          <Card
            size="small"
            title={<Space><DatabaseOutlined />领域探索进度</Space>}
            extra={<Text type="secondary">按领域统计</Text>}
            style={{ marginBottom: 16 }}
          >
            {domainProgressEmpty
              ? <Text type="secondary">暂无领域数据</Text>
              : <EChart option={buildPieOption(domainProgress, '领域探索进度')} height={260} />
            }
          </Card>

          {/* 区域3：课程进度（第二行） */}
          <Card
            size="small"
            title={<Space><DatabaseOutlined />课程进度</Space>}
            extra={<Text type="secondary">按领域分组</Text>}
            style={{ marginBottom: 16 }}
          >
            <DomainPieRow
              sliceMap={courseProgress}
              emptyText="暂无课程数据"
            />
          </Card>

          {/* 区域4：文档下载进度（第三行） */}
          <Card
            size="small"
            title={<Space><FileSearchOutlined />文档下载进度</Space>}
            extra={<Text type="secondary">按领域分组</Text>}
            style={{ marginBottom: 16 }}
          >
            <DomainPieRow
              sliceMap={bookProgress}
              emptyText="暂无书籍数据"
            />
          </Card>
        </>
      )}
    </Layout.Content>
  );
}
