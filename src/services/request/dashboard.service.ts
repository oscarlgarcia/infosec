import mongoose from 'mongoose';
import {
  Client,
  ClientRequest,
  CveImpact,
  Deliverable,
  RequestDocument,
  RequestEvent,
  RequestThread,
  User,
} from '../../db/mongo/models';
import { normalizeStatus, RequestStatuses } from '../../types/request';
import { serializeEvent, serializeRequest } from './serializer';
import { getReuseMetrics } from './deliverable.service';

const DAY = 86400000;

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY));
}

function agingBucket(days: number) {
  if (days <= 2) return '0-2';
  if (days <= 7) return '3-7';
  if (days <= 30) return '8-30';
  return '>30';
}

export async function getGlobalDashboard(options: { windowDays?: number } = {}) {
  const windowDays = Math.max(1, Number(options.windowDays) || 90);
  const since = new Date(Date.now() - windowDays * DAY);
  const now = new Date();

  const requests = await ClientRequest.find({ createdAt: { $gte: since } })
    .populate('clientId', 'name clientType country customerStatus currentPhase')
    .lean();

  const openStatuses = ['new', 'in_analysis', 'waiting_client', 'working', 'on_hold'];
  const open = requests.filter((request: any) => openStatuses.includes(normalizeStatus(request.status)));
  const overdue = open.filter((request: any) => request.deadline && new Date(request.deadline) < now);

  const byStatus: Record<string, number> = {};
  for (const status of RequestStatuses) byStatus[status] = 0;
  for (const request of requests) byStatus[normalizeStatus((request as any).status)] += 1;

  const byPriority: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
  const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byType = new Map<string, number>();
  const aging: Record<string, number> = { '0-2': 0, '3-7': 0, '8-30': 0, '>30': 0 };
  const byClient = new Map<string, { clientId: string; name: string; total: number; open: number; breached: number }>();
  const workload = new Map<string, { userId: string; name: string; open: number; overdue: number }>();

  for (const request of requests as any[]) {
    byPriority[request.priority || 'P3'] = (byPriority[request.priority || 'P3'] || 0) + 1;
    bySeverity[request.severity || 'medium'] = (bySeverity[request.severity || 'medium'] || 0) + 1;
    byType.set(request.requestType, (byType.get(request.requestType) || 0) + 1);

    const clientId = request.clientId?._id ? String(request.clientId._id) : String(request.clientId);
    const clientName = request.clientId?.name || request.clientSnapshot?.name || 'Desconocido';
    const entry = byClient.get(clientId) || { clientId, name: clientName, total: 0, open: 0, breached: 0 };
    entry.total += 1;
    if (openStatuses.includes(normalizeStatus(request.status))) entry.open += 1;
    if (request.slaState === 'breached') entry.breached += 1;
    byClient.set(clientId, entry);

    if (openStatuses.includes(normalizeStatus(request.status))) {
      aging[agingBucket(daysBetween(new Date(request.createdAt), now))] += 1;
      for (const field of ['infosecOwnerId', 'salesOwnerId', 'clientOwnerId']) {
        const userId = request[field];
        if (!userId) continue;
        const current = workload.get(userId) || { userId, name: userId, open: 0, overdue: 0 };
        current.open += 1;
        if (request.deadline && new Date(request.deadline) < now) current.overdue += 1;
        workload.set(userId, current);
      }
    }
  }

  const userIds = [...workload.keys()];
  if (userIds.length) {
    const users = await User.find({ _id: { $in: userIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) } })
      .select('username email')
      .lean();
    for (const user of users as any[]) {
      const entry = workload.get(String(user._id));
      if (entry) entry.name = user.username || user.email || entry.userId;
    }
  }

  const completed = requests.filter((request: any) => ['delivered', 'closed'].includes(normalizeStatus(request.status)));
  const resolutionSamples: number[] = [];
  const firstResponseSamples: number[] = [];
  let slaMet = 0;
  let slaMissed = 0;
  for (const request of completed as any[]) {
    const finishedAt = request.completedAt || request.deliveredAt;
    if (finishedAt) {
      resolutionSamples.push((new Date(finishedAt).getTime() - new Date(request.createdAt).getTime()) / DAY);
      if (request.slaResolutionDueAt) {
        if (new Date(finishedAt) <= new Date(request.slaResolutionDueAt)) slaMet++;
        else slaMissed++;
      }
    }
  }
  for (const request of requests as any[]) {
    if (request.firstResponseAt) {
      firstResponseSamples.push((new Date(request.firstResponseAt).getTime() - new Date(request.createdAt).getTime()) / 3600000);
    }
  }

  const reopenCount = (requests as any[]).reduce((sum, request) => sum + Number(request.reopenCount || 0), 0);
  const recentActivity = await RequestEvent.find({ createdAt: { $gte: new Date(Date.now() - 7 * DAY) } })
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();
  const cveImpacts = await CveImpact.countDocuments({ affected: true });
  const reuse = await getReuseMetrics(windowDays);

  return {
    windowDays,
    generatedAt: now.toISOString(),
    totals: {
      requests: requests.length,
      open: open.length,
      overdue: overdue.length,
      delivered: byStatus.delivered || 0,
      closed: byStatus.closed || 0,
      cancelled: byStatus.cancelled || 0,
      reopened: reopenCount,
    },
    sla: {
      atRisk: open.filter((request: any) => request.slaState === 'at_risk').length,
      breached: open.filter((request: any) => request.slaState === 'breached').length,
      paused: open.filter((request: any) => request.slaState === 'paused').length,
      compliancePct: slaMet + slaMissed ? Number(((slaMet / (slaMet + slaMissed)) * 100).toFixed(1)) : 0,
      firstResponseAvgHours: firstResponseSamples.length
        ? Number((firstResponseSamples.reduce((a, b) => a + b, 0) / firstResponseSamples.length).toFixed(1))
        : 0,
      resolutionAvgDays: resolutionSamples.length
        ? Number((resolutionSamples.reduce((a, b) => a + b, 0) / resolutionSamples.length).toFixed(1))
        : 0,
    },
    pipeline: RequestStatuses.map((status) => ({ status, count: byStatus[status] })),
    byPriority: Object.entries(byPriority).map(([priority, count]) => ({ priority, count })),
    bySeverity: Object.entries(bySeverity).map(([severity, count]) => ({ severity, count })),
    byType: [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    aging: Object.entries(aging).map(([bucket, count]) => ({ bucket, count })),
    topClients: [...byClient.values()].sort((a, b) => b.total - a.total).slice(0, 10),
    workload: [...workload.values()].sort((a, b) => b.open - a.open).slice(0, 15),
    knowledgeReuse: reuse,
    cve: { affectedClients: cveImpacts },
    recentActivity: recentActivity.map(serializeEvent),
  };
}

