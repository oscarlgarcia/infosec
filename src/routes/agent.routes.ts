import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, requireRole } from '../middleware/auth';
import {
  getActiveAgents,
  getAgentByName,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
} from '../services/agents/agent.service';
import { Agent } from '../../db/mongo/models/agent';

export async function agentRoutes(fastify: FastifyInstance) {
  // GET /agents - Obtener todos los agents activos
  fastify.get('/agents', {
    preHandler: [verifyToken],
  }, async () => {
    return getActiveAgents();
  });

  // GET /agents/:name - Obtener agente específico por nombre
  fastify.get<{ Params: { name: string } }>('/agents/:name', {
    preHandler: [verifyToken],
  }, async (request) => {
    const agent = await getAgentByName(request.params.name);
    if (!agent) {
      throw { statusCode: 404, message: 'Agent not found' };
    }
    return agent;
  });

  // GET /agents/by-id/:id - Obtener agente específico por ID
  fastify.get<{ Params: { id: string } }>('/agents/by-id/:id', {
    preHandler: [verifyToken],
  }, async (request) => {
    const agent = await getAgentById(request.params.id);
    if (!agent) {
      throw { statusCode: 404, message: 'Agent not found' };
    }
    return agent;
  });

  // POST /agents - Crear nuevo agente (solo admin/manager)
  fastify.post<{ Body: { name: string; displayName: string; description?: string; instructions: string } }>('/agents', {
    preHandler: [verifyToken, requireRole('admin', 'manager')],
  }, async (request, reply) => {
    try {
      const newAgent = await createAgent(request.body);
      return reply.code(201).send(newAgent);
    } catch (error: any) {
      if (error.message.includes('Cannot create system agents')) {
        return reply.code(403).send({ error: 'Cannot create system agents' });
      }
      if (error.message.includes('already exists')) {
        return reply.code(409).send({ error: error.message });
      }
      throw error;
    }
  });

  // PUT /agents/:id - Actualizar agente (solo admin/manager, NO system)
  fastify.put<{ Params: { id: string }; Body: { displayName?: string; description?: string; instructions?: string } }>('/agents/:id', {
    preHandler: [verifyToken, requireRole('admin', 'manager')],
  }, async (request, reply) => {
    try {
      const updated = await updateAgent(request.params.id, request.body);
      if (!updated) {
        return reply.code(404).send({ error: 'Agent not found' });
      }
      return updated;
    } catch (error: any) {
      if (error.message.includes('Cannot modify system agents')) {
        return reply.code(403).send({ error: 'Cannot modify system agents' });
      }
      throw error;
    }
  });

  // DELETE /agents/:id - Desactivar agente (solo admin, NO system)
  fastify.delete<{ Params: { id: string } }>('/agents/:id', {
    preHandler: [verifyToken, requireRole('admin')],
  }, async (request, reply) => {
    try {
      const deleted = await deleteAgent(request.params.id);
      if (!deleted) {
        return reply.code(404).send({ error: 'Agent not found' });
      }
      return { success: true, message: 'Agent deactivated' };
    } catch (error: any) {
      if (error.message.includes('Cannot delete system agents')) {
        return reply.code(403).send({ error: 'Cannot delete system agents' });
      }
      throw error;
    }
  });
}
