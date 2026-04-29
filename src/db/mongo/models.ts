import mongoose, { Schema, Document } from 'mongoose';

export const MessageSchema = new Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export const AttachmentSchema = new Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  path: { type: String },
  mimeType: { type: String },
  size: { type: Number },
}, { timestamps: true });

export const ClientType = ['Cloud', 'Rent', 'PS'] as const;
export const RequestType = [
  'RFI/RFP',
  'Customer Agreement Review',
  'Customer Agreements Execution',
  'InfoSec Support',
  '3rd Party PT',
  'BC/DR Test Result Request',
  'Cloud Customer PT Request',
  'Certification Request',
  'Other Support'
] as const;

export const ClientSchema = new Schema({
  name: { type: String, required: true },
  clientType: { type: String, enum: ClientType, required: true },
  country: { type: String },
  contact: { type: String },
  attachments: [AttachmentSchema],
}, { timestamps: true });

// Client Request Schema
export const ClientRequestSchema = new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  requestKey: { type: String, required: true },
  requestType: { type: String, enum: RequestType, required: true },
  sectionToReview: { type: String },
  deadline: { type: Date },
  owner: { type: String },
  comments: { type: String },
  status: { type: String, enum: ['open', 'in_progress', 'completed'], default: 'open' },
  attachments: [AttachmentSchema],
}, { timestamps: true });

export const ConversationSchema = new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  requestId: { type: Schema.Types.ObjectId, ref: 'ClientRequest', index: true },
  title: { type: String, required: true, default: 'Nueva conversación' },
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

// Export models
export const Client = mongoose.model('Client', ClientSchema);
export const ClientRequest = mongoose.model('ClientRequest', ClientRequestSchema);
export const Conversation = mongoose.model('Conversation', ConversationSchema);
export const DocumentModel = mongoose.model('Document', DocumentSchema);
export const QAEntry = mongoose.model('QAEntry', QAEntrySchema);

// CMS Models
export const Category = mongoose.model('Category', CategorySchema);
export const Tag = mongoose.model('Tag', TagSchema);
export const ContentPage = mongoose.model('ContentPage', ContentPageSchema);
export const Bookmark = mongoose.model('Bookmark', BookmarkSchema);
export const RecentAccess = mongoose.model('RecentAccess', RecentAccessSchema);
export const FAQ = mongoose.model('FAQ', FAQSchema);
export const KnowledgeBookmark = mongoose.model('KnowledgeBookmark', KnowledgeBookmarkSchema);
export const KnowledgeRecentAccess = mongoose.model('KnowledgeRecentAccess', KnowledgeRecentAccessSchema);

// Auth Models
export const User = mongoose.model('User', UserSchema);
export const SessionSummary = mongoose.model('SessionSummary', SessionSummarySchema);
export const AnswerRule = mongoose.model('AnswerRule', AnswerRuleSchema);
export const CanonicalAnswer = mongoose.model('CanonicalAnswer', CanonicalAnswerSchema);
export const KbCandidate = mongoose.model('KbCandidate', KbCandidateSchema);
export const ResponseTrace = mongoose.model('ResponseTrace', ResponseTraceSchema);
export const AnalyticsEvent = mongoose.model('AnalyticsEvent', AnalyticsEventSchema);
export const QuestionCoverage = mongoose.model('QuestionCoverage', QuestionCoverageSchema);
export const DocumentUsage = mongoose.model('DocumentUsage', DocumentUsageSchema);
export const GapBacklog = mongoose.model('GapBacklog', GapBacklogSchema);
export const AnswerBuilderJob = mongoose.model('AnswerBuilderJob', AnswerBuilderJobSchema);
