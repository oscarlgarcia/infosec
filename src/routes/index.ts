import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { generateKnowledgeGraph, getGraphStats } from '../services/knowledgeGraph';
import { analyzeGap } from '../services/gapFinder';
import { 
  uploadDocument, 
  getAllDocuments, 
  deleteDocument,
  searchKnowledgeBase,
  semanticSearchDocuments 
} from '../services/kb/knowledge';
import {
  getAllQA,
  createQA,
  updateQA,
  deleteQA,
  importQAText,
  exportQAText,
  semanticSearchQA,
  reindexQAEntriesToChroma,
} from '../services/qa/qa';
import {
  addKnowledgeBookmark,
  getKnowledgeBookmarks,
  getKnowledgeItemBySource,
  getKnowledgeProvider,
  getKnowledgeRecent,
  isKnowledgeBookmarked,
  searchUnifiedKnowledgeBase,
  summarizeUnifiedKnowledge,
  trackKnowledgeRecent,
  uploadKnowledgeDocumentFromBuffer,
  removeKnowledgeBookmark,
} from '../services/kb/knowledge-base';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllTags,
  createTag,
  deleteTag,
  getAllContentPages,
  getContentPage,
  getContentPageBySlug,
  createContentPage,
  updateContentPage,
  deleteContentPage,
  getContentVersions,
  restoreVersion,
  searchContent,
  getBookmarks,
  addBookmark,
  removeBookmark,
  isBookmarked,
  getRecentContent,
  getAllFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  getFeaturedContent,
  getPopularContent
} from '../services/cms/cms';
import { 
  createClient,
  getAllClients,
  getClient,
  updateClient,
  deleteClient,
  createConversation, 
  getConversation, 
  getClientConversations, 
  sendMessage,
  deleteConversation,
  updateConversation,
  uploadClientAttachment,
  getClientRequests,
  createClientRequest,
  getClientRequest,
  updateClientRequest,
  deleteClientRequest,
  cleanAllData
} from '../services/chat/chat';
import { QAEntry } from '../db/mongo/models';
import type { Department, KnowledgeSourceType } from '../types';
import { verifyToken, requireRole } from '../middleware/auth';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { runChatQuery } from '../services/rag/orchestrator';
import { detectContradictions } from '../services/rag/contradictions';
import { ingestDocument, ingestQaFile, ingestRulesFile } from '../services/ingestion/ingestion';
import { createRule, createKbCandidate, deleteRule, listKbCandidates, listRules, rejectKbCandidate, updateRule, approveKbCandidate, updateKbCandidate } from '../services/governance/governance';
import { getAnalyticsClientOverview, getAnalyticsCoverageGaps, getAnalyticsFreshness, getAnalyticsOpportunities, getAnalyticsOverview, getAnalyticsQuality, getAnalyticsQuestionClusters, getAnalyticsRecommendations, getAnalyticsTrends, recordResponseFeedback } from '../services/analytics/analytics';
import { createAnswerBuilderJob, exportAnswerBuilderJobCsv, getAnswerBuilderJob, getAnswerBuilderQueueState } from '../services/answer-builder/jobs';
import { parseQuestionnaireFile } from '../services/answer-builder/parser';
import { applyRetentionPolicy, refreshDocumentFreshnessScores } from '../services/ops/maintenance';
import { ResponseTrace, ClientRequest } from '../db/mongo/models';

