import { Request, Response, NextFunction } from 'express';
import { config } from '../../config';
import { UnauthorizedError } from '../../errors';

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const adminKey =
    req.headers['x-admin-key'] ||
    (req.headers['authorization']?.startsWith('Bearer ')
      ? req.headers['authorization'].slice(7)
      : undefined);

  if (!adminKey || adminKey !== config.auth.adminApiKey) {
    return next(new UnauthorizedError('Invalid or missing administrative API key'));
  }

  next();
}
