import http from 'k6/http';
import { check, sleep } from 'k6';
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
    sustained_load: {
      executor: 'constant-arrival-rate',
      rate: 150,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 100,
      maxVUs: 250,
    },
  },
  thresholds: {
    http_error_rate: ['rate<0.005'], // < 0.5% error rate
    enqueue_duration_ms: ['p(95)<100'],
  },
};

const jobTypes = ['EMAIL_SIMULATION', 'PDF_GENERATION', 'CPU_LIGHT_PROCESSING'];

export default function () {
  const selectedType = jobTypes[Math.floor(Math.random() * jobTypes.length)];
  const idempotencyKey = generateUUID();
  const payload = JSON.stringify(samplePayload(selectedType));

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
