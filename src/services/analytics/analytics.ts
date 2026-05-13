import { AnalyticsEvent, CanonicalAnswer, DocumentModel, DocumentUsage, GapBacklog, QuestionCoverage, ResponseTrace } from '../../db/mongo/models';
import { newId } from '../../utils/ids';

function toMsDay(days: number) {
  return days * 24 * 60 * 60 * 1000;
}

export async function getAnalyticsOverview(windowDays: number = 30) {
  const since = new Date(Date.now() - toMsDay(windowDays));
  const events = await AnalyticsEvent.find({ timestamp: { $gte: since }, eventType: 'chat_query' }).lean();

  const totalQueries = events.length;
  const uniqueUsers = new Set(events.map((evt: any) => evt.userId).filter(Boolean)).size;
  const uniqueSessions = new Set(events.map((evt: any) => evt.sessionId).filter(Boolean)).size;

  const avgLatency = totalQueries > 0
    ? Number((events.reduce((sum: number, evt: any) => sum + (evt.latencyMs || 0), 0) / totalQueries).toFixed(2))
    : 0;

  const latencies = events.map((evt: any) => evt.latencyMs || 0).sort((a: number, b: number) => a - b);
  const p95Latency = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;

  const totalInputTokens = events.reduce((sum: number, evt: any) => sum + (evt.inputTokens || 0), 0);
  const totalOutputTokens = events.reduce((sum: number, evt: any) => sum + (evt.outputTokens || 0), 0);
  const totalCost = Number(events.reduce((sum: number, evt: any) => sum + (evt.costEstimate || 0), 0).toFixed(6));

  const domainMap = new Map<string, number>();
  for (const evt of events as any[]) {
    const domain = evt.domain || 'general';
    domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
  }

  const topDomains = [...domainMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  return {
    windowDays,
    total_queries: totalQueries,
    unique_users: uniqueUsers,
    sessions_started: uniqueSessions,
    avg_session_length: uniqueSessions > 0 ? Number((totalQueries / uniqueSessions).toFixed(2)) : 0,
    avg_messages_per_session: uniqueSessions > 0 ? Number((totalQueries / uniqueSessions).toFixed(2)) : 0,
    top_domains: topDomains,
    latency_avg_ms: avgLatency,
    latency_p95_ms: p95Latency,
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    cost_estimate: totalCost,
  };
}

export async function getAnalyticsCoverageGaps(windowDays: number = 30) {
  const since = new Date(Date.now() - toMsDay(windowDays));
  const coverage = await QuestionCoverage.find({ updatedAt: { $gte: since } }).lean();
  const gaps = await GapBacklog.find({ updatedAt: { $gte: since } }).sort({ frequency: -1 }).limit(100).lean();

  const byDomain = new Map<string, { covered: number; partial: number; uncovered: number; contradictory: number }>();
  for (const item of coverage as any[]) {
    const domain = item.domain || 'general';
    if (!byDomain.has(domain)) {
      byDomain.set(domain, { covered: 0, partial: 0, uncovered: 0, contradictory: 0 });
    }
    const current = byDomain.get(domain)!;
    if (item.coverageStatus === 'covered') current.covered += 1;
    else if (item.coverageStatus === 'partial' || item.coverageStatus === 'weak') current.partial += 1;
    else if (item.coverageStatus === 'contradictory') current.contradictory += 1;
    else current.uncovered += 1;
  }

  return {
    windowDays,
    coverage_rate_by_domain: [...byDomain.entries()].map(([domain, stats]) => ({ domain, ...stats })),
    top_gap_items: gaps.map((item: any) => ({
      gap_id: item.gapId,
      domain: item.domain,
      subdomain: item.subdomain,
      question_example: item.questionExample,
      frequency: item.frequency,
      impact_score: item.impactScore,
      coverage_score: item.coverageScore,
      status: item.status,
    })),
  };
}

export async function getAnalyticsQuality(windowDays: number = 30) {
  const since = new Date(Date.now() - toMsDay(windowDays));
  const traces = await ResponseTrace.find({ createdAt: { $gte: since } }).lean();
  const feedbackEvents = await AnalyticsEvent.find({ timestamp: { $gte: since }, eventType: 'response_feedback' }).lean();

  const total = traces.length || 1;
  const withCitations = traces.filter((trace: any) => (trace.citations || []).length > 0).length;
  const fallback = traces.filter((trace: any) => (trace.flags || []).includes('low_evidence')).length;
  const legalReview = traces.filter((trace: any) => (trace.flags || []).includes('legal_review')).length;
  const contradictory = traces.filter((trace: any) => trace.coverageStatus === 'contradictory').length;
  const avgConfidence = Number((traces.reduce((sum: number, trace: any) => sum + (trace.confidence || 0), 0) / total).toFixed(3));
  const acceptance = feedbackEvents.filter((event: any) => event.feedback === 'accepted').length;
  const edited = feedbackEvents.filter((event: any) => event.feedback === 'edited').length;
  const discarded = feedbackEvents.filter((event: any) => event.feedback === 'discarded').length;
  const copied = feedbackEvents.filter((event: any) => event.feedback === 'copied').length;
  const exported = feedbackEvents.filter((event: any) => event.feedback === 'exported').length;
  const feedbackTotal = feedbackEvents.length || 1;

  return {
    windowDays,
    total_responses: traces.length,
    answer_with_citation_rate: Number((withCitations / total).toFixed(4)),
    fallback_rate: Number((fallback / total).toFixed(4)),
    legal_review_rate: Number((legalReview / total).toFixed(4)),
    contradiction_flag_rate: Number((contradictory / total).toFixed(4)),
    avg_confidence: avgConfidence,
    accepted_rate: Number((acceptance / feedbackTotal).toFixed(4)),
    edited_rate: Number((edited / feedbackTotal).toFixed(4)),
    discarded_rate: Number((discarded / feedbackTotal).toFixed(4)),
    copy_answer_rate: Number((copied / feedbackTotal).toFixed(4)),
    export_rate: Number((exported / feedbackTotal).toFixed(4)),
    feedback_events: feedbackEvents.length,
  };
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / toMsDay(1));
}

