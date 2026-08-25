import { useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, Card, Col, Descriptions, Layout, Modal, Row, Space, Spin, Typography,
} from 'antd';
import {
  ReloadOutlined, PoweroffOutlined, SyncOutlined, DatabaseOutlined, RobotOutlined, PictureOutlined,
} from '@ant-design/icons';
import GpuOverview from '../components/GpuOverview';
import {
  useRuntimeStore, withWebServiceFallback, GPU_REFRESH_INTERVAL_MS,
  type OperateResult, type LlmTestOutcome,
} from '../stores/runtime';
import { statusBadge } from '../components/StatusBadge';
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
 * 依赖组件卡（MySQL/文字模型/图像模型，2026-08-24 结构化重构 + 模式感知）：
 * - 字段行：来源（静态 prop，本地/云端）/ 类型（服务标识，api 模式模型卡显示云端厂商）/
 *   可达 / 备注（单行省略，悬停看全文）
 * - 可达判定（模式感知，修复「LM Studio 未启动却显示已验证在线」错位 bug）：
 *   云端卡（api 模式模型卡）：验证对象即云端厂商 → 测试结果直接决定可达；
 *   本地探测卡：探测优先——探测离线时陈旧「已验证在线」不得残留，测试结论只并入备注；
 *   mode 未加载（null）按本地语义渲染兜底。
 */
function DependencyCard({
  name, icon, origin, svcType, cloud, probe, probeError, testing, onTest,
}: {
  name: string;
  icon: React.ReactNode;
  /** 部署来源：本地 / 云端 */
  origin: string;
  /** 服务类型标识：MySQL / LM Studio / MinerU / 云端 · {provider} */
  svcType: string;
  /** 云端卡：api 模式下的文字/图像模型（验证对象=云端厂商，无本地探测语义） */
  cloud: boolean;
  probe: { reachable: boolean; reason?: string } | null;
  probeError: string | null;
  testing: boolean;
  onTest: () => Promise<LlmTestOutcome>;
}) {
  const { message } = App.useApp();
  const [outcome, setOutcome] = useState<LlmTestOutcome | null>(null);

  const run = async () => {
    const res = await onTest();
    setOutcome(res);
    if (res.ok) {
      message.success(`「${name}」测试通过`);
    } else {
      message.warning(`「${name}」测试失败：${res.detail || '未知原因'}`);
    }
  };

  /** 可达 + 备注：见组件 JSDoc 判定规则 */
  let reach: React.ReactNode;
  let remark: string;
  const probeOffline = probeError != null || (probe != null && !probe.reachable);
  if (!cloud && probeOffline) {
    // 探测失败/离线优先：陈旧测试结论不冒充可达，仅并入备注留痕
    reach = probeError ? <Text type="secondary">探测失败</Text> : <Text type="secondary">离线</Text>;
    remark = outcome
      ? `最近测试${outcome.ok ? '通过' : '失败'}：${outcome.detail || ''}`
      : (probeError || probe?.reason || '—');
  } else if (outcome) {
    // 测试结果有效（云端卡恒有效；本地卡在探测可达时有效）
    reach = outcome.ok ? <Text type="success">已验证在线</Text> : <Text type="danger">验证失败</Text>;
    remark = outcome.detail || '—';
  } else if (cloud) {
    reach = <Text type="secondary">云端 · 未验证</Text>;
    remark = '—';
  } else if (!probe) {
    reach = <Text type="secondary">探测中…</Text>;
    remark = '—';
  } else {
    reach = <Text type="secondary">在线 · 未验证</Text>;
    remark = probe.reason || '—';
  }

  return (
    <Card size="small" title={<Space>{icon}<span>{name}</span></Space>}>
      <Descriptions size="small" column={1} colon={false}>
        <Descriptions.Item label="来源">{origin}</Descriptions.Item>
        <Descriptions.Item label="类型">{svcType}</Descriptions.Item>
        <Descriptions.Item label="可达">{reach}</Descriptions.Item>
        <Descriptions.Item label="备注">
          <Text
            type="secondary"
            style={{
              display: 'inline-block', maxWidth: '100%', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom',
            }}
            title={remark}
          >
            {remark}
          </Text>
        </Descriptions.Item>
      </Descriptions>
      <Button size="small" loading={testing} onClick={() => void run()} style={{ marginTop: 8 }}>
        测试
      </Button>
    </Card>
  );
}

