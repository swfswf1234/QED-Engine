/**
 * GPU 状态卡（2026-09-06 重构：资源监控区块内 GPU 信息 + 全量内存占比饼图）
 * - 数据源 /monitor/gpu：指标行（显卡型号/显存/利用率/系统内存）+ 全量内存占比饼图（三色图例）
 * - 饼图切片：空闲（绿）/ 模型占用（蓝）/ 其他（灰），仅展示颜色图例，不显示逐任务占比
 * - 占用视角（ARCH-037，2026-10-03 用户裁决）：本地模型启用时给出其显存占用与占总显存比例
 *   （未启用整行不渲染），另列 ≥ HEAVY_VRAM_SHARE_PCT 的显存大户（系统进程照实列），
 *   总显存 ≥ VRAM_HIGH_WATER_PCT 时只提示不处置
 * - 纯函数导出（buildVramSlices / buildModelShares / buildHeavyProcesses / vramHighWater /
 *   formatGb）供单元测试与未来复用
 * - 三态降级：探测失败（gpuError）/ 探测中（null）/ GPU 不可用（available=false）
 */
import type { ReactNode } from 'react';
import { Alert, Card, Col, Descriptions, Row, Space, Tooltip, Typography } from 'antd';
import { DesktopOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { EChartsCoreOption } from 'echarts/core';
import EChart from './EChart';
import type { GpuStatus, SlotName, SlotStatus } from '../stores';
import { deriveRunningModels, type RunningModel } from '../stores/runtime';

const { Text } = Typography;

/** 饼图色板：模型占用蓝；其他灰；空闲绿 */
const MODEL_COLOR = '#5b8ff9';
const OTHER_COLOR = '#d9d9d9';
const FREE_COLOR = '#52c41a';

/** MB → GB，保留 1 位小数；null/undefined 返回 '—' */
export function formatGb(mb: number | null | undefined): string {
  if (mb == null) return '—';
  return `${(mb / 1024).toFixed(1)} GB`;
}

/** 显存大户列出阈值（占总显存百分比） */
export const HEAVY_VRAM_SHARE_PCT = 10;
/** 显存高位提示线（占总显存百分比，只提示不处置） */
export const VRAM_HIGH_WATER_PCT = 95;

/** 进程名取可执行文件名（Windows 全路径 / WSL 路径均适用） */
export function processBasename(name: string): string {
  const parts = name.split(/[\\/]/);
  return parts[parts.length - 1] || name;
}

/** 占用百分比（1 位小数）；总量缺失返回 null */
function sharePct(mb: number, totalMb: number | null | undefined): number | null {
  if (!totalMb) return null;
  return Number(((mb / totalMb) * 100).toFixed(1));
}

export interface ModelShare {
  model: RunningModel;
  /** 该槽位模型的显存占用 MB；渠道侧不可见（docker/WSL）或无进程明细时为 null */
  mb: number | null;
  pct: number | null;
}

/**
 * 本地模型显存占用（按槽位）：宿主可见渠道（lmstudio/llamacpp）取 kind=model 进程之和；
 * docker 渠道的显存计入驱动驻留、不出现在进程明细（如实标不可见，不报假 0）。
 * 单活仲裁下同时最多一个模型进 GPU，故可见合计只记给第一个非 docker 槽位（不重复计）。
 */
export function buildModelShares(gpu: GpuStatus, models: RunningModel[]): ModelShare[] {
  const visibleMb = (gpu.processes ?? []).reduce(
    (acc, p) => acc + (p.kind === 'model' ? p.memory_mb ?? 0 : 0), 0);
  let claimed = false;
  return models.map((model) => {
    const hostVisible = model.channel !== 'docker' && !claimed;
    if (!hostVisible || visibleMb <= 0) {
      return { model, mb: null, pct: null };
    }
    claimed = true;
    return { model, mb: visibleMb, pct: sharePct(visibleMb, gpu.memory_total_mb) };
  });
}

export interface HeavyProcess {
  pid: number;
  name: string;
  mb: number;
  pct: number;
}

/** 显存大户：逐进程占总显存 ≥ minPct 的应用（系统进程照实列），按占比降序 */
export function buildHeavyProcesses(gpu: GpuStatus, minPct: number = HEAVY_VRAM_SHARE_PCT): HeavyProcess[] {
  const total = gpu.memory_total_mb;
  if (!total) return [];
  const out: HeavyProcess[] = [];
  for (const p of gpu.processes ?? []) {
    if (p.memory_mb == null) continue;
    const pct = sharePct(p.memory_mb, total);
    if (pct == null || pct < minPct) continue;
    out.push({ pid: p.pid, name: p.name, mb: p.memory_mb, pct });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

/** 总显存高位判定（≥ VRAM_HIGH_WATER_PCT）；无总量数据时不报 */
export function vramHighWater(gpu: GpuStatus, linePct: number = VRAM_HIGH_WATER_PCT): boolean {
  const pct = sharePct(gpu.memory_used_mb ?? 0, gpu.memory_total_mb);
  return pct != null && pct >= linePct;
}

export interface VramSlice {
  name: string;
  value: number;
  color: string;
}

/**
 * 全量显存占比切片（三聚合：模型占用 / 其他 / 空闲）
 * - 总占用 = nvidia-smi memory_used_mb（物理驻留口径，与信息行一致）
 * - 模型/其他占比 = PDH Dedicated Usage 比例分配（PDH 仅用于拆分，不用于总量）
 * - 空闲 = total − 驻留值
 * - 无进程明细或 PDH 全 null 时退化为 已用/空闲 两片
 */
export function buildVramSlices(gpu: GpuStatus): VramSlice[] {
  const total = gpu.memory_total_mb;
  if (!total) return [];

  // 总占用：nvidia-smi 物理驻留值（与信息行一致）
  const totalUsedMb = gpu.memory_used_mb ?? 0;
  if (totalUsedMb <= 0) return [];

  // PDH 进程数据：仅用于计算模型/其他占比
  let modelPdhMb = 0;
  let otherPdhMb = 0;
  for (const p of gpu.processes ?? []) {
    if (p.memory_mb == null) continue;
    if (p.kind === 'other') otherPdhMb += p.memory_mb;
    else modelPdhMb += p.memory_mb;
  }

  // 按 PDH 比例分配驻留值
  let modelMb: number;
  let otherMb: number;
  const pdhTotal = modelPdhMb + otherPdhMb;
  if (pdhTotal > 0) {
    modelMb = totalUsedMb * (modelPdhMb / pdhTotal);
    otherMb = totalUsedMb * (otherPdhMb / pdhTotal);
  } else {
    // 无 PDH 数据或全 null → 全部归模型
    modelMb = totalUsedMb;
    otherMb = 0;
  }

  // 空闲 = total - 驻留值（与信息行一致）
  const freeMb = Math.max(total - totalUsedMb, 0);
  const slices: VramSlice[] = [];
  if (modelMb > 0) slices.push({ name: '模型占用', value: modelMb, color: MODEL_COLOR });
  if (otherMb > 0) slices.push({ name: '其他', value: otherMb, color: OTHER_COLOR });
  if (freeMb > 0) slices.push({ name: '空闲', value: freeMb, color: FREE_COLOR });
  return slices;
}

/** ECharts 环形饼图配置：tooltip 显示 GB（模型占用片附在跑身份名，REQ-033 S3），隐藏内置图例 */
function buildVramOption(gpu: GpuStatus, runningNames: string): EChartsCoreOption {
  const slices = buildVramSlices(gpu);
  return {
    tooltip: {
      trigger: 'item',
      formatter: ({ name, value }: { name: string; value: number }) =>
        name === '模型占用' && runningNames
          ? `${name}：${formatGb(value)}<br/>在跑：${runningNames}`
          : `${name}：${formatGb(value)}`,
    },
    legend: { show: false },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '44%'],
        label: { show: false },
        data: slices.map((s) => ({
          name: s.name,
          value: s.value,
          itemStyle: { color: s.color },
        })),
      },
    ],
  };
}

