import { useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, Card, Col, Layout, Modal, Row, Space, Spin, Typography,
} from 'antd';
import {
  ReloadOutlined, PoweroffOutlined, SyncOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import AppHeader from '../components/AppHeader';
import { useConsoleStore, type OperateResult } from '../stores/console';
import { WEB_SERVICE } from '../stores/webService';
import { statusBadge, reachableBadge } from '../components/StatusBadge';
import { describeError } from '../api/client';
import { selfRestart, type ServiceOp } from '../api/services';
import type { ServiceStatus } from '../stores';

const { Title, Text } = Typography;

/** 操作中文名映射（message 提示用） */
const OP_LABELS: Record<ServiceOp, string> = {
  start: '启动',
  stop: '停止',
  restart: '重启',
};

/** 前端显示名映射：8900/8903 不带括号；8901/8902 沿用后端 label */
const DISPLAY_NAMES: Record<string, string> = {
  config: 'QED 管理服务',
  web: 'QED 前端服务',
};

function displayName(svc: ServiceStatus): string {
  return DISPLAY_NAMES[svc.name] ?? svc.label;
}

/**
 * 服务卡操作规则（2026-08-17 用户裁决）：
 * - config：仅重启（经 /self-restart；8900 不可经 /services 启停）
 * - web：在线→重启、离线→启动，不提供停止（避免自掘断界面）
 * - tracker/axiom：在线→停止+重启、离线→启动
 * 确认框为受控 <Modal>（2026-08-18：Modal.confirm 静态方法在 React 19 下不可靠，
 * 点击无反应——根因见会话记录；改用 useState 驱动，彻底脱离静态方法）。
 */
function ServiceCard({
  svc, operating, onConfirm, onRestartConfig,
}: {
  svc: ServiceStatus;
  operating: boolean;
  onConfirm: (op: ServiceOp) => void;
  onRestartConfig: () => void;
}) {
  const isTransition = svc.status === 'starting' || svc.status === 'stopping';
  const controllable = svc.name !== 'config' && !operating && !isTransition;
  const canStop = svc.name === 'tracker' || svc.name === 'axiom';

  return (
    <Card size="small" title={displayName(svc)}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {statusBadge(svc.status, svc.reason)}
        <Text type="secondary" style={{ display: 'block' }}>
          端口 {svc.port}
          {svc.status !== 'online' && svc.pid != null && ` · PID ${svc.pid}`}
          {svc.status !== 'online' && svc.started_at ? ` · 启动于 ${svc.started_at}` : ''}
        </Text>
        <Space wrap>
          {controllable && svc.status === 'offline' && (
            <Button size="small" type="primary" icon={<PoweroffOutlined />} onClick={() => onConfirm('start')}>
              启动
            </Button>
          )}
          {controllable && svc.status === 'online' && (
            <>
              {canStop && (
                <Button size="small" icon={<PoweroffOutlined />} onClick={() => onConfirm('stop')}>
                  停止
                </Button>
              )}
              <Button size="small" icon={<SyncOutlined />} onClick={() => onConfirm('restart')}>
                重启
              </Button>
            </>
          )}
          {svc.name === 'config' && (
            <Button size="small" icon={<SyncOutlined />} onClick={onRestartConfig}>
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
 * - 四服务卡：8900 恒在线（重启经 /self-restart，成功后自动刷新）/ 8901·8902 启停重启（确认框 +
 *   操作后轮询收敛）/ 8903 前端服务（在线重启、离线启动，无停止；后端注册表返回 web 时用真实状态）
 * - 依赖组件卡：本地 MySQL（/config/database，独立超时；失败仅本卡降级）
 * - 离线降级：8900 不可达显示错误横幅，不白屏
 */
export default function Console() {
  const {
    services, dbStatus, loading, error, dbError, operating, fetchAll, operate,
  } = useConsoleStore();
  const { message } = App.useApp();

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const cards = useMemo(() => {
    const merged = services.some((s) => s.name === 'web') ? services : [...services, WEB_SERVICE];
    return [...merged].sort((a, b) => a.port - b.port);
  }, [services]);

  /** 统一成功/失败提示（2026-08-17 用户裁决：只提示收敛结果；失败统一用 message） */
  const notifyResult = (result: OperateResult) => {
    const svc = services.find((s) => s.name === result.name);
    const label = displayName(svc ?? { name: result.name, label: result.name } as ServiceStatus);
    const opLabel = OP_LABELS[result.op];
    if (result.success) {
      message.success(`「${label}」${opLabel}成功（${result.status}）`);
    } else {
      message.warning(`「${label}」${opLabel}未生效：${result.reason ?? '状态未收敛'}`);
    }
  };

  const onOperate = async (name: string, op: ServiceOp) => {
    const result = await operate(name, op);
    notifyResult(result);
  };

  /** 8900 自重启（/self-restart，成功后 3s 自动刷新；确认由受控 Modal 负责） */
  const doRestartConfig = async () => {
    try {
      await selfRestart({ timeoutMs: 15000 });
      message.success('8900 重启中，约 3 秒后页面自动刷新');
      setTimeout(() => window.location.reload(), 3000);
    } catch (err) {
      message.warning(`8900 重启失败：${describeError(err)}`);
    }
  };

  /** 受控确认框状态：{ 服务名, 操作, 显示名 }；null 表示未打开 */
  const [confirmTarget, setConfirmTarget] = useState<{ name: string; op: ServiceOp; display: string } | null>(null);

  const executeConfirm = (target: { name: string; op: ServiceOp }) => {
    setConfirmTarget(null);
    if (target.name === 'config') {
      void doRestartConfig();
    } else {
      void onOperate(target.name, target.op);
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
                onConfirm={(op) => setConfirmTarget({ name: svc.name, op, display: displayName(svc) })}
                onRestartConfig={() => setConfirmTarget({ name: svc.name, op: 'restart', display: displayName(svc) })}
              />
            </Col>
          ))}
        </Row>

        {/* 受控确认框（2026-08-18：替代 Modal.confirm 静态方法——React 19 下静态方法点击无反应） */}
        <Modal
          open={confirmTarget !== null}
          title={confirmTarget ? `确认${OP_LABELS[confirmTarget.op]}「${confirmTarget.display}」？` : ''}
          okText={confirmTarget ? `确认${OP_LABELS[confirmTarget.op]}` : ''}
          cancelText="取消"
          onOk={() => confirmTarget && executeConfirm(confirmTarget)}
          onCancel={() => setConfirmTarget(null)}
        >
          {confirmTarget?.op === 'stop'
            ? '停止后该服务将不可用，可随时重新启动。'
            : confirmTarget?.name === 'config'
              ? '8900 重启将短暂中断所有管理接口，约 3 秒后页面自动刷新恢复。'
              : '重启会中断当前运行中的任务。'}
        </Modal>

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