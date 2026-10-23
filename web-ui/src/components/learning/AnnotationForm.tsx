/**
 * 备注段（§V2.12／C26 的 v1.0 形态）：学习者自由书写的一句理解＝kp 行 `learner_note`（人工位，R6），
 * 记在当前那一条知识点上，进场直读、写一次即持久。
 * 这一条还没有学习记录时服务端不起新行，故备注要先记上位置（正文末尾「已掌握并下一条」）才存得下。
 */
import { useEffect, useState } from 'react';
import { Button, Input, Space, Typography } from 'antd';
import { useLearnWorkbenchStore } from '../../stores/learnWorkbench';

const { Text } = Typography;
const { TextArea } = Input;

/** 与后端 ProgressBody.note 的 max_length 同值 */
export const NOTE_MAX_LENGTH = 2000;

export default function AnnotationForm() {
  const selectedKpId = useLearnWorkbenchStore((s) => s.selectedKpId);
  const selectedPoint = useLearnWorkbenchStore((s) => s.selectedPoint);
  const busy = useLearnWorkbenchStore((s) => s.busy);
  const saveNote = useLearnWorkbenchStore((s) => s.saveNote);

  const saved = selectedPoint?.learner?.learner_note ?? '';
  const [text, setText] = useState(saved);

  useEffect(() => {
    setText(selectedPoint?.learner?.learner_note ?? '');
    // 只在换条时同步，写回后的新备注随 selectedPoint 一起回来
  }, [selectedKpId, selectedPoint?.learner?.learner_note]);

  const save = async () => {
    await saveNote(text);
  };

  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }}>
      <Text strong style={{ fontSize: 13 }}>备注</Text>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {selectedPoint && !selectedPoint.learner
          ? '这一条还没有学习记录：先用正文末尾记上位置，备注就存得下了。'
          : '备注记在当前这一条上，下次进来在这里回看。'}
      </Text>
      <TextArea
        rows={5}
        aria-label="备注正文"
        maxLength={NOTE_MAX_LENGTH}
        placeholder="写下您自己的备注，下次进来在这里回看"
        disabled={!selectedKpId}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button
        type="primary"
        size="small"
        loading={busy}
        disabled={!selectedKpId || !selectedPoint?.learner || text.trim() === saved}
        onClick={() => void save()}
      >
        保存备注
      </Button>
      {!selectedKpId && (
        <Text type="secondary" style={{ fontSize: 12 }}>先在左栏选中一条知识点，备注才有归属。</Text>
      )}
      {saved && (
        <div
          data-testid="note-list"
          style={{
            border: '1px solid #eee', borderRadius: 6, padding: '6px 8px', fontSize: 12, whiteSpace: 'pre-wrap',
          }}
        >
          {saved}
        </div>
      )}
    </Space>
  );
}
