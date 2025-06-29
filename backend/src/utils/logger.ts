import winston from 'winston';
import path from 'path';
import { config } from '../config';
import { ErrorCode } from '../types/errors';
import { AsyncLocalStorage } from 'async_hooks';

// Async local storage for correlation IDs
export const correlationStorage = new AsyncLocalStorage<{
  correlationId: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
}>();

// Enhanced log levels with custom categories
const customLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  trace: 5,
};

const customColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
  trace: 'gray',
};

winston.addColors(customColors);

// Generate unique log ID for tracking
const generateLogId = (): string => {
  return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Generate correlation ID for request tracking
const generateCorrelationId = (): string => {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get current correlation context
const getCorrelationContext = () => {
  return correlationStorage.getStore() || {};
};

// Enhanced logger with better error tracking
export const logger = winston.createLogger({
  level: config.monitoring.logging.level ?? 'info',
  levels: customLevels,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, logId, category, userId, requestId, correlationId, ...meta }) => {
      const context = getCorrelationContext();
      const logEntry = {
        timestamp,
        level,
        message,
        logId: logId || generateLogId(),
        category: category || 'general',
        correlationId: correlationId || context.correlationId,
        requestId: requestId || context.requestId,
        userId: userId || context.userId,
        sessionId: context.sessionId,
        ...(stack && { stack }),
        ...meta,
      };
      return JSON.stringify(logEntry);
    }),
  ),
  defaultMeta: {
    service: 'syntaxisai-backend',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(({ timestamp, level, message, logId, category, userId, requestId, correlationId, stack, ...meta }) => {
          const context = getCorrelationContext();
          const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
          const contextString = [
            logId && `[${logId}]`,
            category && `[${category}]`,
            (correlationId || context.correlationId) && `[corr:${correlationId || context.correlationId}]`,
            (userId || context.userId) && `[user:${userId || context.userId}]`,
            (requestId || context.requestId) && `[req:${requestId || context.requestId}]`,
            context.sessionId && `[sess:${context.sessionId}]`,
          ].filter(Boolean).join(' ');

          let logLine = `${timestamp} ${level}: ${message}${metaString}`;
          if (contextString) {
            logLine += ` ${contextString}`;
          }
          if (stack) {
            logLine += `\n${stack}`;
          }
          return logLine;
        }),
      ),
    }),

    // File transport for errors
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log'),
    }),
  ],
});

