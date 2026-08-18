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
vi.mock('echarts/charts', () => ({ BarChart: vi.fn(), PieChart: vi.fn() }));
vi.mock('echarts/components', () => ({ GridComponent: vi.fn(), TooltipComponent: vi.fn(), LegendComponent: vi.fn(), TitleComponent: vi.fn() }));
vi.mock('echarts/renderers', () => ({ CanvasRenderer: vi.fn() }));

describe('EChart 封装（echarts/core 生命周期）', () => {
  beforeEach(() => {
    mocks.init.mockReset();
  });

  it('init → setOption；option 变化重新 setOption', () => {
    const setOption = vi.fn();
    const dispose = vi.fn();
    mocks.init.mockReturnValue({ setOption, dispose, resize: vi.fn() });
    const { rerender } = render(<EChart option={{ series: [{ data: [1] }] }} />);
    expect(mocks.init).toHaveBeenCalledTimes(1);
    expect(setOption).toHaveBeenCalledWith({ series: [{ data: [1] }] }, true);
    rerender(<EChart option={{ series: [{ data: [2] }] }} />);
    expect(setOption).toHaveBeenLastCalledWith({ series: [{ data: [2] }] }, true);
  });

  it('unmount → dispose 释放', () => {
    const dispose = vi.fn();
    mocks.init.mockReturnValue({ setOption: vi.fn(), dispose, resize: vi.fn() });
    const { unmount } = render(<EChart option={{}} />);
    unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('窗口 resize → chart.resize 自适应', () => {
    const resize = vi.fn();
    mocks.init.mockReturnValue({ setOption: vi.fn(), dispose: vi.fn(), resize });
    render(<EChart option={{}} />);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(resize).toHaveBeenCalledTimes(1);
  });
});