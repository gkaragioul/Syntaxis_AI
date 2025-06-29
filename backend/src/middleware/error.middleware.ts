import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export class ErrorHandler {
  static handle(err: Error, req: Request, res: Response, next: NextFunction) {
    // Log error
    logger.error('Error occurred', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      requestId: req.headers['x-request-id'],
    });

    // Handle known error types
    if (err instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message,
          details: {
            field: err.field,
            value: err.value,
          },
        },
      });
    }

    // Handle Prisma errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle unique constraint violations
      if (err.code === 'P2002') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_ENTRY',
            message: 'A record with this value already exists',
            details: {
              field: err.meta?.target,
            },
          },
        });
      }

      // Handle record not found
      if (err.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'The requested record was not found',
          },
        });
      }

      // Handle foreign key constraint violations
      if (err.code === 'P2003') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'FOREIGN_KEY_CONSTRAINT',
            message:
              'Cannot delete or update this record due to existing references',
          },
        });
      }
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
        },
      });
    }

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired',
        },
      });
    }

    // Handle rate limit errors
    if (err.name === 'RateLimitExceeded') {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          details: {
            retryAfter: err.retryAfter,
          },
        },
      });
    }

    // Handle file upload errors
    if (err.name === 'MulterError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_UPLOAD_ERROR',
          message: err.message,
        },
      });
    }

    // Handle unknown errors
    const isDevelopment = process.env.NODE_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: isDevelopment ? err.message : 'An unexpected error occurred',
        ...(isDevelopment && { stack: err.stack }),
      },
    });
  }

  static notFound(req: Request, res: Response) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Cannot ${req.method} ${req.path}`,
      },
    });
  }

  static asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
  ) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

// Extend Error class for rate limit errors
export class RateLimitExceeded extends Error {
  retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitExceeded';
    this.retryAfter = retryAfter;
  }
}

// Export middleware functions
export const errorHandler = ErrorHandler.handle;
export const notFoundHandler = ErrorHandler.notFound;
export const asyncHandler = ErrorHandler.asyncHandler;
