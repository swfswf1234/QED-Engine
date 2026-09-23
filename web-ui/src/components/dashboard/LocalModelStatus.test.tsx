import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import LocalModelStatus from './LocalModelStatus';
import { theme } from '../../theme';
import { useRuntimeStore } from '../../stores/runtime';
import type { GpuStatus, SlotStatus } from '../../stores';

/** 槽位状态最小夹具（仪表盘状况卡只消费这些字段） */
function slot(partial: Partial<SlotStatus> & Pick<SlotStatus, 'slot' | 'source'>): SlotStatus {
  return {
    channel: partial.source === 'api' ? 'direct' : 'lmstudio',
    ready: false,
    ...partial,
  } as SlotStatus;
}

function seed(
  slots: { text: SlotStatus | null; vision: SlotStatus | null },
  opts: { guard?: boolean; gpu?: GpuStatus | null } = {},
) {
  useRuntimeStore.setState({
    slots: { text: slots.text, vision: slots.vision, embedding: null },
    keys: { provider: 'qwen', configured: true, mode: 'local', resource_guard: opts.guard ?? true },
    gpu: opts.gpu ?? null,
  });
}

function renderCard() {
  return render(
    <ConfigProvider theme={theme}>
      <LocalModelStatus />
    </ConfigProvider>,
  );
}

const GPU: GpuStatus = { available: true, memory_total_mb: 16384, memory_used_mb: 8192 };

describe('仪表盘「本地模型状况」卡（ARCH-028 W4 显隐与单卡规则）', () => {
  beforeEach(() => {
    useRuntimeStore.setState({ slots: { text: null, vision: null, embedding: null }, keys: null, gpu: null });
  });

  it('全槽位 api 来源（或未加载）→ 整卡隐藏', () => {
    seed(
      {
        text: slot({ slot: 'text', source: 'api' }),
        vision: slot({ slot: 'vision', source: 'api' }),
      },
    );
    renderCard();
    expect(screen.queryByText('本地模型状况')).not.toBeInTheDocument();
  });

  it('未加载（slots 全 null）→ 隐藏不闪空态', () => {
    seed({ text: null, vision: null });
    renderCard();
    expect(screen.queryByText('本地模型状况')).not.toBeInTheDocument();
  });

  it('单活守卫开：恒单卡，图像模型就绪即切图像并持续监控', () => {
    seed(
      {
        text: slot({ slot: 'text', source: 'local', health_state: 'down', ready: false }),
        vision: slot({ slot: 'vision', source: 'local', channel: 'docker', health_state: 'ready', ready: true }),
      },
      { guard: true },
    );
    renderCard();
    expect(screen.getByText('本地模型状况')).toBeInTheDocument();
    expect(screen.getByText('图像模型')).toBeInTheDocument();
    expect(screen.getByText('就绪')).toBeInTheDocument();
    expect(screen.getByText('Docker')).toBeInTheDocument();
    // 单卡：文字模型不呈现
    expect(screen.queryByText('文字模型')).not.toBeInTheDocument();
  });

  it('单活守卫开：都没在跑 → 默认呈现文字槽位（未就绪态）', () => {
    seed(
      {
        text: slot({ slot: 'text', source: 'local', ready: false }),
        vision: slot({ slot: 'vision', source: 'local', ready: false }),
      },
      { guard: true },
    );
    renderCard();
    expect(screen.getByText('文字模型')).toBeInTheDocument();
    expect(screen.getByText('未就绪')).toBeInTheDocument();
    expect(screen.queryByText('图像模型')).not.toBeInTheDocument();
  });

  it('单活守卫开：都没在跑但有近期翻转 → 呈现最后活跃槽位（图像）', () => {
    seed(
      {
        text: slot({ slot: 'text', source: 'local', ready: false, last_flip: '2026-09-23T08:00:00+08:00' }),
        vision: slot({ slot: 'vision', source: 'local', ready: false, last_flip: '2026-09-23T10:00:00+08:00' }),
      },
      { guard: true },
    );
    renderCard();
    expect(screen.getByText('图像模型')).toBeInTheDocument();
    expect(screen.getByText('翻转于 10:00:00')).toBeInTheDocument();
  });

  it('守卫关 → 文字/图像双卡并列', () => {
    seed(
      {
        text: slot({ slot: 'text', source: 'local', health_state: 'ready', ready: true }),
        vision: slot({ slot: 'vision', source: 'local', channel: 'docker', health_state: 'down', ready: false }),
      },
      { guard: false },
    );
    renderCard();
    expect(screen.getByText('文字模型')).toBeInTheDocument();
    expect(screen.getByText('图像模型')).toBeInTheDocument();
    expect(screen.getByText('掉线')).toBeInTheDocument();
  });

  it('降级态：T1 绿 + GPU 不可见 → 徽章「降级」+ 显存读数', () => {
    seed(
      {
        text: slot({ slot: 'text', source: 'api' }),
        vision: slot({
          slot: 'vision', source: 'local', channel: 'docker', ready: true,
          health_state: 'degraded', health_reason: '容器内 GPU 不可见', gpu_visible: false,
        }),
      },
      { gpu: GPU },
    );
    renderCard();
    expect(screen.getByText('降级')).toBeInTheDocument();
    expect(screen.getByText(/8\.0 \/ 16 GiB/)).toBeInTheDocument();
  });

  it('监督器关闭回退：health_state 空按 ready 推导（旧后端兼容）', () => {
    seed(
      {
        text: slot({ slot: 'text', source: 'local', ready: true }),
        vision: slot({ slot: 'vision', source: 'api' }),
      },
    );
    renderCard();
    expect(screen.getByText('文字模型')).toBeInTheDocument();
    expect(screen.getByText('就绪')).toBeInTheDocument();
    // keys 未下发 resource_guard（旧后端）→ 按 true 兜底：单卡不呈现图像
    expect(screen.queryByText('图像模型')).not.toBeInTheDocument();
  });
});
