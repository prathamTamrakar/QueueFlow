import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'http';
import { config } from '../config';
import { logger } from '../logger';
import { disconnectDatabase } from '../database';
import { closeQueues } from '../queues';
import { metricsMiddleware } from './middleware/metricsMiddleware';
import { errorHandler } from './middleware/errorHandler';

import jobsRoutes from './routes/jobs.routes';
import adminRoutes from './routes/admin.routes';
import queuesRoutes from './routes/queues.routes';
import healthRoutes from './routes/health.routes';

export function createServer(): express.Application {
  const app = express();

  // Security and utilities
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Prometheus request latency tracking
  app.use(metricsMiddleware);

  // Health and observability endpoints (root level)
  app.use('/', healthRoutes);

  // API router endpoints
  app.use('/api/jobs', jobsRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/queues', queuesRoutes);

  // Fallback 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Requested endpoint does not exist' },
    });
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}

export function startServer(port = config.port): Server {
  const app = createServer();
  const server = app.listen(port, config.host, () => {
    logger.info(`🚀 QueueFlow REST API server listening on http://${config.host}:${port}`);
    logger.info(`📊 Prometheus metrics available at http://${config.host}:${port}/metrics`);
    logger.info(`🩺 Health check available at http://${config.host}:${port}/health`);
  });

  // Graceful shutdown handling
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}, commencing graceful API shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed');
      await closeQueues();
      await disconnectDatabase();
      logger.info('All connections terminated. Exiting process.');
      process.exit(0);
    });

    // Force close after 10 seconds if graceful cleanup hangs
    setTimeout(() => {
      logger.error('Forced shutdown after timeout expiration');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  return server;
}

if (require.main === module) {
  startServer();
}
