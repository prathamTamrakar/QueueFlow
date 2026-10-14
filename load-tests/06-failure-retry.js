import http from 'k6/http';
import { check } from 'k6';
import {
  BASE_URL,
  generateUUID,
  samplePayload,
  acceptedJobs,
  errorRate,
} from './utils.js';

export const options = {
  scenarios: {
    failure_and_retry: {
      executor: 'constant-vus',
      vus: 10,
      duration: '45s',
    },
  },
};

export default function () {
  const isPermanent = Math.random() < 0.3; // 30% permanent, 70% retryable
  const payload = JSON.stringify({
    type: 'FAILURE_SIMULATION',
    payload: {
      scenario: isPermanent ? 'invalid_credentials_fatal' : 'transient_timeout_recovery',
      failCountBeforeSuccess: isPermanent ? 5 : 2,
      failType: isPermanent ? 'PERMANENT' : 'RETRYABLE',
      customErrorMessage: isPermanent
        ? 'Fatal authentication rejection 403 Forbidden'
        : 'Transient upstream network timeout 504 Gateway',
    },
    maxAttempts: 3,
    backoffDelayMs: 500,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': generateUUID(),
    },
  };

  const res = http.post(`${BASE_URL}/api/jobs`, payload, params);

  const ok = check(res, {
    'job accepted for processing': (r) => r.status === 201,
  });

  if (ok) {
    acceptedJobs.add(1);
    errorRate.add(0);
  } else {
    errorRate.add(1);
  }
}
