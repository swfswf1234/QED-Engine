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

describe('领域确认弹窗表单口径（downloads-ui.md §3.1）', () => {
  const FIELD_ORDER = ['领域名', '领域描述', '学科知识', '探索范围', '学习阶段'];

  function renderOpen() {
    return renderWithProviders(
      <DomainConfirmModal domain={mockDomain} open={true} onClose={() => {}} />,
    );
  }

  it('五个字段依序出现：领域名→领域描述→学科知识→探索范围→学习阶段', () => {
    renderOpen();
    const modals = Array.from(document.querySelectorAll('.ant-modal'));
    const scope = modals.reverse().find((m) => m.querySelector('label')) ?? document.body;
    const texts = Array.from(scope.querySelectorAll('label')).map((l) => l.textContent ?? '');
    const idx = FIELD_ORDER.map((w) => texts.findIndex((t) => t.includes(w)));
    expect(idx.includes(-1), JSON.stringify(texts)).toBe(false);
    for (let i = 1; i < idx.length; i += 1) expect(idx[i]).toBeGreaterThan(idx[i - 1]);
  });

  it('标签唯一口径：「探索范围」归 level（回填 本科），scope 称「学科知识」，不再出现「探索范围（scope）」', () => {
    renderOpen();
    expect(screen.queryByText('探索范围（scope）')).toBeNull();
    expect((screen.getByLabelText(/学科知识/) as HTMLTextAreaElement).value).toBe('范围');
    expect((screen.getByLabelText(/探索范围/) as HTMLInputElement).value).toBe('本科');
  });

  it('领域描述非必填（无 required 标记）', () => {
    renderOpen();
    const label = screen.getByText('领域描述');
    expect(label.className).not.toContain('ant-form-item-required');
  });
});