export async function routes(fastify: FastifyInstance) {
  console.log('[Routes] Loading routes...');
  fastify.addHook('onRequest', async (request, reply) => {
    const incoming = request.headers['x-request-id'];
    const requestId = Array.isArray(incoming) ? incoming[0] : incoming;
    const resolvedRequestId = requestId || `req_${crypto.randomUUID()}`;
    (request as any).requestId = resolvedRequestId;
    reply.header('x-request-id', resolvedRequestId);
  });

  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  fastify.get('/uploads/clients/:filename', async (request, reply) => {
    const filename = (request.params as any).filename;
    const filePath = path.join(process.cwd(), 'uploads', 'clients', filename);
    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'File not found' });
    }
    const stream = fs.createReadStream(filePath);
    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(stream);
  });

  fastify.get('/uploads/requests/:filename', async (request, reply) => {
    const filename = (request.params as any).filename;
    const filePath = path.join(process.cwd(), 'uploads', 'requests', filename);
    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'File not found' });
    }
    const stream = fs.createReadStream(filePath);
    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(stream);
  });

  const KNOWLEDGE_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'knowledge');
  fastify.get('/uploads/knowledge/:filename', async (request, reply) => {
    const filename = (request.params as any).filename;
    const filePath = path.join(KNOWLEDGE_UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'File not found' });
    }
    const stream = fs.createReadStream(filePath);
    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(stream);
  });

  // Clients - admin, manager
  fastify.get('/clients', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async () => {
    return getAllClients();
  });

  fastify.get<{ Params: { id: string } }>(
    '/clients/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const client = await getClient(request.params.id);
      if (!client) {
        return reply.code(404).send({ error: 'Client not found' });
      }
      return client;
    }
  );

  fastify.post<{ 
    Body: { 
      name: string;
      clientType: string;
      requestType?: string;
      sectionToReview?: string;
      deadline?: string;
      owner?: string;
      comments?: string;
    } 
  }>(
    '/clients',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Body: { 
      name: string;
      clientType: string;
      requestType?: string;
      sectionToReview?: string;
      deadline?: string;
      owner?: string;
      comments?: string;
    } }>, reply: FastifyReply) => {
      const { name, clientType, country, contact, requestType, sectionToReview, deadline, owner, comments } = request.body;
      const client = await createClient({
        name,
        clientType,
        country,
        contact,
        requestType,
        sectionToReview,
        deadline: deadline ? new Date(deadline) : undefined,
        owner,
        comments,
      });
      return reply.code(201).send(client);
    }
  );

  fastify.put<{ 
    Params: { id: string };
    Body: { 
      name?: string;
      clientType?: string;
      requestType?: string;
      sectionToReview?: string;
      deadline?: string;
      owner?: string;
      comments?: string;
    } 
  }>(
    '/clients/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ 
      Params: { id: string };
      Body: { 
        name?: string;
        clientType?: string;
        requestType?: string;
        sectionToReview?: string;
        deadline?: string;
        owner?: string;
        comments?: string;
      }
    }>, reply: FastifyReply) => {
      const { deadline, ...rest } = request.body;
      const client = await updateClient(request.params.id, {
        ...rest,
        deadline: deadline ? new Date(deadline) : undefined,
      });
      if (!client) {
        return reply.code(404).send({ error: 'Client not found' });
      }
      return client;
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/clients/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await deleteClient(request.params.id);
      return reply.code(204).send();
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/clients/:id/attachments',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }
      
      const buffer = await data.toBuffer();
      const attachment = await uploadClientAttachment(request.params.id, {
        filename: data.filename,
        data: buffer,
        mimetype: data.mimetype || undefined,
      });
      
      return reply.code(201).send(attachment);
    }
  );

  // Client Requests
  fastify.get<{ Params: { clientId: string } }>(
    '/clients/:clientId/requests',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Params: { clientId: string } }>) => {
      return getClientRequests(request.params.clientId);
    }
  );

  fastify.post<{ Params: { clientId: string }; Body: { requestType: string; sectionToReview?: string; deadline?: string; owner?: string; comments?: string } }>(
    '/clients/:clientId/requests',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { requestType, sectionToReview, deadline, owner, comments } = request.body;
      if (!requestType) {
        return reply.code(400).send({ error: 'requestType is required' });
      }
      const clientRequest = await createClientRequest({
        clientId: request.params.clientId,
        requestType,
        sectionToReview,
        deadline,
        owner,
        comments,
      });
      return reply.code(201).send(clientRequest);
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/requests/:id',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const clientRequest = await getClientRequest(request.params.id);
      if (!clientRequest) {
        return reply.code(404).send({ error: 'Request not found' });
      }
      return clientRequest;
    }
  );

  fastify.put<{ Params: { id: string }; Body: { requestType?: string; sectionToReview?: string; deadline?: string; owner?: string; comments?: string; status?: 'open' | 'in_progress' | 'completed' } }>(
    '/requests/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { requestType, sectionToReview, deadline, owner, comments, status } = request.body;
      const clientRequest = await updateClientRequest(request.params.id, {
        requestType,
        sectionToReview,
        deadline,
        owner,
        comments,
        status,
      });
      if (!clientRequest) {
        return reply.code(404).send({ error: 'Request not found' });
      }
      return clientRequest;
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/requests/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await deleteClientRequest(request.params.id);
      return reply.code(204).send();
    }
  );

  // Upload attachments to request
  const UPLOAD_REQUESTS_DIR = path.join(process.cwd(), 'uploads', 'requests');
  if (!fs.existsSync(UPLOAD_REQUESTS_DIR)) {
    fs.mkdirSync(UPLOAD_REQUESTS_DIR, { recursive: true });
  }

  fastify.post<{ Params: { id: string } }>(
    '/requests/:id/attachments',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      const buffer = await data.toBuffer();
      const requestDoc = await ClientRequest.findById(request.params.id);
      if (!requestDoc) {
        return reply.code(404).send({ error: 'Request not found' });
      }

      const storedFilename = `${request.params.id}-${Date.now()}-${data.filename}`;
      const filePath = path.join(UPLOAD_REQUESTS_DIR, storedFilename);
      fs.writeFileSync(filePath, buffer);

      const attachment = {
        filename: storedFilename,
        originalName: data.filename,
        path: `/uploads/requests/${storedFilename}`,
        mimeType: data.mimetype || undefined,
        size: buffer.length,
      };

      requestDoc.attachments = requestDoc.attachments || [];
      requestDoc.attachments.push(attachment);
      await requestDoc.save();

      return reply.code(201).send(attachment);
    }
  );

  // Clean all data (admin only)
  fastify.post<{ Body: { confirm: string } }>(
    '/admin/clean-data',
    { preHandler: [verifyToken, requireRole('admin')] },
    async (request: FastifyRequest<{ Body: { confirm: string } }>, reply: FastifyReply) => {
      if (request.body.confirm !== 'CLEAN_ALL') {
        return reply.code(400).send({ error: 'Invalid confirmation' });
      }
      await cleanAllData();
      return { success: true, message: 'All data cleaned' };
    }
  );

