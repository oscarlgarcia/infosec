import { AnswerRule, CanonicalAnswer, KbCandidate, QAEntry } from '../../db/mongo/models';
import { createOllamaEmbedding } from '../llm/openai';
import { getChromaClient } from '../chroma/indexer';

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

  const questionNumber = await getNextQuestionNumber(candidate.domain || 'general');
  
  const qaEntry = await QAEntry.create({
    questionNumber,
    question: candidate.question,
    answer: candidate.suggestedAnswer,
    infoSecDomain: candidate.domain || 'general',
    source: 'kb_candidate',
    embeddingStatus: 'pending',
  });

  try {
    const text = `${candidate.question} ${candidate.suggestedAnswer}`.trim();
    const embedding = await createOllamaEmbedding(text);
    if (embedding.length > 0) {
      await QAEntry.findByIdAndUpdate(qaEntry._id, {
        embedding,
        embeddingStatus: 'generated',
      });
      
      const client = await getChromaClient();
      const collection = await client.getOrCreateCollection({ name: 'qanda' });
      await collection.add({
        ids: [qaEntry._id.toString()],
        embeddings: [embedding],
        documents: [text],
        metadatas: [{
          question: candidate.question,
          answer: candidate.suggestedAnswer,
          department: '',
          category: candidate.domain || 'general',
          source: 'qa'
        }]
      });
    }
  } catch (error) {
    console.error('Failed to generate embedding for approved candidate:', error);
  }

  candidate.status = 'approved';
  candidate.reviewedBy = reviewer;
  candidate.reviewNote = note || 'Approved and saved to Q&A';
  await candidate.save();

  return { candidate: candidate.toObject(), qaEntry: qaEntry.toObject() };
}

export async function rejectKbCandidate(id: string, reviewer: string, note?: string) {
  return KbCandidate.findByIdAndUpdate(
    id,
    { status: 'rejected', reviewedBy: reviewer, reviewNote: note || 'Rejected' },
    { new: true },
  ).lean();
}

export async function updateKbCandidate(id: string, updates: {
  question?: string;
  suggestedAnswer?: string;
  domain?: string;
}) {
  return KbCandidate.findByIdAndUpdate(
    id,
    { ...updates },
    { new: true },
  ).lean();
}

async function getNextQuestionNumber(domain: string): Promise<string> {
  const domainSections: Record<string, number> = {
    'InfoSec Policy & Procedures': 1,
    'Security Human Resource': 2,
    'Asset management': 3,
    'Access control': 4,
    'Encryption': 5,
    'Physical and Logical security': 6,
    'ESG': 7,
    'SDLC': 8,
    'Relation with suppliers/third-party': 9,
    'Incident Management': 10,
    'Business Continuity': 11,
    'Operational management': 12,
    'Compliance': 13,
    'Audit': 14,
    'Information Security': 15,
    'IT General Security': 16,
    'IT Network Security': 17,
    'IT Systems Security': 18,
    'Risk Management': 19,
    'Segregation of Duties': 20,
    'Intellectual Property & Proprietary Rights': 21,
  };
  const section = domainSections[domain] || 0;
  
  const lastEntry = await QAEntry.findOne(
    { questionNumber: new RegExp(`^${section}\\.`) },
    { questionNumber: 1 },
  ).sort({ questionNumber: -1 }).lean();
  
  let nextSub = 1;
  if (lastEntry && lastEntry.questionNumber) {
    const parts = lastEntry.questionNumber.split('.');
    if (parts.length === 2) {
      nextSub = parseInt(parts[1]) + 1;
    }
  }
  
  return `${section}.${nextSub}`;
}

export async function createKbCandidate(input: {
  question: string;
  suggestedAnswer: string;
  sessionId?: string;
  clientId?: string;
  domain?: string;
  sourceRefs?: string[];
}) {
  return KbCandidate.create({
    ...input,
    status: 'draft',
  });
}

