/**
 * ECharts 轻量封装（echarts/core 按需引入，减少包体积）
 * - init/setOption/resize/dispose 生命周期管理；窗口 resize 自适应
 * - option 变化时整体替换（notMerge）
 * - onSelect：节点点击回调（graph 等 series 的 data.id 透传，星图选课程用）
 */
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, GraphChart, PieChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent, TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';

echarts.use([BarChart, GraphChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

interface EChartProps {
  option: EChartsCoreOption;
  height?: number;
  /** 显式像素宽度（层级图按内在尺寸铺，避免 100% 宽度下的非均匀套满压缩）；缺省 100% */
  width?: number | string;
  /** 点击数据项（节点/扇区）时回调其 data.id；无 id 不触发 */
  onSelect?: (id: string) => void;
}

export default function EChart({ option, height = 320, width, onSelect }: EChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const optionRef = useRef(option);
  optionRef.current = option;

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chartRef.current = chart;
    chart.on('click', (params: unknown) => {
      const id = (params as { data?: { id?: unknown } })?.data?.id;
      if (typeof id === 'string' && id) selectRef.current?.(id);
    });
    // 尺寸变化后重放 option：graph（layout:'none'）的等比铺满系数在 init 时算定，
    // 只 resize 不重放会停在旧尺度的取景里（星图容器从 0 尺寸长起来时尤为明显）
    const onResize = () => {
      chart.resize();
      chart.setOption(optionRef.current, true);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} style={{ width: width ?? '100%', height }} />;
}
