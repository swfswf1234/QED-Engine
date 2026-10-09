/**
 * 抽取确认面板（M2 裁决 ⑥：抽取结果必须人工确认才入库，判例 TocConfirmPanel）。
 * 草稿可改可删、未识别行可见；不合格草稿（draftIssues 非空）不进提交批次。
 * 规格正本：docs/history/plans/2026-10/2026-09-23-practice-review.md「抽取式题源管线规格」。
 */
import { Button, Card, Input, Select, Space, Tag, Typography } from 'antd';
import {
  draftIssues,
  type AnswerSource,
  type QuestionDraft,
  type QuestionKind,
  type QuestionType,
  type UnrecognizedLine,
} from '../../exerciseParse';

const { TextArea } = Input;
const { Text, Title } = Typography;

const ANSWER_SOURCE_LABELS: Record<AnswerSource, string> = {
  same_page: '同页答案',
  solution_section: '书内答案区',
  sibling_book: '题解配对书',
  manual: '人工录入',
  llm: '模型生成',
  none: '无答案',
};

const KIND_LABELS: Record<QuestionKind, string> = { quiz: '判分题', flashcard: '闪卡自评' };const TYPE_LABELS: Record<QuestionType, string> = { choice: '选择', short: '简答', open: '论述' };

const ANSWER_SOURCE_OPTIONS = (Object.keys(ANSWER_SOURCE_LABELS) as AnswerSource[])
  .filter((value) => value !== 'llm')
  .map((value) => ({ value, label: ANSWER_SOURCE_LABELS[value] }));

const ISSUE_LABELS: Record<string, string> = {
  stem: '题面为空',
  expected_answer: '判分题缺评分依据',
  answer_back: '闪卡缺背文',
  answer_source: '答案来源为「无」',
  keywords: '论述题缺关键词',
  options: '选项不完整（可去掉选项改简答/闪卡）',
};

const REASON_LABELS: Record<UnrecognizedLine['reason'], string> = {
  excluded: '设计内剔除',
  'no-anchor': '缺题号锚',
  'answer-orphan': '答案孤儿',
};

export interface ExerciseConfirmPanelProps {
  drafts: readonly QuestionDraft[];
  unrecognized: readonly UnrecognizedLine[];
  notices: readonly string[];
  /** 已入库题数（同题面重复会被服务端跳重，仅提示） */
  onUpdate: (index: number, patch: Partial<QuestionDraft>) => void;
  onRemove: (index: number) => void;
  onConfirm: () => void;
  busy?: boolean;
}

export default function ExerciseConfirmPanel({
  drafts, unrecognized, notices, onUpdate, onRemove, onConfirm, busy = false,
}: ExerciseConfirmPanelProps) {
  const validCount = drafts.filter((draft) => draftIssues(draft).length === 0).length;

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Space size={6} wrap>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {`草稿 ${drafts.length} 题，可入库 ${validCount} 题（不合格的不提交）`}
        </Text>
        <Button size="small" type="primary" loading={busy} disabled={validCount === 0} onClick={onConfirm}>
          确认入库
        </Button>
      </Space>

      {notices.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
          {notices.map((notice) => (
            <li key={notice}>
              <Text type="warning" style={{ fontSize: 12 }}>{notice}</Text>
            </li>
          ))}
        </ul>
      )}

      {drafts.map((draft, index) => {
        const issues = draftIssues(draft);
        return (
          <Card
            key={`${draft.number}-${draft.page}-${index}`}
            size="small"
            title={
              <Space size={6}>
                <Text style={{ fontSize: 12 }}>题 {draft.number}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>第 {draft.page} 页</Text>
                <Tag style={{ fontSize: 11 }}>{KIND_LABELS[draft.kind]}</Tag>
                <Tag style={{ fontSize: 11 }}>{TYPE_LABELS[draft.question_type]}</Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {ANSWER_SOURCE_LABELS[draft.answer_source]}·置信 {Math.round(draft.confidence * 100)}%
                </Text>
              </Space>
            }
            extra={
              <Button size="small" aria-label={`删除题 ${draft.number}`} onClick={() => onRemove(index)}>
                删除
              </Button>
            }
          >
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <TextArea
                size="small"
                rows={2}
                aria-label={`题 ${draft.number} 题面`}
                value={draft.stem}
                onChange={(e) => onUpdate(index, { stem: e.target.value })}
              />
              {draft.options !== null && (
                <Space size={6} wrap>
                  {draft.options.map((option) => (
                    <Text key={option.label} type="secondary" style={{ fontSize: 12 }}>
                      {option.label}．{option.body}
                    </Text>
                  ))}
                  <Button
                    size="small"
                    onClick={() => onUpdate(index, { options: null, question_type: 'short' })}
                  >
                    去掉选项
                  </Button>
                </Space>
              )}
              <Space size={6} wrap>
                <Select
                  size="small"
                  aria-label={`题 ${draft.number} 型`}
                  style={{ width: 110 }}
                  value={draft.kind}
                  onChange={(value: QuestionKind) => onUpdate(index, { kind: value })}
                  options={[{ value: 'quiz', label: KIND_LABELS.quiz }, { value: 'flashcard', label: KIND_LABELS.flashcard }]}
                />
                <Select
                  size="small"
                  aria-label={`题 ${draft.number} 答型`}
                  style={{ width: 90 }}
                  value={draft.question_type}
                  onChange={(value: QuestionType) => onUpdate(index, { question_type: value })}
                  options={(Object.keys(TYPE_LABELS) as QuestionType[]).map((value) => ({ value, label: TYPE_LABELS[value] }))}
                />
                <Select
                  size="small"
                  aria-label={`题 ${draft.number} 答案来源`}
                  style={{ width: 120 }}
                  value={draft.answer_source}
                  onChange={(value: AnswerSource) => onUpdate(index, { answer_source: value })}
                  options={ANSWER_SOURCE_OPTIONS}
                />
              </Space>
              <Input
                size="small"
                aria-label={`题 ${draft.number} 评分依据`}
                placeholder="评分依据（expected_answer / 关键词，逗号分隔）"
                value={draft.expected_answer ?? ''}
                onChange={(e) => onUpdate(index, {
                  expected_answer: e.target.value,
                  keywords: e.target.value.split(/[,，;；]/).map((token) => token.trim()).filter((token) => token !== ''),
                })}
              />
              <Input
                size="small"
                aria-label={`题 ${draft.number} 背文`}
                placeholder="闪卡背文（自评面）"
                value={draft.answer_back ?? ''}
                onChange={(e) => onUpdate(index, { answer_back: e.target.value })}
              />
              {issues.length > 0 && (
                <Text type="danger" style={{ fontSize: 12 }}>
                  {issues.map((issue) => ISSUE_LABELS[issue] ?? issue).join('；')}
                </Text>
              )}
            </Space>
          </Card>
        );
      })}

      {unrecognized.length > 0 && (
        <div>
          <Title level={5} style={{ fontSize: 12, margin: 0 }}>{`未识别 ${unrecognized.length} 行`}</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>（已丢弃，可在上方面板补录为手动题）</Text>
          <ul style={{ margin: '2px 0 0', paddingLeft: 18, fontSize: 12 }}>
            {unrecognized.map((line) => (
              <li key={`${line.reason}-${line.page}-${line.index}-${line.raw}`}>
                {line.raw}
                <Text type="secondary" style={{ marginLeft: 6 }}>
                  {`第 ${line.page} 页·${REASON_LABELS[line.reason]}`}
                </Text>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Space>
  );
}
