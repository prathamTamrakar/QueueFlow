import client from 'prom-client';
import { config } from '../config';

// Create a dedicated Prometheus Registry
export const register = new client.Registry();

// Add default recommended node.js metrics (CPU, Memory, EventLoop, etc.)
client.collectDefaultMetrics({
  register,
  prefix: config.metrics.prefix,
});

// 1. Total jobs enqueued
export const jobsEnqueuedTotal = new client.Counter({
  name: `${config.metrics.prefix}jobs_enqueued_total`,
  help: 'Total count of jobs enqueued',
  labelNames: ['queue', 'job_type'],
  registers: [register],
});

// 2. Total jobs completed successfully
export const jobsCompletedTotal = new client.Counter({
  name: `${config.metrics.prefix}jobs_completed_total`,
  help: 'Total count of jobs successfully completed',
  labelNames: ['queue', 'job_type'],
  registers: [register],
});

// 3. Total jobs failed
export const jobsFailedTotal = new client.Counter({
  name: `${config.metrics.prefix}jobs_failed_total`,
  help: 'Total count of jobs that encountered failures (both retryable and final)',
  labelNames: ['queue', 'job_type', 'is_final'],
  registers: [register],
});

// 4. Total job retries executed
export const jobsRetriedTotal = new client.Counter({
  name: `${config.metrics.prefix}jobs_retried_total`,
  help: 'Total count of job retry attempts executed',
  labelNames: ['queue', 'job_type'],
  registers: [register],
});

// 5. Current queue depth across states
export const queueDepth = new client.Gauge({
  name: `${config.metrics.prefix}queue_depth`,
  help: 'Current count of jobs in the queue by state (waiting, active, delayed, failed, completed)',
  labelNames: ['queue', 'state'],
  registers: [register],
});

// 6. Job processing duration histogram (in seconds)
export const jobProcessingDuration = new client.Histogram({
  name: `${config.metrics.prefix}job_processing_duration_seconds`,
  help: 'Duration of individual job execution attempts in seconds',
  labelNames: ['queue', 'job_type', 'status'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

// 7. Enqueue HTTP request duration histogram
export const httpRequestDuration = new client.Histogram({
  name: `${config.metrics.prefix}http_request_duration_seconds`,
  help: 'HTTP request latency for API endpoints in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [register],
});

// 8. Active workers gauge
export const workerActiveCount = new client.Gauge({
  name: `${config.metrics.prefix}worker_active_count`,
  help: 'Number of active worker processes or concurrency slots currently working',
  labelNames: ['worker_id'],
  registers: [register],
});

// 9. Idempotency conflicts count
export const idempotencyConflictsTotal = new client.Counter({
  name: `${config.metrics.prefix}idempotency_conflicts_total`,
  help: 'Total number of duplicate or conflicting idempotency key requests detected',
  registers: [register],
});

// 10. Dead-letter queue counter
export const deadLetterJobsTotal = new client.Counter({
  name: `${config.metrics.prefix}dead_letter_jobs_total`,
  help: 'Total number of jobs moved to the dead-letter queue after all retries exhausted',
  labelNames: ['queue', 'job_type'],
  registers: [register],
});
