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
    
    // Initialize system agents
    try {
      const { initializeSystemAgents } = await import('./services/agents/agent.service');
      await initializeSystemAgents();
      console.log('✅ System agents initialized');
    } catch (agentError) {
      console.error('❌ Error initializing agents:', agentError);
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
