import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',

  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/queueflow?schema=public',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
  },

  queue: {
    defaultQueueName: process.env.QUEUE_NAME || 'default-jobs',
    dlqQueueName: process.env.DLQ_QUEUE_NAME || 'dead-letter-jobs',
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    limiter: {
      max: parseInt(process.env.QUEUE_RATE_MAX || '100', 10),
      duration: parseInt(process.env.QUEUE_RATE_DURATION_MS || '1000', 10),
    },
    defaultMaxAttempts: parseInt(process.env.DEFAULT_MAX_ATTEMPTS || '3', 10),
    defaultBackoffDelayMs: parseInt(process.env.DEFAULT_BACKOFF_DELAY_MS || '1000', 10),
    defaultTimeoutMs: parseInt(process.env.DEFAULT_JOB_TIMEOUT_MS || '30000', 10),
  },

  auth: {
    adminApiKey: process.env.ADMIN_API_KEY || 'queueflow-admin-secret-key-123',
  },

  idempotency: {
    ttlHours: parseInt(process.env.IDEMPOTENCY_TTL_HOURS || '24', 10),
  },

  metrics: {
    prefix: 'queueflow_',
  },
};
