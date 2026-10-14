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
    spike_test: {
      executor: 'ramping-arrival-rate',
      startRate: 20,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages: [
        { duration: '20s', target: 50 },   // baseline
        { duration: '10s', target: 800 },  // sudden 16x spike!
        { duration: '30s', target: 800 },  // sustain spike
        { duration: '10s', target: 50 },   // recovery
        { duration: '20s', target: 50 },   // stabilize
      ],
    },
  },
  thresholds: {
    http_error_rate: ['rate<0.02'],
    enqueue_duration_ms: ['p(95)<300'],
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

  const ok = check(res, {
    'status is 201': (r) => r.status === 201,
  });

  if (ok) {
    acceptedJobs.add(1);
    errorRate.add(0);
  } else {
    errorRate.add(1);
  }
}
