/**
 * 正文末尾三枚（§V2.12／C25）：上一条／下一条／已掌握并下一条——推进不再单独成段。
 * 已掌握＝kp 行终态位写 `done` 并自动往前走一条；在同一条上再点＝撤销回未学，位置不动。
 * 整章阅读记不进进度：这一章的知识点整理好后才能逐条走。
 */
import { Alert, Button, Space, Typography } from 'antd';
import { isCovered, useLearnWorkbenchStore } from '../../stores/learnWorkbench';

const { Text } = Typography;

export default function AdvancePane() {
  const selectedPoint = useLearnWorkbenchStore((s) => s.selectedPoint);
  const progress = useLearnWorkbenchStore((s) => s.progress);
  const progressError = useLearnWorkbenchStore((s) => s.progressError);
  const notice = useLearnWorkbenchStore((s) => s.notice);
  const busy = useLearnWorkbenchStore((s) => s.busy);
  const step = useLearnWorkbenchStore((s) => s.step);
  const masterAndNext = useLearnWorkbenchStore((s) => s.masterAndNext);

  const mastered = isCovered(selectedPoint);

  return (
    <div data-testid="advance-bar" style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <Space size={8} wrap>
          <Button size="small" onClick={() => void step(-1)}>上一条</Button>
          <Button size="small" onClick={() => void step(1)}>下一条</Button>
          <Button
            size="small"
            type="primary"
            loading={busy}
            data-testid="advance-master"
            onClick={() => void masterAndNext()}
          >
            {mastered ? '已掌握 · 点一下撤销' : '已掌握并下一条'}
          </Button>
        </Space>
        {progress?.completed && (
          <Alert type="success" showIcon message="已结课" description="本课的知识点都学过了，回书架可以接着学下一门。" />
        )}
        {progressError && (
          <Text type="warning" style={{ fontSize: 12 }}>{progressError}</Text>
        )}
        {notice && (
          <Text type="warning" style={{ fontSize: 12 }} data-testid="advance-notice">{notice}</Text>
        )}
      </Space>
    </div>
  );
}
