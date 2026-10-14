import { Request, Response } from 'express';
import { checkDatabaseHealth } from '../../database';
import { checkRedisHealth } from '../../queues';
import { register } from '../../metrics';

export class HealthController {
  public static liveness(_req: Request, res: Response): void {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }

  public static async readiness(_req: Request, res: Response): Promise<void> {
    const [dbHealthy, redisHealthy] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const isReady = dbHealthy && redisHealthy;

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'READY' : 'DEGRADED',
      services: {
        database: dbHealthy ? 'UP' : 'DOWN',
        redis: redisHealthy ? 'UP' : 'DOWN',
      },
      timestamp: new Date().toISOString(),
    });
  }

  public static async metrics(_req: Request, res: Response): Promise<void> {
    try {
      res.set('Content-Type', register.contentType);
      const metricsData = await register.metrics();
      res.end(metricsData);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  }
}
