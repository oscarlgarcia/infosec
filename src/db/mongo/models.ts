import mongoose, { Schema, Document } from 'mongoose';
import {
  Classifications,
  ClientPhases,
  ContractStatuses,
  ContractTypes,
  CustomerStatuses,
  DocumentTypes,
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
  TaskTypes,
  Visibilities,
} from '../../types/request';

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

// Setting Model for key-value configuration
export interface ISetting extends Document {
  key: string;
  value: any;
  updatedAt: Date;
}

const SettingSchema = new Schema<ISetting>({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now },
});

SettingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const Setting = model('Setting', SettingSchema);

export const MessageSchema = new Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  // NUEVO: Campo para metadatos RAG (confidence, coverage, flags, sources, etc.)
  metadata: { type: Schema.Types.Mixed },
});

export const AttachmentSchema = new Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  path: { type: String },
  mimeType: { type: String },
  size: { type: Number },
}, { timestamps: true });

export const ClientType = ['Cloud', 'Rent', 'PS'] as const;
export const RequestType = RequestTypes;

export const StakeholderSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String },
  organization: { type: String },
  role: { type: String, enum: StakeholderRoles, default: 'other' },
  partyType: { type: String, enum: StakeholderPartyTypes, default: 'client' },
  userId: { type: String },
}, { _id: false });

export const TechnologyInventoryItemSchema = new Schema({
  vendor: { type: String, required: true },
  product: { type: String, required: true },
  version: { type: String },
  cpe: { type: String },
  criticality: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  notes: { type: String },
});

export const ClientSchema = new Schema({
  name: { type: String, required: true },
  clientType: { type: String, enum: ClientType, required: true },
  country: { type: String },
  contact: { type: String },
  attachments: [AttachmentSchema],

  // Request 360 account fields
  customerStatus: { type: String, enum: CustomerStatuses, default: 'active', index: true },
  currentPhase: { type: String, enum: ClientPhases, default: 'active' },
  contractSigned: { type: Boolean, default: false },
  contractType: { type: String, enum: ContractTypes },
  serviceModel: { type: String, enum: ServiceModels },
  businessUnit: { type: String },
  tags: { type: [String], default: [] },
  salesOwnerId: { type: String, index: true },
  clientOwnerId: { type: String, index: true },
  infosecOwnerId: { type: String, index: true },
  infosecRepoUrl: { type: String },
  stakeholders: { type: [StakeholderSchema], default: [] },
  cveSubscriptions: {
    enabled: { type: Boolean, default: false },
    severityThreshold: { type: String, enum: Severities, default: 'high' },
    recipients: { type: [String], default: [] },
  },
  technologyInventory: { type: [TechnologyInventoryItemSchema], default: [] },
  createdBy: { type: String },
  updatedBy: { type: String },
}, { timestamps: true });

export const ContractSchema = new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  name: { type: String, required: true },
  contractNumber: { type: String },
  contractType: { type: String, enum: ContractTypes, required: true, index: true },
  serviceModel: { type: String, enum: ServiceModels },
  status: { type: String, enum: ContractStatuses, default: 'draft', index: true },
  signedAt: { type: Date },
  startDate: { type: Date, index: true },
  endDate: { type: Date, index: true },
  autoRenew: { type: Boolean, default: false },
  renewalNoticeDays: { type: Number },
  renewedFromContractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
  replacedByContractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
  cancelledAt: { type: Date },
  cancellationReason: { type: String },
  attachments: [AttachmentSchema],
  notes: { type: String },
  metadata: { type: Schema.Types.Mixed },
  createdBy: { type: String },
  updatedBy: { type: String },
}, { timestamps: true });

ContractSchema.index({ clientId: 1, status: 1 });
ContractSchema.index({ clientId: 1, endDate: 1 });

