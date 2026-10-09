/**
 * 仪表盘块一「本地模型列表」常驻分节（2026-09-24 五改 F1，内嵌于「服务详情」卡）：
 * 分节标题居中；文字模型在左、图像模型在右两栏；每栏顺序＝槽位名 → 模型名称（如有）→
 * 状态徽章，三列固定列宽（内容增减不移动）。模型名 `slot.model` 非空即显示（不限已加载）。
 * 三态判据（degraded 与全 api 并入未加载，四改口径不变）：
 * - 已加载＝ready=true；未加载＝source api / 服务活着（health_state ready|degraded）但
 *   模型未起；未启动＝health_state down 或无数据（无观测+无绑定）。
 * - W7 启动宽限（ARCH-028 增强批）：health_state=starting → 第四态「启动中」（先于 ready
 *   判定——冷启动期实时探针可先绿，宽限窗口＝监督器解锁前不判就绪/掉线）。
 * - 与控制台 availability 为双口径（实时单发探针 vs 防抖定态，滞后 ≤2min 属设计，
 *   health_reason/云端来源说明只进徽章 tooltip）。
 * 数据全部消费共享 runtime store（30s 轮询由 Dashboard 驱动 fetchSlots）。
 */
import { Col, Row, Tag, Tooltip, Typography } from 'antd';
import { useRuntimeStore } from '../../stores/runtime';
import type { SlotStatus } from '../../stores';

const { Text } = Typography;

const SLOT_LABEL: Record<'text' | 'vision', string> = { text: '文字模型', vision: '图像模型' };

export type ModelLoadState = '已加载' | '未加载' | '未启动' | '启动中';

const STATE_TAG: Record<ModelLoadState, { color: string }> = {
  已加载: { color: 'success' },
  未加载: { color: 'default' },
  未启动: { color: 'error' },
  启动中: { color: 'processing' },
};

/** 四态判定（null=无数据按未启动；api 检查先于 ready——
 * api 的 ready=API_KEY 已配置，不是本地模型已加载） */
export function slotModelState(s: SlotStatus | null): ModelLoadState {
  if (!s) return '未启动';
  if (s.source === 'api') return '未加载';
  if (s.health_state === 'starting') return '启动中';
  if (s.ready) return '已加载';
  if (s.health_state === 'down') return '未启动';
  return '未加载';
}

function stateTooltip(s: SlotStatus | null): string | undefined {
  if (!s) return '尚无槽位数据';
  if (s.source === 'api') return '云端 API 来源，无本地模型';
  return s.health_reason || undefined;
}

const NAME_WIDTH = 180;

function SlotColumn({ slot }: { slot: 'text' | 'vision' }) {
  const status = useRuntimeStore((s) => s.slots[slot]);
  const state = slotModelState(status);
  return (
    <div data-slot-column={slot} style={{ display: 'flex', alignItems: 'center' }}>
      <Text strong style={{ width: 76, flexShrink: 0 }}>{SLOT_LABEL[slot]}</Text>
      {/* 模型名列固定宽占位，有无名字徽章都不移动 */}
      <Text
        type="secondary"
        title={status?.model || undefined}
        style={{ width: NAME_WIDTH, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {status?.model || ''}
      </Text>
      <Tooltip title={stateTooltip(status)}>
        <Tag color={STATE_TAG[state].color} style={{ width: 64, textAlign: 'center', marginInlineEnd: 0 }}>
          {state}
        </Tag>
      </Tooltip>
    </div>
  );
}

export default function LocalModelStatus() {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <Text strong>本地模型列表</Text>
      </div>
      <Row gutter={24}>
        <Col span={12}><SlotColumn slot="text" /></Col>
        <Col span={12}><SlotColumn slot="vision" /></Col>
      </Row>
    </div>
  );
}
