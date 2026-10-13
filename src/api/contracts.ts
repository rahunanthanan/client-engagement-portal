import type { FormSchema, FormValues } from '@/forms/schema/types';

/**
 * Typed API contracts shared by the client and the simulated backend (MSW).
 * In a real system these would be generated from an OpenAPI document owned by the backend team.
 */

export type Role = 'CLIENT_ADVISOR' | 'OPERATIONS_REVIEWER' | 'ADMINISTRATOR';

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  correlationId?: string;
  fieldErrors?: Record<string, string>;
  details?: Record<string, unknown>;
}

/* Clients */
export type ClientType = 'INDIVIDUAL' | 'CORPORATE';

export interface ClientSummary {
  clientId: string;
  displayName: string;
  clientType: ClientType;
  segment: 'Private' | 'Business' | 'Institutional';
  countryCode: string;
  relationshipManager: string;
}

/* Catalogue & schemas */
export interface RequestTypeDefinition {
  requestType: string;
  label: string;
  clientTypes: ClientType[];
  schemaId: string;
  latestVersion: number;
}

export interface RequestCategory {
  category: string;
  label: string;
  types: RequestTypeDefinition[];
}

export type FormSchemaResponse = FormSchema;

/* Requests */
export type RequestStatus = 'DRAFT' | 'IN_REVIEW' | 'RETURNED' | 'APPROVED' | 'REJECTED';

export interface WorkflowState {
  processKey: string;
  processVersion: number;
  currentActivityId: string | null;
  completedActivityIds: string[];
}

export interface DecisionOutcome {
  decisionKey: string;
  decisionVersion: number;
  matchedRuleIds: string[];
  outputs: { riskTier: 'LOW' | 'MEDIUM' | 'HIGH'; reviewLevel: 'STANDARD' | 'SENIOR' };
  inputs: Record<string, unknown>;
  evaluatedAt: string;
}

export interface RequestRecord {
  requestId: string;
  clientId: string;
  clientName: string;
  category: string;
  requestType: string;
  requestTypeLabel: string;
  schemaId: string;
  schemaVersion: number;
  status: RequestStatus;
  revision: number;
  values: FormValues;
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
  submittedAt?: string;
  workflow: WorkflowState;
  decision?: DecisionOutcome;
  currentTaskId?: string;
  reviewerComment?: string;
}

export type RequestSummary = Pick<
  RequestRecord,
  'requestId' | 'clientName' | 'requestTypeLabel' | 'status' | 'updatedAt' | 'revision' | 'category' | 'requestType'
>;

export interface CreateRequestBody {
  clientId: string;
  category: string;
  requestType: string;
}

export interface SaveDraftBody {
  baseRevision: number;
  clientSeq: number;
  editorSessionId: string;
  values: FormValues;
}

export interface SaveDraftResponse {
  requestId: string;
  revision: number;
  clientSeq: number;
  savedAt: string;
}

/** Body of a 409 returned when someone else changed the draft. */
export interface RevisionConflictDetails {
  currentRevision: number;
  serverValues: FormValues;
  updatedBy: string;
  updatedAt: string;
}

export interface SubmitRequestBody {
  baseRevision: number;
  editorSessionId: string;
  values: FormValues;
}

/* Attachments */
export interface AttachmentRecord {
  attachmentId: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  scanStatus: 'PENDING' | 'CLEAN';
}

/* Tasks */
export type TaskAction = 'APPROVE' | 'REJECT' | 'RETURN';

export interface TaskRecord {
  taskId: string;
  requestId: string;
  clientName: string;
  requestTypeLabel: string;
  activityId: string;
  name: string;
  assignee: string;
  status: 'OPEN' | 'COMPLETED';
  version: number;
  createdAt: string;
  reviewLevel: 'STANDARD' | 'SENIOR';
}

export interface TaskActionBody {
  action: TaskAction;
  comment?: string;
  taskVersion: number;
}

/* Audit */
export interface AuditEvent {
  eventId: string;
  requestId: string;
  at: string;
  actor: string;
  type: 'CREATED' | 'DRAFT_SAVED' | 'SUBMITTED' | 'DECISION_EVALUATED' | 'TASK_COMPLETED' | 'RETURNED' | 'COMMENT';
  summary: string;
}

/* Lookups */
export interface LookupOption {
  value: string;
  label: string;
}

export interface SearchResult {
  id: string;
  label: string;
  detail?: string;
}

/* Definitions (admin) */
export type DefinitionKind = 'form' | 'process' | 'decision' | 'formjs';

export interface DefinitionRecord {
  kind: DefinitionKind;
  definitionId: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'APPROVED';
  updatedAt: string;
  updatedBy: string;
  content: string;
}