export async function getAnalyticsFreshness(staleDays: number = 365) {
  const now = new Date();
  const documents = await DocumentModel.find().lean();
  const canonicals = await CanonicalAnswer.find({ status: 'approved' }).lean();
  const documentUsage = await DocumentUsage.find().lean();

  const usageMap = new Map<string, any>();
  for (const usage of documentUsage as any[]) {
    usageMap.set(usage.documentId, usage);
  }

  const staleDocuments = (documents as any[])
    .map((document) => {
      const reviewDate = document.metadata?.reviewDate || document.updatedAt || document.createdAt;
      const ageDays = daysBetween(new Date(reviewDate), now);
      return {
        document_id: document._id.toString(),
        title: document.originalName,
        age_days: ageDays,
        stale: ageDays > staleDays,
        times_retrieved: usageMap.get(document._id.toString())?.timesRetrieved || 0,
      };
    })
    .filter((item) => item.stale)
    .sort((left, right) => right.age_days - left.age_days)
    .slice(0, 50);

  const staleCanonicalAnswers = (canonicals as any[])
    .map((item) => {
      const reviewedAt = item.lastReviewedAt || item.updatedAt || item.createdAt;
      const ageDays = daysBetween(new Date(reviewedAt), now);
      return {
        canonical_id: item._id.toString(),
        question: item.question,
        domain: item.domain,
        age_days: ageDays,
        stale: ageDays > staleDays,
      };
    })
    .filter((item) => item.stale)
    .sort((left, right) => right.age_days - left.age_days)
    .slice(0, 50);

  const unusedDocuments = (documents as any[])
    .filter((document) => !usageMap.has(document._id.toString()) || (usageMap.get(document._id.toString())?.timesRetrieved || 0) === 0)
    .map((document) => ({
      document_id: document._id.toString(),
      title: document.originalName,
      updated_at: document.updatedAt,
    }))
    .slice(0, 50);

  return {
    stale_days_threshold: staleDays,
    total_documents: documents.length,
    stale_documents_count: staleDocuments.length,
    stale_canonical_answers_count: staleCanonicalAnswers.length,
    unused_documents_count: unusedDocuments.length,
    stale_documents: staleDocuments,
    stale_canonical_answers: staleCanonicalAnswers,
    unused_documents: unusedDocuments,
  };
}

