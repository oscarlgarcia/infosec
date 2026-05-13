import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, requireRole } from '../middleware/auth';
import {
  createJob,
  getJob,
  listJobs,
  pauseJob,
  resumeJob,
  cancelJob,
  deleteJob,
  createRequestForJob,
} from '../services/orchestrator/orchestrator';
import { getQueueState } from '../services/orchestrator/queue';
import { getAnalyticsQueueMetrics } from '../services/analytics/analytics';
import { parseQuestionnaireFile } from '../services/orchestrator/utils/parser';
import { enqueueJob } from '../services/orchestrator/queue';

export async function orchestratorRoutes(fastify: FastifyInstance) {
  // List all jobs
  fastify.get<{
    Querystring: { clientId?: string; status?: string; limit?: number; offset?: number };
  }>(
    '/orchestrator/jobs',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{
      Querystring: { clientId?: string; status?: string; limit?: number; offset?: number };
    }>) => {
      const { clientId, status, limit, offset } = request.query;
      return listJobs({
        clientId,
        status: status as any,
        limit: limit || 50,
        offset: offset || 0,
      });
    }
  );

  // Create a new job (text input)
  fastify.post<{
    Body: {
      name: string;
      clientId: string;
      requestId?: string;
      agent?: string;
      inputQuestions: string[];
      inputFile?: string;
    };
  }>(
    '/orchestrator/jobs',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{
      Body: {
        name: string;
        clientId: string;
        requestId?: string;
        agent?: string;
        inputQuestions: string[];
        inputFile?: string;
      };
    }>, reply: FastifyReply) => {
      const { name, clientId, requestId, agent, inputQuestions, inputFile } = request.body;
      if (!clientId || !inputQuestions?.length) {
        return reply.code(400).send({ error: 'clientId and inputQuestions[] are required' });
      }
      const job = await createJob({
        name: name || `Answer Builder - ${new Date().toLocaleDateString()}`,
        clientId,
        requestId,
        agent,
        inputQuestions,
        inputFile,
      });
      return reply.code(201).send(job);
    }
  );

  // Create a new job from file upload
  fastify.post<{
    Querystring: {
      clientId: string;
      name?: string;
      agent?: string;
      requestId?: string;
    };
  }>(
    '/orchestrator/jobs/upload',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{
      Querystring: {
        clientId: string;
        name?: string;
        agent?: string;
        requestId?: string;
      };
    }>, reply: FastifyReply) => {
      const upload = await request.file();
      if (!upload) return reply.code(400).send({ error: 'No file uploaded' });
      if (!request.query.clientId) return reply.code(400).send({ error: 'clientId is required' });
      const buffer = await upload.toBuffer();
      const questions = await parseQuestionnaireFile({ filename: upload.filename, buffer });
      if (questions.length === 0) return reply.code(400).send({ error: 'No valid questions found in file' });
      const job = await createJob({
        name: request.query.name || `Answer Builder - ${new Date().toLocaleDateString()}`,
        clientId: request.query.clientId,
        requestId: request.query.requestId,
        agent: request.query.agent || 'InfoSec',
        inputQuestions: questions,
      });
      return reply.code(201).send({ ...job, parsed_questions: questions.length });
    }
  );

  // Get single job
  fastify.get<{ Params: { id: string } }>(
    '/orchestrator/jobs/:id',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const job = await getJob(request.params.id);
      if (!job) return reply.code(404).send({ error: 'Job not found' });
      return job;
    }
  );

  // Pause job
  fastify.post<{ Params: { id: string } }>(
    '/orchestrator/jobs/:id/pause',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const job = await pauseJob(request.params.id);
      if (!job) return reply.code(404).send({ error: 'Job not found' });
      return job;
    }
  );

  // Resume job
  fastify.post<{ Params: { id: string } }>(
    '/orchestrator/jobs/:id/resume',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const job = await resumeJob(request.params.id);
      if (!job) return reply.code(404).send({ error: 'Job not found' });
      return job;
    }
  );

  // Cancel job
  fastify.post<{ Params: { id: string } }>(
    '/orchestrator/jobs/:id/cancel',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const job = await cancelJob(request.params.id);
      if (!job) return reply.code(404).send({ error: 'Job not found' });
      return job;
    }
  );

  // Delete job
  fastify.delete<{ Params: { id: string } }>(
    '/orchestrator/jobs/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await deleteJob(request.params.id);
      return reply.code(204).send();
    }
  );

  // Create a new ClientRequest (for linking to a job)
  fastify.post<{
    Body: {
      clientId: string;
      requestType: string;
      sectionToReview?: string;
      deadline?: string;
      owner?: string;
      comments?: string;
    };
  }>(
    '/orchestrator/requests',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{
      Body: {
        clientId: string;
        requestType: string;
        sectionToReview?: string;
        deadline?: string;
        owner?: string;
        comments?: string;
      };
    }>, reply: FastifyReply) => {
      const { clientId, requestType, sectionToReview, deadline, owner, comments } = request.body;
      if (!clientId || !requestType) {
        return reply.code(400).send({ error: 'clientId and requestType are required' });
      }
      const clientRequest = await createRequestForJob({
        clientId,
        requestType,
        sectionToReview,
        deadline,
        owner,
        comments,
      });
      return reply.code(201).send(clientRequest);
    }
  );

  // Queue state
  fastify.get(
    '/orchestrator/queue',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async () => getQueueState()
  );

  // Queue metrics (for analytics dashboard)
  fastify.get<{ Querystring: { windowDays?: number } }>(
    '/analytics/queue-metrics',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Querystring: { windowDays?: number } }>) => {
      return getAnalyticsQueueMetrics(request.query.windowDays || 30);
    }
  );
}
