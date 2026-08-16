import { useMemo } from 'react';
import { Empty } from 'antd';
import type { CourseGraph, GraphCourse } from '../stores/knowledge';
import { STAGE_LABELS, STAGE_ORDER } from '../stores/courseMeta';
import { stageIndexOf } from '../stores/knowledge';

/** 泡泡半径 / 层高 / 水平间距 */
export const BUBBLE_R = 46;
export const LAYER_H = 132;
export const BUBBLE_GAP = 28;
export const MARGIN_X = 72;
export const MARGIN_TOP = 56;

export interface BubblePos {
  course: GraphCourse;
  cx: number;
  cy: number;
}

/** 布局纯函数：stage 分层 → 泡泡坐标（课程排序按 COURSE_ORDER，稳定布局） */
export function layoutBubbles(graph: CourseGraph): BubblePos[] {
  const layers = STAGE_ORDER.map(() => [] as GraphCourse[]);
  for (const c of graph.courses) {
    const idx = stageIndexOf(c.stage);
    if (idx >= 0 && idx < layers.length) layers[idx].push(c);
  }
  const layerWidths = layers.map((cs) => cs.length * (BUBBLE_R * 2 + BUBBLE_GAP) - BUBBLE_GAP);
  const maxWidth = Math.max(...layerWidths, 1);
  const positions: BubblePos[] = [];
  layers.forEach((cs, li) => {
    // 每层水平居中
    const startX = (maxWidth - layerWidths[li]) / 2 + MARGIN_X;
    cs.forEach((c, ci) => {
      positions.push({
        course: c,
        cx: startX + ci * (BUBBLE_R * 2 + BUBBLE_GAP) + BUBBLE_R,
        cy: MARGIN_TOP + li * LAYER_H + BUBBLE_R,
      });
    });
  });
  return positions;
}

/** 连线路径（先修 → 后修）：竖向曲线，同层横向弧线 */
function edgePath(from: BubblePos, to: BubblePos): string {
  if (Math.abs(from.cy - to.cy) > 1) {
    const y1 = from.cy + BUBBLE_R;
    const y2 = to.cy - BUBBLE_R;
    const midY = (y1 + y2) / 2;
    return `M ${from.cx} ${y1} C ${from.cx} ${midY}, ${to.cx} ${midY}, ${to.cx} ${y2}`;
  }
  // 同层（研究生基础内部：11→12/13）
  const x1 = from.cx + BUBBLE_R;
  const x2 = to.cx - BUBBLE_R;
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${from.cy} C ${midX} ${from.cy}, ${midX} ${to.cy}, ${x2} ${to.cy}`;
}

function courseShortName(name: string): string {
  // 泡泡内最多 6 字（SVG text 两行）
  return name.length > 6 ? `${name.slice(0, 6)}…` : name;
}

/**
 * 课程依赖泡泡图（SVG）：stage 四层分层 + 先修→后修箭头连线
 * - 泡泡点击 → onSelect(courseId)
 * - hover 泡泡：高亮 + 显示先修课程名提示
 */
export default function CourseGraph({
  graph,
  selectedId,
  onSelect,
}: {
  graph: CourseGraph;
  selectedId?: string | null;
  onSelect: (courseId: string) => void;
}) {
  const positions = useMemo(() => layoutBubbles(graph), [graph]);
  const posById = useMemo(() => new Map(positions.map((p) => [p.course.id, p])), [positions]);

  if (graph.courses.length === 0) {
    return <Empty description="暂无课程目录" style={{ marginTop: 80 }} />;
  }

  const width = Math.max(...positions.map((p) => p.cx + BUBBLE_R + MARGIN_X));
  const height = MARGIN_TOP + STAGE_ORDER.length * LAYER_H - LAYER_H + BUBBLE_R + 48;

  // 层标签行 y（层首泡泡上方）
  const layerLabelY = (stage: typeof STAGE_ORDER[number]) => MARGIN_TOP + stageIndexOf(stage) * LAYER_H - 14;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="课程依赖图"
      style={{ maxWidth: width, display: 'block', margin: '0 auto' }}
    >
      {/* 连线（先绘制，泡泡覆盖其上） */}
      {graph.edges.map((e) => {
        const from = posById.get(e.from);
        const to = posById.get(e.to);
        if (!from || !to) return null;
        return (
          <g key={`${e.from}->${e.to}`}>
            <path d={edgePath(from, to)} fill="none" stroke="#91caff" strokeWidth={2} />
            <path
              d={edgePath(from, to)}
              fill="none" stroke="#1677ff" strokeWidth={2} strokeDasharray="6 4"
              opacity={0}
              markerEnd="url(#arrow)"
              className="course-graph-edge-hover"
            />
          </g>
        );
      })}
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#1677ff" />
        </marker>
      </defs>

      {/* 层标签 */}
      {STAGE_ORDER.map((stage) => (
        <text key={stage} x={MARGIN_X} y={layerLabelY(stage)} fontSize={13} fill="#888">
          {STAGE_LABELS[stage]}
        </text>
      ))}

      {/* 泡泡节点 */}
      {positions.map(({ course, cx, cy }) => {
        const selected = course.id === selectedId;
        return (
          <g
            key={course.id}
            className="course-bubble"
            role="button"
            aria-label={`课程 ${course.name}`}
            onClick={() => onSelect(course.id)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={cx} cy={cy} r={BUBBLE_R}
              fill={selected ? '#d6e4ff' : '#e6f4ff'}
              stroke={selected ? '#1677ff' : '#69b1ff'}
              strokeWidth={selected ? 2.5 : 1.5}
            />
            <text
              x={cx} y={cy - 4} textAnchor="middle" fontSize={13} fill="#000"
              fontWeight={selected ? 600 : 400}
            >
              {courseShortName(course.name).slice(0, 3)}
            </text>
            <text x={cx} y={cy + 16} textAnchor="middle" fontSize={13} fill="#000" fontWeight={selected ? 600 : 400}>
              {courseShortName(course.name).slice(3) || ''}
            </text>
            <title>
              {course.name}（{STAGE_LABELS[course.stage]}）{course.prerequisites.length ? `｜先修：${course.prerequisites.map((p) => posById.get(p)?.course.name ?? p).join('、')}` : '｜无先修要求'}
            </title>
          </g>
        );
      })}
    </svg>
  );
}