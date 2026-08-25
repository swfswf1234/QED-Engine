/**
 * 资源总览卡（原「GPU 总览」，2026-08-24 用户裁决改名；自 Console.tsx 抽出独立模块）
 * - 数据源 /monitor/gpu：指标行（显卡型号/显存/利用率/系统内存）+ 显存构成饼图
 *   + ≥95% 显存常驻警告 + 进程清单（模型进程在前、非模型任务在后，每进程独立一行）
 * - 纯函数导出（buildVramSlices / aggregateProcs / friendlyProcLabel）供单元测试与未来复用
 * - 数据由全局 runtime store 提供；60s 刷新为全局设置（runtime 常量），不在卡片标题展示（2026-08-24）
 */
import type { ReactNode } from 'react';
import { Alert, Card, Col, Descriptions, Row, Space, Tooltip, Typography } from 'antd';
import { DesktopOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { EChartsCoreOption } from 'echarts/core';
import EChart from './EChart';
import type { GpuProcess, GpuStatus } from '../stores';

const { Text } = Typography;

/** 95% 显存占用警告阈值（2026-08-21 用户裁决） */
export const VRAM_WARNING_PERCENT = 95;

/** GPU 显存饼图切片色板（REQ-038）：模型蓝；非模型橙红高亮；系统·图形占用灰；空闲绿 */
const MODEL_SLICE_COLORS = ['#5b8ff9', '#61ddaa', '#78d3f8', '#7262fd', '#65789b'];
const OTHER_SLICE_COLOR = '#ffa940';
const SYSTEM_SLICE_COLOR = '#d9d9d9';
const FREE_SLICE_COLOR = '#52c41a';

export interface VramSlice {
  name: string;
  value: number;
  color: string;
}

/** 进程显示短名：完整路径只取末段（...\chrome.exe → chrome.exe）；[Insufficient Permissions] 原样较短 */
function shortProcName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  return base || name;
}

const BROWSER_PATTERN = /chrome|msedge|firefox|webview|opera|brave/i;
const WINDOWS_SYSTEM_BASES = new Set(['explorer.exe', 'shellhost.exe', 'runtimebroker.exe', 'dwm.exe']);

/**
 * 非模型进程友好分类（2026-08-23 用户裁决）：浏览器 → 「浏览器进程」、Windows 系统
 * （\Windows\、SystemApps、WindowsApps 及常见系统进程名）→ 「Windows 进程」、
 * [Insufficient Permissions] → 「权限受限进程」，其余保留短名（如 cef_server.exe）。
 */
export function friendlyProcLabel(fullName: string, shortName: string): string {
  const lower = fullName.toLowerCase();
  const base = shortName.toLowerCase();
  if (base.includes('insufficient permissions')) return '权限受限进程';
  if (BROWSER_PATTERN.test(base)) return '浏览器进程';
  if (
    lower.includes('\\windows\\') ||
    lower.includes('systemapps') ||
    lower.includes('windowsapps') ||
    WINDOWS_SYSTEM_BASES.has(base)
  ) {
    return 'Windows 进程';
  }
  return shortName;
}

/** 进程清单聚合项：按友好标签合并计数（浏览器进程 ×2），MB 取有值之和（全部未知则 null） */
export interface ProcAgg {
  label: string;
  count: number;
  memoryMb: number | null;
}

/**
 * 清单聚合：同名同 kind 合并为一条（LM Studio.exe ×2）；
 * friendly=true 时先做友好分类（浏览器/Windows 进程/权限受限）再聚合并前置，
 * 具体程序（保留短名）排在归类项之后。
 */
export function aggregateProcs(procs: GpuProcess[], friendly: boolean): ProcAgg[] {
  const agg = new Map<string, { label: string; order: number; count: number; known: number; unknown: number }>();
  for (const p of procs) {
    const short = shortProcName(p.name);
    const label = friendly ? friendlyProcLabel(p.name, short) : short;
    const cur = agg.get(label) ?? {
      label,
      order: friendly && label === short ? 1 : 0, // 归类项在前，具体程序在后
      count: 0,
      known: 0,
      unknown: 0,
    };
    cur.count += 1;
    if (p.memory_mb != null) cur.known += p.memory_mb;
    else cur.unknown += 1;
    agg.set(label, cur);
  }
  return [...agg.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ label, count, known, unknown }) => ({
      label,
      count,
      memoryMb: unknown >= count ? null : known,
    }));
}

/**
 * 显存构成切片（REQ-038 饼图数据）：
 * - 各进程按进程名聚合（同模型多实例合并），kind=model 蓝绿系 / other 橙红（高亮「非模型任务」）
 * - memory_mb=null 的进程（WDDM 下 [N/A]）不参与 MB 聚合，仅在清单中展示
 * - 「系统·图形占用」= total − Σ进程（compute-apps 不含浏览器/DWM 等图形显存，此片兜底呈现）
 * - 无任何每进程 MB 明细 → 退化为 已用/空闲 两片
 */
