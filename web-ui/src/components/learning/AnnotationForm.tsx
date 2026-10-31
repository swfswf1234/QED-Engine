/**
 * 记录段（§6 段④）：学习者自由书写、跨会话回看，落点＝kp 行 `learner_note` 单列（人工位，机器永不写）。
 * 四段中唯一可写的一段；该条尚无 kp 行时**禁用保存且零请求**（服务端不起新行，§10 也不给下一步话术，
 * 操作方法只在使用手册写）。
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
    // 只在换条时同步，写回后的新记录随 selectedPoint 一起回来
  }, [selectedKpId, selectedPoint?.learner?.learner_note]);

  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }} data-testid="record-pane">
      <Text strong style={{ fontSize: 13 }}>记录</Text>
      <TextArea
        rows={5}
        aria-label="记录正文"
        maxLength={NOTE_MAX_LENGTH}
        disabled={!selectedKpId}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button
        type="primary"
        size="small"
        loading={busy}
        disabled={!selectedKpId || !selectedPoint?.learner || text.trim() === saved}
        onClick={() => void saveNote(text)}
      >
        保存记录
      </Button>
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