// Conversations - all authenticated users
  fastify.post<{ Body: { clientId?: string; title?: string; agent?: string; requestId?: string } }>(
    '/conversations',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { clientId, title, agent, requestId } = request.body;
      const conversation = await createConversation(clientId || 'default', title, agent, requestId);
      return reply.code(201).send(conversation);
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/conversations/:id',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const conversation = await getConversation(request.params.id);
      if (!conversation) {
        return reply.code(404).send({ error: 'Conversation not found' });
      }
      return conversation;
    }
  );

  fastify.get<{ Querystring: { clientId: string; requestId?: string } }>(
    '/conversations',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Querystring: { clientId: string; requestId?: string } }>) => {
      const { clientId, requestId } = request.query;
      return getClientConversations(clientId, requestId);
    }
  );

  fastify.put<{ 
    Params: { id: string };
    Body: { title?: string; agent?: string; favorite?: boolean }
  }>(
    '/conversations/:id',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ 
      Params: { id: string };
      Body: { title?: string; agent?: string; favorite?: boolean }
    }>, reply: FastifyReply) => {
      const conversation = await updateConversation(request.params.id, request.body);
      if (!conversation) {
        return reply.code(404).send({ error: 'Conversation not found' });
      }
      return conversation;
    }
  );

  fastify.post<{ Params: { id: string }; Body: { message: string; agent?: string } }>(
    '/conversations/:id/chat',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { message: string; agent?: string } }>, reply: FastifyReply) => {
      const { message, agent } = request.body;
      const result = await sendMessage(request.params.id, message, agent, {
        requestId: (request as any).requestId,
        userId: request.user?.id,
      });
      return result;
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/conversations/:id',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await deleteConversation(request.params.id);
      return reply.code(204).send();
    }
  );

  fastify.post<{ Body: { clientId: string; sessionId?: string; question: string; taskProfile?: string; expectedFormat?: string; domain?: string; subdomain?: string } }>(
    '/chat/query',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const { clientId, sessionId, question, taskProfile, expectedFormat, domain, subdomain } = request.body;
      if (!clientId || !question?.trim()) {
        return reply.code(400).send({ error: 'clientId and question are required' });
      }

      const result = await runChatQuery({
        requestId: (request as any).requestId,
        userId: request.user?.id,
        clientId,
        sessionId,
        question,
        taskProfile,
        expectedFormat,
        domain,
        subdomain,
      });
      return result;
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/responses/:id/trace',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const trace = await ResponseTrace.findOne({ responseId: request.params.id }).lean();
      if (!trace) {
        return reply.code(404).send({ error: 'Response trace not found' });
      }
      return trace;
    }
  );

  fastify.post<{ Querystring: { department: Department; domain?: string; owner?: string; reviewDate?: string; expiryDate?: string; version?: string; criticality?: string } }>(
    '/ingestion/documents',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const upload = await request.file();
      if (!upload) return reply.code(400).send({ error: 'No file uploaded' });
      if (!request.query.department) return reply.code(400).send({ error: 'department is required' });

      const buffer = await upload.toBuffer();
      const ingested = await ingestDocument({
        filename: upload.filename,
        buffer,
        department: request.query.department,
        metadata: {
          domain: request.query.domain,
          owner: request.query.owner,
          reviewDate: request.query.reviewDate,
          expiryDate: request.query.expiryDate,
          version: request.query.version,
          criticality: request.query.criticality,
        },
      });
      return reply.code(201).send(ingested);
    }
  );

  fastify.post(
    '/ingestion/qa-file',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const upload = await request.file();
      if (!upload) return reply.code(400).send({ error: 'No file uploaded' });
      const result = await ingestQaFile(await upload.toBuffer());
      return reply.code(201).send(result);
    }
  );

  fastify.post(
    '/ingestion/rules',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const upload = await request.file();
      if (!upload) return reply.code(400).send({ error: 'No file uploaded' });
      const rules = await ingestRulesFile(await upload.toBuffer());
      const created = await Promise.all(rules.map((rule) => createRule({ ...rule })));
      return reply.code(201).send({ created: created.length });
    }
  );

  fastify.get('/rules', { preHandler: [verifyToken] }, async () => {
    return listRules();
  });

  fastify.post<{ Body: { name: string; content: string; domain?: string; enabled?: boolean } }>(
    '/rules',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const created = await createRule(request.body);
      return reply.code(201).send(created);
    }
  );

  fastify.put<{ Params: { id: string }; Body: { name?: string; content?: string; domain?: string; enabled?: boolean } }>(
    '/rules/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const updated = await updateRule(request.params.id, request.body);
      if (!updated) return reply.code(404).send({ error: 'Rule not found' });
      return updated;
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/rules/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      await deleteRule(request.params.id);
      return reply.code(204).send();
    }
  );

  fastify.post<{ Body: { question: string; suggestedAnswer: string; sessionId?: string; clientId?: string; domain?: string; sourceRefs?: string[] } }>(
    '/kb/candidates',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const { question, suggestedAnswer, sessionId, clientId, domain, sourceRefs } = request.body;
      if (!question || !suggestedAnswer) {
        return reply.code(400).send({ error: 'question and suggestedAnswer are required' });
      }
      const candidate = await createKbCandidate({ question, suggestedAnswer, sessionId, clientId, domain, sourceRefs });
      return candidate;
    }
  );

  fastify.put<{ Params: { id: string }; Body: { question?: string; suggestedAnswer?: string; domain?: string } }>(
    '/kb/candidates/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const updated = await updateKbCandidate(request.params.id, request.body);
      if (!updated) return reply.code(404).send({ error: 'Candidate not found' });
      return updated;
    }
  );

  fastify.get<{ Querystring: { status?: string } }>(
    '/kb/candidates',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request) => {
      return listKbCandidates(request.query.status);
    }
  );

  fastify.post<{ Params: { id: string }; Body: { note?: string } }>(
    '/kb/candidates/:id/approve',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const reviewer = request.user?.username || 'reviewer';
      const approved = await approveKbCandidate(request.params.id, reviewer, request.body?.note);
      if (!approved) return reply.code(404).send({ error: 'Candidate not found' });
      return approved;
    }
  );

  fastify.post<{ Params: { id: string }; Body: { note?: string } }>(
    '/kb/candidates/:id/reject',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const reviewer = request.user?.username || 'reviewer';
      const rejected = await rejectKbCandidate(request.params.id, reviewer, request.body?.note);
      if (!rejected) return reply.code(404).send({ error: 'Candidate not found' });
      return rejected;
    }
  );

  fastify.post<{ Body: { clientId: string; questions: string[]; domain?: string; subdomain?: string } }>(
    '/answer-builder/jobs',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      if (!request.body.clientId || !request.body.questions?.length) {
        return reply.code(400).send({ error: 'clientId and questions[] are required' });
      }
      const job = await createAnswerBuilderJob({
        clientId: request.body.clientId,
        userId: request.user?.id,
        questions: request.body.questions,
        domain: request.body.domain,
        subdomain: request.body.subdomain,
      });
      return reply.code(202).send(job);
    }
  );

  fastify.post<{ Querystring: { clientId: string; domain?: string; subdomain?: string } }>(
    '/answer-builder/upload',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const upload = await request.file();
      if (!upload) return reply.code(400).send({ error: 'No file uploaded' });
      if (!request.query.clientId) return reply.code(400).send({ error: 'clientId is required' });

      const buffer = await upload.toBuffer();
      const questions = await parseQuestionnaireFile({
        filename: upload.filename,
        buffer,
      });

      if (questions.length === 0) {
        return reply.code(400).send({ error: 'No valid questions found in file' });
      }

      const job = await createAnswerBuilderJob({
        clientId: request.query.clientId,
        userId: request.user?.id,
        questions,
        domain: request.query.domain,
        subdomain: request.query.subdomain,
      });
      return reply.code(202).send({ ...job, parsed_questions: questions.length });
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/answer-builder/jobs/:id',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const job = await getAnswerBuilderJob(request.params.id);
      if (!job) return reply.code(404).send({ error: 'Job not found' });
      return job;
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/answer-builder/jobs/:id/export.csv',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const csv = await exportAnswerBuilderJobCsv(request.params.id);
      if (!csv) return reply.code(404).send({ error: 'Job output not found' });
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="answer-builder-${request.params.id}.csv"`);
      return reply.send(csv);
    }
  );

  fastify.get(
    '/answer-builder/queue',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async () => getAnswerBuilderQueueState()
  );

  fastify.get<{ Querystring: { windowDays?: number } }>(
    '/analytics/overview',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request) => getAnalyticsOverview(request.query.windowDays || 30)
  );

  fastify.get<{ Querystring: { windowDays?: number } }>(
    '/analytics/coverage-gaps',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request) => getAnalyticsCoverageGaps(request.query.windowDays || 30)
  );

  fastify.get<{ Querystring: { windowDays?: number } }>(
    '/analytics/quality',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request) => getAnalyticsQuality(request.query.windowDays || 30)
  );

  fastify.get<{ Querystring: { staleDays?: number } }>(
    '/analytics/freshness',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request) => getAnalyticsFreshness(request.query.staleDays || 365)
  );

  fastify.get<{ Querystring: { limit?: number } }>(
    '/analytics/recommendations',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request) => getAnalyticsRecommendations(request.query.limit || 25)
  );

  fastify.get<{ Querystring: { windowDays?: number } }>(
    '/analytics/trends',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request) => getAnalyticsTrends(request.query.windowDays || 30)
  );

  fastify.get<{ Querystring: { windowDays?: number; minCount?: number } }>(
    '/analytics/question-clusters',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request) => getAnalyticsQuestionClusters(request.query.windowDays || 30, request.query.minCount || 2)
  );

  fastify.get<{ Querystring: { limit?: number } }>(
    '/analytics/opportunities',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request) => getAnalyticsOpportunities(request.query.limit || 25)
  );

  fastify.get<{ Querystring: { clientId: string; windowDays?: number } }>(
    '/analytics/client-overview',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      if (!request.query.clientId) {
        return reply.code(400).send({ error: 'clientId is required' });
      }
      return getAnalyticsClientOverview(request.query.clientId, request.query.windowDays || 30);
    }
  );

  fastify.post<{ Params: { id: string }; Body: { decision: 'accepted' | 'edited' | 'discarded' | 'copied' | 'exported'; notes?: string } }>(
    '/responses/:id/feedback',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      if (!request.body?.decision) {
        return reply.code(400).send({ error: 'decision is required' });
      }
      const updated = await recordResponseFeedback({
        responseId: request.params.id,
        userId: request.user?.id,
        decision: request.body.decision,
        notes: request.body.notes,
      });
      if (!updated) return reply.code(404).send({ error: 'Response trace not found' });
      return updated;
    }
  );

  fastify.post<{ Body: { question: string; domain?: string } }>(
    '/analysis/contradictions',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      if (!request.body.question?.trim()) {
        return reply.code(400).send({ error: 'question is required' });
      }
      return detectContradictions({
        question: request.body.question,
        domain: request.body.domain,
      });
    }
  );

  fastify.post<{ Body: { staleDays?: number } }>(
    '/ops/freshness-refresh',
    { preHandler: [verifyToken, requireRole('admin')] },
    async (request) => refreshDocumentFreshnessScores(request.body?.staleDays || 365)
  );

  fastify.post<{ Body: { retentionDays?: number } }>(
    '/ops/retention',
    { preHandler: [verifyToken, requireRole('admin')] },
    async (request) => applyRetentionPolicy(request.body?.retentionDays || 180)
  );

  // Documents - admin, manager, sme
  fastify.post<{ 
    Body: { 
      filePath: string; 
      originalName: string; 
      department: Department 
    } 
  }>(
    '/documents',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Body: { filePath: string; originalName: string; department: Department } }>, reply: FastifyReply) => {
      const { filePath, originalName, department } = request.body;
      const doc = await uploadDocument(filePath, originalName, department);
      return reply.code(201).send(doc);
    }
  );

  fastify.get<{ Querystring: { department?: Department } }>(
    '/documents', 
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, 
    async (request: FastifyRequest<{ Querystring: { department?: Department } }>) => {
      const { department } = request.query;
      return getAllDocuments(department);
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/documents/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await deleteDocument(request.params.id);
      return reply.code(204).send();
    }
  );

  // Semantic search for KB documents
  fastify.get<{ Querystring: { q: string; department?: Department; limit?: number } }>(
    '/documents/search',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Querystring: { q: string; department?: Department; limit?: number } }>) => {
      const { q, department, limit } = request.query;
      if (!q) return [];
      return semanticSearchDocuments(q, department, limit || 10);
    }
  );

  // Search - all authenticated users
  fastify.get<{ Querystring: { q: string; department?: Department; limit?: number } }>(
    '/search',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Querystring: { q: string; department?: Department; limit?: number } }>) => {
      const { q, department, limit } = request.query;
      return searchKnowledgeBase(q, department, limit);
    }
  );

// Q&A - admin, manager, sme
  fastify.get('/qa', { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] }, async () => {
    return getAllQA();
  });

  fastify.post<{ Body: { questionNumber?: string; question: string; answer: string; department?: Department; infoSecDomain?: string; source?: string } }>(
    '/qa',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Body: { questionNumber?: string; question: string; answer: string; department?: Department; infoSecDomain?: string; source?: string } }>, reply: FastifyReply) => {
      const entry = await createQA(request.body);
      return reply.code(201).send(entry);
    }
  );

  fastify.put<{ Params: { id: string }; Body: { questionNumber?: string; question: string; answer: string; department?: Department; infoSecDomain?: string } }>(
    '/qa/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { questionNumber?: string; question: string; answer: string; department?: Department; infoSecDomain?: string } }>, reply: FastifyReply) => {
      const entry = await updateQA(request.params.id, request.body);
      if (!entry) return reply.code(404).send({ error: 'Not found' });
      return entry;
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/qa/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await deleteQA(request.params.id);
      return reply.code(204).send();
    }
  );

  fastify.post<{ Body: { content: string } }>(
    '/qa/import',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Body: { content: string } }>, reply: FastifyReply) => {
      const result = await importQAText(request.body.content, 'imported');
      return result;
    }
  );

fastify.get('/qa/export',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async () => {
      const content = await exportQAtext();
      return content;
    }
  );

  fastify.post(
    '/qa/reindex',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const result = await reindexQAEntriesToChroma();
      return result;
    }
  );

  fastify.post<{ Body: { query: string; threshold?: number } }>(
    '/qa/search',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request) => {
      const { query, threshold = 0 } = request.body;
      if (!query?.trim()) {
        return { error: 'Query is required' };
      }
      return semanticSearchQA(query, threshold);
    }
  );

  // Knowledge Base - all authenticated users
  fastify.get<{ Querystring: { q: string; sourceTypes?: string; limit?: number } }>(
    '/knowledge-base/search',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const { q, sourceTypes, limit } = request.query;
      if (!q?.trim()) {
        return reply.code(400).send({ error: 'Query is required' });
      }

      const parsedSourceTypes = sourceTypes
        ? sourceTypes
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean) as KnowledgeSourceType[]
        : undefined;

      return searchUnifiedKnowledgeBase({
        query: q,
        sourceTypes: parsedSourceTypes,
        limit: limit || 20,
      });
    }
  );

  fastify.post<{ Body: { query: string; sourceTypes?: KnowledgeSourceType[]; limit?: number } }>(
    '/knowledge-base/summary',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      if (!request.body.query?.trim()) {
        return reply.code(400).send({ error: 'Query is required' });
      }

      return summarizeUnifiedKnowledge({
        query: request.body.query,
        sourceTypes: request.body.sourceTypes,
        limit: request.body.limit || 8,
      });
    }
  );

  fastify.get<{ Params: { sourceType: KnowledgeSourceType; id: string } }>(
    '/knowledge-base/items/:sourceType/:id',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const item = await getKnowledgeItemBySource(request.params.sourceType, request.params.id);
      if (!item) {
        return reply.code(404).send({ error: 'Knowledge item not found' });
      }

      const userId = request.user?.id || 'default';
      await trackKnowledgeRecent(userId, request.params.sourceType, request.params.id);
      return item;
    }
  );

  fastify.get('/knowledge-base/provider-contract', { preHandler: [verifyToken] }, async () => {
    const provider = getKnowledgeProvider();
    return {
      provider: provider.constructor.name,
      futureBridge: {
        provider: 'local',
        version: 'v1',
        searchMethod: 'knowledge.search',
        detailMethod: 'knowledge.getItem',
        summaryMethod: 'knowledge.summarize',
        chatContextShape: {
          query: 'string',
          resultIds: ['string'],
          citations: [{ sourceType: 'cms', itemId: 'string' }],
          agentMode: 'string?',
        },
      },
    };
  });

  fastify.get('/knowledge-base/bookmarks', { preHandler: [verifyToken] }, async (request) => {
    const userId = request.user?.id || 'default';
    return getKnowledgeBookmarks(userId);
  });

  fastify.post<{ Body: { sourceType: KnowledgeSourceType; itemId: string } }>(
    '/knowledge-base/bookmarks',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const userId = request.user?.id || 'default';
      await addKnowledgeBookmark(userId, request.body.sourceType, request.body.itemId);
      const item = await getKnowledgeItemBySource(request.body.sourceType, request.body.itemId);
      return reply.code(201).send(item);
    }
  );

  fastify.delete<{ Params: { sourceType: KnowledgeSourceType; itemId: string } }>(
    '/knowledge-base/bookmarks/:sourceType/:itemId',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const userId = request.user?.id || 'default';
      await removeKnowledgeBookmark(userId, request.params.sourceType, request.params.itemId);
      return reply.code(204).send();
    }
  );

  fastify.get<{ Params: { sourceType: KnowledgeSourceType; itemId: string } }>(
    '/knowledge-base/bookmarks/:sourceType/:itemId/check',
    { preHandler: [verifyToken] },
    async (request) => {
      const userId = request.user?.id || 'default';
      return isKnowledgeBookmarked(userId, request.params.sourceType, request.params.itemId);
    }
  );

  fastify.get<{ Querystring: { limit?: number } }>(
    '/knowledge-base/recent',
    { preHandler: [verifyToken] },
    async (request) => {
      const userId = request.user?.id || 'default';
      return getKnowledgeRecent(userId, request.query.limit || 10);
    }
  );

  fastify.post<{ Body: { sourceType: KnowledgeSourceType; itemId: string } }>(
    '/knowledge-base/recent',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const userId = request.user?.id || 'default';
      await trackKnowledgeRecent(userId, request.body.sourceType, request.body.itemId);
      return reply.code(204).send();
    }
  );

  fastify.post<{ Querystring: { department: Department } }>(
    '/knowledge-base/documents',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const upload = await request.file();
      if (!upload) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      if (!request.query.department) {
        return reply.code(400).send({ error: 'Department is required' });
      }

      const buffer = await upload.toBuffer();
      const document = await uploadKnowledgeDocumentFromBuffer({
        filename: upload.filename,
        buffer,
        department: request.query.department,
      });

      return reply.code(201).send(document);
    }
  );

  // CMS - Categories
  fastify.get('/cms/categories', async () => {
    return getAllCategories();
  });

  fastify.post<{ Body: { name: string; slug?: string; parentId?: string; description?: string } }>(
    '/cms/categories',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Body: { name: string; slug?: string; parentId?: string; description?: string } }>, reply: FastifyReply) => {
      const category = await createCategory(request.body);
      return reply.code(201).send(category);
    }
  );

  fastify.put<{ Params: { id: string }; Body: { name?: string; description?: string; order?: number; parentId?: string } }>(
    '/cms/categories/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request) => {
      return updateCategory(request.params.id, request.body);
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/cms/categories/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      await deleteCategory(request.params.id);
      return reply.code(204).send();
    }
  );

  // CMS - Tags
  fastify.get('/cms/tags', async () => {
    return getAllTags();
  });

  fastify.post<{ Body: { name: string; color?: string } }>(
    '/cms/tags',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Body: { name: string; color?: string } }>, reply: FastifyReply) => {
      const tag = await createTag(request.body);
      return reply.code(201).send(tag);
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/cms/tags/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      await deleteTag(request.params.id);
      return reply.code(204).send();
    }
  );

  // CMS - Content Pages
  fastify.get<{ Querystring: { status?: string; categoryId?: string; tags?: string } }>(
    '/cms/pages',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Querystring: { status?: string; categoryId?: string; tags?: string } }>) => {
      const { status, categoryId, tags } = request.query;
      return getAllContentPages({ 
        status, 
        categoryId, 
        tags: tags ? tags.split(',') : undefined 
      });
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/cms/pages/:id',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return getContentPage(request.params.id);
    }
  );

  fastify.get<{ Params: { slug: string } }>(
    '/cms/pages/slug/:slug',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Params: { slug: string } }>) => {
      return getContentPageBySlug(request.params.slug);
    }
  );

  fastify.post<{ Body: { title: string; content: string; summary?: string; categoryId?: string; tags?: string[]; status?: 'draft' | 'published' | 'archived'; authorId?: string } }>(
    '/cms/pages',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Body: { title: string; content: string; summary?: string; categoryId?: string; tags?: string[]; status?: 'draft' | 'published' | 'archived'; authorId?: string } }>, reply: FastifyReply) => {
      const page = await createContentPage(request.body);
      return reply.code(201).send(page);
    }
  );

  fastify.put<{ Params: { id: string }; Body: { title?: string; content?: string; summary?: string; categoryId?: string; tags?: string[]; status?: 'draft' | 'published' | 'archived'; relatedContent?: string[]; isFeatured?: boolean } }>(
    '/cms/pages/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request) => {
      return updateContentPage(request.params.id, request.body);
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/cms/pages/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      await deleteContentPage(request.params.id);
      return reply.code(204).send();
    }
  );

  // CMS - Versions
  fastify.get<{ Params: { id: string } }>(
    '/cms/pages/:id/versions',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return getContentVersions(request.params.id);
    }
  );

  fastify.post<{ Params: { id: string }; Body: { version: number } }>(
    '/cms/pages/:id/restore',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { version: number } }>) => {
      return restoreVersion(request.params.id, request.body.version);
    }
  );

  // CMS - Search - all authenticated users
  fastify.get<{ Querystring: { q: string; limit?: number } }>(
    '/cms/search',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Querystring: { q: string; limit?: number } }>) => {
      const { q, limit } = request.query;
      return searchContent(q, limit);
    }
  );

  // CMS - Bookmarks - all authenticated users
  fastify.get<{ Querystring: { userId?: string } }>(
    '/cms/bookmarks',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Querystring: { userId?: string } }>) => {
      const userId = request.user?.id || request.query.userId || 'default';
      return getBookmarks(userId);
    }
  );

  fastify.post<{ Body: { contentId: string } }>(
    '/cms/bookmarks',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Body: { contentId: string } }>, reply: FastifyReply) => {
      const userId = request.user?.id || 'default';
      const bookmark = await addBookmark(request.body.contentId, userId);
      return reply.code(201).send(bookmark);
    }
  );

  fastify.delete<{ Params: { contentId: string } }>(
    '/cms/bookmarks/:contentId',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const userId = request.user?.id || 'default';
      await removeBookmark(request.params.contentId, userId);
      return reply.code(204).send();
    }
  );

  fastify.get<{ Params: { contentId: string } }>(
    '/cms/bookmarks/:contentId/check',
    { preHandler: [verifyToken] },
    async (request) => {
      const userId = request.user?.id || 'default';
      return isBookmarked(request.params.contentId, userId);
    }
  );

  // CMS - Recent - all authenticated users
  fastify.get<{ Querystring: { limit?: number } }>(
    '/cms/recent',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Querystring: { limit?: number } }>) => {
      const userId = request.user?.id || 'default';
      return getRecentContent(userId, request.query.limit || 10);
    }
  );

  // CMS - Featured & Popular - all authenticated users
  fastify.get('/cms/featured', { preHandler: [verifyToken] }, async () => {
    return getFeaturedContent();
  });

  fastify.get('/cms/popular', { preHandler: [verifyToken] }, async () => {
    return getPopularContent();
  });

  // CMS - FAQs
  fastify.get<{ Querystring: { categoryId?: string } }>(
    '/cms/faqs',
    async (request: FastifyRequest<{ Querystring: { categoryId?: string } }>) => {
      return getAllFAQs(request.query.categoryId);
    }
  );

  fastify.post<{ Body: { question: string; answer: string; categoryId?: string; tags?: string[] } }>(
    '/cms/faqs',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const faq = await createFAQ(request.body);
      return reply.code(201).send(faq);
    }
  );

  fastify.put<{ Params: { id: string }; Body: { question?: string; answer?: string; categoryId?: string; tags?: string[]; order?: number; isPublished?: boolean } }>(
    '/cms/faqs/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request) => {
      return updateFAQ(request.params.id, request.body);
    }
  );

fastify.delete<{ Params: { id: string } }>(
  '/cms/faqs/:id',
  { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
  async (request, reply) => {
    await deleteFAQ(request.params.id);
    return reply.code(204).send();
  }
);

fastify.get('/knowledge-graph',
  { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
  async (request, reply) => {
    try {
      const graphData = await generateKnowledgeGraph();
      return graphData;
    } catch (error) {
      console.error('Error generating knowledge graph:', error);
      return reply.code(500).send({ error: 'Failed to generate knowledge graph' });
    }
  }
);

fastify.get('/knowledge-graph/stats',
  { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
  async () => {
    return await getGraphStats();
  }
);

fastify.get<{ Querystring: { q: string; topK?: number } }>(
  '/gap-finder',
  { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
  async (request, reply) => {
    try {
      const query = request.query.q || '';
      const topK = parseInt(request.query.topK as string) || 10000;
      
      if (!query || query.length < 2) {
        return reply.code(400).send({ error: 'Query is required (min 2 characters)' });
      }
      
      const analysis = await analyzeGap(query, topK);
      return analysis;
    } catch (error) {
      console.error('Error analyzing gap:', error);
      return reply.code(500).send({ error: 'Failed to analyze gap' });
    }
  }
);
}
