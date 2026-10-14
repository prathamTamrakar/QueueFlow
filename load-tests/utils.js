import { Trend, Counter, Rate } from 'k6/metrics';

export const BASE_URL = __ENV.API_URL || 'http://localhost:4000';
export const ADMIN_KEY = __ENV.ADMIN_API_KEY || 'queueflow-admin-secret-key-123';

// Custom Metrics
export const enqueueDuration = new Trend('enqueue_duration_ms', true);
export const e2eLatency = new Trend('e2e_job_latency_ms', true);
export const acceptedJobs = new Counter('accepted_jobs_total');
export const cachedIdempotentResponses = new Counter('cached_idempotent_responses_total');
export const errorRate = new Rate('http_error_rate');

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function samplePayload(jobType = 'EMAIL_SIMULATION') {
  const id = Math.floor(Math.random() * 1000000);
  switch (jobType) {
    case 'EMAIL_SIMULATION':
      return {
        type: 'EMAIL_SIMULATION',
        payload: {
          recipient: `user_${id}@loadtest.domain.com`,
          subject: `Automated Load Test Notification #${id}`,
          template: 'load-test-email',
          context: { iteration: id, timestamp: Date.now() },
        },
        priority: 0,
      };
    case 'PDF_GENERATION':
      return {
        type: 'PDF_GENERATION',
        payload: {
          reportId: `rep_bench_${id}`,
          title: `Performance Benchmark Report ${id}`,
          pages: 5,
          includeCharts: true,
        },
        priority: 1,
      };
    case 'CPU_LIGHT_PROCESSING':
      return {
        type: 'CPU_LIGHT_PROCESSING',
        payload: {
          taskName: `benchmark_hash_${id}`,
          recordsCount: 500,
          algorithm: 'sha256',
        },
        priority: 0,
      };
    case 'FAILURE_SIMULATION':
      return {
        type: 'FAILURE_SIMULATION',
        payload: {
          scenario: 'load_test_retry_recovery',
          failCountBeforeSuccess: 2,
          failType: 'RETRYABLE',
          customErrorMessage: 'Simulated transient network timeout for load test',
        },
        priority: 0,
        maxAttempts: 3,
        backoffDelayMs: 500,
      };
    default:
      return {
        type: 'EMAIL_SIMULATION',
        payload: {
          recipient: `fallback_${id}@test.com`,
          subject: 'Fallback Job',
        },
      };
  }
}
