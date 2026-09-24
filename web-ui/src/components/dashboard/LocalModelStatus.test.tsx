/**
 * 块一「本地模型列表」分节测试（2026-09-24 五改 F1）
 * - 分节标题「本地模型列表」居中；文字模型在左、图像模型在右两栏（slot-column 顺序断言）
 * - 每栏顺序＝槽位名 → 模型名称（slot.model 非空即显示，不限已加载）→ 状态徽章；固定列宽
 * - 三态判据不变（四改）：ready→已加载；api/degraded→未加载；down/无数据→未启动
 * - 四改旧形态退役：「本地模型服务」标题、上下两行布局不再出现
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import LocalModelStatus, { slotModelState } from './LocalModelStatus';
import { theme } from '../../theme';
import { useRuntimeStore } from '../../stores/runtime';
import type { SlotStatus } from '../../stores';

function slot(partial: Partial<SlotStatus> & Pick<SlotStatus, 'slot' | 'source'>): SlotStatus {
  return {
    channel: partial.source === 'api' ? 'direct' : 'lmstudio',
    ready: false,
    ...partial,
  } as SlotStatus;
}

function seed(slots: { text: SlotStatus | null; vision: SlotStatus | null }) {
  useRuntimeStore.setState({
    slots: { text: slots.text, vision: slots.vision, embedding: null },
  });
}

function renderSection() {
  return render(
    <ConfigProvider theme={theme}>
      <LocalModelStatus />
    </ConfigProvider>,
  );
}

function columns(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-slot-column]')];
}

describe('slotModelState（三态判据，四改口径不变）', () => {
  it('null→未启动；api 先于 ready（api 的 ready=API_KEY 已配置≠模型已加载）', () => {
    expect(slotModelState(null)).toBe('未启动');
    expect(slotModelState(slot({ slot: 'text', source: 'api', ready: true }))).toBe('未加载');
    expect(slotModelState(slot({ slot: 'text', source: 'local', health_state: 'down' }))).toBe('未启动');
    // degraded 并入未加载（四改裁决）
    expect(slotModelState(slot({ slot: 'text', source: 'local', health_state: 'degraded' }))).toBe('未加载');
    expect(slotModelState(slot({ slot: 'text', source: 'local', health_state: 'ready' }))).toBe('未加载');
  });

  it('ready=true（local）→ 已加载', () => {
    expect(slotModelState(slot({ slot: 'text', source: 'local', ready: true, health_state: 'ready' }))).toBe('已加载');
  });
});

describe('仪表盘块一「本地模型列表」分节（五改 F1）', () => {
  beforeEach(() => {
    useRuntimeStore.setState({ slots: { text: null, vision: null, embedding: null } });
  });

  it('分节标题「本地模型列表」居中；左右两栏且文字模型在左（旧「本地模型服务」退役）', () => {
    const { container } = renderSection();
    const heading = screen.getByText('本地模型列表');
    // antd Text strong 渲染 span.ant-typography>strong，getByText 命中最内层 strong，
    // 居中层是最近的 div 祖先（非 parentElement）
    expect(heading.closest('div')).toHaveStyle({ 'text-align': 'center' });
    expect(screen.queryByText('本地模型服务')).not.toBeInTheDocument();
    const cols = columns(container);
    expect(cols.map((c) => c.dataset.slotColumn)).toEqual(['text', 'vision']);
    // 两栏恒在（无数据也各占一栏，不再是上下两行）
    expect(screen.getAllByText('未启动')).toHaveLength(2);
  });

  it('栏内顺序＝槽位名 → 模型名称 → 状态徽章；模型名非空即显示（未加载也显示）', () => {
    seed({
      text: slot({ slot: 'text', source: 'local', model: 'qwen3-32b', health_state: 'ready', ready: false }),
      vision: slot({ slot: 'vision', source: 'local', model: 'qwen-vl', health_state: 'down' }),
    });
    const { container } = renderSection();
    const textCol = columns(container)[0];
    expect(textCol.textContent).toBe('文字模型qwen3-32b未加载');
    const visionCol = columns(container)[1];
    expect(visionCol.textContent).toBe('图像模型qwen-vl未启动');
  });

  it('已加载 → 徽章「已加载」+ 模型名；无模型名时名字段留空但徽章定宽（列宽不移动）', () => {
    seed({
      text: slot({ slot: 'text', source: 'local', model: 'glm-4.5', ready: true, health_state: 'ready' }),
      vision: slot({ slot: 'vision', source: 'local', ready: false }),
    });
    const { container } = renderSection();
    const cols = columns(container);
    expect(cols[0].textContent).toBe('文字模型glm-4.5已加载');
    expect(cols[1].textContent).toBe('图像模型未加载');
    const badge = cols[1].querySelector('.ant-tag') as HTMLElement;
    expect(badge.style.width).toBe('64px');
    // 不显示：channel、翻转时间、旧徽章词
    expect(screen.queryByText(/LM Studio|Docker|翻转于/)).not.toBeInTheDocument();
    expect(screen.queryByText(/就绪|降级|掉线|未就绪|服务存活/)).not.toBeInTheDocument();
  });

  it('全 api → 两栏均「未加载」且显示 api 模型名（分节不隐藏）', () => {
    seed({
      text: slot({ slot: 'text', source: 'api', model: 'qwen-plus', ready: true }),
      vision: slot({ slot: 'vision', source: 'api', ready: false }),
    });
    const { container } = renderSection();
    const cols = columns(container);
    expect(cols[0].textContent).toBe('文字模型qwen-plus未加载');
    expect(cols[1].textContent).toBe('图像模型未加载');
    expect(screen.getAllByText('未加载')).toHaveLength(2);
  });

  it('degraded（容器 GPU 不可见）→ 徽章「未加载」，原因只进 tooltip 不上卡面', () => {
    seed({
      text: slot({ slot: 'text', source: 'api' }),
      vision: slot({
        slot: 'vision', source: 'local', channel: 'docker', ready: false,
        health_state: 'degraded', health_reason: '容器内 GPU 不可见', gpu_visible: false,
      }),
    });
    renderSection();
    expect(screen.getAllByText('未加载')).toHaveLength(2);
    expect(screen.queryByText('容器内 GPU 不可见')).not.toBeInTheDocument();
    expect(screen.queryByText(/显存/)).not.toBeInTheDocument();
  });
});
