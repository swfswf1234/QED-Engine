/**
 * 右栏「本章练习」（M2 壳裁决 R-9：错题本不独立成页，随 M6 三栏工作台）。
 * 三段＝到期复习（队列）/ 错题本（读时派生，人工位收藏·已解决）；候选仍在「批注」页签。
 */
import { useState } from 'react';
import { Button, Card, Empty, Space, Tag, Typography } from 'antd';
import type { AttemptResponse, MistakeItem, ReviewDueTask } from '../../api/learn';
import QuestionCard from './QuestionCard';
import { usePracticeStore } from '../../stores/practice';

const { Text } = Typography;

const TREND_LABELS: Record<string, string> = {
  new: '首答', improved: '进步', declined: '退步', unchanged: '持平',
};

/** 自评走记忆口径、判分题走对错口径（徽章文案承载语义，判例 QuestionCard） */
function verdictOf(result: AttemptResponse): string {
  if (result.method === 'self') return result.is_correct ? '自评已记住' : '自评未记住';
  return result.is_correct ? '判对' : '判错';
}

export interface ChapterPracticeProps {
  courseId: string;
  kpId: string | null;
}

export default function ChapterPractice({ courseId, kpId }: ChapterPracticeProps) {
  const dueTasks = usePracticeStore((s) => s.dueTasks);
  const mistakes = usePracticeStore((s) => s.mistakes);
  const stats = usePracticeStore((s) => s.mistakeStats);
  const notice = usePracticeStore((s) => s.notice);
  const lastResult = usePracticeStore((s) => s.lastResult);
  const loadChapter = usePracticeStore((s) => s.loadChapter);
  const submitAttempt = usePracticeStore((s) => s.submitAttempt);
  const setBookmark = usePracticeStore((s) => s.setBookmark);
  const setResolved = usePracticeStore((s) => s.setResolved);
  const [retrying, setRetrying] = useState<string | null>(null);

  const renderDue = (task: ReviewDueTask) => {
    if (!task.question) {
      return (
        <Card key={`${task.target_kind}-${task.target_id}`} size="small" type="inner">
          <Text style={{ fontSize: 12 }}>
            {`知识点复习（${task.kp_type ?? '未标型'}·档 ${task.interval_index}）`}
          </Text>
        </Card>
      );
    }
    return (
      <Card
        key={`${task.target_kind}-${task.target_id}`}
        size="small"
        type="inner"
        title={
          <Space size={6}>
            <Tag style={{ fontSize: 11 }}>{task.reason === 'wrong' ? '错题优先' : '类型档'}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>{`超期 ${task.overdue_days} 天`}</Text>
          </Space>
        }
      >
        <QuestionCard
          question={task.question}
          origin="review"
          reviewDate={task.due_at || null}
          onSubmit={submitAttempt}
        />
      </Card>
    );
  };

  const renderMistake = (item: MistakeItem) => (
    <Card
      key={item.question.question_id}
      size="small"
      type="inner"
      title={
        <Space size={6} wrap>
          <Tag style={{ fontSize: 11 }}>{TREND_LABELS[item.score_trend] ?? item.score_trend}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{`答错 ${item.wrong_count}/${item.attempt_count} 次`}</Text>
          {item.due_today && <Tag style={{ fontSize: 11 }}>今日到期</Tag>}
        </Space>
      }
      extra={
        <Space size={4}>
          <Button
            size="small"
            type={item.bookmarked ? 'primary' : 'default'}
            onClick={() => void setBookmark(item.last_attempt.attempt_id, !item.bookmarked)}
          >
            {item.bookmarked ? '已收藏' : '收藏'}
          </Button>
          <Button
            size="small"
            type={item.resolved ? 'primary' : 'default'}
            onClick={() => void setResolved(item.last_attempt.attempt_id, !item.resolved)}
          >
            {item.resolved ? '已解决' : '标记解决'}
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <Text style={{ fontSize: 12 }}>{`上次作答：${item.last_attempt.user_answer}`}</Text>
        <Button size="small" onClick={() => setRetrying(retrying === item.question.question_id ? null : item.question.question_id)}>
          {retrying === item.question.question_id ? '收起重做' : '重做本题'}
        </Button>
        {retrying === item.question.question_id && (
          <QuestionCard
            question={item.question}
            origin="manual"
            onSubmit={async (input) => {
              const result = await submitAttempt(input);
              setRetrying(null);
              return result;
            }}
          />
        )}
      </Space>
    </Card>
  );

  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Space size={6} wrap>
        <Button size="small" onClick={() => void loadChapter(courseId, kpId)}>刷新</Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {`到期 ${dueTasks.length}／错题 ${stats?.unresolved ?? 0} 未解决（共 ${stats?.wrong ?? 0}）`}
        </Text>
      </Space>
      {lastResult && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {`最近判分：${verdictOf(lastResult)}·趋势 ${lastResult.score_trend}`}
        </Text>
      )}
      {notice && <Text type="warning" style={{ fontSize: 12 }}>{notice}</Text>}

      <div>
        <Text strong style={{ fontSize: 13 }}>{`到期复习（${dueTasks.length}）`}</Text>
        {dueTasks.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本章没有到期项" />
        ) : (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {dueTasks.map(renderDue)}
          </Space>
        )}
      </div>

      <div>
        <Text strong style={{ fontSize: 13 }}>{`错题本（${mistakes.length}）`}</Text>
        {mistakes.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本章还没有错题" />
        ) : (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {mistakes.map(renderMistake)}
          </Space>
        )}
      </div>
    </Space>
  );
}
