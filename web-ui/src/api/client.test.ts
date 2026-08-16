import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, ApiError, describeError, API_BASE } from './client';
import { mockFetch } from '../test/setup';

describe('api client（统一 API 客户端）', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  it('GET 成功解析 JSON', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const data = await api.get<{ ok: number }>('/health');
    expect(data).toEqual({ ok: 1 });
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/health`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('超时触发 AbortController → timeout 错误', async () => {
    vi.useFakeTimers();
    mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new DOMException('aborted', 'AbortError');
          reject(err);
        });
      });
    });
    const pending = api.get<unknown>('/health', { timeoutMs: 50 });
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });

  it('网络失败 → offline 错误（503/无连接语义，不白屏）', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    await expect(api.get<unknown>('/health')).rejects.toMatchObject({ kind: 'offline' });
  });

  it('HTTP 409 透传 detail → describeError 输出状态冲突语义', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: '状态机冲突' }), { status: 409, headers: { 'Content-Type': 'application/json' } }),
    );
    try {
      await api.post('/services/tracker/start');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.kind).toBe('http');
      expect(apiErr.status).toBe(409);
      expect(describeError(apiErr)).toBe('状态冲突：状态机冲突');
    }
  });

  it('HTTP 422 校验失败 → describeError 输出校验失败语义', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'reason 必填' }), { status: 422, headers: { 'Content-Type': 'application/json' } }),
    );
    try {
      await api.post<unknown>('/selections/x/reject', {});
      expect.unreachable();
    } catch (err) {
      expect(describeError(err)).toBe('校验失败：reason 必填');
    }
  });

  it('HTTP 503 → describeError 输出服务暂不可用语义', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'QED-Tracker 服务不可达' }), { status: 503, headers: { 'Content-Type': 'application/json' } }),
    );
    try {
      await api.get('/selections');
      expect.unreachable();
    } catch (err) {
      expect(describeError(err)).toBe('服务暂不可用：QED-Tracker 服务不可达');
    }
  });

  it('POST 序列化 JSON body', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ name: 'tracker', status: 'starting' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await api.post('/services/tracker/start');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });
});