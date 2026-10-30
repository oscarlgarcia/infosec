import mongoose, { Schema } from 'mongoose';
import {
  AiArtifactKinds,
  Classifications,
  ClientPhases,
  ContractTypes,
  CustomerStatuses,
  DeliverableStatuses,
  DeliverableTypes,
  DocumentSources,
  DocumentTypes,
  EventTypes,
  NotificationTypes,
  Priorities,
  RequestChannels,
  RequestKinds,
  RequestStatuses,
  RequestTypes,
  ServiceModels,
  Severities,
  SlaStates,
  StakeholderPartyTypes,
  StakeholderRoles,
  ThreadStatuses,
  ThreadTypes,
  Visibilities,
  TaskTypes,
} from '../../../types/request';

const objectId = Schema.Types.ObjectId;

interface AnyDoc {
  _id: any;
  [key: string]: any;
}
type AnyModel = mongoose.Model<AnyDoc>;

/**
 * Mongoose 7 + TypeScript resolves `mongoose.models.X || mongoose.model(...)`
 * as a union of two Model types, which breaks inference in every consumer.
 * Casting to a single AnyModel keeps the codebase compiling.
 */
function model(name: string, schema: Schema): AnyModel {
  return (mongoose.models[name] || mongoose.model(name, schema)) as AnyModel;
}

/**
 * Atomic yearly sequence used to build stable request keys (REQ-2026-000123).
 */
export const CounterSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  seq: { type: Number, default: 0 },
}, { timestamps: true });

/**
 * Append-only logbook. No updates or deletes are exposed by the API.
 */
export const RequestEventSchema = new Schema({
  requestId: { type: objectId, ref: 'ClientRequest', required: true, index: true },
  threadId: { type: objectId, ref: 'RequestThread', index: true },
  parentEventId: { type: objectId, ref: 'RequestEvent' },
  type: { type: String, enum: EventTypes, required: true, index: true },
  visibility: { type: String, enum: Visibilities, default: 'internal', index: true },
  authorId: { type: String, index: true },
  authorName: { type: String },
  authorRole: { type: String },
  partyType: { type: String, enum: StakeholderPartyTypes, default: 'internal' },
  body: { type: String, default: '' },
  fromStatus: { type: String },
  toStatus: { type: String },
  assigneeId: { type: String },
  taskId: { type: objectId, ref: 'Task' },
  taskType: { type: String, enum: TaskTypes },
  documentIds: [{ type: objectId, ref: 'RequestDocument' }],
  deliverableId: { type: objectId, ref: 'Deliverable' },
  mentions: [{ type: String }],
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

RequestEventSchema.index({ requestId: 1, createdAt: -1 });
RequestEventSchema.index({ threadId: 1, createdAt: 1 });
RequestEventSchema.index({ mentions: 1 });

/**
 * Threads (max 2 levels enforced in the service) model questionnaires,
 * follow-ups, reports, certificates and evidence requests.
 */
export const RequestThreadSchema = new Schema({
  requestId: { type: objectId, ref: 'ClientRequest', required: true, index: true },
  parentThreadId: { type: objectId, ref: 'RequestThread', default: null, index: true },
  type: { type: String, enum: ThreadTypes, default: 'general', index: true },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ThreadStatuses, default: 'open', index: true },
  priority: { type: String, enum: Priorities },
  assigneeId: { type: String, index: true },
  dueDate: { type: Date },
  deliverableIds: [{ type: objectId, ref: 'Deliverable' }],
  closedAt: { type: Date },
  lastActivityAt: { type: Date, default: Date.now, index: true },
  createdBy: { type: String },
}, { timestamps: true });

RequestThreadSchema.index({ requestId: 1, parentThreadId: 1, createdAt: 1 });

/**
 * Governed documents. Files live in local disk or S3/MinIO.
 */
export const RequestDocumentSchema = new Schema({
  requestId: { type: objectId, ref: 'ClientRequest', required: true, index: true },
  threadId: { type: objectId, ref: 'RequestThread', index: true },
  deliverableId: { type: objectId, ref: 'Deliverable', index: true },
  documentType: { type: String, enum: DocumentTypes, default: 'other', index: true },
  classification: { type: String, enum: Classifications, default: 'internal' },
  visibility: { type: String, enum: Visibilities, default: 'internal', index: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, default: 'application/octet-stream' },
  size: { type: Number, default: 0 },
  checksum: { type: String, index: true },
  version: { type: Number, default: 1 },
  supersedesId: { type: objectId, ref: 'RequestDocument' },
  source: { type: String, enum: DocumentSources, default: 'upload' },
  sourceRef: { type: String },
  expiryDate: { type: Date },
  storageProvider: { type: String, enum: ['local', 's3'], default: 'local' },
  storageKey: { type: String, required: true },
  uploadedBy: { type: String },
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });

RequestDocumentSchema.index({ requestId: 1, documentType: 1 });
RequestDocumentSchema.index({ deliverableId: 1 });

/**
 * Deliverables with traceability to Canonical Answers / KB sources.
 */
export const DeliverableSchema = new Schema({
  requestId: { type: objectId, ref: 'ClientRequest', required: true, index: true },
  threadId: { type: objectId, ref: 'RequestThread', index: true },
  type: { type: String, enum: DeliverableTypes, default: 'other', index: true },
  name: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: DeliverableStatuses, default: 'pending', index: true },
  version: { type: Number, default: 1 },
  ownerId: { type: String, index: true },
  validatorId: { type: String },
  dueDate: { type: Date },
  sentAt: { type: Date },
  acceptedAt: { type: Date },
  rejectedAt: { type: Date },
  documentIds: [{ type: objectId, ref: 'RequestDocument' }],
  sourceType: { type: String, enum: ['manual', 'canonical_answer', 'kb_document', 'generated'], default: 'manual' },
  sourceId: { type: String },
  sourceVersion: { type: String },
  sourceSnapshot: { type: String },
  clientVisible: { type: Boolean, default: false },
  createdBy: { type: String },
  updatedBy: { type: String },
}, { timestamps: true });

