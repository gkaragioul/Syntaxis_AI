// @ts-nocheck

import { Request, Response, NextFunction } from 'express';
import { loggerUtils, correlationStorage } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Extend Request interface to include correlation data
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      requestId?: string;
      startTime?: number;
    }
  }
}

/**
 * Middleware to set up correlation context for request tracking
 * This should be one of the first middleware in the chain
 */
export const correlationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Generate or extract correlation ID
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['correlation-id'] as string) ||
    uuidv4();

  // Generate or extract request ID
  const requestId =
    (req.headers['x-request-id'] as string) ||
    (req.headers['request-id'] as string) ||
    uuidv4();

  // Extract session ID if available
  const sessionId =
    req.session?.id ||
    (req.headers['x-session-id'] as string) ||
    req.cookies?.sessionId;

  // Extract user ID if available (might be set by auth middleware later)
  const userId = req.user?.id;

  // Set up correlation context
  const context = {
    correlationId,
    requestId,
    userId,
    sessionId,
  };

  // Store in async local storage for the duration of this request
  correlationStorage.run(context, () => {
    // Add correlation data to request object
    req.correlationId = correlationId;
    req.requestId = requestId;
    req.startTime = Date.now();

    // Add correlation headers to response
    res.setHeader('X-Correlation-ID', correlationId);
    res.setHeader('X-Request-ID', requestId);

    // Continue to next middleware
    next();
  });
};

/**
 * Middleware to log request completion with performance metrics
 * This should be added after the correlation middleware
 */
export const requestLoggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startTime = req.startTime || Date.now();

  // Override res.end to capture response details
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any) {
    const responseTime = Date.now() - startTime;

    // Log the completed request
    loggerUtils.logApiRequest(req, res, responseTime);

    // Log slow requests
    loggerUtils.logSlowOperation(
      `${req.method} ${req.originalUrl}`,
      responseTime,
      1000, // 1 second threshold
      {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      },
    );

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Middleware to update correlation context when user is authenticated
 * This should be added after authentication middleware
 */
export const updateCorrelationWithUser = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.user?.id) {
    const currentContext = correlationStorage.getStore();
    if (currentContext) {
      // Update the context with user information
      const updatedContext = {
        ...currentContext,
        userId: req.user.id,
      };

      correlationStorage.enterWith(updatedContext);
    }
  }
  next();
};

/**
 * Error handling middleware that preserves correlation context
 */
export const correlationErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Log error with correlation context
  const logId = loggerUtils.logStructuredError(error, {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Add log ID to response headers for debugging
  res.setHeader('X-Error-Log-ID', logId);

  // Continue to next error handler
  next(error);
};

/**
 * Utility function to get correlation context from anywhere in the request lifecycle
 */
export const getCurrentCorrelationContext = () => {
  return correlationStorage.getStore();
};

/**
 * Utility function to run code with a specific correlation context
 */
export const runWithCorrelationContext = <T>(
  context: {
    correlationId: string;
    requestId?: string;
    userId?: string;
    sessionId?: string;
  },
  fn: () => T,
): T => {
  return correlationStorage.run(context, fn);
};

/**
 * Decorator for async functions to preserve correlation context
 */
export const withCorrelationContext = <
  T extends (...args: any[]) => Promise<any>,
>(
  fn: T,
): T => {
  return (async (...args: any[]) => {
    const context = correlationStorage.getStore();
    if (context) {
      return correlationStorage.run(context, () => fn(...args));
    }
    return fn(...args);
  }) as T;
};

/**
 * Performance monitoring middleware for specific routes
 */
export const performanceMonitoringMiddleware = (operationName?: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const operation =
      operationName || `${req.method} ${req.route?.path || req.originalUrl}`;
    const timer = loggerUtils.createTimer(operation, {
      method: req.method,
      url: req.originalUrl,
      route: req.route?.path,
    });

    // Store timer in request for potential use in route handlers
    (req as any).performanceTimer = timer;

    // Override res.end to capture timing
    const originalEnd = res.end;
    res.end = function (chunk?: any, encoding?: any) {
      timer.endIfSlow(500); // Log if slower than 500ms
      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
};

/**
 * Middleware to add structured logging for specific operations
 */
export const operationLoggingMiddleware = (operationType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const logId = loggerUtils.logSystemEvent(
      `${operationType} started`,
      'info',
      {
        method: req.method,
        url: req.originalUrl,
        operationType,
      },
    );

    // Store log ID for potential use in route handlers
    (req as any).operationLogId = logId;

    // Override res.end to log completion
    const originalEnd = res.end;
    res.end = function (chunk?: any, encoding?: any) {
      const success = res.statusCode < 400;
      loggerUtils.logSystemEvent(
        `${operationType} ${success ? 'completed' : 'failed'}`,
        success ? 'info' : 'warn',
        {
          method: req.method,
          url: req.originalUrl,
          operationType,
          statusCode: res.statusCode,
          success,
          originalLogId: logId,
        },
      );

      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
};

/**
 * Enhanced request/response logging middleware for debugging
 */
export const debugRequestResponseMiddleware = (
  options: {
    logRequestBody?: boolean;
    logResponseBody?: boolean;
    logHeaders?: boolean;
    maxBodySize?: number;
  } = {},
) => {
  const {
    logRequestBody = true,
    logResponseBody = false, // Usually too verbose
    logHeaders = true,
    maxBodySize = 10000, // 10KB limit
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Only enable in development
    if (process.env.NODE_ENV !== 'development') {
      return next();
    }

    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;

    // Log request details
    const requestLog: any = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    };

    if (logHeaders) {
      requestLog.headers = req.headers;
    }

    if (logRequestBody && req.body) {
      const bodyString = JSON.stringify(req.body);
      requestLog.body =
        bodyString.length > maxBodySize
          ? `${bodyString.substring(0, maxBodySize)}... [truncated]`
          : req.body;
    }

    loggerUtils.logSystemEvent('Request received', 'info', {
      category: 'debug-request',
      requestId,
      ...requestLog,
    });

    // Capture response details
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function (body: any) {
      const responseTime = Date.now() - startTime;

      const responseLog: any = {
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        contentType: res.get('Content-Type'),
        contentLength: res.get('Content-Length'),
      };

      if (logResponseBody && body) {
        const bodyString =
          typeof body === 'string' ? body : JSON.stringify(body);
        responseLog.body =
          bodyString.length > maxBodySize
            ? `${bodyString.substring(0, maxBodySize)}... [truncated]`
            : body;
      }

      loggerUtils.logSystemEvent('Response sent', 'info', {
        category: 'debug-response',
        requestId,
        ...responseLog,
      });

      return originalSend.call(this, body);
    };

    res.json = function (obj: any) {
      const responseTime = Date.now() - startTime;

      const responseLog: any = {
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        contentType: 'application/json',
      };

      if (logResponseBody && obj) {
        const bodyString = JSON.stringify(obj);
        responseLog.body =
          bodyString.length > maxBodySize
            ? `${bodyString.substring(0, maxBodySize)}... [truncated]`
            : obj;
      }

      loggerUtils.logSystemEvent('JSON response sent', 'info', {
        category: 'debug-response',
        requestId,
        ...responseLog,
      });

      return originalJson.call(this, obj);
    };

    next();
  };
};

export default {
  correlationMiddleware,
  requestLoggingMiddleware,
  updateCorrelationWithUser,
  correlationErrorHandler,
  getCurrentCorrelationContext,
  runWithCorrelationContext,
  withCorrelationContext,
  performanceMonitoringMiddleware,
  operationLoggingMiddleware,
  debugRequestResponseMiddleware,
};
