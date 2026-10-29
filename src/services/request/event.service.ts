import mongoose from 'mongoose';
import { ClientRequest, RequestEvent } from '../../db/mongo/models';
import { EventType, Visibility } from '../../types/request';
import { serializeEvent } from './serializer';

export interface LogEventInput {
  requestId: string | mongoose.Types.ObjectId;
  threadId?: string | mongoose.Types.ObjectId | null;
  parentEventId?: string | mongoose.Types.ObjectId | null;
  type: EventType;
  visibility?: Visibility;
  authorId?: string;
  authorName?: string;
  authorRole?: string;
  partyType?: 'internal' | 'client';
  body?: string;
  fromStatus?: string;
  toStatus?: string;
  assigneeId?: string;
  taskId?: string | mongoose.Types.ObjectId | null;
  taskType?: string;
  documentIds?: Array<string | mongoose.Types.ObjectId>;
  deliverableId?: string | mongoose.Types.ObjectId | null;
  mentions?: string[];
  metadata?: Record<string, any>;
}

const FIRST_RESPONSE_EVENT_TYPES: EventType[] = ['comment', 'email', 'deliverable_sent'];

/**
 * Append-only logbook write. Every domain mutation must call this.
 */
export async function logEvent(input: LogEventInput): Promise<any> {
  const event = await RequestEvent.create({
    requestId: input.requestId,
    threadId: input.threadId || undefined,
    parentEventId: input.parentEventId || undefined,
    type: input.type,
    visibility: input.visibility || 'internal',
    authorId: input.authorId,
    authorName: input.authorName,
    authorRole: input.authorRole,
    partyType: input.partyType || 'internal',
    body: input.body || '',
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    assigneeId: input.assigneeId,
    taskId: input.taskId || undefined,
    taskType: input.taskType,
    documentIds: input.documentIds || [],
    deliverableId: input.deliverableId || undefined,
    mentions: input.mentions || [],
    metadata: input.metadata || {},
  });

  const update: Record<string, any> = { lastActivityAt: new Date() };
  const isClientVisible = input.visibility === 'client' || input.visibility === 'public';
  if (isClientVisible && FIRST_RESPONSE_EVENT_TYPES.includes(input.type)) {
    update.firstResponseAt = new Date();
  }
  if (isClientVisible && (input.toStatus === 'waiting_client' || input.toStatus === 'delivered')) {
    update.firstResponseAt = new Date();
  }

  const request = await ClientRequest.findById(input.requestId).select('firstResponseAt');
  if (request?.firstResponseAt) delete update.firstResponseAt;

  await ClientRequest.updateOne({ _id: input.requestId }, { $set: update });

  if (input.mentions?.length) {
    try {
      const { notifyMentions } = await import('../notifications/notification.service');
      await notifyMentions({
        userIds: input.mentions,
        requestId: String(input.requestId),
        authorName: input.authorName || 'InfoSec',
        body: input.body || '',
      });
    } catch (error) {
      console.warn('Could not send mention notifications:', (error as Error).message);
    }
  }

  return serializeEvent(event);
}

export interface ListEventsFilters {
  type?: string;
  visibility?: string;
  threadId?: string;
  authorId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  includeInternal?: boolean;
}

export async function listEvents(requestId: string, filters: ListEventsFilters = {}) {
  const query: Record<string, any> = { requestId: new mongoose.Types.ObjectId(requestId) };
  if (filters.type) query.type = filters.type;
  if (filters.visibility) query.visibility = filters.visibility;
  if (filters.threadId) query.threadId = new mongoose.Types.ObjectId(filters.threadId);
  if (filters.authorId) query.authorId = filters.authorId;
  if (filters.from || filters.to) {
    query.createdAt = {};
    if (filters.from) query.createdAt.$gte = new Date(filters.from);
    if (filters.to) query.createdAt.$lte = new Date(filters.to);
  }
  if (filters.includeInternal === false) query.visibility = { $in: ['client', 'public'] };

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(filters.limit) || 50));

  const [items, total] = await Promise.all([
    RequestEvent.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    RequestEvent.countDocuments(query),
  ]);

  return {
    items: items.map(serializeEvent),
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
}

export async function getEventTimelineForExport(requestId: string, includeInternal = true) {
  const query: Record<string, any> = { requestId: new mongoose.Types.ObjectId(requestId) };
  if (!includeInternal) query.visibility = { $in: ['client', 'public'] };
  const items = await RequestEvent.find(query).sort({ createdAt: 1 }).lean();
  return items.map(serializeEvent);
}
