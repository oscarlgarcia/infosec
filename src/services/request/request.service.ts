import mongoose from 'mongoose';
import {
  Client,
  ClientRequest,
  Deliverable,
  RequestEvent,
  RequestDocument,
  Task,
} from '../../db/mongo/models';
import {
  ActiveRequestStatuses,
  canTransition,
  isTerminalStatus,
  normalizeStatus,
  RequestStatus,
} from '../../types/request';
import { reserveRequestKey } from './numbering';
import { logEvent } from './event.service';
import { serializeDeliverable, serializeDocument, serializeEvent, serializeRequest, serializeThread } from './serializer';
import { addRequestDocuments, UploadActor, UploadFileInput } from './document.service';
import { addSlaTime, applySlaStatusTransition, resolveSlaPolicy } from './sla.service';
import { notifyAssignment } from '../notifications/notification.service';

export interface CreateRequestInput {
  clientId: string;
  requestType: string;
  requestKind?: 'standard' | 'quick_query' | 'cve';
  title?: string;
  sectionToReview?: string;
  scope?: string;
  deadline?: string;
  owner?: string;
  comments?: string;
  priority?: string;
  severity?: string;
  requestChannel?: string;
  tags?: string[];
  businessUnit?: string;
  contractType?: string;
  contractSigned?: boolean;
  serviceModel?: string;
  salesOwnerId?: string;
  clientOwnerId?: string;
  infosecOwnerId?: string;
  infosecRepoUrl?: string;
  stakeholders?: Array<Record<string, any>>;
  documents?: UploadFileInput[];
  overrideDuplicate?: boolean;
}

export interface RequestActor extends UploadActor {
  id?: string;
  email?: string;
}

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'en', 'por', 'para', 'con', 'del', 'al', 'que']);

export function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
    .join(' ');
}

export function similarityScore(left: string, right: string): number {
  const a = new Set(normalizeText(left).split(' ').filter(Boolean));
  const b = new Set(normalizeText(right).split(' ').filter(Boolean));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  a.forEach((word) => { if (b.has(word)) intersection++; });
  return intersection / new Set([...a, ...b]).size;
}

export async function findPossibleDuplicates(data: {
  clientId: string;
  requestType?: string;
  title?: string;
  scope?: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(data.clientId)) return [];
  const query: Record<string, any> = {
    clientId: new mongoose.Types.ObjectId(data.clientId),
    status: { $nin: ['closed', 'cancelled', 'completed'] },
  };
  if (data.requestType) query.requestType = data.requestType;
  const requests = await ClientRequest.find(query).sort({ createdAt: -1 }).limit(25).lean();
  const target = `${data.title || ''} ${data.scope || ''}`.trim();
  return requests
    .map((request: any) => ({
      id: String(request._id),
      requestKey: request.requestKey,
      title: request.title || request.sectionToReview,
      requestType: request.requestType,
      status: normalizeStatus(request.status),
      similarity: target ? Number(similarityScore(target, `${request.title || ''} ${request.scope || request.sectionToReview || ''}`).toFixed(2)) : 0,
    }))
    .filter((candidate) => candidate.similarity >= 0.5)
    .sort((a, b) => b.similarity - a.similarity);
}

