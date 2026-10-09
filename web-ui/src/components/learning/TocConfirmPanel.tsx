/**
 * 目录确认面板（M6 裁决 ②：目录页文本纯函数解析 + 人工确认，不引 LLM）。
 * 规格正本：docs/design/learning-workbench-ui.md §6（过程与裁决记录＝已归档壳 docs/history/plans/2026-10/2026-10-01-toc-knowledge-tree-and-learn-workbench.md）。
 * 目录行可改可删、偏移自动试算可人工覆盖、未识别行可见；确认＝整树 PUT outline（页范围＝PDF 页序）。
 */
import { useMemo, useState } from 'react';
import { Button, Input, InputNumber, Space, Typography } from 'antd';
import { describeError } from '../../api/client';
import { putOutline, type OutlineRow } from '../../api/learn';
import {
  estimateTocOffset, parseTocLines, toOutlinePayload,
  type BodyPageText, type TocUnrecognizedReason,
} from '../../tocParse';

const { TextArea } = Input;
const { Text } = Typography;

const REASON_LABELS: Record<TocUnrecognizedReason, string> = {
  excluded: '设计内剔除',
  'no-page': '缺页码',
  'no-parent': '缺所属章题',
};

export interface TocConfirmPanelProps {
  courseId: string;
  bookRef: string;
  /** 目录页文本行（解析产物 paragraph 块原文，按块序拼接） */
  initialLines: readonly string[];
  pageCount: number;
  /** 首章正文首次出现的页文本，用于自动试算偏移 */
  bodyPages?: readonly BodyPageText[];
  onSaved?: (outline: OutlineRow[]) => void;
  onCancel?: () => void;
}

export default function TocConfirmPanel({
  courseId, bookRef, initialLines, pageCount, bodyPages, onSaved, onCancel,
}: TocConfirmPanelProps) {
  const [lines, setLines] = useState<string[]>(() => [...initialLines]);
  const [offsetOverride, setOffsetOverride] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parseTocLines(lines), [lines]);
  const estimated = useMemo(() => estimateTocOffset(parsed.tree, bodyPages ?? []), [parsed.tree, bodyPages]);
  const offset = offsetOverride ?? estimated ?? 0;
  const payload = useMemo(
    () => toOutlinePayload(parsed.tree, offset, pageCount),
    [parsed.tree, offset, pageCount],
  );

  const submit = async () => {
    setSaving(true);
    try {
      const result = await putOutline(courseId, { book_ref: bookRef, tree: payload });
      setNotice(`目录已写入：${payload.length} 章`);
      onSaved?.(result.outline);
    } catch (err) {
      setNotice(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Space size={6} wrap>
        <Text type="secondary" style={{ fontSize: 12 }}>页码偏移</Text>
        <InputNumber
          size="small"
          aria-label="页码偏移"
          value={offset}
          onChange={(v) => setOffsetOverride(typeof v === 'number' ? v : null)}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {estimated === null
            ? '自动试算未命中，请人工填（印刷页 → PDF 页）'
            : `自动试算 ${estimated}，可覆盖`}
        </Text>
      </Space>

      <TextArea
        rows={8}
        aria-label="目录行"
        value={lines.join('\n')}
        onChange={(e) => setLines(e.target.value.split('\n'))}
      />

      <div>
        <Text strong style={{ fontSize: 12 }}>未识别 {parsed.unrecognized.length} 行</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>（在上框补页码 / 补章题，或删除该行）</Text>
        <ul style={{ margin: '2px 0 0', paddingLeft: 18, fontSize: 12 }}>
          {parsed.unrecognized.map((item) => (
            <li key={`${item.reason}-${item.raw}`}>
              {item.raw}
              <Text type="secondary" style={{ marginLeft: 6 }}>{REASON_LABELS[item.reason]}</Text>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <Text strong style={{ fontSize: 12 }}>章/节预览</Text>
        <ul style={{ margin: '2px 0 0', paddingLeft: 18, fontSize: 12 }}>
          {payload.map((chapter) => (
            <li key={`${chapter.name}-${chapter.page_start}`}>
              {chapter.name}
              <Text type="secondary" style={{ marginLeft: 6 }}>
                {chapter.page_start}–{chapter.page_end}
              </Text>
              {chapter.children.length > 0 && (
                <ul style={{ paddingLeft: 16 }}>
                  {chapter.children.map((section) => (
                    <li key={`${section.name}-${section.page_start}`}>
                      {section.name}
                      <Text type="secondary" style={{ marginLeft: 6 }}>
                        {section.page_start}–{section.page_end}
                      </Text>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      <Space size={6}>
        <Button
          type="primary"
          size="small"
          loading={saving}
          disabled={payload.length === 0}
          onClick={submit}
        >
          确认写入
        </Button>
        {onCancel && <Button size="small" onClick={onCancel}>取消</Button>}
      </Space>
      {notice && <Text type="secondary" style={{ fontSize: 12 }}>{notice}</Text>}
    </Space>
  );
}
