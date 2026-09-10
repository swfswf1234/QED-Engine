/**
 * 领域信息卡：显示右侧按钮状态机（PLAN-033 §3/§4）
 * - 根据 exploration_stage 显示不同按钮；失败态 danger 重试
 * - explore_pending 提示条（名称确认/课程审阅/导入挂起/失败原因）
 * - 领域恒显：无论筛选如何始终渲染（由页面层保证）
 * - 布局：名称 + 按钮（右上） + 描述（下方）
 */
import { Alert, Button } from 'antd';
import type { DomainSystem } from '../stores';
import { parseExplorePending } from '../stores/downloads';

interface DomainCardProps {
  domain: DomainSystem;
  onExplore: (domainId: string) => void;
  onConfirmDomain: (domainId: string) => void;
  onConfirmKnowledge: (domainId: string) => void;
}

interface ButtonState {
  label: string;
  disabled: boolean;
  loading: boolean;
  onClick?: () => void;
  type?: 'primary' | 'default' | 'dashed';
  danger?: boolean;
}

function getDomainButtonState(
  stage: string,
  onExplore: () => void,
  onConfirmDomain: () => void,
  onConfirmKnowledge: () => void,
): ButtonState {
  switch (stage) {
    case '未开始':
      return {
        label: '开始探索',
        disabled: false,
        loading: false,
        onClick: onExplore,
        type: 'primary',
      };
    case '已生成':
      return {
        label: '领域信息确认',
        disabled: false,
        loading: false,
        onClick: onConfirmDomain,
        type: 'primary',
      };
    case '探索中':
      return {
        label: '探索中',
        disabled: true,
        loading: true,
        type: 'default',
      };
    case '待确认':
      return {
        label: '课程知识确认',
        disabled: false,
        loading: false,
        onClick: onConfirmKnowledge,
        type: 'primary',
      };
    case '已导入':
      return {
        label: '查看课程',
        disabled: false,
        loading: false,
        onClick: onExplore,
        type: 'default',
      };
    case '已完成':
      return {
        label: '探索完成',
        disabled: true,
        loading: false,
        type: 'default',
      };
    case '失败':
      // 失败=异常态可重试（PLAN-033 §2 统一口径）
      return {
        label: '重试探索',
        disabled: false,
        loading: false,
        onClick: onExplore,
        type: 'primary',
        danger: true,
      };
    default:
      return {
        label: '开始探索',
        disabled: false,
        loading: false,
        onClick: onExplore,
        type: 'primary',
      };
  }
}

/** explore_pending 提示条内容（null = 不展示） */
function pendingAlert(
  domain: DomainSystem,
): { type: 'info' | 'warning' | 'error'; text: string } | null {
  const pending = parseExplorePending(domain.explore_pending);
  if (!pending) return null;
  switch (pending.kind) {
    case 'name_confirmation':
    case 'name_confirm':
      return {
        type: 'info',
        text: `领域名称待确认：建议「${pending.name_check?.suggested_name ?? domain.name}」（${pending.name_check?.reason ?? '名称需人工确认'}）`,
      };
    case 'review_results':
      return {
        type: 'info',
        text: `课程名单待确认：共 ${pending.courses?.length ?? 0} 门课程，请审阅后确认`,
      };
    case 'import_courses':
      return {
        type: 'info',
        text: `导入课程待确认：共 ${pending.courses?.length ?? 0} 门课程，请确认后入库`,
      };
    case 'failed':
    case 'error':
      return {
        type: 'error',
        text: `探索失败：${pending.error ?? '未知错误'}（可重试）`,
      };
    default:
      return null;
  }
}

export default function DomainCard({
  domain,
  onExplore,
  onConfirmDomain,
  onConfirmKnowledge
}: DomainCardProps) {
  // 如果域下有课程且有教程，显示"已导入"状态
  const hasCoursesWithKnowledge = domain.courses?.some(
    (c) => c.knowledge && c.knowledge.length > 0
  );
  const stage = domain.exploration_stage || (hasCoursesWithKnowledge ? '已导入' : '未开始');

  const buttonState = getDomainButtonState(
    stage,
    () => onExplore(domain.domain_id),
    () => onConfirmDomain(domain.domain_id),
    () => onConfirmKnowledge(domain.domain_id),
  );

  const alert = pendingAlert(domain);

  return (
    <div className="dl-domain-card" data-testid="domain-info-card">
      <div className="dl-domain-card-header">
        <h3>{domain.name}</h3>
        <Button
          type={buttonState.type}
          danger={buttonState.danger}
          disabled={buttonState.disabled}
          loading={buttonState.loading}
          onClick={buttonState.onClick}
        >
          {buttonState.label}
        </Button>
      </div>
      {domain.description && (
        <div className="dl-domain-card-info">
          <p>{domain.description}</p>
        </div>
      )}
      {alert && (
        <Alert
          className="dl-domain-card-alert"
          type={alert.type}
          showIcon
          message={alert.text}
          data-testid="domain-pending-alert"
        />
      )}
    </div>
  );
}
