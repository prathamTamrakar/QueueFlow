import { FailureSimJobPayload, JobExecutionResult } from '../../types';
import { RetryableError, NonRetryableError } from '../../errors';
import { prisma } from '../../database';
import { logger } from '../../logger';

export async function processFailureSimJob(
  jobId: string,
  payload: FailureSimJobPayload
): Promise<JobExecutionResult> {
  const startTime = Date.now();
  const failCountBeforeSuccess = payload.failCountBeforeSuccess ?? 2;
  const failType = payload.failType || 'RETRYABLE';
  const customMessage =
    payload.customErrorMessage || 'Simulated failure during upstream processing';

  // Count past attempts for this job in PostgreSQL
  const pastAttemptsCount = await prisma.jobAttempt.count({
    where: { jobId },
  });

  logger.info(
    { jobId, pastAttemptsCount, failCountBeforeSuccess, failType },
    'Processing failure simulation job'
  );

  // If we haven't failed enough times yet, fail this attempt
  if (pastAttemptsCount < failCountBeforeSuccess) {
    const attemptNumber = pastAttemptsCount + 1;
    const errorMsg = `${customMessage} (Attempt ${attemptNumber} of ${failCountBeforeSuccess} required failures)`;

    if (failType === 'PERMANENT') {
      logger.warn({ jobId, attemptNumber }, 'Simulating permanent non-retryable failure');
      throw new NonRetryableError(errorMsg, {
        failureType: 'PERMANENT',
        attemptNumber,
        fatal: true,
      });
    } else {
      logger.warn({ jobId, attemptNumber }, 'Simulating retryable transient failure');
      throw new RetryableError(errorMsg, {
        failureType: 'RETRYABLE',
        attemptNumber,
        transient: true,
      });
    }
  }

  // Once required failure attempts are completed, succeed!
  const durationMs = Date.now() - startTime;
  logger.info(
    { jobId, totalAttemptsRun: pastAttemptsCount + 1 },
    'Failure simulation recovered successfully on subsequent attempt'
  );

  return {
    success: true,
    data: {
      action: 'RECOVERY_SUCCEEDED',
      scenario: payload.scenario || 'transient_recovery',
      attemptsFailedFirst: pastAttemptsCount,
      succeededOnAttempt: pastAttemptsCount + 1,
      message: `Job recovered successfully after ${pastAttemptsCount} transient failures!`,
    },
    durationMs,
  };
}
