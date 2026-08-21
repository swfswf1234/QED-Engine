/**
 * 统一 API 客户端（设计：frontend-react-refactor「统一 API 客户端」）
 * - API_BASE：dev 走 Vite proxy（/api/v1，同源，由 vite.config.ts 转发至 8900）；
 *   生产构建经环境变量注入（VITE_API_BASE，指向 http://127.0.0.1:8900/api/v1）。
 * - AbortController 超时；503/409 明确提示；离线降级（不白屏）。
 */

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '/api/v1';

export const DEFAULT_TIMEOUT_MS = 8000;

export type ApiErrorKind = 'timeout' | 'offline' | 'http';

export interface ApiError {
  kind: ApiErrorKind;
  status: number;
  message: string;
  detail?: unknown;
}

export class ApiError extends Error {
  kind: ApiErrorKind;
  status: number;
  detail?: unknown;

  constructor(kind: ApiErrorKind, status: number, message: string, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
}

export interface ApiRequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  /** query 参数（GET；undefined/空值跳过） */
  params?: Record<string, string | undefined>;
}

async function request<T>(path: string, init?: RequestInit, opts?: ApiRequestOptions): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // 外部 signal 与超时 controller 联动：任一中止即中止请求
  const onOuterAbort = () => controller.abort();
  const outerSignal = opts?.signal;
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort();
    else outerSignal.addEventListener('abort', onOuterAbort);
  }

  const query = opts?.params
    ? new URLSearchParams(
        Object.entries(opts.params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, v as string]),
      ).toString()
    : '';
  const url = `${API_BASE}${path}${query ? `?${query}` : ''}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (err) {
    if (controller.signal.aborted && !outerSignal?.aborted) {
      throw new ApiError('timeout', 0, `请求超时（${timeoutMs}ms）：${url}`);
    }
    if (err instanceof Error && err.name === 'AbortError') {
      // 外部中止：按离线/中断处理
      throw new ApiError('offline', 0, '请求已中止');
    }
    throw new ApiError('offline', 0, `无法连接服务（${API_BASE}）：${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timer);
    if (outerSignal) outerSignal.removeEventListener('abort', onOuterAbort);
  }

  if (!res.ok) {
    let detail: unknown;
    let message = `请求失败（HTTP ${res.status}）`;
    try {
      const body = await res.json();
      detail = body;
      if (typeof body?.message === 'string') message = body.message;
      else if (typeof body?.detail === 'string') message = body.detail;
    } catch {
      /* 非 JSON 响应体，保留默认 message */
    }
    throw new ApiError('http', res.status, message, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get<T>(path: string, opts?: ApiRequestOptions): Promise<T> {
    return request<T>(path, { method: 'GET' }, opts);
  },
  post<T>(path: string, body?: unknown, opts?: ApiRequestOptions): Promise<T> {
    return request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }, opts);
  },
  put<T>(path: string, body?: unknown, opts?: ApiRequestOptions): Promise<T> {
    return request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }, opts);
  },
};

/** 错误信息归一：供 UI 直接展示（含 409/422 语义提示） */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'timeout') return err.message;
    if (err.kind === 'offline') return err.message;
    if (err.status === 409) return `状态冲突：${err.message}`;
    if (err.status === 422) return `校验失败：${err.message}`;
    if (err.status === 503) return `服务暂不可用：${err.message}`;
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}