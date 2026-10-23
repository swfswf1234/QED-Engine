/**
 * 课后练习独立面（`#/practice`）的「今日面板」：到期复习队列 + 错题本同屏两段
 * （REQ-106 裁决 R3＝现状形态，不独立成页、不加 Tabs；错题人工位随本面板）。
 * 计数口径＝课级全量（R2）＋单请求 `max_tasks=100`（R5）：`今日到期 N` 取服务端截断前的 `total_due`，
 * 超出已列条数时队列尾行交代剩余。
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
}

export default function ChapterPractice({ courseId }: ChapterPracticeProps) {
  const dueTasks = usePracticeStore((s) => s.dueTasks);
  const totalDue = usePracticeStore((s) => s.totalDue);
  const mistakes = usePracticeStore((s) => s.mistakes);
  const stats = usePracticeStore((s) => s.mistakeStats);
  const notice = usePracticeStore((s) => s.notice);
  const lastResult = usePracticeStore((s) => s.lastResult);
  const loadCourse = usePracticeStore((s) => s.loadCourse);
  const submitAttempt = usePracticeStore((s) => s.submitAttempt);
  const setBookmark = usePracticeStore((s) => s.setBookmark);
  const setResolved = usePracticeStore((s) => s.setResolved);
  const [retrying, setRetrying] = useState<string | null>(null);

  const renderDue = (task: ReviewDueTask) => {
    if (!task.question) {
      return (
        <Card key={`${task.target_kind}-${task.target_id}`} size="small" type="inner">
          <Text style={{ fontSize: 12 }}>
            {`这一题的题面暂时取不到（档 ${task.interval_index}）：可在错题本里重做。`}
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
        <Button size="small" onClick={() => void loadCourse(courseId)}>刷新</Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {`今日到期 ${totalDue}／错题 ${stats?.unresolved ?? 0} 未解决（共 ${stats?.wrong ?? 0}）`}
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
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="今天没有到期" />
        ) : (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {dueTasks.map(renderDue)}
            {totalDue > dueTasks.length && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {`另有 ${totalDue - dueTasks.length} 条到期未列，做完本批再看`}
              </Text>
            )}
          </Space>
        )}
      </div>

      <div>
        <Text strong style={{ fontSize: 13 }}>{`错题本（${mistakes.length}）`}</Text>
        {mistakes.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有错题" />
        ) : (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {mistakes.map(renderMistake)}
          </Space>
        )}
      </div>
    </Space>
  );
}
