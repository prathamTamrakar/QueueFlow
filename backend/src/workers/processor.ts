import { Job as BullJob, UnrecoverableError } from 'bullmq';
import { prisma } from '../database';
import { logger } from '../logger';
import {
  jobsCompletedTotal,
  jobsFailedTotal,
  jobsRetriedTotal,
  jobProcessingDuration,
} from '../metrics';
import { AuditService } from '../services/audit.service';
import { DLQService } from '../services/dlq.service';
import { NonRetryableError, JobTimeoutError } from '../errors';
import { processEmailJob } from './handlers/email.handler';
import { processPdfJob } from './handlers/pdf.handler';
import { processCpuLightJob } from './handlers/cpu-light.handler';
import { processFailureSimJob } from './handlers/failure-sim.handler';
import { JobExecutionResult } from '../types';

export const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;

export async function processJob(bullJob: BullJob): Promise<JobExecutionResult> {
  const { jobId, type, payload, timeoutMs = 30000 } = bullJob.data;
  const attemptNumber = bullJob.attemptsMade + 1;
  const startTime = Date.now();

  logger.info(
    { jobId, type, attemptNumber, workerId: WORKER_ID },
    `Starting job processing attempt #${attemptNumber}`
  );

  // 1. Record Attempt Start in DB
  const attemptRecord = await prisma.jobAttempt.create({
    data: {
      jobId,
      attemptNumber,
      status: 'RUNNING',
      workerId: WORKER_ID,
      startedAt: new Date(),
    },
  });

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'ACTIVE',
      attemptCount: attemptNumber,
      startedAt: new Date(),
    },
  });

  await AuditService.log(jobId, 'ATTEMPT_STARTED', 'WORKER', WORKER_ID, {
    attemptNumber,
    bullMqJobId: bullJob.id,
  });

  // 2. Timeout Wrapper
  const executionPromise = (async () => {
    switch (type) {
      case 'EMAIL_SIMULATION':
        return await processEmailJob(jobId, payload);
      case 'PDF_GENERATION':
        return await processPdfJob(jobId, payload);
      case 'CPU_LIGHT_PROCESSING':
        return await processCpuLightJob(jobId, payload);
      case 'FAILURE_SIMULATION':
        return await processFailureSimJob(jobId, payload);
      default:
        throw new NonRetryableError(`Unknown job type: ${type}`);
    }
  })();

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new JobTimeoutError(`Job exceeded timeout limit of ${timeoutMs}ms`));
    }, timeoutMs);
    executionPromise.finally(() => clearTimeout(timer)).catch(() => {});
  });

  try {
    const result = await Promise.race([executionPromise, timeoutPromise]);
    const durationMs = Date.now() - startTime;
    const durationSeconds = durationMs / 1000;

    // 3. Mark Attempt as SUCCESS
    await prisma.jobAttempt.update({
      where: { id: attemptRecord.id },
      data: {
        status: 'SUCCESS',
        durationMs,
        finishedAt: new Date(),
      },
    });

    // 4. Save Job Result
    await prisma.jobResult.upsert({
      where: { jobId },
      create: {
        jobId,
        data: result.data as any,
        executionDurationMs: durationMs,
      },
      update: {
        data: result.data as any,
        executionDurationMs: durationMs,
      },
    });

    // 5. Update Job status to COMPLETED
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // 6. Resolve DLQ record if this was a recovered job
    await prisma.deadLetterRecord.updateMany({
      where: { jobId, isResolved: false },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: 'worker-automatic-recovery',
      },
    });

    await AuditService.log(jobId, 'ATTEMPT_SUCCEEDED', 'WORKER', WORKER_ID, {
      attemptNumber,
      durationMs,
    });

    // Prometheus Metrics
    jobsCompletedTotal.inc({
      queue: bullJob.queueName,
      job_type: type,
    });
    jobProcessingDuration.observe(
      { queue: bullJob.queueName, job_type: type, status: 'success' },
      durationSeconds
    );

    logger.info({ jobId, type, attemptNumber, durationMs }, 'Job completed successfully');
    return result;
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const durationSeconds = durationMs / 1000;
    const isNonRetryable = error instanceof NonRetryableError || error.name === 'NonRetryableError';
    const maxAttempts = bullJob.opts.attempts || 3;
    const isFinalAttempt = isNonRetryable || attemptNumber >= maxAttempts;

    logger.error(
      {
        jobId,
        type,
        attemptNumber,
        isNonRetryable,
        isFinalAttempt,
        error: error.message,
      },
      'Job processing attempt failed'
    );

    // Update Attempt Record with Failure details
    await prisma.jobAttempt.update({
      where: { id: attemptRecord.id },
      data: {
        status: 'FAILED',
        errorName: error.name || 'Error',
        errorMessage: error.message || 'Unknown error occurred',
        errorStack: error.stack,
        isRetryable: !isNonRetryable,
        durationMs,
        finishedAt: new Date(),
      },
    });

    await AuditService.log(jobId, 'ATTEMPT_FAILED', 'WORKER', WORKER_ID, {
      attemptNumber,
      errorName: error.name,
      errorMessage: error.message,
      isRetryable: !isNonRetryable,
      isFinalAttempt,
    });

    // Metrics
    jobsFailedTotal.inc({
      queue: bullJob.queueName,
      job_type: type,
      is_final: String(isFinalAttempt),
    });
    jobProcessingDuration.observe(
      { queue: bullJob.queueName, job_type: type, status: 'failed' },
      durationSeconds
    );

    if (isFinalAttempt) {
      // Mark permanently failed in DB and move to DLQ
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
        },
      });

      await DLQService.recordToDLQ(
        jobId,
        payload,
        error.message,
        {
          errorName: error.name,
          errorStack: error.stack,
          attemptsRun: attemptNumber,
          isNonRetryable,
        },
        attemptNumber
      );

      // If non-retryable, abort BullMQ retry cycle immediately
      if (isNonRetryable) {
        throw new UnrecoverableError(
          `Non-retryable error encountered: ${error.message}`
        );
      }
    } else {
      // Retryable transient error: log retry event
      await AuditService.log(jobId, 'RETRIED', 'SYSTEM', undefined, {
        nextAttempt: attemptNumber + 1,
        maxAttempts,
      });

      jobsRetriedTotal.inc({
        queue: bullJob.queueName,
        job_type: type,
      });
    }

    // Rethrow to trigger BullMQ backoff mechanism
    throw error;
  }
}
