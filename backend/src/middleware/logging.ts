import { Request, Response, NextFunction } from 'express';
import { loggerUtils } from '../utils/logger';

// Extend Request interface to include timing and logging context
declare global {
  namespace Express {
    interface Request {
      startTime?: number;
      logId?: string;
      requestId?: string;
    }
  }
}

// Generate unique request ID
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Request logging middleware
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Set request start time
  req.startTime = Date.now();
  
  // Generate request ID if not provided
  req.requestId = req.headers['x-request-id'] as string || generateRequestId();
  
  // Set request ID in response headers
  res.setHeader('X-Request-ID', req.requestId);

  // Log request start
  req.logId = loggerUtils.logApiRequest(req, res);

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const responseTime = req.startTime ? Date.now() - req.startTime : undefined;
    
    // Log API response
    loggerUtils.logApiRequest(req, res, responseTime);
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Error logging middleware
export const errorLoggingMiddleware = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error with context
  const logId = loggerUtils.logError(error, {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Add log ID to error for tracking
  error.logId = logId;

  next(error);
};

// Performance monitoring middleware
export const performanceLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    // Log slow requests (> 1 second)
    if (responseTime > 1000) {
      loggerUtils.logPerformance('slow_request', responseTime, 'ms', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        userId: req.user?.id,
      });
    }

    // Log performance metrics for all requests
    loggerUtils.logPerformance('request_duration', responseTime, 'ms', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
    });
  });

  next();
};

// Security event logging middleware
export const securityLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Log suspicious activities
  const suspiciousPatterns = [
    /\.\.\//,  // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript injection
  ];

  const checkSuspicious = (value: string): boolean => {
    return suspiciousPatterns.some(pattern => pattern.test(value));
  };

  // Check URL for suspicious patterns
  if (checkSuspicious(req.originalUrl)) {
    loggerUtils.logSecurityEvent('suspicious_url', 'medium', {
      requestId: req.requestId,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  // Check request body for suspicious patterns
  if (req.body && typeof req.body === 'object') {
    const bodyString = JSON.stringify(req.body);
    if (checkSuspicious(bodyString)) {
      loggerUtils.logSecurityEvent('suspicious_payload', 'medium', {
        requestId: req.requestId,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        bodySize: bodyString.length,
      });
    }
  }

  // Log failed authentication attempts
  res.on('finish', () => {
    if (res.statusCode === 401 && req.originalUrl.includes('/auth/')) {
      loggerUtils.logSecurityEvent('failed_authentication', 'low', {
        requestId: req.requestId,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        email: req.body?.email,
      });
    }

    // Log rate limit violations
    if (res.statusCode === 429) {
      loggerUtils.logSecurityEvent('rate_limit_exceeded', 'medium', {
        requestId: req.requestId,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
    }
  });

  next();
};

// Business event logging middleware
export const businessLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.on('finish', () => {
    // Log successful business operations
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const businessEvents: { [key: string]: string } = {
        'POST /api/v1/auth/register': 'user_registered',
        'POST /api/v1/auth/login': 'user_logged_in',
        'POST /api/v1/files/upload': 'file_uploaded',
        'POST /api/v1/invoices': 'invoice_created',
        'PUT /api/v1/invoices': 'invoice_updated',
        'DELETE /api/v1/invoices': 'invoice_deleted',
      };

      const routeKey = `${req.method} ${req.route?.path || req.originalUrl}`;
      const eventName = businessEvents[routeKey];

      if (eventName) {
        loggerUtils.logBusinessEvent(eventName, req.user?.id, {
          requestId: req.requestId,
          url: req.originalUrl,
          statusCode: res.statusCode,
          resourceId: req.params?.id,
        });
      }
    }
  });

  next();
};

// Audit logging middleware for sensitive operations
export const auditLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const sensitiveRoutes = [
    '/api/v1/admin',
    '/api/v1/users',
    '/api/v1/system',
    '/api/v1/auth',
  ];

  const isSensitiveRoute = sensitiveRoutes.some(route => req.originalUrl.startsWith(route));

  if (isSensitiveRoute) {
    res.on('finish', () => {
      loggerUtils.logBusinessEvent('audit_trail', req.user?.id, {
        requestId: req.requestId,
        action: `${req.method} ${req.originalUrl}`,
        statusCode: res.statusCode,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        requestBody: req.method !== 'GET' ? req.body : undefined,
        responseStatus: res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failure',
      });
    });
  }

  next();
};

// Combined logging middleware
export const loggingMiddleware = [
  requestLoggingMiddleware,
  performanceLoggingMiddleware,
  securityLoggingMiddleware,
  businessLoggingMiddleware,
  auditLoggingMiddleware,
];

export default loggingMiddleware;
