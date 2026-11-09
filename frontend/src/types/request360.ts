/**
 * Frontend domain types for Request 360. Mirrors the serializers in
 * src/services/request/serializer.ts so pages and API modules share one shape.
 */

export const REQUEST_STATUSES = [
  'new',
  'in_analysis',
  'waiting_client',
  'working',
  'on_hold',
  'cancelled',
  'delivered',
  'closed',
] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];

export const PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;
export type Priority = typeof PRIORITIES[number];

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type Severity = typeof SEVERITIES[number];

export const REQUEST_KINDS = ['standard', 'quick_query', 'cve'] as const;
export type RequestKind = typeof REQUEST_KINDS[number];

export const REQUEST_CHANNELS = ['email', 'portal', 'call', 'meeting', 'internal', 'other'] as const;
export type RequestChannel = typeof REQUEST_CHANNELS[number];

export const SLA_STATES = ['on_track', 'at_risk', 'breached', 'paused'] as const;
export type SlaState = typeof SLA_STATES[number];

export const STATUS_LABELS: Record<RequestStatus, { es: string; en: string }> = {
  new: { es: 'Nueva', en: 'New' },
  in_analysis: { es: 'En análisis', en: 'In analysis' },
  waiting_client: { es: 'Esperando cliente', en: 'Waiting client' },
  working: { es: 'En curso', en: 'Working' },
  on_hold: { es: 'En pausa', en: 'On hold' },
  cancelled: { es: 'Cancelada', en: 'Cancelled' },
  delivered: { es: 'Entregada', en: 'Delivered' },
  closed: { es: 'Cerrada', en: 'Closed' },
};

export const SLA_LABELS: Record<SlaState, { es: string; en: string }> = {
  on_track: { es: 'En plazo', en: 'On track' },
  at_risk: { es: 'En riesgo', en: 'At risk' },
  breached: { es: 'Incumplido', en: 'Breached' },
  paused: { es: 'Pausado', en: 'Paused' },
};

export const REQUEST_TYPE_OPTIONS = [
  'RFI/RFP',
  'Customer Agreement Review',
  'Customer Agreements Execution',
  'InfoSec Support',
  '3rd Party PT',
  'BC/DR Test Result Request',
  'Cloud Customer PT Request',
  'Certification Request',
  'Document Request',
  'Other Support',
  'Answer Builder',
] as const;

