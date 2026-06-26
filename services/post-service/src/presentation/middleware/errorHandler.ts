import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../../../../shared/utils/logger';

const logger = new Logger('PostService');

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  (req as any).userId = userId;
  next();
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found', source: 'post-service' });
};

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: err.message || 'Internal server error' });
};
