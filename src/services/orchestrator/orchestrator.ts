import mongoose from 'mongoose';
import { OrchestratorJob, QueueItem } from '../../db/mongo/models';
import { enqueueJob, cancelQueuedJob } from './queue';
import { createClientRequest } from '../chat/chat';
import type { OrchestratorJob as OrchestratorJobType, CreateJobInput, JobStatus } from '../../types/orchestrator';

function mapJob(job: any): OrchestratorJobType {
  return {
    id: job._id.toString(),
    name: job.name,
    pipeline: job.pipeline,
    status: job.status,
    clientId: job.clientId?.toString(),
    requestId: job.requestId?.toString(),
    conversationId: job.conversationId?.toString(),
    agent: job.agent,
    inputFile: job.inputFile,
    inputQuestions: job.inputQuestions || [],
    outputRows: (job.outputRows || []).map((r: any) => ({
      question: r.question,
      answer: r.answer,
      domain: r.domain,
      subdomain: r.subdomain,
      confidence: r.confidence,
      requiresLegalReview: r.requiresLegalReview,
      contradictionFlag: r.contradictionFlag,
      evidenceCount: r.evidenceCount,
      notes: r.notes,
      timingMs: r.timingMs,
    })),
    totalQuestions: job.totalQuestions,
    completedQuestions: job.completedQuestions,
    progress: job.progress,
    steps: (job.steps || []).map((s: any) => ({
      stage: s.stage,
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      error: s.error,
      progress: s.progress,
    })),
    errorMessage: job.errorMessage,
    outputFile: job.outputFile,
    avgTimingMs: job.avgTimingMs,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

export async function createJob(input: CreateJobInput): Promise<OrchestratorJobType> {
  const questions = input.inputQuestions;
  const totalQuestions = questions.length;

  const jobDoc = await OrchestratorJob.create({
    name: input.name || `Answer Builder - ${new Date().toLocaleDateString()}`,
    pipeline: 'answer-builder',
    status: 'pending',
    clientId: new mongoose.Types.ObjectId(input.clientId),
    requestId: input.requestId ? new mongoose.Types.ObjectId(input.requestId) : undefined,
    agent: input.agent || 'InfoSec',
    inputFile: input.inputFile,
    inputQuestions: questions,
    totalQuestions,
    completedQuestions: 0,
    progress: 0,
    steps: [
      { stage: 'reader', status: 'pending' },
      { stage: 'processor', status: 'pending' },
      { stage: 'writer', status: 'pending' },
    ],
  });

  await enqueueJob(jobDoc._id.toString(), 'answer-builder');

  return mapJob(jobDoc);
}

export async function getJob(jobId: string): Promise<OrchestratorJobType | null> {
  const job = await OrchestratorJob.findById(jobId).lean();
  if (!job) return null;
  return mapJob(job);
}

export async function listJobs(options?: {
  clientId?: string;
  status?: JobStatus;
  limit?: number;
  offset?: number;
}): Promise<{ jobs: OrchestratorJobType[]; total: number }> {
  const filter: any = {};
  if (options?.clientId) filter.clientId = new mongoose.Types.ObjectId(options.clientId);
  if (options?.status) filter.status = options.status;

  const [jobs, total] = await Promise.all([
    OrchestratorJob.find(filter)
      .sort({ createdAt: -1 })
      .skip(options?.offset || 0)
      .limit(options?.limit || 50)
      .lean(),
    OrchestratorJob.countDocuments(filter),
  ]);

  return { jobs: jobs.map(mapJob), total };
}

export async function pauseJob(jobId: string): Promise<OrchestratorJobType | null> {
  const job = await OrchestratorJob.findByIdAndUpdate(
    jobId,
    { status: 'paused' },
    { new: true }
  );
  if (!job) return null;

  // Also update QueueItem status so it doesn't get picked up again
  await QueueItem.findOneAndUpdate(
    { jobId: new mongoose.Types.ObjectId(jobId) },
    { status: 'paused' }
  );

  return mapJob(job);
}

export async function resumeJob(jobId: string): Promise<OrchestratorJobType | null> {
  const job = await OrchestratorJob.findByIdAndUpdate(
    jobId,
    { status: 'queued' },
    { new: true }
  );
  if (!job) return null;

  // Reset queue item to queued (use upsert-style update)
  await QueueItem.findOneAndUpdate(
    { jobId: new mongoose.Types.ObjectId(jobId) },
    {
      $set: {
        status: 'queued',
        enqueuedAt: new Date(),
        pipeline: 'answer-builder',
      },
      $unset: { startedAt: '' },
    },
    { upsert: true }
  );

  return mapJob(job);
}

export async function cancelJob(jobId: string): Promise<OrchestratorJobType | null> {
  const job = await OrchestratorJob.findByIdAndUpdate(
    jobId,
    { status: 'cancelled', completedAt: new Date() },
    { new: true }
  );
  if (!job) return null;
  await cancelQueuedJob(jobId);
  return mapJob(job);
}

export async function deleteJob(jobId: string): Promise<void> {
  await OrchestratorJob.findByIdAndDelete(jobId);
}

export async function createRequestForJob(data: {
  clientId: string;
  requestType: string;
  sectionToReview?: string;
  deadline?: string;
  owner?: string;
  comments?: string;
}): Promise<any> {
  return createClientRequest({
    clientId: data.clientId,
    requestType: data.requestType,
    sectionToReview: data.sectionToReview,
    deadline: data.deadline,
    owner: data.owner,
    comments: data.comments,
  });
}
