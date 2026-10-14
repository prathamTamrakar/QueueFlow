import { Request, Response, NextFunction } from 'express';
import { StatsService } from '../../services/stats.service';

export class QueuesController {
  public static async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await StatsService.getQueueStats();
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}
