import { delay, http, HttpResponse, type DefaultBodyType, type HttpResponseResolver, type StrictRequest } from 'msw';
import type {
  ApiErrorBody,
  CreateRequestBody,
  DefinitionKind,
  RequestRecord,
  RequestSummary,
  Role,
  SaveDraftBody,
  SaveDraftResponse,
  SubmitRequestBody,
  TaskActionBody,
} from '@/api/contracts';
import { DEMO_USERS } from '@/auth/DemoIdentityAdapter';
import { hasPermission, type Permission } from '@/auth/permissions';
import { validateForm } from '@/forms/engine/validation';
import { addAudit, getDb, nextAttachmentId, nextRequestId, nextTaskId, persistDb, type StoredRequest } from './db';
import { COUNTRIES, REGIONS, SECTORS, STAFF, SUB_SECTORS } from './data/lookups';
import { evaluateRiskTier } from './riskDecision';
import { getScenarios, setScenarios } from './scenarios';
import { CATALOG, findSchema } from './schemas';

/**
 * SIMULATED BACKEND (Mock Service Worker). Every endpoint enforces its own authorization,
 * revision checks and idempotency, because that is what a real backend must do — the UI's checks
 * are only a convenience. Nothing here talks to a real system.
 */

const API = '*/api';

interface Actor {
  userId: string;
  name: string;
  role: Role;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

const correlationOf = (request: Request) => request.headers.get('X-Correlation-ID') ?? 'none';

function errorResponse(request: Request, status: number, code: string, message: string, extra: Partial<ApiErrorBody> = {}) {
  return HttpResponse.json<ApiErrorBody>(
    { code, message, correlationId: correlationOf(request), ...extra },
    { status, headers: { 'X-Correlation-ID': correlationOf(request) } },
  );
}

function authenticate(request: Request): Actor {
  const scenarios = getScenarios();
  if (scenarios.expireSessionOnNextCall) {
    setScenarios({ expireSessionOnNextCall: false });
    throw new HttpError(401, { code: 'SESSION_EXPIRED', message: 'Your session has expired.' });
  }
  const userId = request.headers.get('X-Demo-User');
  const user = Object.values(DEMO_USERS).find((u) => u.userId === userId);
  if (!user) throw new HttpError(401, { code: 'UNAUTHENTICATED', message: 'Sign in required.' });
  return { userId: user.userId, name: user.displayName.replace(/ \(.*\)$/, ''), role: user.role };
}

function authorize(request: Request, permission: Permission): Actor {
  const actor = authenticate(request);
  if (!hasPermission(actor.role, permission)) {
    throw new HttpError(403, { code: 'FORBIDDEN', message: `Role ${actor.role} may not perform ${permission}.` });
  }
  return actor;
}

/** Wraps a resolver with latency, error mapping and correlation-id echo. */
function handle<P = Record<string, string>>(
  resolver: (args: { request: StrictRequest<DefaultBodyType>; params: P }) => Promise<Response> | Response,
): HttpResponseResolver {
  return async ({ request, params }) => {
    const { latencyMs } = getScenarios();
    if (latencyMs) await delay(latencyMs);
    try {
      return await resolver({ request, params: params as unknown as P });
    } catch (error) {
      if (error instanceof HttpError) return errorResponse(request, error.status, error.body.code, error.body.message, error.body);
      console.error('[msw] unexpected error', error);
      return errorResponse(request, 500, 'INTERNAL', 'Unexpected server error (simulated).');
    }
  };
}

/** Replays the stored response for a repeated Idempotency-Key (duplicate-submission protection). */
function idempotent(request: Request, scope: string, produce: () => { status: number; body: unknown }) {
  const key = request.headers.get('Idempotency-Key');
  const db = getDb();
  const storeKey = key ? `${scope}:${key}` : null;
  if (storeKey && db.idempotency[storeKey]) {
    const stored = db.idempotency[storeKey]!;
    return HttpResponse.json(stored.body as Record<string, unknown>, { status: stored.status, headers: { 'Idempotent-Replay': 'true' } });
  }
  const result = produce();
  // Only successful outcomes are replayed; a conflict or validation failure must be re-evaluated on retry.
  if (storeKey && result.status < 300) db.idempotency[storeKey] = result;
  persistDb();
  return HttpResponse.json(result.body as Record<string, unknown>, { status: result.status });
}

function getRequestOr404(id: string): StoredRequest {
  const record = getDb().requests[id];
  if (!record) throw new HttpError(404, { code: 'NOT_FOUND', message: 'Request not found.' });
  return record;
}

function canView(actor: Actor, record: StoredRequest) {
  if (actor.role === 'CLIENT_ADVISOR' && record.createdBy !== actor.userId) {
    throw new HttpError(403, { code: 'FORBIDDEN', message: 'This request belongs to another advisor.' });
  }
}

function publicRecord(record: StoredRequest): RequestRecord {
  const { lastEditorSessionId: _a, lastClientSeq: _b, ...rest } = record;
  return rest;
}

const EDITABLE = new Set(['DRAFT', 'RETURNED']);

/** Same editor may fast-forward its own concurrent saves; anyone else must be on the current revision. */
function revisionAccepted(record: StoredRequest, baseRevision: number, editorSessionId: string, clientSeq?: number) {
  if (baseRevision === record.revision) return true;
  return record.lastEditorSessionId === editorSessionId && (clientSeq === undefined || clientSeq > (record.lastClientSeq ?? 0));
}

function simulateColleagueEdit(record: StoredRequest) {
  record.revision += 1;
  record.values = { ...record.values, legalName: `${String(record.values.legalName ?? record.clientName)} (edited by colleague)` };
  record.updatedBy = 'Casey Morgan (fictional colleague)';
  record.updatedAt = new Date().toISOString();
  record.lastEditorSessionId = 'editor-colleague';
  record.lastClientSeq = 1;
  addAudit(record.requestId, record.updatedBy, 'DRAFT_SAVED', `Draft saved by colleague (revision ${record.revision})`);
}

function paginate<T>(items: T[], url: URL) {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') ?? 10)));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: items.length };
}

export const handlers = [
  /* ------------------------------ clients ------------------------------ */
  http.get(
    `${API}/clients`,
    handle(async ({ request }) => {
      authorize(request, 'client:search');
      const url = new URL(request.url);
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
      if (getScenarios().searchJitter) await delay(Math.floor(Math.random() * 900));
      const matches = getDb().clients.filter((c) => !q || c.displayName.toLowerCase().includes(q) || c.clientId.toLowerCase().includes(q));
      return HttpResponse.json(paginate(matches, url));
    }),
  ),
  http.get(
    `${API}/clients/:clientId`,
    handle<{ clientId: string }>(({ request, params }) => {
      authenticate(request);
      const client = getDb().clients.find((c) => c.clientId === params.clientId);
      return client ? HttpResponse.json(client) : errorResponse(request, 404, 'NOT_FOUND', 'Client not found.');
    }),
  ),

  /* ------------------------- catalogue & schemas ------------------------ */
  http.get(
    `${API}/catalog`,
    handle(({ request }) => {
      authenticate(request);
      return HttpResponse.json(CATALOG);
    }),
  ),
  http.get(
    `${API}/form-schemas/:schemaId/versions/:version`,
    handle<{ schemaId: string; version: string }>(({ request, params }) => {
      authenticate(request);
      const schema = findSchema(params.schemaId, Number(params.version));
      if (!schema) return errorResponse(request, 404, 'NOT_FOUND', 'Schema version not found.');
      // Published schema versions are immutable, so they can be cached aggressively.
      return HttpResponse.json(schema, { headers: { 'Cache-Control': 'private, max-age=31536000, immutable' } });
    }),
  ),

  /* ------------------------------ lookups ------------------------------ */
  http.get(
    `${API}/lookups/:name/search`,
    handle<{ name: string }>(({ request, params }) => {
      authenticate(request);
      const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
      if (params.name !== 'staff') return errorResponse(request, 404, 'NOT_FOUND', 'Unknown search lookup.');
      return HttpResponse.json(STAFF.filter((s) => s.label.toLowerCase().includes(q)).slice(0, 8));
    }),
  ),
  http.get(
    `${API}/lookups/:name`,
    handle<{ name: string }>(({ request, params }) => {
      authenticate(request);
      const parent = new URL(request.url).searchParams.get('parent') ?? '';
      switch (params.name) {
        case 'countries':
          return HttpResponse.json(COUNTRIES);
        case 'regions':
          return HttpResponse.json(REGIONS[parent] ?? []);
        case 'sectors':
          return HttpResponse.json(SECTORS);
        case 'subSectors':
          return HttpResponse.json(SUB_SECTORS[parent] ?? []);
        default:
          return errorResponse(request, 404, 'NOT_FOUND', 'Unknown lookup.');
      }
    }),
  ),

  /* ------------------------------ requests ----------------------------- */
  http.get(
    `${API}/requests`,
    handle(({ request }) => {
      const actor = authorize(request, 'request:view');
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const mine = url.searchParams.get('mine') === 'true';
      const items = Object.values(getDb().requests)
        // Advisors only ever see their own requests; `mine` narrows the list for other roles.
        .filter((r) => (actor.role === 'CLIENT_ADVISOR' || mine ? r.createdBy === actor.userId : true))
        .filter((r) => (!status ? true : status === 'OPEN_DRAFTS' ? EDITABLE.has(r.status) : r.status === status))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map<RequestSummary>(({ requestId, clientName, requestTypeLabel, status: s, updatedAt, revision, category, requestType }) => ({
          requestId,
          clientName,
          requestTypeLabel,
          status: s,
          updatedAt,
          revision,
          category,
          requestType,
        }));
      return HttpResponse.json(paginate(items, url));
    }),
  ),
  http.get(
    `${API}/requests/:requestId`,
    handle<{ requestId: string }>(({ request, params }) => {
      const actor = authorize(request, 'request:view');
      const record = getRequestOr404(params.requestId);
      canView(actor, record);
      return HttpResponse.json(publicRecord(record));
    }),
  ),
  http.post(
    `${API}/requests`,
    handle(async ({ request }) => {
      const actor = authorize(request, 'request:create');
      const body = (await request.json()) as CreateRequestBody;
      return idempotent(request, `create:${actor.userId}`, () => {
        const db = getDb();
        const client = db.clients.find((c) => c.clientId === body.clientId);
        const type = CATALOG.find((c) => c.category === body.category)?.types.find((t) => t.requestType === body.requestType);
        if (!client || !type) return { status: 422, body: { code: 'INVALID', message: 'Unknown client or request type.' } };
        if (!type.clientTypes.includes(client.clientType)) {
          return { status: 422, body: { code: 'INVALID', message: `${type.label} is not available for ${client.clientType.toLowerCase()} clients.` } };
        }
        const id = nextRequestId();
        const now = new Date().toISOString();
        const record: StoredRequest = {
          requestId: id,
          clientId: client.clientId,
          clientName: client.displayName,
          category: body.category,
          requestType: body.requestType,
          requestTypeLabel: type.label,
          schemaId: type.schemaId,
          schemaVersion: type.latestVersion,
          status: 'DRAFT',
          revision: 1,
          values: {},
          createdBy: actor.userId,
          updatedBy: actor.name,
          updatedAt: now,
          workflow: { processKey: 'client-request-process', processVersion: 4, currentActivityId: 'Task_CaptureRequest', completedActivityIds: ['StartEvent_Submitted'] },
        };
        db.requests[id] = record;
        addAudit(id, actor.name, 'CREATED', `${type.label} created`);
        return { status: 201, body: publicRecord(record) };
      });
    }),
  ),
  http.put(
    `${API}/requests/:requestId/draft`,
    handle<{ requestId: string }>(async ({ request, params }) => {
      const actor = authorize(request, 'request:edit');
      const body = (await request.json()) as SaveDraftBody;
      const scenarios = getScenarios();

      if (scenarios.saveFailure === 'persistent') return errorResponse(request, 500, 'SAVE_FAILED', 'Draft service unavailable (simulated).');
      if (scenarios.saveFailure === 'transient') {
        setScenarios({ saveFailure: 'none' });
        return errorResponse(request, 503, 'UNAVAILABLE', 'Temporarily unavailable (simulated).');
      }

      const responseDelay = scenarios.delayNextSaveResponseMs;
      if (responseDelay) setScenarios({ delayNextSaveResponseMs: 0 });

      const record = getRequestOr404(params.requestId);
      canView(actor, record);
      if (!EDITABLE.has(record.status)) return errorResponse(request, 409, 'NOT_EDITABLE', 'This request has already been submitted.');

      if (scenarios.conflictOnNextSave) {
        setScenarios({ conflictOnNextSave: false });
        simulateColleagueEdit(record);
      }

      const result = idempotent(request, `draft:${params.requestId}`, () => {
        if (!revisionAccepted(record, body.baseRevision, body.editorSessionId, body.clientSeq)) {
          if (record.lastEditorSessionId === body.editorSessionId) {
            // An older save from this editor arrived after a newer one: acknowledge without applying.
            return { status: 200, body: { requestId: record.requestId, revision: record.revision, clientSeq: body.clientSeq, savedAt: record.updatedAt } satisfies SaveDraftResponse };
          }
          return {
            status: 409,
            body: {
              code: 'REVISION_CONFLICT',
              message: 'This draft was changed by someone else.',
              correlationId: correlationOf(request),
              details: { currentRevision: record.revision, serverValues: record.values, updatedBy: record.updatedBy, updatedAt: record.updatedAt },
            },
          };
        }
        record.values = body.values;
        record.revision += 1;
        record.updatedAt = new Date().toISOString();
        record.updatedBy = actor.name;
        record.lastEditorSessionId = body.editorSessionId;
        record.lastClientSeq = Math.max(record.lastClientSeq ?? 0, body.clientSeq);
        addAudit(record.requestId, actor.name, 'DRAFT_SAVED', `Draft saved (revision ${record.revision})`);
        return { status: 200, body: { requestId: record.requestId, revision: record.revision, clientSeq: body.clientSeq, savedAt: record.updatedAt } satisfies SaveDraftResponse };
      });

      // Processing happened above, in arrival order; only the RESPONSE is delayed.
      if (responseDelay) await delay(responseDelay);
      return result;
    }),
  ),
  http.post(
    `${API}/requests/:requestId/submit`,
    handle<{ requestId: string }>(async ({ request, params }) => {
      const actor = authorize(request, 'request:submit');
      const body = (await request.json()) as SubmitRequestBody;
      const record = getRequestOr404(params.requestId);
      canView(actor, record);

      return idempotent(request, `submit:${params.requestId}`, () => {
        if (!EDITABLE.has(record.status)) {
          return { status: 409, body: { code: 'ALREADY_SUBMITTED', message: 'This request has already been submitted.' } };
        }
        if (!revisionAccepted(record, body.baseRevision, body.editorSessionId)) {
          return {
            status: 409,
            body: {
              code: 'REVISION_CONFLICT',
              message: 'This draft was changed by someone else.',
              details: { currentRevision: record.revision, serverValues: record.values, updatedBy: record.updatedBy, updatedAt: record.updatedAt },
            },
          };
        }
        const schema = findSchema(record.schemaId, record.schemaVersion)!;
        const validation = validateForm(schema, body.values, 'submit');
        const fieldErrors: Record<string, string> = { ...validation.fieldErrors };
        // Server-only rules (the client cannot know these).
        if (body.values.registrationNumber === 'TAKEN123') {
          fieldErrors.registrationNumber = 'This registration number is already linked to another client (simulated check).';
        }
        if (getScenarios().rejectNextSubmission) {
          setScenarios({ rejectNextSubmission: false });
          fieldErrors.taxIdentificationNumber = 'Tax identification number failed the external verification check (simulated).';
        }
        const formErrors = [...validation.formErrors, ...Object.values(validation.sectionErrors).flat()];
        if (Object.keys(fieldErrors).length || formErrors.length) {
          return { status: 422, body: { code: 'VALIDATION_FAILED', message: 'The request has errors. Correct them and submit again.', fieldErrors, details: { formErrors } } };
        }

        const now = new Date().toISOString();
        const decision = evaluateRiskTier(body.values);
        const taskId = nextTaskId();
        record.values = body.values;
        record.revision += 1;
        record.status = 'IN_REVIEW';
        record.submittedAt = now;
        record.updatedAt = now;
        record.updatedBy = actor.name;
        record.decision = decision;
        record.currentTaskId = taskId;
        record.reviewerComment = undefined;
        record.workflow = {
          ...record.workflow,
          currentActivityId: 'Task_OperationsReview',
          completedActivityIds: [...new Set([...record.workflow.completedActivityIds, 'Task_CaptureRequest', 'Task_RiskDecision'])],
        };
        getDb().tasks[taskId] = {
          taskId,
          requestId: record.requestId,
          clientName: record.clientName,
          requestTypeLabel: record.requestTypeLabel,
          activityId: 'Task_OperationsReview',
          name: decision.outputs.reviewLevel === 'SENIOR' ? 'Senior operations review' : 'Operations review',
          assignee: 'u-reviewer-01',
          status: 'OPEN',
          version: 1,
          createdAt: now,
          reviewLevel: decision.outputs.reviewLevel,
        };
        addAudit(record.requestId, actor.name, 'SUBMITTED', 'Submitted for review');
        addAudit(record.requestId, 'Decision service', 'DECISION_EVALUATED', `Risk tier ${decision.outputs.riskTier}, ${decision.outputs.reviewLevel} review (${decision.matchedRuleIds.join(', ')})`);
        return { status: 200, body: publicRecord(record) };
      });
    }),
  ),
  http.post(
    `${API}/requests/:requestId/attachments`,
    handle<{ requestId: string }>(async ({ request, params }) => {
      const actor = authorize(request, 'request:edit');
      const record = getRequestOr404(params.requestId);
      canView(actor, record);
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return errorResponse(request, 422, 'INVALID', 'No file received.');
      const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
      if (!allowed.includes(file.type)) return errorResponse(request, 415, 'UNSUPPORTED_TYPE', 'Only PDF, PNG or JPEG files are accepted.');
      if (file.size > 5 * 1024 * 1024) return errorResponse(request, 413, 'TOO_LARGE', 'Files must be 5 MB or smaller.');
      const id = nextAttachmentId();
      const attachment = { attachmentId: id, fileName: file.name.slice(0, 120), sizeBytes: file.size, contentType: file.type, scanStatus: 'CLEAN' as const };
      getDb().attachments[id] = { ...attachment, requestId: record.requestId };
      persistDb();
      return HttpResponse.json(attachment, { status: 201 });
    }),
  ),
  http.get(
    `${API}/requests/:requestId/decision`,
    handle<{ requestId: string }>(({ request, params }) => {
      const actor = authorize(request, 'request:view');
      const record = getRequestOr404(params.requestId);
      canView(actor, record);
      return HttpResponse.json(record.decision ?? null);
    }),
  ),

  /* -------------------------------- tasks ------------------------------ */
  http.get(
    `${API}/tasks`,
    handle(({ request }) => {
      const actor = authorize(request, 'task:view');
      return HttpResponse.json(Object.values(getDb().tasks).filter((t) => t.assignee === actor.userId && t.status === 'OPEN'));
    }),
  ),
  http.get(
    `${API}/tasks/:taskId`,
    handle<{ taskId: string }>(({ request, params }) => {
      authorize(request, 'task:view');
      const task = getDb().tasks[params.taskId];
      return task ? HttpResponse.json(task) : errorResponse(request, 404, 'NOT_FOUND', 'Task not found.');
    }),
  ),
  http.post(
    `${API}/tasks/:taskId/actions`,
    handle<{ taskId: string }>(async ({ request, params }) => {
      const actor = authorize(request, 'task:act');
      const body = (await request.json()) as TaskActionBody;
      if (getScenarios().denyNextTaskAction) {
        setScenarios({ denyNextTaskAction: false });
        return errorResponse(request, 403, 'TASK_REASSIGNED', 'This task has been reassigned to another reviewer (simulated).');
      }
      return idempotent(request, `task:${params.taskId}`, () => {
        const db = getDb();
        const task = db.tasks[params.taskId];
        if (!task) return { status: 404, body: { code: 'NOT_FOUND', message: 'Task not found.' } };
        if (task.status !== 'OPEN') return { status: 409, body: { code: 'TASK_CLOSED', message: 'This task is already completed.' } };
        if (task.version !== body.taskVersion) return { status: 409, body: { code: 'STALE_TASK', message: 'The task changed. Reload and try again.' } };
        const comment = body.comment?.trim() ?? '';
        if ((body.action !== 'APPROVE' || task.reviewLevel === 'SENIOR') && comment.length < 10) {
          return {
            status: 422,
            body: {
              code: 'VALIDATION_FAILED',
              message: body.action === 'APPROVE' ? 'Senior approval needs a comment of at least 10 characters.' : 'Give a reason of at least 10 characters.',
              fieldErrors: { comment: 'Enter at least 10 characters.' },
            },
          };
        }
        const record = db.requests[task.requestId]!;
        const done = new Set([...record.workflow.completedActivityIds, 'Task_OperationsReview', 'Gateway_Outcome']);
        if (body.action === 'APPROVE') {
          record.status = 'APPROVED';
          record.workflow = { ...record.workflow, currentActivityId: null, completedActivityIds: [...done, 'Task_Fulfil', 'End_Approved'] };
        } else if (body.action === 'REJECT') {
          record.status = 'REJECTED';
          record.workflow = { ...record.workflow, currentActivityId: null, completedActivityIds: [...done, 'End_Rejected'] };
        } else {
          record.status = 'RETURNED';
          record.workflow = { ...record.workflow, currentActivityId: 'Task_CaptureRequest', completedActivityIds: [...done] };
        }
        record.reviewerComment = comment || undefined;
        record.revision += 1;
        record.updatedAt = new Date().toISOString();
        record.updatedBy = actor.name;
        record.currentTaskId = undefined;
        task.status = 'COMPLETED';
        task.version += 1;
        addAudit(record.requestId, actor.name, body.action === 'RETURN' ? 'RETURNED' : 'TASK_COMPLETED', `${task.name}: ${body.action.toLowerCase()}`);
        return { status: 200, body: publicRecord(record) };
      });
    }),
  ),

  /* ------------------------------- RPC --------------------------------- */
  http.post(
    `${API}/rpc`,
    handle(async ({ request }) => {
      const envelope = (await request.json()) as { id: string; method: string; params: Record<string, unknown> };
      const actor = authenticate(request);
      if (envelope.method === 'system.ping') {
        return HttpResponse.json({ jsonrpc: '2.0', id: envelope.id, result: { ok: true, serverTime: new Date().toISOString() } });
      }
      if (envelope.method === 'audit.list') {
        if (!hasPermission(actor.role, 'request:view')) {
          return HttpResponse.json({ jsonrpc: '2.0', id: envelope.id, error: { code: -32001, message: 'Forbidden' } });
        }
        const { requestId, page, pageSize } = envelope.params as { requestId: string; page: number; pageSize: number };
        const record = getRequestOr404(requestId);
        canView(actor, record);
        const events = getDb().audit.filter((e) => e.requestId === requestId).sort((a, b) => b.at.localeCompare(a.at));
        const url = new URL(`http://x/?page=${page}&pageSize=${pageSize}`);
        return HttpResponse.json({ jsonrpc: '2.0', id: envelope.id, result: paginate(events, url) });
      }
      return HttpResponse.json({ jsonrpc: '2.0', id: envelope.id, error: { code: -32601, message: 'Method not found' } });
    }),
  ),

  /* ---------------------------- definitions ---------------------------- */
  http.get(
    `${API}/definitions`,
    handle(({ request }) => {
      authorize(request, 'definition:view');
      return HttpResponse.json(getDb().definitions.map(({ content: _c, ...rest }) => ({ ...rest, content: '' })));
    }),
  ),
  http.get(
    `${API}/definitions/:kind/:id`,
    handle<{ kind: string; id: string }>(({ request, params }) => {
      // Approved process/decision definitions are readable by anyone who can view requests (for diagrams).
      const actor = authenticate(request);
      if (!hasPermission(actor.role, 'definition:view') && !hasPermission(actor.role, 'request:view')) {
        return errorResponse(request, 403, 'FORBIDDEN', 'Not allowed.');
      }
      const def = getDb().definitions.find((d) => d.kind === (params.kind as DefinitionKind) && d.definitionId === params.id);
      return def ? HttpResponse.json(def) : errorResponse(request, 404, 'NOT_FOUND', 'Definition not found.');
    }),
  ),
  http.put(
    `${API}/definitions/:kind/:id`,
    handle<{ kind: string; id: string }>(async ({ request, params }) => {
      const actor = authorize(request, 'definition:edit');
      const body = (await request.json()) as { content: string; baseVersion: number };
      const def = getDb().definitions.find((d) => d.kind === params.kind && d.definitionId === params.id);
      if (!def) return errorResponse(request, 404, 'NOT_FOUND', 'Definition not found.');
      if (def.version !== body.baseVersion) return errorResponse(request, 409, 'REVISION_CONFLICT', 'The definition changed. Reload and try again.');
      if (body.content.length > 500_000) return errorResponse(request, 413, 'TOO_LARGE', 'Definition is too large.');
      Object.assign(def, { content: body.content, status: 'DRAFT', updatedAt: new Date().toISOString(), updatedBy: actor.name });
      persistDb();
      return HttpResponse.json(def);
    }),
  ),
  http.post(
    `${API}/definitions/:kind/:id/approve`,
    handle<{ kind: string; id: string }>(({ request, params }) => {
      const actor = authorize(request, 'definition:approve');
      return idempotent(request, `approve:${params.kind}:${params.id}`, () => {
        const def = getDb().definitions.find((d) => d.kind === params.kind && d.definitionId === params.id);
        if (!def) return { status: 404, body: { code: 'NOT_FOUND', message: 'Definition not found.' } };
        if (def.status === 'APPROVED') return { status: 409, body: { code: 'NOTHING_TO_APPROVE', message: 'There is no draft to approve.' } };
        Object.assign(def, { status: 'APPROVED', version: def.version + 1, updatedAt: new Date().toISOString(), updatedBy: actor.name });
        return { status: 200, body: def };
      });
    }),
  ),
];
