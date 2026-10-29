import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { verifyToken, requireRole } from '../middleware/auth';
import {
  createRequest,
  getRequest360,
  getRequestById,
  listRequests,
  updateRequest,
  transitionRequest,
  promoteQuickQuery,
  getMyInbox,
  assertRequestAccess,
  findPossibleDuplicates,
  softDeleteRequest,
  restoreRequest,
  RequestActor,
} from '../services/request/request.service';
import { listEvents, logEvent } from '../services/request/event.service';
import { createThread, listThreads, updateThread, closeThread, touchThread } from '../services/request/thread.service';
import {
  addRequestDocuments,
  listRequestDocuments,
  getRequestDocument,
  openDocumentStream,
  softDeleteDocument,
} from '../services/request/document.service';
import {
  createDeliverable,
  listDeliverables,
  getDeliverable,
  updateDeliverable,
  sendDeliverable,
  attachDocumentToDeliverable,
} from '../services/request/deliverable.service';
import { refreshRequestSla } from '../services/request/sla.service';
import { buildLogbookHtml, buildLogbookMarkdown } from '../services/request/export.service';
import {
  acceptArtifact,
  classifyIntake,
  discardArtifact,
  generateCaseSummary,
  generateFollowupDraft,
  generateMeetingMinutes,
  indexRequestInChroma,
  listArtifacts,
  semanticDuplicateCheck,
} from '../services/request/requestAi.service';
import { ScheduledFollowUp } from '../db/mongo/models';
import {
  artifactAcceptSchema,
  classifyIntakeSchema,
  closeThreadSchema,
  createDeliverableSchema,
  createRequestSchema,
  documentMetadataSchema,
  duplicateCheckSchema,
  eventSchema,
  followupDraftSchema,
  parseOrThrow,
  scheduleFollowUpSchema,
  summarySchema,
  threadSchema,
  transitionSchema,
  updateDeliverableSchema,
  updateRequestSchema,
  updateThreadSchema,
  ValidationError,
} from '../schemas/request';

type Json = Record<string, any>;

function actorOf(request: FastifyRequest): RequestActor {
  const user = request.user;
  return {
    id: user?.id,
    username: user?.username || user?.email,
    email: user?.email,
    role: user?.role,
  };
}

function replyError(reply: FastifyReply, error: any) {
  const statusCode = Number(error?.statusCode || 500);
  const body: Json = {
    error: {
      code: error?.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
      message: error?.message || 'Unexpected error',
    },
  };
  if (error?.duplicates) body.error.duplicates = error.duplicates;
  if (error?.details) body.error.details = error.details;
  if (statusCode >= 500) console.error(error);
  return reply.code(statusCode).send(body);
}

function parseJsonField(value: any, fallback: any) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function readMultipart(request: FastifyRequest) {
  const fields: Record<string, string> = {};
  const files: Array<{ filename: string; data: Buffer; mimetype?: string }> = [];
  const parts = (request as any).parts();
  for await (const part of parts) {
    if (part.type === 'file') {
      const buffer = await part.toBuffer();
      if (part.filename) {
        files.push({ filename: part.filename, data: buffer, mimetype: part.mimetype });
      }
    } else if (part.fieldname) {
      fields[part.fieldname] = String(part.value);
    }
  }
  return { fields, files };
}

function isMultipart(request: FastifyRequest) {
  return String(request.headers['content-type'] || '').includes('multipart/form-data');
}

async function readBody(request: FastifyRequest): Promise<Json> {
  if (!isMultipart(request)) return (request.body || {}) as Json;
  const { fields } = await readMultipart(request);
  return fields;
}

function metadataPerFile(fields: Json, count: number) {
  const raw = parseJsonField(fields.fileMetadata || fields.documents, []);
  const metadata = Array.isArray(raw) ? raw : [];
  return Array.from({ length: count }, (_, index) => metadata[index] || {});
}

