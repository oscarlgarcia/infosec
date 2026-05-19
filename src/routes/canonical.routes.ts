import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, requireRole } from '../middleware/auth';
import {
  listCanonicalAnswers,
  getCanonicalAnswer,
  createCanonicalAnswer,
  updateCanonicalAnswer,
  deleteCanonicalAnswer,
  verifyCanonicalAnswer,
} from '../services/qa/canonical.service';
import { retrieveRelevantPassages } from '../services/rag/retriever';

export async function canonicalRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/canonical-answers',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as any;
      const result = await listCanonicalAnswers({
        status: query.status,
        domain: query.domain,
        search: query.search,
        page: query.page ? parseInt(query.page) : 1,
        pageSize: query.pageSize ? parseInt(query.pageSize) : 20,
      });
      return result;
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/canonical-answers/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const item = await getCanonicalAnswer(request.params.id);
      if (!item) return reply.code(404).send({ error: 'Canonical answer not found' });
      return item;
    }
  );

  fastify.post<{ Body: { question: string; answer: string; domain: string; owner: string; sourceRefs?: string[]; status?: string } }>(
    '/canonical-answers',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Body: { question: string; answer: string; domain: string; owner: string; sourceRefs?: string[]; status?: string } }>, reply: FastifyReply) => {
      if (!request.body?.question || !request.body?.answer || !request.body?.domain) {
        return reply.code(400).send({ error: 'Question, answer and domain are required' });
      }
      const created = await createCanonicalAnswer(request.body);
      return reply.code(201).send(created);
    }
  );

  fastify.put<{ Params: { id: string }; Body: any }>(
    '/canonical-answers/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const updated = await updateCanonicalAnswer(request.params.id, request.body);
      if (!updated) return reply.code(404).send({ error: 'Canonical answer not found' });
      return updated;
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/canonical-answers/:id',
    { preHandler: [verifyToken, requireRole('admin')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const deleted = await deleteCanonicalAnswer(request.params.id);
      if (!deleted) return reply.code(404).send({ error: 'Canonical answer not found' });
      return reply.code(204).send();
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/canonical-answers/:id/verify',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const canonical = await getCanonicalAnswer(request.params.id);
        if (!canonical) return reply.code(404).send({ error: 'Canonical answer not found' });
        const passages = await retrieveRelevantPassages({ query: (canonical as any).question, limit: 10 });
        const result = await verifyCanonicalAnswer(request.params.id, passages.map(p => ({
          content: p.content,
          sourceType: p.sourceType,
          score: p.score,
        })));
        return result;
      } catch (error) {
        console.error('Error verifying canonical answer:', error);
        return reply.code(500).send({ error: 'Failed to verify' });
      }
    }
  );
}
