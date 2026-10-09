/**
 * GpuOverview 组件单元测试（纯函数 + 渲染冒烟）
 * - buildVramSlices：三聚合切片（模型占用/其他/空闲）/ WDDM 退化（颜色契约）
 * - formatGb：MB→GB 格式化
 * - 渲染：标题「GPU 状态」、三态降级文案、全量内存占比饼图
 * 完整交互链路（fetchAll/60s 定时器/启停收敛）由 Console.test.tsx 界面驱动覆盖。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GpuOverview, {
  buildVramSlices, buildModelShares, buildHeavyProcesses, processBasename, vramHighWater,
  HEAVY_VRAM_SHARE_PCT, VRAM_HIGH_WATER_PCT, formatGb,
} from './GpuOverview';
import { deriveRunningModels } from '../stores/runtime';
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

describe('本地模型占用与显存大户（ARCH-037）', () => {
  const slotsLocal = {
    text: { slot: 'text', source: 'local', channel: 'lmstudio', identity: 'qwen3.5-9b', ready: true },
    vision: null, embedding: null,
  } as unknown as Record<import('../stores').SlotName, import('../stores').SlotStatus | null>;
  const slotsDocker = {
    text: null,
    vision: { slot: 'vision', source: 'local', channel: 'docker', identity: 'mineru', ready: true },
    embedding: null,
  } as unknown as Record<import('../stores').SlotName, import('../stores').SlotStatus | null>;
  const gpuWithModel: GpuStatus = {
    ...gpuBase,
    memory_used_mb: 15020,
    processes: [
      { pid: 1, name: 'C:\\Program Files\\LM Studio\\LM Studio.exe', memory_mb: 12879, kind: 'model' },
      { pid: 2, name: 'dwm.exe', memory_mb: 2297, kind: 'other' },
      { pid: 3, name: 'chrome.exe', memory_mb: 454, kind: 'other' },
    ],
  };

  it('buildModelShares：宿主可见渠道取模型进程和并算占总显存比例；docker 渠道标注不可见', () => {
    const [share] = buildModelShares(gpuWithModel, deriveRunningModels(slotsLocal));
    expect(share.mb).toBe(12879);
    expect(share.pct).toBeCloseTo(78.6, 1);
    expect(share.model.identity).toBe('qwen3.5-9b');
    const [docker] = buildModelShares(gpuWithModel, deriveRunningModels(slotsDocker));
    expect(docker.mb).toBeNull();
    expect(docker.pct).toBeNull();
  });

  it('buildHeavyProcesses：≥10% 逐条列出并按占比降序（系统进程照实列），<10% 不列', () => {
    const heavy = buildHeavyProcesses(gpuWithModel);
    expect(heavy.map((h) => processBasename(h.name))).toEqual(['LM Studio.exe', 'dwm.exe']);
    expect(heavy[0].pct).toBeCloseTo(78.6, 1);
    expect(heavy[1].pct).toBeCloseTo(14.0, 1);
  });

  it('vramHighWater：总显存占比 ≥95% 为真，否则为假；阈值是具名常量', () => {
    expect(VRAM_HIGH_WATER_PCT).toBe(95);
    expect(HEAVY_VRAM_SHARE_PCT).toBe(10);
    expect(vramHighWater({ ...gpuBase, memory_used_mb: 15560 })).toBe(true);
    expect(vramHighWater(gpuWithModel)).toBe(false);
    expect(vramHighWater({ available: true, memory_total_mb: 0 })).toBe(false);
  });

  it('本地模型未启用（未取到槽位）时占用行整行不渲染，「当前在跑」不再出现', () => {
    render(<GpuOverview gpu={gpuWithModel} gpuError={null} slots={null} />);
    expect(screen.queryByText(/本地模型占用/)).not.toBeInTheDocument();
    expect(screen.queryByText(/当前在跑/)).not.toBeInTheDocument();
  });

  it('本地模型启用时渲染占用行：身份 + 占总显存比例', () => {
    render(<GpuOverview gpu={gpuWithModel} gpuError={null} slots={slotsLocal} />);
    expect(screen.getByText(/本地模型占用/)).toBeInTheDocument();
    expect(screen.getByText(/qwen3\.5-9b/)).toBeInTheDocument();
    // 「 总显存」后缀专属占用行，与显存大户清单的同值条目区分
    expect(screen.getByText(/12\.6 GB／78\.6% 总显存/)).toBeInTheDocument();
  });

  it('docker 渠道（WSL 容器内模型）占用如实标不可见，不报假 0', () => {
    render(<GpuOverview gpu={gpuWithModel} gpuError={null} slots={slotsDocker} />);
    expect(screen.getByText(/容器内不可见/)).toBeInTheDocument();
    expect(screen.queryByText(/总显存/)).not.toBeInTheDocument();
  });

  it('显存大户清单渲染 ≥10% 的应用名与占比，10% 以下不出现', () => {
    render(<GpuOverview gpu={gpuWithModel} gpuError={null} slots={null} />);
    expect(screen.getByText(/显存大户/)).toBeInTheDocument();
    expect(screen.getByText(/dwm\.exe/)).toBeInTheDocument();
    expect(screen.queryByText(/chrome\.exe/)).not.toBeInTheDocument();
  });

  it('总显存 ≥95% 出提示文案，未达线不出现（只提示，无任何自动处置）', () => {
    const high = { ...gpuWithModel, memory_used_mb: 15600 };
    const r1 = render(<GpuOverview gpu={high} gpuError={null} slots={null} />);
    expect(r1.getByText(/显存已用/)).toBeInTheDocument();
    r1.unmount();
    const r2 = render(<GpuOverview gpu={gpuWithModel} gpuError={null} slots={null} />);
    expect(r2.queryByText(/显存已用/)).not.toBeInTheDocument();
  });
});

