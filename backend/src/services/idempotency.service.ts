import crypto from 'crypto';
import { prisma } from '../database';
import { config } from '../config';
import { logger } from '../logger';
import { IdempotencyConflictError } from '../errors';
import { idempotencyConflictsTotal } from '../metrics';

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  cachedResponse?: {
    statusCode: number;
    body: any;
  };
}

export class IdempotencyService {
  /**
   * Generates a deterministic SHA256 hash of the request payload.
   */
  public static hashPayload(payload: unknown): string {
    const serialized = JSON.stringify(payload || {}, Object.keys(payload || {}).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Checks if an idempotency key exists.
   * If exists and hash matches: returns cached response.
   * If exists and hash differs: throws IdempotencyConflictError.
   * If not exists: returns isDuplicate = false.
   */
  public static async check(
    key: string,
    payload: unknown
  ): Promise<IdempotencyCheckResult> {
    const record = await prisma.idempotencyRecord.findUnique({
      where: { key },
    });

    if (!record) {
      return { isDuplicate: false };
    }

    // Check expiration
    if (new Date() > record.expiresAt) {
      logger.info({ key }, 'Idempotency record expired; removing old record');
      await prisma.idempotencyRecord.delete({ where: { key } });
      return { isDuplicate: false };
    }

    const currentHash = this.hashPayload(payload);
    if (record.requestHash !== currentHash) {
      idempotencyConflictsTotal.inc();
      logger.warn(
        { key, expectedHash: record.requestHash, gotHash: currentHash },
        'Idempotency key reused with mismatched request payload'
      );
      throw new IdempotencyConflictError(
        'Idempotency key already used with a different request payload'
      );
    }

    idempotencyConflictsTotal.inc();
    logger.info({ key, jobId: record.jobId }, 'Returning cached idempotent response');

    return {
      isDuplicate: true,
      cachedResponse: {
        statusCode: record.responseStatus,
        body: record.responseBody,
      },
    };
  }

  /**
   * Stores an idempotency record atomically.
   */
  public static async record(
    key: string,
    jobId: string,
    payload: unknown,
    statusCode: number,
    responseBody: unknown
  ): Promise<void> {
    const requestHash = this.hashPayload(payload);
    const expiresAt = new Date(Date.now() + config.idempotency.ttlHours * 3600000);

    try {
      await prisma.idempotencyRecord.upsert({
        where: { key },
        create: {
          key,
          jobId,
          requestHash,
          responseStatus: statusCode,
          responseBody: responseBody as any,
          expiresAt,
        },
        update: {
          jobId,
          responseStatus: statusCode,
          responseBody: responseBody as any,
        },
      });
    } catch (err) {
      logger.error({ err, key, jobId }, 'Failed to save idempotency record');
    }
  }
}