async function createKanbanTaskForRequest(request: any, client: any, actor?: RequestActor) {
  if (request.requestKind === 'quick_query') return null;
  try {
    const { getLists } = await import('../tasks/list.service');
    const { createTask } = await import('../tasks/task.service');
    const lists = await getLists();
    const todoList = lists.find((list: any) => list.name === 'TODO') || lists[0];
    if (!todoList) return null;
    const task = await createTask({
      name: `${request.requestKey} · ${request.title || request.requestType}`,
      description: request.scope || request.sectionToReview || '',
      dueDate: request.deadline,
      listId: String(todoList._id),
      requestId: String(request._id),
      clientId: String(client._id),
      priority: request.priority,
      severity: request.severity,
      ownerIds: [request.infosecOwnerId].filter(Boolean),
      requestType: request.requestType,
      requestKey: request.requestKey,
      deadline: request.deadline,
      slaState: request.slaState,
      taskType: request.requestKind === 'cve' ? 'approval' : 'review',
      tags: request.tags || [],
      checklist: [
        { text: 'Review', completed: false, order: 0 },
        { text: 'Assign to Team', completed: false, order: 1 },
        { text: 'Respond', completed: false, order: 2 },
      ],
    });
    await logEvent({
      requestId: request._id,
      type: 'task_linked',
      visibility: 'internal',
      authorId: actor?.id,
      authorName: actor?.username || 'System',
      body: `Tarea Kanban creada: ${task.name}`,
      taskId: task._id,
      taskType: 'review',
    });
    return task;
  } catch (error) {
    console.warn('Could not create Kanban task:', (error as Error).message);
    return null;
  }
}

export async function createRequest(data: CreateRequestInput, actor?: RequestActor) {
  const client = await Client.findById(data.clientId);
  if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });

  const duplicates = data.overrideDuplicate
    ? []
    : await findPossibleDuplicates({
        clientId: data.clientId,
        requestType: data.requestType,
        title: data.title,
        scope: data.scope || data.sectionToReview,
      });

  if (duplicates.length && !data.overrideDuplicate) {
    throw Object.assign(new Error('Possible duplicate request found'), {
      statusCode: 409,
      code: 'POSSIBLE_DUPLICATE',
      duplicates,
    });
  }

  const requestKey = await reserveRequestKey();
  const deadline = data.deadline
    ? (String(data.deadline).includes('T') ? new Date(data.deadline) : new Date(`${data.deadline}T00:00:00`))
    : undefined;

  const request = new ClientRequest({
    clientId: client._id,
    requestKey,
    requestKind: data.requestKind || 'standard',
    requestType: data.requestType,
    title: data.title || data.sectionToReview || data.requestType,
    sectionToReview: data.sectionToReview,
    scope: data.scope || data.sectionToReview,
    deadline,
    owner: data.owner,
    comments: data.comments,
    legacyComments: data.comments,
    status: 'new',
    priority: data.priority || 'P3',
    severity: data.severity || 'medium',
    requestChannel: data.requestChannel || 'email',
    tags: data.tags || [],
    businessUnit: data.businessUnit || client.businessUnit,
    contractType: data.contractType || client.contractType,
    clientType: client.clientType,
    contractSigned: data.contractSigned ?? client.contractSigned,
    serviceModel: data.serviceModel || client.serviceModel,
    salesOwnerId: data.salesOwnerId || client.salesOwnerId,
    clientOwnerId: data.clientOwnerId || client.clientOwnerId,
    infosecOwnerId: data.infosecOwnerId || client.infosecOwnerId,
    infosecRepoUrl: data.infosecRepoUrl || client.infosecRepoUrl,
    stakeholders: data.stakeholders?.length ? data.stakeholders : client.stakeholders,
    clientSnapshot: {
      name: client.name,
      country: client.country,
      clientType: client.clientType,
      contractType: client.contractType,
      contractSigned: client.contractSigned,
      serviceModel: client.serviceModel,
      businessUnit: client.businessUnit,
      customerStatus: client.customerStatus,
      currentPhase: client.currentPhase,
      stakeholders: client.stakeholders || [],
    },
    lastActivityAt: new Date(),
    createdBy: actor?.id || actor?.username,
    updatedBy: actor?.id || actor?.username,
  });

  const { policy, calendar } = await resolveSlaPolicy(request);
  const start = new Date();
  request.slaPolicyId = policy._id;
  request.slaResponseDueAt = addSlaTime(start, policy.responseHours ?? 8, policy, calendar);
  request.slaResolutionDueAt = addSlaTime(start, policy.resolutionHours ?? 72, policy, calendar);
  await request.save();

  await logEvent({
    requestId: request._id,
    type: 'system',
    visibility: 'internal',
    authorId: actor?.id,
    authorName: actor?.username || 'System',
    body: `Solicitud creada (${request.requestKind})`,
    metadata: { requestKey },
  });
  if (data.comments) {
    await logEvent({
      requestId: request._id,
      type: 'comment',
      visibility: 'internal',
      authorId: actor?.id,
      authorName: actor?.username || 'System',
      authorRole: actor?.role,
      body: data.comments,
    });
  }
  if (request.infosecOwnerId) {
    notifyAssignment({
      userId: request.infosecOwnerId,
      requestId: String(request._id),
      requestKey,
      title: request.title || request.requestType,
    }).catch(() => undefined);
  }

  if (data.documents?.length) {
    await addRequestDocuments({
      requestId: String(request._id),
      files: data.documents,
      actor,
    });
  }

  await createKanbanTaskForRequest(request, client, actor);
  await request.save();
  return serializeRequest(request);
}