export const ClientSlaOverrideSchema = new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  name: { type: String },
  requestType: { type: String, enum: RequestTypes },
  priority: { type: String, enum: Priorities },
  businessHoursOnly: { type: Boolean },
  responseHours: { type: Number },
  resolutionHours: { type: Number },
  atRiskThresholdPct: { type: Number },
  pauseOnWaitingClient: { type: Boolean },
  calendarId: { type: Schema.Types.ObjectId, ref: 'BusinessCalendar' },
  effectiveFrom: { type: Date },
  effectiveTo: { type: Date },
  active: { type: Boolean, default: true, index: true },
  reason: { type: String },
  createdBy: { type: String },
  updatedBy: { type: String },
}, { timestamps: true });

ClientSlaOverrideSchema.index({ clientId: 1, active: 1, requestType: 1, priority: 1 });

export const ClientRequestSnapshotSchema = new Schema({
  name: { type: String },
  country: { type: String },
  clientType: { type: String },
  contractType: { type: String },
  contractSigned: { type: Boolean },
  serviceModel: { type: String },
  businessUnit: { type: String },
  customerStatus: { type: String },
  currentPhase: { type: String },
  stakeholders: { type: [StakeholderSchema], default: [] },
}, { _id: false });

// Client Request Schema
export const ClientRequestSchema = new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  requestKey: { type: String, required: true, unique: true, index: true },
  legacyRequestKey: { type: String },
  requestKind: { type: String, enum: RequestKinds, default: 'standard', index: true },
  requestType: { type: String, enum: RequestType, required: true, index: true },
  title: { type: String },
  sectionToReview: { type: String },
  scope: { type: String },
  deadline: { type: Date, index: true },
  owner: { type: String },
  comments: { type: String },
  legacyComments: { type: String },
  status: {
    type: String,
    enum: [...RequestStatuses, 'open', 'in_progress', 'completed'],
    default: 'open',
    index: true,
  },
  substatus: { type: String },

  // Intake 360
  priority: { type: String, enum: Priorities, default: 'P3', index: true },
  severity: { type: String, enum: Severities, default: 'medium' },
  requestChannel: { type: String, enum: RequestChannels, default: 'email' },
  tags: { type: [String], default: [], index: true },
  businessUnit: { type: String },
  contractType: { type: String, enum: ContractTypes },
  clientType: { type: String },
  contractSigned: { type: Boolean, default: false },
  serviceModel: { type: String, enum: ServiceModels },
  salesOwnerId: { type: String, index: true },
  clientOwnerId: { type: String, index: true },
  infosecOwnerId: { type: String, index: true },
  infosecRepoUrl: { type: String },
  stakeholders: { type: [StakeholderSchema], default: [] },
  clientSnapshot: { type: ClientRequestSnapshotSchema },
  templateId: { type: Schema.Types.ObjectId, ref: 'RequestTemplate' },

  // SLA and derived milestones (event-based, never updatedAt)
  slaPolicyId: { type: Schema.Types.ObjectId, ref: 'SlaPolicy' },
  slaState: { type: String, enum: SlaStates, default: 'on_track', index: true },
  slaResponseDueAt: { type: Date },
  slaResolutionDueAt: { type: Date },
  slaPausedAt: { type: Date },
  pausedMsTotal: { type: Number, default: 0 },
  firstResponseAt: { type: Date },
  deliveredAt: { type: Date },
  completedAt: { type: Date },
  closedAt: { type: Date },
  reopenCount: { type: Number, default: 0 },
  lastActivityAt: { type: Date, default: Date.now, index: true },

  duplicateOf: { type: Schema.Types.ObjectId, ref: 'ClientRequest' },
  mergedInto: { type: Schema.Types.ObjectId, ref: 'ClientRequest' },

  // Soft delete: requests are never physically removed
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date },
  deletedBy: { type: String },
  deleteReason: { type: String },

  attachments: [AttachmentSchema],
  createdBy: { type: String },
  updatedBy: { type: String },
}, { timestamps: true });

