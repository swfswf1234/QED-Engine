import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminLayout from './AdminLayout';

function renderLayout(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div>控制台页</div>} />
          <Route path="dashboard" element={<div>仪表盘页</div>} />
          <Route path="downloads" element={<div>下载管理页</div>} />
          <Route path="llm-calls" element={<div>模型调用记录页</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('管理台左侧导航 AdminLayout（Phase 3 反馈）', () => {
  it('渲染五个菜单项与主界面入口', () => {
    renderLayout('/admin');
    expect(screen.getByText('QED 管理台')).toBeInTheDocument();
    expect(screen.getByText('控制台')).toBeInTheDocument();
    expect(screen.getByText('仪表盘')).toBeInTheDocument();
    expect(screen.getByText('下载管理')).toBeInTheDocument();
    expect(screen.getByText('文档解析管理')).toBeInTheDocument();
    expect(screen.getByText('模型调用记录')).toBeInTheDocument();
    expect(screen.getByText('主界面')).toBeInTheDocument();
  });

  it('默认进入控制台；点击菜单可切换页面', async () => {
    renderLayout('/admin');
    expect(screen.getByText('控制台页')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByText('仪表盘'));
    expect(await screen.findByText('仪表盘页')).toBeInTheDocument();
    await user.click(screen.getByText('下载管理'));
    expect(await screen.findByText('下载管理页')).toBeInTheDocument();
    await user.click(screen.getByText('模型调用记录'));
    expect(await screen.findByText('模型调用记录页')).toBeInTheDocument();
    await user.click(screen.getByText('控制台'));
    expect(await screen.findByText('控制台页')).toBeInTheDocument();
  });

  it('当前路由高亮对应菜单项', () => {
    renderLayout('/admin/dashboard');
    const items = document.querySelectorAll('.ant-menu-item');
    const active = Array.from(items).find((el) => el.classList.contains('ant-menu-item-selected'));
    expect(active?.textContent).toBe('仪表盘');
  });

  it('#/admin/llm-calls 高亮「模型调用记录」菜单项', () => {
    renderLayout('/admin/llm-calls');
    const items = document.querySelectorAll('.ant-menu-item');
    const active = Array.from(items).find((el) => el.classList.contains('ant-menu-item-selected'));
    expect(active?.textContent).toBe('模型调用记录');
  });

  it('主界面入口返回 #/', async () => {
    renderLayout('/admin');
    const user = userEvent.setup();
    await user.click(screen.getByText('主界面'));
    // navigate('/') 后渲染根路径（此处无匹配路由 → 空白占位）；验证导航生效无报错
    expect(screen.queryByText('控制台页')).not.toBeInTheDocument();
  });
});