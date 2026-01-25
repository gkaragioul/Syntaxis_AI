import { Request, Response, NextFunction } from 'express';

export const rateLimitMiddleware = (
  name: string | { windowMs: number; max: number },
  maxRequests?: number,
  windowMs?: number,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Simple rate limiting middleware for testing
    next();
  };
};

export const rateLimit = rateLimitMiddleware;
