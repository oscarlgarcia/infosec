import mongoose from 'mongoose';
import { OrchestratorJob, QueueItem, AnalyticsEvent } from '../../db/mongo/models';
import { runPipeline } from './pipelines';
import { newId } from '../../utils/ids';

let pollingInterval: ReturnType<typeof setInterval> | null = null;

const POLL_INTERVAL_MS = 5000;

export async function enqueueJob(jobId: string, pipeline: 'answer-builder', priority = 0): Promise<void> {
  const now = new Date();
  await QueueItem.findOneAndUpdate(
    { jobId: new mongoose.Types.ObjectId(jobId) },
    {
      $set: {
        jobId: new mongoose.Types.ObjectId(jobId),
        pipeline,
        priority,
        status: 'queued',
        enqueuedAt: now,
      },
      $unset: { startedAt: '' },
    },
    { upsert: true, new: true }
  );
  await OrchestratorJob.findByIdAndUpdate(jobId, { status: 'queued' });

  // Record queue enqueue event
  const job = await OrchestratorJob.findById(jobId).lean();
  await AnalyticsEvent.create({
    eventId: `oq_enq_${newId('evt')}`,
    eventType: 'orchestrator_queue',
    timestamp: now,
    clientId: (job as any)?.clientId,
    latencyMs: 0,
    flags: [`queue_status:queued`, `pipeline:${pipeline}`],
  });
}

async function processNextJob(): Promise<void> {
  try {
    const queueItem = await QueueItem.findOneAndUpdate(
      { status: 'queued' },
      { $set: { status: 'running', startedAt: new Date() } },
      { sort: { priority: -1, enqueuedAt: 1 }, new: true }
    );
    if (!queueItem) return;

    const job = await OrchestratorJob.findByIdAndUpdate(
      queueItem.jobId,
      { status: 'running', startedAt: new Date() },
      { new: true }
    );
    if (!job) {
      await QueueItem.findByIdAndDelete(queueItem._id);
      return;
    }

    // Record queue start event (wait time = startedAt - enqueuedAt)
    const waitTimeMs = queueItem.enqueuedAt ? Date.now() - queueItem.enqueuedAt.getTime() : 0;
    await AnalyticsEvent.create({
      eventId: `oq_run_${newId('evt')}`,
      eventType: 'orchestrator_queue',
      timestamp: new Date(),
      clientId: job.clientId,
      latencyMs: waitTimeMs,
      flags: [`queue_status:running`, `pipeline:${job.pipeline}`, `questions:${job.inputQuestions?.length || 0}`],
    });

    try {
      await runPipeline(job);
      await QueueItem.findByIdAndUpdate(queueItem._id, { status: 'completed' });

      // Record queue completion event
      const processingTimeMs = queueItem.startedAt ? Date.now() - queueItem.startedAt.getTime() : 0;
      await AnalyticsEvent.create({
        eventId: `oq_cpl_${newId('evt')}`,
        eventType: 'orchestrator_queue',
        timestamp: new Date(),
        clientId: job.clientId,
        latencyMs: processingTimeMs,
        flags: [`queue_status:completed`, `pipeline:${job.pipeline}`, `questions:${job.inputQuestions?.length || 0}`],
      });
    } catch (err: any) {
      await OrchestratorJob.findByIdAndUpdate(job._id, {
        status: 'failed',
        errorMessage: err.message,
        completedAt: new Date(),
      });
      await QueueItem.findByIdAndUpdate(queueItem._id, { status: 'failed' });

      // Record queue failure event
      await AnalyticsEvent.create({
        eventId: `oq_fail_${newId('evt')}`,
        eventType: 'orchestrator_queue',
        timestamp: new Date(),
        clientId: job.clientId,
        latencyMs: 0,
        flags: [`queue_status:failed`, `pipeline:${job.pipeline}`],
      });
    }
  } catch (err) {
    console.error('[Orchestrator Queue] Error processing job:', err);
  }
}

export function startQueuePolling(): void {
  if (pollingInterval) return;
  console.log('[Orchestrator Queue] Starting polling loop...');
  pollingInterval = setInterval(processNextJob, POLL_INTERVAL_MS);
}

export function stopQueuePolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('[Orchestrator Queue] Polling loop stopped');
  }
}

export async function getQueueState(): Promise<{ queued: number; running: number; completed: number; failed: number }> {
  const [queued, running, completed, failed] = await Promise.all([
    QueueItem.countDocuments({ status: 'queued' }),
    QueueItem.countDocuments({ status: 'running' }),
    QueueItem.countDocuments({ status: 'completed' }),
    QueueItem.countDocuments({ status: 'failed' }),
  ]);
  return { queued, running, completed, failed };
}

export async function cancelQueuedJob(jobId: string): Promise<void> {
  await QueueItem.findOneAndUpdate(
    { jobId: new mongoose.Types.ObjectId(jobId), status: 'queued' },
    { status: 'cancelled' }
  );
}
