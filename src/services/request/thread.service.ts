import mongoose from 'mongoose';
import { ClientRequest, RequestThread } from '../../db/mongo/models';
import { serializeThread } from './serializer';
import { logEvent } from './event.service';
import { RequestActor } from './request.service';

export interface CreateThreadInput {
  parentThreadId?: string | null;
  type?: string;
  title: string;
  description?: string;
  priority?: string;
  assigneeId?: string;
  dueDate?: string;
}

export async function createThread(requestId: string, data: CreateThreadInput, actor?: RequestActor) {
  const request = await ClientRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });

  if (data.parentThreadId) {
    const parent = await RequestThread.findOne({ _id: data.parentThreadId, requestId });
    if (!parent) throw Object.assign(new Error('Parent thread not found'), { statusCode: 404 });
    if (parent.parentThreadId) {
      throw Object.assign(new Error('Threads can only be nested two levels deep'), { statusCode: 400 });
    }
  }

  const thread = await RequestThread.create({
    requestId: request._id,
    parentThreadId: data.parentThreadId || null,
    type: data.type || 'general',
    title: data.title,
    description: data.description,
    priority: data.priority,
    assigneeId: data.assigneeId,
    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    lastActivityAt: new Date(),
    createdBy: actor?.id || actor?.username,
  });

  await logEvent({
    requestId: request._id,
    threadId: thread._id,
    type: 'thread_created',
    visibility: 'internal',
    authorId: actor?.id,
    authorName: actor?.username || 'InfoSec',
    authorRole: actor?.role,
    body: `Hilo creado: ${thread.title}`,
    metadata: { threadType: thread.type, parentThreadId: data.parentThreadId || null },
  });

  return serializeThread(thread);
}

export async function listThreads(requestId: string, options: { includeInternal?: boolean } = {}) {
  const threads = await RequestThread.find({ requestId: new mongoose.Types.ObjectId(requestId) })
    .sort({ createdAt: 1 })
    .lean();

  const stats = await RequestThread.aggregate([
    { $match: { requestId: new mongoose.Types.ObjectId(requestId) } },
    { $lookup: { from: 'requestevents', localField: '_id', foreignField: 'threadId', as: 'events' } },
    { $project: { count: { $size: '$events' }, lastEventAt: { $max: '$events.createdAt' } } },
  ]);
  const statsMap = new Map(stats.map((stat: any) => [String(stat._id), stat]));

  const serialized = threads.map((thread: any) => serializeThread(thread, {
    eventCount: statsMap.get(String(thread._id))?.count || 0,
    lastEventAt: statsMap.get(String(thread._id))?.lastEventAt,
  }));

  const byId = new Map(serialized.map((thread: any) => [thread.id, { ...thread, children: [] as any[] }]));
  const roots: any[] = [];
  for (const thread of byId.values()) {
    if (thread.parentThreadId && byId.has(thread.parentThreadId)) {
      byId.get(thread.parentThreadId)!.children.push(thread);
    } else {
      roots.push(thread);
    }
  }
  return { items: serialized, tree: roots };
}

export async function updateThread(requestId: string, threadId: string, data: Record<string, any>, actor?: RequestActor) {
  const thread = await RequestThread.findOne({ _id: threadId, requestId });
  if (!thread) throw Object.assign(new Error('Thread not found'), { statusCode: 404 });

  const previousStatus = thread.status;
  const allowed = ['title', 'description', 'status', 'priority', 'assigneeId', 'dueDate'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      (thread as any)[key] = key === 'dueDate' && data[key] ? new Date(data[key]) : data[key];
    }
  }
  thread.lastActivityAt = new Date();
  if (thread.status === 'done' && previousStatus !== 'done') thread.closedAt = new Date();
  await thread.save();

  if (previousStatus !== thread.status) {
    await logEvent({
      requestId,
      threadId: thread._id,
      type: thread.status === 'done' ? 'thread_closed' : 'system',
      visibility: 'internal',
      authorId: actor?.id,
      authorName: actor?.username || 'InfoSec',
      authorRole: actor?.role,
      body: `Estado del hilo: ${previousStatus} → ${thread.status}`,
      metadata: { from: previousStatus, to: thread.status },
    });
  }
  return serializeThread(thread);
}

export async function closeThread(requestId: string, threadId: string, reason: string, actor?: RequestActor) {
  const thread = await RequestThread.findOne({ _id: threadId, requestId });
  if (!thread) throw Object.assign(new Error('Thread not found'), { statusCode: 404 });
  thread.status = 'done';
  thread.closedAt = new Date();
  thread.lastActivityAt = new Date();
  await thread.save();
  await logEvent({
    requestId,
    threadId: thread._id,
    type: 'thread_closed',
    visibility: 'internal',
    authorId: actor?.id,
    authorName: actor?.username || 'InfoSec',
    authorRole: actor?.role,
    body: reason || `Hilo cerrado: ${thread.title}`,
  });
  return serializeThread(thread);
}

export async function touchThread(threadId: string | mongoose.Types.ObjectId | undefined | null) {
  if (!threadId) return;
  await RequestThread.updateOne({ _id: threadId }, { $set: { lastActivityAt: new Date() } });
}
