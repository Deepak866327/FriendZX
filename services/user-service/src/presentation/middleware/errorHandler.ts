import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../../../../shared/utils/logger';

const logger = new Logger('ErrorHandler');

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
};

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};