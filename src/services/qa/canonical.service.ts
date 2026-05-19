import { CanonicalAnswer } from '../../db/mongo/models';

export async function listCanonicalAnswers(filters: { status?: string; domain?: string; search?: string; page?: number; pageSize?: number }) {
  const query: any = {};
  if (filters.status) query.status = filters.status;
  if (filters.domain) query.domain = filters.domain;
  if (filters.search) {
    query.question = { $regex: filters.search, $options: 'i' };
  }
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const total = await CanonicalAnswer.countDocuments(query);
  const items = await CanonicalAnswer.find(query)
    .sort({ updatedAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();
  return { items, total, page, pageSize };
}

export async function getCanonicalAnswer(id: string) {
  return CanonicalAnswer.findById(id).lean();
}

export async function createCanonicalAnswer(data: { question: string; answer: string; domain: string; owner: string; sourceRefs?: string[]; status?: string }) {
  return CanonicalAnswer.create({
    question: data.question,
    currentAnswer: data.answer,
    domain: data.domain,
    owner: data.owner,
    sourceRefs: data.sourceRefs || [],
    status: data.status || 'draft',
    versions: [{ version: 1, answerText: data.answer, reason: 'Initial version', changedBy: data.owner }],
    lastReviewedAt: new Date(),
  });
}

export async function updateCanonicalAnswer(id: string, data: { question?: string; answer?: string; domain?: string; owner?: string; sourceRefs?: string[]; status?: string }) {
  const existing = await CanonicalAnswer.findById(id);
  if (!existing) return null;
  if (data.question !== undefined) existing.question = data.question;
  if (data.domain !== undefined) existing.domain = data.domain;
  if (data.owner !== undefined) existing.owner = data.owner;
  if (data.sourceRefs !== undefined) existing.sourceRefs = data.sourceRefs;
  if (data.status !== undefined) existing.status = data.status;
  if (data.answer !== undefined && data.answer !== existing.currentAnswer) {
    existing.versions.push({
      version: existing.versions.length + 1,
      answerText: data.answer,
      reason: 'Updated',
      changedBy: data.owner || existing.owner,
      createdAt: new Date(),
    } as any);
    existing.currentAnswer = data.answer;
    existing.lastReviewedAt = new Date();
  }
  return existing.save();
}

export async function deleteCanonicalAnswer(id: string) {
  return CanonicalAnswer.findByIdAndDelete(id);
}

export async function searchCanonicalByTerm(term: string) {
  return CanonicalAnswer.find({
    status: 'approved',
    question: { $regex: term, $options: 'i' },
  }).limit(20).lean();
}

export async function verifyCanonicalAnswer(id: string, passages: Array<{ content: string; sourceType: string; score: number }>) {
  const canonical = await CanonicalAnswer.findById(id).lean();
  if (!canonical) return null;
  const canonicalText = (canonical.currentAnswer || '').toLowerCase();
  const matchingPassages = passages.filter(p => {
    const content = p.content.toLowerCase();
    const words = canonicalText.split(/\s+/).filter(w => w.length > 4);
    const matchCount = words.filter(w => content.includes(w)).length;
    return words.length > 0 && matchCount / words.length > 0.3;
  });
  return {
    canonical,
    verified: matchingPassages.length > 0,
    confidence: matchingPassages.length > 0 ? Math.max(...matchingPassages.map(p => p.score)) : 0,
    matchingPassages,
  };
}
