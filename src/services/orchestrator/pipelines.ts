import mongoose from 'mongoose';
import { OrchestratorJob } from '../../db/mongo/models';
import { processQuestions } from './agents/processor';
import { writeExcelOutput } from './agents/writer';
import type { PipelineName, PipelineStep } from '../../types/orchestrator';

export async function runPipeline(job: any): Promise<void> {
  const pipeline: PipelineName = job.pipeline;
  const jobId = job._id.toString();

  switch (pipeline) {
    case 'answer-builder':
      await runAnswerBuilder(jobId, job);
      break;
    default:
      throw new Error(`Unknown pipeline: ${pipeline}`);
  }
}

async function runAnswerBuilder(jobId: string, job: any): Promise<void> {
  const questions: string[] = job.inputQuestions || [];

  // Step 1: Reader (skip if questions already provided)
  await updateStep(jobId, 'reader', 'running');
  if (questions.length === 0) {
    throw new Error('No questions to process');
  }
  await updateStep(jobId, 'reader', 'completed');

  // Step 2: Processor - pass full job for checkpoint resume
  await updateStep(jobId, 'processor', 'running');
  const { answers } = await processQuestions(job);
  await updateStep(jobId, 'processor', 'completed');

  // Step 3: Writer
  await updateStep(jobId, 'writer', 'running');
  const { outputFile } = await writeExcelOutput({
    jobId,
    rows: answers,
  });
  await updateStep(jobId, 'writer', 'completed');

  // Mark job complete
  const totalQuestions = questions.length;
  await OrchestratorJob.findByIdAndUpdate(jobId, {
    status: 'completed',
    outputFile,
    completedAt: new Date(),
    progress: 100,
    completedQuestions: totalQuestions,
  });
}

async function updateStep(jobId: string, stage: string, status: string): Promise<void> {
  const job = await OrchestratorJob.findById(jobId);
  if (!job) return;

  let step = job.steps.find((s: any) => s.stage === stage);
  if (!step) {
    job.steps.push({ stage, status, startedAt: status === 'running' ? new Date() : undefined } as any);
  } else {
    step.status = status;
    if (status === 'running') step.startedAt = new Date();
    if (status === 'completed' || status === 'failed') step.completedAt = new Date();
  }
  await job.save();
}
