export type JobStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'DELAYED' | 'CANCELLED';

export type JobType =
  | 'EMAIL_SIMULATION'
  | 'PDF_GENERATION'
  | 'CPU_LIGHT_PROCESSING'
  | 'FAILURE_SIMULATION';

export interface JobAttempt {
  id: string;
  attemptNumber: number;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  workerId?: string;
  errorName?: string;
  errorMessage?: string;
  durationMs?: number;
  startedAt: string;
  finishedAt?: string;
}

export interface JobAuditLog {
  id: string;
  action: string;
  actor: string;
  actorId?: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface JobResult {
  data: Record<string, any>;
  executionDurationMs: number;
  createdAt: string;
}

export interface Job {
  id: string;
  bullMqJobId?: string;
  type: JobType;
  queueName: string;
  payload: Record<string, any>;
  priority: number;
  status: JobStatus;
  maxAttempts: number;
  attemptCount: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  attempts?: JobAttempt[];
  result?: JobResult;
  deadLetterRecord?: {
    id: string;
    isResolved: boolean;
  };
  auditLogs?: JobAuditLog[];
}

export interface QueueStats {
  bullMq: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  database: {
    totalJobs: number;
    byStatus: {
      PENDING: number;
      ACTIVE: number;
      COMPLETED: number;
      FAILED: number;
      DELAYED: number;
      CANCELLED: number;
    };
    unresolvedDlqCount: number;
  };
  performance: {
    successRate: number;
    failureRate: number;
    latencyPercentiles: {
      p50: number;
      p95: number;
      p99: number;
      sampleSize: number;
    };
  };
  worker: {
    concurrency: number;
    queueName: string;
    rateLimitMax: number;
    rateLimitDurationMs: number;
    redisConnected: boolean;
  };
  timestamp: string;
}

export interface DLQRecord {
  id: string;
  jobId: string;
  originalPayload: Record<string, any>;
  errorReason: string;
  errorDetails?: Record<string, any>;
  failureCount: number;
  firstFailedAt: string;
  lastFailedAt: string;
  replayCount: number;
  lastReplayedAt?: string;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  job?: Job;
}
