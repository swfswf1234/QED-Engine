/**
 * 单块内容编辑弹层（parsing-ui §8/§9 BlockEditor，内容口径）：
 * 只修改内容——类型改判（十枚闭集）+ 判定（一致/不一致）+ 备注 + 文字替换（公式为 LaTeX 源码）。
 * 框几何修改归左栏框编辑口径（§10），弹层不含 bbox 数值输入（用户裁决）。
 * 保存走 /edit 门面（PUT blocks/{i}/edit）。
 */
import { useEffect, useState } from 'react';
import { Button, Input, Select, Space, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, SaveOutlined } from '@ant-design/icons';
import type { Block, BlockEdit } from '../../api/axiom';
import { blockText, TYPE_LABELS } from './blocks';

const { Text } = Typography;

/** 类型下拉的十枚取值＝8902 `BlockType` 闭集（顺序即其声明序；加值须两侧同批改，本面不自行扩充） */
export const BLOCK_TYPE_VALUES = ['heading', 'paragraph', 'formula', 'table', 'image',
  'list', 'caption', 'header', 'footer', 'page_number'] as const;

interface BlockEditorProps {
  block: Block;
  edit?: BlockEdit;
  submitting?: boolean;
  /** 提交（verdict 立即判定；文字/备注/范围/类型走保存按钮）。返回是否成功。 */
  onSubmit: (input: {
    verdict?: 'ok' | 'bad';
    note?: string;
    corrected_text?: string;
    corrected_bbox?: [number, number, number, number];
    corrected_type?: string;
  }) => Promise<boolean>;
}

export default function BlockEditor({ block, edit, submitting, onSubmit }: BlockEditorProps) {
  const [text, setText] = useState(edit?.corrected_text ?? blockText(block));
  const [note, setNote] = useState(edit?.note ?? '');
  const [type, setType] = useState(edit?.corrected_type ?? block.type);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setText(edit?.corrected_text ?? blockText(block));
    setNote(edit?.note ?? '');
    setType(edit?.corrected_type ?? block.type);
    setSavedFlash(false);
    // 切换选中块时重置草稿（block 引用变化即重置）
  }, [block, edit]);

  const save = async () => {
    const changedType = (edit?.corrected_type ?? block.type) !== type;
    const ok = await onSubmit({
      note,
      corrected_text: text,
      ...(changedType ? { corrected_type: type } : {}),
    });
    if (ok) setSavedFlash(true);
  };

  return (
    <Space direction="vertical" size={6} style={{ width: 380 }}>
      <Space size={6} wrap>
        <Select
          size="small"
          style={{ width: 104 }}
          value={type}
          onChange={(v) => setType(v)}
          aria-label="块类型"
          options={BLOCK_TYPE_VALUES.map((value) => ({ value, label: TYPE_LABELS[value] ?? value }))}
        />
        {edit?.corrected_type && edit.block_type && edit.block_type !== type ? (
          <Text type="secondary" style={{ fontSize: 12 }}>原：{TYPE_LABELS[edit.block_type] ?? edit.block_type}</Text>
        ) : null}
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
      <Space size={6}>
        <Button size="small" type="primary" icon={<SaveOutlined />} loading={submitting} onClick={() => void save()}>
          保存修正
        </Button>
        {savedFlash && <Text type="success" style={{ fontSize: 12 }}>已保存</Text>}
      </Space>
    </Space>
  );
}
