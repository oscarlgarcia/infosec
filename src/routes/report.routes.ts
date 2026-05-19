import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, requireRole } from '../middleware/auth';
import {
  generateTermReport,
  listReports,
  getReport,
  deleteReport,
  saveReport,
} from '../services/analysis/termReport.service';
import {
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  runScheduleNow,
} from '../services/reports/scheduler.service';
import {
  listSnapshots,
  getSnapshot,
  diffSnapshots,
} from '../services/reports/snapshot.service';

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: { term: string } }>(
    '/reports/generate',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Body: { term: string } }>, reply: FastifyReply) => {
      try {
        const term = request.body?.term?.trim();
        if (!term) return reply.code(400).send({ error: 'Term is required' });
        const report = await generateTermReport({ term, generatedBy: request.user?.username || 'system' });
        return reply.code(200).send(report);
      } catch (error) {
        console.error('Error generating term report:', error);
        return reply.code(500).send({ error: 'Failed to generate report' });
      }
    }
  );

  fastify.post<{ Body: { term: string } }>(
    '/reports/save',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Body: { term: string } }>, reply: FastifyReply) => {
      try {
        const term = request.body?.term?.trim();
        if (!term) return reply.code(400).send({ error: 'Term is required' });
        const report = await generateTermReport({ term, generatedBy: request.user?.username || 'system' });
        const saved = await saveReport(report);
        return reply.code(201).send(saved);
      } catch (error) {
        console.error('Error saving term report:', error);
        return reply.code(500).send({ error: 'Failed to save report' });
      }
    }
  );

  fastify.get(
    '/reports',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as any;
        const result = await listReports({
          search: query.search,
          page: query.page ? parseInt(query.page) : 1,
          pageSize: query.pageSize ? parseInt(query.pageSize) : 20,
        });
        return result;
      } catch (error) {
        console.error('Error listing reports:', error);
        return reply.code(500).send({ error: 'Failed to list reports' });
      }
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/reports/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const report = await getReport(request.params.id);
      if (!report) return reply.code(404).send({ error: 'Report not found' });
      return report;
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/reports/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const deleted = await deleteReport(request.params.id);
      if (!deleted) return reply.code(404).send({ error: 'Report not found' });
      return reply.code(204).send();
    }
  );

  // Schedule routes
  fastify.get(
    '/reports/schedules',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as any;
      const result = await listSchedules({ enabled: query.enabled === 'true' ? true : undefined });
      return result;
    }
  );

  fastify.post<{ Body: { term: string; frequency: string; notifyOnChanges?: boolean; scheduleHour?: number; scheduleMinute?: number; dayOfWeek?: number; dayOfMonth?: number } }>(
    '/reports/schedules',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Body: { term: string; frequency: string; notifyOnChanges?: boolean; scheduleHour?: number; scheduleMinute?: number; dayOfWeek?: number; dayOfMonth?: number } }>, reply: FastifyReply) => {
      if (!request.body?.term || !request.body?.frequency) {
        return reply.code(400).send({ error: 'Term and frequency are required' });
      }
      const schedule = await createSchedule({
        term: request.body.term,
        frequency: request.body.frequency,
        createdBy: request.user?.username || 'system',
        notifyOnChanges: request.body.notifyOnChanges,
        scheduleHour: request.body.scheduleHour,
        scheduleMinute: request.body.scheduleMinute,
        dayOfWeek: request.body.dayOfWeek,
        dayOfMonth: request.body.dayOfMonth,
      });
      return reply.code(201).send(schedule);
    }
  );

  fastify.put<{ Params: { id: string }; Body: { term?: string; frequency?: string; enabled?: boolean; notifyOnChanges?: boolean; scheduleHour?: number; scheduleMinute?: number; dayOfWeek?: number; dayOfMonth?: number } }>(
    '/reports/schedules/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const updated = await updateSchedule(request.params.id, request.body);
      if (!updated) return reply.code(404).send({ error: 'Schedule not found' });
      return updated;
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/reports/schedules/:id',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const deleted = await deleteSchedule(request.params.id);
      if (!deleted) return reply.code(404).send({ error: 'Schedule not found' });
      return reply.code(204).send();
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/reports/schedules/:id/run-now',
    { preHandler: [verifyToken, requireRole('admin', 'manager', 'sme')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const result = await runScheduleNow(request.params.id);
        if (!result) return reply.code(404).send({ error: 'Schedule not found' });
        return result;
      } catch (error) {
        console.error('Error running schedule:', error);
        return reply.code(500).send({ error: 'Failed to run schedule' });
      }
    }
  );

  // Snapshot routes
  fastify.get(
    '/reports/snapshots',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as any;
      const result = await listSnapshots({
        scheduleId: query.scheduleId,
        term: query.term,
        limit: query.limit ? parseInt(query.limit) : 10,
      });
      return result;
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/reports/snapshots/:id',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const snapshot = await getSnapshot(request.params.id);
      if (!snapshot) return reply.code(404).send({ error: 'Snapshot not found' });
      return snapshot;
    }
  );

  fastify.get<{ Params: { id: string; otherId: string } }>(
    '/reports/snapshots/:id/diff/:otherId',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest<{ Params: { id: string; otherId: string } }>, reply: FastifyReply) => {
      try {
        const diff = await diffSnapshots(request.params.id, request.params.otherId);
        if (!diff) return reply.code(404).send({ error: 'Snapshots not found' });
        return diff;
      } catch (error) {
        console.error('Error diffing snapshots:', error);
        return reply.code(500).send({ error: 'Failed to diff snapshots' });
      }
    }
  );
}
