import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { PerformanceMonitoringService } from '../services/PerformanceMonitoringService';
import { logger } from '../utils/logger';
import {
  performSystemHealthCheck,
  quickHealthCheck,
} from '../utils/system-health';
import { prisma } from '../index';
import { ErrorCode } from '../types/errors';
import { createErrorResponse, createSuccessResponse } from '../utils/response';
import { standardizeResponse, validateRequest, querySchemas } from '../middleware/standardValidation';
import { asyncHandler } from '../utils/asyncHandler';
import { z } from 'zod';

const router = Router();

// Apply standard middleware
router.use(standardizeResponse);

// Quick health check (no auth required for monitoring)
router.get('/health',
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;

    const health = await quickHealthCheck();
    res.json(createSuccessResponse(
      health,
      'System health check completed',
      requestId
    ));
  })
);

// Detailed health check (requires auth)
router.get(
  '/health/detailed',
  authMiddleware,
  rateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;

    const health = await performSystemHealthCheck(prisma);

    // Set appropriate status code based on health
    const statusCode = health.status === 'healthy' ? 200 :
                      health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(createSuccessResponse(
      health,
      'Detailed system health check completed',
      requestId
    ));
  })
);

// Service-specific health checks
router.get('/health/database',
  authMiddleware,
  rateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;

    const { checkDatabaseHealth } = await import('../utils/system-health');
    const health = await checkDatabaseHealth(prisma);

    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json(createSuccessResponse(
      health,
      'Database health check completed',
      requestId
    ));
  })
);

router.get('/health/redis',
  authMiddleware,
  rateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;

    const { checkRedisHealth } = await import('../utils/system-health');
    const health = await checkRedisHealth();

    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json(createSuccessResponse(
      health,
      'Redis health check completed',
      requestId
    ));
  })
);

router.get('/health/memory',
  authMiddleware,
  rateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;

    const { checkMemoryHealth } = await import('../utils/system-health');
    const health = checkMemoryHealth();

    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json(createSuccessResponse(
      health,
      'Memory health check completed',
      requestId
    ));
  })
);

router.get('/health/filesystem',
  authMiddleware,
  rateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;

    const { checkFileSystemHealth } = await import('../utils/system-health');
    const health = await checkFileSystemHealth();

    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json(createSuccessResponse(
      health,
      'File system health check completed',
      requestId
    ));
  })
);

// Legacy endpoint for backward compatibility
router.get(
  '/health/performance',
  authMiddleware,
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const health = await PerformanceMonitoringService.getSystemHealth();
      res.json(createSuccessResponse(health, 'Performance health check completed'));
    } catch (error) {
      logger.error('Failed to get performance health', { error });
      res.status(500).json(createErrorResponse(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Failed to get system health metrics',
        'The performance health check could not be completed. Please try again or contact support.',
        '/help/performance-issues'
      ));
    }
  },
);

// Create metrics query schema
const metricsQuerySchema = querySchemas.dateRange.extend({
  metric: z.enum(['cpu', 'memory', 'disk', 'network', 'requests', 'errors']),
});

router.get('/metrics',
  authMiddleware,
  rateLimiter,
  validateRequest({ query: metricsQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;
    const { startDate, endDate, metric } = req.query as any;

    const metrics = await PerformanceMonitoringService.getMetrics(
      metric,
      new Date(startDate),
      new Date(endDate),
    );

    res.json(createSuccessResponse(
      metrics,
      'Performance metrics retrieved successfully',
      requestId
    ));
  })
);

router.get('/alerts', authMiddleware, rateLimiter, async (req: Request, res: Response) => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string, 10);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json(createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid limit parameter',
        'Limit must be a number between 1 and 100',
        '/help/api-parameters',
        undefined,
        { limit: limitNum }
      ));
    }

    const alerts = await PerformanceMonitoringService.getRecentAlerts(limitNum);
    res.json(createSuccessResponse(alerts, `Retrieved ${alerts.length} recent alerts`));
  } catch (error) {
    logger.error('Failed to get alerts', { error });
    res.status(500).json(createErrorResponse(
      ErrorCode.SERVICE_UNAVAILABLE,
      'Failed to get system alerts',
      'The alerts service is currently unavailable. Please try again later.',
      '/help/alerts-issues'
    ));
  }
});

// Add system status endpoint
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = {
      status: 'operational',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };

    res.json(createSuccessResponse(status, 'System status retrieved successfully'));
  } catch (error) {
    logger.error('Failed to get system status', { error });
    res.status(500).json(createErrorResponse(
      ErrorCode.SERVICE_UNAVAILABLE,
      'Failed to get system status',
      'The system status check failed. Please try again.',
      '/help/system-issues'
    ));
  }
});

export default router;
