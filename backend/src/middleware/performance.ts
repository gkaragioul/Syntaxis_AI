import { Request, Response, NextFunction } from 'express';
import { PerformanceMonitoringService } from '../services/PerformanceMonitoringService';
import { logger } from '../utils/logger';

export const performanceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startTime = Date.now();
  const requestId =
    req.headers['x-request-id'] || Math.random().toString(36).substring(7);

  // Add request ID to response headers
  res.setHeader('x-request-id', requestId);

  // Track request count
  PerformanceMonitoringService.recordMetric('requestCount', 1, {
    method: req.method,
    path: req.path,
    requestId,
  }).catch((error) => {
    logger.error('Failed to record request count', { error, requestId });
  });

  // Track response time
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Record response time
    PerformanceMonitoringService.recordMetric('responseTime', duration, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      requestId,
    }).catch((error) => {
      logger.error('Failed to record response time', { error, requestId });
    });

    // Record error count if status code indicates an error
    if (res.statusCode >= 400) {
      PerformanceMonitoringService.recordMetric('errorCount', 1, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        requestId,
      }).catch((error) => {
        logger.error('Failed to record error count', { error, requestId });
      });
    }

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request', {
        method: req.method,
        path: req.path,
        duration,
        statusCode: res.statusCode,
        requestId,
      });
    }
  });

  next();
};

export const uploadPerformanceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.file && !req.files) {
    return next();
  }

  const startTime = Date.now();
  const requestId =
    req.headers['x-request-id'] || Math.random().toString(36).substring(7);

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    if (req.file) {
      // Single file upload
      PerformanceMonitoringService.recordUploadMetrics(
        req.file.size,
        duration,
        req.user!.id,
        {
          filename: req.file.originalname,
          mimeType: req.file.mimetype,
          requestId,
        },
      ).catch((error) => {
        logger.error('Failed to record upload metrics', { error, requestId });
      });
    } else if (Array.isArray(req.files)) {
      // Multiple file upload
      const totalSize = req.files.reduce((sum, file) => sum + file.size, 0);
      PerformanceMonitoringService.recordUploadMetrics(
        totalSize,
        duration,
        req.user!.id,
        {
          fileCount: req.files.length,
          requestId,
        },
      ).catch((error) => {
        logger.error('Failed to record upload metrics', { error, requestId });
      });
    }
  });

  next();
};

export const processingPerformanceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.path.includes('/process')) {
    return next();
  }

  const startTime = Date.now();
  const requestId =
    req.headers['x-request-id'] || Math.random().toString(36).substring(7);

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    if (res.statusCode === 200) {
      const fileSize = parseInt(req.headers['content-length'] || '0', 10);
      PerformanceMonitoringService.recordProcessingMetrics(
        fileSize,
        duration,
        req.user!.id,
        {
          requestId,
        },
      ).catch((error) => {
        logger.error('Failed to record processing metrics', {
          error,
          requestId,
        });
      });
    }
  });

  next();
};

export const exportPerformanceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.path.includes('/export')) {
    return next();
  }

  const startTime = Date.now();
  const requestId =
    req.headers['x-request-id'] || Math.random().toString(36).substring(7);

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    if (res.statusCode === 200) {
      const fileSize = parseInt(req.headers['content-length'] || '0', 10);
      PerformanceMonitoringService.recordExportMetrics(
        fileSize,
        duration,
        req.user!.id,
        {
          requestId,
        },
      ).catch((error) => {
        logger.error('Failed to record export metrics', { error, requestId });
      });
    }
  });

  next();
};
