import { prisma } from '../database';
import { jobQueue, dlqQueue } from '../queues';
import { logger } from '../logger';
import { deadLetterJobsTotal, jobsEnqueuedTotal } from '../metrics';
import { AuditService } from './audit.service';
import { NotFoundError, AppError } from '../errors';

export class DLQService {
  /**
   * Persists a permanently failed job into the Dead-Letter Queue system.
   */
  public static async recordToDLQ(
    jobId: string,
    payload: unknown,
    errorReason: string,
    errorDetails: Record<string, unknown> = {},
    failureCount = 1
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;

    logger.warn({ jobId, errorReason, failureCount }, 'Moving job to Dead-Letter Queue');

    // Persist durable Dead-Letter record
    const dlqRecord = await prisma.deadLetterRecord.upsert({
      where: { jobId },
      create: {
        jobId,
        originalPayload: payload as any,
        errorReason,
        errorDetails: errorDetails as any,
        failureCount,
        firstFailedAt: new Date(),
        lastFailedAt: new Date(),
        isResolved: false,
      },
      update: {
        errorReason,
        errorDetails: errorDetails as any,
        failureCount: { increment: 1 },
        lastFailedAt: new Date(),
        isResolved: false,
      },
    });

    // Record audit trail
    await AuditService.log(
      jobId,
      'MOVED_TO_DLQ',
      'SYSTEM',
      undefined,
      { errorReason, failureCount, dlqRecordId: dlqRecord.id }
    );

    // Track Prometheus metric
    deadLetterJobsTotal.inc({
      queue: job.queueName,
      job_type: job.type,
    });

    // Also push to BullMQ DLQ queue for message-broker parity and external stream listeners
    try {
      await dlqQueue.add('dead-letter-job', {
        jobId,
        originalQueue: job.queueName,
        payload,
        errorReason,
        failedAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error({ err, jobId }, 'Failed to push into BullMQ DLQ broker');
    }

    return dlqRecord;
  }

  /**
   * Lists DLQ jobs with pagination and resolution filter.
   */
  public static async listFailedJobs(query: {
    page: number;
    limit: number;
    isResolved?: boolean;
  }) {
    const { page, limit, isResolved } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (isResolved !== undefined) {
      where.isResolved = isResolved;
    }

    const [total, records] = await Promise.all([
      prisma.deadLetterRecord.count({ where }),
      prisma.deadLetterRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastFailedAt: 'desc' },
        include: {
          job: {
            select: {
              id: true,
              type: true,
              queueName: true,
              status: true,
              createdAt: true,
              failedAt: true,
              maxAttempts: true,
              attemptCount: true,
            },
          },
        },
      }),
    ]);

    return {
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves a single DLQ record by job ID.
   */
  public static async getFailedJobById(jobId: string) {
    const record = await prisma.deadLetterRecord.findUnique({
      where: { jobId },
      include: {
        job: {
          include: {
            attempts: { orderBy: { attemptNumber: 'asc' } },
            auditLogs: { orderBy: { timestamp: 'asc' } },
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundError(`Dead-letter record for job ID ${jobId} not found`);
    }

    return record;
  }

  /**
   * Replays a dead-letter job safely, ensuring idempotent replay and audit trail.
   */
  public static async replayJob(
    jobId: string,
    reason = 'Admin manual replay triggered',
    actorId = 'admin',
    resetAttempts = true
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { deadLetterRecord: true },
    });

    if (!job) {
      throw new NotFoundError(`Job with ID ${jobId} not found`);
    }

    if (job.status === 'ACTIVE') {
      throw new AppError('Job is currently active and cannot be replayed', 409);
    }

    // Step 1: Update Job status and attempts
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'PENDING',
        attemptCount: resetAttempts ? 0 : job.attemptCount,
        failedAt: null,
      },
    });

    // Step 2: Update DLQ record tracking replay
    if (job.deadLetterRecord) {
      await prisma.deadLetterRecord.update({
        where: { jobId },
        data: {
          replayCount: { increment: 1 },
          lastReplayedAt: new Date(),
          isResolved: false, // will resolve once job actually succeeds
        },
      });
    }

    // Step 3: Record audit log
    await AuditService.log(jobId, 'REPLAYED', 'ADMIN', actorId, {
      reason,
      resetAttempts,
      replayTimestamp: new Date().toISOString(),
    });

    // Step 4: Add back to BullMQ
    await jobQueue.add(
      job.type,
      {
        jobId: job.id,
        type: job.type,
        payload: job.payload,
        timeoutMs: job.timeoutMs,
        isReplay: true,
      },
      {
        jobId: `${job.id}-replay-${Date.now()}`, // new execution instance in BullMQ while preserving logical jobId
        priority: job.priority + 1, // boost priority on replay
        attempts: job.maxAttempts,
        backoff: {
          type: job.backoffType as any,
          delay: job.backoffDelayMs,
        },
      }
    );

    jobsEnqueuedTotal.inc({
      queue: job.queueName,
      job_type: job.type,
    });

    logger.info({ jobId, actorId, reason }, 'Job successfully re-enqueued for execution from DLQ');

    return {
      success: true,
      jobId,
      status: updatedJob.status,
      message: 'Job successfully scheduled for replay',
    };
  }
}
