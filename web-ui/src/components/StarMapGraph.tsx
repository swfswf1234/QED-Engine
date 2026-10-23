/**
 * 知识探索·星图渲染（裁决 ③/⑧：纯函数布局 + ECharts graph，不引新依赖、不用 force）
 * - 轨迹列框＝竖长虚线圆角框（透明填充 + 同轨色描边），名称写在框内顶部名称带；**不响应悬停**
 * - 课程＝不透明圆角框本体（不再画圆点）：连线锚在框中心，框盖在线上，视觉落点即框边；
 *   悬停高亮写在 series 级 emphasis（graph 符号不读逐项 emphasis.itemStyle），列框逐项 disabled 关掉
 * - 连线只连课程框：同轨实线、跨轨虚线、无箭头；弯曲度由布局给定（跨行长边自动绕开中间课程框）
 * - 节点点击只透传课程 id（`nebula:` 前缀的列框节点忽略）
 * - 课程提示行＝课程名称（加粗）＋课程叙述（`course.description`，REQ-110 W4）；
 *   计数段与复习段都不出现（四审裁决 / 裁决 ④）
 */
import { useMemo } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import EChart from './EChart';
import {
  NEBULA_PREFIX,
  NEBULA_TITLE_H,
  NODE_FONT,
  type StarMapLayout,
} from './starMapLayout';

const TRACK_COLORS = ['#7fd1ff', '#c0a3ff', '#8affc9', '#ffd479', '#ff9ec7', '#a8bcff', '#f7f7a0'];
/** 课程框底色：不透明深底，把课名从星空里托出来，同时遮住从框下穿过的连线 */
const BOX_FILL = '#0d1633';
const BOX_FILL_ACTIVE = '#1c2c5c';
const BOX_TEXT = '#eef3ff';
const TITLE_TEXT = '#f4f8ff';
const TITLE_TEXT_BORDER = 'rgba(4, 8, 22, 0.92)';

interface GraphNodeItem {
  id: string;
  name: string;
  x: number;
  y: number;
  symbol: string;
  symbolSize: [number, number];
  itemStyle: Record<string, unknown>;
  label: Record<string, unknown>;
  emphasis?: Record<string, unknown>;
  /** 星图语义：nebula=轨迹列框（不可点、不悬停）/ course=课程（点击就地下钻课程层级视图） */
  kind: 'nebula' | 'course';
  track: string;
  /** 课程＝叙述（`course.description`，可空）；列框＝空串 */
  detail: string;
}

const clampFont = (size: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(size)));

/** 提示框走 HTML 渲染：叙述来自书目文本，转义后再拼 */
const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);

export function buildStarMapOption(
  layout: StarMapLayout,
): EChartsCoreOption {
  const colorOf = (track: string) =>
    TRACK_COLORS[Math.max(0, layout.trackOrder.indexOf(track)) % TRACK_COLORS.length];
  // 字号随套满系数走：框被缩小而字不变会溢出框外
  const boxFont = clampFont(NODE_FONT * layout.scale, 12, 16);
  const titleFont = clampFont(22 * layout.scale, 14, 28);
  const titleBand = NEBULA_TITLE_H * layout.scale;

  const nebulaItems: GraphNodeItem[] = layout.nebulae.map((n) => ({
    id: n.id,
    name: n.name,
    x: n.x,
    y: n.y,
    symbol: 'roundRect',
    symbolSize: [n.w, n.h],
    kind: 'nebula',
    track: n.name,
    detail: '',
    itemStyle: {
      color: 'rgba(255, 255, 255, 0.02)',
      borderColor: colorOf(n.name),
      borderWidth: n.core ? 2 : 1.3,
      borderType: 'dashed',
      opacity: n.core ? 0.9 : 0.62,
    },
    label: {
      show: true,
      position: 'inside',
      // 顶部名称带：由框中心上移到名称带中线
      offset: [0, -(n.h / 2) + titleBand / 2],
      formatter: n.name,
      color: TITLE_TEXT,
      fontSize: titleFont,
      fontWeight: 700,
      textBorderColor: TITLE_TEXT_BORDER,
      textBorderWidth: 5,
    },
    // 学习方向框只是分区提示：悬停不高亮、不出提示（点击也按 id 前缀过滤掉）
    emphasis: { disabled: true },
  }));

  const courseItems: GraphNodeItem[] = layout.nodes.map((n) => {
    // 提示＝课程名称＋课程叙述（四审裁决：计数段删除）；叙述空值时只显课名一行
    return {
      id: n.id,
      name: n.name,
      x: n.x,
      y: n.y,
      symbol: 'roundRect',
      symbolSize: [n.w, n.h],
      kind: 'course',
      track: n.track,
      detail: n.description,
      itemStyle: {
        color: BOX_FILL,
        borderColor: colorOf(n.track),
        borderWidth: 1.4,
        borderRadius: 8,
        shadowBlur: 14,
        shadowColor: colorOf(n.track),
      },
      label: {
        show: true,
        position: 'inside',
        formatter: n.name,
        color: BOX_TEXT,
        fontSize: boxFont,
        fontWeight: 600,
        overflow: 'truncate',
        width: Math.max(20, n.w - 10),
      },
    };
  });

  const links = layout.links.map((l) => ({
    source: l.source,
    target: l.target,
    lineStyle: l.cross
      ? { color: '#8fa6e8', type: 'dashed', width: 1.6, opacity: 0.6, curveness: l.curveness }
      : { color: '#c3d2f5', type: 'solid', width: 1.8, opacity: 0.9, curveness: l.curveness },
  }));

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const data = (params as { data?: GraphNodeItem }).data;
        // 列框不给提示：只有课程才响应鼠标
        if (!data || data.kind !== 'course') return '';
        const title = `<b>${escapeHtml(data.name)}</b>`;
        if (!data.detail) return title;
        // 叙述限宽折行、不截字符数（设计稿 A §8）
        return `${title}<div style="max-width:360px;white-space:pre-wrap">${escapeHtml(data.detail)}</div>`;
      },
    },
    series: [
      {
        type: 'graph',
        layout: 'none',
        roam: true,
        scaleLimit: { min: 0.6, max: 3 },
        // 留白与布局的等比系数配对：series 矩形＝缩放后的成员点包围盒，使 ECharts 套满系数为 1
        left: layout.chartMarginX,
        right: layout.chartMarginX,
        top: layout.chartMarginY,
        bottom: layout.chartMarginY,
        edgeSymbol: ['none', 'none'],
        // 列框先入列 → 画在课程框与连线之下
        data: [...nebulaItems, ...courseItems],
        links,
        // graph 符号的高亮态取自 series 级 emphasis（列框用逐项 disabled 关掉，只有课程响应）
        emphasis: {
          scale: false,
          focus: 'none',
          itemStyle: { color: BOX_FILL_ACTIVE, borderColor: '#ffffff', borderWidth: 2 },
          label: { color: '#ffffff', fontWeight: 700 },
        },
      },
    ],
  };
}

export default function StarMapGraph({ layout, height, onSelectCourse }: {
  layout: StarMapLayout;
  height?: number;
  onSelectCourse: (courseId: string) => void;
}) {
  const option = useMemo(() => buildStarMapOption(layout), [layout]);
  return (
    <EChart
      option={option}
      height={height ?? 620}
      onSelect={(id) => {
        if (!id.startsWith(NEBULA_PREFIX)) onSelectCourse(id);
      }}
    />
  );
}
