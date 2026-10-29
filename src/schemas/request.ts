import { z } from 'zod';
import {
  Classifications,
  DeliverableStatuses,
  DeliverableTypes,
  DocumentTypes,
  EventTypes,
  Priorities,
  RequestChannels,
  RequestKinds,
  RequestStatuses,
  RequestTypes,
  Severities,
  ThreadStatuses,
  ThreadTypes,
  Visibilities,
} from '../types/request';

function tuple<T extends readonly string[]>(values: T) {
  return values as unknown as [string, ...string[]];
}

export const stakeholderSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  organization: z.string().optional(),
  role: z.string().optional(),
  partyType: z.enum(['internal', 'client']).optional(),
  userId: z.string().optional(),
});

export const createRequestSchema = z.object({
  clientId: z.string().min(1),
  requestType: z.enum(tuple(RequestTypes)),
  requestKind: z.enum(tuple(RequestKinds)).optional(),
  title: z.string().max(300).optional(),
  sectionToReview: z.string().optional(),
  scope: z.string().optional(),
  deadline: z.string().optional().nullable(),
  owner: z.string().optional(),
  comments: z.string().optional(),
  priority: z.enum(tuple(Priorities)).optional(),
  severity: z.enum(tuple(Severities)).optional(),
  requestChannel: z.enum(tuple(RequestChannels)).optional(),
  tags: z.array(z.string()).optional(),
  businessUnit: z.string().optional(),
  contractType: z.string().optional(),
  contractSigned: z.boolean().optional(),
  serviceModel: z.string().optional(),
  salesOwnerId: z.string().optional(),
  clientOwnerId: z.string().optional(),
  infosecOwnerId: z.string().optional(),
  infosecRepoUrl: z.string().optional(),
  stakeholders: z.array(stakeholderSchema).optional(),
  overrideDuplicate: z.boolean().optional(),
  override: z.boolean().optional(),
});

export const updateRequestSchema = createRequestSchema
  .omit({ clientId: true, requestKind: true, overrideDuplicate: true, override: true, comments: true })
  .partial()
  .extend({
    substatus: z.string().optional(),
    deadline: z.string().nullable().optional(),
  });

export const transitionSchema = z.object({
  status: z.enum(tuple(RequestStatuses)),
  reason: z.string().max(2000).optional(),
});

export const eventSchema = z.object({
  threadId: z.string().optional(),
  parentEventId: z.string().optional(),
  type: z.enum(tuple(EventTypes)).optional(),
  visibility: z.enum(tuple(Visibilities)).optional(),
  body: z.string().max(20000).optional(),
  mentions: z.array(z.string()).optional(),
  assigneeId: z.string().optional(),
  taskType: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  deliverableId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  scheduleFollowUpAt: z.string().optional(),
  followUpNote: z.string().optional(),
});

export const threadSchema = z.object({
  parentThreadId: z.string().nullable().optional(),
  type: z.enum(tuple(ThreadTypes)).optional(),
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  priority: z.enum(tuple(Priorities)).optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
});

export const updateThreadSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().optional(),
  status: z.enum(tuple(ThreadStatuses)).optional(),
  priority: z.enum(tuple(Priorities)).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export const closeThreadSchema = z.object({
  reason: z.string().max(2000).optional(),
});

export const documentMetadataSchema = z.object({
  documentType: z.enum(tuple(DocumentTypes)).optional(),
  classification: z.enum(tuple(Classifications)).optional(),
  visibility: z.enum(tuple(Visibilities)).optional(),
  threadId: z.string().optional(),
  deliverableId: z.string().optional(),
  expiryDate: z.string().optional(),
});

export const createDeliverableSchema = z.object({
  threadId: z.string().optional(),
  type: z.enum(tuple(DeliverableTypes)).optional(),
  name: z.string().min(1).max(300),
  description: z.string().optional(),
  status: z.enum(tuple(DeliverableStatuses)).optional(),
  ownerId: z.string().optional(),
  validatorId: z.string().optional(),
  dueDate: z.string().optional(),
  sourceType: z.enum(['manual', 'canonical_answer', 'kb_document', 'generated']).optional(),
  sourceId: z.string().optional(),
  clientVisible: z.boolean().optional(),
});

