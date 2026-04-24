import { CanonicalAnswer, DocumentModel, QAEntry } from '../../db/mongo/models';

type ContradictionSeverity = 'low' | 'medium' | 'high';

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function detectPolarity(value: string): 'positive' | 'negative' | 'neutral' {
  const text = normalize(value);
  const positiveSignals = ['yes', 'supported', 'enabled', 'we do', 'provided', 'compliant'];
  const negativeSignals = ['no', 'not', 'unsupported', 'do not', 'cannot', 'non compliant'];

  const positive = positiveSignals.some((signal) => text.includes(signal));
  const negative = negativeSignals.some((signal) => text.includes(signal));
  if (positive && !negative) return 'positive';
  if (negative && !positive) return 'negative';
  return 'neutral';
}

function textOverlapScore(a: string, b: string): number {
  const tokensA = new Set(normalize(a).split(' ').filter((token) => token.length > 2));
  const tokensB = new Set(normalize(b).split(' ').filter((token) => token.length > 2));
  const intersection = [...tokensA].filter((token) => tokensB.has(token)).length;
  const denominator = Math.max(1, Math.min(tokensA.size, tokensB.size));
  return Number((intersection / denominator).toFixed(2));
}

export async function detectContradictions(input: { question: string; domain?: string }) {
  const domain = input.domain || 'general';
  const canonicals = await CanonicalAnswer.find({ status: 'approved', domain }).lean();
  const qaEntries = await QAEntry.find({ department: { $exists: true } }).limit(200).lean();
  const docs = await DocumentModel.find().sort({ updatedAt: -1 }).limit(200).lean();

  const findings: Array<{
    severity: ContradictionSeverity;
    type: string;
    left: string;
    right: string;
    reason: string;
    score: number;
  }> = [];

  for (const canonical of canonicals as any[]) {
    const canonicalQuestion = String(canonical.question || '');
    const canonicalAnswer = String(canonical.currentAnswer || '');
    const canonicalPolarity = detectPolarity(canonicalAnswer);

    for (const qa of qaEntries as any[]) {
      const qaQuestion = String(qa.question || '');
      const qaAnswer = String(qa.answer || '');
      const overlap = textOverlapScore(canonicalQuestion, qaQuestion);
      if (overlap < 0.55) continue;

      const qaPolarity = detectPolarity(qaAnswer);
      if (canonicalPolarity !== 'neutral' && qaPolarity !== 'neutral' && canonicalPolarity !== qaPolarity) {
        findings.push({
          severity: 'high',
          type: 'canonical_vs_qa',
          left: canonicalQuestion,
          right: qaQuestion,
          reason: `Polarity mismatch: canonical=${canonicalPolarity}, qa=${qaPolarity}`,
          score: overlap,
        });
      } else if (overlap > 0.8 && canonicalAnswer.slice(0, 120) !== qaAnswer.slice(0, 120)) {
        findings.push({
          severity: 'medium',
          type: 'canonical_vs_qa',
          left: canonicalQuestion,
          right: qaQuestion,
          reason: 'High semantic overlap with different answer wording.',
          score: overlap,
        });
      }
    }
  }

  for (const doc of docs as any[]) {
    const reviewDate = doc.metadata?.reviewDate ? new Date(doc.metadata.reviewDate) : null;
    const updatedAt = doc.updatedAt ? new Date(doc.updatedAt) : null;
    const ageBase = reviewDate || updatedAt;
    if (!ageBase) continue;
    const ageDays = Math.floor((Date.now() - ageBase.getTime()) / (24 * 60 * 60 * 1000));
    if (ageDays > 365) {
      findings.push({
        severity: 'low',
        type: 'stale_evidence',
        left: doc.originalName,
        right: input.question,
        reason: `Document is stale (${ageDays} days old) and may conflict with current posture.`,
        score: 0.4,
      });
    }
  }

  const sorted = findings.sort((a, b) => {
    const severityRank = { high: 3, medium: 2, low: 1 };
    return severityRank[b.severity] - severityRank[a.severity] || b.score - a.score;
  });

  const contradictionScore = sorted.length === 0
    ? 0
    : Number(
        Math.min(
          1,
          sorted.slice(0, 10).reduce((sum, item) => sum + (item.severity === 'high' ? 0.25 : item.severity === 'medium' ? 0.15 : 0.08), 0),
        ).toFixed(2),
      );

  return {
    question: input.question,
    domain,
    contradiction_score: contradictionScore,
    findings: sorted.slice(0, 25),
  };
}

