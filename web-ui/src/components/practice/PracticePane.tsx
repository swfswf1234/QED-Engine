/**
 * 课后练习独立面（`#/practice`）的题源工作区与本课题卡（M2 裁决 ⑥／REQ-106 课级全量 R2）：
 * 题源选择 → 抽取预览 → 人工确认入库 → 题卡作答。
 * - 题源＝已解析书（`GET /learn/question-books`）＋页范围；可选题解配对书同页范围（R-11）
 * - 抽取＝纯函数 `exerciseParse`，草稿一律人工确认后才 `POST /learn/questions`（入库 `kp_id` 留空＝课级归属）
 * - 作答＝`POST /learn/attempts` 同事务判分，判分依据只在响应里展开（缝 2）
 * - 本课题列表＝课级全量，不传 `kp`、不过滤；题行 `kp_id` 只作归属标签展示
 */
import { useEffect, useState } from 'react';
import { Button, Card, Empty, InputNumber, Select, Space, Tag, Typography } from 'antd';
import ExerciseConfirmPanel from './ExerciseConfirmPanel';
import QuestionCard from './QuestionCard';
import { EXTRACT_MAX_PAGES, usePracticeStore } from '../../stores/practice';

const { Text } = Typography;

export interface PracticePaneProps {
  courseId: string;
}

export default function PracticePane({ courseId }: PracticePaneProps) {
  const sourceBooks = usePracticeStore((s) => s.sourceBooks);
  const sourceBookId = usePracticeStore((s) => s.sourceBookId);
  const answerBookId = usePracticeStore((s) => s.answerBookId);
  const range = usePracticeStore((s) => s.range);
  const extracting = usePracticeStore((s) => s.extracting);
  const drafts = usePracticeStore((s) => s.drafts);
  const unrecognized = usePracticeStore((s) => s.unrecognized);
  const extractNotices = usePracticeStore((s) => s.extractNotices);
  const questions = usePracticeStore((s) => s.questions);
  const notice = usePracticeStore((s) => s.notice);
  const openCourse = usePracticeStore((s) => s.openCourse);
  const loadCourse = usePracticeStore((s) => s.loadCourse);
  const setSourceBook = usePracticeStore((s) => s.setSourceBook);
  const setAnswerBook = usePracticeStore((s) => s.setAnswerBook);
  const setRange = usePracticeStore((s) => s.setRange);
  const extract = usePracticeStore((s) => s.extract);
  const updateDraft = usePracticeStore((s) => s.updateDraft);
  const removeDraft = usePracticeStore((s) => s.removeDraft);
  const confirmImport = usePracticeStore((s) => s.confirmImport);
  const submitAttempt = usePracticeStore((s) => s.submitAttempt);
  const clearNotice = usePracticeStore((s) => s.clearNotice);

  const [importing, setImporting] = useState(false);
  /** 页范围输入位（store.range 只在两值齐备时合法，故显示用本地位） */
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [answerStart, setAnswerStart] = useState<number | null>(null);
  const [answerEnd, setAnswerEnd] = useState<number | null>(null);

  useEffect(() => {
    if (courseId) void openCourse(courseId);
  }, [courseId, openCourse]);

  useEffect(() => {
    if (courseId) void loadCourse(courseId);
  }, [courseId, loadCourse]);

  const bookOptions = sourceBooks.map((book) => ({
    value: book.book_id,
    label: `${book.title || book.book_id}（${book.roles.join('/') || '无角色'}）`,
  }));
  const canExtract = sourceBookId !== null && range !== null;

  const confirm = async () => {
    setImporting(true);
    await confirmImport();
    setImporting(false);
  };

  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Space size={6} wrap>
        <Select
          size="small"
          aria-label="题源书"
          style={{ minWidth: 200 }}
          placeholder={sourceBooks.length === 0 ? '本课暂无已解析的题源书' : '选题源书'}
          value={sourceBookId ?? undefined}
          onChange={(v: string) => setSourceBook(v)}
          options={bookOptions}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>起页</Text>
        <InputNumber
          size="small"
          aria-label="抽取起页"
          min={1}
          value={start}
          onChange={(v) => {
            const next = typeof v === 'number' ? v : null;
            setStart(next);
            setRange(next, end);
          }}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>止页</Text>
        <InputNumber
          size="small"
          aria-label="抽取止页"
          min={1}
          value={end}
          onChange={(v) => {
            const next = typeof v === 'number' ? v : null;
            setEnd(next);
            setRange(start, next);
          }}
        />
        <Button size="small" type="primary" loading={extracting} disabled={!canExtract} onClick={() => void extract()}>
          抽取题目
        </Button>
      </Space>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {`题源＝现成习题（不引模型出题，v1 抽取式）；单次最多 ${EXTRACT_MAX_PAGES} 页；可选题解配对书补齐答案`}
      </Text>
      <Space size={6} wrap>
        <Select
          size="small"
          aria-label="题解配对书"
          style={{ minWidth: 180 }}
          allowClear
          placeholder="题解配对书（可空）"
          value={answerBookId ?? undefined}
          onChange={(v?: string) => {
            setAnswerStart(null);
            setAnswerEnd(null);
            setAnswerBook(v ?? null, null, null);
          }}
          options={bookOptions.filter((option) => option.value !== sourceBookId)}
        />
        {answerBookId && (
          <>
            <Text type="secondary" style={{ fontSize: 12 }}>题解起页</Text>
            <InputNumber
              size="small"
              aria-label="题解起页"
              min={1}
              value={answerStart}
              onChange={(v) => {
                const next = typeof v === 'number' ? v : null;
                setAnswerStart(next);
                setAnswerBook(answerBookId, next, answerEnd);
              }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>题解止页</Text>
            <InputNumber
              size="small"
              aria-label="题解止页"
              min={1}
              value={answerEnd}
              onChange={(v) => {
                const next = typeof v === 'number' ? v : null;
                setAnswerEnd(next);
                setAnswerBook(answerBookId, answerStart, next);
              }}
            />
          </>
        )}
      </Space>

      {notice && <Text type="warning" style={{ fontSize: 12 }}>{notice}</Text>}

      {drafts.length > 0 && (
        <Card size="small" title="抽取预览（人工确认后入库）">
          <ExerciseConfirmPanel
            drafts={drafts}
            unrecognized={unrecognized}
            notices={extractNotices}
            busy={importing}
            onUpdate={updateDraft}
            onRemove={removeDraft}
            onConfirm={() => {
              clearNotice();
              void confirm();
            }}
          />
        </Card>
      )}

      <Card size="small" title={`本课题（${questions.length}）`}>
        {questions.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有题，先从题源书抽取并确认入库" />
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {questions.map((question) => (
              <Card
                key={question.question_id}
                size="small"
                type="inner"
                title={question.kp_id ? <Tag>归属 {question.kp_id}</Tag> : null}
              >
                <QuestionCard question={question} onSubmit={submitAttempt} />
              </Card>
            ))}
          </Space>
        )}
      </Card>
    </Space>
  );
}
