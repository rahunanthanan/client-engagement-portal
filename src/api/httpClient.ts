import { env } from '@/app/env';
import { logger } from '@/shared/logger';
import type { ApiErrorBody } from './contracts';

/**
 * Thin fetch wrapper used by every API call.
 *
 * - Adds an `X-Correlation-ID` (one per logical call, reused across retries) so frontend
 *   errors can be matched with backend logs.
 * - Retries only when it is safe: idempotent methods, or calls carrying an idempotency key,
 *   and only for network errors / 502 / 503 / 504.
 * - Adds auth headers from the active identity adapter; never reads or stores tokens itself.
 * - Converts error responses into `ApiError` with a safe, user-presentable message.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId: string;
  readonly fieldErrors?: Record<string, string>;
  readonly details?: Record<string, unknown>;

  constructor(status: number, body: Partial<ApiErrorBody>, correlationId: string) {
    super(body.message ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code ?? 'UNKNOWN';
    this.correlationId = body.correlationId ?? correlationId;
    this.fieldErrors = body.fieldErrors;
    this.details = body.details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export interface AuthHooks {
  getAuthHeaders(): Record<string, string>;
  onUnauthorized(): void;
}

let authHooks: AuthHooks = { getAuthHeaders: () => ({}), onUnauthorized: () => undefined };

export function configureAuth(hooks: AuthHooks): void {
  authHooks = hooks;
}

export function newCorrelationId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  idempotencyKey?: string;
  /** Max retries for safe requests (default 2). */
  retries?: number;
  timeoutMs?: number;
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = env.apiBaseUrl.replace(/\/$/, '');
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  const relative = `${base}${path}${qs ? `?${qs}` : ''}`;
  // Absolute URL so the same code works in browsers and in Node-based tests.
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost';
  return new URL(relative, origin).toString();
}

function combineSignals(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal | undefined {
  const timeout = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined;
  if (signal && timeout && typeof AbortSignal.any === 'function') return AbortSignal.any([signal, timeout]);
  return signal ?? timeout;
}

export async function apiRequest<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const correlationId = newCorrelationId();
  const canRetry = SAFE_METHODS.has(method) || options.idempotencyKey !== undefined;
  const maxRetries = canRetry ? (options.retries ?? 2) : 0;
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;

  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(buildUrl(path, options.query), {
        method,
        credentials: 'same-origin',
        signal: combineSignals(options.signal, options.timeoutMs ?? 15_000),
        headers: {
          Accept: 'application/json',
          ...(options.body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
          'X-Correlation-ID': correlationId,
          ...(attempt > 0 ? { 'X-Retry-Attempt': String(attempt) } : {}),
          ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
          ...authHooks.getAuthHeaders(),
          ...options.headers,
        },
        body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (attempt < maxRetries) {
        await wait(200 * 2 ** attempt);
        continue;
      }
      logger.warn('network error', { method, path, correlationId });
      throw new ApiError(0, { code: 'NETWORK', message: 'The service could not be reached. Check your connection and try again.' }, correlationId);
    }

    if (RETRYABLE_STATUS.has(response.status) && attempt < maxRetries) {
      await wait(200 * 2 ** attempt);
      continue;
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    const json: unknown = text ? safeParse(text) : undefined;

    if (!response.ok) {
      const body = (json && typeof json === 'object' ? json : {}) as Partial<ApiErrorBody>;
      if (response.status === 401) authHooks.onUnauthorized();
      logger.warn('api error', { method, path, status: response.status, code: body.code, correlationId });
      throw new ApiError(response.status, body, response.headers.get('X-Correlation-ID') ?? correlationId);
    }
    return json as T;
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Maps API errors to short, safe messages. Never surfaces raw server text for 5xx. */
export function describeError(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong. Please try again.';
  switch (error.status) {
    case 0:
      return error.message;
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The item could not be found.';
    case 409:
      return 'This item was changed by someone else.';
    case 413:
    case 415:
    case 422:
      return error.message;
    default:
      return `The service is unavailable. Reference: ${error.correlationId.slice(0, 8)}`;
  }
}
