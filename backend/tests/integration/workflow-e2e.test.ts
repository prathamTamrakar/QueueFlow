import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

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
      add: vi.fn().mockResolvedValue({ id: 'bull-job-uuid-100' }),
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: 3,
        active: 1,
        completed: 15,
        failed: 2,
        delayed: 1,
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
import { StatsService } from '../../src/services/stats.service';
import * as dbModule from '../../src/database';
import * as queueModule from '../../src/queues';

describe('Phase 1 Deliverable: Core Workflows End-to-End', () => {
  const app = createServer();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Job Submission & PostgreSQL Persistence', () => {
    it('successfully submits a standard job, persists to DB with PENDING status, and queues in BullMQ', async () => {
      const mockDbJob = {
        id: 'job-uuid-001',
        type: 'EMAIL_SIMULATION',
        queueName: 'default-jobs',
        payload: { recipient: 'user@example.com', subject: 'Welcome' },
        priority: 1,
        status: 'PENDING',
        maxAttempts: 3,
        backoffType: 'exponential',
        backoffDelayMs: 1000,
        timeoutMs: 30000,
        attemptCount: 0,
        bullMqJobId: 'bull-job-uuid-100',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.job, 'create').mockResolvedValueOnce(mockDbJob as any);
      vi.spyOn(prisma.job, 'update').mockResolvedValueOnce(mockDbJob as any);
      vi.spyOn(prisma.jobAuditLog, 'create').mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post('/api/jobs')
        .send({
          type: 'EMAIL_SIMULATION',
          queueName: 'default-jobs',
          payload: { recipient: 'user@example.com', subject: 'Welcome' },
          priority: 1,
          maxAttempts: 3,
          backoffDelayMs: 1000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('job-uuid-001');
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.type).toBe('EMAIL_SIMULATION');

      // Verify PostgreSQL persistence was invoked with correct state
      expect(prisma.job.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'EMAIL_SIMULATION',
            status: 'PENDING',
            priority: 1,
            maxAttempts: 3,
          }),
        })
      );
    });

    it('submits a delayed job and persists with DELAYED status', async () => {
      const mockDelayedJob = {
        id: 'job-uuid-delayed',
        type: 'CPU_LIGHT_PROCESSING',
        queueName: 'default-jobs',
        payload: { taskName: 'delayed-report', recordsCount: 100 },
        priority: 0,
        status: 'DELAYED',
        maxAttempts: 3,
        backoffType: 'exponential',
        backoffDelayMs: 1000,
        timeoutMs: 30000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.job, 'create').mockResolvedValueOnce(mockDelayedJob as any);
      vi.spyOn(prisma.job, 'update').mockResolvedValueOnce(mockDelayedJob as any);
      vi.spyOn(prisma.jobAuditLog, 'create').mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post('/api/jobs')
        .send({
          type: 'CPU_LIGHT_PROCESSING',
          payload: { taskName: 'delayed-report', recordsCount: 100 },
          delayMs: 5000,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('DELAYED');
      expect(prisma.job.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DELAYED',
          }),
        })
      );
    });
  });

  describe('2. Worker Execution Lifecycle', () => {
    it('executes job in worker, records JobAttempt, updates status ACTIVE -> COMPLETED, and stores JobResult', async () => {
      const mockJobId = 'job-exec-test-1';
      const mockBullJob: any = {
        id: 'bull-job-123',
        queueName: 'default-jobs',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          jobId: mockJobId,
          type: 'CPU_LIGHT_PROCESSING',
          payload: { taskName: 'e2e-worker-test', recordsCount: 50 },
          timeoutMs: 10000,
        },
      };

      const attemptRecord = {
        id: 'attempt-uuid-1',
        jobId: mockJobId,
        attemptNumber: 1,
        status: 'RUNNING',
        workerId: 'worker-test-1',
        startedAt: new Date(),
      };

      const jobAttemptCreateSpy = vi.spyOn(prisma.jobAttempt, 'create').mockResolvedValueOnce(attemptRecord as any);
      const jobUpdateSpy = vi.spyOn(prisma.job, 'update').mockResolvedValue({} as any);
      const jobAttemptUpdateSpy = vi.spyOn(prisma.jobAttempt, 'update').mockResolvedValueOnce({} as any);
      const jobResultUpsertSpy = vi.spyOn(prisma.jobResult, 'upsert').mockResolvedValueOnce({} as any);
      vi.spyOn(prisma.deadLetterRecord, 'updateMany').mockResolvedValueOnce({ count: 0 } as any);
      vi.spyOn(prisma.jobAuditLog, 'create').mockResolvedValue({} as any);

      const executionResult = await processJob(mockBullJob);

      expect(executionResult).toBeDefined();
      expect(executionResult.success).toBe(true);
      expect(executionResult.data).toHaveProperty('finalDigest');

      // 1. Verify JobAttempt created
      expect(jobAttemptCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: mockJobId,
            attemptNumber: 1,
            status: 'RUNNING',
          }),
        })
      );

      // 2. Verify Job updated to ACTIVE, then COMPLETED
      expect(jobUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockJobId },
          data: expect.objectContaining({ status: 'ACTIVE' }),
        })
      );
      expect(jobUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockJobId },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        })
      );

      // 3. Verify JobAttempt marked SUCCESS
      expect(jobAttemptUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'attempt-uuid-1' },
          data: expect.objectContaining({ status: 'SUCCESS' }),
        })
      );

      // 4. Verify JobResult persisted
      expect(jobResultUpsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobId: mockJobId },
          create: expect.objectContaining({ jobId: mockJobId }),
        })
      );
    });
  });

  describe('3. Dashboard Status & Observability Queries', () => {
    it('returns accurate single job lifecycle status with attempts and results', async () => {
      const mockJobWithDetails = {
        id: 'job-query-101',
        type: 'EMAIL_SIMULATION',
        queueName: 'default-jobs',
        status: 'COMPLETED',
        attemptCount: 1,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        attempts: [
          {
            id: 'attempt-1',
            attemptNumber: 1,
            status: 'SUCCESS',
            durationMs: 42,
          },
        ],
        result: {
          id: 'result-1',
          data: { status: 'SENT', messageId: 'msg-123' },
          executionDurationMs: 42,
        },
      };

      vi.spyOn(prisma.job, 'findUnique').mockResolvedValueOnce(mockJobWithDetails as any);

      const res = await request(app).get('/api/jobs/job-query-101');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('job-query-101');
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.result.data.messageId).toBe('msg-123');
    });

    it('returns queue depth metrics matching dashboard expectation', async () => {
      vi.spyOn(StatsService, 'getQueueStats').mockResolvedValueOnce({
        bullmq: { waiting: 3, active: 1, completed: 15, failed: 2, delayed: 1, paused: 0 },
        postgres: { total: 21, pending: 3, active: 1, completed: 15, failed: 2, delayed: 1, cancelled: 0 },
        deadLetterCount: 0,
        historicalAttempts: 25,
        avgExecutionDurationMs: 150,
        recentActivity: [],
      } as any);

      const res = await request(app).get('/api/queues/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('bullmq');
      expect(res.body.data.bullmq.waiting).toBe(3);
    });
  });

  describe('4. Invalid Payloads & Edge Cases', () => {
    it('rejects completely empty request body with 422', async () => {
      const res = await request(app).post('/api/jobs').send({});
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects unsupported job type with 422', async () => {
      const res = await request(app).post('/api/jobs').send({
        type: 'UNSUPPORTED_JOB_TYPE',
        payload: { test: true },
      });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects negative priority and negative maxAttempts with 422', async () => {
      const res = await request(app).post('/api/jobs').send({
        type: 'CPU_LIGHT_PROCESSING',
        payload: { taskName: 'negative-test', recordsCount: 10 },
        priority: -25,
        maxAttempts: -1,
      });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('5. Unavailable Dependency Resilience', () => {
    it('returns 503 DEGRADED when PostgreSQL is DOWN', async () => {
      vi.spyOn(dbModule, 'checkDatabaseHealth').mockResolvedValueOnce(false);
      vi.spyOn(queueModule, 'checkRedisHealth').mockResolvedValueOnce(true);

      const res = await request(app).get('/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('DEGRADED');
      expect(res.body.services.database).toBe('DOWN');
      expect(res.body.services.redis).toBe('UP');
    });

    it('returns 503 DEGRADED when Redis is DOWN', async () => {
      vi.spyOn(dbModule, 'checkDatabaseHealth').mockResolvedValueOnce(true);
      vi.spyOn(queueModule, 'checkRedisHealth').mockResolvedValueOnce(false);

      const res = await request(app).get('/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('DEGRADED');
      expect(res.body.services.database).toBe('UP');
      expect(res.body.services.redis).toBe('DOWN');
    });

    it('returns 200 READY when both PostgreSQL and Redis are UP', async () => {
      vi.spyOn(dbModule, 'checkDatabaseHealth').mockResolvedValueOnce(true);
      vi.spyOn(queueModule, 'checkRedisHealth').mockResolvedValueOnce(true);

      const res = await request(app).get('/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('READY');
      expect(res.body.services.database).toBe('UP');
      expect(res.body.services.redis).toBe('UP');
    });
  });
});
