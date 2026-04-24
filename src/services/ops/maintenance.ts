import { AnalyticsEvent, DocumentModel, DocumentUsage, ResponseTrace } from '../../db/mongo/models';

function toMsDay(days: number) {
  return days * 24 * 60 * 60 * 1000;
}

export async function refreshDocumentFreshnessScores(staleDays: number = 365) {
  const documents = await DocumentModel.find().lean();
  const now = Date.now();
  let updated = 0;

  for (const document of documents as any[]) {
    const baseDate = document.metadata?.reviewDate || document.updatedAt || document.createdAt;
    if (!baseDate) continue;
    const ageDays = Math.floor((now - new Date(baseDate).getTime()) / toMsDay(1));
    const freshnessScore = Number(Math.max(0, 1 - (ageDays / staleDays)).toFixed(3));
    await DocumentUsage.findOneAndUpdate(
      { documentId: document._id.toString() },
      {
        documentId: document._id.toString(),
        domain: document.metadata?.domain || document.department || 'general',
        freshnessScore,
      },
      { upsert: true },
    );
    updated += 1;
  }

  return {
    staleDays,
    updated,
  };
}

export async function applyRetentionPolicy(days: number = 180) {
  const cutoff = new Date(Date.now() - toMsDay(days));
  const traceResult = await ResponseTrace.deleteMany({ createdAt: { $lt: cutoff } });
  const eventResult = await AnalyticsEvent.deleteMany({ timestamp: { $lt: cutoff } });

  return {
    retention_days: days,
    removed_response_traces: traceResult.deletedCount || 0,
    removed_analytics_events: eventResult.deletedCount || 0,
  };
}
