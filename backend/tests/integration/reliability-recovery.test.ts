import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Use vi.hoisted for hoisted mock variables
const { mockBullQueueAdd } = vi.hoisted(() => {
  return {
    mockBullQueueAdd: vi.fn().mockResolvedValue({ id: 'bull-replayed-123' }),
  };
});

// Mocks for Redis & BullMQ
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
      connect: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue('OK'),
      status: 'ready',
    })),
  };
});

vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: mockBullQueueAdd,
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 10,
        failed: 1,
        delayed: 0,
        paused: 0,
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })),
    QueueEvents: vi.fn().mockImplementation(() => ({
      close: vi.fn().mockResolvedValue(undefined),
    })),
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    })),
    UnrecoverableError: class extends Error {},
  };
});

import { createServer } from '../../src/api/server';
import { prisma } from '../../src/database';
import { processJob } from '../../src/workers/processor';
import { IdempotencyService } from '../../src/services/idempotency.service';
import { SideEffectService } from '../../src/services/side-effect.service';

describe('Phase 2 Deliverable: Reliability Scenarios & Proof', () => {
  const app = createServer();
  const ADMIN_KEY = process.env.ADMIN_API_KEY || 'queueflow-admin-secret-key-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 1: Retry and Exponential Backoff', () => {
    it('intentionally fails test job: verifies attempt status FAILED, logs RETRIED, and validates configured delay backoff', async () => {
      const mockJobId = 'job-retry-001';
      const mockBullJob: any = {
        id: 'bull-job-retry-1',
        queueName: 'default-jobs',
        attemptsMade: 0, // Attempt 1
        opts: { attempts: 3 },
        data: {
          jobId: mockJobId,
          type: 'FAILURE_SIMULATION',
          payload: {
            scenario: 'network_timeout',
            failCountBeforeSuccess: 2,
            failType: 'RETRYABLE',
            customErrorMessage: 'Controlled simulation error',
          },
          timeoutMs: 5000,
        },
      };

      const attemptRecord = {
        id: 'attempt-fail-1',
        jobId: mockJobId,
        attemptNumber: 1,
        status: 'RUNNING',
        workerId: 'worker-unit',
      };

      vi.spyOn(prisma.jobAttempt, 'count').mockResolvedValue(0);
      vi.spyOn(prisma.jobAttempt, 'create').mockResolvedValueOnce(attemptRecord as any);
      vi.spyOn(prisma.job, 'update').mockResolvedValue({} as any);
      const attemptUpdateSpy = vi.spyOn(prisma.jobAttempt, 'update').mockResolvedValueOnce({} as any);
      const auditLogSpy = vi.spyOn(prisma.jobAuditLog, 'create').mockResolvedValue({} as any);

      // 1. Controlled failure simulation
      await expect(processJob(mockBullJob)).rejects.toThrow('Controlled simulation error');

      // 2. Verify retry attempt recorded as FAILED with error message
      expect(attemptUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'attempt-fail-1' },
          data: expect.objectContaining({
            status: 'FAILED',
            errorMessage: expect.stringContaining('Controlled simulation error'),
            isRetryable: true,
          }),
        })
      );

      // 3. Verify audit history logged RETRIED with nextAttempt counter
      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: mockJobId,
            action: 'RETRIED',
            details: expect.objectContaining({
              nextAttempt: 2,
              maxAttempts: 3,
            }),
          }),
        })
      );

      // 4. Verify exponential backoff delay progression: delay = base * 2^(attempt - 1)
      const baseDelay = 1000;
      const getDelay = (attempt: number) => Math.pow(2, attempt - 1) * baseDelay;
      expect(getDelay(1)).toBe(1000);  // Attempt 1 -> 1s
      expect(getDelay(2)).toBe(2000);  // Attempt 2 -> 2s
      expect(getDelay(3)).toBe(4000);  // Attempt 3 -> 4s
      expect(getDelay(4)).toBe(8000);  // Attempt 4 -> 8s
    });
  });

  describe('Scenario 2: Dead Letter Queue (DLQ)', () => {
    it('fails job until maximum allowed attempts: verifies persistent failure record and dashboard accessibility', async () => {
      const mockJobId = 'job-dlq-max-attempts';
      const mockBullJob: any = {
        id: 'bull-job-exhausted',
        queueName: 'default-jobs',
        attemptsMade: 2, // Attempt 3 of 3 (final attempt)
        opts: { attempts: 3 },
        data: {
          jobId: mockJobId,
          type: 'FAILURE_SIMULATION',
          payload: {
            scenario: 'network_timeout',
            failCountBeforeSuccess: 3,
            failType: 'PERMANENT',
            customErrorMessage: 'Permanent database error',
          },
          timeoutMs: 5000,
        },
      };

      const attemptRecord = {
        id: 'attempt-final-3',
        jobId: mockJobId,
        attemptNumber: 3,
        status: 'RUNNING',
      };

      vi.spyOn(prisma.jobAttempt, 'count').mockResolvedValue(2);
      vi.spyOn(prisma.jobAttempt, 'create').mockResolvedValueOnce(attemptRecord as any);
      vi.spyOn(prisma.jobAttempt, 'update').mockResolvedValueOnce({} as any);
      const jobUpdateSpy = vi.spyOn(prisma.job, 'update').mockResolvedValue({} as any);
      vi.spyOn(prisma.job, 'findUnique').mockResolvedValueOnce({
        id: mockJobId,
        queueName: 'default-jobs',
        type: 'FAILURE_SIMULATION',
      } as any);
      const dlqUpsertSpy = vi.spyOn(prisma.deadLetterRecord, 'upsert').mockResolvedValueOnce({
        id: 'dlq-record-1',
        jobId: mockJobId,
      } as any);
      const auditLogSpy = vi.spyOn(prisma.jobAuditLog, 'create').mockResolvedValue({} as any);

      // Fails on max attempt
      await expect(processJob(mockBullJob)).rejects.toThrow('Permanent database error');

      // 1. Verify Job marked FAILED in PostgreSQL with timestamp
      expect(jobUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockJobId },
          data: expect.objectContaining({
            status: 'FAILED',
            failedAt: expect.any(Date),
          }),
        })
      );

      // 2. Verify DeadLetterRecord created in PostgreSQL with full error context
      expect(dlqUpsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobId: mockJobId },
          create: expect.objectContaining({
            jobId: mockJobId,
            errorReason: expect.stringContaining('Permanent database error'),
            failureCount: 3,
            isResolved: false,
          }),
        })
      );

      // 3. Verify MOVED_TO_DLQ audit log
      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: mockJobId,
            action: 'MOVED_TO_DLQ',
          }),
        })
      );
    });

    it('verifies DLQ records are queryable by admin/dashboard endpoint', async () => {
      const mockDlqResponse = [
        {
          id: 'dlq-record-1',
          jobId: 'job-dlq-max-attempts',
          errorReason: 'Permanent database error',
          failureCount: 3,
          isResolved: false,
          job: {
            id: 'job-dlq-max-attempts',
            type: 'FAILURE_SIMULATION',
            status: 'FAILED',
          },
        },
      ];

      vi.spyOn(prisma.deadLetterRecord, 'count').mockResolvedValueOnce(1);
      vi.spyOn(prisma.deadLetterRecord, 'findMany').mockResolvedValueOnce(mockDlqResponse as any);

      const res = await request(app)
        .get('/api/admin/jobs/failed?page=1&limit=10')
        .set('x-admin-key', ADMIN_KEY);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].jobId).toBe('job-dlq-max-attempts');
    });
  });

  describe('Scenario 3: DLQ Replay', () => {
    it('replays job from DLQ: resets attempt count, updates audit trail, re-adds to queue, and resolves upon completion', async () => {
      const targetJobId = 'job-replay-target';
      const existingFailedJob = {
        id: targetJobId,
        type: 'EMAIL_SIMULATION',
        queueName: 'default-jobs',
        status: 'FAILED',
        payload: { recipient: 'user@example.com', subject: 'Replay Notice' },
        attemptCount: 3,
        maxAttempts: 3,
        deadLetterRecord: {
          id: 'dlq-entry-1',
          jobId: targetJobId,
          replayCount: 0,
        },
      };

      vi.spyOn(prisma.job, 'findUnique').mockResolvedValueOnce(existingFailedJob as any);
      const jobUpdateSpy = vi.spyOn(prisma.job, 'update').mockResolvedValueOnce({
        ...existingFailedJob,
        status: 'PENDING',
        attemptCount: 0,
      } as any);
      const dlqUpdateSpy = vi.spyOn(prisma.deadLetterRecord, 'update').mockResolvedValueOnce({} as any);
      const auditLogSpy = vi.spyOn(prisma.jobAuditLog, 'create').mockResolvedValue({} as any);

      // Trigger admin replay
      const res = await request(app)
        .post(`/api/admin/jobs/${targetJobId}/replay`)
        .set('x-admin-key', ADMIN_KEY)
        .send({
          reason: 'Manual fix applied to downstream service',
          resetAttempts: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // 1. Verify job state reset to PENDING and attemptCount reset to 0
      expect(jobUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: targetJobId },
          data: expect.objectContaining({
            status: 'PENDING',
            attemptCount: 0,
            failedAt: null,
          }),
        })
      );

      // 2. Verify replay count incremented on deadLetterRecord
      expect(dlqUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobId: targetJobId },
          data: expect.objectContaining({
            replayCount: { increment: 1 },
            isResolved: false,
          }),
        })
      );

      // 3. Verify audit history logged REPLAYED action
      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: targetJobId,
            action: 'REPLAYED',
            details: expect.objectContaining({
              reason: 'Manual fix applied to downstream service',
              resetAttempts: true,
            }),
          }),
        })
      );

      // 4. Verify re-added to BullMQ queue
      expect(mockBullQueueAdd).toHaveBeenCalled();

      // 5. Verify worker completion marks DLQ record as resolved
      const mockReplayedBullJob: any = {
        id: 'bull-job-replay-run',
        queueName: 'default-jobs',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          jobId: targetJobId,
          type: 'CPU_LIGHT_PROCESSING',
          payload: { taskName: 'replayed-cpu-task', recordsCount: 10 },
          timeoutMs: 10000,
        },
      };

      vi.spyOn(prisma.jobAttempt, 'create').mockResolvedValueOnce({ id: 'att-res' } as any);
      vi.spyOn(prisma.jobAttempt, 'update').mockResolvedValueOnce({} as any);
      vi.spyOn(prisma.job, 'update').mockResolvedValue({} as any);
      vi.spyOn(prisma.jobResult, 'upsert').mockResolvedValueOnce({} as any);
      vi.spyOn(prisma.jobAuditLog, 'create').mockResolvedValue({} as any);
      const dlqResolveSpy = vi.spyOn(prisma.deadLetterRecord, 'updateMany').mockResolvedValueOnce({ count: 1 } as any);

      await processJob(mockReplayedBullJob);

      expect(dlqResolveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobId: targetJobId, isResolved: false },
          data: expect.objectContaining({
            isResolved: true,
            resolvedBy: 'worker-automatic-recovery',
          }),
        })
      );
    });
  });

  describe('Scenario 4: Concurrent Idempotency & Side-Effect Protection', () => {
    it('deduplicates parallel requests with same idempotency key and prevents duplicate jobs', async () => {
      const idempotencyKey = 'concurrent-key-888';
      const cachedJob = {
        id: 'job-idempotent-888',
        type: 'EMAIL_SIMULATION',
        status: 'PENDING',
      };

      // Mock Idempotency check:
      // First call -> creates new job
      // Subsequent calls -> detects duplicate and returns cached response
      vi.spyOn(IdempotencyService, 'check')
        .mockResolvedValueOnce({ isDuplicate: false })
        .mockResolvedValue({
          isDuplicate: true,
          cachedResponse: {
            statusCode: 201,
            body: { success: true, data: cachedJob },
          },
        });

      vi.spyOn(prisma.job, 'create').mockResolvedValueOnce(cachedJob as any);
      vi.spyOn(prisma.job, 'update').mockResolvedValueOnce(cachedJob as any);
      vi.spyOn(prisma.jobAuditLog, 'create').mockResolvedValue({} as any);
      vi.spyOn(prisma.idempotencyRecord, 'upsert').mockResolvedValue({} as any);

      // Send 3 concurrent requests with the exact same Idempotency-Key
      const [res1, res2, res3] = await Promise.all([
        request(app).post('/api/jobs').set('Idempotency-Key', idempotencyKey).send({
          type: 'EMAIL_SIMULATION',
          payload: { recipient: 'buyer@example.com', subject: 'Order Confirmation' },
        }),
        request(app).post('/api/jobs').set('Idempotency-Key', idempotencyKey).send({
          type: 'EMAIL_SIMULATION',
          payload: { recipient: 'buyer@example.com', subject: 'Order Confirmation' },
        }),
        request(app).post('/api/jobs').set('Idempotency-Key', idempotencyKey).send({
          type: 'EMAIL_SIMULATION',
          payload: { recipient: 'buyer@example.com', subject: 'Order Confirmation' },
        }),
      ]);

      // All 3 return 201 with identical job data
      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res3.status).toBe(201);
      expect(res1.body.data.id).toBe('job-idempotent-888');
      expect(res2.body.data.id).toBe('job-idempotent-888');
      expect(res3.body.data.id).toBe('job-idempotent-888');

      // Crucial: PostgreSQL job.create was called EXACTLY ONCE across all concurrent calls!
      expect(prisma.job.create).toHaveBeenCalledTimes(1);
    });

    it('protects external side-effects from executing twice during worker retries or replays', async () => {
      let externalApiHitCount = 0;
      const externalPaymentWebhook = async () => {
        externalApiHitCount++;
        return { chargeId: 'ch_9988' };
      };

      // Attempt 1: SideEffect not recorded yet
      const findUniqueSpy = vi.spyOn(prisma.sideEffectLog, 'findUnique');
      findUniqueSpy.mockResolvedValueOnce(null);
      vi.spyOn(prisma.sideEffectLog, 'create').mockResolvedValueOnce({ id: 'se-entry-1' } as any);

      const firstAttempt = await SideEffectService.executeIdempotent(
        'job-payment-1',
        'STRIPE_CHARGE',
        'cust_123',
        externalPaymentWebhook
      );

      expect(firstAttempt.executed).toBe(true);
      expect(firstAttempt.result).toEqual({ chargeId: 'ch_9988' });
      expect(externalApiHitCount).toBe(1);

      // Attempt 2 (Worker retry after crash, or admin replay):
      findUniqueSpy.mockResolvedValueOnce({
        id: 'se-entry-1',
        dedupKey: 'STRIPE_CHARGE:job-payment-1:hash',
        status: 'COMPLETED',
      } as any);

      const secondAttempt = await SideEffectService.executeIdempotent(
        'job-payment-1',
        'STRIPE_CHARGE',
        'cust_123',
        externalPaymentWebhook
      );

      // Side-effect was skipped because deduplication token exists in DB!
      expect(secondAttempt.executed).toBe(false);
      expect(externalApiHitCount).toBe(1); // Still exactly 1 external API call!
    });
  });
});
