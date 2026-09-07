/**
 * 领域信息卡：显示右侧按钮状态机
 * - 根据 exploration_stage 显示不同按钮
 * - 按钮禁用/loading 逻辑
 */
import { Button } from 'antd';
import type { DomainSystem } from '../stores';

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
    case '已完成':
      return { 
        label: '探索完成', 
        disabled: true, 
        loading: false,
        type: 'default',
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

export default function DomainCard({ 
  domain, 
  onExplore, 
  onConfirmDomain, 
  onConfirmKnowledge 
}: DomainCardProps) {
  const stage = domain.exploration_stage || '未开始';
  
  const buttonState = getDomainButtonState(
    stage,
    () => onExplore(domain.domain_id),
    () => onConfirmDomain(domain.domain_id),
    () => onConfirmKnowledge(domain.domain_id),
  );

  return (
    <div className="dl-domain-card">
      <div className="dl-domain-card-header">
        <h3>{domain.name}</h3>
        <span className="dl-domain-card-stage">状态：{stage}</span>
      </div>
      <div className="dl-domain-card-info">
        <p>{domain.description || '暂无描述'}</p>
        <p>阶段：{domain.stages?.join('、') || '未设置'}</p>
        <p>课程数：{domain.courses.length}</p>
      </div>
      <div className="dl-domain-card-action">
        <Button
          type={buttonState.type}
          disabled={buttonState.disabled}
          loading={buttonState.loading}
          onClick={buttonState.onClick}
          block
        >
          {buttonState.label}
        </Button>
      </div>
    </div>
  );
}
