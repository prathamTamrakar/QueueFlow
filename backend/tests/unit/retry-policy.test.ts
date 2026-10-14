import { describe, it, expect } from 'vitest';
import { RetryableError, NonRetryableError } from '../../src/errors';

describe('Retry Policy & Error Classification', () => {
  it('correctly classifies Retryable vs NonRetryable errors', () => {
    const transientErr = new RetryableError('Database deadlock / connection lost');
    const fatalErr = new NonRetryableError('Validation failed: invalid schema');

    expect(transientErr).toBeInstanceOf(RetryableError);
    expect(transientErr.statusCode).toBe(500);

    expect(fatalErr).toBeInstanceOf(NonRetryableError);
    expect(fatalErr.statusCode).toBe(400);
  });

  it('calculates exponential backoff delay correctly', () => {
    const baseDelay = 1000;
    const calculateBackoff = (attempt: number, base: number) => {
      // 2^(attempt - 1) * base
      return Math.pow(2, attempt - 1) * base;
    };

    expect(calculateBackoff(1, baseDelay)).toBe(1000);
    expect(calculateBackoff(2, baseDelay)).toBe(2000);
    expect(calculateBackoff(3, baseDelay)).toBe(4000);
    expect(calculateBackoff(4, baseDelay)).toBe(8000);
  });
});
