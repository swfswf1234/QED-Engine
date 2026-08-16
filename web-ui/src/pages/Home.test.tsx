import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider, message } from 'antd';
import Home from './Home';
import { theme } from '../theme';
import { HELP_SECTIONS } from '../help/sections';

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: {
      info: vi.fn(),
    },
  };
});

function renderHome() {
  return render(
    <MemoryRouter>
      <ConfigProvider theme={theme}>
        <Home />
      </ConfigProvider>
    </MemoryRouter>,
  );
}

describe('主界面 Home（Phase 1）', () => {
  beforeEach(() => {
    vi.mocked(message.info).mockClear();
  });

  it('Hero 区渲染标题与简介（零后台痕迹：不出现服务状态字样）', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: 'QED-Engine 学习中心' })).toBeInTheDocument();
    expect(screen.getByText(/重构数学认知边界/)).toBeInTheDocument();
    expect(screen.queryByText(/服务状态|离线/)).not.toBeInTheDocument();
  });

  it('三大入口卡渲染，点击提示建设中', async () => {
    const user = userEvent.setup();
    renderHome();
    for (const name of ['知识探索', '课程学习', '课后练习']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    await user.click(screen.getByRole('heading', { name: '知识探索' }));
    expect(message.info).toHaveBeenCalledWith('「知识探索」建设中，将在后续轮次开放');
  });

  it('使用手册按钮打开弹窗，展示全部 HELP_SECTIONS 章节', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole('button', { name: '使用手册' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    // 弹窗章节与手册数据一致（含五阶段核心内容）
    for (const s of HELP_SECTIONS) {
      expect(screen.getByRole('heading', { name: s.title })).toBeInTheDocument();
    }
    expect(screen.getByText(/阶段 0｜先验课程体系/)).toBeInTheDocument();
  });

  it('右上角提供后台管理入口', () => {
    renderHome();
    expect(screen.getByRole('button', { name: '后台管理' })).toBeInTheDocument();
  });
});