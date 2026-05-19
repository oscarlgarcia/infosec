import { TermReportSnapshot } from '../../db/mongo/models';

export async function listSnapshots(filters: { scheduleId?: string; term?: string; limit?: number }) {
  const query: any = {};
  if (filters.scheduleId) query.scheduleId = filters.scheduleId;
  if (filters.term) query.term = filters.term;
  const items = await TermReportSnapshot.find(query)
    .sort({ generatedAt: -1 })
    .limit(filters.limit || 10)
    .lean();
  return items;
}

export async function getSnapshot(id: string) {
  return TermReportSnapshot.findById(id).lean();
}

export async function diffSnapshots(id: string, otherId: string) {
  const [snapshotA, snapshotB] = await Promise.all([
    TermReportSnapshot.findById(id).lean(),
    TermReportSnapshot.findById(otherId).lean(),
  ]);
  if (!snapshotA || !snapshotB) return null;
  const metricsA = snapshotA.metrics || {};
  const metricsB = snapshotB.metrics || {};
  const changes: Array<{ field: string; from: number; to: number; direction: 'up' | 'down' | 'same' }> = [];
  const fields = ['totalSources', 'gapCount', 'contradictionCount', 'canonicalCount', 'avgConfidence'] as const;
  for (const field of fields) {
    const a = (metricsA as any)[field] || 0;
    const b = (metricsB as any)[field] || 0;
    if (a !== b) {
      changes.push({ field, from: a, to: b, direction: a < b ? 'up' : 'down' });
    }
  }
  return {
    snapshotA: { id: snapshotA._id, generatedAt: snapshotA.generatedAt, metrics: metricsA },
    snapshotB: { id: snapshotB._id, generatedAt: snapshotB.generatedAt, metrics: metricsB },
    changes,
  };
}
