import '@testing-library/jest-dom/vitest';
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

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

export { mockFetch };