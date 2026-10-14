import { z } from 'zod';

export const EmailPayloadSchema = z.object({
  recipient: z.string().email(),
  subject: z.string().min(1).max(255),
  template: z.string().optional(),
  body: z.string().optional(),
  context: z.record(z.any()).optional(),
});

export const PdfPayloadSchema = z.object({
  reportId: z.string().min(1),
  title: z.string().min(1).max(255),
  pages: z.number().int().min(1).max(500).default(5),
  includeCharts: z.boolean().default(true),
});

export const CpuLightPayloadSchema = z.object({
  taskName: z.string().min(1).max(100),
  recordsCount: z.number().int().min(1).max(100000).default(1000),
  algorithm: z.enum(['sha256', 'sha512', 'md5']).default('sha256'),
});

export const FailureSimPayloadSchema = z.object({
  scenario: z.string().optional().default('network_timeout'),
  failCountBeforeSuccess: z.number().int().min(0).max(10).default(2),
  failType: z.enum(['RETRYABLE', 'PERMANENT']).default('RETRYABLE'),
  customErrorMessage: z.string().optional(),
});

export const CreateJobSchema = z.object({
  type: z.enum([
    'EMAIL_SIMULATION',
    'PDF_GENERATION',
    'CPU_LIGHT_PROCESSING',
    'FAILURE_SIMULATION',
  ]),
  payload: z.record(z.any()),
  priority: z.number().int().min(-20).max(20).default(0),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  backoffType: z.enum(['exponential', 'fixed']).default('exponential'),
  backoffDelayMs: z.number().int().min(100).max(60000).default(1000),
  timeoutMs: z.number().int().min(500).max(120000).default(30000),
  delayMs: z.number().int().min(0).max(86400000).default(0),
  queueName: z.string().optional().default('default-jobs'),
}).superRefine((data, ctx) => {
  if (data.type === 'EMAIL_SIMULATION') {
    const res = EmailPayloadSchema.safeParse(data.payload);
    if (!res.success) {
      res.error.issues.forEach((issue) => ctx.addIssue({ ...issue, path: ['payload', ...issue.path] }));
    }
  } else if (data.type === 'PDF_GENERATION') {
    const res = PdfPayloadSchema.safeParse(data.payload);
    if (!res.success) {
      res.error.issues.forEach((issue) => ctx.addIssue({ ...issue, path: ['payload', ...issue.path] }));
    }
  } else if (data.type === 'CPU_LIGHT_PROCESSING') {
    const res = CpuLightPayloadSchema.safeParse(data.payload);
    if (!res.success) {
      res.error.issues.forEach((issue) => ctx.addIssue({ ...issue, path: ['payload', ...issue.path] }));
    }
  } else if (data.type === 'FAILURE_SIMULATION') {
    const res = FailureSimPayloadSchema.safeParse(data.payload);
    if (!res.success) {
      res.error.issues.forEach((issue) => ctx.addIssue({ ...issue, path: ['payload', ...issue.path] }));
    }
  }
});

export const JobQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'FAILED', 'DELAYED', 'CANCELLED']).optional(),
  type: z.enum(['EMAIL_SIMULATION', 'PDF_GENERATION', 'CPU_LIGHT_PROCESSING', 'FAILURE_SIMULATION']).optional(),
  search: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const DLQQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isResolved: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export const ReplayJobSchema = z.object({
  reason: z.string().min(1).max(255).optional().default('Admin manual replay triggered'),
  resetAttempts: z.boolean().default(true),
});
