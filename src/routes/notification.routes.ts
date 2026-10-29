import { FastifyInstance } from 'fastify';
import { verifyToken } from '../middleware/auth';
import { env } from '../config';
import { Client, ClientRequest } from '../db/mongo/models';
import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  saveNotificationPreferences,
} from '../services/notifications/notification.service';
import { logEvent } from '../services/request/event.service';
import { createRequest } from '../services/request/request.service';
import { emailInboundSchema, notificationPreferencesSchema, parseOrThrow } from '../schemas/request';

function extractEmail(value: string): string {
  const match = /<([^>]+)>/.exec(value || '');
  if (match) return match[1].trim().toLowerCase();
  return String(value || '').trim().toLowerCase();
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

export async function notificationRoutes(fastify: FastifyInstance) {
  fastify.get('/notifications', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
      const query = request.query as any;
      return await listNotifications(request.user.id, {
        unreadOnly: query.unread === 'true' || query.unreadOnly === 'true',
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 30,
      });
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post<{ Params: { id: string } }>('/notifications/:id/read', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
      const notification = await markNotificationRead(request.user.id, request.params.id);
      if (!notification) return reply.code(404).send({ error: 'Notification not found' });
      return notification;
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.post('/notifications/read-all', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
      await markAllNotificationsRead(request.user.id);
      return { success: true };
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.get('/notification-preferences', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
      return await getNotificationPreferences(request.user.id);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  fastify.put('/notification-preferences', { preHandler: [verifyToken] }, async (request, reply) => {
    try {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
      const body = parseOrThrow(notificationPreferencesSchema, request.body);
      return await saveNotificationPreferences(request.user.id, body);
    } catch (error) {
      return replyError(reply, error);
    }
  });

  /**
   * Minimal inbound email webhook. Requires EMAIL_INBOUND_SECRET and a shared
   * secret header. Never trusts the payload for authentication.
   */
  fastify.post('/integrations/email/inbound', async (request, reply) => {
    try {
      if (!env.EMAIL_INBOUND_SECRET) {
        return reply.code(503).send({ error: { code: 'EMAIL_INBOUND_DISABLED', message: 'EMAIL_INBOUND_SECRET is not configured' } });
      }
      const headerSecret = request.headers['x-inbound-secret'];
      const bodySecret = (request.body as any)?.secret;
      if (headerSecret !== env.EMAIL_INBOUND_SECRET && bodySecret !== env.EMAIL_INBOUND_SECRET) {
        return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid inbound secret' } });
      }

      const body = parseOrThrow(emailInboundSchema, request.body);
      const fromEmail = extractEmail(body.from);

      let client: any = null;
      if (body.clientId) {
        client = await Client.findById(body.clientId).lean();
      } else {
        client = await Client.findOne({
          $or: [
            { 'stakeholders.email': fromEmail },
            { 'cveSubscriptions.recipients': fromEmail },
          ],
        }).lean();
      }

      if (!client) {
        return reply.code(404).send({
          error: {
            code: 'CLIENT_NOT_MATCHED',
            message: `No client matches ${fromEmail}`,
            matched: false,
          },
        });
      }

      const text = body.text || String(body.html || '').replace(/<[^>]+>/g, ' ').slice(0, 20000);

      if (body.requestId) {
        const existing = await ClientRequest.findOne({ _id: body.requestId, clientId: client._id }).lean();
        if (!existing) {
          return reply.code(404).send({ error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found for client' } });
        }
        const event = await logEvent({
          requestId: String(existing._id),
          type: 'email',
          visibility: 'client',
          authorName: body.from,
          partyType: 'client',
          body: `${body.subject}\n\n${text}`,
          metadata: { from: fromEmail, to: body.to, subject: body.subject, channel: 'email_inbound' },
        });
        return reply.code(201).send({ matched: true, clientId: String(client._id), requestId: String(existing._id), event });
      }

      const created = await createRequest({
        clientId: String(client._id),
        requestType: 'Other Support',
        title: body.subject,
        scope: text,
        comments: text,
        requestChannel: 'email',
        overrideDuplicate: true,
      }, { username: body.from, role: 'system' });

      return reply.code(201).send({
        matched: true,
        clientId: String(client._id),
        requestId: created?.id,
        requestKey: created?.requestKey,
      });
    } catch (error) {
      return replyError(reply, error);
    }
  });
}
