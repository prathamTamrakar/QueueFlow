import http from 'k6/http';
import { check } from 'k6';
import {
  BASE_URL,
  cachedIdempotentResponses,
  acceptedJobs,
  errorRate,
} from './utils.js';

export const options = {
  scenarios: {
    idempotency_storm: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 25, // 500 total requests
      maxDuration: '1m',
    },
  },
};

// Deliberately shared fixed pool of 5 keys across 500 requests
const SHARED_KEYS = [
  'idemp-key-shared-alpha-001',
  'idemp-key-shared-beta-002',
  'idemp-key-shared-gamma-003',
  'idemp-key-shared-delta-004',
  'idemp-key-shared-epsilon-005',
];

export default function () {
  // Pick one of 5 shared keys
  const keyIndex = Math.floor(Math.random() * SHARED_KEYS.length);
  const idempotencyKey = SHARED_KEYS[keyIndex];

  const payload = JSON.stringify({
    type: 'EMAIL_SIMULATION',
    payload: {
      recipient: `idempotent_${keyIndex}@enterprise.org`,
      subject: `Idempotent Test for Slot ${keyIndex}`,
      template: 'idemp-tpl',
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
  };

  const res = http.post(`${BASE_URL}/api/jobs`, payload, params);

  const isSuccess = check(res, {
    'status is 201': (r) => r.status === 201,
    'contains data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && body.data.id !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (isSuccess) {
    try {
      const body = JSON.parse(res.body);
      if (body.cached === true) {
        cachedIdempotentResponses.add(1);
      } else {
        acceptedJobs.add(1);
      }
    } catch {
      // ignore parse
    }
    errorRate.add(0);
  } else {
    errorRate.add(1);
  }
}
