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
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 200 },
        { duration: '1m', target: 500 },
        { duration: '30s', target: 1000 }, // stress beyond standard capacity
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_error_rate: ['rate<0.05'], // allowable under stress
    enqueue_duration_ms: ['p(95)<500'],
  },
};

export default function () {
  const idempotencyKey = generateUUID();
  const payload = JSON.stringify(samplePayload('CPU_LIGHT_PROCESSING'));

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
    'request succeeded': (r) => r.status === 201 || r.status === 429,
  });

  if (ok && res.status === 201) {
    acceptedJobs.add(1);
    errorRate.add(0);
  } else {
    errorRate.add(1);
  }
}
