import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { verifyToken, requireRole } from '../middleware/auth';
import { Client, Contract } from '../db/mongo/models';
import {
  contractCancelSchema,
  contractRenewSchema,
  contractSchema,
  contractUpdateSchema,
  parseOrThrow,
} from '../schemas/request';

const CONTRACT_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'contracts');

function toDate(value: any): Date | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function actorOf(request: any): string {
  return request.user?.username || request.user?.email || request.user?.id || 'system';
}

function contractPayload(body: any) {
  const payload: Record<string, any> = {};
  const passthrough = [
    'name',
    'contractNumber',
    'contractType',
    'serviceModel',
    'status',
    'autoRenew',
    'renewalNoticeDays',
    'notes',
    'metadata',
  ];
  for (const key of passthrough) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  for (const key of ['signedAt', 'startDate', 'endDate']) {
    if (body[key] !== undefined) payload[key] = toDate(body[key]);
  }
  return payload;
}

async function syncClientContractFields(clientId: string) {
  const [latest, active] = await Promise.all([
    Contract.findOne({ clientId }).sort({ createdAt: -1 }).lean(),
    Contract.findOne({ clientId, status: 'active' }).sort({ startDate: -1, createdAt: -1 }).lean(),
  ]);
  await Client.findByIdAndUpdate(clientId, {
    contractSigned: Boolean(active),
    contractType: (active || latest)?.contractType || null,
    serviceModel: (active || latest)?.serviceModel || null,
  });
}

async function findContract(id: string) {
  return Contract.findById(id);
}

export async function contractRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    '/clients/:id/contracts',
    { preHandler: [verifyToken] },
    async (request) => {
      const items = await Contract.find({ clientId: request.params.id })
        .sort({ startDate: -1, createdAt: -1 })
        .lean();
      return { items };
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/clients/:id/contracts',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const body = parseOrThrow(contractSchema, request.body);
      const payload = contractPayload(body);
      payload.clientId = request.params.id;
      payload.createdBy = actorOf(request);
      payload.updatedBy = actorOf(request);
      if (payload.status === 'active' && !payload.signedAt) payload.signedAt = new Date();

      const contract = await Contract.create(payload);
      await syncClientContractFields(request.params.id);
      return reply.code(201).send(contract);
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/contracts/:id',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const contract = await findContract(request.params.id).then((item) => item?.toObject());
      if (!contract) return reply.code(404).send({ error: 'Contract not found' });
      return contract;
    }
  );

  fastify.put<{ Params: { id: string } }>(
    '/contracts/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const body = parseOrThrow(contractUpdateSchema, request.body);
      const payload = contractPayload(body);
      payload.updatedBy = actorOf(request);

      const existing = await findContract(request.params.id);
      if (!existing) return reply.code(404).send({ error: 'Contract not found' });
      if (payload.status === 'active' && !existing.signedAt && !payload.signedAt) {
        payload.signedAt = new Date();
      }

      Object.assign(existing, payload);
      await existing.save();
      await syncClientContractFields(String(existing.clientId));
      return existing;
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/contracts/:id/sign',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const contract = await findContract(request.params.id);
      if (!contract) return reply.code(404).send({ error: 'Contract not found' });
      contract.status = 'active';
      contract.signedAt = contract.signedAt || new Date();
      contract.updatedBy = actorOf(request);
      await contract.save();
      await syncClientContractFields(String(contract.clientId));
      return contract;
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/contracts/:id/renew',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const previous = await findContract(request.params.id);
      if (!previous) return reply.code(404).send({ error: 'Contract not found' });

      const body = parseOrThrow(contractRenewSchema, request.body);
      const payload = contractPayload(body);
      const fallbackEnd = previous.endDate
        ? new Date(new Date(previous.endDate).getTime() + 365 * 24 * 60 * 60 * 1000)
        : undefined;

      const contract = await Contract.create({
        clientId: previous.clientId,
        name: payload.name || `${previous.name} (renewal)`,
        contractNumber: payload.contractNumber ?? previous.contractNumber,
        contractType: payload.contractType || previous.contractType,
        serviceModel: payload.serviceModel ?? previous.serviceModel,
        status: payload.status || 'draft',
        signedAt: payload.signedAt,
        startDate: payload.startDate || previous.endDate || new Date(),
        endDate: payload.endDate || fallbackEnd,
        autoRenew: payload.autoRenew ?? previous.autoRenew,
        renewalNoticeDays: payload.renewalNoticeDays ?? previous.renewalNoticeDays,
        notes: payload.notes ?? previous.notes,
        metadata: payload.metadata ?? previous.metadata,
        renewedFromContractId: previous._id,
        createdBy: actorOf(request),
        updatedBy: actorOf(request),
      });

      if (contract.status === 'active') {
        previous.status = 'renewed';
        previous.replacedByContractId = contract._id;
        previous.updatedBy = actorOf(request);
        await previous.save();
      }

      await syncClientContractFields(String(previous.clientId));
      return reply.code(201).send(contract);
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/contracts/:id/cancel',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const body = parseOrThrow(contractCancelSchema, request.body || {});
      const contract = await findContract(request.params.id);
      if (!contract) return reply.code(404).send({ error: 'Contract not found' });
      contract.status = 'cancelled';
      contract.cancelledAt = toDate(body.cancelledAt) || new Date();
      contract.cancellationReason = body.reason || undefined;
      contract.updatedBy = actorOf(request);
      await contract.save();
      await syncClientContractFields(String(contract.clientId));
      return contract;
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/contracts/:id/attachments',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request, reply) => {
      const data = await request.file();
      if (!data) return reply.code(400).send({ error: 'No file uploaded' });

      const contract = await findContract(request.params.id);
      if (!contract) return reply.code(404).send({ error: 'Contract not found' });

      if (!fs.existsSync(CONTRACT_UPLOAD_DIR)) {
        fs.mkdirSync(CONTRACT_UPLOAD_DIR, { recursive: true });
      }

      const ext = path.extname(data.filename);
      const storedFilename = `${request.params.id}-${Date.now()}${ext}`;
      const buffer = await data.toBuffer();
      fs.writeFileSync(path.join(CONTRACT_UPLOAD_DIR, storedFilename), buffer);

      contract.attachments.push({
        filename: storedFilename,
        originalName: data.filename,
        path: `/uploads/contracts/${storedFilename}`,
        mimeType: data.mimetype || 'application/octet-stream',
        size: buffer.length,
      } as any);
      contract.updatedBy = actorOf(request);
      await contract.save();

      return reply.code(201).send(contract.attachments[contract.attachments.length - 1]);
    }
  );
}