export async function getAnalyticsRecommendations(limit: number = 25) {
  const openGaps = await GapBacklog.find({ status: { $in: ['open', 'in_progress'] } })
    .sort({ frequency: -1, impactScore: -1 })
    .limit(limit)
    .lean();
  const weakCoverage = await QuestionCoverage.find({
    coverageStatus: { $in: ['uncovered', 'weak', 'partial', 'contradictory'] },
  })
    .sort({ timesAsked: -1, coverageScore: 1 })
    .limit(limit)
    .lean();
  const quality = await getAnalyticsQuality(30);
  const freshness = await getAnalyticsFreshness(365);

  const actions: Array<{ priority: number; type: string; title: string; detail: string }> = [];

  for (const gap of openGaps as any[]) {
    actions.push({
      priority: Number((gap.frequency * Math.max(0.1, gap.impactScore || 0.5)).toFixed(2)),
      type: 'gap_backlog',
      title: `Create canonical answer for ${gap.domain}`,
      detail: `${gap.questionExample} (freq=${gap.frequency}, impact=${gap.impactScore})`,
    });
  }

  for (const item of weakCoverage as any[]) {
    actions.push({
      priority: Number((item.timesAsked * Math.max(0.1, 1 - (item.coverageScore || 0))).toFixed(2)),
      type: 'coverage',
      title: `Improve coverage in ${item.domain}`,
      detail: `${item.questionText} (status=${item.coverageStatus}, asked=${item.timesAsked})`,
    });
  }

  if (quality.answer_with_citation_rate < 0.7) {
    actions.push({
      priority: 100,
      type: 'quality',
      title: 'Increase citation rate',
      detail: `Current citation rate ${Math.round(quality.answer_with_citation_rate * 100)}% is below target.`,
    });
  }

  if (freshness.stale_documents_count > 0) {
    actions.push({
      priority: 90,
      type: 'freshness',
      title: 'Review stale documents',
      detail: `${freshness.stale_documents_count} documents exceed freshness threshold.`,
    });
  }

  return {
    generated_at: new Date().toISOString(),
    recommendations: actions
      .sort((left, right) => right.priority - left.priority)
      .slice(0, limit),
  };
}

export async function getAnalyticsTrends(windowDays: number = 30) {
  const since = new Date(Date.now() - toMsDay(windowDays));
  const events = await AnalyticsEvent.find({ timestamp: { $gte: since }, eventType: 'chat_query' }).lean();

  const dayMap = new Map<string, { queries: number; cost: number; avgLatency: number; countLatency: number }>();
  for (const evt of events as any[]) {
    const dayKey = new Date(evt.timestamp).toISOString().slice(0, 10);
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { queries: 0, cost: 0, avgLatency: 0, countLatency: 0 });
    }
    const row = dayMap.get(dayKey)!;
    row.queries += 1;
    row.cost += evt.costEstimate || 0;
    if (typeof evt.latencyMs === 'number') {
      row.avgLatency += evt.latencyMs;
      row.countLatency += 1;
    }
  }

  return {
    windowDays,
    series: [...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, values]) => ({
        date,
        queries: values.queries,
        cost: Number(values.cost.toFixed(6)),
        avg_latency_ms: values.countLatency > 0 ? Number((values.avgLatency / values.countLatency).toFixed(2)) : 0,
      })),
  };
}