/** 自定义图例：色块 + 名称 */
function VramLegend({ slices }: { slices: VramSlice[] }) {
  if (slices.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4 }}>
      {slices.map((s) => (
        <Space key={s.name} size={4}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: s.color }} />
          <Text type="secondary" style={{ fontSize: 12 }}>{s.name}</Text>
        </Space>
      ))}
    </div>
  );
}

/**
 * GPU 状态卡：指标行 + 全量内存占比饼图 + 颜色图例
 * 三态降级：探测失败（gpuError）/ 探测中（null）/ GPU 不可用（available=false）
 */
export default function GpuOverview({
  gpu, gpuError, slots,
}: {
  gpu: GpuStatus | null;
  gpuError: string | null;
  /** 模型三槽位状态（在跑标注行数据源，store 既有字段派生零新增请求） */
  slots?: Record<SlotName, SlotStatus | null> | null;
}) {
  let body: ReactNode;
  if (gpuError) {
    body = <Text type="secondary">GPU 探测失败（{gpuError}）。点「刷新」重试。</Text>;
  } else if (!gpu) {
    body = <Text type="secondary">探测中…</Text>;
  } else if (!gpu.available) {
    body = <Text type="secondary">GPU 不可用（{gpu.reason || '未检测到显卡'}）</Text>;
  } else {
    const g = gpu;
    const slices = buildVramSlices(g);
    const slotMap = slots ?? { text: null, vision: null, embedding: null };
    const shares = buildModelShares(g, deriveRunningModels(slotMap));
    const runningNames = shares.map(({ model }) => `${model.label} ${model.identity}`).join('、');
    const heavy = buildHeavyProcesses(g);
    const highWater = vramHighWater(g);
    body = (
      <>
        {highWater && (
          <Alert
            style={{ marginBottom: 8 }}
            type="warning"
            showIcon
            message={`显存已用 ${sharePct(g.memory_used_mb ?? 0, g.memory_total_mb)}%（≥${VRAM_HIGH_WATER_PCT}% 提示线），接近占满`}
            description="仅提示，不做任何自动处置；停止模型或关闭大户后自行复核。"
          />
        )}
        <Row gutter={[16, 8]}>
          <Col xs={24} md={13}>
            <Descriptions size="small" column={1} colon={false}>
              <Descriptions.Item label="显卡型号">{g.name || '未知'}</Descriptions.Item>
              <Descriptions.Item label="显存使用">
                {formatGb(g.memory_used_mb)} / {formatGb(g.memory_total_mb)}
                <Tooltip title={`占用为 nvidia-smi 物理驻留口径；逐进程明细为 PDH 分配口径${g.utilization_source === 'pdh' ? '；利用率为 PDH（任务管理器同源）口径' : ''}。WSL 容器内模型的显存计入驱动驻留、不出现在进程明细中。`}>
                  <InfoCircleOutlined style={{ marginLeft: 6, color: '#999' }} />
                </Tooltip>
              </Descriptions.Item>
              {shares.length > 0 && (
                <Descriptions.Item label="本地模型占用">
                  <Space direction="vertical" size={0}>
                    {shares.map(({ model, mb, pct }) => (
                      <Text key={model.slot} style={{ fontSize: 12 }}>
                        {model.identity}
                        {' '}
                        {mb == null
                          ? <Text type="secondary">（{model.channel === 'docker' ? '容器内不可见，计入驱动驻留' : '占用不可见'}）</Text>
                          : <Text type="secondary">（{formatGb(mb)}／{pct}% 总显存）</Text>}
                      </Text>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
              {heavy.length > 0 && (
                <Descriptions.Item label={`显存大户 ≥${HEAVY_VRAM_SHARE_PCT}%`}>
                  <Space direction="vertical" size={0}>
                    {heavy.map((h) => (
                      <Text key={h.pid} style={{ fontSize: 12 }}>
                        {processBasename(h.name)} <Text type="secondary">（{formatGb(h.mb)}／{h.pct}%）</Text>
                      </Text>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="利用率">{g.utilization_percent}%</Descriptions.Item>
              <Descriptions.Item label="系统内存">{formatGb(g.sys_memory_used_mb)} / {formatGb(g.sys_memory_total_mb)}（{g.sys_memory_percent}%）</Descriptions.Item>
            </Descriptions>
          </Col>
          <Col xs={24} md={11}>
            <EChart option={buildVramOption(g, runningNames)} height={180} />
            <VramLegend slices={slices} />
          </Col>
        </Row>
      </>
    );
  }
  return (
    <Card size="small" title={<Space><DesktopOutlined />GPU 状态</Space>}>
      {body}
    </Card>
  );
}
