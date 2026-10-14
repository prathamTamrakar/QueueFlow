import crypto from 'crypto';
import { CpuLightJobPayload, JobExecutionResult } from '../../types';
import { logger } from '../../logger';

export async function processCpuLightJob(
  jobId: string,
  payload: CpuLightJobPayload
): Promise<JobExecutionResult> {
  const startTime = Date.now();
  logger.info({ jobId, taskName: payload.taskName }, 'Processing CPU-light workload');

  const count = payload.recordsCount || 1000;
  const algo = payload.algorithm || 'sha256';

  let lastHash = '';
  for (let i = 0; i < count; i++) {
    lastHash = crypto.createHash(algo).update(`${jobId}-${i}-${lastHash}`).digest('hex');
  }

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    data: {
      action: 'CPU_WORKLOAD_COMPLETED',
      taskName: payload.taskName,
      processedRecords: count,
      finalDigest: lastHash,
      algorithm: algo,
    },
    durationMs,
  };
}