/**
 * 控制台（`#/admin`）
 * - 数据源：全局 runtime store（AdminLayout 进入管理台拉取一次，本页挂载补拉保新鲜；
 *   GPU 显存构成 60s 定时刷新）
 * - 操作区：「刷新」（fetchAll 数据重拉）置于标题行右侧——全局顶栏已提升至 AdminLayout，
 *   页面按钮动作下沉（方案 A，2026-08-24）；「重新加载页面」已删（与浏览器刷新等价）
 * - 四服务卡：8900 恒在线（重启经 /self-restart，成功后自动刷新）/ 8901·8902 启停重启（确认框 +
 *   操作后轮询收敛）/ 8903 前端服务（在线重启、离线启动，无停止；web 兜底合并见 runtime store）
 * - 区块顺序（2026-08-24 用户裁决）：资源总览 → 服务管理（节标题）→ 四服务卡 → 依赖组件三卡
 * - 资源总览卡：/monitor/gpu（原「GPU 总览」；组件独立模块 components/GpuOverview）
 * - 依赖组件三卡：本地 MySQL（/config/database）+ 文字模型（/monitor/lmstudio）+ 图像模型
 *   （/monitor/mineru），默认置灰未验证，「测试」按钮即时验证点亮（各失败仅降级本卡）
 * - 离线降级：8900 不可达显示错误横幅，不白屏
 */
export default function Console() {
  const {
    services, dbStatus, gpu, gpuError, lmstudio, lmstudioError, mineru, mineruError,
    keys, loading, error, dbError, operating, testing, fetchAll, fetchGpu, operate,
    testDatabase, testText, testVision,
  } = useRuntimeStore();
  const { message } = App.useApp();

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  /** GPU 显存构成 60s 静默自动刷新（REQ-038）：操作收敛轮询期间跳过，卸载清理 */
  useEffect(() => {
    const timer = setInterval(() => {
      if (!useRuntimeStore.getState().operating) void fetchGpu();
    }, GPU_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchGpu]);

  const cards = useMemo(() => withWebServiceFallback(services), [services]);

  // 模式感知（2026-08-24）：api 模式下文字/图像模型为云端厂商，类型行标注且不采信本地探测；
  // mode 未加载（null）按 local 语义兜底
  const cloudModels = keys?.mode === 'api';
  const providerLabel = `云端 · ${keys?.provider ?? '厂商未配置'}`;

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
    <Layout.Content style={{ padding: 32, maxWidth: 1280, width: '92%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={2} style={{ marginTop: 0, marginBottom: 0 }}>
          控制台
        </Title>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void fetchAll()}>
          刷新
        </Button>
      </div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16, marginTop: 8 }}>
        QED服务全局俯瞰：资源总览、服务管理、组件管理
      </Text>

      {error && (
        <Alert
          type="error" showIcon style={{ marginBottom: 16 }}
          message="控制台数据获取失败"
          description={`${error}。请确认 8900 管理服务已启动后点「刷新」。`}
        />
      )}

      <GpuOverview gpu={gpu} gpuError={gpuError} />

      {/* 分节标题（2026-08-24 用户裁决）：隔开资源总览与服务管理 */}
      <Title level={4} style={{ marginTop: 24 }}>服务管理</Title>
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
          <Col xs={24} md={12} xl={8}>
            <DependencyCard
              name="MySQL"
              icon={<DatabaseOutlined />}
              origin="本地"
              svcType="MySQL"
              cloud={false}
              probe={dbStatus}
              probeError={dbError}
              testing={testing === 'db'}
              onTest={testDatabase}
            />
          </Col>
          <Col xs={24} md={12} xl={8}>
            <DependencyCard
              name="文字模型"
              icon={<RobotOutlined />}
              origin={cloudModels ? '云端' : '本地'}
              svcType={cloudModels ? providerLabel : 'LM Studio'}
              cloud={cloudModels}
              probe={lmstudio}
              probeError={lmstudioError}
              testing={testing === 'text'}
              onTest={testText}
            />
          </Col>
          <Col xs={24} md={12} xl={8}>
            <DependencyCard
              name="图像模型"
              icon={<PictureOutlined />}
              origin={cloudModels ? '云端' : '本地'}
              svcType={cloudModels ? providerLabel : 'MinerU'}
              cloud={cloudModels}
              probe={mineru}
              probeError={mineruError}
              testing={testing === 'vision'}
              onTest={testVision}
            />
          </Col>
        </Row>
    </Layout.Content>
  );
}
