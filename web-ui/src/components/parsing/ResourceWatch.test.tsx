import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import ResourceWatch from './ResourceWatch';
import { theme } from '../../theme';
import { mockFetch } from '../../test/setup';

// 解析页资源监控弹窗（2026-09-23 用户加需）：显存 ≥95% / 本地模型服务中断 → notification 弹窗
// 注意：jsdom 不触发 animationend，被 destroy 的弹窗永久停在 fade-leave——可见性断言须排除 leave 态。

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const base = () => ({
  gpu: { available: true, memory_total_mb: 16000, memory_used_mb: 15500 }, // 96.9%
  vision: {
    slot: 'vision', source: 'local', channel: 'docker', ready: false,
    health_state: 'down', health_reason: 'mineru docker 容器未运行',
    last_flip: '2026-09-23T21:01:57+08:00',
  },
});

let state = base();

function mockRoutes() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/monitor/gpu')) return Promise.resolve(json(state.gpu));
    if (url.includes('/models/vision')) return Promise.resolve(json(state.vision));
    return Promise.reject(new TypeError(`no route: GET ${url}`));
  });
}

/** 当前可见（非 fade-leave）且正文匹配 pattern 的弹窗数 */
function visibleNotices(pattern: RegExp): number {
  return [...document.querySelectorAll('.ant-notification-notice-wrapper')]
    .filter((w) => !w.className.includes('fade-leave'))
    .filter((w) => pattern.test(w.textContent ?? '')).length;
}

function mount() {
  return render(
    <ConfigProvider theme={theme}>
      <App><ResourceWatch intervalMs={50} /></App>
    </ConfigProvider>,
  );
}

describe('解析页 ResourceWatch 显存/模型中断弹窗', () => {
  beforeEach(() => {
    state = base();
  });

  it('显存 ≥95% → 「显存占用过高」弹窗；持续高位多轮轮询只弹一次', async () => {
    mockRoutes();
    mount();
    expect(await screen.findByText(/显存占用过高/)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 200)); // 再走 ~4 轮轮询
    expect(visibleNotices(/显存占用过高/)).toBe(1);
  });

  it('显存回落到 90% 以下 → 弹窗撤下；再次冲高可重新弹（迟滞复位）', async () => {
    state.vision = { ...state.vision, health_state: 'ready', ready: true };
    mockRoutes();
    mount();
    expect(await screen.findByText(/显存占用过高/)).toBeInTheDocument();
    state.gpu = { ...state.gpu, memory_used_mb: 8000 };
    await waitFor(() => expect(visibleNotices(/显存占用过高/)).toBe(0), { timeout: 2000 });
    state.gpu = { ...state.gpu, memory_used_mb: 15900 };
    await waitFor(() => expect(visibleNotices(/显存占用过高/)).toBe(1), { timeout: 2000 });
  });

  it('vision 槽 down → 「本地模型服务中断」弹窗带原因；同一 last_flip 不重复弹', async () => {
    state.gpu = { ...state.gpu, memory_used_mb: 8000 };
    mockRoutes();
    mount();
    expect(await screen.findByText(/本地模型服务中断/)).toBeInTheDocument();
    expect(screen.getByText(/mineru docker 容器未运行/)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 200));
    expect(visibleNotices(/本地模型服务中断/)).toBe(1);
  });

  it('模型恢复 ready → 弹窗撤下；新一轮 last_flip 的 down 会重新弹', async () => {
    state.gpu = { ...state.gpu, memory_used_mb: 8000 };
    mockRoutes();
    mount();
    expect(await screen.findByText(/本地模型服务中断/)).toBeInTheDocument();
    state.vision = { ...state.vision, health_state: 'ready', ready: true, health_reason: '' };
    await waitFor(() => expect(visibleNotices(/本地模型服务中断/)).toBe(0), { timeout: 2000 });
    state.vision = { ...state.vision, health_state: 'down', ready: false, health_reason: '显存不足探针失败', last_flip: '2026-09-23T22:30:00+08:00' };
    await waitFor(() => expect(visibleNotices(/本地模型服务中断/)).toBe(1), { timeout: 2000 });
    expect(screen.getByText(/显存不足探针失败/)).toBeInTheDocument();
  });

  it('显存正常 + 模型 ready → 无任何弹窗', async () => {
    state.gpu = { ...state.gpu, memory_used_mb: 8000 };
    state.vision = { ...state.vision, health_state: 'ready', ready: true };
    mockRoutes();
    mount();
    await new Promise((r) => setTimeout(r, 150));
    expect(visibleNotices(/显存占用过高|本地模型服务中断/)).toBe(0);
  });
});