export async function requestRoutes(fastify: FastifyInstance) {
  fastify.get('/requests', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      const query = request.query as Json;
      const result = await listRequests({
        status: query.status,
        priority: query.priority,
        severity: query.severity,
        ownerId: query.ownerId || query.owner,
        clientId: query.clientId,
        requestType: query.requestType || query.type,
        requestKind: query.requestKind,
        tag: query.tag,
        overdue: query.overdue === 'true' || query.overdue === true,
        slaState: query.slaState,
        q: query.q,
        from: query.from,
        to: query.to,
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 25,
        includeClosed: query.includeClosed === 'true' || query.includeClosed === true,
        includeDeleted: query.includeDeleted === 'true' || query.includeDeleted === true,
      });
      return result;
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get('/requests/my-inbox', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
      return { items: await getMyInbox(request.user.id) };
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post('/requests/check-duplicates', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      const body = parseOrThrow(duplicateCheckSchema, request.body);
      const deterministic = await findPossibleDuplicates({
        clientId: body.clientId,
        requestType: body.requestType,
        title: body.title,
        scope: body.scope,
      });
      const semantic = body.semantic
        ? await semanticDuplicateCheck({ clientId: body.clientId, requestType: body.requestType, title: body.title, scope: body.scope })
        : [];
      return { deterministic, semantic };
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post('/requests/intake/classify', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(classifyIntakeSchema, request.body);
      return await classifyIntake(body.text, actorOf(request));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post('/requests', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      let body: Json;
      let files: Array<{ filename: string; data: Buffer; mimetype?: string }> = [];
      let fileMetadata: any[] = [];
      if (isMultipart(request)) {
        const multipart = await readMultipart(request);
        body = multipart.fields;
        files = multipart.files;
        fileMetadata = metadataPerFile(body, files.length);
      } else {
        body = (request.body || {}) as Json;
      }

      const payload = parseOrThrow(createRequestSchema, {
        ...body,
        tags: parseJsonField(body.tags, undefined),
        stakeholders: parseJsonField(body.stakeholders, undefined),
        contractSigned: body.contractSigned === undefined ? undefined : String(body.contractSigned) === 'true',
        overrideDuplicate: String(body.overrideDuplicate ?? body.override ?? 'false') === 'true',
      });

      const documents = files.map((file, index) => ({
        ...file,
        documentType: fileMetadata[index]?.documentType || 'other',
        visibility: fileMetadata[index]?.visibility || 'internal',
        classification: fileMetadata[index]?.classification || 'internal',
        threadId: fileMetadata[index]?.threadId,
        deliverableId: fileMetadata[index]?.deliverableId,
      }));

      const created = await createRequest({ ...(payload as any), documents }, actorOf(request));
      indexRequestInChroma(created).catch(() => undefined);
      return reply.code(201).send(created);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.patch<{ Params: { id: string } }>('/requests/:id', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(updateRequestSchema, request.body);
      const updated = await updateRequest(request.params.id, body, actorOf(request));
      indexRequestInChroma(updated).catch(() => undefined);
      return updated;
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/requests/:id/status', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(transitionSchema, request.body);
      const updated = await transitionRequest(request.params.id, body.status, {
        reason: body.reason,
        actor: actorOf(request),
      });
      indexRequestInChroma(updated).catch(() => undefined);
      return updated;
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/requests/:id/promote', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      return await promoteQuickQuery(request.params.id, actorOf(request));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.delete<{ Params: { id: string } }>('/requests/:id', { preHandler: [verifyToken, requireRole('admin', 'manager')] }, async (request, reply) => {
    try {
      const body = (request.body || {}) as { reason?: string };
      return await softDeleteRequest(request.params.id, actorOf(request), body.reason);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/requests/:id/restore', { preHandler: [verifyToken, requireRole('admin', 'manager')] }, async (request, reply) => {
    try {
      return await restoreRequest(request.params.id, actorOf(request));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/requests/:id/360', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      await assertRequestAccess(request.params.id, request.user);
      const includeInternal = request.user?.role !== 'usuario';
      const data = await getRequest360(request.params.id, { includeInternal });
      if (!data) return reply.code(404).send({ error: 'Request not found' });
      return data;
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/requests/:id/sla', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      await assertRequestAccess(request.params.id, request.user);
      const refreshed = await refreshRequestSla(request.params.id);
      if (!refreshed) return reply.code(404).send({ error: 'Request not found' });
      const { request: doc, policy } = refreshed;
      return {
        requestId: request.params.id,
        slaState: doc.slaState,
        responseDueAt: doc.slaResponseDueAt,
        resolutionDueAt: doc.slaResolutionDueAt,
        pausedAt: doc.slaPausedAt,
        pausedMsTotal: doc.pausedMsTotal || 0,
        firstResponseAt: doc.firstResponseAt,
        deliveredAt: doc.deliveredAt,
        closedAt: doc.closedAt,
        reopenCount: doc.reopenCount || 0,
        policy,
      };
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/requests/:id/events', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      await assertRequestAccess(request.params.id, request.user);
      const query = request.query as Json;
      return await listEvents(request.params.id, {
        type: query.type,
        visibility: query.visibility,
        threadId: query.threadId,
        authorId: query.authorId || query.author,
        from: query.from,
        to: query.to,
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 50,
        includeInternal: request.user?.role !== 'usuario',
      });
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/requests/:id/events', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      const access = await assertRequestAccess(request.params.id, request.user);
      const body = parseOrThrow(eventSchema, request.body);
      const actor = actorOf(request);
      const event = await logEvent({
        requestId: request.params.id,
        threadId: body.threadId,
        parentEventId: body.parentEventId,
        type: (body.type as any) || 'comment',
        visibility: (body.visibility || 'internal') as any,
        authorId: actor.id,
        authorName: actor.username || 'InfoSec',
        authorRole: actor.role,
        partyType: request.user?.role === 'usuario' ? 'client' : 'internal',
        body: body.body,
        mentions: body.mentions,
        assigneeId: body.assigneeId,
        taskType: body.taskType,
        documentIds: body.documentIds,
        deliverableId: body.deliverableId,
        metadata: body.metadata,
      });

      if (body.threadId) await touchThread(body.threadId);

      if (body.scheduleFollowUpAt) {
        const followUp = await ScheduledFollowUp.create({
          requestId: access._id,
          threadId: body.threadId,
          dueAt: new Date(body.scheduleFollowUpAt),
          note: body.followUpNote || body.body,
          assigneeId: body.assigneeId || actor.id,
          createdBy: actor.id,
        });
        await logEvent({
          requestId: request.params.id,
          threadId: body.threadId,
          type: 'system',
          visibility: 'internal',
          authorId: actor.id,
          authorName: actor.username || 'InfoSec',
          body: `Follow-up programado para ${new Date(body.scheduleFollowUpAt).toISOString()}`,
          metadata: { followUpId: String(followUp._id) },
        });
      }

      return reply.code(201).send(event);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/requests/:id/threads', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      await assertRequestAccess(request.params.id, request.user);
      return await listThreads(request.params.id);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/requests/:id/threads', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(threadSchema, request.body);
      return reply.code(201).send(await createThread(request.params.id, body as any, actorOf(request)));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.patch<{ Params: { id: string; threadId: string } }>('/requests/:id/threads/:threadId', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(updateThreadSchema, request.body);
      return await updateThread(request.params.id, request.params.threadId, body, actorOf(request));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string; threadId: string } }>('/requests/:id/threads/:threadId/close', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(closeThreadSchema, request.body || {});
      return await closeThread(request.params.id, request.params.threadId, body.reason || '', actorOf(request));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/requests/:id/documents', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      await assertRequestAccess(request.params.id, request.user);
      const query = request.query as Json;
      return { items: await listRequestDocuments(request.params.id, query) };
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/requests/:id/documents', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      await assertRequestAccess(request.params.id, request.user);
      if (!isMultipart(request)) {
        return reply.code(415).send({ error: { code: 'MULTIPART_REQUIRED', message: 'Use multipart/form-data' } });
      }
      const { fields, files } = await readMultipart(request);
      if (!files.length) return reply.code(400).send({ error: { code: 'NO_FILES', message: 'No files uploaded' } });
      const metadata = metadataPerFile(fields, files.length);
      const shared = parseOrThrow(documentMetadataSchema, {
        documentType: fields.documentType || undefined,
        classification: fields.classification || undefined,
        visibility: fields.visibility || undefined,
        threadId: fields.threadId || undefined,
        deliverableId: fields.deliverableId || undefined,
        expiryDate: fields.expiryDate || undefined,
      });
      const result = await addRequestDocuments({
        requestId: request.params.id,
        files: files.map((file, index) => ({
          ...file,
          ...shared,
          ...metadata[index],
        })),
        actor: actorOf(request),
      });
      return reply.code(201).send(result);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string; documentId: string } }>('/requests/:id/documents/:documentId/download', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      await assertRequestAccess(request.params.id, request.user);
      const document = await getRequestDocument(request.params.id, request.params.documentId);
      if (!document || document.deletedAt) return reply.code(404).send({ error: 'Document not found' });
      const stream = await openDocumentStream(document);
      const filename = String(document.originalName || document.filename).replace(/["\r\n]/g, '_');
      reply.header('Content-Type', document.mimeType || 'application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('X-Document-Checksum', document.checksum || '');
      return reply.send(stream);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.delete<{ Params: { id: string; documentId: string } }>('/requests/:id/documents/:documentId', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      await softDeleteDocument(request.params.id, request.params.documentId, actorOf(request));
      return reply.code(204).send();
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/requests/:id/deliverables', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      await assertRequestAccess(request.params.id, request.user);
      return { items: await listDeliverables(request.params.id, request.query as Json) };
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/requests/:id/deliverables', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(createDeliverableSchema, request.body);
      return reply.code(201).send(await createDeliverable(request.params.id, body as any, actorOf(request)));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string; deliverableId: string } }>('/requests/:id/deliverables/:deliverableId', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      await assertRequestAccess(request.params.id, request.user);
      return await getDeliverable(request.params.id, request.params.deliverableId);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.patch<{ Params: { id: string; deliverableId: string } }>('/requests/:id/deliverables/:deliverableId', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(updateDeliverableSchema, request.body);
      return await updateDeliverable(request.params.id, request.params.deliverableId, body as any, actorOf(request));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string; deliverableId: string } }>('/requests/:id/deliverables/:deliverableId/send', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      return await sendDeliverable(request.params.id, request.params.deliverableId, actorOf(request));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string; deliverableId: string; documentId: string } }>('/requests/:id/deliverables/:deliverableId/documents/:documentId', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      return await attachDocumentToDeliverable({
        requestId: request.params.id,
        deliverableId: request.params.deliverableId,
        documentId: request.params.documentId,
        actor: actorOf(request),
      });
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/requests/:id/logbook.md', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      await assertRequestAccess(request.params.id, request.user);
      const includeInternal = request.user?.role !== 'usuario'
        && String((request.query as Json).includeInternal ?? 'true') !== 'false';
      const { markdown, request: doc } = await buildLogbookMarkdown(request.params.id, { includeInternal });
      reply.header('Content-Type', 'text/markdown; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="${doc.requestKey}-logbook.md"`);
      return reply.send(markdown);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/requests/:id/logbook.html', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      await assertRequestAccess(request.params.id, request.user);
      const includeInternal = request.user?.role !== 'usuario'
        && String((request.query as Json).includeInternal ?? 'true') !== 'false';
      const html = await buildLogbookHtml(request.params.id, { includeInternal });
      reply.header('Content-Type', 'text/html; charset=utf-8');
      return reply.send(html);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/requests/:id/logbook.pdf', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      await assertRequestAccess(request.params.id, request.user);
      return reply.code(501).send({
        error: {
          code: 'PDF_NOT_IMPLEMENTED',
          message: 'Use /logbook.html (print to PDF) or /logbook.md for now',
        },
      });
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/requests/:id/ai/artifacts', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      await assertRequestAccess(request.params.id, request.user);
      return { items: await listArtifacts(request.params.id, (request.query as Json).kind) };
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/requests/:id/ai/summary', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(summarySchema, request.body || {});
      return await generateCaseSummary(request.params.id, actorOf(request), { includeInternal: body.includeInternal });
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/requests/:id/ai/followup-draft', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(followupDraftSchema, request.body || {});
      return await generateFollowupDraft(request.params.id, actorOf(request), body.instructions);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/requests/:id/ai/meeting-minutes', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      return await generateMeetingMinutes(request.params.id, actorOf(request));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/ai-artifacts/:id/accept', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(artifactAcceptSchema, request.body || {});
      return await acceptArtifact(request.params.id, actorOf(request), body.editedContent);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/ai-artifacts/:id/discard', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      return await discardArtifact(request.params.id, actorOf(request));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/requests/:id/follow-ups', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const access = await assertRequestAccess(request.params.id, request.user);
      const body = parseOrThrow(scheduleFollowUpSchema, request.body);
      const followUp = await ScheduledFollowUp.create({
        requestId: access._id,
        threadId: body.threadId,
        dueAt: new Date(body.dueAt),
        note: body.note,
        assigneeId: body.assigneeId || request.user?.id,
        createdBy: request.user?.id,
      });
      await logEvent({
        requestId: request.params.id,
        threadId: body.threadId,
        type: 'system',
        visibility: 'internal',
        authorId: request.user?.id,
        authorName: request.user?.username || 'InfoSec',
        body: `Follow-up programado para ${new Date(body.dueAt).toISOString()}`,
        metadata: { followUpId: String(followUp._id) },
      });
      return reply.code(201).send(followUp);
    } catch (error) {
      return replyError(reply, error);
    }
  });
}
