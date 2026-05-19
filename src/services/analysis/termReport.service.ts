import { TermReport } from '../../db/mongo/models';
import { retrieveRelevantPassages } from '../rag/retriever';
import { analyzeGap } from '../gapFinder';
import { searchCanonicalByTerm } from '../qa/canonical.service';

export interface TermReportInput {
  term: string;
  generatedBy?: string;
}

export async function generateTermReport(input: TermReportInput) {
  const { term } = input;

  const retrievedPassages = await retrieveRelevantPassages({ query: term, limit: 20 });
  const gapAnalysis = await analyzeGap(term, 500);
  const canonicalMatches = await searchCanonicalByTerm(term);

  const directQA = retrievedPassages
    .filter(p => p.sourceType === 'qa' || p.sourceType === 'faq')
    .map(p => ({
      question: p.title,
      answer: p.content,
      sourceType: p.sourceType,
      itemId: p.itemId,
      score: Math.round(p.score * 100),
      isDirect: p.score > 0.7,
    }));

  const relatedTopics = retrievedPassages
    .filter(p => p.sourceType === 'cms' || p.sourceType === 'document')
    .map(p => ({
      question: p.title,
      answer: p.content,
      sourceType: p.sourceType,
      itemId: p.itemId,
      score: Math.round(p.score * 100),
    }));

  const sourcesUsed = retrievedPassages.map(p => ({
    sourceType: p.sourceType,
    itemId: p.itemId,
    title: p.title,
    score: Math.round(p.score * 100),
  }));

  const canonicalAnswers = canonicalMatches.map((c: any) => ({
    canonicalId: c._id,
    question: c.question,
    currentAnswer: c.currentAnswer,
    status: c.status,
    owner: c.owner,
    lastReviewedAt: c.lastReviewedAt,
    verified: retrievedPassages.some(p =>
      p.content.toLowerCase().includes((c.currentAnswer || '').toLowerCase().slice(0, 50))
    ),
  }));

  const coverageGaps = (gapAnalysis.gapsFound || []).slice(0, 10).map((g: any) => ({
    topic: g.question || g.content || g.title || 'Unknown',
    recommendation: g.recommendation || 'Review and create content for this topic',
    impactScore: Math.round((1 - (g.similarity || 0)) * 10),
  }));

  const definition = retrievedPassages.length > 0
    ? `Found ${retrievedPassages.length} relevant sources about "${term}". The term appears across ${new Set(retrievedPassages.map(p => p.sourceType)).size} different knowledge source types.`
    : `No direct sources found for "${term}".`;

  const summary = `Analysis of "${term}" across ${sourcesUsed.length} sources. ` +
    `Found ${directQA.length} direct Q&A matches, ${canonicalAnswers.length} canonical answers, ` +
    `${coverageGaps.length} coverage gaps.`;

  const avgConfidence = sourcesUsed.length > 0
    ? Math.round(sourcesUsed.reduce((sum, s) => sum + s.score, 0) / sourcesUsed.length)
    : 0;

  const report = {
    term,
    definition,
    directQA,
    relatedTopics,
    canonicalAnswers,
    sourcesUsed,
    coverageGaps,
    contradictions: [],
    summary,
    metrics: {
      totalSources: sourcesUsed.length,
      gapCount: coverageGaps.length,
      contradictionCount: 0,
      canonicalCount: canonicalAnswers.length,
      avgConfidence,
    },
    generatedBy: input.generatedBy || 'system',
  };

  return report;
}

export async function listReports(filters: { search?: string; page?: number; pageSize?: number }) {
  const query: any = {};
  if (filters.search) {
    query.term = { $regex: filters.search, $options: 'i' };
  }
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const total = await TermReport.countDocuments(query);
  const items = await TermReport.find(query)
    .select('term metrics createdAt')
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();
  return { items, total, page, pageSize };
}

export async function getReport(id: string) {
  return TermReport.findById(id).lean();
}

export async function deleteReport(id: string) {
  return TermReport.findByIdAndDelete(id);
}

export async function saveReport(report: any) {
  return TermReport.create(report);
}
