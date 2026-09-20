import { useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, Card, Col, Descriptions, Layout, Modal, Row, Select, Space, Spin, Typography,
} from 'antd';
import {
  ReloadOutlined, PoweroffOutlined, SyncOutlined, DatabaseOutlined, RobotOutlined, PictureOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import GpuOverview from '../components/GpuOverview';
import {
  useRuntimeStore, withWebServiceFallback, GPU_REFRESH_INTERVAL_MS,
  type OperateResult, type LlmTestOutcome,
} from '../stores/runtime';
import { statusBadge } from '../components/StatusBadge';
import { describeError } from '../api/client';
import { selfRestart, type ServiceOp } from '../api/services';
import type { ModelSlot, ModelOp, ServiceStatus, SlotName, SlotSelectPatch, SlotStatus } from '../stores';

const { Title, Text } = Typography;

/** 操作中文名映射（message 提示用） */
const OP_LABELS: Record<ServiceOp | ModelOp, string> = {
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
  const controllable = svc.name !== 'config' && svc.name !== 'web' && !operating && !isTransition;
  const canStop = svc.name === 'tracker' || svc.name === 'axiom';
  /** web 仅重启（2026-09-06 用户裁决）：web 未启动时前端页面不可达，启动无意义；恒仅重启。 */
  const restartOnly = svc.name === 'config' || svc.name === 'web';

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
          {restartOnly && (
            <Button size="small" icon={<SyncOutlined />}
              onClick={svc.name === 'config' ? onRestartConfig : () => onConfirm('restart')}>
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
 * 依赖组件卡（元数据库，2026-08-24 结构化重构 + 模式感知）：
 * - 字段行：来源（静态 prop，本地/云端）/ 类型（服务标识，api 模式模型卡显示云端厂商）/
 *   可达 / 备注（单行省略，悬停看全文）
 * - 可达判定（模式感知，修复「Qwen 未启动却显示已验证在线」错位 bug）：
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
  /** 服务类型标识：MySQL / Qwen / MinerU / 云端 · {provider} */
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
 * 槽位卡（PLAN-046 v3 五字段：来源 / 模型 / 渠道 / 可用 / 备注）
 * - 数据源 GET /models/{slot}；选择经 onSelect(patch) → POST /models/{slot}/select 写运行态
 * - 来源 Select（本地部署 / API 调用）；模型 Select 按来源 × 渠道过滤（带备注）；
 *   渠道 local 可选（待上线置灰）、api 显示「直连」
 * - 可用行：探针判定 + 「验证」按钮真实调用（POST /llm/test/{slot}）；备注为身份一句话介绍
 * - local 来源渲染启停/重启；api 来源仅验证
 */
const RUNTIME_LABELS: Record<string, string> = {
  lmstudio: 'LM Studio',
  llamacpp: 'llama.cpp',
  docker: 'Docker',
};

function SlotCard({
  label, icon, status, statusError, testing, operating, onTest, onOperate, onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  /** 槽位状态（null=尚未加载） */
  status: SlotStatus | null;
  statusError: string | null;
  testing: boolean;
  operating: boolean;
  onTest: () => Promise<LlmTestOutcome>;
  /** 传入即启用启停按钮（来源 = local 时渲染） */
  onOperate?: (op: ModelOp) => void;
  /** 传入即启用来源/模型/渠道三个下拉（写运行态 manifest） */
  onSelect?: (patch: SlotSelectPatch) => Promise<boolean>;
}) {
  const { message } = App.useApp();
  const [outcome, setOutcome] = useState<LlmTestOutcome | null>(null);
  const [selecting, setSelecting] = useState(false);

  /** 槽位状态刷新（选择/轮询/重拉）后清空验证结论，可用行回落探针判定（防陈旧结论残留） */
  useEffect(() => {
    setOutcome(null);
  }, [status]);

  const run = async () => {
    const res = await onTest();
    setOutcome(res);
    if (res.ok) message.success(`「${label}」验证通过`);
    else message.warning(`「${label}」验证失败：${res.detail || '未知原因'}`);
  };

  const apply = async (patch: SlotSelectPatch, okText: string) => {
    if (!onSelect) return;
    setSelecting(true);
    const ok = await onSelect(patch);
    setSelecting(false);
    if (ok) message.success(`「${label}」${okText}`);
    else message.warning(`「${label}」切换失败`);
  };

  const isLocal = status?.source === 'local' && !status.error;
  const sourceOptions = status?.source_options ?? [];
  const channelOptions = status?.channel_options ?? [];
  const modelOptions = status?.options ?? [];

  /** 来源行：本地部署 / API 调用（Select，选择即写 manifest.source；待上线置灰） */
  let sourceNode: React.ReactNode;
  if (statusError) sourceNode = <Text type="secondary">状态获取失败</Text>;
  else if (!status) sourceNode = <Text type="secondary">加载中…</Text>;
  else if (status.error) sourceNode = <Text type="danger">解析失败</Text>;
  else if (onSelect && sourceOptions.length > 0) {
    sourceNode = (
      <Select
        size="small"
        value={status.source}
        loading={selecting}
        style={{ width: '100%' }}
        onChange={(v) => void apply({ source: v }, `来源已切换为${v === 'local' ? '本地部署' : 'API 调用'}`)}
        options={sourceOptions.map((o) => ({
          value: o.value,
          label: o.status === 'pending' ? `${o.label}（待上线）` : o.label,
          disabled: o.status === 'pending',
        }))}
      />
    );
  } else {
    sourceNode = <Text>{status.source === 'local' ? '本地部署' : 'API 调用'}</Text>;
  }

  /** 模型行：按来源 × 渠道过滤的身份下拉（带一句话备注）；无下拉时显示当前身份 */
  let modelNode: React.ReactNode;
  if (statusError || !status) modelNode = <Text type="secondary">—</Text>;
  else if (status.error) modelNode = <Text type="danger">解析失败</Text>;
  else if (onSelect && modelOptions.length > 0) {
    modelNode = (
      <Select
        size="small"
        value={status.identity}
        loading={selecting}
        style={{ width: '100%' }}
        onChange={(v) => void apply({ model: v }, `已切换为 ${v}`)}
        options={modelOptions.map((o) => ({ value: o.value, label: o.label, title: o.description }))}
      />
    );
  } else {
    modelNode = <Text>{status.identity || status.model || '未配置'}</Text>;
  }

  /** 渠道行：api → 直连；local → 默认 / LM Studio / Docker / llama.cpp（待上线置灰） */
  let channelNode: React.ReactNode;
  if (statusError || !status) channelNode = <Text type="secondary">—</Text>;
  else if (status.error) channelNode = <Text type="danger">解析失败</Text>;
  else if (status.source === 'api') channelNode = <Text>直连</Text>;
  else if (onSelect && channelOptions.length > 0) {
    channelNode = (
      <Select
        size="small"
        value={status.runtime || 'default'}
        loading={selecting}
        style={{ width: '100%' }}
        onChange={(v) => void apply({ runtime: v }, `渠道已切换为${RUNTIME_LABELS[v] ?? '默认'}`)}
        options={channelOptions.map((o) => ({
          value: o.value,
          label: o.status === 'pending' ? `${o.label}（待上线）` : o.label,
          disabled: o.status === 'pending',
        }))}
      />
    );
  } else {
    channelNode = <Text>{RUNTIME_LABELS[status.runtime ?? ''] ?? status.runtime ?? '—'}</Text>;
  }

  /** 可用行：验证结论 > 解析失败 > 探针判定 */
  let avail: React.ReactNode;
  if (statusError || !status) avail = <Text type="secondary">—</Text>;
  else if (status.error) avail = <Text type="danger">不可用</Text>;
  else if (outcome) avail = outcome.ok ? <Text type="success">可用</Text> : <Text type="danger">不可用</Text>;
  else if (status.ready) avail = <Text type="success">可用</Text>;
  else avail = <Text type="warning">{status.availability || '未就绪'}</Text>;

  /** 备注：身份一句话介绍 > 解析错误 > 回退备注 */
  const remark = status?.description || status?.error || status?.notes?.join('；') || '—';

  return (
    <Card size="small" title={<Space>{icon}<span>{label}</span></Space>}>
      <Descriptions size="small" column={1} colon={false}>
        <Descriptions.Item label="来源">{sourceNode}</Descriptions.Item>
        <Descriptions.Item label="模型">{modelNode}</Descriptions.Item>
        <Descriptions.Item label="渠道">{channelNode}</Descriptions.Item>
        <Descriptions.Item label="可用">
          <Space>
            {avail}
            <Button size="small" loading={testing} onClick={() => void run()}>
              验证
            </Button>
          </Space>
        </Descriptions.Item>
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
      {isLocal && onOperate && (
        <Space wrap style={{ marginTop: 8 }}>
          <Button size="small" type="primary" icon={<PoweroffOutlined />} loading={operating} onClick={() => onOperate('start')}>
            启动
          </Button>
          <Button size="small" icon={<PoweroffOutlined />} loading={operating} onClick={() => onOperate('stop')}>
            停止
          </Button>
          <Button size="small" icon={<SyncOutlined />} loading={operating} onClick={() => onOperate('restart')}>
            重启
          </Button>
        </Space>
      )}
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
 * - 区块顺序：服务管理 → 基础设施 → 资源监控（GPU 状态 + 模型三槽位卡）
 * - GPU 状态卡：/monitor/gpu（组件独立模块 components/GpuOverview）
 * - 槽位卡（PLAN-046 v3）：文字/图像/向量三槽位（/models/{slot}）五字段——来源 / 模型 /
 *   渠道 / 可用 / 备注；来源与渠道槽位级可切换（/models/{slot}/select 写 manifest），
 *   可用行探针判定 + 验证按钮；local 来源渲染启停；向量卡只读（固定 API·直连）+ 验证
 * - 离线降级：8900 不可达显示错误横幅，不白屏
 */
export default function Console() {
  const {
    services, dbStatus, gpu, gpuError, slots, slotErrors,
    loading, error, dbError, operating, testing, fetchAll, fetchGpu, operate,
    operateModel, selectModel, testDatabase, testText, testVision, testEmbedding,
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

  /** 槽位操作（/models/{slot}/{op}，消息提示；启动/停止经后端单活仲裁） */
  const onModelOperate = async (slot: ModelSlot, op: ModelOp) => {
    const result = await operateModel(slot, op);
    const label = slot === 'text' ? '文字模型' : '图像模型';
    const opLabel = OP_LABELS[op];
    if (result.success) {
      message.success(`「${label}」${opLabel}成功（${result.status}）`);
    } else {
      message.warning(`「${label}」${opLabel}未生效：${result.reason ?? '状态未收敛'}`);
    }
  };

  /** 槽位运行态选择（来源/渠道/身份，POST /models/{slot}/select 写 manifest） */
  const onSelectModel = (slot: SlotName, patch: SlotSelectPatch) => selectModel(slot, patch);

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
        QED 服务管理 + 资源监控
      </Text>

      {error && (
        <Alert
          type="error" showIcon style={{ marginBottom: 16 }}
          message="控制台数据获取失败"
          description={`${error}。请确认 8900 管理服务已启动后点「刷新」。`}
        />
      )}

      {/* ①服务管理（四服务卡；web仅重启，config仅重启） */}
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

      {/* ②基础设施（元数据库：只读探测 + 测试，本期不做启停） */}
      <Title level={4} style={{ marginTop: 24 }}>基础设施</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={8}>
          <DependencyCard
            name="元数据库"
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
      </Row>

      {/* ③资源监控（GPU 状态 + 本地模型） */}
      <Title level={4} style={{ marginTop: 24 }}>资源监控</Title>
      <GpuOverview gpu={gpu} gpuError={gpuError} />

      {/* 模型三槽位（PLAN-046：渠道/可用状态 + local 模型下拉；向量卡仅测试）——紧跟 GPU 状态卡 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12} xl={8}>
          <SlotCard
            label="文字模型"
            icon={<RobotOutlined />}
            status={slots.text}
            statusError={slotErrors.text}
            testing={testing === 'text'}
            operating={operating === 'text'}
            onTest={testText}
            onOperate={(op) => void onModelOperate('text', op)}
            onSelect={(patch) => onSelectModel('text', patch)}
          />
        </Col>
        <Col xs={24} md={12} xl={8}>
          <SlotCard
            label="图像模型"
            icon={<PictureOutlined />}
            status={slots.vision}
            statusError={slotErrors.vision}
            testing={testing === 'vision'}
            operating={operating === 'vision'}
            onTest={testVision}
            onOperate={(op) => void onModelOperate('vision', op)}
            onSelect={(patch) => onSelectModel('vision', patch)}
          />
        </Col>
        <Col xs={24} md={12} xl={8}>
          <SlotCard
            label="向量模型"
            icon={<ApiOutlined />}
            status={slots.embedding}
            statusError={slotErrors.embedding}
            testing={testing === 'embedding'}
            operating={false}
            onTest={testEmbedding}
            onSelect={(patch) => onSelectModel('embedding', patch)}
          />
        </Col>
      </Row>
    </Layout.Content>
  );
}
