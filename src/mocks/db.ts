import type {
  AttachmentRecord,
  AuditEvent,
  ClientSummary,
  DefinitionRecord,
  RequestRecord,
  TaskRecord,
} from '@/api/contracts';
import { clientRequestProcessXml, CLIENT_REQUEST_PROCESS_KEY } from '@/features/workflow/definitions/clientRequestProcess';
import { riskTierDecisionXml, RISK_DECISION_KEY } from '@/features/workflow/definitions/riskTierDecision';
import { supplementaryQuestionnaireSchema, SUPPLEMENTARY_FORM_ID } from '@/features/workflow/definitions/supplementaryQuestionnaire';
import { generateClients } from './data/clients';
import { evaluateRiskTier } from './riskDecision';
import { SCHEMAS } from './schemas';

/**
 * In-memory database for the SIMULATED backend. Every record is fictional.
 * In the browser it is mirrored to localStorage (demo only) so a reload keeps the demo state.
 */

export interface StoredRequest extends RequestRecord {
  lastEditorSessionId?: string;
  lastClientSeq?: number;
}

export interface StoredResponse {
  status: number;
  body: unknown;
}

export interface Db {
  clients: ClientSummary[];
  requests: Record<string, StoredRequest>;
  tasks: Record<string, TaskRecord>;
  audit: AuditEvent[];
  attachments: Record<string, AttachmentRecord & { requestId: string }>;
  definitions: DefinitionRecord[];
  idempotency: Record<string, StoredResponse>;
  counters: { request: number; task: number; event: number; attachment: number };
}

const STORAGE_KEY = 'cep.demo.db.v1';
const ADVISOR = 'u-advisor-01';
const REVIEWER = 'u-reviewer-01';

const iso = (daysAgo: number, hour = 10) => {
  const d = new Date(Date.UTC(2026, 9, 12 - daysAgo, hour, 15, 0));
  return d.toISOString();
};

