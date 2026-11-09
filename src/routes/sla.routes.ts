import { FastifyInstance } from 'fastify';
import { verifyToken, requireRole } from '../middleware/auth';
import { BusinessCalendar, ClientSlaOverride, Setting, SlaPolicy } from '../db/mongo/models';
import { ContractTypes, ServiceModels } from '../types/request';
import {
  businessCalendarSchema,
  clientSlaOverrideSchema,
  parseOrThrow,
  slaPolicySchema,
} from '../schemas/request';
import { ensureDefaultSlaConfiguration, runSlaSweep } from '../services/request/sla.service';

const CATALOG_KEYS = {
  contractTypes: 'catalog:contractTypes',
  serviceModels: 'catalog:serviceModels',
};

async function getCatalog(key: string, fallback: readonly string[]) {
  const setting = await Setting.findOne({ key }).lean();
  if (Array.isArray(setting?.value) && setting!.value.length) return setting!.value as string[];
  return [...fallback];
}

export async function slaRoutes(fastify: FastifyInstance) {
  fastify.get('/sla-policies', { preHandler: [verifyToken] }, async () => {
    await ensureDefaultSlaConfiguration();
    const items = await SlaPolicy.find({}).populate('calendarId', 'name timezone').sort({ order: 1, createdAt: 1 }).lean();
    return { items };
  });

  fastify.post('/sla-policies', { preHandler: [verifyToken, requireRole('admin')] }, async (request, reply) => {
    const body = parseOrThrow(slaPolicySchema, request.body);
    const policy = await SlaPolicy.create(body as any);
    return reply.code(201).send(policy);
  });

  fastify.put<{ Params: { id: string } }>('/sla-policies/:id', { preHandler: [verifyToken, requireRole('admin')] }, async (request, reply) => {
    const body = parseOrThrow(slaPolicySchema.partial(), request.body);
    const policy = await SlaPolicy.findByIdAndUpdate(request.params.id, { $set: body as any }, { new: true });
    if (!policy) return reply.code(404).send({ error: 'Policy not found' });
    return policy;
  });

  fastify.delete<{ Params: { id: string } }>('/sla-policies/:id', { preHandler: [verifyToken, requireRole('admin')] }, async (request, reply) => {
    await SlaPolicy.findByIdAndDelete(request.params.id);
    return reply.code(204).send();
  });

  function overridePayload(body: any, request: any) {
    const payload: Record<string, any> = { ...body };
    for (const key of ['effectiveFrom', 'effectiveTo']) {
      if (payload[key] !== undefined) {
        payload[key] = payload[key] ? new Date(payload[key]) : undefined;
      }
    }
    if (payload.calendarId === '') payload.calendarId = undefined;
    if (request.user) {
      payload.updatedBy = request.user.username || request.user.email || request.user.id;
    }
    return payload;
  }

  fastify.get<{ Params: { id: string } }>(
    '/clients/:id/sla-overrides',
    { preHandler: [verifyToken] },
    async (request) => {
      const items = await ClientSlaOverride.find({ clientId: request.params.id })
        .populate('calendarId', 'name timezone')
        .sort({ createdAt: -1 })
        .lean();
      return { items };
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/clients/:id/sla-overrides',
    { preHandler: [verifyToken, requireRole('admin', 'manager')] },
    async (request, reply) => {
      const body = parseOrThrow(clientSlaOverrideSchema, request.body);
      const payload = overridePayload(body, request);
      payload.clientId = request.params.id;
      if (request.user) {
        payload.createdBy = request.user.username || request.user.email || request.user.id;
      }
      const override = await ClientSlaOverride.create(payload);
      return reply.code(201).send(override);
    }
  );

  fastify.put<{ Params: { id: string } }>(
    '/sla-overrides/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager')] },
    async (request, reply) => {
      const body = parseOrThrow(clientSlaOverrideSchema.partial(), request.body);
      const payload = overridePayload(body, request);
      const override = await ClientSlaOverride.findByIdAndUpdate(
        request.params.id,
        { $set: payload },
        { new: true }
      );
      if (!override) return reply.code(404).send({ error: 'SLA override not found' });
      return override;
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/sla-overrides/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager')] },
    async (request, reply) => {
      await ClientSlaOverride.findByIdAndDelete(request.params.id);
      return reply.code(204).send();
    }
  );

  fastify.get('/business-calendars', { preHandler: [verifyToken] }, async () => {
    await ensureDefaultSlaConfiguration();
    const items = await BusinessCalendar.find({}).sort({ createdAt: 1 }).lean();
    return { items };
  });

  fastify.post('/business-calendars', { preHandler: [verifyToken, requireRole('admin')] }, async (request, reply) => {
    const body = parseOrThrow(businessCalendarSchema, request.body);
    const calendar = await BusinessCalendar.create({
      ...body,
      holidays: (body.holidays || []).map((holiday) => new Date(holiday)),
    } as any);
    return reply.code(201).send(calendar);
  });

  fastify.put<{ Params: { id: string } }>('/business-calendars/:id', { preHandler: [verifyToken, requireRole('admin')] }, async (request, reply) => {
    const body = parseOrThrow(businessCalendarSchema.partial(), request.body);
    const update: Record<string, any> = { ...body };
    if (body.holidays) update.holidays = body.holidays.map((holiday) => new Date(holiday));
    const calendar = await BusinessCalendar.findByIdAndUpdate(request.params.id, { $set: update }, { new: true });
    if (!calendar) return reply.code(404).send({ error: 'Calendar not found' });
    return calendar;
  });

  fastify.delete<{ Params: { id: string } }>('/business-calendars/:id', { preHandler: [verifyToken, requireRole('admin')] }, async (request, reply) => {
    await BusinessCalendar.findByIdAndDelete(request.params.id);
    return reply.code(204).send();
  });

  fastify.get('/catalogs', { preHandler: [verifyToken] }, async () => {
    return {
      contractTypes: await getCatalog(CATALOG_KEYS.contractTypes, ContractTypes),
      serviceModels: await getCatalog(CATALOG_KEYS.serviceModels, ServiceModels),
    };
  });

  fastify.put<{ Params: { name: string } }>('/catalogs/:name', { preHandler: [verifyToken, requireRole('admin')] }, async (request, reply) => {
    const name = request.params.name;
    const key = (CATALOG_KEYS as any)[name];
    if (!key) return reply.code(404).send({ error: 'Unknown catalog' });
    const values = (request.body as any)?.values;
    if (!Array.isArray(values) || !values.length) {
      return reply.code(400).send({ error: 'values must be a non-empty array' });
    }
    const setting = await Setting.findOneAndUpdate(
      { key },
      { $set: { key, value: values } },
      { upsert: true, new: true }
    );
    return { name, values: setting.value };
  });

  fastify.post('/sla/run-sweep', { preHandler: [verifyToken, requireRole('admin', 'manager')] }, async () => {
    return runSlaSweep(new Date());
  });
}
