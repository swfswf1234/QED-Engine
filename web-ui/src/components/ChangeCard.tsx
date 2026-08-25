/**
 * 领域探索变更卡片（exploration-ui §3 领域探索视图 diff 行）
 * - create_domain / create_course 动作徽标 + 对象 + 内容摘要 + 理由
 * - 仅勾选取舍、无内联编辑（2026-08-23 用户裁决）
 */
import { Checkbox, Tag, Typography } from 'antd';
import type { CurriculumChange } from '../stores';

const { Text } = Typography;

const ACTION_LABELS: Record<CurriculumChange['action'], { label: string; color: string }> = {
  create_domain: { label: '新建领域', color: 'purple' },
  create_course: { label: '新增课程', color: 'green' },
  update_course: { label: '修改课程', color: 'blue' },
  delete_course: { label: '删除课程', color: 'red' },
};

function payloadSummary(change: CurriculumChange): string {
  const p = change.payload ?? {};
  const bits: string[] = [];
  if (p.name) bits.push(String(p.name));
  if (p.stage) bits.push(String(p.stage));
  if (p.note) bits.push(String(p.note));
  return bits.join('　');
}

export default function ChangeCard({ change, checked, disabled, onToggle }: {
  change: CurriculumChange;
  checked: boolean;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const meta = ACTION_LABELS[change.action];
  return (
    <div className={`explore-change-card${checked ? ' selected' : ''}${disabled && !checked ? ' disabled' : ''}`}>
      <div className="explore-change-head">
        <Checkbox
          checked={checked}
          disabled={disabled}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`勾选 ${meta.label}`}
        />
        <Tag color={meta.color}>{meta.label}</Tag>
        <span className="explore-change-target">{String(change.payload?.name ?? change.target_id)}</span>
      </div>
      <div className="explore-change-body">
        {payloadSummary(change) && (
          <div>
            <Text type="secondary">内容：</Text>
            {payloadSummary(change)}
          </div>
        )}
        {change.reason && <div className="explore-proposal-reason">理由：{change.reason}</div>}
      </div>
    </div>
  );
}