export async function getClient360(clientId: string) {
  if (!mongoose.Types.ObjectId.isValid(clientId)) {
    throw Object.assign(new Error('Invalid client id'), { statusCode: 400 });
  }
  const client = await Client.findById(clientId).lean();
  if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });

  const objectId = new mongoose.Types.ObjectId(clientId);
  const requests = await ClientRequest.find({ clientId: objectId })
    .sort({ createdAt: -1 })
    .lean();
  const requestIds = requests.map((request: any) => request._id);

  const [deliverables, documents, impacts, events, threads] = await Promise.all([
    Deliverable.find({ requestId: { $in: requestIds } }).sort({ createdAt: -1 }).limit(50).lean(),
    RequestDocument.find({ requestId: { $in: requestIds }, deletedAt: null }).sort({ createdAt: -1 }).limit(50).lean(),
    CveImpact.find({ clientId: objectId }).sort({ createdAt: -1 }).lean(),
    RequestEvent.find({ requestId: { $in: requestIds } }).sort({ createdAt: -1 }).limit(100).lean(),
    RequestThread.find({ requestId: { $in: requestIds } }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  const openStatuses = ['new', 'in_analysis', 'waiting_client', 'working', 'on_hold'];
  const open = requests.filter((request: any) => openStatuses.includes(normalizeStatus(request.status)));
  const finished = requests.filter((request: any) => ['delivered', 'closed'].includes(normalizeStatus(request.status)));
  const resolutionSamples = finished
    .map((request: any) => {
      const at = request.completedAt || request.deliveredAt;
      return at ? (new Date(at).getTime() - new Date(request.createdAt).getTime()) / DAY : null;
    })
    .filter((value): value is number => value !== null);

  return {
    client,
    metrics: {
      totalRequests: requests.length,
      open: open.length,
      overdue: open.filter((request: any) => request.deadline && new Date(request.deadline) < new Date()).length,
      breached: requests.filter((request: any) => request.slaState === 'breached').length,
      delivered: requests.filter((request: any) => normalizeStatus(request.status) === 'delivered').length,
      closed: requests.filter((request: any) => normalizeStatus(request.status) === 'closed').length,
      avgResolutionDays: resolutionSamples.length
        ? Number((resolutionSamples.reduce((a, b) => a + b, 0) / resolutionSamples.length).toFixed(1))
        : 0,
      reopenCount: requests.reduce((sum: number, request: any) => sum + Number(request.reopenCount || 0), 0),
    },
    requests: requests.map((request: any) => serializeRequest(request)),
    deliverables,
    documents,
    cveImpacts: impacts,
    threads,
    timeline: events.map(serializeEvent),
  };
}

export async function getWorkloadByUser(userId: string) {
  const requests = await ClientRequest.find({
    $or: [{ infosecOwnerId: userId }, { salesOwnerId: userId }, { clientOwnerId: userId }],
    status: { $nin: ['closed', 'cancelled', 'completed'] },
  })
    .populate('clientId', 'name')
    .sort({ priority: 1, deadline: 1 })
    .limit(200)
    .lean();
  return {
    userId,
    open: requests.length,
    overdue: requests.filter((request: any) => request.deadline && new Date(request.deadline) < new Date()).length,
    requests: requests.map((request: any) => serializeRequest(request)),
  };
}
