// @ts-nocheck

import { Router, Request, Response } from 'express';
import { DebugUtils } from '../utils/debugUtils';
import { logger, loggerUtils } from '../utils/logger';
import { createSuccessResponse, createErrorResponse } from '../utils/response';
import { ErrorCode } from '../types/errors';
import { asyncHandler } from '../utils/asyncHandler';
import {
  validateRequest,
  querySchemas,
} from '../middleware/standardValidation';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();

// Only enable debug routes in development
const debugMiddleware = (req: Request, res: Response, next: Function) => {
  if (!DebugUtils.isEnabled()) {
    return res
      .status(404)
      .json(
        createErrorResponse(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Debug endpoints are not available',
          'Debug mode is disabled in this environment',
          '/help/debug',
        ),
      );
  }
  next();
};

// Apply debug middleware to all routes
router.use(debugMiddleware);

// Get system information
router.get(
  '/system',
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;

    const systemInfo = DebugUtils.getSystemInfo();

    res.json(
      createSuccessResponse(
        systemInfo,
        'System information retrieved',
        requestId,
      ),
    );
  }),
);

// Get request debugging information
router.get(
  '/request',
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;

    const requestInfo = DebugUtils.getRequestInfo(req);

    res.json(
      createSuccessResponse(
        requestInfo,
        'Request information retrieved',
        requestId,
      ),
    );
  }),
);

// Create memory snapshot
router.post(
  '/memory/snapshot',
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;

    const snapshot = DebugUtils.createMemorySnapshot();

    res.json(
      createSuccessResponse(snapshot, 'Memory snapshot created', requestId),
    );
  }),
);

// Compare memory snapshots
const memoryCompareSchema = z.object({
  before: z.object({
    timestamp: z.string(),
    process: z.object({
      rss: z.number(),
      heapTotal: z.number(),
      heapUsed: z.number(),
      external: z.number(),
      arrayBuffers: z.number(),
    }),
    system: z.object({
      total: z.number(),
      free: z.number(),
      used: z.number(),
      usagePercent: z.number(),
    }),
  }),
  after: z.object({
    timestamp: z.string(),
    process: z.object({
      rss: z.number(),
      heapTotal: z.number(),
      heapUsed: z.number(),
      external: z.number(),
      arrayBuffers: z.number(),
    }),
    system: z.object({
      total: z.number(),
      free: z.number(),
      used: z.number(),
      usagePercent: z.number(),
    }),
  }),
});

router.post(
  '/memory/compare',
  validateRequest({ body: memoryCompareSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;
    const { before, after } = req.body;

    const comparison = DebugUtils.compareMemorySnapshots(before, after);

    res.json(
      createSuccessResponse(comparison, 'Memory snapshots compared', requestId),
    );
  }),
);

// Get all active debug sessions
router.get(
  '/sessions',
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;

    const sessions = DebugUtils.getAllSessions().map((session) =>
      session.getSummary(),
    );

    res.json(
      createSuccessResponse(
        { sessions, count: sessions.length },
        'Debug sessions retrieved',
        requestId,
      ),
    );
  }),
);

// Create a new debug session
const createSessionSchema = z.object({
  id: z.string().min(1).max(100),
  description: z.string().optional(),
});

router.post(
  '/sessions',
  validateRequest({ body: createSessionSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;
    const { id, description } = req.body;

    const session = DebugUtils.createSession(id, description);

    res.json(
      createSuccessResponse(
        session.getSummary(),
        'Debug session created',
        requestId,
      ),
    );
  }),
);

// Get specific debug session
router.get(
  '/sessions/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;
    const { sessionId } = req.params;

    const session = DebugUtils.getSession(sessionId);

    if (!session) {
      return res
        .status(404)
        .json(
          createErrorResponse(
            ErrorCode.RESOURCE_NOT_FOUND,
            'Debug session not found',
            'The specified debug session does not exist',
            '/help/debug',
            undefined,
            { sessionId },
            requestId,
          ),
        );
    }

    res.json(
      createSuccessResponse(
        session.getSummary(),
        'Debug session retrieved',
        requestId,
      ),
    );
  }),
);

// End a debug session
router.delete(
  '/sessions/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;
    const { sessionId } = req.params;

    const session = DebugUtils.getSession(sessionId);

    if (!session) {
      return res
        .status(404)
        .json(
          createErrorResponse(
            ErrorCode.RESOURCE_NOT_FOUND,
            'Debug session not found',
            'The specified debug session does not exist',
            '/help/debug',
            undefined,
            { sessionId },
            requestId,
          ),
        );
    }

    const summary = session.end();

    res.json(createSuccessResponse(summary, 'Debug session ended', requestId));
  }),
);