export const updateDeliverableSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  description: z.string().optional(),
  status: z.enum(tuple(DeliverableStatuses)).optional(),
  version: z.number().int().min(1).optional(),
  ownerId: z.string().optional(),
  validatorId: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  clientVisible: z.boolean().optional(),
});

export const slaPolicySchema = z.object({
  name: z.string().min(1),
  requestType: z.enum(tuple(RequestTypes)).optional().nullable(),
  priority: z.enum(tuple(Priorities)).optional().nullable(),
  clientType: z.string().optional().nullable(),
  businessHoursOnly: z.boolean().optional(),
  responseHours: z.number().min(0).max(1000).optional(),
  resolutionHours: z.number().min(1).max(5000).optional(),
  atRiskThresholdPct: z.number().min(0).max(100).optional(),
  pauseOnWaitingClient: z.boolean().optional(),
  calendarId: z.string().optional().nullable(),
  active: z.boolean().optional(),
  order: z.number().optional(),
});

export const businessCalendarSchema = z.object({
  name: z.string().min(1),
  timezone: z.string().optional(),
  workdays: z.array(z.number().int().min(0).max(6)).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  holidays: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export const cveAdvisorySchema = z.object({
  cveId: z.string().min(1),
  title: z.string().min(1),
  severity: z.enum(tuple(Severities)).optional(),
  cvssScore: z.number().min(0).max(10).optional(),
  products: z.array(z.string()).optional(),
  publishedAt: z.string().optional(),
  summary: z.string().optional(),
  posture: z.enum(['not_affected', 'affected', 'under_review', 'mitigated', 'unknown']).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  sourceUrl: z.string().optional(),
  communicationTemplate: z.string().optional(),
});

export const cveImpactSchema = z.object({
  clientId: z.string().min(1),
  affected: z.boolean().optional(),
  rationale: z.string().optional(),
  posture: z.enum(['not_affected', 'affected', 'under_review', 'mitigated', 'unknown']).optional(),
  responseText: z.string().optional(),
  communicate: z.boolean().optional(),
  requestId: z.string().optional(),
  threadId: z.string().optional(),
});

export const cveSubscriptionSchema = z.object({
  enabled: z.boolean().optional(),
  severityThreshold: z.enum(tuple(Severities)).optional(),
  recipients: z.array(z.string()).optional(),
});

export const notificationPreferencesSchema = z.object({
  inApp: z.boolean().optional(),
  email: z.boolean().optional(),
  webhook: z.boolean().optional(),
  types: z.array(z.string()).optional(),
});

export const classifyIntakeSchema = z.object({
  text: z.string().min(3).max(20000),
});

export const duplicateCheckSchema = z.object({
  clientId: z.string().min(1),
  requestType: z.enum(tuple(RequestTypes)).optional(),
  title: z.string().optional(),
  scope: z.string().optional(),
  semantic: z.boolean().optional(),
});

export const followupDraftSchema = z.object({
  instructions: z.string().max(4000).optional(),
});

export const summarySchema = z.object({
  includeInternal: z.boolean().optional(),
});

export const artifactAcceptSchema = z.object({
  editedContent: z.string().optional(),
});

export const emailInboundSchema = z.object({
  from: z.string().min(3),
  to: z.string().optional(),
  subject: z.string().min(1),
  text: z.string().optional(),
  html: z.string().optional(),
  clientId: z.string().optional(),
  requestId: z.string().optional(),
});

export const scheduleFollowUpSchema = z.object({
  dueAt: z.string().min(1),
  note: z.string().max(2000).optional(),
  assigneeId: z.string().optional(),
  threadId: z.string().optional(),
  createTask: z.boolean().optional(),
});

export type CreateRequestPayload = z.infer<typeof createRequestSchema>;
export type UpdateRequestPayload = z.infer<typeof updateRequestSchema>;

export class ValidationError extends Error {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  details: any;
  constructor(details: any) {
    super('Validation failed');
    this.details = details;
  }
}

export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues);
  }
  return result.data;
}
