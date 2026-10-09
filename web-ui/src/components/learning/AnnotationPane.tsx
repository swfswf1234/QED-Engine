/**
 * 批注登记面板（M6 三栏工作台右栏）：选区锚点 → 总结/详解 → 保留＝candidate → 确认提升主表。
 * 本轮不出 LLM 生成（裁决 ⑤，前置＝ARCH-027-M3 行 S4 真机冒烟），叙述一律人工书写。
 */
import { useState } from 'react';
import { Button, Empty, Input, Radio, Select, Space, Typography } from 'antd';
import type { KnowledgePointType } from '../../api/learn';
import { useLearnWorkbenchStore } from '../../stores/learnWorkbench';

const { Text } = Typography;
const { TextArea } = Input;

const TYPE_OPTIONS: Array<{ value: KnowledgePointType; label: string }> = [
  { value: 'concept', label: '概念' },
  { value: 'procedure', label: '程序' },
  { value: 'memory', label: '记忆' },
  { value: 'design', label: '设计' },
];

const INTENT_LABELS: Record<string, string> = { summary: '总结', explanation: '详解' };
const STATUS_LABELS: Record<string, string> = { draft: '草稿', candidate: '待确认', adopted: '已入库', rejected: '已驳回' };

export default function AnnotationPane() {
  const selectedBlock = useLearnWorkbenchStore((s) => s.selectedBlock);
  const selectedKpId = useLearnWorkbenchStore((s) => s.selectedKpId);
  const candidates = useLearnWorkbenchStore((s) => s.candidates);
  const notice = useLearnWorkbenchStore((s) => s.notice);
  const addAnnotation = useLearnWorkbenchStore((s) => s.addAnnotation);
  const confirmCandidate = useLearnWorkbenchStore((s) => s.confirmCandidate);
  const rejectCandidate = useLearnWorkbenchStore((s) => s.rejectCandidate);

  const [name, setName] = useState('');
  const [narrative, setNarrative] = useState('');
  const [intent, setIntent] = useState<'summary' | 'explanation'>('explanation');
  const [type, setType] = useState<KnowledgePointType | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const keep = async () => {
    setSaving(true);
    const ok = await addAnnotation({ name, narrative, intent, type });
    setSaving(false);
    if (ok) {
      setName('');
      setNarrative('');
    }
  };

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Text strong style={{ fontSize: 13 }}>批注</Text>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {selectedBlock
          ? `锚点＝第 ${selectedBlock.page} 页：${selectedBlock.snippet.slice(0, 40)}`
          : '在中栏点选一个内容块作为锚点（不选＝无锚点登记）'}
      </Text>

      <Radio.Group
        size="small"
        value={intent}
        onChange={(e) => setIntent(e.target.value as 'summary' | 'explanation')}
        options={[{ value: 'summary', label: '总结' }, { value: 'explanation', label: '详解' }]}
        optionType="button"
      />
      <Input
        size="small"
        aria-label="知识点名"
        placeholder="知识点名"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Select
        size="small"
        aria-label="四分类"
        placeholder="四分类（可空）"
        allowClear
        style={{ width: '100%' }}
        value={type}
        onChange={(v: KnowledgePointType | undefined) => setType(v)}
        options={TYPE_OPTIONS}
      />
      <TextArea
        rows={6}
        aria-label="批注正文"
        placeholder="写下这一处总结或详解（本轮人工书写，不出 LLM 生成）"
        value={narrative}
        onChange={(e) => setNarrative(e.target.value)}
      />
      <Button
        type="primary"
        size="small"
        loading={saving}
        disabled={!selectedKpId || name.trim() === ''}
        onClick={keep}
      >
        保留为候选
      </Button>
      {!selectedKpId && (
        <Text type="secondary" style={{ fontSize: 12 }}>先在左栏选中章/节，批注才有归属。</Text>
      )}
      {notice && <Text type="warning" style={{ fontSize: 12 }}>{notice}</Text>}

      <Text strong style={{ fontSize: 13 }}>本章候选（{candidates.length}）</Text>
      {candidates.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本章暂无候选" />
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
          {candidates.map((row) => (
            <li key={row.detail_id} style={{ marginBottom: 6 }}>
              <div>
                {row.name}
                <Text type="secondary" style={{ marginLeft: 6 }}>
                  {INTENT_LABELS[row.intent] ?? row.intent}·{STATUS_LABELS[row.gen_status] ?? row.gen_status}
                </Text>
              </div>
              {row.narrative && (
                <Text type="secondary" style={{ fontSize: 12 }}>{row.narrative.slice(0, 60)}</Text>
              )}
              {(row.gen_status === 'draft' || row.gen_status === 'candidate') && (
                <Space size={4}>
                  <Button size="small" onClick={() => void confirmCandidate(row.detail_id)}>确认入库</Button>
                  <Button size="small" onClick={() => void rejectCandidate(row.detail_id)}>驳回</Button>
                </Space>
              )}
            </li>
          ))}
        </ul>
      )}
    </Space>
  );
}
