/**
 * 仪表盘「本地模型状况」卡（ARCH-028 W4）：显隐按槽位生效来源，单/双卡按单活守卫。
 * - 全槽位 api（或未加载）→ 整卡隐藏（纯 API 模式零存在感）
 * - resource_guard=true → 恒单卡「当前占位模型」：就绪/降级优先（图像优先持续监控）
 *   > 最近翻转活跃 > 默认文字槽位；guard=false → text/vision 双卡并列
 * - 徽章数据源 health_state（监督器观测，含降级态）；空值回退 ready 推导（监督器关闭/旧后端兼容）
 * 数据全部消费共享 runtime store（30s 轮询由 Dashboard 驱动 fetchSlots/fetchGpu）。
 */
import { Card, Col, Row, Space, Tag, Tooltip, Typography } from 'antd';
import { DesktopOutlined } from '@ant-design/icons';
import { useRuntimeStore } from '../../stores/runtime';
import type { SlotStatus } from '../../stores';

const { Text } = Typography;

const SLOT_LABEL: Record<string, string> = { text: '文字模型', vision: '图像模型' };
const CHANNEL_LABEL: Record<string, string> = {
  lmstudio: 'LM Studio', docker: 'Docker', llamacpp: 'llama.cpp', direct: '直连',
};
const STATE_TAG: Record<string, { color: string; text: string }> = {
  ready: { color: 'success', text: '就绪' },
  degraded: { color: 'warning', text: '降级' },
  down: { color: 'error', text: '掉线' },
};

/** 观测态优先；无监督器观测回退 ready 布尔推导（旧后端/监督器关闭兼容） */
export function slotHealthState(s: SlotStatus): string {
  return s.health_state || (s.ready ? 'ready' : '');
}

/** 单活守卫下的「当前占位模型」：在跑（就绪/降级，图像优先）> 最近翻转 > 默认文字 */
function pickOccupied(list: SlotStatus[]): SlotStatus {
  const on = list.filter((s) => slotHealthState(s) === 'ready' || slotHealthState(s) === 'degraded');
  if (on.length > 0) {
    return on.find((s) => s.slot === 'vision') ?? on[0];
  }
  const latest = [...list].sort((a, b) => (b.last_flip ?? '').localeCompare(a.last_flip ?? ''))[0];
  if (latest?.last_flip) return latest;
  return list.find((s) => s.slot === 'text') ?? list[0];
}

function GpuMem() {
  const gpu = useRuntimeStore((s) => s.gpu);
  const vram = gpu?.available
    ? `${((gpu.memory_used_mb ?? 0) / 1024).toFixed(1)} / ${Math.round((gpu.memory_total_mb ?? 0) / 1024)} GiB`
    : '—';
  return <Text type="secondary" style={{ fontSize: 12 }}>显存 {vram}</Text>;
}

function SlotItem({ status }: { status: SlotStatus }) {
  const state = slotHealthState(status);
  const tag = STATE_TAG[state] ?? { color: 'default', text: '未就绪' };
  const flip = status.last_flip ? status.last_flip.slice(11, 19) : '';
  return (
    <Col xs={24} md={12} lg={flip ? 24 : 12}>
      <Space direction="vertical" size={2}>
        <Space size={8} wrap>
          <Text strong>{SLOT_LABEL[status.slot] ?? status.slot}</Text>
          <Tooltip title={status.health_reason || undefined}>
            <Tag color={tag.color} style={{ marginInlineEnd: 0 }}>{tag.text}</Tag>
          </Tooltip>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {CHANNEL_LABEL[status.channel] ?? status.channel}
          </Text>
          <GpuMem />
          {flip && <Text type="secondary" style={{ fontSize: 12 }}>翻转于 {flip}</Text>}
        </Space>
      </Space>
    </Col>
  );
}

export default function LocalModelStatus() {
  const slots = useRuntimeStore((s) => s.slots);
  const keys = useRuntimeStore((s) => s.keys);
  const localSlots = ([slots.text, slots.vision] as (SlotStatus | null)[])
    .filter((s): s is SlotStatus => Boolean(s) && (s as SlotStatus).source === 'local');
  if (localSlots.length === 0) return null;
  const guard = keys?.resource_guard ?? true;
  const shown = guard ? [pickOccupied(localSlots)] : localSlots;
  return (
    <Card
      size="small"
      title={<Space><DesktopOutlined />本地模型状况</Space>}
      extra={<Text type="secondary">数据源监督器探针 · 启停操作请到控制台</Text>}
      style={{ marginBottom: 16 }}
    >
      <Row gutter={[16, 8]}>
        {shown.map((s) => <SlotItem key={s.slot} status={s} />)}
      </Row>
    </Card>
  );
}
