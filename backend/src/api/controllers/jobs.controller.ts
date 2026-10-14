import { Request, Response, NextFunction } from 'express';
import { CreateJobSchema, JobQuerySchema } from '../../validation';
import { JobService } from '../../services/job.service';

export class JobsController {
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = CreateJobSchema.parse(req.body);
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

      const result = await JobService.createJob(
        validatedInput as any,
        idempotencyKey,
        (req.headers['x-user-id'] as string) || 'api-user'
      );

      res.status(result.statusCode).json({
        success: true,
        cached: result.fromCache,
        data: result.job,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = JobQuerySchema.parse(req.query);
      const result = await JobService.listJobs(query as any);

      res.status(200).json({
        success: true,
        data: result.jobs,
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

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await JobService.getJobById(req.params.id);
      res.status(200).json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await JobService.getJobResult(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cancelledJob = await JobService.cancelJob(
        req.params.id,
        (req.headers['x-user-id'] as string) || 'api-user'
      );

      res.status(200).json({
        success: true,
        message: 'Job cancelled successfully',
        data: cancelledJob,
      });
    } catch (error) {
      next(error);
    }
  }
}
