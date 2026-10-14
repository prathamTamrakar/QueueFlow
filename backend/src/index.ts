import { startServer } from './api/server';
import { JobWorker } from './workers/worker';
import { logger } from './logger';

async function main() {
  logger.info('Starting QueueFlow unified system (API + Worker dual mode)...');

  // 1. Start API Server
  startServer();

  // 2. Start Worker background processor
  const workerInstance = new JobWorker();
  await workerInstance.start();
}

if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, 'Fatal error starting QueueFlow');
    process.exit(1);
  });
}
