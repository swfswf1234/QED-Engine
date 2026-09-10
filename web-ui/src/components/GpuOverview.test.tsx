/**
 * GpuOverview 组件单元测试（纯函数 + 渲染冒烟）
 * - buildVramSlices：三聚合切片（模型占用/其他/空闲）/ WDDM 退化（颜色契约）
 * - formatGb：MB→GB 格式化
 * - 渲染：标题「GPU 状态」、三态降级文案、全量内存占比饼图
 * 完整交互链路（fetchAll/60s 定时器/启停收敛）由 Console.test.tsx 界面驱动覆盖。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GpuOverview, { buildVramSlices, formatGb } from './GpuOverview';
import type { GpuStatus } from '../stores';

// ECharts 依赖 canvas，jsdom 不可用；以占位组件透出 option.series 供断言
vi.mock('./EChart', () => ({
  default: ({ option }: { option: { series?: { data?: unknown[] }[] } }) => (
    <div data-testid="echart" data-series={JSON.stringify(option.series ?? [])} />
  ),
}));

const gpuBase: GpuStatus = {
  available: true,
  name: 'RTX 4080',
  memory_total_mb: 16376,
  memory_used_mb: 4096,
  utilization_percent: 30,
  processes: [],
  sys_memory_total_mb: 32768,
  sys_memory_used_mb: 14745,
  sys_memory_percent: 45,
  reason: '',
};

describe('formatGb（MB→GB 格式化）', () => {
  it('正常值保留 1 位小数', () => {
    expect(formatGb(16376)).toBe('16.0 GB');
    expect(formatGb(4096)).toBe('4.0 GB');
    expect(formatGb(512)).toBe('0.5 GB');
  });
  it('null/undefined 返回 —', () => {
    expect(formatGb(null)).toBe('—');
    expect(formatGb(undefined)).toBe('—');
  });
});

describe('buildVramSlices（全量内存占比切片）', () => {
  it('三聚合切片：按 PDH 比例分配驻留值，模型占用蓝、其他灰、空闲绿', () => {
    const slices = buildVramSlices({
      ...gpuBase,
      processes: [
        { pid: 1, name: 'LM Studio.exe', memory_mb: 3000, kind: 'model' },
        { pid: 2, name: 'LM Studio.exe', memory_mb: 1000, kind: 'model' },
        { pid: 3, name: 'chrome.exe', memory_mb: 500, kind: 'other' },
      ],
    });
    expect(slices.map((s) => s.name)).toEqual(['模型占用', '其他', '空闲']);
    // 总占用 = memory_used_mb=4096；PDH model=4000, other=500, total=4500
    // modelMb = 4096 * 4000/4500 ≈ 3641.78
    expect(slices[0].value).toBeCloseTo(4096 * (4000 / 4500), 0);
    expect(slices[0].color).toBe('#5b8ff9');
    // otherMb = 4096 * 500/4500 ≈ 454.22
    expect(slices[1].value).toBeCloseTo(4096 * (500 / 4500), 0);
    expect(slices[1].color).toBe('#d9d9d9');
    // free = 16376 - 4096 = 12280（与信息行一致）
    expect(slices[2].value).toBe(16376 - 4096);
    expect(slices[2].color).toBe('#52c41a');
  });

  it('WDDM（每进程 MB 全 null）→ 退化为 模型占用/空闲 两片', () => {
    const slices = buildVramSlices({
      ...gpuBase,
      memory_used_mb: 4635,
      processes: [{ pid: 1, name: 'LM Studio.exe', memory_mb: null, kind: 'model' }],
    });
    expect(slices.map((s) => s.name)).toEqual(['模型占用', '空闲']);
    expect(slices[0].color).toBe('#5b8ff9');
    expect(slices[1].color).toBe('#52c41a');
  });

  it('无进程且无 total → 空数组', () => {
    const slices = buildVramSlices({ available: true });
    expect(slices).toEqual([]);
  });
});

describe('GpuOverview 渲染', () => {
  it('卡片标题为「GPU 状态」，旧名不再出现', () => {
    render(<GpuOverview gpu={gpuBase} gpuError={null} />);
    expect(screen.getByText(/GPU 状态/)).toBeInTheDocument();
    expect(screen.queryByText(/资源总览/)).not.toBeInTheDocument();
    expect(screen.queryByText(/服务监控/)).not.toBeInTheDocument();
    expect(screen.queryByText(/GPU 总览/)).not.toBeInTheDocument();
  });

  it('三态降级：探测失败 / 探测中 / GPU 不可用', () => {
    const r1 = render(<GpuOverview gpu={null} gpuError="boom" />);
    expect(r1.getByText(/GPU 探测失败（boom）/)).toBeInTheDocument();
    r1.unmount();
    const r2 = render(<GpuOverview gpu={null} gpuError={null} />);
    expect(r2.getByText('探测中…')).toBeInTheDocument();
    r2.unmount();
    render(<GpuOverview gpu={{ available: false, reason: '未检测到显卡' }} gpuError={null} />);
    expect(screen.getByText(/GPU 不可用（未检测到显卡）/)).toBeInTheDocument();
  });

  it('GPU 信息显示 GB 单位 + 饼图图例', () => {
    render(
      <GpuOverview
        gpu={{
          ...gpuBase,
          processes: [
            { pid: 1, name: 'llama-server.exe', memory_mb: 8000, kind: 'model' },
            { pid: 2, name: 'chrome.exe', memory_mb: 500, kind: 'other' },
          ],
        }}
        gpuError={null}
      />,
    );
    // GB 格式
    expect(screen.getByText(/4\.0 GB \/ 16\.0 GB/)).toBeInTheDocument();
    // 图例色块
    expect(screen.getByText('模型占用')).toBeInTheDocument();
    expect(screen.getByText('其他')).toBeInTheDocument();
    expect(screen.getByText('空闲')).toBeInTheDocument();
    // 无进程清单
    expect(screen.queryByText('模型进程')).not.toBeInTheDocument();
    expect(screen.queryByText('非模型任务')).not.toBeInTheDocument();
  });
});
