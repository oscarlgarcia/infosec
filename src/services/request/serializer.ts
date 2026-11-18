import { normalizeStatus, toLegacyStatus } from '../../types/request';

function idOf(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString?.();
}

function dateOf(value: any): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function serializeAttachment(attachment: any) {
  return {
    id: idOf(attachment?._id) || attachment?.filename,
    filename: attachment?.filename,
    originalName: attachment?.originalName,
    path: attachment?.path,
    mimeType: attachment?.mimeType,
    size: attachment?.size,
    createdAt: attachment?.createdAt,
  };
}

export function serializeDocument(doc: any) {
  if (!doc) return null;
  const node = doc.toObject ? doc.toObject() : doc;
  return {
    id: idOf(node._id),
    requestId: idOf(node.requestId),
    threadId: idOf(node.threadId),
    deliverableId: idOf(node.deliverableId),
    documentType: node.documentType,
    classification: node.classification,
    visibility: node.visibility,
    filename: node.filename,
    originalName: node.originalName,
    mimeType: node.mimeType,
    size: node.size,
    checksum: node.checksum,
    version: node.version,
    supersedesId: idOf(node.supersedesId),
    source: node.source,
    sourceRef: node.sourceRef,
    expiryDate: node.expiryDate,
    storageProvider: node.storageProvider,
    uploadedBy: node.uploadedBy,
    deletedAt: node.deletedAt,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    downloadUrl: `/api/requests/${idOf(node.requestId)}/documents/${idOf(node._id)}/download`,
  };
}

export function serializeEvent(event: any) {
  if (!event) return null;
  const node = event.toObject ? event.toObject() : event;
  return {
    id: idOf(node._id),
    requestId: idOf(node.requestId),
    threadId: idOf(node.threadId),
    parentEventId: idOf(node.parentEventId),
    type: node.type,
    visibility: node.visibility,
    authorId: node.authorId,
    authorName: node.authorName,
    authorRole: node.authorRole,
    partyType: node.partyType,
    body: node.body,
    fromStatus: node.fromStatus,
    toStatus: node.toStatus,
    assigneeId: node.assigneeId,
    taskId: idOf(node.taskId),
    taskType: node.taskType,
    documentIds: (node.documentIds || []).map((d: any) => idOf(d)).filter(Boolean),
    deliverableId: idOf(node.deliverableId),
    mentions: node.mentions || [],
    metadata: node.metadata || {},
    createdAt: node.createdAt,
  };
}

export function serializeThread(thread: any, extras: { eventCount?: number; lastEventAt?: Date } = {}) {
  if (!thread) return null;
  const node = thread.toObject ? thread.toObject() : thread;
  return {
    id: idOf(node._id),
    requestId: idOf(node.requestId),
    parentThreadId: idOf(node.parentThreadId),
    type: node.type,
    title: node.title,
    description: node.description,
    status: node.status,
    priority: node.priority,
    assigneeId: node.assigneeId,
    dueDate: node.dueDate,
    deliverableIds: (node.deliverableIds || []).map((d: any) => idOf(d)).filter(Boolean),
    closedAt: node.closedAt,
    lastActivityAt: node.lastActivityAt,
    createdBy: node.createdBy,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    eventCount: extras.eventCount,
    lastEventAt: extras.lastEventAt,
  };
}

export function serializeDeliverable(deliverable: any) {
  if (!deliverable) return null;
  const node = deliverable.toObject ? deliverable.toObject() : deliverable;
  return {
    id: idOf(node._id),
    requestId: idOf(node.requestId),
    threadId: idOf(node.threadId),
    type: node.type,
    name: node.name,
    description: node.description,
    status: node.status,
    version: node.version,
    ownerId: node.ownerId,
    validatorId: node.validatorId,
    dueDate: node.dueDate,
    sentAt: node.sentAt,
    acceptedAt: node.acceptedAt,
    rejectedAt: node.rejectedAt,
    documentIds: (node.documentIds || []).map((d: any) => idOf(d)).filter(Boolean),
    sourceType: node.sourceType,
    sourceId: node.sourceId,
    sourceVersion: node.sourceVersion,
    clientVisible: node.clientVisible,
    createdBy: node.createdBy,
    updatedBy: node.updatedBy,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
}

export function serializeRequest(request: any, extras: Record<string, any> = {}) {
  if (!request) return null;
  const node = request.toObject ? request.toObject({ depopulate: false }) : request;
  const statusNew = normalizeStatus(node.status);
  const client = node.clientId && typeof node.clientId === 'object' && node.clientId.name
    ? {
        id: idOf(node.clientId),
        name: node.clientId.name,
        clientType: node.clientId.clientType,
        country: node.clientId.country,
        customerStatus: node.clientId.customerStatus,
        currentPhase: node.clientId.currentPhase,
        directory: node.clientId.directory,
      }
    : undefined;

  return {
    id: idOf(node._id),
    clientId: idOf(node.clientId),
    client,
    requestKey: node.requestKey,
    legacyRequestKey: node.legacyRequestKey,
    requestKind: node.requestKind || 'standard',
    requestType: node.requestType,
    title: node.title || node.sectionToReview || node.requestType,
    sectionToReview: node.sectionToReview,
    scope: node.scope,
    deadline: dateOf(node.deadline),
    owner: node.owner,
    comments: node.comments,
    status: toLegacyStatus(statusNew),
    statusNew,
    substatus: node.substatus,
    priority: node.priority || 'P3',
    severity: node.severity || 'medium',
    requestChannel: node.requestChannel,
    tags: node.tags || [],
    businessUnit: node.businessUnit,
    contractType: node.contractType,
    clientType: node.clientType,
    contractSigned: node.contractSigned,
    serviceModel: node.serviceModel,
    salesOwnerId: node.salesOwnerId,
    clientOwnerId: node.clientOwnerId,
    infosecOwnerId: node.infosecOwnerId,
    infosecRepoUrl: node.infosecRepoUrl,
    stakeholders: node.stakeholders || [],
    clientSnapshot: node.clientSnapshot,
    slaPolicyId: idOf(node.slaPolicyId),
    slaState: node.slaState || 'on_track',
    slaResponseDueAt: dateOf(node.slaResponseDueAt),
    slaResolutionDueAt: dateOf(node.slaResolutionDueAt),
    slaPausedAt: dateOf(node.slaPausedAt),
    pausedMsTotal: node.pausedMsTotal || 0,
    firstResponseAt: dateOf(node.firstResponseAt),
    deliveredAt: dateOf(node.deliveredAt),
    completedAt: dateOf(node.completedAt),
    closedAt: dateOf(node.closedAt),
    reopenCount: node.reopenCount || 0,
    lastActivityAt: dateOf(node.lastActivityAt),
    duplicateOf: idOf(node.duplicateOf),
    mergedInto: idOf(node.mergedInto),
    attachments: (node.attachments || []).map(serializeAttachment),
    directory: node.directory,
    createdBy: node.createdBy,
    updatedBy: node.updatedBy,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    ...extras,
  };
}
