import { Client, QAEntry, CanonicalAnswer, SessionSummary, ResponseTrace, AnalyticsEvent, QuestionCoverage, DocumentUsage, GapBacklog, KbCandidate, AnswerRule } from '../../db/mongo/models';
import { env } from '../../config';
import { generateWithResponses, chat } from '../llm/openai';
import { retrieveRelevantPassages } from './retriever';
import { getAgentByName } from '../agents/agent.service';
import { newId, hashQuestion } from '../../utils/ids';
import { detectContradictions } from './contradictions';

export type QueryIntent = 'qa_direct' | 'contractual' | 'comparative' | 'gap_like' | 'general';
export type CoverageStatus = 'covered' | 'partial' | 'uncovered' | 'weak' | 'contradictory' | 'human_review';

export interface ChatQueryInput {
  requestId: string;
  userId?: string;
  clientId: string;
  sessionId?: string;
  question: string;
  taskProfile?: string;
  expectedFormat?: string;
  domain?: string;
  subdomain?: string;
}

export interface ChatQueryOutput {
  response_id: string;
  session_id: string;
  answer_text: string;
  citations: Array<{ fileId?: string; filename?: string; score?: number; snippet?: string }>;
  confidence: number;
  coverage_status: CoverageStatus;
  flags: string[];
  used_sources: Array<{ sourceType: string; itemId: string; title: string; score: number; version?: string; updatedAt?: Date }>;
  session_summary_delta: string;
  intent: QueryIntent;
}

function classifyIntent(question: string): QueryIntent {
  const q = question.toLowerCase();
  if (q.includes('compare') || q.includes('vs') || q.includes('contrad')) return 'comparative';
  if (q.includes('msa') || q.includes('contract') || q.includes('clause') || q.includes('commit')) return 'contractual';
  if (q.includes('gap') || q.includes('missing') || q.includes('evidence')) return 'gap_like';
  if (q.includes('what control') || q.includes('faq') || q.includes('standard answer')) return 'qa_direct';
  return 'general';
}

function estimateCoverage(evidenceCount: number, contradiction: boolean, confidence: number): CoverageStatus {
  if (contradiction) return 'contradictory';
  if (evidenceCount === 0) return 'uncovered';
  if (confidence >= 0.8 && evidenceCount >= 2) return 'covered';
  if (confidence >= 0.6) return 'partial';
  return 'weak';
}

function computeConfidence(topScore: number, evidenceCount: number, canonicalHit: boolean, contradictionPenalty: number, stalenessPenalty: number): number {
  const retrievalScore = Math.max(0, Math.min(1, topScore));
  const evidenceScore = Math.min(1, evidenceCount / 4);
  const canonicalBonus = canonicalHit ? 0.15 : 0;
  const raw = (retrievalScore * 0.55) + (evidenceScore * 0.35) + canonicalBonus - contradictionPenalty - stalenessPenalty;
  return Math.max(0, Math.min(1, Number(raw.toFixed(2))));
}

function calcCostEstimate(inputTokens: number, outputTokens: number): number {
  const inputCostPer1K = 0.005;
  const outputCostPer1K = 0.015;
  return Number((((inputTokens / 1000) * inputCostPer1K) + ((outputTokens / 1000) * outputCostPer1K)).toFixed(6));
}

function buildSummaryDelta(question: string, answerText: string): string {
  const q = question.trim().slice(0, 180);
  const a = answerText.trim().slice(0, 220);
  return `Q: ${q}\nA: ${a}`;
}

function computeStalenessPenalty(sources: Array<{ updatedAt?: Date }>): number {
  if (sources.length === 0) return 0;
  const now = Date.now();
  const staleSources = sources.filter((source) => {
    if (!source.updatedAt) return false;
    const ageDays = Math.floor((now - new Date(source.updatedAt).getTime()) / (24 * 60 * 60 * 1000));
    return ageDays > 365;
  });

  if (staleSources.length === 0) return 0;
  return Number(Math.min(0.25, staleSources.length / Math.max(1, sources.length) * 0.25).toFixed(2));
}

async function buildInstructions(params: {
  agentName?: string;  // NUEVO: nombre del agente
  query: string;
  sessionSummary: string;
  rules: string[];
  passages: string[];
}): Promise<string> {
  
  // Obtener instrucciones del agente desde la BD
  console.error('[LLM INPUT] buildInstructions: Looking for agent: ' + (params.agentName || 'InfoSec (default)'));
  let agent = await getAgentByName(params.agentName || 'InfoSec');
  
  // Si no existe, usar InfoSec por defecto
  if (!agent) {
    console.error('[LLM INPUT] buildInstructions: Agent not found, using InfoSec default');
    agent = await getAgentByName('InfoSec');
  }
  console.error('[LLM INPUT] buildInstructions: Using agent: ' + (agent?.name || 'UNKNOWN') + ', instructions length: ' + (agent?.instructions?.length || 0));
  
  // Reemplazar placeholders en el template del agente
  return agent!.instructions
    .replace(/\{\{query\}\}/g, params.query)
    .replace(/\{\{sessionSummary\}\}/g, params.sessionSummary || 'No previous summary.')
    .replace(/\{\{rules\}\}/g, params.rules.join('\n') || 'No rules.')
    .replace(/\{\{passages\}\}/g, params.passages.join('\n\n') || 'No passages recovered.')
    .replace(/\{\{metrics\}\}/g, 'Metrics not available yet.'); // Placeholder para futuro
}