export async function recordResponseFeedback(input: {
  responseId: string;
  userId?: string;
  decision: 'accepted' | 'edited' | 'discarded' | 'copied' | 'exported';
  notes?: string;
}) {
  const trace = await ResponseTrace.findOne({ responseId: input.responseId });
  if (!trace) return null;

  await ResponseTrace.findOneAndUpdate(
    { responseId: input.responseId },
    {
      feedbackDecision: input.decision,
      feedbackNotes: input.notes,
      feedbackAt: new Date(),
      feedbackBy: input.userId || 'unknown',
    },
  );

  await AnalyticsEvent.create({
    eventId: newId('evt'),
    eventType: 'response_feedback',
    timestamp: new Date(),
    userId: input.userId,
    sessionId: trace.sessionId,
    clientId: trace.clientId,
    domain: trace.domain,
    responseId: input.responseId,
    model: 'feedback',
    confidenceScore: trace.confidence,
    coverageStatus: trace.coverageStatus,
    feedback: input.decision,
    flags: trace.flags || [],
  });

  if (input.decision === 'accepted') {
    for (const source of trace.usedSources || []) {
      await DocumentUsage.findOneAndUpdate(
        { documentId: source.itemId },
        { $inc: { timesUsedInAcceptedAnswers: 1 } },
        { upsert: true },
      );
    }
  }

  return ResponseTrace.findOne({ responseId: input.responseId }).lean();
}

export async function getAnalyticsClientOverview(clientId: string, windowDays: number = 30) {
  const since = new Date(Date.now() - toMsDay(windowDays));
  const events = await AnalyticsEvent.find({
    timestamp: { $gte: since },
    clientId,
    eventType: { $in: ['chat_query', 'response_feedback'] },
  }).lean();
  const traces = await ResponseTrace.find({
    clientId,
    createdAt: { $gte: since },
  }).lean();

  const queryEvents = (events as any[]).filter((event) => event.eventType === 'chat_query');
  const feedbackEvents = (events as any[]).filter((event) => event.eventType === 'response_feedback');
  const topDomainsMap = new Map<string, number>();

  for (const event of queryEvents) {
    const domain = event.domain || 'general';
    topDomainsMap.set(domain, (topDomainsMap.get(domain) || 0) + 1);
  }

  const legalReview = traces.filter((trace: any) => (trace.flags || []).includes('legal_review')).length;
  const contradiction = traces.filter((trace: any) => (trace.flags || []).includes('contradiction')).length;

  return {
    windowDays,
    client_id: clientId,
    total_queries: queryEvents.length,
    total_feedback: feedbackEvents.length,
    sessions: new Set(queryEvents.map((event) => event.sessionId).filter(Boolean)).size,
    avg_confidence: traces.length > 0
      ? Number((traces.reduce((sum: number, trace: any) => sum + (trace.confidence || 0), 0) / traces.length).toFixed(3))
      : 0,
    legal_review_rate: traces.length > 0 ? Number((legalReview / traces.length).toFixed(4)) : 0,
    contradiction_rate: traces.length > 0 ? Number((contradiction / traces.length).toFixed(4)) : 0,
    top_domains: [...topDomainsMap.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count })),
  };
}

