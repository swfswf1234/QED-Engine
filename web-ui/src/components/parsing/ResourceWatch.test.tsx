import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import ResourceWatch from './ResourceWatch';
import { theme } from '../../theme';
import { mockFetch } from '../../test/setup';
import { useParsingStore } from '../../stores/parsing';
import type { ParseJob } from '../../api/axiom';

// 解析页资源监控弹窗（2026-09-23 用户加需；2026-09-26 BUGFIX-022 发界收窄）：
// 显存 ≥95% 一路不变；模型中断弹窗仅当「last_flip 不早于开页时刻（新近事故）或有解析任务在飞」
// 才弹，事故去重按 `槽位+last_flip` 走 sessionStorage 会话级记忆，remount/刷新不重播。
// 注意：jsdom 不触发 animationend，被 destroy 的弹窗永久停在 fade-leave——可见性断言须排除 leave 态。

const NOTIFIED_KEY = 'qed.parsing.model-down-notified';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const STALE_FLIP = '2026-09-23T21:01:57+08:00';

let seq = 0;
/** 新近事故 flip（晚于挂载时刻且逐次唯一） */
const flipFresh = () => new Date(Date.now() + 1000 + ++seq).toISOString();

const base = () => ({
  gpu: { available: true, memory_total_mb: 16000, memory_used_mb: 15500 }, // 96.9%
  vision: {
    slot: 'vision', source: 'local', channel: 'docker', ready: false,
    health_state: 'down', health_reason: 'mineru docker 容器未运行',
    last_flip: STALE_FLIP,
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

const calmGpu = () => ({ ...state.gpu, memory_used_mb: 8000 });
const startJob = () =>
  useParsingStore.setState({ activeJob: { id: 1, status: 'running' } as unknown as ParseJob });

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
    sessionStorage.removeItem(NOTIFIED_KEY);
    useParsingStore.setState({ activeJob: null });
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

  it('新近事故（flip 不早于开页时刻）→ 「本地模型服务中断」弹窗带原因；同一 last_flip 只弹一次', async () => {
    state.gpu = calmGpu();
    state.vision = { ...state.vision, health_state: 'ready', ready: true };
    mockRoutes();
    mount();
    state.vision = { ...state.vision, health_state: 'down', ready: false, last_flip: flipFresh() };
    expect(await screen.findByText(/本地模型服务中断/)).toBeInTheDocument();
    expect(screen.getByText(/mineru docker 容器未运行/)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 200));
    expect(visibleNotices(/本地模型服务中断/)).toBe(1);
  });

  it('模型恢复 ready → 弹窗撤下；新一轮 last_flip 的 down 会重新弹', async () => {
    state.gpu = calmGpu();
    state.vision = { ...state.vision, health_state: 'ready', ready: true };
    mockRoutes();
    mount();
    state.vision = { ...state.vision, health_state: 'down', ready: false, last_flip: flipFresh() };
    expect(await screen.findByText(/本地模型服务中断/)).toBeInTheDocument();
    state.vision = { ...state.vision, health_state: 'ready', ready: true, health_reason: '' };
    await waitFor(() => expect(visibleNotices(/本地模型服务中断/)).toBe(0), { timeout: 2000 });
    state.vision = {
      ...state.vision, health_state: 'down', ready: false,
      health_reason: '显存不足探针失败', last_flip: flipFresh(),
    };
    await waitFor(() => expect(visibleNotices(/本地模型服务中断/)).toBe(1), { timeout: 2000 });
    expect(screen.getByText(/显存不足探针失败/)).toBeInTheDocument();
  });

  it('存量 down（旧 flip）且无任务 → 打开页面不弹（BUGFIX-022 发界）', async () => {
    state.gpu = calmGpu();
    mockRoutes();
    mount();
    await new Promise((r) => setTimeout(r, 200)); // ~4 轮轮询均为存量 down
    expect(visibleNotices(/本地模型服务中断/)).toBe(0);
  });

  it('存量 down 且用户随后发起解析任务 → 首发提醒（不消耗于挂载时）', async () => {
    state.gpu = calmGpu();
    mockRoutes();
    mount();
    await new Promise((r) => setTimeout(r, 100));
    expect(visibleNotices(/本地模型服务中断/)).toBe(0);
    startJob();
    expect(await screen.findByText(/本地模型服务中断/)).toBeInTheDocument();
  });

  it('同一 last_flip 已弹过 → remount 不重播（会话级事故记忆，任务仍在飞也不重弹）', async () => {
    state.gpu = calmGpu();
    startJob(); // 存量 down + 在飞 → 首发
    mockRoutes();
    const view = mount();
    expect(await screen.findByText(/本地模型服务中断/)).toBeInTheDocument();
    view.unmount();
    mount(); // 同 flip、job 仍在飞、storage 已记忆 → 不再弹
    await new Promise((r) => setTimeout(r, 200));
    expect(visibleNotices(/本地模型服务中断/)).toBe(0);
  });

  it('显存正常 + 模型 ready → 无任何弹窗', async () => {
    state.gpu = calmGpu();
    state.vision = { ...state.vision, health_state: 'ready', ready: true };
    mockRoutes();
    mount();
    await new Promise((r) => setTimeout(r, 150));
    expect(visibleNotices(/显存占用过高|本地模型服务中断/)).toBe(0);
  });
});