export async function runChatQuery(input: ChatQueryInput): Promise<ChatQueryOutput> {
  // DEBUG: Log that function is called
  try {
    require('fs').writeFileSync('/app/function-called.log', 'CALLED: ' + new Date().toISOString() + ' Question: ' + input.question + '\n');
  } catch(e) {}
  
  const startedAt = Date.now();
  const client = await Client.findById(input.clientId).lean();
  if (!client) {
    throw new Error('Client not found');
  }

  const sessionId = input.sessionId || newId('sess');
  const responseId = newId('resp');
  const questionHash = hashQuestion(input.question);
  const intent = classifyIntent(input.question);

  const sessionSummary = await SessionSummary.findOne({ sessionId }).lean();
  const rules = await AnswerRule.find({
    enabled: true,
    $or: [
      { appliesTo: { $in: [input.agent] } },
      { appliesTo: { $exists: false } },
      { appliesTo: { $size: 0 } }
    ]
  }).sort({ updatedAt: -1 }).limit(12).lean();
  const canonicalCandidates = await CanonicalAnswer.find({
    status: 'approved',
    domain: input.domain || { $exists: true },
  }).limit(20).lean();

  // Retrieve relevant passages from all ChromaDB collections (documents, Q&A, CMS, FAQ)
  const retrievedPassages = await retrieveRelevantPassages({
    query: input.question,
    limit: 10,
  });
  
  const canonicalMatch = canonicalCandidates.find((item: any) =>
    input.question.toLowerCase().includes(String(item.question || '').toLowerCase().slice(0, 40))
  );
  
  const passages: string[] = retrievedPassages.map((p, i) => 
    `[${p.sourceType.toUpperCase()} ${i + 1}] ${p.title}: ${p.content}`
  );
  
  // Add canonical answer if found
  if (canonicalMatch) {
    passages.push(`[CANONICAL] ${(canonicalMatch as any).currentAnswer.slice(0, 300)}`);
  }

  let instructions;
  try {
    instructions = await buildInstructions({
      agentName: input.agent,
      query: input.question,
      sessionSummary: (sessionSummary as any)?.summaryText || '',
      rules: rules.map((rule: any) => rule.content),
      passages,
    });
    console.error('[DEBUG] buildInstructions completed successfully');
  } catch(e) {
    console.error('[DEBUG] buildInstructions FAILED: ' + e.message + ' ' + e.stack);
    instructions = 'ERROR: Failed to build instructions';
  }
  
  // DEBUG: Log agent and instructions being sent to LLM
  console.error('[LLM INPUT] Agent: ' + (input.agent || 'InfoSec (default)'));
  console.error('[LLM INPUT] Instructions length: ' + (instructions ? instructions.length : 'undefined'));
  console.error('[LLM INPUT] Instructions preview: ' + (instructions ? instructions.substring(0, 500) : 'N/A'));
  console.error('[LLM INPUT] Question: ' + input.question);

  const vectorStoreIds = env.OPENAI_VECTOR_STORE_IDS
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  let answerText = '';
  let citations: Array<{ fileId?: string; filename?: string; score?: number; snippet?: string }> = [];
  let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  const chatModel = !env.OPENAI_API_KEY.startsWith('sk-') || env.OPENAI_API_KEY.includes('placeholder') 
    ? 'qwen2.5:latest' 
    : env.OPENAI_MODEL;

  if (env.OPENAI_USE_RESPONSES) {
    try {
      const generated = await generateWithResponses({
        input: input.question,
        instructions,
        conversationId: sessionId,
        vectorStoreIds,
      });
      answerText = generated.outputText || '';
      citations = generated.citations;
      usage = {
        inputTokens: generated.usage?.inputTokens || 0,
        outputTokens: generated.usage?.outputTokens || 0,
        totalTokens: generated.usage?.totalTokens || 0,
      };
    } catch {
      answerText = await chat({
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: input.question },
        ],
        model: chatModel,
      });
    }
  } else {
    answerText = await chat({
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: input.question },
      ],
      model: chatModel,
    });
  }

  if (!answerText) {
    answerText = 'No answer could be generated with sufficient evidence.';
  }

  const usedSources = retrievedPassages.slice(0, 8).map((p) => ({
    sourceType: p.sourceType,
    itemId: p.itemId,
    title: p.title,
    score: p.score,
    version: undefined as string | undefined,
    updatedAt: undefined as Date | undefined,
  }));

  const topScore = retrievedPassages[0]?.score || 0;
  const evidenceCount = retrievedPassages.length + (canonicalMatch ? 1 : 0);
  const contradictionReport = await detectContradictions({
    question: input.question,
    domain: input.domain,
  });
  const contradictionPenalty = Number(Math.min(0.35, contradictionReport.contradiction_score * 0.35).toFixed(2));
  const stalenessPenalty = computeStalenessPenalty(usedSources);
  const contradiction = contradictionReport.contradiction_score >= 0.35;
  const confidence = computeConfidence(topScore, evidenceCount, !!canonicalMatch, contradictionPenalty, stalenessPenalty);
  const coverageStatus = estimateCoverage(evidenceCount, contradiction, confidence);

  const flags: string[] = [];
  if (coverageStatus === 'uncovered' || coverageStatus === 'weak') flags.push('low_evidence');
  if (coverageStatus === 'contradictory' || contradictionPenalty > 0) flags.push('contradiction');
  if (stalenessPenalty > 0) flags.push('stale_evidence');
  if (intent === 'contractual') flags.push('legal_review');

  const latencyMs = Date.now() - startedAt;
  const costEstimate = calcCostEstimate(usage.inputTokens, usage.outputTokens);
  const summaryDelta = buildSummaryDelta(input.question, answerText);

  await SessionSummary.findOneAndUpdate(
    { sessionId },
    {
      sessionId,
      clientId: client._id,
      summaryText: `${(sessionSummary as any)?.summaryText || ''}\n${summaryDelta}`.trim().slice(-6000),
      lastMessageAt: new Date(),
    },
    { upsert: true, new: true },
  );

  await ResponseTrace.create({
    responseId,
    sessionId,
    clientId: client._id,
    requestId: input.requestId,
    question: input.question,
    answerText,
    intent,
    domain: input.domain || 'general',
    coverageStatus,
    confidence,
    flags,
    usedSources,
    citations,
    latencyMs,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    costEstimate,
  });

  await AnalyticsEvent.create({
    eventId: newId('evt'),
    eventType: 'chat_query',
    timestamp: new Date(),
    userId: input.userId,
    sessionId,
    clientId: client._id,
    domain: input.domain || 'general',
    subdomain: input.subdomain,
    questionId: questionHash,
    responseId,
    model: chatModel,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    latencyMs,
    costEstimate,
    confidenceScore: confidence,
    coverageStatus,
    flags,
  });

  const coverageScore = Math.max(0, Number((topScore + Math.min(1, evidenceCount / 4) + (canonicalMatch ? 0.15 : 0) - contradictionPenalty - stalenessPenalty).toFixed(2)));
  await QuestionCoverage.findOneAndUpdate(
    { questionHash },
    {
      questionHash,
      questionText: input.question,
      domain: input.domain || 'general',
      subdomain: input.subdomain,
      coverageStatus,
      coverageScore,
      evidenceCount,
      canonicalAnswerExists: !!canonicalMatch,
      contradictionFlag: contradiction,
      stalenessPenalty,
      lastSeenAt: new Date(),
      requiresReview: flags.includes('legal_review') || coverageStatus !== 'covered',
      recommendedAction: coverageStatus === 'covered' ? 'none' : 'create_or_review_canonical_answer',
      $inc: { timesAsked: 1 },
    },
    { upsert: true },
  );

  for (const source of usedSources) {
    await DocumentUsage.findOneAndUpdate(
      { documentId: source.itemId },
      {
        documentId: source.itemId,
        domain: input.domain || 'general',
        lastUsedAt: new Date(),
        $inc: { timesRetrieved: 1, timesCited: citations.length > 0 ? 1 : 0 },
      },
      { upsert: true },
    );
  }

  if (coverageStatus !== 'covered') {
    await GapBacklog.findOneAndUpdate(
      { gapId: `${questionHash}:${input.domain || 'general'}` },
      {
        gapId: `${questionHash}:${input.domain || 'general'}`,
        domain: input.domain || 'general',
        subdomain: input.subdomain,
        questionExample: input.question,
        coverageScore,
        suggestedContentType: 'canonical-answer',
        owner: 'unassigned',
        status: 'open',
        $inc: { frequency: 1 },
      },
      { upsert: true },
    );

    await KbCandidate.create({
      sessionId,
      clientId: client._id,
      question: input.question,
      suggestedAnswer: answerText,
      domain: input.domain || 'general',
      sourceRefs: usedSources.map((source) => `${source.sourceType}:${source.itemId}`),
      status: 'draft',
    });
  }

  return {
    response_id: responseId,
    session_id: sessionId,
    answer_text: answerText,
    citations,
    confidence,
    coverage_status: coverageStatus,
    flags,
    used_sources: usedSources,
    session_summary_delta: summaryDelta,
    intent,
  };
}
