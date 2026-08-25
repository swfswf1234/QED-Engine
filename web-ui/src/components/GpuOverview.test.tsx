/**
 * GpuOverview 组件单元测试（纯函数 + 渲染冒烟）
 * - buildVramSlices：按进程名聚合切片 / 系统·图形占用兜底 / WDDM 退化（颜色契约）
 * - aggregateProcs / friendlyProcLabel：同名合并 ×N、MB 求和、友好分类与排序
 * - 渲染：标题「资源总览」（2026-08-24 改名裁决）、三态降级文案、进程逐行显示与排序
 * 完整交互链路（fetchAll/60s 定时器/启停收敛）由 Console.test.tsx 界面驱动覆盖。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GpuOverview, { buildVramSlices, aggregateProcs, friendlyProcLabel } from './GpuOverview';
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

describe('buildVramSlices（显存构成切片）', () => {
  it('按进程名聚合 MB：model 蓝系、other 橙红，尾部系统·图形占用兜底', () => {
    const slices = buildVramSlices({
      ...gpuBase,
      processes: [
        { pid: 1, name: 'LM Studio.exe', memory_mb: 3000, kind: 'model' },
        { pid: 2, name: 'LM Studio.exe', memory_mb: 1000, kind: 'model' },
        { pid: 3, name: 'chrome.exe', memory_mb: 500, kind: 'other' },
      ],
    });
    expect(slices.map((s) => s.name)).toEqual(['LM Studio.exe', 'chrome.exe', '系统·图形占用']);
    expect(slices[0].value).toBe(4000);
    expect(slices[0].color).toBe('#5b8ff9');
    expect(slices[1].color).toBe('#ffa940');
    expect(slices[2].value).toBe(16376 - 4000 - 500);
  });

  it('WDDM（每进程 MB 全 null）→ 退化为 已用/空闲 两片（颜色契约：已用蓝/空闲绿）', () => {
    const slices = buildVramSlices({
      ...gpuBase,
      memory_used_mb: 4635,
      processes: [{ pid: 1, name: 'LM Studio.exe', memory_mb: null, kind: 'model' }],
    });
    expect(slices.map((s) => s.name)).toEqual(['已用', '空闲']);
    expect(slices[0].color).toBe('#5b8ff9');
    expect(slices[1].color).toBe('#52c41a');
  });
});

describe('aggregateProcs / friendlyProcLabel（进程清单聚合）', () => {
  it('同名合并 ×N；MB 取有值之和；全未知 → null', () => {
    const agg = aggregateProcs(
      [
        { pid: 1, name: 'C:\\x\\LM Studio.exe', memory_mb: 100, kind: 'model' },
        { pid: 2, name: 'C:\\x\\LM Studio.exe', memory_mb: null, kind: 'model' },
      ],
      false,
    );
    expect(agg).toEqual([{ label: 'LM Studio.exe', count: 2, memoryMb: 100 }]);
  });

  it('friendly：浏览器/Windows 进程归类且排前，具体程序保留短名排后', () => {
    const agg = aggregateProcs(
      [
        { pid: 1, name: 'cef_server.exe', memory_mb: 10, kind: 'other' },
        { pid: 2, name: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', memory_mb: 500, kind: 'other' },
        { pid: 3, name: 'C:\\Windows\\explorer.exe', memory_mb: null, kind: 'other' },
      ],
      true,
    );
    expect(agg.map((a) => a.label)).toEqual(['浏览器进程', 'Windows 进程', 'cef_server.exe']);
    expect(agg[0].memoryMb).toBe(500);
    expect(agg[1].memoryMb).toBeNull();
  });

  it('friendlyProcLabel：权限受限进程归类；普通程序返回短名', () => {
    expect(friendlyProcLabel('x', '[Insufficient Permissions]')).toBe('权限受限进程');
    expect(friendlyProcLabel('C:\\y\\foo.exe', 'foo.exe')).toBe('foo.exe');
  });
});

describe('GpuOverview 渲染', () => {
  it('卡片标题为「资源总览」（2026-08-24 改名裁决），旧名与刷新周期字样不再出现', () => {
    render(<GpuOverview gpu={gpuBase} gpuError={null} />);
    expect(screen.getByText(/资源总览/)).toBeInTheDocument();
    expect(screen.queryByText(/GPU 总览/)).not.toBeInTheDocument();
    expect(screen.queryByText(/显存构成/)).not.toBeInTheDocument();
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

  it('进程清单逐行显示：模型进程区在前、非模型任务区在后（换行契约）', () => {
    render(
      <GpuOverview
        gpu={{
          ...gpuBase,
          processes: [
            { pid: 1, name: 'llama-server.exe', memory_mb: 8000, kind: 'model' },
            { pid: 2, name: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', memory_mb: 500, kind: 'other' },
          ],
        }}
        gpuError={null}
      />,
    );
    const modelLabel = screen.getByText('模型进程');
    const otherLabel = screen.getByText('非模型任务');
    expect(otherLabel.compareDocumentPosition(modelLabel)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
    // 每进程独立一行：8000/16376 ≈ 49%；chrome → 浏览器进程 500 MB ≈ 3%
    expect(screen.getByText(/llama-server\.exe 8000 MB（49%）/)).toBeInTheDocument();
    expect(screen.getByText(/浏览器进程 500 MB（3%）/)).toBeInTheDocument();
  });
});
