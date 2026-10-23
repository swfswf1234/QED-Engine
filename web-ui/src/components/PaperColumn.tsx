/**
 * 右栏论文卡片列（REQ-108 I6，壳 §8；与教程列同形：横向滚动 + 同宽卡片）
 * - 栏＝该领域全量视图（含落位到课程的论文，卡片带课程归属标签），数据同源 paperBooks 不双写
 * - 卡面只读：标题（两行截断）/年/首位作者/五层态徽标/页数；批量操作不进卡，操作留在详情弹窗
 * - 空态给「发起论文探索」出口（直达探索弹窗段①）
 */
import { Button, Space, Tag, Typography } from 'antd';
import { paperStatusBadge } from '../stores/downloads';
import type { BookRecord } from '../stores';

const { Text } = Typography;

export default function PaperColumn({ books, courseNameById, onBookClick, onExplore }: {
  books: BookRecord[];
  /** course_id → 课程名（落位标签用；取不到的课程只显示 id） */
  courseNameById: Record<string, string>;
  onBookClick: (book: BookRecord) => void;
  onExplore: () => void;
}) {
  return (
    <div className="dl-paper-column" data-testid="paper-column">
      <div className="dl-paper-column-head">
        <Text strong data-testid="paper-column-title">论文（{books.length}）</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>领域全量视图：含落位到本领域课程的论文</Text>
      </div>
      {books.length === 0 ? (
        <div className="dl-paper-column-empty" data-testid="paper-column-empty">
          <Space direction="vertical" size={6}>
            <Text type="secondary">该领域还没有已采纳论文</Text>
            <Button size="small" onClick={onExplore}>发起论文探索</Button>
          </Space>
        </div>
      ) : (
        <div className="dl-books-row">
          {books.map((b) => {
            const courseId = typeof b.course_id === 'string' ? b.course_id : '';
            const courseLabel = courseId ? (courseNameById[courseId] ?? courseId) : '';
            return (
              <div
                key={b.book_id}
                className="dl-book-card dl-paper-card"
                data-testid="paper-card"
                role="button"
                tabIndex={0}
                onClick={() => onBookClick(b)}
              >
                <div className="dl-paper-card-title" title={b.title}>{b.title}</div>
                <Space size={4} wrap>
                  <Tag>{paperStatusBadge(b.status)}</Tag>
                  {courseLabel && <Tag color="blue">{courseLabel}</Tag>}
                </Space>
                <div className="dl-book-meta">{b.year != null ? b.year : '—'}</div>
                <div className="dl-book-meta">{b.authors?.[0]?.name ?? '—'}</div>
                {b.page_count != null && <div className="dl-book-meta">{b.page_count} 页</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
