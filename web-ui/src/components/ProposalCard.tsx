/**
 * 推荐套卡片（exploration-ui §2 推荐卡）
 * - 教材 + 习题集 + 版本徽标 + 简介摘要 + 推荐理由
 * - 仅勾选取舍、无内联编辑（2026-08-23 用户裁决）；超余量禁用复选框
 */
import { Checkbox, Tag, Typography } from 'antd';
import type { ExploreProposal } from '../stores';

const { Text } = Typography;

/** 版本徽标文案（tutorials@v1 的 version 可能为对象或纯字符串，均容错） */
function versionBadge(
  version: { edition?: string; publisher?: string; year?: number | null } | string | null | undefined,
): string {
  if (!version) return '';
  if (typeof version === 'string') return version;
  return [version.edition, version.publisher, version.year].filter(Boolean).join(' · ');
}

export default function ProposalCard({ proposal, checked, disabled, onToggle }: {
  proposal: ExploreProposal;
  checked: boolean;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const v = proposal.textbook.version ?? null;
  return (
    <div className={`explore-proposal-card${checked ? ' selected' : ''}${disabled && !checked ? ' disabled' : ''}`}>
      <div className="explore-proposal-head">
        <Checkbox
          checked={checked}
          disabled={disabled}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`勾选 ${proposal.set_name}`}
        />
        <span className="explore-proposal-name">{proposal.set_name}</span>
        {versionBadge(v) && <Tag color="blue">{versionBadge(v)}</Tag>}
      </div>
      <div className="explore-proposal-body">
        <div>
          <Text strong>教材：</Text>
          {proposal.textbook.title}
          {proposal.textbook.authors?.length ? `（${proposal.textbook.authors.join('、')}）` : ''}
        </div>
        {proposal.exercise && (
          <div>
            <Text strong>习题集：</Text>
            {proposal.exercise.title}
          </div>
        )}
        {(proposal.textbook.intro || proposal.exercise?.intro) && (
          <div className="explore-proposal-intro">
            {[proposal.textbook.intro, proposal.exercise?.intro].filter(Boolean).join('　')}
          </div>
        )}
        <div className="explore-proposal-reason">推荐理由：{proposal.reason}</div>
      </div>
    </div>
  );
}
