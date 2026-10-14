export type JobStatusType = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'DELAYED' | 'CANCELLED';

export type JobTypeType =
  | 'EMAIL_SIMULATION'
  | 'PDF_GENERATION'
  | 'CPU_LIGHT_PROCESSING'
  | 'FAILURE_SIMULATION';

export type AttemptStatusType = 'RUNNING' | 'SUCCESS' | 'FAILED';

export type AuditActionType =
  | 'ENQUEUED'
  | 'ATTEMPT_STARTED'
  | 'ATTEMPT_SUCCEEDED'
  | 'ATTEMPT_FAILED'
  | 'RETRIED'
  | 'CANCELLED'
  | 'MOVED_TO_DLQ'
  | 'REPLAYED'
  | 'STATUS_CHANGED';

export type ActorTypeType = 'SYSTEM' | 'WORKER' | 'API_USER' | 'ADMIN';

export interface EmailJobPayload {
  recipient: string;
  subject: string;
  template?: string;
  body?: string;
  context?: Record<string, unknown>;
}

export interface PdfJobPayload {
  reportId: string;
  title: string;
  pages?: number;
  includeCharts?: boolean;
}

export interface CpuLightJobPayload {
  taskName: string;
  recordsCount?: number;
  algorithm?: 'sha256' | 'sha512' | 'md5';
}

export interface FailureSimJobPayload {
  scenario?: string;
  failCountBeforeSuccess?: number;
  failType?: 'RETRYABLE' | 'PERMANENT';
  customErrorMessage?: string;
}

export type JobPayload =
  | EmailJobPayload
  | PdfJobPayload
  | CpuLightJobPayload
  | FailureSimJobPayload;

export interface CreateJobInput {
  type: JobTypeType;
  payload: JobPayload;
  priority?: number;
  maxAttempts?: number;
  backoffType?: 'exponential' | 'fixed';
  backoffDelayMs?: number;
  timeoutMs?: number;
  queueName?: string;
  delayMs?: number;
}

export interface JobExecutionResult {
  success: boolean;
  data: Record<string, unknown>;
  durationMs: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}
