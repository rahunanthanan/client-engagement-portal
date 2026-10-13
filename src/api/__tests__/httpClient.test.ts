import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { apiRequest, configureAuth, describeError, isApiError } from '../httpClient';
import { rpcCall } from '../rpcAdapter';

describe('httpClient', () => {
  const onUnauthorized = jest.fn();
  beforeEach(() => {
    onUnauthorized.mockReset();
    configureAuth({ getAuthHeaders: () => ({ 'X-Demo-User': 'u-advisor-01' }), onUnauthorized });
  });

  it('sends one correlation id per logical call and reuses it across safe retries', async () => {
    const seen: { id: string | null; attempt: string | null }[] = [];
    server.use(
      http.get('*/api/ping', ({ request }) => {
        seen.push({ id: request.headers.get('X-Correlation-ID'), attempt: request.headers.get('X-Retry-Attempt') });
        return seen.length < 3 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ ok: true });
      }),
    );
    await expect(apiRequest('GET', '/ping')).resolves.toEqual({ ok: true });
    expect(seen).toHaveLength(3);
    expect(new Set(seen.map((s) => s.id)).size).toBe(1);
    expect(seen.map((s) => s.attempt)).toEqual([null, '1', '2']);
  });

  it('never retries a non-idempotent POST without an idempotency key', async () => {
    let calls = 0;
    server.use(http.post('*/api/thing', () => {
      calls += 1;
      return new HttpResponse(null, { status: 503 });
    }));
    await expect(apiRequest('POST', '/thing', { body: {} })).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(1);
  });

  it('retries a POST that carries an idempotency key, sending the same key each time', async () => {
    const keys: (string | null)[] = [];
    server.use(http.post('*/api/thing', ({ request }) => {
      keys.push(request.headers.get('Idempotency-Key'));
      return keys.length === 1 ? new HttpResponse(null, { status: 502 }) : HttpResponse.json({ created: true });
    }));
    await expect(apiRequest('POST', '/thing', { body: {}, idempotencyKey: 'k-1' })).resolves.toEqual({ created: true });
    expect(keys).toEqual(['k-1', 'k-1']);
  });

  it('calls the unauthorized hook on 401 and produces safe messages', async () => {
    server.use(http.get('*/api/secure', () => HttpResponse.json({ code: 'SESSION_EXPIRED', message: 'internal detail' }, { status: 401 })));
    const error = await apiRequest('GET', '/secure').catch((e: unknown) => e);
    expect(isApiError(error)).toBe(true);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(describeError(error)).toBe('Your session has expired. Please sign in again.');
  });

  it('hides server text for 5xx errors and shows a reference instead', async () => {
    server.use(http.get('*/api/broken', () => HttpResponse.json({ code: 'X', message: 'NullPointerException at line 42' }, { status: 500 })));
    const error = await apiRequest('GET', '/broken').catch((e: unknown) => e);
    expect(describeError(error)).toMatch(/^The service is unavailable\. Reference: /);
    expect(describeError(error)).not.toMatch(/NullPointer/);
  });

  it('wraps calls in a JSON-RPC envelope through the RPC adapter', async () => {
    const result = await rpcCall('audit.list', { requestId: 'REQ-2026-000092', page: 1, pageSize: 5 });
    expect(result.items).toHaveLength(5);
    expect(result.total).toBeGreaterThan(5);
  });
});
