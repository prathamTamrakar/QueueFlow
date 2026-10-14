import { prisma } from '../database';
import { jobQueue } from '../queues';
import { logger } from '../logger';
import { jobsEnqueuedTotal } from '../metrics';
import { AuditService } from './audit.service';
import { IdempotencyService } from './idempotency.service';
import { CreateJobInput } from '../types';
import { NotFoundError, AppError } from '../errors';

export class JobService {
  /**
   * Enqueues a new job with transactional database persistence and idempotency protection.
   */
  public static async createJob(
    input: CreateJobInput,
    idempotencyKey?: string,
    actorId = 'anonymous'
  ) {
    const queueName = input.queueName || 'default-jobs';
    const maxAttempts = input.maxAttempts ?? 3;
    const backoffType = input.backoffType || 'exponential';
    const backoffDelayMs = input.backoffDelayMs ?? 1000;
    const timeoutMs = input.timeoutMs ?? 30000;
    const priority = input.priority ?? 0;
    const delayMs = input.delayMs ?? 0;

    // Check idempotency first if key provided
    if (idempotencyKey) {
      const check = await IdempotencyService.check(idempotencyKey, input);
      if (check.isDuplicate && check.cachedResponse) {
        return {
          fromCache: true,
          job: check.cachedResponse.body.data,
          statusCode: check.cachedResponse.statusCode,
        };
      }
    }

    // Step 1: Create Job record in PostgreSQL
    const createdJob = await prisma.job.create({
      data: {
        type: input.type as any,
        queueName,
        payload: input.payload as any,
        priority,
        status: delayMs > 0 ? 'DELAYED' : 'PENDING',
        maxAttempts,
        backoffType,
        backoffDelayMs,
        timeoutMs,
      },
    });

    // Step 2: Audit log
    await AuditService.log(
      createdJob.id,
      'ENQUEUED',
      'API_USER',
      actorId,
      { queueName, priority, delayMs, maxAttempts }
    );

    // Step 3: Add to BullMQ queue
    try {
      const bullJob = await jobQueue.add(
        input.type,
        {
          jobId: createdJob.id,
          type: input.type,
          payload: input.payload,
          timeoutMs,
        },
        {
          jobId: createdJob.id, // Align BullMQ job ID with database UUID
          priority,
          attempts: maxAttempts,
          backoff: {
            type: backoffType,
            delay: backoffDelayMs,
          },
          delay: delayMs,
        }
      );

      // Update BullMQ ID in DB
      await prisma.job.update({
        where: { id: createdJob.id },
        data: { bullMqJobId: bullJob.id },
      });

      // Step 4: Record metrics
      jobsEnqueuedTotal.inc({
        queue: queueName,
        job_type: input.type,
      });

      const responsePayload = {
        id: createdJob.id,
        type: createdJob.type,
        queueName: createdJob.queueName,
        status: createdJob.status,
        priority: createdJob.priority,
        maxAttempts: createdJob.maxAttempts,
        payload: createdJob.payload,
        createdAt: createdJob.createdAt,
      };

      // Step 5: Store Idempotency record if key provided
      if (idempotencyKey) {
        await IdempotencyService.record(
          idempotencyKey,
          createdJob.id,
          input,
          201,
          { success: true, data: responsePayload }
        );
      }

      return {
        fromCache: false,
        job: responsePayload,
        statusCode: 201,
      };
    } catch (queueError) {
      logger.error({ queueError, jobId: createdJob.id }, 'Failed to enqueue job in BullMQ');
      // Mark as failed in DB if queue insertion failed
      await prisma.job.update({
        where: { id: createdJob.id },
        data: { status: 'FAILED' },
      });
      throw new AppError('Failed to dispatch job to queue broker', 500);
    }
  }

  /**
   * Retrieves job by ID with all related attempts, result, DLQ record, and audit history.
   */
  public static async getJobById(id: string) {
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        attempts: {
          orderBy: { attemptNumber: 'asc' },
        },
        result: true,
        deadLetterRecord: true,
        auditLogs: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundError(`Job with ID ${id} not found`);
    }

    return job;
  }

  /**
   * List jobs with pagination, filtering, and search.
   */
  public static async listJobs(query: {
    page: number;
    limit: number;
    status?: string;
    type?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, limit, status, type, search, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { bullMqJobId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, jobs] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          result: { select: { executionDurationMs: true } },
          attempts: {
            select: { id: true, attemptNumber: true, status: true, durationMs: true },
            orderBy: { attemptNumber: 'desc' },
            take: 1,
          },
          deadLetterRecord: { select: { id: true, isResolved: true } },
        },
      }),
    ]);

    return {
      jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Cancel an enqueued or active job.
   */
  public static async cancelJob(id: string, actorId = 'anonymous') {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundError(`Job with ID ${id} not found`);
    }

    if (job.status === 'COMPLETED') {
      throw new AppError('Cannot cancel a completed job', 400);
    }

    if (job.status === 'CANCELLED') {
      return job;
    }

    // Attempt to remove from BullMQ
    try {
      const bullJob = await jobQueue.getJob(id);
      if (bullJob) {
        await bullJob.remove();
      }
    } catch (err) {
      logger.warn({ err, id }, 'Could not remove job from BullMQ queue, proceeding with DB cancel');
    }

    const updated = await prisma.job.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await AuditService.log(id, 'CANCELLED', 'API_USER', actorId, {
      previousStatus: job.status,
    });

    return updated;
  }

  /**
   * Retrieve execution result for a completed job.
   */
  public static async getJobResult(id: string) {
    const job = await prisma.job.findUnique({
      where: { id },
      include: { result: true },
    });

    if (!job) {
      throw new NotFoundError(`Job with ID ${id} not found`);
    }

    if (job.status !== 'COMPLETED' || !job.result) {
      return {
        jobId: job.id,
        status: job.status,
        hasResult: false,
        message:
          job.status === 'FAILED'
            ? 'Job failed without successful result'
            : 'Job is still pending or executing',
      };
    }

    return {
      jobId: job.id,
      status: job.status,
      hasResult: true,
      result: job.result.data,
      executionDurationMs: job.result.executionDurationMs,
      completedAt: job.completedAt,
    };
  }
}
