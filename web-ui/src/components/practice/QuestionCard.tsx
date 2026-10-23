/**
 * 题卡（课后练习独立面 `#/practice` 的最小作答单元，本课题／到期项／错题重做共用）：
 * 作答 → `POST /learn/attempts` 同事务判分 → 就地展开判分依据。
 * - 判分依据（expected_answer / explanation）只来自作答响应（缝 2：题面投影不含这两列）
 * - flashcard 面＝翻开背文 + 自评（记得/重来），不进判分路径（裁决 ⑨）
 */
import { useState } from 'react';
import { Alert, Button, Input, Radio, Space, Typography } from 'antd';
import type { AttemptResponse, QuestionRow } from '../../api/learn';
import MarkdownView from '../MarkdownView';
import type { AttemptInput } from '../../stores/practice';

const { Text } = Typography;

export interface QuestionCardProps {
  question: QuestionRow;
  /** 已有判分结果（本会话内作答后回传）；null＝未作答 */
  result?: AttemptResponse | null;
  onSubmit: (input: AttemptInput) => Promise<AttemptResponse | null>;
  origin?: 'new' | 'review' | 'manual';
  reviewDate?: string | null;
}

export default function QuestionCard({
  question, result = null, onSubmit, origin = 'new', reviewDate = null,
}: QuestionCardProps) {
  const [answer, setAnswer] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  /** 本卡最近一次判分结果（父面重取列表时以外部门传入的 result 兜底） */
  const [own, setOwn] = useState<AttemptResponse | null>(null);

  const submit = async (input: AttemptInput) => {
    setBusy(true);
    const response = await onSubmit(input);
    if (response) setOwn(response);
    setBusy(false);
  };

  const shown = own ?? result;

  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }}>
      <Space size={6} wrap>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {question.kind === 'flashcard' ? '闪卡自评' : `判分题·${question.question_type ?? 'short'}`}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>{question.difficulty}</Text>
        {question.kp_type && <Text type="secondary" style={{ fontSize: 12 }}>{question.kp_type}</Text>}
      </Space>

      <MarkdownView markdown={question.stem} />

      {question.options?.length ? (
        <Radio.Group
          size="small"
          value={answer}
          onChange={(e) => setAnswer(String(e.target.value))}
          options={question.options.map((option) => ({
            value: option.label,
            label: `${option.label}．${option.body}`,
          }))}
        />
      ) : question.kind === 'quiz' ? (
        <Input.TextArea
          size="small"
          rows={3}
          aria-label={`作答 ${question.question_id}`}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
      ) : null}

      {question.kind === 'flashcard' ? (
        <Space size={6} wrap>
          {!flipped && (
            <Button size="small" onClick={() => setFlipped(true)}>翻开背文</Button>
          )}
          {flipped && (
            <>
              <MarkdownView markdown={question.answer_back || ''} />
              <Button size="small" loading={busy} onClick={() => void submit({
                question_id: question.question_id, user_answer: '记得', origin, review_date: reviewDate, self_result: 'correct',
              })}>
                记得
              </Button>
              <Button size="small" loading={busy} onClick={() => void submit({
                question_id: question.question_id, user_answer: '重来', origin, review_date: reviewDate, self_result: 'again',
              })}>
                重来
              </Button>
            </>
          )}
        </Space>
      ) : (
        <Space size={6}>
          <Button
            size="small"
            type="primary"
            loading={busy}
            disabled={answer.trim() === ''}
            onClick={() => void submit({
              question_id: question.question_id, user_answer: answer.trim(), origin, review_date: reviewDate,
            })}
          >
            提交作答
          </Button>
        </Space>
      )}

      {shown && (
        <Alert
          type={shown.is_correct ? 'success' : 'error'}
          showIcon
          message={
            question.kind === 'flashcard'
              ? (shown.is_correct ? '已记住' : '未记住')
              : (shown.is_correct ? '判对' : '判错')
          }
          description={
            <Space direction="vertical" size={2}>
              <Text style={{ fontSize: 12 }}>{`判分方式 ${shown.method}·趋势 ${shown.score_trend}`}</Text>
              {shown.judge_note && <Text style={{ fontSize: 12 }}>{shown.judge_note}</Text>}
              {shown.expected_answer && (
                <Text style={{ fontSize: 12 }}>{`评分依据：${shown.expected_answer}`}</Text>
              )}
              {shown.explanation && <MarkdownView markdown={shown.explanation} />}
            </Space>
          }
        />
      )}
    </Space>
  );
}
