import type { AuditEvent, Page } from './contracts';
import { ApiError, apiRequest } from './httpClient';

/**
 * ILLUSTRATIVE RPC-over-HTTP adapter.
 *
 * Some back-office services expose a single `POST /rpc` endpoint with a JSON-RPC style
 * envelope instead of REST resources. This adapter shows how the UI can keep a typed,
 * method-per-call API regardless of transport. In this sample only audit history uses it;
 * everything else uses REST.
 */

export interface RpcMethods {
  'audit.list': { params: { requestId: string; page: number; pageSize: number }; result: Page<AuditEvent> };
  'system.ping': { params: Record<string, never>; result: { ok: true; serverTime: string } };
}

export type RpcMethod = keyof RpcMethods;

interface RpcEnvelope<M extends RpcMethod> {
  jsonrpc: '2.0';
  id: string;
  method: M;
  params: RpcMethods[M]['params'];
}

type RpcResponse<M extends RpcMethod> =
  | { jsonrpc: '2.0'; id: string; result: RpcMethods[M]['result'] }
  | { jsonrpc: '2.0'; id: string; error: { code: number; message: string } };

let sequence = 0;

export async function rpcCall<M extends RpcMethod>(
  method: M,
  params: RpcMethods[M]['params'],
  signal?: AbortSignal,
): Promise<RpcMethods[M]['result']> {
  sequence += 1;
  const envelope: RpcEnvelope<M> = { jsonrpc: '2.0', id: `rpc-${sequence}`, method, params };
  // Read-only RPC methods are safe to retry; mutating methods would need an idempotency key.
  const response = await apiRequest<RpcResponse<M>>('POST', '/rpc', {
    body: envelope,
    signal,
    idempotencyKey: method.endsWith('.list') || method === 'system.ping' ? `rpc-read-${envelope.id}` : undefined,
  });
  if ('error' in response) {
    throw new ApiError(response.error.code === -32001 ? 403 : 500, { code: 'RPC_ERROR', message: response.error.message }, envelope.id);
  }
  return response.result;
}