export interface ListRequestsFilters {
  status?: string;
  priority?: string;
  severity?: string;
  ownerId?: string;
  clientId?: string;
  requestType?: string;
  requestKind?: string;
  tag?: string;
  overdue?: boolean;
  slaState?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  includeClosed?: boolean;
  includeDeleted?: boolean;
}

export async function listRequests(filters: ListRequestsFilters = {}) {
  const query: Record<string, any> = {};
  if (!filters.includeDeleted) query.isDeleted = { $ne: true };
  if (filters.status) {
    const statuses = String(filters.status).split(',').map((status) => status.trim()).filter(Boolean);
    query.status = { $in: statuses };
  } else if (!filters.includeClosed) {
    query.status = { $nin: ['closed', 'cancelled', 'completed'] };
  }
  if (filters.priority) query.priority = filters.priority;
  if (filters.severity) query.severity = filters.severity;
  if (filters.ownerId) {
    query.$or = [
      { infosecOwnerId: filters.ownerId },
      { salesOwnerId: filters.ownerId },
      { clientOwnerId: filters.ownerId },
    ];
  }
  if (filters.clientId) query.clientId = filters.clientId;
  if (filters.requestType) query.requestType = filters.requestType;
  if (filters.requestKind) query.requestKind = filters.requestKind;
  if (filters.tag) query.tags = filters.tag;
  if (filters.slaState) query.slaState = filters.slaState;
  if (filters.overdue) query.deadline = { $lt: new Date() };
  if (filters.from || filters.to) {
    query.createdAt = {};
    if (filters.from) query.createdAt.$gte = new Date(filters.from);
    if (filters.to) query.createdAt.$lte = new Date(filters.to);
  }
  if (filters.q) {
    const regex = new RegExp(String(filters.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$and = [
      ...(query.$and || []),
      { $or: [{ requestKey: regex }, { title: regex }, { scope: regex }, { sectionToReview: regex }] },
    ];
  }

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 25));

  const [items, total] = await Promise.all([
    ClientRequest.find(query)
      .populate('clientId', 'name clientType country customerStatus currentPhase directory')
      .sort({ priority: 1, deadline: 1, lastActivityAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ClientRequest.countDocuments(query),
  ]);

  return {
    items: items.map((item: any) => serializeRequest(item)),
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
}

export async function getRequestById(requestId: string) {
  if (!mongoose.Types.ObjectId.isValid(requestId)) return null;
  const request = await ClientRequest.findById(requestId)
    .populate('clientId', 'name clientType country customerStatus currentPhase contractType serviceModel businessUnit stakeholders directory')
    .lean();
  return serializeRequest(request);
}

export interface RequestDirectoryInput {
  localPath: string;
}

export async function saveRequestDirectory(
  requestId: string,
  data: RequestDirectoryInput,
  addedBy?: string
) {
  if (!mongoose.Types.ObjectId.isValid(requestId)) return null;
  const updated = await ClientRequest.findByIdAndUpdate(
    requestId,
    {
      directory: {
        localPath: data.localPath,
        addedBy,
      },
    },
    { new: true, runValidators: true }
  ).lean();
  return serializeRequest(updated);
}

export async function deleteRequestDirectory(requestId: string) {
  if (!mongoose.Types.ObjectId.isValid(requestId)) return null;
  const updated = await ClientRequest.findByIdAndUpdate(
    requestId,
    { $unset: { directory: 1 } },
    { new: true }
  ).lean();
  if (!updated) return null;
  return serializeRequest(updated);
}

export async function getRequest360(requestId: string, options: { includeInternal?: boolean } = {}) {
  const request = await getRequestById(requestId);
  if (!request) return null;

  const objectId = new mongoose.Types.ObjectId(requestId);
  const eventQuery: Record<string, any> = { requestId: objectId };
  if (options.includeInternal === false) eventQuery.visibility = { $in: ['client', 'public'] };

  const [events, threads, documents, deliverables, tasks, eventCount] = await Promise.all([
    RequestEvent.find(eventQuery).sort({ createdAt: -1 }).limit(100).lean(),
    (await import('../../db/mongo/models')).RequestThread.find({ requestId: objectId }).sort({ createdAt: 1 }).lean(),
    RequestDocument.find({ requestId: objectId, deletedAt: null }).sort({ createdAt: -1 }).lean(),
    Deliverable.find({ requestId: objectId }).sort({ createdAt: -1 }).lean(),
    Task.find({ requestId: objectId }).sort({ createdAt: -1 }).lean(),
    RequestEvent.countDocuments({ requestId: objectId }),
  ]);

  const threadStats = await RequestEvent.aggregate([
    { $match: { requestId: objectId, threadId: { $ne: null } } },
    { $group: { _id: '$threadId', count: { $sum: 1 }, lastEventAt: { $max: '$createdAt' } } },
  ]);
  const statsByThread = new Map(threadStats.map((stat: any) => [String(stat._id), stat]));

  return {
    request,
    counts: {
      events: eventCount,
      threads: threads.length,
      documents: documents.length,
      deliverables: deliverables.length,
      tasks: tasks.length,
    },
    events: events.map(serializeEvent),
    threads: threads.map((thread: any) => serializeThread(thread, {
      eventCount: statsByThread.get(String(thread._id))?.count || 0,
      lastEventAt: statsByThread.get(String(thread._id))?.lastEventAt,
    })),
    documents: documents.map(serializeDocument),
    deliverables: deliverables.map(serializeDeliverable),
    tasks,
  };
}

export interface UpdateRequestInput {
  title?: string;
  sectionToReview?: string;
  scope?: string;
  deadline?: string | null;
  priority?: string;
  severity?: string;
  tags?: string[];
  businessUnit?: string;
  contractType?: string;
  contractSigned?: boolean;
  serviceModel?: string;
  requestChannel?: string;
  salesOwnerId?: string;
  clientOwnerId?: string;
  infosecOwnerId?: string;
  infosecRepoUrl?: string;
  stakeholders?: Array<Record<string, any>>;
  substatus?: string;
  requestType?: string;
}

export async function updateRequest(requestId: string, data: UpdateRequestInput, actor?: RequestActor) {
  const request = await ClientRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });

  const previousDeadline = request.deadline ? new Date(request.deadline).getTime() : null;
  const previousOwners = {
    salesOwnerId: request.salesOwnerId,
    clientOwnerId: request.clientOwnerId,
    infosecOwnerId: request.infosecOwnerId,
  };

  const update: Record<string, any> = {};
  const assignable = [
    'title', 'sectionToReview', 'scope', 'priority', 'severity', 'tags', 'businessUnit',
    'contractType', 'contractSigned', 'serviceModel', 'requestChannel', 'salesOwnerId',
    'clientOwnerId', 'infosecOwnerId', 'infosecRepoUrl', 'stakeholders', 'substatus', 'requestType',
  ] as const;
  for (const key of assignable) {
    if (data[key] !== undefined) update[key] = data[key];
  }
  if (data.deadline !== undefined) {
    update.deadline = data.deadline
      ? (String(data.deadline).includes('T') ? new Date(data.deadline) : new Date(`${data.deadline}T00:00:00`))
      : null;
  }
  update.updatedBy = actor?.id || actor?.username;
  update.lastActivityAt = new Date();
  Object.assign(request, update);
  await request.save();

  if (data.deadline !== undefined && (request.deadline ? new Date(request.deadline).getTime() : null) !== previousDeadline) {
    await logEvent({
      requestId: request._id,
      type: 'deadline_changed',
      visibility: 'internal',
      authorId: actor?.id,
      authorName: actor?.username || 'InfoSec',
      authorRole: actor?.role,
      body: `Deadline actualizado${request.deadline ? ` a ${new Date(request.deadline).toISOString().slice(0, 10)}` : ' (eliminado)'}`,
      metadata: { previousDeadline, newDeadline: request.deadline },
    });
  }

  for (const [field, previous] of Object.entries(previousOwners)) {
    const next = (request as any)[field];
    if (data[field] !== undefined && String(previous || '') !== String(next || '')) {
      await logEvent({
        requestId: request._id,
        type: 'assignment',
        visibility: 'internal',
        authorId: actor?.id,
        authorName: actor?.username || 'InfoSec',
        authorRole: actor?.role,
        body: `Asignación actualizada (${field}): ${next || 'sin asignar'}`,
        assigneeId: next,
        metadata: { field, previous, next },
      });
      if (next) {
        notifyAssignment({
          userId: next,
          requestId: String(request._id),
          requestKey: request.requestKey,
          title: request.title || request.requestType,
        }).catch(() => undefined);
      }
    }
  }

  if (data.tags?.length || data.priority || data.severity) {
    await Task.updateMany(
      { requestId: request._id },
      { $set: { tags: request.tags, priority: request.priority, severity: request.severity } }
    );
  }

  return serializeRequest(request);
}

export async function transitionRequest(requestId: string, toStatus: string, options: { reason?: string; actor?: RequestActor } = {}) {
  const request = await ClientRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });

  const fromStatus = normalizeStatus(request.status);
  const targetStatus = normalizeStatus(toStatus);
  if (!canTransition(fromStatus, targetStatus)) {
    throw Object.assign(new Error(`Transition ${fromStatus} → ${targetStatus} is not allowed`), {
      statusCode: 400,
      code: 'INVALID_TRANSITION',
    });
  }

  const now = new Date();
  if (fromStatus === 'closed' || fromStatus === 'cancelled') {
    request.reopenCount = Number(request.reopenCount || 0) + 1;
  }

  request.status = targetStatus as RequestStatus;
  request.updatedBy = options.actor?.id || options.actor?.username;
  request.lastActivityAt = now;

  if (targetStatus === 'delivered') request.deliveredAt = now;
  if (targetStatus === 'closed') {
    request.closedAt = now;
    request.completedAt = now;
  }
  if (targetStatus === 'in_analysis' && fromStatus === 'closed') {
    request.closedAt = undefined;
    request.completedAt = undefined;
  }

  await applySlaStatusTransition(request, targetStatus, now);
  await request.save();

  await logEvent({
    requestId: request._id,
    type: fromStatus === 'closed' && targetStatus === 'in_analysis' ? 'reopened' : 'status_change',
    visibility: 'internal',
    authorId: options.actor?.id,
    authorName: options.actor?.username || 'InfoSec',
    authorRole: options.actor?.role,
    body: options.reason || `Estado: ${fromStatus} → ${targetStatus}`,
    fromStatus,
    toStatus: targetStatus,
  });

  await Task.updateMany(
    { requestId: request._id },
    { $set: { slaState: request.slaState, deadline: request.deadline } }
  );
  await Task.updateMany(
    { requestId: request._id, status: { $ne: 'Completed' } },
    { $set: { status: targetStatus === 'working' || targetStatus === 'in_analysis' ? 'In Progress' : targetStatus === 'closed' || targetStatus === 'delivered' ? 'Completed' : 'Not Started' } }
  );

  return serializeRequest(request);
}

