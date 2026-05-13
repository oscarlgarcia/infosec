export type PipelineStage = 'reader' | 'processor' | 'writer';

export type JobStatus = 'pending' | 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type PipelineName = 'answer-builder';

export interface PipelineStep {
  stage: PipelineStage;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  progress?: number;
}

export interface OutputRow {
  question: string;
  answer: string;
  domain?: string;
  subdomain?: string;
  confidence?: number;
  requiresLegalReview?: boolean;
  contradictionFlag?: boolean;
  evidenceCount?: number;
  notes?: string;
  timingMs?: number;
}

export interface OrchestratorJob {
  id: string;
  name: string;
  pipeline: PipelineName;
  status: JobStatus;
  clientId: string;
  requestId?: string;
  conversationId?: string;
  agent?: string;
  inputFile?: string;
  inputQuestions: string[];
  outputRows: OutputRow[];
  totalQuestions: number;
  completedQuestions: number;
  progress: number;
  steps: PipelineStep[];
  errorMessage?: string;
  outputFile?: string;
  avgTimingMs?: number;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface CreateJobInput {
  name: string;
  clientId: string;
  requestId?: string;
  agent?: string;
  inputQuestions: string[];
  inputFile?: string;
}

export interface QueueItem {
  jobId: string;
  pipeline: PipelineName;
  status: JobStatus;
  priority: number;
  enqueuedAt: Date;
  startedAt?: Date;
}
