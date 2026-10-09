/**
 * 论文展示行（REQ-102 W3 静态清单 + W4 状态徽标与入口，downloads-ui.md §4.4）
 * - 发现论文（kind=paper，refs=domain/course）清单：领域级挂 DomainCard 底部、课程级挂课程头
 * - 空清单且无活动态徽标时整行隐藏；数据源 GET /papers/books 未实装时静默空态
 * - 条目=标题 + 出版年 + 五档状态徽标（paperStatusBadge），点击回调打开 BookDetailModal
 * - 行尾徽标（§7.2 派生：探索中/待评审/失败）由领域级挂载点传入，点击直达探索弹窗
 */
import { Button, Tag } from 'antd';
import { bookInStage, paperStatusBadge } from '../stores/downloads';
import { paperBadgeIsActionable } from '../stores/paperExplore';
import type { PaperRowBadge } from '../stores/paperExplore';
import type { BookRecord } from '../stores';

interface PaperBooksRowProps {
  books: BookRecord[];
  /** §4.2 状态筛选（书籍阶段，空=全部） */
  stage: string;
  onBookClick: (book: BookRecord) => void;
  /** §7.2 领域级展示态徽标（课程级不传：课程论文只来自 pick 落位） */
  status?: PaperRowBadge;
  /** 「论文探索」入口（仅领域级挂载点提供） */
  onExplore?: () => void;
}

export default function PaperBooksRow({ books, stage, onBookClick, status, onExplore }: PaperBooksRowProps) {
  const visible = books.filter((b) => bookInStage(b, stage));
  // 徽标为活动态（探索中/待评审/失败）时无书行也要出行，供用户看到进展
  if (visible.length === 0 && (!status || status.key === 'hidden' || status.key === 'sedimented')) return null;
  const badge = status && status.key !== 'hidden' && status.key !== 'sedimented' ? status : null;
  return (
    <div className="dl-paper-row" data-testid="paper-books-row">
      <span className="dl-paper-row-title">{visible.length > 0 ? `论文（${visible.length}）` : badge?.text ?? '论文（0）'}</span>
      {visible.length > 0 && badge && (
        <Button
          type="link"
          size="small"
          className="dl-paper-row-badge"
          data-testid="paper-row-badge"
          disabled={!paperBadgeIsActionable(badge.key)}
          onClick={onExplore}
        >
          {badge.text}
        </Button>
      )}
      {onExplore && (
        <Button type="link" size="small" className="dl-paper-row-explore" onClick={onExplore}>
          论文探索
        </Button>
      )}
      <div className="dl-paper-row-items">
        {visible.map((b) => (
          <span
            key={b.book_id}
            className="dl-paper-item"
            onClick={() => onBookClick(b)}
          >
            <span className="dl-paper-item-title">{b.title}</span>
            {typeof b.year === 'number' && <span className="dl-paper-item-year">{b.year}</span>}
            <Tag>{paperStatusBadge(b.status)}</Tag>
          </span>
        ))}
      </div>
    </div>
  );
}
