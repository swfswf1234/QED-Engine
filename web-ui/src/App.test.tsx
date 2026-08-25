import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import App from './App';
import { theme } from './theme';

function renderApp() {
  return render(
    <ConfigProvider theme={theme}>
      <App />
    </ConfigProvider>,
  );
}

describe('App 路由骨架（Phase 0 冒烟）', () => {
  it('默认路由渲染主界面占位', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: /QED-Engine 学习中心/ })).toBeInTheDocument();
  });

  it('#/admin 渲染控制台占位（后台入口跳转）', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: '后台管理' }));
    expect(await screen.findByRole('heading', { name: '控制台' })).toBeInTheDocument();
  });

  it('通过 hash 直达 #/admin/dashboard 渲染仪表盘占位', () => {
    window.location.hash = '#/admin/dashboard';
    const { container } = renderApp();
    expect(container.querySelector('h2')?.textContent).toBe('仪表盘');
  });

  it('通过 hash 直达 #/admin/downloads 渲染文档下载管理', () => {
    window.location.hash = '#/admin/downloads';
    const { container } = renderApp();
    expect(container.querySelector('h2')?.textContent).toBe('文档下载管理');
  });

  // 2026-08-24 REQ-059：探索确认页路由已删除（全弹窗流），原 downloads/explore 用例移除

  it('通过 hash 直达 #/admin/llm-calls 渲染模型调用记录', () => {
    window.location.hash = '#/admin/llm-calls';
    const { container } = renderApp();
    expect(container.querySelector('h2')?.textContent).toBe('模型调用记录');
  });

  it('#/knowledge 渲染学习中心知识结构浏览', () => {
    window.location.hash = '#/knowledge';
    const { container } = renderApp();
    expect(container.querySelector('h2')?.textContent).toBe('学习中心 · 知识结构浏览');
  });

  it('主界面「课程学习」卡跳转 #/knowledge', async () => {
    window.location.hash = '#/';
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByText('课程学习'));
    expect(await screen.findByRole('heading', { name: '学习中心 · 知识结构浏览' })).toBeInTheDocument();
  });
});