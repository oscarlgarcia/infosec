import { AnswerRule, CanonicalAnswer, KbCandidate } from '../../db/mongo/models';

export async function createRule(input: { name: string; content: string; domain?: string; enabled?: boolean }) {
  return AnswerRule.create({
    name: input.name,
    content: input.content,
    domain: input.domain,
    enabled: input.enabled ?? true,
    version: 1,
  });
}

export async function listRules() {
  return AnswerRule.find().sort({ updatedAt: -1 }).lean();
}

export async function updateRule(id: string, input: Partial<{ name: string; content: string; domain: string; enabled: boolean }>) {
  const current = await AnswerRule.findById(id);
  if (!current) return null;

  const nextVersion = input.content && input.content !== current.content ? current.version + 1 : current.version;
  return AnswerRule.findByIdAndUpdate(id, { ...input, version: nextVersion }, { new: true }).lean();
}

export async function deleteRule(id: string) {
  return AnswerRule.findByIdAndDelete(id);
}

export async function listKbCandidates(status?: string) {
  const query = status ? { status } : {};
  return KbCandidate.find(query).sort({ createdAt: -1 }).lean();
}

export async function approveKbCandidate(id: string, reviewer: string, note?: string) {
  const candidate = await KbCandidate.findById(id);
  if (!candidate) return null;

  candidate.status = 'approved';
  candidate.reviewedBy = reviewer;
  candidate.reviewNote = note;
  await candidate.save();

  const canonical = await CanonicalAnswer.create({
    question: candidate.question,
    domain: candidate.domain || 'general',
    owner: reviewer,
    status: 'approved',
    currentAnswer: candidate.suggestedAnswer,
    sourceRefs: candidate.sourceRefs || [],
    versions: [{
      version: 1,
      answerText: candidate.suggestedAnswer,
      reason: note || 'Approved from candidate',
      changedBy: reviewer,
      createdAt: new Date(),
    }],
    lastReviewedAt: new Date(),
  });

  return { candidate: candidate.toObject(), canonical };
}

export async function rejectKbCandidate(id: string, reviewer: string, note?: string) {
  return KbCandidate.findByIdAndUpdate(
    id,
    { status: 'rejected', reviewedBy: reviewer, reviewNote: note || 'Rejected' },
    { new: true },
  ).lean();
}

