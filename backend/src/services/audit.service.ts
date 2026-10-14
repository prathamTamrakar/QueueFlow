import { prisma } from '../database';
import { logger } from '../logger';
import { AuditActionType, ActorTypeType } from '../types';

export class AuditService {
  public static async log(
    jobId: string,
    action: AuditActionType,
    actor: ActorTypeType = 'SYSTEM',
    actorId?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.jobAuditLog.create({
        data: {
          jobId,
          action: action as any,
          actor: actor as any,
          actorId,
          details: (details as any) || undefined,
        },
      });
    } catch (error) {
      logger.error({ error, jobId, action }, 'Failed to record audit log');
    }
  }
}
