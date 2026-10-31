/**
 * 条级批注段（§6 段③）：知识点总结＝该 point 行的 `summary` 直读。
 * 只在**选中知识点**时出现，选中整章或该条没有总结即整段不渲染（零占位句、零生成入口）。
 * 原「详解」（主表 `angles` 的多角度数组）与「长文正文」读腿、「提问」输入位随 REQ-144 W5 退出本面：
 * `angles` 的展示归梳理屏，聊天／问答本批完全不做。
 */
import { Space, Typography } from 'antd';
import { renderInlineMath } from '../parsing/blocks';
import { useLearnWorkbenchStore } from '../../stores/learnWorkbench';

const { Text } = Typography;

export default function AnnotationPane() {
  const selected = useLearnWorkbenchStore((s) => s.selected);
  const selectedPoint = useLearnWorkbenchStore((s) => s.selectedPoint);

  if (selected?.kind !== 'point' || !selectedPoint?.summary) return null;

  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }} data-testid="point-note-pane">
      <Text strong style={{ fontSize: 13 }}>知识点总结</Text>
      <div
        data-testid="point-summary"
        style={{ fontSize: 12, lineHeight: 1.7 }}
        dangerouslySetInnerHTML={{ __html: renderInlineMath(selectedPoint.summary) }}
      />
    </Space>
  );
}
