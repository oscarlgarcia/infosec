import mongoose from 'mongoose';
import { CanonicalAnswer, ClientRequest, Deliverable, DocumentModel, RequestDocument, RequestThread } from '../../db/mongo/models';
import { DeliverableStatus } from '../../types/request';
import { serializeDeliverable, serializeDocument } from './serializer';
import { logEvent } from './event.service';
import { RequestActor } from './request.service';
import { addRequestDocuments, UploadFileInput } from './document.service';

export interface CreateDeliverableInput {
  threadId?: string;
  type?: string;
  name: string;
  description?: string;
  status?: DeliverableStatus;
  ownerId?: string;
  validatorId?: string;
  dueDate?: string;
  sourceType?: 'manual' | 'canonical_answer' | 'kb_document' | 'generated';
  sourceId?: string;
  clientVisible?: boolean;
  documents?: UploadFileInput[];
}

export async function listDeliverables(requestId: string, filters: { status?: string; threadId?: string } = {}) {
  const query: Record<string, any> = { requestId: new mongoose.Types.ObjectId(requestId) };
  if (filters.status) query.status = filters.status;
  if (filters.threadId) query.threadId = filters.threadId;
  const items = await Deliverable.find(query).sort({ createdAt: -1 }).lean();
  return items.map(serializeDeliverable);
}

export async function getDeliverable(requestId: string, deliverableId: string) {
  const deliverable = await Deliverable.findOne({ _id: deliverableId, requestId }).lean();
  if (!deliverable) throw Object.assign(new Error('Deliverable not found'), { statusCode: 404 });
  const documents = await RequestDocument.find({ deliverableId, deletedAt: null }).lean();
  return { ...serializeDeliverable(deliverable), documents: documents.map(serializeDocument) };
}

async function resolveSource(data: CreateDeliverableInput) {
  if (data.sourceType === 'canonical_answer' && data.sourceId) {
    const canonical = await CanonicalAnswer.findById(data.sourceId).lean();
    if (!canonical) throw Object.assign(new Error('Canonical answer not found'), { statusCode: 404 });
    const version = (canonical.versions || []).length + 1;
    return {
      sourceType: 'canonical_answer' as const,
      sourceId: data.sourceId,
      sourceVersion: String(version),
      sourceSnapshot: canonical.currentAnswer,
      description: data.description || `Basado en respuesta canónica: ${canonical.question}`,
      type: data.type || 'questionnaire_response',
    };
  }
  if (data.sourceType === 'kb_document' && data.sourceId) {
    const document = await DocumentModel.findById(data.sourceId).lean();
    if (!document) throw Object.assign(new Error('Knowledge document not found'), { statusCode: 404 });
    return {
      sourceType: 'kb_document' as const,
      sourceId: data.sourceId,
      sourceVersion: (document as any).version ? String((document as any).version) : undefined,
      sourceSnapshot: (document as any).summary || (document as any).title || undefined,
      description: data.description || `Basado en documento KB: ${(document as any).title || (document as any).originalName || data.sourceId}`,
      type: data.type || 'guide',
    };
  }
  return {
    sourceType: data.sourceType || 'manual',
    sourceId: data.sourceId,
    sourceVersion: undefined,
    sourceSnapshot: undefined,
    description: data.description,
    type: data.type || 'other',
  };
}

export async function createDeliverable(requestId: string, data: CreateDeliverableInput, actor?: RequestActor) {
  const request = await ClientRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  if (data.threadId) {
    const thread = await RequestThread.findOne({ _id: data.threadId, requestId });
    if (!thread) throw Object.assign(new Error('Thread not found'), { statusCode: 404 });
  }

  const source = await resolveSource(data);
  const deliverable = await Deliverable.create({
    requestId: request._id,
    threadId: data.threadId || undefined,
    type: source.type,
    name: data.name,
    description: source.description,
    status: data.status || 'pending',
    ownerId: data.ownerId,
    validatorId: data.validatorId,
    dueDate: data.dueDate ? new Date(data.dueDate) : request.deadline,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    sourceVersion: source.sourceVersion,
    sourceSnapshot: source.sourceSnapshot,
    clientVisible: Boolean(data.clientVisible),
    createdBy: actor?.id || actor?.username,
    updatedBy: actor?.id || actor?.username,
  });

  if (data.threadId) {
    await RequestThread.updateOne({ _id: data.threadId }, { $addToSet: { deliverableIds: deliverable._id } });
  }

  if (data.documents?.length) {
    const { documents } = await addRequestDocuments({
      requestId,
      files: data.documents.map((file) => ({ ...file, deliverableId: String(deliverable._id), threadId: data.threadId })),
      actor,
    });
    deliverable.documentIds = documents.map((document: any) => new mongoose.Types.ObjectId(document.id));
    await deliverable.save();
  }

  await logEvent({
    requestId: request._id,
    threadId: deliverable.threadId,
    type: 'system',
    visibility: 'internal',
    authorId: actor?.id,
    authorName: actor?.username || 'InfoSec',
    authorRole: actor?.role,
    body: `Entregable creado: ${deliverable.name} (${deliverable.type})`,
    deliverableId: deliverable._id,
    metadata: {
      sourceType: deliverable.sourceType,
      sourceId: deliverable.sourceId,
      sourceVersion: deliverable.sourceVersion,
    },
  });

  return serializeDeliverable(deliverable);
}