// Enhanced logging utilities with correlation tracking
export const loggerUtils = {
  // Initialize correlation context for a request
  initializeCorrelationContext: (req: any) => {
    const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
    const requestId = req.headers['x-request-id'] || generateLogId();
    const userId = req.user?.id;
    const sessionId = req.session?.id || req.headers['x-session-id'];

    const context = {
      correlationId,
      requestId,
      userId,
      sessionId,
    };

    // Store in async local storage
    correlationStorage.enterWith(context);

    // Add to request for downstream use
    req.correlationId = correlationId;
    req.requestId = requestId;

    return context;
  },

  // Log API requests with enhanced tracking
  logApiRequest: (req: any, res: any, responseTime?: number) => {
    const logId = generateLogId();
    const context = getCorrelationContext();

    logger.http('API Request', {
      logId,
      category: 'api',
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      statusCode: res.statusCode,
      responseTime: responseTime ? `${responseTime}ms` : undefined,
      contentLength: res.get('content-length'),
      referer: req.get('Referer'),
      ...context,
    });
    return logId;
  },

  // Log authentication events
  logAuthEvent: (event: string, userId?: string, details?: any) => {
    const logId = generateLogId();
    logger.info(`Auth: ${event}`, {
      logId,
      category: 'auth',
      userId,
      event,
      ...details,
    });
    return logId;
  },

  // Log file operations
  logFileOperation: (operation: string, fileId?: string, userId?: string, details?: any) => {
    const logId = generateLogId();
    logger.info(`File: ${operation}`, {
      logId,
      category: 'file',
      operation,
      fileId,
      userId,
      ...details,
    });
    return logId;
  },

  // Log OCR operations
  logOcrOperation: (operation: string, fileId?: string, userId?: string, details?: any) => {
    const logId = generateLogId();
    logger.info(`OCR: ${operation}`, {
      logId,
      category: 'ocr',
      operation,
      fileId,
      userId,
      ...details,
    });
    return logId;
  },

  // Log database operations
  logDatabaseOperation: (operation: string, table?: string, details?: any) => {
    const logId = generateLogId();
    logger.debug(`Database: ${operation}`, {
      logId,
      category: 'database',
      operation,
      table,
      ...details,
    });
    return logId;
  },

  // Log errors with enhanced context
  logError: (error: Error, context?: any, errorCode?: ErrorCode) => {
    const logId = generateLogId();
    logger.error('Application Error', {
      logId,
      category: 'error',
      errorCode,
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...context,
    });
    return logId;
  },

  // Log performance metrics
  logPerformance: (metric: string, value: number, unit: string, context?: any) => {
    const logId = generateLogId();
    logger.info(`Performance: ${metric}`, {
      logId,
      category: 'performance',
      metric,
      value,
      unit,
      ...context,
    });
    return logId;
  },

  // Log security events
  logSecurityEvent: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: any) => {
    const logId = generateLogId();
    logger.warn(`Security: ${event}`, {
      logId,
      category: 'security',
      event,
      severity,
      ...details,
    });
    return logId;
  },

  // Log business events
  logBusinessEvent: (event: string, userId?: string, details?: any) => {
    const logId = generateLogId();
    logger.info(`Business: ${event}`, {
      logId,
      category: 'business',
      event,
      userId,
      ...details,
    });
    return logId;
  },

  // Create child logger with context
  createChildLogger: (context: any) => {
    return logger.child(context);
  },

  // Enhanced performance logging with timing
  logPerformanceWithTiming: (operation: string, startTime: number, context?: any) => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const logId = generateLogId();

    logger.info(`Performance: ${operation}`, {
      logId,
      category: 'performance',
      operation,
      duration,
      unit: 'ms',
      startTime,
      endTime,
      ...context,
    });
    return { logId, duration };
  },

  // Log slow operations (above threshold)
  logSlowOperation: (operation: string, duration: number, threshold: number = 1000, context?: any) => {
    if (duration > threshold) {
      const logId = generateLogId();
      logger.warn(`Slow Operation: ${operation}`, {
        logId,
        category: 'performance',
        operation,
        duration,
        threshold,
        unit: 'ms',
        severity: duration > threshold * 2 ? 'high' : 'medium',
        ...context,
      });
      return logId;
    }
    return null;
  },

  // Log database query performance
  logDatabaseQuery: (query: string, duration: number, rowCount?: number, context?: any) => {
    const logId = generateLogId();
    const level = duration > 1000 ? 'warn' : 'debug';

    logger[level]('Database Query', {
      logId,
      category: 'database',
      query: query.substring(0, 200), // Truncate long queries
      duration,
      rowCount,
      unit: 'ms',
      ...context,
    });
    return logId;
  },

  // Log cache operations
  logCacheOperation: (operation: 'hit' | 'miss' | 'set' | 'delete', key: string, context?: any) => {
    const logId = generateLogId();
    logger.debug(`Cache ${operation.toUpperCase()}`, {
      logId,
      category: 'cache',
      operation,
      key: key.substring(0, 100), // Truncate long keys
      ...context,
    });
    return logId;
  },

  // Log external API calls
  logExternalApiCall: (service: string, endpoint: string, method: string, statusCode: number, duration: number, context?: any) => {
    const logId = generateLogId();
    const level = statusCode >= 400 ? 'warn' : 'info';

    logger[level](`External API: ${service}`, {
      logId,
      category: 'external-api',
      service,
      endpoint,
      method,
      statusCode,
      duration,
      unit: 'ms',
      success: statusCode < 400,
      ...context,
    });
    return logId;
  },

  // Log rate limiting events
  logRateLimit: (identifier: string, limit: number, remaining: number, resetTime: number, context?: any) => {
    const logId = generateLogId();
    const level = remaining === 0 ? 'warn' : 'debug';

    logger[level]('Rate Limit', {
      logId,
      category: 'rate-limit',
      identifier,
      limit,
      remaining,
      resetTime,
      blocked: remaining === 0,
      ...context,
    });
    return logId;
  },

  // Log validation errors with details
  logValidationError: (field: string, value: any, rule: string, context?: any) => {
    const logId = generateLogId();
    logger.warn('Validation Error', {
      logId,
      category: 'validation',
      field,
      value: typeof value === 'string' ? value.substring(0, 100) : value,
      rule,
      ...context,
    });
    return logId;
  },

  // Log user actions for audit trail
  logUserAction: (action: string, userId: string, resourceType?: string, resourceId?: string, context?: any) => {
    const logId = generateLogId();
    logger.info(`User Action: ${action}`, {
      logId,
      category: 'audit',
      action,
      userId,
      resourceType,
      resourceId,
      timestamp: new Date().toISOString(),
      ...context,
    });
    return logId;
  },

  // Log system events
  logSystemEvent: (event: string, severity: 'info' | 'warn' | 'error', context?: any) => {
    const logId = generateLogId();
    logger[severity](`System Event: ${event}`, {
      logId,
      category: 'system',
      event,
      severity,
      ...context,
    });
    return logId;
  },

  // Create performance timer
  createTimer: (operation: string, context?: any) => {
    const startTime = Date.now();
    return {
      end: () => {
        const duration = Date.now() - startTime;
        return loggerUtils.logPerformanceWithTiming(operation, startTime, context);
      },
      endIfSlow: (threshold: number = 1000) => {
        const duration = Date.now() - startTime;
        return loggerUtils.logSlowOperation(operation, duration, threshold, context);
      },
    };
  },

  // Structured error logging with correlation
  logStructuredError: (error: Error, context?: any, errorCode?: ErrorCode) => {
    const logId = generateLogId();
    const correlationContext = getCorrelationContext();

    logger.error('Structured Error', {
      logId,
      category: 'error',
      errorCode,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      ...correlationContext,
      ...context,
    });
    return logId;
  },

  // Get log ID for tracking
  generateLogId,

  // Get correlation ID
  generateCorrelationId,

  // Get current correlation context
  getCorrelationContext,
};

// Export default logger
export default logger;
