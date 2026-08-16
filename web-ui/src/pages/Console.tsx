import { useEffect, useMemo } from 'react';
import {
  Alert, Button, Card, Col, Layout, Modal, Row, Space, Spin, Typography,
} from 'antd';
import {
  ReloadOutlined, PoweroffOutlined, SyncOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import AppHeader from '../components/AppHeader';
import { useConsoleStore } from '../stores/console';
import { WEB_SERVICE } from '../stores/webService';
import { statusBadge, reachableBadge } from '../components/StatusBadge';
import { describeError } from '../api/client';
import type { ServiceOp } from '../api/services';
import type { ServiceStatus } from '../stores';

const { Title, Text } = Typography;

/** 前端显示名映射：8900/8903 不带括号；8901/8902 沿用后端 label */
const DISPLAY_NAMES: Record<string, string> = {
  config: 'QED 管理服务',
  web: 'QED 前端服务',
};

function displayName(svc: ServiceStatus): string {
  return DISPLAY_NAMES[svc.name] ?? svc.label;
}

function ServiceCard({
  svc, operating, onOperate, onRestartUnavailable,
}: {
  svc: ServiceStatus;
  operating: boolean;
  onOperate: (op: ServiceOp) => void;
  onRestartUnavailable: () => void;
}) {
  const isTransition = svc.status === 'starting' || svc.status === 'stopping';
  const canControl = (svc.name === 'tracker' || svc.name === 'axiom') && !operating && !isTransition;

  const confirmOp = (op: ServiceOp, label: string) => {
    Modal.confirm({
      title: `确认${label}「${displayName(svc)}」？`,
      content: op === 'stop' ? '停止后该服务将不可用，可随时重新启动。' : '重启会中断当前运行中的任务。',
      okText: `确认${label}`,
      cancelText: '取消',
      onOk: () => onOperate(op),
    });
  };

  return (
    <Card size="small" title={displayName(svc)}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {statusBadge(svc.status, svc.reason)}
        <Text type="secondary" style={{ display: 'block' }}>
          端口 {svc.port}
          {svc.pid != null && ` · PID ${svc.pid}`}
          {svc.started_at ? ` · 启动于 ${svc.started_at}` : ''}
        </Text>
        <Space wrap>
          {canControl && svc.status === 'offline' && (
            <Button size="small" type="primary" icon={<PoweroffOutlined />} onClick={() => onOperate('start')}>
              启动
            </Button>
          )}
          {canControl && svc.status === 'online' && (
            <>
              <Button size="small" icon={<PoweroffOutlined />} onClick={() => confirmOp('stop', '停止')}>
                停止
              </Button>
              <Button size="small" icon={<SyncOutlined />} onClick={() => confirmOp('restart', '重启')}>
                重启
              </Button>
            </>
          )}
          {svc.name === 'config' && (
            <Button size="small" icon={<SyncOutlined />} onClick={onRestartUnavailable}>
              重启
            </Button>
          )}
          {isTransition && <Spin size="small" />}
        </Space>
      </Space>
    </Card>
  );
}

/**
 * 控制台（`#/admin`）
 * - 顶部操作区：「刷新」（重拉数据）+「重新加载页面」（整页重载，独立按钮）
 * - 四服务卡：8900 恒在线（脚本托管，仅重启→提示后置）/ 8901·8902 启停重启（确认框 + 操作后轮询收敛）/
 *   8903 前端本地判定（页面级操作已由顶部承担，卡内无按钮）
 * - 依赖组件卡：本地 MySQL（/config/database，独立超时；失败仅本卡降级）
 * - 离线降级：8900 不可达显示错误横幅，不白屏
 */
export default function Console() {
  const {
    services, dbStatus, loading, error, dbError, operating, fetchAll, operate,
  } = useConsoleStore();

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const cards = useMemo(
    () => [...services, WEB_SERVICE].sort((a, b) => a.port - b.port),
    [services],
  );

  const onOperate = async (name: string, op: ServiceOp) => {
    try {
      await operate(name, op);
    } catch (err) {
      Modal.warning({ title: '操作失败', content: describeError(err) });
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#eef3fb' }}>
      <AppHeader
        actions={
          <Space>
            <Button
              type="primary" ghost icon={<ReloadOutlined />} loading={loading}
              style={{ color: '#ffffff', borderColor: '#ffffff' }} onClick={() => void fetchAll()}
            >
              刷新
            </Button>
            <Button
              icon={<ReloadOutlined />}
              style={{ color: '#ffffff', borderColor: '#ffffff', background: 'transparent' }}
              onClick={() => window.location.reload()}
            >
              重新加载页面
            </Button>
          </Space>
        }
      />
      <Layout.Content style={{ padding: 32, maxWidth: 1280, width: '92%', margin: '0 auto' }}>
        <Title level={2} style={{ marginTop: 0 }}>
          控制台
        </Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          全局俯瞰：服务启停托管（操作后自动收敛状态）；依赖组件真实探测（60s 缓存）。
        </Text>

        {error && (
          <Alert
            type="error" showIcon style={{ marginBottom: 16 }}
            message="控制台数据获取失败"
            description={`${error}。请确认 8900 管理服务已启动后点「刷新」。`}
          />
        )}

        <Row gutter={[16, 16]}>
          {cards.map((svc) => (
            <Col xs={24} md={12} xl={6} key={svc.name}>
              <ServiceCard
                svc={svc}
                operating={operating === svc.name}
                onOperate={(op) => void onOperate(svc.name, op)}
                onRestartUnavailable={() => {
                  Modal.warning({
                    title: '暂不可用',
                    content: 'QED 管理服务重启能力后置（后端 self-restart 端点后续轮次提供），暂不可经控制台操作。',
                  });
                }}
              />
            </Col>
          ))}
        </Row>

        <Title level={4} style={{ marginTop: 24 }}>依赖组件</Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card size="small" title={<Space><DatabaseOutlined />本地 MySQL（qed 库）</Space>}>
              {dbStatus ? (
                reachableBadge(dbStatus.reachable, dbStatus.reason)
              ) : dbError ? (
                <Text type="secondary">获取失败（{describeError(dbError)}）。点「刷新」重试。</Text>
              ) : (
                <Text type="secondary">探测中…</Text>
              )}
            </Card>
          </Col>
        </Row>
      </Layout.Content>
    </Layout>
  );
}