export async function promoteQuickQuery(requestId: string, actor?: RequestActor) {
  const request = await ClientRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  if (request.requestKind !== 'quick_query') {
    throw Object.assign(new Error('Only quick queries can be promoted'), { statusCode: 400 });
  }
  request.requestKind = 'standard';
  request.updatedBy = actor?.id || actor?.username;
  await request.save();
  await logEvent({
    requestId: request._id,
    type: 'system',
    visibility: 'internal',
    authorId: actor?.id,
    authorName: actor?.username || 'InfoSec',
    body: 'Consulta rápida promovida a solicitud estándar',
  });
  const client = await Client.findById(request.clientId);
  if (client) await createKanbanTaskForRequest(request, client, actor);
  return serializeRequest(request);
}

export async function getMyInbox(userId: string) {
  const requests = await ClientRequest.find({
    status: { $nin: ['closed', 'cancelled', 'completed'] },
    $or: [
      { infosecOwnerId: userId },
      { salesOwnerId: userId },
      { clientOwnerId: userId },
      { 'stakeholders.userId': userId },
    ],
  })
    .populate('clientId', 'name clientType country')
    .sort({ priority: 1, deadline: 1 })
    .limit(100)
    .lean();
  return requests.map((request: any) => serializeRequest(request));
}

export async function assertRequestAccess(requestId: string, user?: { id?: string; role?: string }) {
  const request = await ClientRequest.findById(requestId).lean();
  if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  if (!user || user.role === 'admin' || user.role === 'manager') return request;
  const isOwner = [request.infosecOwnerId, request.salesOwnerId, request.clientOwnerId].includes(user.id);
  const isStakeholder = (request.stakeholders || []).some((stakeholder: any) => stakeholder.userId === user.id);
  if (!isOwner && !isStakeholder) {
    throw Object.assign(new Error('Access denied for this request'), { statusCode: 403 });
  }
  return request;
}

