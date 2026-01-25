// @ts-nocheck

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { logger, loggerUtils } from '../utils/logger';
import { createSuccessResponse, createErrorResponse } from '../utils/response';
import { ErrorCode } from '../types/errors';
import { prisma } from '../prisma';
import os from 'os';
import fs from 'fs';
import path from 'path';

const router = Router();

// Only enable debug routes in development
if (process.env.NODE_ENV !== 'production') {
  // System information endpoint
  router.get('/system', async (req: Request, res: Response) => {
    try {
      const systemInfo = {
        node: {
          version: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
        },
        os: {
          type: os.type(),
          platform: os.platform(),
          arch: os.arch(),
          release: os.release(),
          uptime: os.uptime(),
          loadavg: os.loadavg(),
          totalmem: os.totalmem(),
          freemem: os.freemem(),
          cpus: os.cpus().length,
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          port: process.env.PORT,
          databaseUrl: process.env.DATABASE_URL
            ? '***configured***'
            : 'not configured',
          redisUrl: process.env.REDIS_URL
            ? '***configured***'
            : 'not configured',
        },
        package: {
          name: process.env.npm_package_name,
          version: process.env.npm_package_version,
        },
      };

      res.json(
        createSuccessResponse(systemInfo, 'System information retrieved'),
      );
    } catch (error) {
      logger.error('Failed to get system info', { error });
      res
        .status(500)
        .json(
          createErrorResponse(
            ErrorCode.INTERNAL_ERROR,
            'Failed to retrieve system information',
            'Please try again or contact support',
            '/help/debug',
          ),
        );
    }
  });

  // Database debug information
  router.get(
    '/database',
    authMiddleware,
    async (req: Request, res: Response) => {
      try {
        const dbInfo = {
          connection: 'connected',
          tables: await prisma.$queryRaw`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
        `,
          counts: {
            users: await prisma.user.count(),
            files: await prisma.file.count(),
            invoices: await prisma.invoice.count(),
          },
          recentActivity: {
            recentUsers: await prisma.user.findMany({
              take: 5,
              orderBy: { createdAt: 'desc' },
              select: { id: true, email: true, createdAt: true },
            }),
            recentFiles: await prisma.file.findMany({
              take: 5,
              orderBy: { createdAt: 'desc' },
              select: { id: true, filename: true, createdAt: true },
            }),
          },
        };

        res.json(
          createSuccessResponse(dbInfo, 'Database information retrieved'),
        );
      } catch (error) {
        logger.error('Failed to get database info', { error });
        res
          .status(500)
          .json(
            createErrorResponse(
              ErrorCode.DATABASE_ERROR,
              'Failed to retrieve database information',
              'Please check database connection',
              '/help/database',
            ),
          );
      }
    },
  );

  // Logs endpoint
  router.get('/logs', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { level = 'info', limit = '100' } = req.query;
      const logLimit = Math.min(parseInt(limit as string, 10), 1000);

      // Read log files if they exist
      const logsDir = path.join(process.cwd(), 'logs');
      const logFiles = ['combined.log', 'error.log'];
      const logs: any[] = [];

      for (const logFile of logFiles) {
        const logPath = path.join(logsDir, logFile);
        if (fs.existsSync(logPath)) {
          const content = fs.readFileSync(logPath, 'utf-8');
          const lines = content.split('\n').filter((line) => line.trim());

          lines.slice(-logLimit).forEach((line) => {
            try {
              const logEntry = JSON.parse(line);
              if (!level || logEntry.level === level) {
                logs.push({
                  ...logEntry,
                  source: logFile,
                });
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          });
        }
      }

      // Sort by timestamp
      logs.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      res.json(
        createSuccessResponse(
          {
            logs: logs.slice(0, logLimit),
            total: logs.length,
            level,
            limit: logLimit,
          },
          'Logs retrieved successfully',
        ),
      );
    } catch (error) {
      logger.error('Failed to get logs', { error });
      res
        .status(500)
        .json(
          createErrorResponse(
            ErrorCode.INTERNAL_ERROR,
            'Failed to retrieve logs',
            'Please try again or contact support',
            '/help/debug',
          ),
        );
    }
  });

  // Performance metrics endpoint
  router.get(
    '/performance',
    authMiddleware,
    async (req: Request, res: Response) => {
      try {
        const performanceInfo = {
          process: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            resourceUsage: process.resourceUsage
              ? process.resourceUsage()
              : null,
          },
          system: {
            loadavg: os.loadavg(),
            freemem: os.freemem(),
            totalmem: os.totalmem(),
            uptime: os.uptime(),
          },
          gc: {
            // Note: This would require --expose-gc flag
            available: typeof global.gc === 'function',
          },
        };

        res.json(
          createSuccessResponse(
            performanceInfo,
            'Performance metrics retrieved',
          ),
        );
      } catch (error) {
        logger.error('Failed to get performance metrics', { error });
        res
          .status(500)
          .json(
            createErrorResponse(
              ErrorCode.INTERNAL_ERROR,
              'Failed to retrieve performance metrics',
              'Please try again or contact support',
              '/help/debug',
            ),
          );
      }
    },
  );

  // Test error endpoint
  router.post('/test-error', async (req: Request, res: Response) => {
    const { type = 'generic', message = 'Test error' } = req.body;

    const logId = loggerUtils.logError(new Error(message), {
      type,
      intentional: true,
      requestId: req.requestId,
    });

    switch (type) {
      case 'validation':
        res
          .status(400)
          .json(
            createErrorResponse(
              ErrorCode.VALIDATION_ERROR,
              message,
              'This is a test validation error',
              '/help/validation',
              logId,
            ),
          );
        break;
      case 'auth':
        res
          .status(401)
          .json(
            createErrorResponse(
              ErrorCode.AUTHENTICATION_ERROR,
              message,
              'This is a test authentication error',
              '/help/auth',
              logId,
            ),
          );
        break;
      case 'server':
        res
          .status(500)
          .json(
            createErrorResponse(
              ErrorCode.INTERNAL_ERROR,
              message,
              'This is a test server error',
              '/help/server',
              logId,
            ),
          );
        break;
      default:
        throw new Error(message);
    }
  });

  // Clear logs endpoint
  router.delete(
    '/logs',
    authMiddleware,
    async (req: Request, res: Response) => {
      try {
        const logsDir = path.join(process.cwd(), 'logs');
        const logFiles = [
          'combined.log',
          'error.log',
          'exceptions.log',
          'rejections.log',
        ];

        for (const logFile of logFiles) {
          const logPath = path.join(logsDir, logFile);
          if (fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, '');
          }
        }

        loggerUtils.logBusinessEvent('logs_cleared', req.user?.id, {
          requestId: req.requestId,
        });

        res.json(createSuccessResponse(null, 'Logs cleared successfully'));
      } catch (error) {
        logger.error('Failed to clear logs', { error });
        res
          .status(500)
          .json(
            createErrorResponse(
              ErrorCode.INTERNAL_ERROR,
              'Failed to clear logs',
              'Please try again or contact support',
              '/help/debug',
            ),
          );
      }
    },
  );

  // Environment variables (sanitized)
  router.get('/env', authMiddleware, async (req: Request, res: Response) => {
    try {
      const sensitiveKeys = [
        'password',
        'secret',
        'key',
        'token',
        'url',
        'connection',
      ];

      const sanitizedEnv = Object.entries(process.env).reduce(
        (acc, [key, value]) => {
          const isSensitive = sensitiveKeys.some((sensitive) =>
            key.toLowerCase().includes(sensitive),
          );

          acc[key] = isSensitive ? '***hidden***' : value || '';
          return acc;
        },
        {} as Record<string, string>,
      );

      res.json(
        createSuccessResponse(sanitizedEnv, 'Environment variables retrieved'),
      );
    } catch (error) {
      logger.error('Failed to get environment variables', { error });
      res
        .status(500)
        .json(
          createErrorResponse(
            ErrorCode.INTERNAL_ERROR,
            'Failed to retrieve environment variables',
            'Please try again or contact support',
            '/help/debug',
          ),
        );
    }
  });

  // Health check with detailed information
  router.get('/health-detailed', async (req: Request, res: Response) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {
          database: 'checking...',
          redis: 'checking...',
          filesystem: 'checking...',
        },
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      };

      // Check database
      try {
        await prisma.$queryRaw`SELECT 1`;
        health.services.database = 'healthy';
      } catch (error) {
        health.services.database = 'unhealthy';
        health.status = 'degraded';
      }

      // Check filesystem
      try {
        const tempFile = path.join(os.tmpdir(), 'syntaxisai-health-check');
        fs.writeFileSync(tempFile, 'test');
        fs.unlinkSync(tempFile);
        health.services.filesystem = 'healthy';
      } catch (error) {
        health.services.filesystem = 'unhealthy';
        health.status = 'degraded';
      }

      res.json(
        createSuccessResponse(health, 'Detailed health check completed'),
      );
    } catch (error) {
      logger.error('Failed to perform detailed health check', { error });
      res
        .status(500)
        .json(
          createErrorResponse(
            ErrorCode.SERVICE_UNAVAILABLE,
            'Health check failed',
            'Please try again or contact support',
            '/help/health',
          ),
        );
    }
  });
} else {
  // In production, return 404 for all debug routes
  router.use('*', (req: Request, res: Response) => {
    res
      .status(404)
      .json(
        createErrorResponse(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Debug endpoints not available in production',
          'Debug endpoints are only available in development mode',
          '/help/api',
        ),
      );
  });
}

export default router;
