import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import EChart from './EChart';

const mocks = {
  init: vi.fn(),
};

vi.mock('echarts/core', () => ({
  init: (...args: unknown[]) => mocks.init(...args),
  use: vi.fn(),
}));
vi.mock('echarts/charts', () => ({ BarChart: vi.fn(), GraphChart: vi.fn(), PieChart: vi.fn() }));
vi.mock('echarts/components', () => ({ GridComponent: vi.fn(), TooltipComponent: vi.fn(), LegendComponent: vi.fn(), TitleComponent: vi.fn() }));
vi.mock('echarts/renderers', () => ({ CanvasRenderer: vi.fn() }));

/** 返回带 on/setOption/dispose/resize 的假实例，并记录注册的 click 处理器 */
function fakeChart() {
  const handlers: Record<string, (params: unknown) => void> = {};
  const instance = {
    setOption: vi.fn(),
    dispose: vi.fn(),
    resize: vi.fn(),
    on: vi.fn((event: string, handler: (params: unknown) => void) => {
      handlers[event] = handler;
    }),
    handlers,
  };
  mocks.init.mockReturnValue(instance);
  return instance;
}

describe('EChart 封装（echarts/core 生命周期）', () => {
  beforeEach(() => {
    mocks.init.mockReset();
  });

  it('init → setOption；option 变化重新 setOption', () => {
    const chart = fakeChart();
    const { rerender } = render(<EChart option={{ series: [{ data: [1] }] }} />);
    expect(mocks.init).toHaveBeenCalledTimes(1);
    expect(chart.setOption).toHaveBeenCalledWith({ series: [{ data: [1] }] }, true);
    rerender(<EChart option={{ series: [{ data: [2] }] }} />);
    expect(chart.setOption).toHaveBeenLastCalledWith({ series: [{ data: [2] }] }, true);
  });

  it('unmount → dispose 释放', () => {
    const chart = fakeChart();
    const { unmount } = render(<EChart option={{}} />);
    unmount();
    expect(chart.dispose).toHaveBeenCalledTimes(1);
  });

  it('窗口 resize → chart.resize 自适应', () => {
    const chart = fakeChart();
    render(<EChart option={{}} />);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(chart.resize).toHaveBeenCalledTimes(1);
  });

  it('点击带 id 的数据项 → onSelect；无 id 或不传 onSelect 不报错', () => {
    const onSelect = vi.fn();
    const chart = fakeChart();
    render(<EChart option={{}} onSelect={onSelect} />);
    const click = chart.handlers.click;
    expect(click).toBeTypeOf('function');
    act(() => click({ data: { id: '01_math_analysis' } }));
    expect(onSelect).toHaveBeenCalledWith('01_math_analysis');
    act(() => click({ data: {} }));
    expect(onSelect).toHaveBeenCalledTimes(1);

    const plain = fakeChart();
    render(<EChart option={{}} />);
    expect(() => plain.handlers.click({ data: { id: 'x' } })).not.toThrow();
  });
});