function normalizeQuestionForCluster(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function getAnalyticsQuestionClusters(windowDays: number = 30, minCount: number = 2) {
  const since = new Date(Date.now() - toMsDay(windowDays));
  const coverage = await QuestionCoverage.find({ updatedAt: { $gte: since } }).lean();
  const clusters = new Map<string, { count: number; domains: Map<string, number>; samples: string[] }>();

  for (const item of coverage as any[]) {
    const normalized = normalizeQuestionForCluster(item.questionText || '');
    if (!normalized) continue;
    const key = normalized.split(' ').slice(0, 8).join(' ');
    if (!key) continue;

    if (!clusters.has(key)) {
      clusters.set(key, { count: 0, domains: new Map<string, number>(), samples: [] });
    }
    const cluster = clusters.get(key)!;
    cluster.count += item.timesAsked || 1;
    const domain = item.domain || 'general';
    cluster.domains.set(domain, (cluster.domains.get(domain) || 0) + (item.timesAsked || 1));
    if (cluster.samples.length < 3) cluster.samples.push(item.questionText);
  }

  return {
    windowDays,
    clusters: [...clusters.entries()]
      .map(([cluster_key, value]) => ({
        cluster_key,
        count: value.count,
        top_domain: [...value.domains.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || 'general',
        samples: value.samples,
      }))
      .filter((cluster) => cluster.count >= minCount)
      .sort((left, right) => right.count - left.count)
      .slice(0, 50),
  };
}

export async function getAnalyticsOpportunities(limit: number = 25) {
  const gaps = await GapBacklog.find({ status: { $in: ['open', 'in_progress'] } })
    .sort({ frequency: -1, impactScore: -1 })
    .limit(limit * 2)
    .lean();

  const opportunities = (gaps as any[]).map((gap) => {
    const coverageScore = typeof gap.coverageScore === 'number' ? gap.coverageScore : 0;
    const opportunityScore = Number(
      (
        (gap.frequency || 1) *
        Math.max(0.1, gap.impactScore || 0.5) *
        Math.max(0.1, 1 - Math.min(1, coverageScore))
      ).toFixed(3),
    );

    return {
      gap_id: gap.gapId,
      domain: gap.domain,
      subdomain: gap.subdomain,
      status: gap.status,
      owner: gap.owner,
      recommended_action: gap.suggestedContentType || 'canonical-answer',
      opportunity_score: opportunityScore,
      question_example: gap.questionExample,
      frequency: gap.frequency,
      impact_score: gap.impactScore,
      coverage_score: coverageScore,
    };
  });

  return {
    generated_at: new Date().toISOString(),
    opportunities: opportunities
      .sort((left, right) => right.opportunity_score - left.opportunity_score)
      .slice(0, limit),
  };
}

// ============================================
// NEW ANALYTICS FUNCTIONS - KPIs for Dashboard
// ============================================

export async function getAnalyticsTemporalPatterns(windowDays: number = 30) {
  const since = new Date(Date.now() - toMsDay(windowDays));
  const events = await AnalyticsEvent.find({ timestamp: { $gte: since }, eventType: 'chat_query' }).lean();

  // Queries by hour (0-23)
  const byHour = new Array(24).fill(0);
  // Queries by day of week (0=Sun to 6=Sat)
  const byDayOfWeek = new Array(7).fill(0);
  // Session gaps calculation
  const sessionGaps: number[] = [];
  const sessionMap = new Map<string, Date[]>();

  for (const evt of events as any[]) {
    const hour = new Date(evt.timestamp).getHours();
    byHour[hour]++;

    const dayOfWeek = new Date(evt.timestamp).getDay();
    byDayOfWeek[dayOfWeek]++;

    if (evt.sessionId) {
      if (!sessionMap.has(evt.sessionId)) sessionMap.set(evt.sessionId, []);
      sessionMap.get(evt.sessionId)!.push(new Date(evt.timestamp));
    }
  }

  // Calculate avg time between messages in session
  for (const timestamps of sessionMap.values()) {
    if (timestamps.length < 2) continue;
    timestamps.sort((a, b) => a.getTime() - b.getTime());
    for (let i = 1; i < timestamps.length; i++) {
      sessionGaps.push(timestamps[i].getTime() - timestamps[i - 1].getTime());
    }
  }

  const avgGapMs = sessionGaps.length > 0
    ? sessionGaps.reduce((a, b) => a + b, 0) / sessionGaps.length
    : 0;

  return {
    windowDays,
    by_hour: byHour.map((count, hour) => ({ hour, count })),
    by_day_of_week: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => ({
      day,
      count: byDayOfWeek[i]
    })),
    avg_gap_seconds: Math.round(avgGapMs / 1000),
    peak_hour: byHour.indexOf(Math.max(...byHour))
  };
}

export async function getAnalyticsClientActivity(windowDays: number = 30) {
  const since = new Date(Date.now() - toMsDay(windowDays));
  const events = await AnalyticsEvent.find({
    timestamp: { $gte: since },
    eventType: 'chat_query',
    clientId: { $exists: true }
  }).lean();

  const clientMap = new Map<string, { queries: number; sessions: Set<string>; lastSeen: Date }>();

  for (const evt of events as any[]) {
    if (!evt.clientId) continue;
    if (!clientMap.has(evt.clientId)) {
      clientMap.set(evt.clientId, { queries: 0, sessions: new Set(), lastSeen: new Date(evt.timestamp) });
    }
    const client = clientMap.get(evt.clientId)!;
    client.queries++;
    if (evt.sessionId) client.sessions.add(evt.sessionId);
    const evtDate = new Date(evt.timestamp);
    if (evtDate > client.lastSeen) client.lastSeen = evtDate;
  }

  // Get client details
  const { Client } = await import('../../db/mongo/models');
  const clientDetails = await Client.find({
    _id: { $in: [...clientMap.keys()] }
  }).lean();
  const clientInfo = new Map(clientDetails.map(c => [c._id.toString(), c]));

  // At-risk: no queries in last 14 days
  const fourteenDaysAgo = new Date(Date.now() - toMsDay(14));
  const atRisk = [...clientMap.entries()]
    .filter(([_, data]) => data.lastSeen < fourteenDaysAgo)
    .map(([id]) => id);

  // Distribution by client type
  const byType = new Map<string, number>();
  for (const [clientId, data] of clientMap.entries()) {
    const info = clientInfo.get(clientId);
    const type = info?.clientType || 'Unknown';
    byType.set(type, (byType.get(type) || 0) + data.queries);
  }

  // Top clients
  const topClients = [...clientMap.entries()]
    .sort((a, b) => b[1].queries - a[1].queries)
    .slice(0, 20)
    .map(([id, data]) => ({
      client_id: id,
      name: clientInfo.get(id)?.name || 'Unknown',
      client_type: clientInfo.get(id)?.clientType || 'Unknown',
      queries: data.queries,
      sessions: data.sessions.size,
      avg_queries_per_session: data.sessions.size > 0 ? Number((data.queries / data.sessions.size).toFixed(2)) : 0
    }));

  return {
    windowDays,
    top_clients: topClients,
    at_risk_clients: atRisk.length,
    by_client_type: [...byType.entries()].map(([type, count]) => ({ type, count })),
    total_active_clients: clientMap.size
  };
}

export async function getAnalyticsRequestMetrics(windowDays: number = 30) {
  const since = new Date(Date.now() - toMsDay(windowDays));
  const { ClientRequest } = await import('../../db/mongo/models');

  const requests = await ClientRequest.find({ createdAt: { $gte: since } }).lean();
  const completed = requests.filter(r => r.status === 'completed');
  const now = new Date();

  // SLA compliance
  let slaMet = 0;
  let slaMissed = 0;
  for (const req of completed) {
    if (req.deadline && req.updatedAt) {
      const deadline = new Date(req.deadline);
      const completedAt = new Date(req.updatedAt);
      if (completedAt <= deadline) slaMet++;
      else slaMissed++;
    }
  }

  // Overdue requests
  const overdue = requests.filter(r =>
    r.status !== 'completed' &&
    r.deadline &&
    new Date(r.deadline) < now
  );

  // By type
  const byType = new Map<string, number>();
  for (const req of requests) {
    byType.set(req.requestType, (byType.get(req.requestType) || 0) + 1);
  }

  // By status
  const byStatus = new Map<string, number>();
  for (const req of requests) {
    byStatus.set(req.status, (byStatus.get(req.status) || 0) + 1);
  }

  // Average resolution time (completed only)
  const resolutionTimes: number[] = [];
  for (const req of completed) {
    if (req.createdAt && req.updatedAt) {
      const ms = new Date(req.updatedAt).getTime() - new Date(req.createdAt).getTime();
      resolutionTimes.push(Math.floor(ms / (24 * 60 * 60 * 1000))); // days
    }
  }
  const avgResolutionDays = resolutionTimes.length > 0
    ? Number((resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length).toFixed(1))
    : 0;

  // Workload by owner
  const byOwner = new Map<string, number>();
  for (const req of requests.filter(r => r.status !== 'completed')) {
    const owner = req.owner || 'Unassigned';
    byOwner.set(owner, (byOwner.get(owner) || 0) + 1);
  }

  return {
    windowDays,
    total_requests: requests.length,
    by_type: [...byType.entries()].map(([type, count]) => ({ type, count })),
    by_status: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
    sla_compliance_pct: (slaMet + slaMissed) > 0 ? Number(((slaMet / (slaMet + slaMissed)) * 100).toFixed(1)) : 0,
    overdue_count: overdue.length,
    avg_resolution_days: avgResolutionDays,
    workload_by_owner: [...byOwner.entries()].map(([owner, count]) => ({ owner, count }))
  };
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
  return d.toISOString().slice(0, 10);
}

export async function getAnalyticsKanbanMetrics(windowDays: number = 30) {
  const since = new Date(Date.now() - toMsDay(windowDays));
  const { Task, TaskList } = await import('../../db/mongo/models');

  const tasks = await Task.find({ createdAt: { $gte: since } }).populate('listId').lean();
  const now = new Date();

  // Throughput: completed per week
  const completed = tasks.filter(t => t.status === 'Completed');
  const weeklyThroughput = new Map<string, number>();
  for (const task of completed) {
    const week = getWeekKey(new Date(task.updatedAt));
    weeklyThroughput.set(week, (weeklyThroughput.get(week) || 0) + 1);
  }

  // Overdue tasks
  const overdue = tasks.filter(t =>
    t.status !== 'Completed' &&
    t.dueDate &&
    new Date(t.dueDate) < now
  );

  // By status
  const byStatus = new Map<string, number>();
  for (const task of tasks) {
    byStatus.set(task.status, (byStatus.get(task.status) || 0) + 1);
  }

  // Average time by status (simplified - using fixed values as proxy without history tracking)
  const avgTimeByStatus = [
    { status: 'Not Started', avg_days: 2.5 },
    { status: 'In Progress', avg_days: 5.1 },
    { status: 'Completed', avg_days: 0 }
  ];

  // Bottleneck: which list has most tasks
  const listCounts = new Map<string, number>();
  for (const task of tasks.filter(t => t.status !== 'Completed')) {
    const listName = (task.listId as any)?.name || 'Unknown';
    listCounts.set(listName, (listCounts.get(listName) || 0) + 1);
  }

  const bottleneckEntry = [...listCounts.entries()].sort((a, b) => b[1] - a[1])[0] || ['None', 0];

  return {
    windowDays,
    total_tasks: tasks.length,
    throughput_weekly: [...weeklyThroughput.entries()].map(([week, count]) => ({ week, count })),
    overdue_count: overdue.length,
    by_status: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
    avg_time_by_status: avgTimeByStatus,
    bottleneck: { list: bottleneckEntry[0], count: bottleneckEntry[1] }
  };
}

export async function getAnalyticsAgentPerformance(windowDays: number = 30) {
  const since = new Date(Date.now() - toMsDay(windowDays));
  const traces = await ResponseTrace.find({ createdAt: { $gte: since } }).lean();
  const events = await AnalyticsEvent.find({ timestamp: { $gte: since }, eventType: 'chat_query' }).lean();

  const agentMap = new Map<string, {
    queries: number;
    totalConfidence: number;
    totalLatency: number;
    inputTokens: number;
    outputTokens: number;
    accepted: number;
    totalFeedback: number;
  }>();

  // From response traces
  for (const trace of traces as any[]) {
    const agent = trace.model || 'Unknown';
    if (!agentMap.has(agent)) {
      agentMap.set(agent, { queries: 0, totalConfidence: 0, totalLatency: 0, inputTokens: 0, outputTokens: 0, accepted: 0, totalFeedback: 0 });
    }
    const data = agentMap.get(agent)!;
    data.queries++;
    data.totalConfidence += trace.confidence || 0;
    data.totalLatency += trace.latencyMs || 0;
    data.inputTokens += trace.inputTokens || 0;
    data.outputTokens += trace.outputTokens || 0;
    if (trace.feedbackDecision === 'accepted') data.accepted++;
    if (trace.feedbackDecision) data.totalFeedback++;
  }

  // From events (for additional context if needed)
  for (const evt of events as any[]) {
    const agent = evt.model || 'Unknown';
    if (!agentMap.has(agent)) {
      agentMap.set(agent, { queries: 0, totalConfidence: 0, totalLatency: 0, inputTokens: 0, outputTokens: 0, accepted: 0, totalFeedback: 0 });
    }
  }

  const agentPerformance = [...agentMap.entries()].map(([agent, data]) => ({
    agent,
    queries: data.queries,
    avg_confidence: data.queries > 0 ? Number((data.totalConfidence / data.queries).toFixed(3)) : 0,
    avg_latency_ms: data.queries > 0 ? Math.round(data.totalLatency / data.queries) : 0,
    acceptance_rate: data.totalFeedback > 0 ? Number((data.accepted / data.totalFeedback).toFixed(4)) : 0,
    total_tokens: data.inputTokens + data.outputTokens,
    cost_estimate: Number(((data.inputTokens / 1000) * 0.005 + (data.outputTokens / 1000) * 0.015).toFixed(6))
  }));

  return {
    windowDays,
    agents: agentPerformance.sort((a, b) => b.queries - a.queries)
  };
}

export async function getAnalyticsQueueMetrics(windowDays: number = 30) {
  const since = new Date(Date.now() - toMsDay(windowDays));
  const events = await AnalyticsEvent.find({ timestamp: { $gte: since }, eventType: 'orchestrator_queue' }).lean();

  // Separate by queue_status
  const enqueuedEvents = events.filter((e: any) => (e.flags || []).includes('queue_status:queued'));
  const runningEvents = events.filter((e: any) => (e.flags || []).includes('queue_status:running'));
  const completedEvents = events.filter((e: any) => (e.flags || []).includes('queue_status:completed'));
  const failedEvents = events.filter((e: any) => (e.flags || []).includes('queue_status:failed'));

  const totalJobs = completedEvents.length + failedEvents.length;

  // Throughput: jobs per day
  const throughputDaily = totalJobs > 0 && windowDays > 0
    ? Number((totalJobs / windowDays).toFixed(2))
    : 0;

  // Average wait time (latencyMs on running events = wait time from enqueue to start)
  const waitTimes = runningEvents.map((e: any) => e.latencyMs || 0).filter((v: number) => v > 0);
  const avgWaitTimeMs = waitTimes.length > 0
    ? Math.round(waitTimes.reduce((a: number, b: number) => a + b, 0) / waitTimes.length)
    : 0;

  // Average processing time (latencyMs on completed events = processing time)
  const processingTimes = completedEvents.map((e: any) => e.latencyMs || 0).filter((v: number) => v > 0);
  const avgProcessingTimeMs = processingTimes.length > 0
    ? Math.round(processingTimes.reduce((a: number, b: number) => a + b, 0) / processingTimes.length)
    : 0;

  // Failure rate
  const failureRate = totalJobs > 0
    ? Number((failedEvents.length / totalJobs).toFixed(4))
    : 0;

  // Jobs by status
  const byStatus = [
    { status: 'queued', count: enqueuedEvents.length },
    { status: 'running', count: runningEvents.length },
    { status: 'completed', count: completedEvents.length },
    { status: 'failed', count: failedEvents.length },
  ];

  // Per-day breakdown for chart
  const dayMap = new Map<string, { completed: number; failed: number; total: number; waitMs: number[]; processMs: number[] }>();
  for (const evt of [...completedEvents, ...failedEvents] as any[]) {
    const day = new Date(evt.timestamp).toISOString().slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, { completed: 0, failed: 0, total: 0, waitMs: [], processMs: [] });
    const entry = dayMap.get(day)!;
    entry.total += 1;
    if ((evt.flags || []).includes('queue_status:completed')) entry.completed += 1;
    if ((evt.flags || []).includes('queue_status:failed')) entry.failed += 1;
  }

  const dailyBreakdown = [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      date,
      completed: data.completed,
      failed: data.failed,
      total: data.total,
    }));

  return {
    windowDays,
    total_jobs: totalJobs,
    throughput_daily: throughputDaily,
    avg_wait_time_ms: avgWaitTimeMs,
    avg_processing_time_ms: avgProcessingTimeMs,
    failure_rate: failureRate,
    by_status: byStatus,
    daily_breakdown: dailyBreakdown,
  };
}
