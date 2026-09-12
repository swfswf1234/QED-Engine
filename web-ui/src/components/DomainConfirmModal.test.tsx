/**
 * DomainConfirmModal 测试：确认模式选择器（ISSUE-001 前端绕行）
 * - Radio.Group 默认值验证
 * - Radio 切换验证
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigProvider, App as AntApp } from 'antd';
import DomainConfirmModal from './DomainConfirmModal';
import { theme } from '../theme';
import type { DomainSystem } from '../stores';
import { useDownloadsStore } from '../stores/downloads';

vi.mock('../api/tracker', () => ({
  updateDomain: vi.fn().mockResolvedValue({}),
  commitImport: vi.fn().mockResolvedValue({}),
}));
vi.mock('../api/explore-helpers', () => ({
  confirmDomainInfo: vi.fn().mockResolvedValue(undefined),
}));

import { commitImport } from '../api/tracker';
import { confirmDomainInfo } from '../api/explore-helpers';

function renderWithProviders(ui: React.ReactNode) {
  return render(
    <ConfigProvider theme={theme}>
      <AntApp>{ui}</AntApp>
    </ConfigProvider>,
  );
}

const mockDomain: DomainSystem = {
  domain_id: 'test-domain',
  name: '测试领域',
  description: '描述',
  scope: '范围',
  stages: ['基础'],
  classic_tracks: [],
  courses: [],
  exploration_stage: '已生成',
  explore_pending: {
    kind: 'review_results',
    courses: [],
    domain_report: { description: '', stages: [], classic_tracks: [] },
  },
  level: '本科',
};

describe('DomainConfirmModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('默认选中 AI 探索模式', () => {
    renderWithProviders(
      <DomainConfirmModal
        domain={mockDomain}
        open={true}
        onClose={() => {}}
      />,
    );
    const exploreRadio = screen.getByDisplayValue('explore') as HTMLInputElement;
    expect(exploreRadio.checked).toBe(true);
  });

  it('可以切换到已导入模式', () => {
    renderWithProviders(
      <DomainConfirmModal
        domain={mockDomain}
        open={true}
        onClose={() => {}}
      />,
    );
    const importRadio = screen.getByDisplayValue('import') as HTMLInputElement;
    expect(importRadio.checked).toBe(false);
    fireEvent.click(importRadio);
    expect(importRadio.checked).toBe(true);
  });

  it('已导入模式下状态预览显示导入文案', () => {
    renderWithProviders(
      <DomainConfirmModal
        domain={mockDomain}
        open={true}
        onClose={() => {}}
      />,
    );
    const importRadio = screen.getByDisplayValue('import');
    fireEvent.click(importRadio);
    expect(screen.getByText(/保存后进入课程信息确认/)).toBeTruthy();
  });

  it('AI探索模式下状态预览显示探索文案', () => {
    renderWithProviders(
      <DomainConfirmModal
        domain={mockDomain}
        open={true}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/保存并确认后开始课程体系探索/)).toBeTruthy();
  });

  it('已导入提交只调 confirm-domain，不调 commit-import（PLAN-041 修复 409）', async () => {
    useDownloadsStore.setState({ fetchAll: vi.fn().mockResolvedValue(undefined) });
    renderWithProviders(
      <DomainConfirmModal
        domain={mockDomain}
        open={true}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByDisplayValue('import'));
    fireEvent.click(screen.getByRole('button', { name: '保存并确认' }));
    await waitFor(() => expect(confirmDomainInfo).toHaveBeenCalledWith('test-domain', undefined));
    expect(commitImport).not.toHaveBeenCalled();
  });
});
