import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../logger';

// Shared Redis connection for BullMQ
export const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
  enableReadyCheck: config.redis.enableReadyCheck,
  lazyConnect: true,
});

redisConnection.on('error', (err) => {
  logger.error({ err: err.message }, 'Redis connection error');
});

redisConnection.on('connect', () => {
  logger.info('Connected to Redis');
});

// Primary job queue
export const jobQueue = new Queue(config.queue.defaultQueueName, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: config.queue.defaultMaxAttempts,
    backoff: {
      type: 'exponential',
      delay: config.queue.defaultBackoffDelayMs,
    },
    removeOnComplete: {
      age: 86400, // keep completed jobs in Redis for 24h for stats/inspection
      count: 10000,
    },
    removeOnFail: {
      age: 86400 * 7, // keep failed jobs for 7 days
      count: 10000,
    },
  },
});

// Dedicated Dead-Letter Queue
export const dlqQueue = new Queue(config.queue.dlqQueueName, {
  connection: redisConnection,
});

let queueEventsInstance: QueueEvents | null = null;

export function getQueueEvents(): QueueEvents {
  if (!queueEventsInstance) {
    queueEventsInstance = new QueueEvents(config.queue.defaultQueueName, {
      connection: redisConnection,
    });
  }
  return queueEventsInstance;
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    if (redisConnection.status !== 'ready' && redisConnection.status !== 'connecting') {
      await redisConnection.connect();
    }
    const pong = await redisConnection.ping();
    return pong === 'PONG';
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    return false;
  }
}

export async function closeQueues(): Promise<void> {
  try {
    if (queueEventsInstance) {
      await queueEventsInstance.close();
      queueEventsInstance = null;
    }
    await jobQueue.close();
    await dlqQueue.close();
    await redisConnection.quit();
    logger.info('BullMQ queues and Redis connection closed cleanly');
  } catch (error) {
    logger.error({ error }, 'Error closing queues');
  }
}