export function buildVramSlices(gpu: GpuStatus): VramSlice[] {
  const agg = new Map<string, { value: number; kind: 'model' | 'other' }>();
  for (const p of gpu.processes ?? []) {
    if (p.memory_mb == null) continue;
    const cur = agg.get(p.name) ?? { value: 0, kind: p.kind === 'other' ? 'other' : 'model' };
    cur.value += p.memory_mb;
    agg.set(p.name, cur);
  }
  const slices: VramSlice[] = [];
  let modelIdx = 0;
  for (const [name, { value, kind }] of agg) {
    const color = kind === 'model'
      ? MODEL_SLICE_COLORS[modelIdx++ % MODEL_SLICE_COLORS.length]
      : OTHER_SLICE_COLOR;
    slices.push({ name, value, color });
  }
  const total = gpu.memory_total_mb;
  if (slices.length === 0 && total && gpu.memory_used_mb) {
    // 无每进程 MB 明细（WDDM）：退化为 已用（蓝，主占用通常为模型）/ 空闲（绿）
    return [
      { name: '已用', value: gpu.memory_used_mb, color: MODEL_SLICE_COLORS[0] },
      { name: '空闲', value: Math.max(total - gpu.memory_used_mb, 0), color: FREE_SLICE_COLOR },
    ];
  }
  const procTotal = slices.reduce((sum, s) => sum + s.value, 0);
  if (total && total - procTotal > 0) {
    slices.push({ name: '系统·图形占用', value: total - procTotal, color: SYSTEM_SLICE_COLOR });
  }
  return slices;
}

/** ECharts 环形饼图配置：tooltip 显示 MB 与占比，底部图例 */
function buildVramOption(gpu: GpuStatus): EChartsCoreOption {
  return {
    tooltip: { trigger: 'item', formatter: '{b}：{c} MB（{d}%）' },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '44%'],
        label: { show: false },
        data: buildVramSlices(gpu).map((s) => ({
          name: s.name,
          value: s.value,
          itemStyle: { color: s.color },
        })),
      },
    ],
  };
}

/** 进程清单区块（2026-08-24 换行契约）：标签行 + 每进程独立一行（「· 短名 ×N MB（占比%）」） */
function ProcList({
  label, procs, tone, procText,
}: {
  label: string;
  procs: ProcAgg[];
  tone: 'secondary' | 'warning';
  procText: (a: ProcAgg) => string;
}) {
  if (procs.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <Text type={tone}>{label}</Text>
      {procs.map((a) => (
        <div key={a.label} style={{ paddingLeft: 12 }}>
          <Text type={tone}>· {procText(a)}</Text>
        </div>
      ))}
    </div>
  );
}

/**
 * 资源总览卡：指标行 + 显存构成饼图 + ≥95% 常驻警告 + 进程清单（逐行）
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
    const usagePercent =
      g.memory_total_mb && g.memory_used_mb != null
        ? Math.round((g.memory_used_mb / g.memory_total_mb) * 100)
        : null;
    /** 清单聚合（2026-08-23 用户裁决）：模型在前、非模型在后；非模型做友好分类 */
    const modelProcs = aggregateProcs((g.processes ?? []).filter((p) => p.kind !== 'other'), false);
    const otherProcs = aggregateProcs((g.processes ?? []).filter((p) => p.kind === 'other'), true);
    /** 占比文案：有每进程 MB 且总量已知 → 「1200 MB（12%）」；WDDM 拿不到 → 「占比未知」 */
    const memText = (mb: number | null): string => {
      if (mb == null) return '占比未知';
      if (!g.memory_total_mb) return `${mb} MB`;
      return `${mb} MB（${Math.round((mb / g.memory_total_mb) * 100)}%）`;
    };
    /** 清单项文案：LM Studio.exe ×2 占比未知 / 浏览器进程 ×2 500 MB（3%） */
    const procText = (a: ProcAgg) => `${a.label}${a.count > 1 ? ` ×${a.count}` : ''} ${memText(a.memoryMb)}`;
    /** ≥95% 警告显示时，非模型任务已在警告横幅列出，下方清单不再重复（只显示一次，2026-08-24） */
    const showWarning = usagePercent !== null && usagePercent >= VRAM_WARNING_PERCENT;
    body = (
      <>
        {showWarning && (
          <Alert
            type="warning" showIcon style={{ marginBottom: 12 }}
            message={`显存占用 ${usagePercent}%（${g.memory_used_mb} / ${g.memory_total_mb} MB），已接近满载`}
            description={otherProcs.length > 0
              ? (
                <>
                  检测到非模型任务占用显存：
                  {otherProcs.map((a) => (
                    <div key={a.label}>{procText(a)}</div>
                  ))}
                </>
              )
              : undefined}
          />
        )}
        <Row gutter={[16, 8]}>
          <Col xs={24} md={13}>
            <Descriptions size="small" column={1} colon={false}>
              <Descriptions.Item label="显卡型号">{g.name || '未知'}</Descriptions.Item>
              <Descriptions.Item label="显存使用">{g.memory_used_mb} / {g.memory_total_mb} MB</Descriptions.Item>
              <Descriptions.Item
                label={(
                  <Space size={4}>
                    利用率
                    <Tooltip title="Windows WDDM 模式下 nvidia-smi 利用率读数波动较大，仅供参考；95% 超显存警告以显存使用率为准（读数准确）">
                      <InfoCircleOutlined style={{ color: '#999' }} />
                    </Tooltip>
                  </Space>
                )}
              >
                {g.utilization_percent}%
              </Descriptions.Item>
              <Descriptions.Item label="系统内存">{g.sys_memory_percent}%（{g.sys_memory_used_mb} / {g.sys_memory_total_mb} MB）</Descriptions.Item>
            </Descriptions>
            {/* 进程清单逐行显示（2026-08-24 用户裁决）：模型进程区在前、非模型任务区在后；
                警告横幅显示期间非模型任务清单隐藏（信息已在横幅中，不重复） */}
            <ProcList label="模型进程" procs={modelProcs} tone="secondary" procText={procText} />
            {!showWarning && <ProcList label="非模型任务" procs={otherProcs} tone="warning" procText={procText} />}
          </Col>
          <Col xs={24} md={11}>
            <EChart option={buildVramOption(g)} height={210} />
          </Col>
        </Row>
      </>
    );
  }
  return (
    <Card size="small" title={<Space><DesktopOutlined />资源总览</Space>} style={{ marginTop: 24 }}>
      {body}
    </Card>
  );
}
