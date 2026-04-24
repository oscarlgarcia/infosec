import { AnswerBuilderJob } from '../../db/mongo/models';
import { newId } from '../../utils/ids';
import { runChatQuery } from '../rag/orchestrator';
import { appJobQueue } from '../jobs/queue';

async function processAnswerBuilderJob(jobId: string, input: {
  clientId: string;
  userId?: string;
  questions: string[];
  domain?: string;
  subdomain?: string;
}) {
  const job = await AnswerBuilderJob.findOne({ jobId });
  if (!job) return;

  try {
    job.status = 'running';
    await job.save();

    const rows: any[] = [];
    for (const question of input.questions) {
      const result = await runChatQuery({
        requestId: newId('req'),
        userId: input.userId,
        clientId: input.clientId,
        question,
        domain: input.domain || 'general',
        subdomain: input.subdomain,
        taskProfile: 'Security questionnaire answer builder.',
        expectedFormat: 'Provide concise answer and evidence summary.',
      });

      rows.push({
        question,
        answer: result.answer_text,
        domain: input.domain || 'general',
        subdomain: input.subdomain || 'general',
        confidence: result.confidence,
        requiresLegalReview: result.flags.includes('legal_review'),
        contradictionFlag: result.flags.includes('contradiction'),
        evidenceCount: result.used_sources.length + result.citations.length,
        notes: result.coverage_status,
      });
    }

    job.status = 'completed';
    job.outputRows = rows;
    await job.save();
  } catch (error) {
    job.status = 'failed';
    job.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await job.save();
  }
}

export async function createAnswerBuilderJob(input: {
  clientId: string;
  userId?: string;
  questions: string[];
  domain?: string;
  subdomain?: string;
}): Promise<any> {
  const jobId = newId('abj');
  const job = await AnswerBuilderJob.create({
    jobId,
    clientId: input.clientId,
    status: 'queued',
    inputQuestions: input.questions,
    outputRows: [],
  });

  appJobQueue.enqueue({
    id: `answer-builder:${jobId}`,
    run: async () => {
      await processAnswerBuilderJob(jobId, input);
    },
  });

  return AnswerBuilderJob.findOne({ jobId }).lean();
}

export async function getAnswerBuilderJob(jobId: string) {
  return AnswerBuilderJob.findOne({ jobId }).lean();
}

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export async function exportAnswerBuilderJobCsv(jobId: string): Promise<string | null> {
  const job = await AnswerBuilderJob.findOne({ jobId }).lean();
  if (!job || !job.outputRows?.length) return null;

  const header = [
    'question',
    'answer',
    'domain',
    'subdomain',
    'confidence',
    'requiresLegalReview',
    'contradictionFlag',
    'evidenceCount',
    'notes',
  ];

  const lines = [header.join(',')];
  for (const row of job.outputRows as any[]) {
    lines.push([
      escapeCsv(row.question),
      escapeCsv(row.answer),
      escapeCsv(row.domain),
      escapeCsv(row.subdomain),
      escapeCsv(row.confidence),
      escapeCsv(row.requiresLegalReview),
      escapeCsv(row.contradictionFlag),
      escapeCsv(row.evidenceCount),
      escapeCsv(row.notes),
    ].join(','));
  }

  return lines.join('\n');
}

export function getAnswerBuilderQueueState() {
  return appJobQueue.getState();
}
