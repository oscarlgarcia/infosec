import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, requireRole } from '../middleware/auth';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  moveTaskToList,
} from '../services/tasks/task.service';
import {
  createList,
  getLists,
  updateList,
  deleteList,
  initializeDefaultLists,
} from '../services/tasks/list.service';
import {
  createLabel,
  getLabels,
  updateLabel,
  deleteLabel,
} from '../services/tasks/label.service';

export async function taskRoutes(fastify: FastifyInstance) {
  // Initialize default lists on startup
  await initializeDefaultLists();

  // Task Lists
  fastify.get('/task-lists', { preHandler: [verifyToken] }, async () => {
    return getLists();
  });

  fastify.post<{ Body: { name: string; order?: number } }>(
    '/task-lists',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const list = await createList(request.body);
      return reply.code(201).send(list);
    }
  );

  fastify.put<{ Params: { id: string }; Body: { name?: string; order?: number } }>(
    '/task-lists/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const updated = await updateList(request.params.id, request.body);
      if (!updated) return reply.code(404).send({ error: 'List not found' });
      return updated;
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/task-lists/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager')] },
    async (request, reply) => {
      try {
        await deleteList(request.params.id);
        return reply.code(204).send();
      } catch (error: any) {
        return reply.code(400).send({ error: error.message });
      }
    }
  );

  // Tasks
  fastify.get<{ Querystring: { listId?: string; status?: string } }>(
    '/tasks',
    { preHandler: [verifyToken] },
    async (request) => {
      return getTasks(request.query);
    }
  );

  fastify.post<{ Body: any }>(
    '/tasks',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const task = await createTask(request.body);
      return reply.code(201).send(task);
    }
  );

  fastify.put<{ Params: { id: string }; Body: any }>(
    '/tasks/:id',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const updated = await updateTask(request.params.id, request.body);
      if (!updated) return reply.code(404).send({ error: 'Task not found' });
      return updated;
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/tasks/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager')] },
    async (request, reply) => {
      await deleteTask(request.params.id);
      return reply.code(204).send();
    }
  );

  // Move task to different list
  fastify.put<{ Params: { id: string }; Body: { listId: string } }>(
    '/tasks/:id/move',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const { listId } = request.body;
      const updated = await moveTaskToList(request.params.id, listId);
      if (!updated) return reply.code(404).send({ error: 'Task not found' });
      return updated;
    }
  );

  // Task Labels
  fastify.get('/task-labels', { preHandler: [verifyToken] }, async () => {
    return getLabels();
  });

  fastify.post<{ Body: { name: string; color?: string } }>(
    '/task-labels',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const label = await createLabel(request.body);
      return reply.code(201).send(label);
    }
  );

  fastify.put<{ Params: { id: string }; Body: { name?: string; color?: string } }>(
    '/task-labels/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const updated = await updateLabel(request.params.id, request.body);
      if (!updated) return reply.code(404).send({ error: 'Label not found' });
      return updated;
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/task-labels/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      await deleteLabel(request.params.id);
      return reply.code(204).send();
    }
  );
}
