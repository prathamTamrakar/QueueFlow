import http from 'k6/http';
import { check } from 'k6';
import {
  BASE_URL,
  generateUUID,
  samplePayload,
  enqueueDuration,
  acceptedJobs,
  errorRate,
} from './utils.js';

export const options = {
  scenarios: {
    enqueue_throughput: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { duration: '30s', target: 200 },
        { duration: '1m', target: 500 },
        { duration: '30s', target: 1000 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_error_rate: ['rate<0.01'], // < 1% error rate
    enqueue_duration_ms: ['p(95)<150', 'p(99)<300'], // p95 < 150ms
  },
};

export default function () {
  const idempotencyKey = generateUUID();
  const payload = JSON.stringify(samplePayload('EMAIL_SIMULATION'));

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/api/jobs`, payload, params);
  enqueueDuration.add(Date.now() - startTime);

  const success = check(res, {
    'status is 201': (r) => r.status === 201,
    'has job id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.data && body.data.id;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    acceptedJobs.add(1);
    errorRate.add(0);
  } else {
    errorRate.add(1);
  }
}
