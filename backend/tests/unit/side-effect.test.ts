import { describe, it, expect, vi } from 'vitest';
import { SideEffectService } from '../../src/services/side-effect.service';
import { prisma } from '../../src/database';

describe('Side-Effect Idempotency Guarantee', () => {
  it('executes external side-effect exactly once and prevents duplicate side-effects on replay/retries', async () => {
    let executionCallCount = 0;
    const simulatedExternalApiCall = async () => {
      executionCallCount++;
      return { transactionId: 'tx_7721' };
    };

    // First run: no existing record found in DB
    const findUniqueSpy = vi.spyOn(prisma.sideEffectLog, 'findUnique');
    findUniqueSpy.mockResolvedValueOnce(null);

    const createSpy = vi.spyOn(prisma.sideEffectLog, 'create');
    createSpy.mockResolvedValueOnce({
      id: 'log-1',
      dedupKey: 'EMAIL:job-123:hash',
      jobId: 'job-123',
      effectType: 'EMAIL',
      recipient: 'bob@example.com',
      status: 'COMPLETED',
      executedAt: new Date(),
    });

    const firstRun = await SideEffectService.executeIdempotent(
      'job-123',
      'EMAIL',
      'bob@example.com',
      simulatedExternalApiCall
    );

    expect(firstRun.executed).toBe(true);
    expect(firstRun.result).toEqual({ transactionId: 'tx_7721' });
    expect(executionCallCount).toBe(1);

    // Second run (e.g. worker crashed and BullMQ retried the job, or DLQ replay):
    // Record already exists in DB!
    findUniqueSpy.mockResolvedValueOnce({
      id: 'log-1',
      dedupKey: 'EMAIL:job-123:hash',
      jobId: 'job-123',
      effectType: 'EMAIL',
      recipient: 'bob@example.com',
      status: 'COMPLETED',
      executedAt: new Date(),
    });

    const secondRun = await SideEffectService.executeIdempotent(
      'job-123',
      'EMAIL',
      'bob@example.com',
      simulatedExternalApiCall
    );

    // Side-effect was NOT executed a second time!
    expect(secondRun.executed).toBe(false);
    expect(executionCallCount).toBe(1); // Call count remains 1!
  });
});
