import { describe, it, expect } from 'vitest';
import { IdempotencyService } from '../../src/services/idempotency.service';

describe('Idempotency Hashing & Logic', () => {
  it('generates consistent deterministic hashes regardless of key order', () => {
    const payloadA = { a: 1, b: 2, c: { d: 'test', e: [1, 2] } };
    const payloadB = { b: 2, a: 1, c: { d: 'test', e: [1, 2] } };

    const hashA = IdempotencyService.hashPayload(payloadA);
    const hashB = IdempotencyService.hashPayload(payloadB);

    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64); // SHA256 hex string length
  });

  it('detects different payloads with distinct hashes', () => {
    const payload1 = { email: 'user1@example.com', amount: 100 };
    const payload2 = { email: 'user2@example.com', amount: 100 };

    const hash1 = IdempotencyService.hashPayload(payload1);
    const hash2 = IdempotencyService.hashPayload(payload2);

    expect(hash1).not.toBe(hash2);
  });
});