export interface UpdateDeliverableInput {
  name?: string;
  description?: string;
  status?: DeliverableStatus;
  version?: number;
  ownerId?: string;
  validatorId?: string;
  dueDate?: string;
  clientVisible?: boolean;
}

export async function updateDeliverable(
  requestId: string,
  deliverableId: string,
  data: UpdateDeliverableInput,
  actor?: RequestActor
) {
  const deliverable = await Deliverable.findOne({ _id: deliverableId, requestId });
  if (!deliverable) throw Object.assign(new Error('Deliverable not found'), { statusCode: 404 });

  const previousStatus = deliverable.status;
  for (const key of ['name', 'description', 'status', 'version', 'ownerId', 'validatorId', 'clientVisible'] as const) {
    if (data[key] !== undefined) (deliverable as any)[key] = data[key];
  }
  if (data.dueDate !== undefined) deliverable.dueDate = data.dueDate ? new Date(data.dueDate) : undefined;
  if (data.status === 'sent' && !deliverable.sentAt) deliverable.sentAt = new Date();
  if (data.status === 'accepted' && !deliverable.acceptedAt) deliverable.acceptedAt = new Date();
  if (data.status === 'rejected' && !deliverable.rejectedAt) deliverable.rejectedAt = new Date();
  deliverable.updatedBy = actor?.id || actor?.username;
  await deliverable.save();

  if (previousStatus !== deliverable.status) {
    const clientVisible = deliverable.status === 'sent' || deliverable.status === 'accepted';
    await logEvent({
      requestId,
      threadId: deliverable.threadId,
      type: deliverable.status === 'sent' ? 'deliverable_sent' : 'system',
      visibility: clientVisible ? 'client' : 'internal',
      authorId: actor?.id,
      authorName: actor?.username || 'InfoSec',
      authorRole: actor?.role,
      body: `Entregable ${deliverable.name}: ${previousStatus} → ${deliverable.status}`,
      deliverableId: deliverable._id,
      metadata: { from: previousStatus, to: deliverable.status, version: deliverable.version },
    });
  }

  return serializeDeliverable(deliverable);
}

export async function sendDeliverable(requestId: string, deliverableId: string, actor?: RequestActor) {
  return updateDeliverable(requestId, deliverableId, { status: 'sent', clientVisible: true }, actor);
}

export async function attachDocumentToDeliverable(data: {
  requestId: string;
  deliverableId: string;
  documentId: string;
  actor?: RequestActor;
}) {
  const deliverable = await Deliverable.findOne({ _id: data.deliverableId, requestId: data.requestId });
  if (!deliverable) throw Object.assign(new Error('Deliverable not found'), { statusCode: 404 });

  const document = await RequestDocument.findOneAndUpdate(
    { _id: data.documentId, requestId: data.requestId },
    { $set: { deliverableId: deliverable._id } },
    { new: true }
  );
  if (!document) throw Object.assign(new Error('Document not found'), { statusCode: 404 });

  await Deliverable.updateOne({ _id: deliverable._id }, { $addToSet: { documentIds: document._id } });
  await logEvent({
    requestId: data.requestId,
    deliverableId: deliverable._id,
    type: 'document_added',
    visibility: 'internal',
    authorId: data.actor?.id,
    authorName: data.actor?.username || 'InfoSec',
    body: `Documento vinculado al entregable ${deliverable.name}: ${document.originalName}`,
    documentIds: [document._id],
  });
  return serializeDocument(document);
}

export async function getReuseMetrics(windowDays = 90) {
  const since = new Date(Date.now() - windowDays * 86400000);
  const [total, reused] = await Promise.all([
    Deliverable.countDocuments({ createdAt: { $gte: since } }),
    Deliverable.countDocuments({
      createdAt: { $gte: since },
      sourceType: { $in: ['canonical_answer', 'kb_document', 'generated'] },
    }),
  ]);
  return {
    windowDays,
    total,
    reused,
    reusePct: total ? Number(((reused / total) * 100).toFixed(1)) : 0,
  };
}
