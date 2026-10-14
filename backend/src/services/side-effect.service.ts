import crypto from 'crypto';
import { prisma } from '../database';
import { logger } from '../logger';

export class SideEffectService {
  /**
   * Executes a side-effect function only once per deduplication key.
   * If already executed, returns the cached result/status without repeating side effects.
   */
  public static async executeIdempotent<T>(
    jobId: string,
    effectType: string,
    identifier: string,
    action: () => Promise<T>
  ): Promise<{ executed: boolean; result?: T }> {
    const hash = crypto.createHash('sha256').update(identifier).digest('hex');
    const dedupKey = `${effectType}:${jobId}:${hash}`;

    // Check if this side-effect was already recorded
    const existing = await prisma.sideEffectLog.findUnique({
      where: { dedupKey },
    });

    if (existing) {
      logger.info(
        { jobId, effectType, dedupKey },
        'Side-effect already executed previously; skipping duplicate execution'
      );
      return { executed: false };
    }

    // Execute the action
    const actionResult = await action();

    // Record that side-effect was completed
    try {
      await prisma.sideEffectLog.create({
        data: {
          dedupKey,
          jobId,
          effectType,
          recipient: identifier.length <= 100 ? identifier : undefined,
          status: 'COMPLETED',
        },
      });
    } catch (err: any) {
      // If unique constraint conflict, another concurrent worker executed it
      if (err.code === 'P2002') {
        logger.warn({ dedupKey }, 'Concurrent side-effect detected and recorded');
        return { executed: false };
      }
      throw err;
    }

    return { executed: true, result: actionResult };
  }
}
