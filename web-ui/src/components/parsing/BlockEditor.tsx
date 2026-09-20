/**
 * 单块编辑弹层内容（parsing-ui §8 BlockEditor）：
 * 判定（一致/不一致）+ 备注 + 文字修正（公式为 LaTeX 源码）+ bbox 数值修正。
 * 保存走 /edit 门面（PUT blocks/{i}/edit）。
 */
import { useEffect, useState } from 'react';
import { Button, Input, Space, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, SaveOutlined } from '@ant-design/icons';
import type { Block, BlockEdit } from '../../api/axiom';
import { blockText, TYPE_LABELS } from './blocks';

const { Text } = Typography;

interface BlockEditorProps {
  block: Block;
  edit?: BlockEdit;
  submitting?: boolean;
  /** 提交（verdict 立即判定；文字/备注/范围走保存按钮）。返回是否成功。 */
  onSubmit: (input: { verdict?: 'ok' | 'bad'; note?: string; corrected_text?: string; corrected_bbox?: [number, number, number, number] }) => Promise<boolean>;
}

export default function BlockEditor({ block, edit, submitting, onSubmit }: BlockEditorProps) {
  const [text, setText] = useState(edit?.corrected_text ?? blockText(block));
  const [note, setNote] = useState(edit?.note ?? '');
  const [bboxText, setBboxText] = useState((edit?.corrected_bbox ?? block.bbox ?? []).join(','));
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setText(edit?.corrected_text ?? blockText(block));
    setNote(edit?.note ?? '');
    setBboxText((edit?.corrected_bbox ?? block.bbox ?? []).join(','));
    setSavedFlash(false);
    // 切换选中块时重置草稿（block 引用变化即重置）
  }, [block, edit]);

  const parseBbox = (): [number, number, number, number] | null => {
    const parts = bboxText.split(',').map((p) => Number(p.trim()));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
    return parts as [number, number, number, number];
  };

  const save = async () => {
    const bbox = parseBbox();
    const input: Parameters<typeof onSubmit>[0] = { note, corrected_text: text };
    if (bbox) input.corrected_bbox = bbox;
    const ok = await onSubmit(input);
    if (ok) setSavedFlash(true);
  };

  const bboxInvalid = bboxText.trim() !== '' && parseBbox() === null;

  return (
    <Space direction="vertical" size={6} style={{ width: 380 }}>
      <Space size={6} wrap>
        <Text type="secondary" style={{ fontSize: 12 }}>#{TYPE_LABELS[block.type] ?? block.type}</Text>
        <Button size="small" type="primary" icon={<CheckOutlined />} loading={submitting} onClick={() => void onSubmit({ verdict: 'ok', note }).then((ok) => ok && setSavedFlash(true))}>
          一致
        </Button>
        <Button size="small" danger icon={<CloseOutlined />} loading={submitting} onClick={() => void onSubmit({ verdict: 'bad', note }).then((ok) => ok && setSavedFlash(true))}>
          不一致
        </Button>
        {edit?.verdict && (
          <Text type="secondary" style={{ fontSize: 12 }}>已判定：{edit.verdict === 'ok' ? '一致' : '不一致'}</Text>
        )}
      </Space>
      <Input.TextArea
        size="small"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={block.type === 'formula' ? 'LaTeX 源码修正' : '文字修正'}
        aria-label="块文字修正"
      />
      <Input size="small" placeholder="备注" value={note} onChange={(e) => setNote(e.target.value)} aria-label="块备注" />
      <Input
        size="small"
        value={bboxText}
        onChange={(e) => setBboxText(e.target.value)}
        placeholder="bbox：x0,y0,x1,y1（原页图像素坐标）"
        aria-label="块 bbox 修正"
        status={bboxInvalid ? 'error' : undefined}
      />
      <Space size={6}>
        <Button size="small" type="primary" icon={<SaveOutlined />} loading={submitting} disabled={bboxInvalid} onClick={() => void save()}>
          保存修正
        </Button>
        {savedFlash && <Text type="success" style={{ fontSize: 12 }}>已保存</Text>}
      </Space>
    </Space>
  );
}
