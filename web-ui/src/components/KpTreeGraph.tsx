/**
 * 课程知识点·层级星图渲染（REQ-113 W3，设计稿 A §9 七审改判 2026-10-15）
 * - 与领域星图同一套语汇，画在同一暗色星空层上：**大知识点＝虚框容器**（roundRect＋dashed 描边＋
 *   近透明填充＋框内顶部名称带，画法对齐 §7 轨迹列框），**框内条目＝发光圆点＋常驻名称标签**
 * - 归属由虚框几何承载：画布不出现任何边图元（`links: []`）
 * - 几何决策只在 kpTreeLayout.ts，本组件只按布局画图
 * - 悬停两类语义：虚框＝大知识点信息（名称＋摘要）、条目＝小知识点信息（名称＋摘要）；
 *   摘要为空只显名称；来源锚计数／四分类／下辖计数都不进提示（六审硬约束）；点击不跳页
 * - 取景：数据坐标＝像素（两个不可见的角点锚住 ECharts 的 view 套满系数＝1），
 *   两轴套满比若偏离 1 仍由 symbolSize 的 y 分量补偿（KP_CANVAS_PAD 与布局常量同源）
 */
import { useMemo } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import EChart from './EChart';
import { KP_CANVAS_PAD, KP_NAME_BAND_H, type KpTreeLayout } from './kpTreeLayout';

/** 取景锚 id：只为把数据坐标钉成像素，不是知识点 */
const FRAME_MIN_ID = 'kp-frame-min';
const FRAME_MAX_ID = 'kp-frame-max';

const BOX_COLOR = '#7fd1ff';
const ITEM_FILL = '#6f9bff';
const ITEM_RING = 'rgba(200, 220, 255, 0.6)';
const ITEM_GLOW = 'rgba(111, 155, 255, 0.55)';
const LABEL_TEXT = '#dbe6ff';
const TITLE_TEXT = '#f4f8ff';
const TEXT_BORDER = 'rgba(4, 8, 22, 0.9)';

/** 提示框走 HTML 渲染：名称与摘要有书目原文，转义后再拼 */
const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);

interface KpGraphDatum {
  id: string;
  name: string;
  x: number;
  y: number;
  symbol: string;
  symbolSize: [number, number];
  kind: 'frame' | 'box' | 'item';
  summary: string;
  itemStyle: Record<string, unknown>;
  label: Record<string, unknown>;
  emphasis?: Record<string, unknown>;
}

/** 虚框与条目的悬停都只给学习者两行：名称＋摘要（摘要空则只显名称） */
function nodeTooltip(d: KpGraphDatum): string {
  if (d.kind === 'frame') return '';
  const title = `<b>${escapeHtml(d.name)}</b>`;
  if (!d.summary) return title;
  return `${title}<div style="max-width:420px;white-space:pre-wrap">${escapeHtml(d.summary)}</div>`;
}

export interface KpTreeCanvas {
  width: number;
  height: number;
  /**
   * 两轴套满比（ECharts 把节点坐标矩形拉平到画布内框，内框＝画布 − 2×KP_CANVAS_PAD）：
   * 布局按内容区实测宽出图、画布按同一留白外扩，故常态为 1；偏离 1 时圆点与框高都要补偿，
   * 否则发光圆点被拉成椭圆。
   */
  aspect: number;
}

/** 画布尺寸与两轴套满比（内容尺寸外扩留白；几何仍全部取布局原值） */
export function kpTreeCanvas(layout: KpTreeLayout): KpTreeCanvas {
  const width = layout.width + 2 * KP_CANVAS_PAD;
  const height = layout.height + 2 * KP_CANVAS_PAD;
  const scaleX = layout.width > 0 ? (width - 2 * KP_CANVAS_PAD) / layout.width : 1;
  const scaleY = layout.height > 0 ? (height - 2 * KP_CANVAS_PAD) / layout.height : 1;
  return { width, height, aspect: scaleY > 0 ? scaleX / scaleY : 1 };
}