ClientRequestSchema.index({ clientId: 1, status: 1, createdAt: -1 });
ClientRequestSchema.index({ status: 1, priority: 1, deadline: 1 });
ClientRequestSchema.index({ salesOwnerId: 1, status: 1 });
ClientRequestSchema.index({ clientOwnerId: 1, status: 1 });
ClientRequestSchema.index({ infosecOwnerId: 1, status: 1 });
ClientRequestSchema.index({ lastActivityAt: -1 });


export const ConversationSchema = new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  requestId: { type: Schema.Types.ObjectId, ref: 'ClientRequest', index: true },
  title: { type: String, required: true, default: 'Nueva conversaciÃ³n' },
  agent: { type: String, default: 'InfoSec' },
  favorite: { type: Boolean, default: false },
  messages: [MessageSchema],
}, { timestamps: true });

export const DocumentSchema = new Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  department: { 
    type: String, 
    enum: ['Cloud', 'IT', 'Development', 'Compliance', 'Legal'],
    required: true 
  },
  content: { type: String, required: true },
  embedding: { type: [Number], default: null },
  embeddingStatus: { type: String, enum: ['pending', 'processing', 'generated', 'failed'], default: 'pending' },
  embeddingError: { type: String, default: null },
  metadata: {
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    domain: { type: String },
    owner: { type: String },
    reviewDate: { type: Date },
    expiryDate: { type: Date },
    version: { type: String },
    criticality: { type: String },
    openaiFileId: { type: String },
    vectorStoreIds: [{ type: String }],
  },
  lastIndexedAt: { type: Date },
}, { timestamps: true });

export const QAEntrySchema = new Schema({
  questionNumber: { type: String },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  department: { 
    type: String, 
    enum: ['Cloud', 'IT', 'Development', 'Compliance', 'Legal'] 
  },
  infoSecDomain: { type: String },
  source: { type: String },
  embedding: { type: [Number], default: null },
  embeddingStatus: { type: String, enum: ['pending', 'generated', 'failed'], default: 'pending' },
}, { timestamps: true });

// CMS Schemas
export const CategorySchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'Category' },
  description: { type: String },
  order: { type: Number, default: 0 },
}, { timestamps: true });

export const TagSchema = new Schema({
  name: { type: String, required: true, unique: true },
  color: { type: String, default: '#6B7280' },
}, { timestamps: true });

export const ContentVersionSchema = new Schema({
  version: { type: Number, required: true },
  content: { type: String, required: true },
  summary: { type: String },
  changedBy: { type: String },
  changeNote: { type: String },
}, { timestamps: true });

export const ContentPageSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, default: '' },
  summary: { type: String },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
  parentId: { type: Schema.Types.ObjectId, ref: 'ContentPage', default: null },
  order: { type: Number, default: 0 },
  tags: [{ type: String }],
  status: { 
    type: String, 
    enum: ['draft', 'published', 'archived'], 
    default: 'draft' 
  },
  authorId: { type: String, default: 'system' },
  versions: [ContentVersionSchema],
  relatedContent: [{ type: Schema.Types.ObjectId, ref: 'ContentPage' }],
  viewCount: { type: Number, default: 0 },
  isFeatured: { type: Boolean, default: false },
}, { timestamps: true });

export const BookmarkSchema = new Schema({
  userId: { type: String, default: 'default' },
  contentId: { type: Schema.Types.ObjectId, ref: 'ContentPage', required: true },
}, { timestamps: true });

export const RecentAccessSchema = new Schema({
  userId: { type: String, default: 'default' },
  contentId: { type: Schema.Types.ObjectId, ref: 'ContentPage', required: true },
}, { timestamps: true });

export const FAQSchema = new Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
  tags: [{ type: String }],
  order: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: true },
}, { timestamps: true });

export const KnowledgeBookmarkSchema = new Schema({
  userId: { type: String, default: 'default', index: true },
  sourceType: {
    type: String,
    enum: ['cms', 'faq', 'qa', 'document'],
    required: true,
  },
  itemId: { type: String, required: true },
}, { timestamps: true });

