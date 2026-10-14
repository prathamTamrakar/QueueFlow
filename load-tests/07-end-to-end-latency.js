import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  BASE_URL,
  generateUUID,
  samplePayload,
  e2eLatency,
  errorRate,
} from './utils.js';

export const options = {
  scenarios: {
    e2e_latency: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
    },
  },
  thresholds: {
    e2e_job_latency_ms: ['p(95)<3000'], // p95 completed in under 3 seconds
  },
};

export default function () {
  const idempotencyKey = generateUUID();
  const payload = JSON.stringify(samplePayload('CPU_LIGHT_PROCESSING'));

  const submitStart = Date.now();
  const res = http.post(`${BASE_URL}/api/jobs`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
  });

  if (res.status !== 201) {
    errorRate.add(1);
    return;
  }

  const jobData = JSON.parse(res.body).data;
  const jobId = jobData.id;

  // Poll until job completes or timeout (max 10 seconds)
  let completed = false;
  let attempts = 0;
  const maxAttempts = 20;

  while (!completed && attempts < maxAttempts) {
    sleep(0.5);
    attempts++;
    const checkRes = http.get(`${BASE_URL}/api/jobs/${jobId}/result`);
    if (checkRes.status === 200) {
      try {
        const body = JSON.parse(checkRes.body);
        if (body.data && body.data.status === 'COMPLETED') {
          completed = true;
          const totalDuration = Date.now() - submitStart;
          e2eLatency.add(totalDuration);
          break;
        }
      } catch {
        // continue polling
      }
    }
  }

  check(completed, {
    'job completed within timeout window': (val) => val === true,
  });
}
