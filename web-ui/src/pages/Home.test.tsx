import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import Home from './Home';
import { theme } from '../theme';
import { HELP_PAGES } from '../help/sections';

const messageSpies = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  // Object.assign 保留 App 组件函数本身，仅覆盖 useApp（spread 会毁掉组件）
  return {
    ...actual,
    App: Object.assign(actual.App, { useApp: () => ({ message: messageSpies }) }),
  };
});

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ConfigProvider theme={theme}>
        <AntApp>
          <Home />
        </AntApp>
        <LocationProbe />
      </ConfigProvider>
    </MemoryRouter>,
  );
}

describe('主界面 Home（Phase 1）', () => {
  beforeEach(() => {
    messageSpies.info.mockClear();
  });

  it('Hero 区渲染标题与简介（零后台痕迹：不出现服务状态字样）', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: 'QED-Engine 学习中心' })).toBeInTheDocument();
    expect(screen.getByText(/重构数学认知边界/)).toBeInTheDocument();
    expect(screen.queryByText(/服务状态|离线/)).not.toBeInTheDocument();
    // 裁决（REQ-104 二审）：知识探索已开放，Hero 不再声明「学习中心仍在建设中」
    expect(screen.queryByText(/学习中心仍在建设中/)).not.toBeInTheDocument();
  });

  it('三大入口卡全部开放：「知识探索」→ #/knowledge，「课程学习」→ #/learn，「课后练习」→ #/practice', async () => {
    const user = userEvent.setup();
    renderHome();
    for (const name of ['知识探索', '课程学习', '课后练习']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    // REQ-105 W1：课程学习卡开放，直达书架，不出占位提示
    await user.click(screen.getByRole('heading', { name: '课程学习' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/learn'));

    await user.click(screen.getByRole('heading', { name: '知识探索' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/knowledge'));

    // REQ-106 W2：课后练习独立面开放，占位提示整体移除
    await user.click(screen.getByRole('heading', { name: '课后练习' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/practice'));
    expect(messageSpies.info).not.toHaveBeenCalled();
  });

  it('三卡一句话＝总册三条入口的定稿句（同源不漂移）', () => {
    renderHome();
    const entries = HELP_PAGES.center.entries ?? [];
    expect(entries.map((entry) => entry.desc)).toEqual([
      '知识点全局俯瞰。您可以在这里查看知识星图，从入门到核心，了解您感兴趣的知识架构。',
      '教材学习中心。您可以对比多种教材，寻找最合适的教程推进您的学习进度。',
      '检验您的学习进度，帮助您彻底掌握已学习到的知识。',
    ]);
    for (const entry of entries) {
      expect(screen.getByText(entry.desc)).toBeInTheDocument();
    }
  });

  it('使用手册按钮打开学习中心总册，三条入口切到子页并可返回', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole('button', { name: '使用手册' }));
    const dialog = await screen.findByRole('dialog');
    // 总册三节同构；愿景／后续规划按 2026-10-16 裁决整节不出
    expect(within(dialog).getByText(/整理成一条独自也走得完的路/)).toBeInTheDocument();
    for (const heading of ['功能概览', '使用说明', '状态与限制']) {
      expect(within(dialog).getByText(heading)).toBeInTheDocument();
    }
    expect(within(dialog).queryByText('愿景')).not.toBeInTheDocument();
    for (const name of ['知识探索', '课程学习', '课后练习']) {
      expect(within(dialog).getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    }
    // 点入口即切册（子页有自己的功能概览与使用说明）
    await user.click(within(dialog).getByRole('button', { name: /课程学习/ }));
    expect(await within(dialog).findByText(/书架清单按领域列出您的课程与教材/)).toBeInTheDocument();
    // 子页可返回总册
    await user.click(within(dialog).getByRole('button', { name: /学习中心总手册/ }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /知识探索/ })).toBeInTheDocument());
    // 后台管理手册已按 2026-10-15 裁决整体移除
    expect(within(dialog).queryByText(/控制台|仪表盘|五阶段/)).not.toBeInTheDocument();
  });

  it('右上角提供后台管理入口', () => {
    renderHome();
    expect(screen.getByRole('button', { name: '后台管理' })).toBeInTheDocument();
  });
});