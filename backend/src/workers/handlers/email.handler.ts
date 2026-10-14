import crypto from 'crypto';
import { EmailJobPayload, JobExecutionResult } from '../../types';
import { SideEffectService } from '../../services/side-effect.service';
import { logger } from '../../logger';

export async function processEmailJob(
  jobId: string,
  payload: EmailJobPayload
): Promise<JobExecutionResult> {
  const startTime = Date.now();
  logger.info({ jobId, recipient: payload.recipient }, 'Processing email dispatch simulation');

  // Idempotent side-effect execution: guarantees email is not sent twice
  const sideEffect = await SideEffectService.executeIdempotent(
    jobId,
    'EMAIL_DISPATCH',
    payload.recipient,
    async () => {
      // Simulate network / SMTP latency (150ms - 300ms)
      const simulatedDelay = 150 + Math.floor(Math.random() * 150);
      await new Promise((resolve) => setTimeout(resolve, simulatedDelay));

      const messageId = `msg_${crypto.randomBytes(8).toString('hex')}`;
      return {
        messageId,
        provider: 'QueueFlow-Mock-SMTP',
        recipient: payload.recipient,
        subject: payload.subject,
        smtpResponse: `250 2.0.0 OK queued as ${messageId}`,
      };
    }
  );

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    data: {
      action: 'EMAIL_DISPATCHED',
      sideEffectExecuted: sideEffect.executed,
      details: sideEffect.result || { cached: true, recipient: payload.recipient },
    },
    durationMs,
  };
}