// Dump debug data to file
const dumpDataSchema = z.object({
  data: z.any(),
  filename: z.string().optional(),
});

router.post(
  '/dump',
  validateRequest({ body: dumpDataSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;
    const { data, filename } = req.body;

    const filePath = await DebugUtils.dumpToFile(data, filename);

    res.json(
      createSuccessResponse(
        { filePath },
        'Debug data dumped to file',
        requestId,
      ),
    );
  }),
);

// Test endpoint for performance measurement
router.post(
  '/test/performance',
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;
    const { operation = 'test', delay = 0 } = req.body;

    const { result, duration } = await DebugUtils.measureTime(
      operation,
      async () => {
        // Simulate work
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // Perform some CPU work
        let sum = 0;
        for (let i = 0; i < 1000000; i++) {
          sum += Math.random();
        }

        return { sum, message: 'Performance test completed' };
      },
      { requestId, delay },
    );

    res.json(
      createSuccessResponse(
        { result, duration: `${duration.toFixed(2)}ms` },
        'Performance test completed',
        requestId,
      ),
    );
  }),
);

// Test endpoint for database performance
router.get(
  '/test/database',
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;

    const { result, duration } = await DebugUtils.measureTime(
      'database-test',
      async () => {
        // Test database queries
        const userCount = await prisma.user.count();
        const fileCount = await prisma.file.count();
        const invoiceCount = await prisma.invoice.count();

        return {
          userCount,
          fileCount,
          invoiceCount,
          timestamp: new Date().toISOString(),
        };
      },
      { requestId },
    );

    res.json(
      createSuccessResponse(
        { result, duration: `${duration.toFixed(2)}ms` },
        'Database performance test completed',
        requestId,
      ),
    );
  }),
);

// Test endpoint for error handling
router.post(
  '/test/error',
  asyncHandler(async (req: Request, res: Response) => {
    const { type = 'generic', message = 'Test error' } = req.body;

    switch (type) {
      case 'validation':
        throw new Error(`Validation error: ${message}`);
      case 'database':
        throw new Error(`Database error: ${message}`);
      case 'network':
        throw new Error(`Network error: ${message}`);
      case 'timeout':
        await new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout error: ${message}`)), 100),
        );
        break;
      default:
        throw new Error(`Generic error: ${message}`);
    }
  }),
);

// Get recent logs
const logsQuerySchema = querySchemas.pagination.extend({
  level: z.enum(['error', 'warn', 'info', 'http', 'debug', 'trace']).optional(),
  category: z.string().optional(),
});

router.get(
  '/logs',
  validateRequest({ query: logsQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;
    const { page = 1, limit = 50, level, category } = req.query as any;

    // This is a simplified implementation
    // In a real application, you might want to read from log files or a log aggregation service
    const logs = [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Sample log entry',
        category: 'debug',
        requestId,
      },
    ];

    res.json(
      createSuccessResponse(
        {
          logs,
          pagination: {
            page,
            limit,
            total: logs.length,
            hasNext: false,
            hasPrev: false,
          },
        },
        'Debug logs retrieved',
        requestId,
      ),
    );
  }),
);

// Clear all debug sessions
router.delete(
  '/sessions',
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;

    const sessions = DebugUtils.getAllSessions();
    const sessionCount = sessions.length;

    sessions.forEach((session) => session.end());

    res.json(
      createSuccessResponse(
        { clearedSessions: sessionCount },
        'All debug sessions cleared',
        requestId,
      ),
    );
  }),
);

// Force garbage collection (if available)
router.post(
  '/gc',
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;

    const beforeMemory = DebugUtils.createMemorySnapshot();

    if (global.gc) {
      global.gc();
      const afterMemory = DebugUtils.createMemorySnapshot();
      const comparison = DebugUtils.compareMemorySnapshots(
        beforeMemory,
        afterMemory,
      );

      res.json(
        createSuccessResponse(
          { beforeMemory, afterMemory, comparison },
          'Garbage collection forced',
          requestId,
        ),
      );
    } else {
      res.json(
        createSuccessResponse(
          {
            beforeMemory,
            message: 'Garbage collection not available (run with --expose-gc)',
          },
          'Garbage collection not available',
          requestId,
        ),
      );
    }
  }),
);

export default router;
