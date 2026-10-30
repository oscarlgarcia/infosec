import { FastifyInstance } from 'fastify';
import { verifyToken, requireRole } from '../middleware/auth';
import {
  getCatalogRecord,
  getTechnologyInventory,
  listCatalog,
  updateTechnologyInventory,
} from '../services/cve/catalog.service';
import {
  getSyncStatus,
  promoteToAdvisory,
  recomputeClientMatches,
  recomputeRecordMatches,
  startKevSync,
  startNvdSync,
} from '../services/cve/sync.service';
import { cveSyncSchema, parseOrThrow, technologyInventorySchema } from '../schemas/request';

function actorOf(request: any) {
  return {
    id: request.user?.id,
    username: request.user?.username || request.user?.email,
    role: request.user?.role,
  };
}

function replyError(reply: any, error: any) {
  const statusCode = Number(error?.statusCode || 500);
  if (statusCode >= 500) console.error(error);
  return reply.code(statusCode).send({
    error: {
      code: error?.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'CVE_ERROR'),
      message: error?.message || 'Unexpected error',
    },
  });
}

function parseBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value) === 'true' || String(value) === '1';
}

export async function cveCatalogRoutes(fastify: FastifyInstance) {
  fastify.get('/cve-catalog', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      const query = (request.query || {}) as Record<string, any>;
      return await listCatalog({
        q: query.q,
        severity: query.severity,
        kev: parseBoolean(query.kev),
        ransomware: parseBoolean(query.ransomware),
        vendor: query.vendor,
        product: query.product,
        hasAdvisory: parseBoolean(query.hasAdvisory),
        matchedClientId: query.matchedClientId,
        publishedFrom: query.publishedFrom,
        publishedTo: query.publishedTo,
        page: query.page,
        limit: query.limit,
        sort: query.sort,
      });
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { cveId: string } }>('/cve-catalog/:cveId', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      return await getCatalogRecord(request.params.cveId);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { cveId: string } }>(
    '/cve-catalog/:cveId/promote',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      try {
        const result = await promoteToAdvisory(request.params.cveId, actorOf(request));
        return reply.code(result.created ? 201 : 200).send(result);
      } catch (error) {
        return replyError(reply, error);
      }
    }
  );

  fastify.post<{ Params: { cveId: string } }>(
    '/cve-catalog/:cveId/match',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      try {
        return { items: await recomputeRecordMatches(request.params.cveId) };
      } catch (error) {
        return replyError(reply, error);
      }
    }
  );

  fastify.get('/cve-sync/status', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (_request, reply) => {
    try {
      return await getSyncStatus();
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post('/cve-sync/nvd', { preHandler: [verifyToken, requireRole('admin')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(cveSyncSchema.partial(), request.body || {});
      startNvdSync({
        mode: (body as any).mode,
        from: (body as any).from,
        to: (body as any).to,
      });
      return reply.code(202).send({ started: true, source: 'nvd', mode: (body as any).mode || 'auto' });
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post('/cve-sync/kev', { preHandler: [verifyToken, requireRole('admin')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(cveSyncSchema.partial(), request.body || {});
      startKevSync({ force: Boolean((body as any).force) });
      return reply.code(202).send({ started: true, source: 'kev' });
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>(
    '/clients/:id/technology-inventory',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      try {
        return await getTechnologyInventory(request.params.id);
      } catch (error) {
        return replyError(reply, error);
      }
    }
  );

  fastify.put<{ Params: { id: string } }>(
    '/clients/:id/technology-inventory',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      try {
        const body = parseOrThrow(technologyInventorySchema, request.body);
        const inventory = await updateTechnologyInventory(request.params.id, body.items as any);
        recomputeClientMatches(request.params.id).catch((error) =>
          console.error('[CVE] Client rematch failed:', error)
        );
        return { ...inventory, rematchStarted: true };
      } catch (error) {
        return replyError(reply, error);
      }
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/clients/:id/technology-inventory/rematch',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      try {
        return await recomputeClientMatches(request.params.id);
      } catch (error) {
        return replyError(reply, error);
      }
    }
  );
}
