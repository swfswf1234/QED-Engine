/**
 * DomainCard 描述区测试（downloads-ui.md §3.1 描述可空 + 空态引导）
 * - 空描述不再整块隐藏，改为显示「可点探索生成」的空态引导
 * - 有描述时按正文显示，不出现空态文案
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfigProvider, App as AntApp } from 'antd';
import DomainCard from './DomainCard';
import { theme } from '../theme';
import type { DomainSystem } from '../stores';

function cardDomain(overrides?: Partial<DomainSystem>): DomainSystem {
  return {
    domain_id: 'dm1',
    name: '高等数学',
    description: '',
    scope: '',
    level: '本科-硕士',
    stages: [],
    classic_tracks: [],
    courses: [],
    exploration_stage: '未开始',
    explore_pending: null,
    ...overrides,
  } as DomainSystem;
}

function renderCard(domain: DomainSystem) {
  return render(
    <ConfigProvider theme={theme}>
      <AntApp>
        <DomainCard
          domain={domain}
          onExplore={vi.fn()}
          onConfirmDomain={vi.fn()}
          onConfirmKnowledge={vi.fn()}
        />
      </AntApp>
    </ConfigProvider>,
  );
}

describe('DomainCard 描述区', () => {
  it('空描述显示探索引导空态', () => {
    renderCard(cardDomain());
    expect(screen.getByText('（暂无描述，可点『探索领域知识』生成）')).toBeInTheDocument();
  });

  it('有描述显示正文且不出现空态文案', () => {
    renderCard(cardDomain({ description: '实分析的入门分支，研究极限、连续与收敛。' }));
    expect(screen.getByText('实分析的入门分支，研究极限、连续与收敛。')).toBeInTheDocument();
    expect(screen.queryByText('（暂无描述，可点『探索领域知识』生成）')).toBeNull();
  });
});