function seed(): Db {
  const clients = generateClients();
  const db: Db = {
    clients,
    requests: {},
    tasks: {},
    audit: [],
    attachments: {},
    definitions: [
      ...SCHEMAS.map<DefinitionRecord>((s) => ({
        kind: 'form',
        definitionId: s.schemaId,
        name: s.title,
        version: s.version,
        status: 'APPROVED',
        updatedAt: iso(30),
        updatedBy: 'Jordan Lee',
        content: JSON.stringify(s, null, 2),
      })).filter((d, i, all) => all.findLastIndex((x) => x.definitionId === d.definitionId) === i),
      { kind: 'process', definitionId: CLIENT_REQUEST_PROCESS_KEY, name: 'Client request process', version: 4, status: 'APPROVED', updatedAt: iso(20), updatedBy: 'Jordan Lee', content: clientRequestProcessXml },
      { kind: 'decision', definitionId: RISK_DECISION_KEY, name: 'Risk tier decision', version: 1, status: 'APPROVED', updatedAt: iso(20), updatedBy: 'Jordan Lee', content: riskTierDecisionXml },
      { kind: 'formjs', definitionId: SUPPLEMENTARY_FORM_ID, name: 'Supplementary questionnaire (form-js)', version: 1, status: 'APPROVED', updatedAt: iso(15), updatedBy: 'Jordan Lee', content: JSON.stringify(supplementaryQuestionnaireSchema, null, 2) },
    ],
    idempotency: {},
    counters: { request: 100, task: 10, event: 1, attachment: 1 },
  };

  const corp = clients[0]!; // Bluefin Orchards Ltd
  const corp2 = clients[1]!;
  const corp3 = clients[2]!;
  const person = clients[30]!;

  const base = (id: string, client: ClientSummary, overrides: Partial<StoredRequest>): StoredRequest => ({
    requestId: id,
    clientId: client.clientId,
    clientName: client.displayName,
    category: 'ONBOARDING',
    requestType: 'CORPORATE_ENTITY',
    requestTypeLabel: 'Corporate entity onboarding',
    schemaId: 'onboarding.corporate-entity',
    schemaVersion: 3,
    status: 'DRAFT',
    revision: 1,
    values: {},
    createdBy: ADVISOR,
    updatedBy: 'Alex Rivera',
    updatedAt: iso(1),
    workflow: { processKey: CLIENT_REQUEST_PROCESS_KEY, processVersion: 4, currentActivityId: 'Task_CaptureRequest', completedActivityIds: ['StartEvent_Submitted'] },
    ...overrides,
  });

  // 1. Draft created on schema v2 (superseded) — reopening it still renders with v2.
  db.requests['REQ-2026-000091'] = base('REQ-2026-000091', corp, {
    schemaVersion: 2,
    revision: 3,
    values: {
      legalName: corp.displayName,
      registrationNumber: 'BF2026A1',
      countryOfIncorporation: 'CA',
      regionOfIncorporation: 'CA-ON',
      entityType: 'PRIVATE_COMPANY',
      industrySector: 'AGR',
      industrySubSector: 'AGR-ORC',
      owners: [{ rowId: 'row-seed-1', fullName: 'Ama Okafor-Lind', dateOfBirth: '1980-04-12', ownershipPercent: 60, isController: true, controlDescription: 'Managing director' }],
    },
    updatedAt: iso(2),
  });

  // 2. In review, with an open task for the reviewer.
  const reviewValues = {
    legalName: corp2.displayName,
    registrationNumber: 'CL2026B7',
    incorporationDate: '2015-06-01',
    countryOfIncorporation: 'GB',
    regionOfIncorporation: 'GB-SCT',
    relationshipManager: { id: 'staff-002', label: 'Priya Natarajan' },
    entityType: 'PARTNERSHIP',
    industrySector: 'TEC',
    industrySubSector: 'TEC-SAA',
    owners: [{ rowId: 'row-seed-2', fullName: 'Bruno Varga', dateOfBirth: '1975-09-30', ownershipPercent: 50, isController: false }],
    taxResidencyCountry: 'GB',
    taxIdentificationNumber: 'GB-7781-22',
    jurisdictionRisk: 'HIGH',
    pepExposure: false,
    expectedAnnualVolume: 1_200_000,
    sourceOfFundsDetail: 'Revenue from software licences (fictional).',
    certificateOfIncorporation: [{ attachmentId: 'att-seed-1', fileName: 'certificate.pdf', sizeBytes: 182_000, contentType: 'application/pdf', scanStatus: 'CLEAN' }],
    declarationConfirmed: true,
  };
  const decision = evaluateRiskTier(reviewValues, new Date(iso(1)));
  db.requests['REQ-2026-000092'] = base('REQ-2026-000092', corp2, {
    status: 'IN_REVIEW',
    revision: 6,
    values: reviewValues,
    submittedAt: iso(1),
    decision,
    currentTaskId: 'TASK-0007',
    workflow: {
      processKey: CLIENT_REQUEST_PROCESS_KEY,
      processVersion: 4,
      currentActivityId: 'Task_OperationsReview',
      completedActivityIds: ['StartEvent_Submitted', 'Task_CaptureRequest', 'Task_RiskDecision'],
    },
  });
  db.tasks['TASK-0007'] = {
    taskId: 'TASK-0007',
    requestId: 'REQ-2026-000092',
    clientName: corp2.displayName,
    requestTypeLabel: 'Corporate entity onboarding',
    activityId: 'Task_OperationsReview',
    name: 'Operations review',
    assignee: REVIEWER,
    status: 'OPEN',
    version: 1,
    createdAt: iso(1),
    reviewLevel: decision.outputs.reviewLevel,
  };

  // 3. Approved.
  db.requests['REQ-2026-000088'] = base('REQ-2026-000088', corp3, {
    status: 'APPROVED',
    revision: 9,
    category: 'SERVICE',
    requestType: 'ADDRESS_CHANGE',
    requestTypeLabel: 'Registered address change',
    schemaId: 'service.address-change',
    schemaVersion: 1,
    values: { addressLine1: '12 Lantern Row', city: 'Port Fairview', country: 'NZ', effectiveDate: '2026-11-01', jurisdictionRisk: 'LOW' },
    submittedAt: iso(6),
    updatedAt: iso(5),
    decision: evaluateRiskTier({ jurisdictionRisk: 'LOW' }, new Date(iso(6))),
    workflow: {
      processKey: CLIENT_REQUEST_PROCESS_KEY,
      processVersion: 4,
      currentActivityId: null,
      completedActivityIds: ['StartEvent_Submitted', 'Task_CaptureRequest', 'Task_RiskDecision', 'Task_OperationsReview', 'Gateway_Outcome', 'Task_Fulfil', 'End_Approved'],
    },
  });

  // 4. Returned to the advisor with a comment that contains markup (rendered safely as text).
  db.requests['REQ-2026-000093'] = base('REQ-2026-000093', person, {
    status: 'RETURNED',
    revision: 5,
    requestType: 'INDIVIDUAL',
    requestTypeLabel: 'Individual onboarding',
    schemaId: 'onboarding.individual',
    schemaVersion: 2,
    values: { fullLegalName: person.displayName, residenceCountry: 'AU', residenceRegion: 'AU-VIC', jurisdictionRisk: 'LOW', expectedAnnualVolume: 40_000 },
    reviewerComment: 'Please add proof of identity. <img src=x onerror="alert(1)"> (this markup is shown as text, never executed)',
    updatedAt: iso(0, 8),
    workflow: { processKey: CLIENT_REQUEST_PROCESS_KEY, processVersion: 4, currentActivityId: 'Task_CaptureRequest', completedActivityIds: ['StartEvent_Submitted', 'Task_CaptureRequest', 'Task_RiskDecision', 'Task_OperationsReview', 'Gateway_Outcome'] },
  });

  const event = (requestId: string, at: string, actor: string, type: AuditEvent['type'], summary: string) => {
    db.audit.push({ eventId: `EV-${String(db.counters.event++).padStart(5, '0')}`, requestId, at, actor, type, summary });
  };
  for (const id of Object.keys(db.requests)) event(id, iso(7), 'Alex Rivera', 'CREATED', 'Request created');
  for (let i = 0; i < 12; i += 1) event('REQ-2026-000092', iso(6 - i * 0.4), 'Alex Rivera', 'DRAFT_SAVED', `Draft saved (revision ${i + 1})`);
  event('REQ-2026-000092', iso(1), 'Alex Rivera', 'SUBMITTED', 'Submitted for review');
  event('REQ-2026-000092', iso(1), 'Decision service', 'DECISION_EVALUATED', `Risk tier ${decision.outputs.riskTier}, ${decision.outputs.reviewLevel} review`);
  event('REQ-2026-000093', iso(0, 8), 'Sam Patel', 'RETURNED', 'Returned to advisor for more information');

  return db;
}

const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
const hasStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined' && !isTest;

let db: Db = load();

function load(): Db {
  if (hasStorage()) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Db;
    } catch {
      /* fall through to seed */
    }
  }
  return seed();
}

export function getDb(): Db {
  return db;
}

export function persistDb(): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}

export function resetDb(): void {
  db = seed();
  persistDb();
}

export function nextRequestId(): string {
  db.counters.request += 1;
  return `REQ-2026-${String(db.counters.request).padStart(6, '0')}`;
}

export function nextTaskId(): string {
  db.counters.task += 1;
  return `TASK-${String(db.counters.task).padStart(4, '0')}`;
}

export function nextAttachmentId(): string {
  db.counters.attachment += 1;
  return `att-${String(db.counters.attachment).padStart(5, '0')}`;
}

export function addAudit(requestId: string, actor: string, type: AuditEvent['type'], summary: string): void {
  db.audit.push({ eventId: `EV-${String(db.counters.event++).padStart(5, '0')}`, requestId, at: new Date().toISOString(), actor, type, summary });
}
