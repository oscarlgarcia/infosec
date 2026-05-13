import mongoose from 'mongoose';
import { Conversation, OrchestratorJob } from '../../../db/mongo/models';
import { sendMessage } from '../../chat/chat';

export interface ProcessorOutput {
  answers: Array<{
    question: string;
    answer: string;
    domain?: string;
    confidence?: number;
    requiresLegalReview?: boolean;
    contradictionFlag?: boolean;
    evidenceCount?: number;
    notes?: string;
    timingMs?: number;
  }>;
}

export async function processQuestions(job: any): Promise<ProcessorOutput> {
  const jobId = job._id.toString();
  const questions: string[] = job.inputQuestions || [];
  const clientId: string = job.clientId?.toString();
  const agentName: string = job.agent || 'InfoSec';

  // ** CHECKPOINT **: Read current progress from DB to resume where we left off
  const jobDoc = await OrchestratorJob.findById(jobId);
  if (!jobDoc) throw new Error('Job not found');

  const startFrom = jobDoc.completedQuestions || 0;
  const existingRows: ProcessorOutput['answers'] = (jobDoc.outputRows || []).slice(0, startFrom);

  // ** REUSE existing conversation if available ** (Option A: one conversation per job)
  let conversationId = jobDoc.conversationId;
  if (!conversationId) {
    const conversation = await Conversation.create({
      clientId: new mongoose.Types.ObjectId(clientId),
      title: `Answer Builder - Job ${jobId}`,
      agent: agentName,
      favorite: false,
      messages: [],
    });
    conversationId = conversation._id;
    await OrchestratorJob.findByIdAndUpdate(jobId, { conversationId });
  }

  if (startFrom >= questions.length) {
    // Already fully processed
    return { answers: existingRows };
  }

  const newAnswers: ProcessorOutput['answers'] = [];
  let totalTiming = 0;
  let countWithTiming = 0;

  for (let i = startFrom; i < questions.length; i++) {
    const qStart = Date.now();
    const question = questions[i];

    const conv = await Conversation.findById(conversationId).lean();
    const contextMessages = conv?.messages || [];
    const context = contextMessages.length > 0
      ? `Previous context (${contextMessages.length} messages):\n${contextMessages.slice(-4).map((m: any) => `${m.role}: ${m.content?.substring(0, 200)}`).join('\n')}`
      : '';

    const fullQuestion = context
      ? `[Question ${i + 1} of ${questions.length}]\n${question}\n\n${context}`
      : `[Question ${i + 1} of ${questions.length}]\n${question}`;

    let answer: string;
    let domain: string | undefined;
    let confidence: number | undefined;
    let requiresLegalReview = false;
    let contradictionFlag = false;
    let evidenceCount = 0;
    let notes: string | undefined;

    try {
      const result = await sendMessage(
        conversationId.toString(),
        fullQuestion,
        agentName,
        { requestId: `ans-bld-${jobId}-q${i}` }
      );

      answer = result.response;

      // ** METADATA ENRICHMENT ** from chat API response metadata
      const lastMsg = result.conversation?.messages?.[result.conversation.messages.length - 1];
      const meta = (lastMsg as any)?.metadata;

      if (meta) {
        domain = meta.domain || 'general';
        confidence = meta.confidence;
        requiresLegalReview = (meta.flags || []).includes('legal_review');
        contradictionFlag = (meta.flags || []).includes('contradiction');
        evidenceCount = (meta.used_sources?.length || 0) + (meta.citations?.length || 0);
        notes = meta.coverage_status || '';
      }
    } catch (err: any) {
      console.error(`[Processor] Failed question ${i + 1}/${questions.length}: ${err.message}`);
      answer = `Error: ${err.message}`;
      notes = 'Failed to process';
    }

    // ** PER-QUESTION TIMER **
    const qTiming = Date.now() - qStart;
    totalTiming += qTiming;
    countWithTiming++;

    const answerRow = {
      question,
      answer,
      domain,
      confidence,
      requiresLegalReview,
      contradictionFlag,
      evidenceCount,
      notes,
      timingMs: qTiming,
    };
    newAnswers.push(answerRow);

    // Merge existing + new answers
    const allRows = [...existingRows, ...newAnswers];
    const avgTimingMs = countWithTiming > 0 ? Math.round(totalTiming / countWithTiming) : 0;

    // ** CHECKPOINT **: Save progress on every question
    await OrchestratorJob.findByIdAndUpdate(jobId, {
      completedQuestions: i + 1,
      progress: Math.round(((i + 1) / questions.length) * 100),
      outputRows: allRows,
      avgTimingMs,
    });
  }

  return { answers: [...existingRows, ...newAnswers] };
}
