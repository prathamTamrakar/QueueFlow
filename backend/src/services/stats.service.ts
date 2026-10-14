import { prisma } from '../database';
import { jobQueue, redisConnection } from '../queues';
import { config } from '../config';
import { queueDepth, workerActiveCount } from '../metrics';

export class StatsService {
  /**
   * Retrieves high-level queue metrics combining BullMQ and PostgreSQL state.
   */
  public static async getQueueStats() {
    // 1. Get real-time job counts directly from BullMQ Redis
    let bullCounts: Record<string, number> = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    };

    try {
      const counts = await jobQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
        'paused'
      );
      bullCounts = counts;

      // Update Prometheus queue_depth gauges
      queueDepth.set({ queue: config.queue.defaultQueueName, state: 'waiting' }, bullCounts.waiting);
      queueDepth.set({ queue: config.queue.defaultQueueName, state: 'active' }, bullCounts.active);
      queueDepth.set({ queue: config.queue.defaultQueueName, state: 'completed' }, bullCounts.completed);
      queueDepth.set({ queue: config.queue.defaultQueueName, state: 'failed' }, bullCounts.failed);
      queueDepth.set({ queue: config.queue.defaultQueueName, state: 'delayed' }, bullCounts.delayed);
    } catch {
      // Redis might be disconnected in standalone mode
    }

    // 2. Get database counts for canonical audit state
    const [dbCountsByStatus, dlqCount, totalDbJobs] = await Promise.all([
      prisma.job.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.deadLetterRecord.count({ where: { isResolved: false } }),
      prisma.job.count(),
    ]);

    const statusMap: Record<string, number> = {
      PENDING: 0,
      ACTIVE: 0,
      COMPLETED: 0,
      FAILED: 0,
      DELAYED: 0,
      CANCELLED: 0,
    };

    dbCountsByStatus.forEach((item) => {
      statusMap[item.status] = item._count.id;
    });

    const completed = statusMap.COMPLETED || 0;
    const failed = statusMap.FAILED || 0;
    const totalFinished = completed + failed;
    const successRate = totalFinished > 0 ? Number(((completed / totalFinished) * 100).toFixed(2)) : 100.0;
    const failureRate = totalFinished > 0 ? Number(((failed / totalFinished) * 100).toFixed(2)) : 0.0;

    // 3. Calculate latency percentiles (p50, p95, p99) from completed job results
    const recentDurations = await prisma.jobResult.findMany({
      select: { executionDurationMs: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const latencies = recentDurations
      .map((r) => r.executionDurationMs)
      .sort((a, b) => a - b);

    const getPercentile = (p: number) => {
      if (latencies.length === 0) return 0;
      const index = Math.ceil((p / 100) * latencies.length) - 1;
      return latencies[Math.max(0, index)];
    };

    const latencyPercentiles = {
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99),
      sampleSize: latencies.length,
    };

    // 4. Worker health and concurrency info
    const workerInfo = {
      concurrency: config.queue.concurrency,
      queueName: config.queue.defaultQueueName,
      rateLimitMax: config.queue.limiter.max,
      rateLimitDurationMs: config.queue.limiter.duration,
      redisConnected: redisConnection.status === 'ready' || redisConnection.status === 'connect',
    };

    return {
      bullMq: bullCounts,
      database: {
        totalJobs: totalDbJobs,
        byStatus: statusMap,
        unresolvedDlqCount: dlqCount,
      },
      performance: {
        successRate,
        failureRate,
        latencyPercentiles,
      },
      worker: workerInfo,
      timestamp: new Date().toISOString(),
    };
  }
}
