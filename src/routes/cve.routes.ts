import { FastifyInstance } from 'fastify';
import { verifyToken, requireRole } from '../middleware/auth';
import { CveImpact } from '../db/mongo/models';
import {
  createAdvisory,
  deleteAdvisory,
  generateCommunicationDraft,
  getAdvisory,
  getClientCveSubscription,
  listAdvisories,
  listImpacts,
  notifySubscribers,
  updateAdvisory,
  updateClientCveSubscription,
  upsertImpact,
} from '../services/request/cve.service';
import {
  cveAdvisorySchema,
  cveImpactSchema,
  cveSubscriptionSchema,
  parseOrThrow,
} from '../schemas/request';

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
      code: error?.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
      message: error?.message || 'Unexpected error',
    },
  });
}

export async function cveRoutes(fastify: FastifyInstance) {
  fastify.get('/cve-advisories', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      return await listAdvisories(request.query as any);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post('/cve-advisories', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(cveAdvisorySchema, request.body);
      return reply.code(201).send(await createAdvisory(body as any, actorOf(request)));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/cve-advisories/:id', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      return await getAdvisory(request.params.id);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.put<{ Params: { id: string } }>('/cve-advisories/:id', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(cveAdvisorySchema.partial(), request.body);
      return await updateAdvisory(request.params.id, body);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.delete<{ Params: { id: string } }>('/cve-advisories/:id', { preHandler: [verifyToken, requireRole('admin')] }, async (request, reply) => {
    try {
      await deleteAdvisory(request.params.id);
      return reply.code(204).send();
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/cve-advisories/:id/impacts', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      return { items: await listImpacts(request.params.id) };
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/cve-advisories/:id/impacts', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(cveImpactSchema, request.body);
      return reply.code(201).send(await upsertImpact(request.params.id, body as any, actorOf(request)));
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/cve-advisories/:id/notify', { preHandler: [verifyToken, requireRole('admin', 'manager')] }, async (request, reply) => {
    try {
      return await notifySubscribers(request.params.id);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/cve-advisories/:id/draft', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = (request.body || {}) as any;
      if (!body.clientId) return reply.code(400).send({ error: 'clientId is required' });
      return await generateCommunicationDraft(request.params.id, body.clientId, body.tone);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/clients/:id/cve-subscriptions', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      return await getClientCveSubscription(request.params.id);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.put<{ Params: { id: string } }>('/clients/:id/cve-subscriptions', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async (request, reply) => {
    try {
      const body = parseOrThrow(cveSubscriptionSchema, request.body);
      return await updateClientCveSubscription(request.params.id, body);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get('/cve-impacts', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      const query = request.query as any;
      const filter: Record<string, any> = {};
      if (query.clientId) filter.clientId = query.clientId;
      if (query.cveId) filter.cveId = query.cveId;
      if (query.affected !== undefined) filter.affected = String(query.affected) === 'true';
      const items = await CveImpact.find(filter)
        .populate('clientId', 'name clientType country customerStatus')
        .sort({ createdAt: -1 })
        .limit(Math.min(200, Number(query.limit) || 50))
        .lean();
      return { items };
    } catch (error) {
      return replyError(reply, error);
    }
  });
}
