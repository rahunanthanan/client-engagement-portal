import type {
  AttachmentRecord,
  ClientSummary,
  CreateRequestBody,
  DefinitionKind,
  DefinitionRecord,
  DecisionOutcome,
  FormSchemaResponse,
  LookupOption,
  Page,
  RequestCategory,
  RequestRecord,
  RequestStatus,
  RequestSummary,
  SaveDraftBody,
  SaveDraftResponse,
  SearchResult,
  SubmitRequestBody,
  TaskActionBody,
  TaskRecord,
} from './contracts';
import { apiRequest } from './httpClient';
import { rpcCall } from './rpcAdapter';

/** One function per backend operation. Components never call `fetch` directly. */
export const api = {
  searchClients: (q: string, page: number, pageSize: number, signal?: AbortSignal) =>
    apiRequest<Page<ClientSummary>>('GET', '/clients', { query: { q, page, pageSize }, signal }),

  getClient: (clientId: string, signal?: AbortSignal) =>
    apiRequest<ClientSummary>('GET', `/clients/${encodeURIComponent(clientId)}`, { signal }),

  getCatalog: (signal?: AbortSignal) => apiRequest<RequestCategory[]>('GET', '/catalog', { signal }),

  getFormSchema: (schemaId: string, version: number, signal?: AbortSignal) =>
    apiRequest<FormSchemaResponse>('GET', `/form-schemas/${encodeURIComponent(schemaId)}/versions/${version}`, { signal }),

  getLookup: (lookup: string, parent: string | undefined, signal?: AbortSignal) =>
    apiRequest<LookupOption[]>('GET', `/lookups/${encodeURIComponent(lookup)}`, { query: { parent }, signal }),

  searchLookup: (lookup: string, q: string, signal?: AbortSignal) =>
    apiRequest<SearchResult[]>('GET', `/lookups/${encodeURIComponent(lookup)}/search`, { query: { q }, signal }),

  listRequests: (params: { page: number; pageSize: number; status?: RequestStatus | 'OPEN_DRAFTS'; mine?: boolean }, signal?: AbortSignal) =>
    apiRequest<Page<RequestSummary>>('GET', '/requests', { query: params, signal }),

  getRequest: (requestId: string, signal?: AbortSignal) =>
    apiRequest<RequestRecord>('GET', `/requests/${encodeURIComponent(requestId)}`, { signal }),

  createRequest: (body: CreateRequestBody, idempotencyKey: string) =>
    apiRequest<RequestRecord>('POST', '/requests', { body, idempotencyKey }),

  /** Draft saves are idempotent per (requestId, editorSessionId, clientSeq), so retries are safe. */
  saveDraft: (requestId: string, body: SaveDraftBody) =>
    apiRequest<SaveDraftResponse>('PUT', `/requests/${encodeURIComponent(requestId)}/draft`, {
      body,
      idempotencyKey: `${requestId}:${body.editorSessionId}:${body.clientSeq}`,
    }),

  submitRequest: (requestId: string, body: SubmitRequestBody, idempotencyKey: string) =>
    apiRequest<RequestRecord>('POST', `/requests/${encodeURIComponent(requestId)}/submit`, { body, idempotencyKey }),

  uploadAttachment: (requestId: string, documentType: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('documentType', documentType);
    return apiRequest<AttachmentRecord>('POST', `/requests/${encodeURIComponent(requestId)}/attachments`, { body: form });
  },

  getDecision: (requestId: string, signal?: AbortSignal) =>
    apiRequest<DecisionOutcome | null>('GET', `/requests/${encodeURIComponent(requestId)}/decision`, { signal }),

  listTasks: (signal?: AbortSignal) => apiRequest<TaskRecord[]>('GET', '/tasks', { query: { assignee: 'me' }, signal }),

  getTask: (taskId: string, signal?: AbortSignal) => apiRequest<TaskRecord>('GET', `/tasks/${encodeURIComponent(taskId)}`, { signal }),

  completeTask: (taskId: string, body: TaskActionBody, idempotencyKey: string) =>
    apiRequest<RequestRecord>('POST', `/tasks/${encodeURIComponent(taskId)}/actions`, { body, idempotencyKey }),

  listAudit: (requestId: string, page: number, pageSize: number, signal?: AbortSignal) =>
    rpcCall('audit.list', { requestId, page, pageSize }, signal),

  listDefinitions: (signal?: AbortSignal) => apiRequest<DefinitionRecord[]>('GET', '/definitions', { signal }),

  getDefinition: (kind: DefinitionKind, definitionId: string, signal?: AbortSignal) =>
    apiRequest<DefinitionRecord>('GET', `/definitions/${kind}/${encodeURIComponent(definitionId)}`, { signal }),

  saveDefinitionDraft: (kind: DefinitionKind, definitionId: string, content: string, baseVersion: number) =>
    apiRequest<DefinitionRecord>('PUT', `/definitions/${kind}/${encodeURIComponent(definitionId)}`, { body: { content, baseVersion } }),

  approveDefinition: (kind: DefinitionKind, definitionId: string, idempotencyKey: string) =>
    apiRequest<DefinitionRecord>('POST', `/definitions/${kind}/${encodeURIComponent(definitionId)}/approve`, { idempotencyKey }),
};

export const queryKeys = {
  clients: (q: string, page: number) => ['clients', 'search', q, page] as const,
  client: (clientId: string) => ['clients', clientId] as const,
  catalog: () => ['catalog'] as const,
  schema: (schemaId: string, version: number) => ['schemas', schemaId, version] as const,
  lookup: (lookup: string, parent: string | undefined) => ['lookups', lookup, parent ?? null] as const,
  lookupSearch: (lookup: string, q: string) => ['lookups', lookup, 'search', q] as const,
  requests: (params: object) => ['requests', 'list', params] as const,
  requestsAll: () => ['requests'] as const,
  request: (requestId: string) => ['requests', 'detail', requestId] as const,
  decision: (requestId: string) => ['requests', 'detail', requestId, 'decision'] as const,
  audit: (requestId: string, page: number) => ['requests', 'detail', requestId, 'audit', page] as const,
  tasks: () => ['tasks'] as const,
  task: (taskId: string) => ['tasks', taskId] as const,
  definitions: () => ['definitions'] as const,
  definition: (kind: DefinitionKind, id: string) => ['definitions', kind, id] as const,
};
