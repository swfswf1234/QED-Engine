/**
 * 详解段（§V2.12／C25·C27·C28 的 v1.0 形态）：本条的多角度叙述＝主表 `angles` 数组
 * （数组序即权威排序，前端不重排、不点赞——保留位随候选池退出），长文按 `narrative_ref` 走读文件腿，
 * 指针缺失或悬空都明说（available=false + reason），不静默显示空白。
 * 段末给一个提问输入框占位——本批只展示，不联通。
 */
import { useState } from 'react';
import { Button, Input, Space, Typography } from 'antd';
import { getPointNarrative, type AngleKind, type KpAngle, type NarrativeResponse, type PointUnit } from '../../api/learn';
import { describeError } from '../../api/client';
import { renderInlineMath } from '../parsing/blocks';
import { anglesOf, useLearnWorkbenchStore } from '../../stores/learnWorkbench';

const { Text } = Typography;

const ANGLE_LABELS: Record<AngleKind, string> = {
  summary: '总结',
  explanation: '注解',
  definition: '定义',
  theorem: '定理',
  proof: '证明',
  example: '例子',
};

const angleLabel = (angle: KpAngle['angle']): string => ANGLE_LABELS[angle as AngleKind] ?? String(angle);

function AngleCard({ row }: { row: KpAngle }) {
  return (
    <div
      data-testid={`annotation-${row.angle}`}
      style={{
        border: '1px solid #eee', borderRadius: 6, padding: '6px 8px', marginBottom: 6, fontSize: 12,
      }}
    >
      <Text strong style={{ fontSize: 12 }}>{angleLabel(row.angle)}</Text>
      <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: renderInlineMath(String(row.note ?? '')) }} />
    </div>
  );
}

export function NarrativePane({ point }: { point: PointUnit | null }) {
  const [narrative, setNarrative] = useState<NarrativeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    if (!point) return;
    setLoading(true);
    setError(null);
    try {
      setNarrative(await getPointNarrative(point.kp_id));
    } catch (err) {
      setNarrative(null);
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!point?.narrative_ref) {
    return (
      <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
        这一条还没有长文正文。
      </Text>
    );
  }
  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }} data-testid="narrative-block">
      <Button size="small" loading={loading} onClick={() => void open()}>
        {narrative ? '重新读取正文' : '读这一条的正文'}
      </Button>
      {error && <Text type="warning" style={{ display: 'block', fontSize: 12 }}>{error}</Text>}
      {narrative && !narrative.available && (
        <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{narrative.reason}</Text>
      )}
      {narrative?.available && (
        <>
          <div
            data-testid="narrative-content"
            style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
            dangerouslySetInnerHTML={{ __html: renderInlineMath(narrative.content) }}
          />
          {narrative.truncated && (
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              {`正文较长，这里只取了前 ${Math.round((narrative.bytes ?? 0) / 1024)} KB 之内的内容。`}
            </Text>
          )}
        </>
      )}
    </Space>
  );
}

export default function AnnotationPane() {
  const selectedPoint = useLearnWorkbenchStore((s) => s.selectedPoint);
  const selectedKpId = useLearnWorkbenchStore((s) => s.selectedKpId);
  const generating = useLearnWorkbenchStore((s) => s.generating);
  const generateError = useLearnWorkbenchStore((s) => s.generateError);
  const errorTarget = useLearnWorkbenchStore((s) => s.generateTarget);
  const generatePoint = useLearnWorkbenchStore((s) => s.generatePoint);

  const angles = anglesOf(selectedPoint);

  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }}>
      <Text strong style={{ fontSize: 13 }}>详解</Text>
      {angles.length === 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          这一条还没有注解：点「生成本条注解」先来一条。
        </Text>
      )}
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Button
          size="small"
          loading={generating}
          disabled={!selectedKpId || selectedPoint === null}
          onClick={() => void generatePoint()}
        >
          生成本条注解
        </Button>
        {errorTarget === 'point' && generateError && (
          <Text type="warning" style={{ fontSize: 12 }}>{generateError}</Text>
        )}
        {!selectedKpId && (
          <Text type="secondary" style={{ fontSize: 12 }}>先在左栏选中一条知识点，注解才有归属。</Text>
        )}
      </Space>
      <div data-testid="detail-list">
        {angles.map((row) => <AngleCard key={row.angle} row={row} />)}
      </div>
      <Text strong style={{ fontSize: 12 }}>长文正文</Text>
      <NarrativePane point={selectedPoint} />
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Input.TextArea
          rows={2}
          aria-label="提问"
          placeholder="关于这一条，想问什么"
        />
        <Space size={6} align="center" wrap>
          <Button size="small" disabled>发送</Button>
          <Text type="secondary" style={{ fontSize: 12 }}>提问功能暂未开放</Text>
        </Space>
      </Space>
    </Space>
  );
}
