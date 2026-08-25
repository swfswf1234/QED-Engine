import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { vi } from 'vitest';

// vitest 环境默认无 fetch（jsdom），统一以 mock 提供
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// AntD 响应式组件（Col/Modal 等）依赖 window.matchMedia（jsdom 未实现）
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// AntD 弹层动画在测试环境关闭，避免 jsdom 计时器告警
beforeEach(() => {
  mockFetch.mockReset();
});

// RTL v16 起（非 vitest globals 模式）不自动卸载组件：残留实例会重复触发
// fetchAll/60s 定时刷新等 effect，造成跨测试 mock 计数错位（2026-08-23 DEFECT 修复）
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

export { mockFetch };