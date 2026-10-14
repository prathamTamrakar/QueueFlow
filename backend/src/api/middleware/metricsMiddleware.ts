import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration } from '../../metrics';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Ignore Prometheus scraper itself to prevent metrics skew
  if (req.path === '/metrics') {
    return next();
  }

  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;

    // Use route path pattern if available (e.g. /api/jobs/:id) to avoid high cardinality
    const routePattern = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : req.baseUrl || req.path;

    httpRequestDuration.observe(
      {
        method: req.method,
        route: routePattern,
        status_code: res.statusCode.toString(),
      },
      durationSeconds
    );
  });

  next();
}
