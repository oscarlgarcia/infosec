import { FastifyInstance } from 'fastify';
import { verifyToken } from '../middleware/auth';
import { getClient360, getGlobalDashboard, getWorkloadByUser } from '../services/request/dashboard.service';

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

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get('/dashboard/global', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      const query = request.query as any;
      return await getGlobalDashboard({ windowDays: Number(query.windowDays) || 90 });
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get<{ Params: { id: string } }>('/dashboard/client/:id', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      return await getClient360(request.params.id);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get('/dashboard/my-workload', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
      return await getWorkloadByUser(request.user.id);
    } catch (error) {
      return replyError(reply, error);
    }
  });
}