export function buildKpTreeOption(layout: KpTreeLayout, aspect: number = 1): EChartsCoreOption {
  const frames: KpGraphDatum[] = [
    { x: 0, y: 0, id: FRAME_MIN_ID },
    { x: layout.width, y: layout.height, id: FRAME_MAX_ID },
  ].map(({ x, y, id }) => ({
    id,
    name: '',
    x,
    y,
    symbol: 'circle',
    symbolSize: [0, 0],
    kind: 'frame',
    summary: '',
    itemStyle: { color: 'rgba(0, 0, 0, 0)', opacity: 0 },
    label: { show: false },
    emphasis: { disabled: true },
  }));

  const boxes: KpGraphDatum[] = layout.boxes.map((b) => ({
    id: b.id,
    name: b.name,
    x: b.x,
    y: b.y,
    symbol: 'roundRect',
    symbolSize: [b.w, b.h * aspect],
    kind: 'box',
    summary: b.summary,
    itemStyle: {
      // 虚框只作容器：不铺不透明白底，也不铺浅色卡
      color: 'rgba(255, 255, 255, 0.02)',
      borderColor: BOX_COLOR,
      borderWidth: 1.3,
      borderType: 'dashed',
      opacity: 0.72,
      shadowBlur: 12,
      shadowColor: 'rgba(127, 209, 255, 0.35)',
    },
    label: {
      show: true,
      position: 'inside',
      // 顶部名称带：由框中心上移到名称带中线
      offset: [0, -(b.h * aspect) / 2 + (KP_NAME_BAND_H * aspect) / 2],
      formatter: b.name,
      color: TITLE_TEXT,
      fontSize: 15,
      fontWeight: 700,
      textBorderColor: TEXT_BORDER,
      textBorderWidth: 5,
      overflow: 'truncate',
      width: Math.max(40, b.w - 24),
    },
  }));

  const items: KpGraphDatum[] = layout.items.map((n) => ({
    id: n.id,
    name: n.name,
    x: n.x,
    y: n.y,
    symbol: 'circle',
    symbolSize: [n.r * 2, n.r * 2 * aspect],
    kind: 'item',
    summary: n.summary,
    itemStyle: {
      color: ITEM_FILL,
      borderColor: ITEM_RING,
      borderWidth: 1.2,
      shadowBlur: 9,
      shadowColor: ITEM_GLOW,
    },
    label: {
      show: true,
      position: 'right',
      distance: n.r + 6,
      formatter: n.name,
      color: LABEL_TEXT,
      fontSize: 12,
      fontWeight: 400,
      textBorderColor: TEXT_BORDER,
      textBorderWidth: 4,
    },
  }));

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const d = (params as { data?: KpGraphDatum }).data;
        return d ? nodeTooltip(d) : '';
      },
    },
    series: [
      {
        type: 'graph',
        layout: 'none',
        roam: true,
        scaleLimit: { min: 0.5, max: 3 },
        edgeSymbol: ['none', 'none'],
        // 归属由虚框承载：画布不出现边图元
        links: [],
        left: KP_CANVAS_PAD,
        right: KP_CANVAS_PAD,
        top: KP_CANVAS_PAD,
        bottom: KP_CANVAS_PAD,
        // 锚→虚框→条目：条目画在虚框之上
        data: [...frames, ...boxes, ...items],
        emphasis: {
          scale: false,
          focus: 'none',
          itemStyle: { borderColor: '#ffffff', borderWidth: 2, shadowBlur: 26 },
          label: { color: '#ffffff', fontWeight: 700 },
        },
      },
    ],
  };
}

export default function KpTreeGraph({ layout }: { layout: KpTreeLayout }) {
  const canvas = useMemo(() => kpTreeCanvas(layout), [layout]);
  const option = useMemo(() => buildKpTreeOption(layout, canvas.aspect), [layout, canvas.aspect]);
  // 内在高度交给外层纵向滚动（框高与行距不随视口压缩）
  return (
    <div className="kn-tree-scroll">
      <EChart option={option} width={canvas.width} height={canvas.height} />
    </div>
  );
}
