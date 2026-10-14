import { Worker } from 'bullmq';
import { redisConnection } from '../queues';
import { config } from '../config';
import { logger } from '../logger';
import { processJob, WORKER_ID } from './processor';
import { workerActiveCount } from '../metrics';
import { disconnectDatabase } from '../database';

export class JobWorker {
  private worker: Worker | null = null;
  private isShuttingDown = false;

  public async start(): Promise<Worker> {
    logger.info(
      {
        workerId: WORKER_ID,
        queue: config.queue.defaultQueueName,
        concurrency: config.queue.concurrency,
        rateLimit: config.queue.limiter,
      },
      'Initializing BullMQ Worker process'
    );

    this.worker = new Worker(
      config.queue.defaultQueueName,
      async (job) => {
        workerActiveCount.inc({ worker_id: WORKER_ID });
        try {
          return await processJob(job);
        } finally {
          workerActiveCount.dec({ worker_id: WORKER_ID });
        }
      },
      {
        connection: redisConnection,
        concurrency: config.queue.concurrency,
        limiter: {
          max: config.queue.limiter.max,
          duration: config.queue.limiter.duration,
        },
        lockDuration: 30000, // 30s lock duration for stalled-job detection
        maxStalledCount: 2, // Recover stalled jobs up to 2 times
      }
    );

    this.worker.on('active', (job) => {
      logger.debug({ jobId: job.id, type: job.name }, 'Job became active in worker');
    });

    this.worker.on('completed', (job) => {
      logger.info({ jobId: job.id, type: job.name }, 'Job completed in worker');
    });

    this.worker.on('failed', (job, err) => {
      logger.warn({ jobId: job?.id, type: job?.name, error: err.message }, 'Job failed in worker');
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn({ jobId }, 'Job was detected as stalled; worker recovering execution');
    });

    this.worker.on('error', (err) => {
      logger.error({ error: err.message }, 'BullMQ Worker encountered an error');
    });

    logger.info({ workerId: WORKER_ID }, 'BullMQ Worker is running and listening for jobs');
    return this.worker;
  }

  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info({ workerId: WORKER_ID }, 'Initiating graceful worker shutdown...');

    if (this.worker) {
      await this.worker.close();
      logger.info('BullMQ worker closed all active job slots cleanly');
    }

    await disconnectDatabase();
    await redisConnection.quit();
    logger.info('Worker shutdown completed successfully');
  }
}

// Dedicated worker process entry point
if (require.main === module) {
  const runner = new JobWorker();

  const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
  shutdownSignals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down worker...`);
      await runner.shutdown();
      process.exit(0);
    });
  });

  runner.start().catch((err) => {
    logger.error({ err }, 'Fatal error starting JobWorker process');
    process.exit(1);
  });
}
