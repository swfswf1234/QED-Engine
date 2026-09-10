/**
 * GPU 状态卡（2026-09-06 重构：资源监控区块内 GPU 信息 + 全量内存占比饼图）
 * - 数据源 /monitor/gpu：指标行（显卡型号/显存/利用率/系统内存）+ 全量内存占比饼图（三色图例）
 * - 饼图切片：空闲（绿）/ 模型占用（蓝）/ 其他（灰），仅展示颜色图例，不显示逐任务占比
 * - 纯函数导出（buildVramSlices / formatGb）供单元测试与未来复用
 * - 三态降级：探测失败（gpuError）/ 探测中（null）/ GPU 不可用（available=false）
 */
import type { ReactNode } from 'react';
import { Card, Col, Descriptions, Row, Space, Typography } from 'antd';
import { DesktopOutlined } from '@ant-design/icons';
import type { EChartsCoreOption } from 'echarts/core';
import EChart from './EChart';
import type { GpuStatus } from '../stores';

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

/** ECharts 环形饼图配置：tooltip 显示 GB，隐藏内置图例（用自定义 HTML 图例替代） */
function buildVramOption(gpu: GpuStatus): EChartsCoreOption {
  const slices = buildVramSlices(gpu);
  return {
    tooltip: {
      trigger: 'item',
      formatter: ({ name, value }: { name: string; value: number }) =>
        `${name}：${formatGb(value)}`,
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
export default function GpuOverview({ gpu, gpuError }: { gpu: GpuStatus | null; gpuError: string | null }) {
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
    body = (
      <Row gutter={[16, 8]}>
        <Col xs={24} md={13}>
          <Descriptions size="small" column={1} colon={false}>
            <Descriptions.Item label="显卡型号">{g.name || '未知'}</Descriptions.Item>
            <Descriptions.Item label="显存使用">{formatGb(g.memory_used_mb)} / {formatGb(g.memory_total_mb)}</Descriptions.Item>
            <Descriptions.Item label="利用率">{g.utilization_percent}%</Descriptions.Item>
            <Descriptions.Item label="系统内存">{formatGb(g.sys_memory_used_mb)} / {formatGb(g.sys_memory_total_mb)}（{g.sys_memory_percent}%）</Descriptions.Item>
          </Descriptions>
        </Col>
        <Col xs={24} md={11}>
          <EChart option={buildVramOption(g)} height={180} />
          <VramLegend slices={slices} />
        </Col>
      </Row>
    );
  }
  return (
    <Card size="small" title={<Space><DesktopOutlined />GPU 状态</Space>}>
      {body}
    </Card>
  );
}
