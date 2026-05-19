import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { env } from './config';
import { connectMongoDB } from './db/mongo/connection';
import { routes } from './routes';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';

const fastify = Fastify({
  logger: env.NODE_ENV === 'development',
});

fastify.setErrorHandler((error, request, reply) => {
  const statusCode = typeof (error as any).statusCode === 'number' ? (error as any).statusCode : 500;
  const requestId = (request as any).requestId || request.id;
  const code = (error as any).code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');

  request.log.error({
    requestId,
    code,
    statusCode,
    message: error.message,
    stack: statusCode >= 500 ? error.stack : undefined,
  });

  reply.code(statusCode).send({
    error: {
      code,
      message: error.message || 'Unexpected error',
      request_id: requestId,
    },
  });
});

fastify.setNotFoundHandler((request, reply) => {
  const requestId = (request as any).requestId || request.id;
  reply.code(404).send({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
      request_id: requestId,
    },
  });
});

async function start() {
  try {
    await fastify.register(cors, {
      origin: true,
    });

    await fastify.register(multipart, {
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    });

    await fastify.register(cookie);

    await fastify.register(jwt, {
      secret: env.JWT_SECRET,
    });

    await fastify.register(authRoutes, { prefix: '/api' });
    await fastify.register(userRoutes, { prefix: '/api' });
    try {
      await fastify.register(routes, { prefix: '/api' });
      console.log('[Routes] Routes loaded successfully');
    } catch (routeError) {
      console.error('[Routes] ERROR loading routes:', routeError);
      throw routeError;
    }
    
    await connectMongoDB();

    // Seed default metric configurations
    try {
      const { MetricConfiguration } = await import('./db/mongo/models');
      const count = await MetricConfiguration.countDocuments();
      if (count === 0) {
        const DEFAULT_METRICS = [
          { metricId: 'temporal-patterns', name: 'Request Temporal Patterns', nameEs: 'Patrones Temporales de Solicitudes', description: 'Distribution of requests by hour, day, month', category: 'temporal', endpoint: '/analytics/temporal-patterns', chartType: 'line', isActive: true, order: 1 },
          { metricId: 'client-activity', name: 'Client Activity', nameEs: 'Actividad por Cliente', description: 'Client request volumes and activity trends', category: 'client', endpoint: '/analytics/client-activity', chartType: 'bar', isActive: true, order: 2 },
          { metricId: 'request-metrics', name: 'Request Metrics', nameEs: 'Métricas de Solicitudes', description: 'Request type distribution and status breakdown', category: 'request', endpoint: '/analytics/request-metrics', chartType: 'stat', isActive: true, order: 3 },
          { metricId: 'kanban-metrics', name: 'Kanban Metrics', nameEs: 'Métricas Kanban', description: 'Task completion rates and workload balance', category: 'kanban', endpoint: '/analytics/kanban-metrics', chartType: 'stat', isActive: true, order: 4 },
          { metricId: 'agent-performance', name: 'Agent Performance', nameEs: 'Rendimiento de Agentes', description: 'Agent response times and request handling efficiency', category: 'agent', endpoint: '/analytics/agent-performance', chartType: 'stat', isActive: true, order: 5 },
          { metricId: 'queue-metrics', name: 'Queue Metrics', nameEs: 'Métricas de Cola', description: 'Orchestrator queue performance and throughput', category: 'agent', endpoint: '/analytics/queue-metrics', chartType: 'stat', isActive: true, order: 6 },
        ];
        await MetricConfiguration.insertMany(DEFAULT_METRICS);
        console.log('✅ Seeded default metric configurations');
      }
    } catch (seedError) {
      console.warn('⚠️ Could not seed metrics:', (seedError as Error).message);
    }
    
    // Initialize system agents
    try {
      const { initializeSystemAgents } = await import('./services/agents/agent.service');
      await initializeSystemAgents();
      console.log('✅ System agents initialized');
    } catch (agentError) {
      console.error('❌ Error initializing agents:', agentError);
    }
    
    // Start orchestrator queue polling
    try {
      const { startQueuePolling } = await import('./services/orchestrator/queue');
      startQueuePolling();
      console.log('✅ Orchestrator queue polling started');
    } catch (queueError) {
      console.error('❌ Error starting orchestrator queue:', queueError);
    }

    // Start report scheduler
    try {
      const { startReportScheduler } = await import('./services/reports/scheduler');
      startReportScheduler();
      console.log('✅ Report scheduler started');
    } catch (schedulerError) {
      console.error('❌ Error starting report scheduler:', schedulerError);
    }
    
    // Auto-reindex on startup if enabled in settings
    try {
      const { Setting } = await import('./db/mongo/models');
      const reindexSetting = await Setting.findOne({ key: 'auto_reindex_on_startup' });
      if (reindexSetting?.value === true) {
        console.log('🔄 Auto-reindex on startup enabled, starting reindex...');
        const { reindexDocumentsToChroma } = await import('./services/kb/knowledge');
        const { reindexQAEntriesToChroma } = await import('./services/qa/qa');
        Promise.all([
          reindexDocumentsToChroma(),
          reindexQAEntriesToChroma(),
        ]).then(([kb, qa]) => {
          console.log(`✅ Auto-reindex complete: KB=${kb.success} QA=${qa.success}`);
        }).catch(err => {
          console.error('❌ Auto-reindex failed:', err);
        });
      }
    } catch (reindexError) {
      console.warn('⚠️ Could not check auto-reindex setting:', (reindexError as Error).message);
    }
    
    // Test route
    fastify.get('/api/test', async () => ({ status: 'ok', time: new Date().toISOString() }));
    
    await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
