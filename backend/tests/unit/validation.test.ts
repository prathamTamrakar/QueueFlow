import { describe, it, expect } from 'vitest';
import {
  CreateJobSchema,
  EmailPayloadSchema,
  PdfPayloadSchema,
  CpuLightPayloadSchema,
  FailureSimPayloadSchema,
} from '../../src/validation';

describe('Validation Schemas (Zod)', () => {
  describe('EmailPayloadSchema', () => {
    it('accepts valid email payload', () => {
      const valid = {
        recipient: 'test@example.com',
        subject: 'Notification',
        template: 'tpl_123',
      };
      const result = EmailPayloadSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid email address', () => {
      const invalid = {
        recipient: 'not-an-email',
        subject: 'Notification',
      };
      const result = EmailPayloadSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('PdfPayloadSchema', () => {
    it('accepts valid PDF payload with defaults', () => {
      const valid = {
        reportId: 'rep_101',
        title: 'Monthly Analytics',
      };
      const result = PdfPayloadSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pages).toBe(5);
        expect(result.data.includeCharts).toBe(true);
      }
    });

    it('rejects page count above 500', () => {
      const invalid = {
        reportId: 'rep_101',
        title: 'Analytics',
        pages: 1000,
      };
      const result = PdfPayloadSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('CpuLightPayloadSchema', () => {
    it('accepts valid CPU payload', () => {
      const valid = {
        taskName: 'hash_block',
        recordsCount: 500,
        algorithm: 'sha256',
      };
      const result = CpuLightPayloadSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid algorithm', () => {
      const invalid = {
        taskName: 'hash_block',
        algorithm: 'rot13',
      };
      const result = CpuLightPayloadSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('FailureSimPayloadSchema', () => {
    it('validates default retryable failure scenario', () => {
      const valid = {
        scenario: 'flaky_api',
        failCountBeforeSuccess: 2,
        failType: 'RETRYABLE',
      };
      const result = FailureSimPayloadSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('CreateJobSchema', () => {
    it('validates complete job creation payload', () => {
      const jobInput = {
        type: 'EMAIL_SIMULATION',
        payload: {
          recipient: 'user@company.com',
          subject: 'Hello from QueueFlow',
        },
        priority: 5,
        maxAttempts: 3,
        backoffDelayMs: 1500,
      };

      const result = CreateJobSchema.safeParse(jobInput);
      expect(result.success).toBe(true);
    });

    it('rejects when payload does not match job type', () => {
      const mismatched = {
        type: 'EMAIL_SIMULATION',
        payload: {
          reportId: 'rep_123', // Missing recipient and subject!
        },
      };

      const result = CreateJobSchema.safeParse(mismatched);
      expect(result.success).toBe(false);
    });
  });
});