export async function getRequestSummaryCounts(requestId: string) {
  const [events, documents, deliverables, openThreads] = await Promise.all([
    RequestEvent.countDocuments({ requestId }),
    RequestDocument.countDocuments({ requestId, deletedAt: null }),
    Deliverable.countDocuments({ requestId }),
    (await import('../../db/mongo/models')).RequestThread.countDocuments({ requestId, status: { $nin: ['done', 'cancelled'] } }),
  ]);
  return { events, documents, deliverables, openThreads };
}

/**
 * Soft delete keeps the full audit trail. Requests are never physically
 * removed; the logbook records who deleted it and why.
 */
export async function softDeleteRequest(requestId: string, actor?: RequestActor, reason?: string) {
  const request = await ClientRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  request.isDeleted = true;
  request.deletedAt = new Date();
  request.deletedBy = actor?.id || actor?.username;
  request.deleteReason = reason;
  request.lastActivityAt = new Date();
  await request.save();

  await logEvent({
    requestId: request._id,
    type: 'system',
    visibility: 'internal',
    authorId: actor?.id,
    authorName: actor?.username || 'System',
    authorRole: actor?.role,
    body: `Solicitud eliminada (soft delete)${reason ? `: ${reason}` : ''}`,
    metadata: { deletedAt: request.deletedAt },
  });
  return serializeRequest(request);
}

export async function restoreRequest(requestId: string, actor?: RequestActor) {
  const request = await ClientRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  request.isDeleted = false;
  request.deletedAt = undefined;
  request.deletedBy = undefined;
  request.deleteReason = undefined;
  request.lastActivityAt = new Date();
  await request.save();

  await logEvent({
    requestId: request._id,
    type: 'system',
    visibility: 'internal',
    authorId: actor?.id,
    authorName: actor?.username || 'System',
    body: 'Solicitud restaurada',
  });
  return serializeRequest(request);
}
