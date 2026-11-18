import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verifyToken, requireRole } from '../middleware/auth';
import {
  evidenceCreateSchema,
  evidenceMappingCreateSchema,
  evidenceMappingUpdateSchema,
  evidenceMatchQuerySchema,
  evidenceUpdateSchema,
  evidenceZipSchema,
} from '../schemas/evidence';
import { parseOrThrow } from '../schemas/request';
import {
  createEvidence,
  exportEvidenceCsv,
  getEvidence,
  getEvidenceAsset,
  listEvidence,
  listEvidenceAreas,
  listEvidenceSuggestions,
  openEvidenceAssetStream,
  removeEvidenceAsset,
  setEvidenceAsset,
  updateEvidence,
} from '../services/evidence/evidence.service';
import {
  createMapping,
  deleteMapping,
  listMappings,
  matchEvidence,
  updateMapping,
} from '../services/evidence/evidence.matcher';
import { buildEvidenceZip } from '../services/evidence/evidence.zip';
import {
  buildEvidenceWorkbook,
  importEvidenceWorkbook,
  importMappingWorkbook,
} from '../services/evidence/evidence.excel';

function actorOf(request: FastifyRequest) {
  return {
    id: request.user?.id,
    username: request.user?.username || request.user?.email,
    role: request.user?.role,
  };
}

function replyError(reply: FastifyReply, error: any) {
  const statusCode = Number(error?.statusCode || 500);
  if (statusCode >= 500) console.error(error);
  return reply.code(statusCode).send({
    error: {
      code: error?.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
      message: error?.message || 'Unexpected error',
      ...(error?.details ? { details: error.details } : {}),
    },
  });
}

function booleanParam(value: any): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
}

function filtersFromQuery(query: Record<string, any> = {}) {
  return {
    q: query.q,
    domain: query.domain,
    area: query.area,
    framework: query.framework,
    language: query.language,
    shareMode: query.shareMode,
    origin: query.origin,
    documentType: query.documentType,
    classification: query.classification,
    ndaRequired: booleanParam(query.ndaRequired),
    includeArchived: booleanParam(query.includeArchived),
    status: query.status,
  };
}

function downloadStamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function evidenceRoutes(fastify: FastifyInstance) {
  const canRead = [verifyToken, requireRole('admin', 'manager', 'sme')];
  const canWrite = [verifyToken, requireRole('admin')];

  // Static routes must be registered before `/:id` so they are not captured as ids.
  fastify.get('/evidence/areas', { preHandler: canRead }, async (_request, reply) => {
    try {
      return { items: await listEvidenceAreas() };
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get('/evidence/suggestions', { preHandler: canRead }, async (_request, reply) => {
    try {
      return await listEvidenceSuggestions();
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Querystring: Record<string, any> }>('/evidence/export', { preHandler: canRead }, async (request, reply) => {
    try {
      const csv = await exportEvidenceCsv(filtersFromQuery(request.query));
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="matriz-evidencias-${downloadStamp()}.csv"`);
      // BOM keeps accents readable when the file is opened in Excel.
      return reply.send(`\uFEFF${csv}`);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Querystring: Record<string, any> }>('/evidence/export.xlsx', { preHandler: canRead }, async (request, reply) => {
    try {
      const buffer = await buildEvidenceWorkbook(filtersFromQuery(request.query));
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', `attachment; filename="matriz-evidencias-${downloadStamp()}.xlsx"`);
      return reply.send(buffer);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Querystring: Record<string, any> }>('/evidence/match', { preHandler: canRead }, async (request, reply) => {
    try {
      const input = parseOrThrow(evidenceMatchQuerySchema, request.query || {});
      return await matchEvidence(input.q, input.limit);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Querystring: { q?: string } }>('/evidence/mappings', { preHandler: canRead }, async (request, reply) => {
    try {
      return { items: await listMappings(request.query?.q) };
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post('/evidence/mappings', { preHandler: canWrite }, async (request, reply) => {
    try {
      const input = parseOrThrow(evidenceMappingCreateSchema, request.body || {});
      const created = await createMapping(input, actorOf(request));
      return reply.code(201).send(created);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post('/evidence/mappings/import', { preHandler: canWrite }, async (request, reply) => {
    try {
      const upload = await request.file();
      if (!upload) return reply.code(400).send({ error: { code: 'NO_FILES', message: 'No file uploaded' } });
      const buffer = await upload.toBuffer();
      return await importMappingWorkbook(buffer, actorOf(request));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.patch<{ Params: { id: string } }>('/evidence/mappings/:id', { preHandler: canWrite }, async (request, reply) => {
    try {
      const input = parseOrThrow(evidenceMappingUpdateSchema, request.body || {});
      return await updateMapping(request.params.id, input, actorOf(request));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.delete<{ Params: { id: string } }>('/evidence/mappings/:id', { preHandler: canWrite }, async (request, reply) => {
    try {
      return await deleteMapping(request.params.id);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post('/evidence/import', { preHandler: canWrite }, async (request, reply) => {
    try {
      const upload = await request.file();
      if (!upload) return reply.code(400).send({ error: { code: 'NO_FILES', message: 'No file uploaded' } });
      const buffer = await upload.toBuffer();
      return await importEvidenceWorkbook(buffer, actorOf(request));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post('/evidence/zip', { preHandler: canRead }, async (request, reply) => {
    try {
      const input = parseOrThrow(evidenceZipSchema, request.body || {});
      const archive = await buildEvidenceZip(input.ids);
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="evidencias-${downloadStamp()}.zip"`);
      return reply.send(archive);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Querystring: Record<string, any> }>('/evidence', { preHandler: canRead }, async (request, reply) => {
    try {
      const query = request.query || {};
      return await listEvidence({
        ...filtersFromQuery(query),
        page: query.page,
        limit: query.limit,
      });
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post('/evidence', { preHandler: canWrite }, async (request, reply) => {
    try {
      const input = parseOrThrow(evidenceCreateSchema, request.body || {});
      const created = await createEvidence(input, actorOf(request));
      return reply.code(201).send(created);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/evidence/:id', { preHandler: canRead }, async (request, reply) => {
    try {
      return await getEvidence(request.params.id);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.patch<{ Params: { id: string } }>('/evidence/:id', { preHandler: canWrite }, async (request, reply) => {
    try {
      const input = parseOrThrow(evidenceUpdateSchema, request.body || {});
      return await updateEvidence(request.params.id, input, actorOf(request));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/evidence/:id/asset', { preHandler: canWrite }, async (request, reply) => {
    try {
      const upload = await request.file();
      if (!upload) return reply.code(400).send({ error: { code: 'NO_FILES', message: 'No file uploaded' } });
      const buffer = await upload.toBuffer();
      const updated = await setEvidenceAsset(
        request.params.id,
        { filename: upload.filename, data: buffer, mimetype: upload.mimetype },
        actorOf(request)
      );
      return reply.code(201).send(updated);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.delete<{ Params: { id: string } }>('/evidence/:id/asset', { preHandler: canWrite }, async (request, reply) => {
    try {
      return await removeEvidenceAsset(request.params.id, actorOf(request));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/evidence/:id/download', { preHandler: canRead }, async (request, reply) => {
    try {
      const item = await getEvidenceAsset(request.params.id);
      const stream = await openEvidenceAssetStream(item);
      const filename = String(item.asset.originalName || item.asset.filename || 'evidence').replace(/["\r\n]/g, '_');
      reply.header('Content-Type', item.asset.mimeType || 'application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('X-Document-Checksum', item.asset.checksum || '');
      return reply.send(stream);
    } catch (error) {
      return replyError(reply, error);
    }
  });
}
