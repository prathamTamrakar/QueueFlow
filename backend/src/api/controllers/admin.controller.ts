import { Request, Response, NextFunction } from 'express';
import { DLQService } from '../../services/dlq.service';
import { DLQQuerySchema, ReplayJobSchema } from '../../validation';

export class AdminController {
  public static async listFailedJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = DLQQuerySchema.parse(req.query);
      const result = await DLQService.listFailedJobs(query);

      res.status(200).json({
        success: true,
        data: result.records,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getFailedJobById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await DLQService.getFailedJobById(req.params.id);
      res.status(200).json({
        success: true,
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async replayFailedJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = ReplayJobSchema.parse(req.body || {});
      const actorId = (req.headers['x-admin-id'] as string) || 'admin-operator';

      const replayResult = await DLQService.replayJob(
        req.params.id,
        body.reason,
        actorId,
        body.resetAttempts
      );

      res.status(200).json({
        success: true,
        data: replayResult,
      });
    } catch (error) {
      next(error);
    }
  }
}