DeliverableSchema.index({ requestId: 1, status: 1 });
DeliverableSchema.index({ dueDate: 1, status: 1 });

export const BusinessCalendarSchema = new Schema({
  name: { type: String, required: true, unique: true },
  timezone: { type: String, default: 'Europe/Madrid' },
  workdays: { type: [Number], default: [1, 2, 3, 4, 5] },
  startTime: { type: String, default: '09:00' },
  endTime: { type: String, default: '18:00' },
  holidays: { type: [Date], default: [] },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export const SlaPolicySchema = new Schema({
  name: { type: String, required: true },
  requestType: { type: String, enum: RequestTypes },
  priority: { type: String, enum: Priorities },
  clientType: { type: String },
  businessHoursOnly: { type: Boolean, default: true },
  responseHours: { type: Number, default: 8 },
  resolutionHours: { type: Number, default: 72 },
  atRiskThresholdPct: { type: Number, default: 25 },
  pauseOnWaitingClient: { type: Boolean, default: true },
  calendarId: { type: objectId, ref: 'BusinessCalendar' },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

SlaPolicySchema.index({ active: 1, requestType: 1, priority: 1, clientType: 1 });

export const RequestTemplateSchema = new Schema({
  requestType: { type: String, enum: RequestTypes, required: true },
  requiredFields: { type: [String], default: [] },
  defaultPriority: { type: String, enum: Priorities, default: 'P3' },
  defaultSlaPolicyId: { type: objectId, ref: 'SlaPolicy' },
  defaultDeliverables: { type: [String], default: [] },
  defaultChecklist: { type: [String], default: [] },
  defaultThreadTypes: { type: [String], default: [] },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export const CveAdvisorySchema = new Schema({
  cveId: { type: String, required: true, unique: true, index: true },
  cveRecordId: { type: objectId, ref: 'CveRecord', index: true },
  title: { type: String, required: true },
  severity: { type: String, enum: Severities, default: 'medium', index: true },
  cvssScore: { type: Number },
  products: { type: [String], default: [] },
  publishedAt: { type: Date },
  summary: { type: String },
  posture: { type: String, enum: ['not_affected', 'affected', 'under_review', 'mitigated', 'unknown'], default: 'unknown', index: true },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  sourceUrl: { type: String },
  communicationTemplate: { type: String },
  createdBy: { type: String },
}, { timestamps: true });

export const CveImpactSchema = new Schema({
  cveId: { type: String, required: true, index: true },
  advisoryId: { type: objectId, ref: 'CveAdvisory', index: true },
  clientId: { type: objectId, ref: 'Client', required: true, index: true },
  affected: { type: Boolean, default: false, index: true },
  rationale: { type: String },
  posture: { type: String, enum: ['not_affected', 'affected', 'under_review', 'mitigated', 'unknown'], default: 'unknown' },
  responseText: { type: String },
  communicatedAt: { type: Date },
  communicatedBy: { type: String },
  requestId: { type: objectId, ref: 'ClientRequest' },
  threadId: { type: objectId, ref: 'RequestThread' },
}, { timestamps: true });

CveImpactSchema.index({ cveId: 1, clientId: 1 }, { unique: true });
CveImpactSchema.index({ clientId: 1, affected: 1 });

/**
 * Normalized CVE catalog. This is the ingestion target for NVD and CISA KEV;
 * curated advisories (CveAdvisory) are promoted from these records.
 */
const CveKevSchema = new Schema({
  listed: { type: Boolean, default: false },
  dateAdded: { type: Date },
  dueDate: { type: Date },
  requiredAction: { type: String },
  vulnerabilityName: { type: String },
  vendorProject: { type: String },
  product: { type: String },
  knownRansomwareCampaignUse: { type: String },
  notes: { type: String },
}, { _id: false });

const CveCpeSchema = new Schema({
  criteria: { type: String },
  vendor: { type: String },
  product: { type: String },
  version: { type: String },
  versionStartIncluding: { type: String },
  versionStartExcluding: { type: String },
  versionEndIncluding: { type: String },
  versionEndExcluding: { type: String },
}, { _id: false });

const CveMatchSchema = new Schema({
  clientId: { type: objectId, ref: 'Client' },
  confidence: { type: Number, default: 0 },
  reasons: { type: [String], default: [] },
  matchedVendor: { type: String },
  matchedProduct: { type: String },
  matchedVersion: { type: String },
}, { _id: false });

export const CveRecordSchema = new Schema({
  cveId: { type: String, required: true, unique: true, index: true },
  source: { type: [String], enum: ['nvd', 'kev'], default: [], index: true },
  title: { type: String, required: true },
  severity: { type: String, enum: Severities, default: 'medium', index: true },
  cvssScore: { type: Number },
  cvssVersion: { type: String },
  cvssVector: { type: String },
  summary: { type: String },
  summaryEs: { type: String },
  vendors: { type: [String], default: [] },
  products: { type: [String], default: [] },
  cpes: { type: [CveCpeSchema], default: [] },
  cwe: { type: [String], default: [] },
  references: { type: [String], default: [] },
  publishedAt: { type: Date, index: true },
  lastModified: { type: Date },
  nvdStatus: { type: String, index: true },
  sourceUrl: { type: String },
  kev: { type: CveKevSchema, default: () => ({ listed: false }) },
  matches: { type: [CveMatchSchema], default: [] },
  advisoryId: { type: objectId, ref: 'CveAdvisory', index: true },
  firstSeenAt: { type: Date },
  lastSyncedAt: { type: Date },
}, { timestamps: true });

CveRecordSchema.index({ severity: 1, publishedAt: -1 });
CveRecordSchema.index({ 'kev.listed': 1, publishedAt: -1 });
CveRecordSchema.index({ lastModified: -1 });
CveRecordSchema.index({ source: 1, publishedAt: -1 });
CveRecordSchema.index({ 'matches.clientId': 1, publishedAt: -1 });

/**
 * Durable sync cursor and lock per external source (`nvd`, `kev`).
 */
export const CveSyncStateSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['idle', 'running', 'error'], default: 'idle', index: true },
  mode: { type: String, enum: ['incremental', 'backfill', 'full'], default: 'incremental' },
  lastRunAt: { type: Date },
  lastSuccessAt: { type: Date },
  lastError: { type: String },
  cursorFrom: { type: Date },
  cursorTo: { type: Date },
  catalogVersion: { type: String },
  progress: {
    page: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    startedAt: { type: Date },
  },
  stats: { type: Schema.Types.Mixed, default: {} },
  lockedAt: { type: Date, index: true },
}, { timestamps: true });

export const NotificationSchema = new Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: NotificationTypes, default: 'system', index: true },
  title: { type: String, required: true },
  body: { type: String },
  link: { type: String },
  requestId: { type: objectId, ref: 'ClientRequest', index: true },
  readAt: { type: Date, default: null, index: true },
  channels: { type: [String], default: ['in_app'] },
  sentAt: { type: Date },
  dedupeKey: { type: String, unique: true, sparse: true, index: true },
}, { timestamps: true });

NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export const AiArtifactSchema = new Schema({
  requestId: { type: objectId, ref: 'ClientRequest', required: true, index: true },
  kind: { type: String, enum: AiArtifactKinds, required: true, index: true },
  content: { type: String, required: true },
  responseId: { type: String },
  model: { type: String },
  promptHash: { type: String },
  citations: { type: Schema.Types.Mixed, default: [] },
  createdBy: { type: String },
  acceptedAt: { type: Date },
  editedContent: { type: String },
  discardedAt: { type: Date },
}, { timestamps: true });

export const ScheduledFollowUpSchema = new Schema({
  requestId: { type: objectId, ref: 'ClientRequest', required: true, index: true },
  threadId: { type: objectId, ref: 'RequestThread' },
  dueAt: { type: Date, required: true, index: true },
  note: { type: String },
  assigneeId: { type: String, index: true },
  status: { type: String, enum: ['pending', 'done', 'cancelled'], default: 'pending', index: true },
  taskId: { type: objectId, ref: 'Task' },
  createdBy: { type: String },
  processedAt: { type: Date },
}, { timestamps: true });

export const NotificationPreferenceSchema = new Schema({
  userId: { type: String, required: true, unique: true, index: true },
  inApp: { type: Boolean, default: true },
  email: { type: Boolean, default: false },
  webhook: { type: Boolean, default: false },
  types: { type: [String], default: [] },
}, { timestamps: true });

export const Counter = model('Counter', CounterSchema);
export const RequestEvent = model('RequestEvent', RequestEventSchema);
export const RequestThread = model('RequestThread', RequestThreadSchema);
export const RequestDocument = model('RequestDocument', RequestDocumentSchema);
export const Deliverable = model('Deliverable', DeliverableSchema);
export const BusinessCalendar = model('BusinessCalendar', BusinessCalendarSchema);
export const SlaPolicy = model('SlaPolicy', SlaPolicySchema);
export const RequestTemplate = model('RequestTemplate', RequestTemplateSchema);
export const CveAdvisory = model('CveAdvisory', CveAdvisorySchema);
export const CveImpact = model('CveImpact', CveImpactSchema);
export const CveRecord = model('CveRecord', CveRecordSchema);
export const CveSyncState = model('CveSyncState', CveSyncStateSchema);
export const Notification = model('Notification', NotificationSchema);
export const AiArtifact = model('AiArtifact', AiArtifactSchema);
export const ScheduledFollowUp = model('ScheduledFollowUp', ScheduledFollowUpSchema);
export const NotificationPreference = model('NotificationPreference', NotificationPreferenceSchema);