export const CONTRACT_TYPES = ['MSA', 'SOW', 'DPA', 'NDA', 'subscription', 'reseller', 'other'] as const;
export const SERVICE_MODELS = ['cloud', 'rent', 'ps', 'managed', 'hybrid', 'other'] as const;
export const CONTRACT_STATUSES = ['draft', 'pending_signature', 'active', 'renewed', 'cancelled', 'expired'] as const;
export type ContractStatus = typeof CONTRACT_STATUSES[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, { es: string; en: string }> = {
  draft: { es: 'Borrador', en: 'Draft' },
  pending_signature: { es: 'Pendiente de firma', en: 'Pending signature' },
  active: { es: 'Activo', en: 'Active' },
  renewed: { es: 'Renovado', en: 'Renewed' },
  cancelled: { es: 'Cancelado', en: 'Cancelled' },
  expired: { es: 'Expirado', en: 'Expired' },
};

export interface ContractAttachment {
  _id?: string;
  id?: string;
  filename: string;
  originalName: string;
  path?: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
}

export interface Contract {
  _id: string;
  clientId: string;
  name: string;
  contractNumber?: string;
  contractType: string;
  serviceModel?: string;
  status: ContractStatus | string;
  signedAt?: string;
  startDate?: string;
  endDate?: string;
  autoRenew?: boolean;
  renewalNoticeDays?: number;
  renewedFromContractId?: string;
  replacedByContractId?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  attachments: ContractAttachment[];
  notes?: string;
  metadata?: Record<string, any>;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ClientSlaOverride {
  _id: string;
  clientId: string;
  name?: string;
  requestType?: string;
  priority?: string;
  businessHoursOnly?: boolean;
  responseHours?: number;
  resolutionHours?: number;
  atRiskThresholdPct?: number;
  pauseOnWaitingClient?: boolean;
  calendarId?: string | { _id: string; name?: string; timezone?: string };
  effectiveFrom?: string;
  effectiveTo?: string;
  active?: boolean;
  reason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RequestStakeholder {
  name?: string;
  email?: string;
  role?: string;
  partyType?: 'client' | 'internal' | 'partner';
  userId?: string;
}

export interface RequestAttachment {
  id: string;
  filename: string;
  originalName?: string;
  path?: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
}

export interface RequestClientSummary {
  id: string;
  name: string;
  clientType?: string;
  country?: string;
  customerStatus?: string;
  currentPhase?: string;
}

export interface Request360 {
  id: string;
  clientId: string;
  client?: RequestClientSummary;
  requestKey: string;
  legacyRequestKey?: string;
  requestKind: RequestKind;
  requestType: string;
  title: string;
  sectionToReview?: string;
  scope?: string;
  deadline?: string;
  owner?: string;
  comments?: string;
  status: 'open' | 'in_progress' | 'completed';
  statusNew: RequestStatus;
  substatus?: string;
  priority: Priority;
  severity: Severity;
  requestChannel?: RequestChannel;
  tags: string[];
  businessUnit?: string;
  contractType?: string;
  contractSigned?: boolean;
  serviceModel?: string;
  salesOwnerId?: string;
  clientOwnerId?: string;
  infosecOwnerId?: string;
  infosecRepoUrl?: string;
  stakeholders: RequestStakeholder[];
  clientSnapshot?: Record<string, any>;
  slaPolicyId?: string;
  slaState: SlaState;
  slaResponseDueAt?: string;
  slaResolutionDueAt?: string;
  slaPausedAt?: string;
  pausedMsTotal: number;
  firstResponseAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  closedAt?: string;
  reopenCount: number;
  lastActivityAt?: string;
  duplicateOf?: string;
  mergedInto?: string;
  attachments: RequestAttachment[];
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const EVENT_TYPE_LABELS: Record<string, { es: string; en: string }> = {
  system: { es: 'Sistema', en: 'System' },
  comment: { es: 'Comentario', en: 'Comment' },
  status_change: { es: 'Cambio de estado', en: 'Status change' },
  assignment: { es: 'Asignación', en: 'Assignment' },
  document_added: { es: 'Documento', en: 'Document' },
  deliverable_created: { es: 'Entregable creado', en: 'Deliverable created' },
  deliverable_sent: { es: 'Entregable enviado', en: 'Deliverable sent' },
  thread_created: { es: 'Hilo creado', en: 'Thread created' },
  thread_closed: { es: 'Hilo cerrado', en: 'Thread closed' },
  sla_at_risk: { es: 'SLA en riesgo', en: 'SLA at risk' },
  sla_breached: { es: 'SLA incumplido', en: 'SLA breached' },
  client_followup: { es: 'Seguimiento', en: 'Follow-up' },
  ai_draft: { es: 'Borrador IA', en: 'AI draft' },
  cve_impact: { es: 'Impacto CVE', en: 'CVE impact' },
  email: { es: 'Email', en: 'Email' },
  task_linked: { es: 'Tarea vinculada', en: 'Task linked' },
};

export interface RequestEvent {
  id: string;
  requestId: string;
  threadId?: string;
  parentEventId?: string;
  type: string;
  visibility: 'internal' | 'client' | 'public';
  authorId?: string;
  authorName?: string;
  authorRole?: string;
  partyType?: string;
  body?: string;
  fromStatus?: string;
  toStatus?: string;
  assigneeId?: string;
  taskId?: string;
  documentIds: string[];
  deliverableId?: string;
  mentions?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface RequestThread {
  id: string;
  requestId: string;
  parentThreadId?: string;
  type: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  assigneeId?: string;
  dueDate?: string;
  deliverableIds: string[];
  closedAt?: string;
  lastActivityAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  eventCount?: number;
  lastEventAt?: string;
}

export interface RequestDocument {
  id: string;
  requestId: string;
  threadId?: string;
  deliverableId?: string;
  documentType?: string;
  classification?: string;
  visibility?: string;
  filename: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  checksum?: string;
  version?: number;
  source?: string;
  expiryDate?: string;
  storageProvider?: string;
  uploadedBy?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
  downloadUrl: string;
}

export interface Deliverable {
  id: string;
  requestId: string;
  threadId?: string;
  type?: string;
  name: string;
  description?: string;
  status: 'draft' | 'in_review' | 'approved' | 'sent' | 'accepted' | 'rejected' | string;
  version?: number;
  ownerId?: string;
  validatorId?: string;
  dueDate?: string;
  sentAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  documentIds: string[];
  sourceType?: string;
  sourceId?: string;
  sourceVersion?: string;
  clientVisible?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiArtifact {
  id: string;
  requestId: string;
  kind: string;
  status: 'draft' | 'accepted' | 'discarded' | string;
  content: string;
  editedContent?: string;
  citations?: Array<{ title?: string; sourceId?: string; snippet?: string }>;
  flags?: string[];
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Request360Detail {
  request: Request360;
  counts: { events: number; threads: number; documents: number; deliverables: number; tasks: number };
  events: RequestEvent[];
  threads: RequestThread[];
  documents: RequestDocument[];
  deliverables: Deliverable[];
  tasks?: any[];
}

export interface SlaPolicy {
  _id: string;
  name: string;
  requestType?: string;
  priority?: string;
  clientType?: string;
  businessHoursOnly?: boolean;
  responseHours?: number;
  resolutionHours?: number;
  atRiskThresholdPct?: number;
  pauseOnWaitingClient?: boolean;
  calendarId?: string;
  active?: boolean;
  order?: number;
}

export interface BusinessCalendar {
  _id: string;
  name: string;
  timezone?: string;
  workdays?: number[];
  startTime?: string;
  endTime?: string;
  holidays?: string[];
  isDefault?: boolean;
  active?: boolean;
  createdAt?: string;
}

export interface SlaSnapshot {
  requestId: string;
  slaState: SlaState;
  responseDueAt?: string;
  resolutionDueAt?: string;
  pausedAt?: string;
  pausedMsTotal: number;
  firstResponseAt?: string;
  deliveredAt?: string;
  closedAt?: string;
  reopenCount: number;
  policy?: SlaPolicy | null;
}

export interface CveAdvisory {
  _id: string;
  cveId: string;
  cveRecordId?: string;
  cveRecord?: CveRecord | null;
  title: string;
  severity: Severity;
  cvssScore?: number;
  products: string[];
  publishedAt?: string;
  summary?: string;
  posture?: string;
  status?: string;
  sourceUrl?: string;
  communicationTemplate?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  impacts?: CveImpact[];
}

export interface CveKevData {
  listed: boolean;
  dateAdded?: string;
  dueDate?: string;
  requiredAction?: string;
  vulnerabilityName?: string;
  vendorProject?: string;
  product?: string;
  knownRansomwareCampaignUse?: string;
  notes?: string;
}

export interface CveCpe {
  criteria: string;
  vendor: string;
  product: string;
  version?: string;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
}

export interface CveMatch {
  clientId: any;
  confidence: number;
  reasons: string[];
  matchedVendor?: string;
  matchedProduct?: string;
  matchedVersion?: string;
}

export interface CveRecord {
  _id: string;
  cveId: string;
  source: string[];
  title: string;
  severity: Severity;
  cvssScore?: number;
  cvssVersion?: string;
  cvssVector?: string;
  summary?: string;
  summaryEs?: string;
  vendors: string[];
  products: string[];
  cpes?: CveCpe[];
  cwe: string[];
  references: string[];
  publishedAt?: string;
  lastModified?: string;
  nvdStatus?: string;
  sourceUrl?: string;
  kev?: CveKevData;
  matches: CveMatch[];
  advisoryId?: string;
  advisory?: CveAdvisory | null;
  impacts?: CveImpact[];
  firstSeenAt?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CveCatalogResponse {
  items: CveRecord[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CveSyncState {
  key: 'nvd' | 'kev';
  status: 'idle' | 'running' | 'error';
  mode: string;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  cursorFrom?: string;
  cursorTo?: string;
  catalogVersion?: string;
  progress?: { page: number; processed: number; total: number; startedAt?: string };
  stats?: Record<string, any>;
}

export interface CveSyncStatus {
  states: CveSyncState[];
  running: string[];
  catalog: { records: number; kevListed: number; advisories: number; matched: number };
  config: {
    nvdIntervalMs: number;
    kevIntervalMs: number;
    backfillStart: string;
    matcherEnabled: boolean;
  };
}

export interface TechnologyInventoryItem {
  _id?: string;
  vendor: string;
  product: string;
  version?: string;
  cpe?: string;
  criticality?: 'low' | 'medium' | 'high' | 'critical';
  notes?: string;
}


export interface CveImpact {
  _id: string;
  cveId: string;
  advisoryId?: string;
  clientId: any;
  affected: boolean;
  posture?: string;
  rationale?: string;
  responseText?: string;
  requestId?: string;
  threadId?: string;
  communicatedAt?: string;
  communicatedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DashboardTotals {
  requests: number;
  open: number;
  overdue: number;
  delivered: number;
  closed: number;
  cancelled: number;
  reopened: number;
}

export interface GlobalDashboard {
  windowDays: number;
  generatedAt: string;
  totals: DashboardTotals;
  sla: {
    atRisk: number;
    breached: number;
    paused: number;
    compliancePct: number;
    firstResponseAvgHours: number;
    resolutionAvgDays: number;
  };
  pipeline: Array<{ status: RequestStatus; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  bySeverity: Array<{ severity: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  aging: Array<{ bucket: string; count: number }>;
  topClients: Array<{ clientId: string; name: string; total: number; open?: number; breached?: number }>;
  workload: Array<{ userId: string; name: string; open: number; overdue: number }>;
  knowledgeReuse: any;
  cve: { affectedClients: number };
  recentActivity: RequestEvent[];
}

export interface Client360 {
  client: any;
  metrics: {
    totalRequests: number;
    open: number;
    overdue: number;
    breached: number;
    delivered: number;
    closed: number;
    avgResolutionDays: number;
    reopenCount: number;
  };
  requests: Request360[];
  deliverables: Deliverable[];
  documents: RequestDocument[];
  cveImpacts: CveImpact[];
  threads: RequestThread[];
  timeline: RequestEvent[];
}

export interface AppNotification {
  _id: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  requestId?: string;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationList {
  items: AppNotification[];
  total: number;
  unread: number;
  page: number;
  limit: number;
}

export interface NotificationPreferences {
  userId: string;
  inApp: boolean;
  email: boolean;
  webhook: boolean;
  types: string[];
}

export interface AppUser {
  _id: string;
  id?: string;
  username: string;
  email: string;
  role: string;
  isActive?: boolean;
}