export const KnowledgeRecentAccessSchema = new Schema({
  userId: { type: String, default: 'default', index: true },
  sourceType: {
    type: String,
    enum: ['cms', 'faq', 'qa', 'document'],
    required: true,
  },
  itemId: { type: String, required: true },
  accessedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const UserRoles = ['admin', 'manager', 'sme', 'usuario'] as const;
export type UserRole = typeof UserRoles[number];

export const UserSchema = new Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8 },
  role: { 
    type: String, 
    enum: UserRoles, 
    required: true,
    default: 'usuario'
  },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
}, { timestamps: true });

export const SessionSummarySchema = new Schema({
  sessionId: { type: String, required: true, index: true },
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', index: true },
  summaryText: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const AnswerRuleSchema = new Schema({
  name: { type: String, required: true },
  content: { type: String, required: true },
  domain: { type: String },
  appliesTo: [{ type: String }],  // NEW: Agent names this rule applies to (empty = all agents)
  enabled: { type: Boolean, default: true },
  version: { type: Number, default: 1 },
}, { timestamps: true });

export const CanonicalAnswerVersionSchema = new Schema({
  version: { type: Number, required: true },
  answerText: { type: String, required: true },
  reason: { type: String },
  changedBy: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const CanonicalAnswerSchema = new Schema({
  question: { type: String, required: true, index: true },
  domain: { type: String, required: true, index: true },
  owner: { type: String, required: true },
  status: { type: String, enum: ['draft', 'approved', 'archived'], default: 'draft' },
  currentAnswer: { type: String, required: true },
  sourceRefs: [{ type: String }],
  versions: [CanonicalAnswerVersionSchema],
  lastReviewedAt: { type: Date },
}, { timestamps: true });

export const KbCandidateSchema = new Schema({
  sessionId: { type: String, index: true },
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', index: true },
  question: { type: String, required: true },
  suggestedAnswer: { type: String, required: true },
  domain: { type: String, index: true },
  sourceRefs: [{ type: String }],
  status: { type: String, enum: ['draft', 'in_review', 'approved', 'rejected'], default: 'draft' },
  reviewedBy: { type: String },
  reviewNote: { type: String },
}, { timestamps: true });

export const ResponseTraceSchema = new Schema({
  responseId: { type: String, required: true, unique: true, index: true },
  sessionId: { type: String, required: true, index: true },
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', index: true },
  requestId: { type: String, index: true },
  question: { type: String, required: true },
  answerText: { type: String, required: true },
  intent: { type: String, required: true },
  domain: { type: String },
  coverageStatus: { type: String, required: true },
  confidence: { type: Number, default: 0 },
  flags: [{ type: String }],
  usedSources: [{
    sourceType: { type: String },
    itemId: { type: String },
    title: { type: String },
    score: { type: Number },
    version: { type: String },
    updatedAt: { type: Date },
  }],
  citations: [{
    fileId: { type: String },
    filename: { type: String },
    score: { type: Number },
    snippet: { type: String },
  }],
  latencyMs: { type: Number, default: 0 },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  costEstimate: { type: Number, default: 0 },
  feedbackDecision: { type: String, enum: ['accepted', 'edited', 'discarded', 'copied', 'exported'] },
  feedbackNotes: { type: String },
  feedbackBy: { type: String },
  feedbackAt: { type: Date },
}, { timestamps: true });

export const AnalyticsEventSchema = new Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  eventType: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  userId: { type: String, index: true },
  sessionId: { type: String, index: true },
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', index: true },
  domain: { type: String, index: true },
  subdomain: { type: String },
  questionId: { type: String },
  responseId: { type: String, index: true },
  model: { type: String },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  latencyMs: { type: Number, default: 0 },
  costEstimate: { type: Number, default: 0 },
  confidenceScore: { type: Number, default: 0 },
  coverageStatus: { type: String },
  feedback: { type: String },
  flags: [{ type: String }],
}, { timestamps: true });

export const QuestionCoverageSchema = new Schema({
  questionHash: { type: String, required: true, unique: true, index: true },
  questionText: { type: String, required: true },
  domain: { type: String, required: true, index: true },
  subdomain: { type: String },
  coverageStatus: { type: String, required: true },
  coverageScore: { type: Number, default: 0 },
  evidenceCount: { type: Number, default: 0 },
  canonicalAnswerExists: { type: Boolean, default: false },
  contradictionFlag: { type: Boolean, default: false },
  stalenessPenalty: { type: Number, default: 0 },
  lastSeenAt: { type: Date, default: Date.now },
  timesAsked: { type: Number, default: 1 },
  requiresReview: { type: Boolean, default: false },
  recommendedAction: { type: String },
}, { timestamps: true });

export const DocumentUsageSchema = new Schema({
  documentId: { type: String, required: true, unique: true, index: true },
  domain: { type: String, index: true },
  timesRetrieved: { type: Number, default: 0 },
  timesCited: { type: Number, default: 0 },
  timesUsedInAcceptedAnswers: { type: Number, default: 0 },
  freshnessScore: { type: Number, default: 1 },
  lastUsedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const GapBacklogSchema = new Schema({
  gapId: { type: String, required: true, unique: true, index: true },
  domain: { type: String, required: true, index: true },
  subdomain: { type: String },
  questionExample: { type: String, required: true },
  frequency: { type: Number, default: 1 },
  impactScore: { type: Number, default: 0.5 },
  coverageScore: { type: Number, default: 0 },
  owner: { type: String, default: 'unassigned' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'ignored'], default: 'open' },
  suggestedContentType: { type: String, default: 'canonical-answer' },
}, { timestamps: true });

export const AnswerBuilderJobSchema = new Schema({
  jobId: { type: String, required: true, unique: true, index: true },
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', index: true },
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued' },
  inputQuestions: [{ type: String }],
  outputRows: [{
    question: { type: String },
    answer: { type: String },
    domain: { type: String },
    subdomain: { type: String },
    confidence: { type: Number },
    requiresLegalReview: { type: Boolean },
    contradictionFlag: { type: Boolean },
    evidenceCount: { type: Number },
    notes: { type: String },
  }],
  errorMessage: { type: String },
}, { timestamps: true });

// Orchestrator Schemas
export const PipelineStepSchema = new Schema({
  stage: { type: String, enum: ['reader', 'processor', 'writer'], required: true },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
  startedAt: { type: Date },
  completedAt: { type: Date },
  error: { type: String },
  progress: { type: Number, default: 0 },
});

export const OrchestratorJobSchema = new Schema({
  name: { type: String, required: true },
  pipeline: { type: String, enum: ['answer-builder'], required: true },
  status: { type: String, enum: ['pending', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'], default: 'pending' },
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  requestId: { type: Schema.Types.ObjectId, ref: 'ClientRequest', index: true },
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
  agent: { type: String, default: 'InfoSec' },
  inputFile: { type: String },
  inputQuestions: [{ type: String }],
  outputRows: [{
    question: { type: String },
    answer: { type: String },
    domain: { type: String },
    subdomain: { type: String },
    confidence: { type: Number },
    requiresLegalReview: { type: Boolean },
    contradictionFlag: { type: Boolean },
    evidenceCount: { type: Number },
    notes: { type: String },
    timingMs: { type: Number },
  }],
  totalQuestions: { type: Number, default: 0 },
  completedQuestions: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
  steps: [PipelineStepSchema],
  errorMessage: { type: String },
  outputFile: { type: String },
  avgTimingMs: { type: Number, default: 0 },
  startedAt: { type: Date },
  completedAt: { type: Date },
}, { timestamps: true });

export const QueueItemSchema = new Schema({
  jobId: { type: Schema.Types.ObjectId, ref: 'OrchestratorJob', required: true, unique: true },
  pipeline: { type: String, enum: ['answer-builder'], required: true },
  status: { type: String, enum: ['pending', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'], default: 'queued' },
  priority: { type: Number, default: 0 },
  enqueuedAt: { type: Date, default: Date.now },
  startedAt: { type: Date },
}, { timestamps: true });

// Export models
export const OrchestratorJob = model('OrchestratorJob', OrchestratorJobSchema);
export const QueueItem = model('QueueItem', QueueItemSchema);


export const Client = model('Client', ClientSchema);
export const Contract = model('Contract', ContractSchema);
export const ClientSlaOverride = model('ClientSlaOverride', ClientSlaOverrideSchema);
export const ClientRequest = model('ClientRequest', ClientRequestSchema);
export const Conversation = model('Conversation', ConversationSchema);
export const DocumentModel = model('DocumentModel', DocumentSchema);
export const QAEntry = model('QAEntry', QAEntrySchema);

// CMS Models
export const Category = model('Category', CategorySchema);
export const Tag = model('Tag', TagSchema);
export const ContentPage = model('ContentPage', ContentPageSchema);
export const Bookmark = model('Bookmark', BookmarkSchema);
export const RecentAccess = model('RecentAccess', RecentAccessSchema);
export const FAQ = model('FAQ', FAQSchema);
export const KnowledgeBookmark = model('KnowledgeBookmark', KnowledgeBookmarkSchema);
export const KnowledgeRecentAccess = model('KnowledgeRecentAccess', KnowledgeRecentAccessSchema);

// Auth Models
export const User = model('User', UserSchema);
export const SessionSummary = model('SessionSummary', SessionSummarySchema);
export const AnswerRule = model('AnswerRule', AnswerRuleSchema);
export const CanonicalAnswer = model('CanonicalAnswer', CanonicalAnswerSchema);
export const KbCandidate = model('KbCandidate', KbCandidateSchema);
export const ResponseTrace = model('ResponseTrace', ResponseTraceSchema);
export const AnalyticsEvent = model('AnalyticsEvent', AnalyticsEventSchema);
export const QuestionCoverage = model('QuestionCoverage', QuestionCoverageSchema);
export const DocumentUsage = model('DocumentUsage', DocumentUsageSchema);
export const GapBacklog = model('GapBacklog', GapBacklogSchema);

// Term Report Models
const TermReportSourceSchema = new Schema({
  sourceType: { type: String, enum: ['cms', 'faq', 'qa', 'document'], required: true },
  itemId: String, title: String, score: Number,
}, { _id: false });

const TermReportQASchema = new Schema({
  question: String, answer: String, sourceType: String,
  itemId: String, score: Number, isDirect: Boolean,
}, { _id: false });

const TermReportCanonicalSchema = new Schema({
  canonicalId: { type: Schema.Types.ObjectId, ref: 'CanonicalAnswer' },
  question: String, currentAnswer: String,
  status: String, owner: String, verified: Boolean,
}, { _id: false });

const TermReportGapSchema = new Schema({
  topic: String, recommendation: String, impactScore: Number,
}, { _id: false });

const TermReportContradictionSchema = new Schema({
  left: String, right: String, severity: String, sources: [String],
}, { _id: false });

const TermReportSchema = new Schema({
  term: { type: String, required: true, index: true },
  definition: String,
  directQA: [TermReportQASchema],
  relatedTopics: [TermReportQASchema],
  canonicalAnswers: [TermReportCanonicalSchema],
  sourcesUsed: [TermReportSourceSchema],
  coverageGaps: [TermReportGapSchema],
  contradictions: [TermReportContradictionSchema],
  summary: String,
  metrics: {
    totalSources: Number, gapCount: Number,
    contradictionCount: Number, canonicalCount: Number,
    avgConfidence: Number,
  },
  generatedBy: String,
}, { timestamps: true });

const TermReportScheduleSchema = new Schema({
  term: { type: String, required: true },
  frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
  enabled: { type: Boolean, default: true },
  lastRunAt: { type: Date },
  nextRunAt: { type: Date },
  createdBy: { type: String },
  notifyOnChanges: { type: Boolean, default: true },
  scheduleHour: { type: Number, default: 0 },
  scheduleMinute: { type: Number, default: 0 },
  dayOfWeek: { type: Number },
  dayOfMonth: { type: Number },
}, { timestamps: true });

const TermReportSnapshotSchema = new Schema({
  term: { type: String, required: true },
  scheduleId: { type: Schema.Types.ObjectId, ref: 'TermReportSchedule' },
  report: { type: Schema.Types.Mixed },
  metrics: {
    totalSources: Number, gapCount: Number,
    contradictionCount: Number, canonicalCount: Number,
    avgConfidence: Number,
  },
  generatedAt: { type: Date, default: Date.now },
});

export const TermReport = model('TermReport', TermReportSchema);
export const TermReportSchedule = model('TermReportSchedule', TermReportScheduleSchema);
export const TermReportSnapshot = model('TermReportSnapshot', TermReportSnapshotSchema);


// Task Kanban Models
export const TaskListSchema = new Schema({
  name: { type: String, required: true },
  order: { type: Number, default: 0 },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });
export const TaskList = model('TaskList', TaskListSchema);

export const TaskLabelSchema = new Schema({
  name: { type: String, required: true },
  color: { type: String, default: '#6B7280' },
}, { timestamps: true });
export const TaskLabel = model('TaskLabel', TaskLabelSchema);

export const ChecklistItemSchema = new Schema({
  text: { type: String, required: true },
  completed: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
});

export const TaskSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['Not Started', 'In Progress', 'Completed'], default: 'Not Started' },
  dueDate: { type: Date },
  startDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  listId: { type: Schema.Types.ObjectId, ref: 'TaskList', required: true },
  requestId: { type: Schema.Types.ObjectId, ref: 'ClientRequest', index: true },
  checklist: [ChecklistItemSchema],
  labelIds: [{ type: Schema.Types.ObjectId, ref: 'TaskLabel' }],

  // Request 360 business attributes
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', index: true },
  threadId: { type: Schema.Types.ObjectId, ref: 'RequestThread', index: true },
  priority: { type: String, enum: Priorities, index: true },
  severity: { type: String, enum: Severities },
  ownerIds: { type: [String], default: [], index: true },
  requestType: { type: String, enum: RequestType },
  requestKey: { type: String },
  deadline: { type: Date, index: true },
  slaState: { type: String, enum: SlaStates },
  taskType: { type: String, enum: TaskTypes, default: 'other' },
  tags: { type: [String], default: [] },
  clientVisible: { type: Boolean, default: false },
}, { timestamps: true });
export const Task = model('Task', TaskSchema);

// Request 360 models (re-exported from the dedicated module)
export {
  Counter,
  RequestEvent,
  RequestThread,
  RequestDocument,
  Deliverable,
  BusinessCalendar,
  SlaPolicy,
  RequestTemplate,
  CveAdvisory,
  CveImpact,
  CveRecord,
  CveSyncState,
  Notification,
  AiArtifact,
  ScheduledFollowUp,
  NotificationPreference,
} from './models/request';

// Metric Configuration for Analytics Dashboard
export const MetricConfigurationSchema = new Schema({
  metricId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  nameEs: { type: String },
  description: { type: String },
  category: { type: String, enum: ['temporal', 'client', 'request', 'kanban', 'agent'], required: true },
  endpoint: { type: String, required: true },
  chartType: { type: String, enum: ['line', 'bar', 'pie', 'heatmap', 'stat'], required: true },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  thresholds: {
    warning: { type: Number },
    critical: { type: Number },
  },
}, { timestamps: true });
export const MetricConfiguration = model('MetricConfiguration', MetricConfigurationSchema);
