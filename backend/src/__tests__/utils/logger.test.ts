import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { logger, loggerUtils, correlationStorage } from '../../utils/logger';
import { ErrorCode } from '../../types/errors';

// Mock winston
vi.mock('winston', () => ({
  default: {
    createLogger: vi.fn(() => ({
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      http: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      child: vi.fn(() => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      })),
    })),
    format: {
      combine: vi.fn(),
      timestamp: vi.fn(),
      errors: vi.fn(),
      json: vi.fn(),
      printf: vi.fn(),
      colorize: vi.fn(),
    },
    transports: {
      Console: vi.fn(),
      File: vi.fn(),
    },
    addColors: vi.fn(),
  },
  format: {
    combine: vi.fn(),
    timestamp: vi.fn(),
    errors: vi.fn(),
    json: vi.fn(),
    printf: vi.fn(),
    colorize: vi.fn(),
  },
  transports: {
    Console: vi.fn(),
    File: vi.fn(),
  },
  addColors: vi.fn(),
}));

describe('Enhanced Logger (Task 2.4.3)', () => {
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      http: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      child: vi.fn(() => mockLogger),
    };

    // Replace the logger instance
    Object.assign(logger, mockLogger);

    // Clear correlation storage
    correlationStorage.disable();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Correlation Context', () => {
    it('should initialize correlation context correctly', () => {
      const mockReq = {
        headers: {
          'x-correlation-id': 'test-correlation-id',
          'x-request-id': 'test-request-id',
        },
        user: { id: 'user-123' },
        session: { id: 'session-456' },
      };

      const context = loggerUtils.initializeCorrelationContext(mockReq);

      expect(context).toEqual({
        correlationId: 'test-correlation-id',
        requestId: 'test-request-id',
        userId: 'user-123',
        sessionId: 'session-456',
      });

      expect(mockReq.correlationId).toBe('test-correlation-id');
      expect(mockReq.requestId).toBe('test-request-id');
    });

    it('should generate IDs when not provided in headers', () => {
      const mockReq = {
        headers: {},
        user: { id: 'user-123' },
      };

      const context = loggerUtils.initializeCorrelationContext(mockReq);

      expect(context.correlationId).toMatch(/^corr_/);
      expect(context.requestId).toMatch(/^log_/);
      expect(context.userId).toBe('user-123');
    });

    it('should get correlation context from storage', () => {
      const testContext = {
        correlationId: 'test-corr-id',
        requestId: 'test-req-id',
        userId: 'user-123',
      };

      correlationStorage.run(testContext, () => {
        const context = loggerUtils.getCorrelationContext();
        expect(context).toEqual(testContext);
      });
    });
  });

  describe('Enhanced API Request Logging', () => {
    it('should log API requests with correlation context', () => {
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test',
        get: vi.fn((header) => {
          if (header === 'User-Agent') return 'test-agent';
          if (header === 'Referer') return 'http://test.com';
          return undefined;
        }),
        ip: '127.0.0.1',
      };

      const mockRes = {
        statusCode: 200,
        get: vi.fn((header) => {
          if (header === 'content-length') return '1024';
          return undefined;
        }),
      };

      const testContext = {
        correlationId: 'test-corr-id',
        requestId: 'test-req-id',
        userId: 'user-123',
      };

      correlationStorage.run(testContext, () => {
        const logId = loggerUtils.logApiRequest(mockReq, mockRes, 150);

        expect(mockLogger.http).toHaveBeenCalledWith('API Request', expect.objectContaining({
          logId: expect.stringMatching(/^log_/),
          category: 'api',
          method: 'GET',
          url: '/api/test',
          userAgent: 'test-agent',
          ip: '127.0.0.1',
          statusCode: 200,
          responseTime: '150ms',
          contentLength: '1024',
          referer: 'http://test.com',
          correlationId: 'test-corr-id',
          requestId: 'test-req-id',
          userId: 'user-123',
        }));

        expect(logId).toMatch(/^log_/);
      });
    });
  });

  describe('Performance Logging', () => {
    it('should log performance with timing', () => {
      const startTime = Date.now() - 500;
      const result = loggerUtils.logPerformanceWithTiming('test-operation', startTime, { extra: 'data' });

      expect(mockLogger.info).toHaveBeenCalledWith('Performance: test-operation', expect.objectContaining({
        logId: expect.stringMatching(/^log_/),
        category: 'performance',
        operation: 'test-operation',
        duration: expect.any(Number),
        unit: 'ms',
        startTime,
        endTime: expect.any(Number),
        extra: 'data',
      }));

      expect(result.logId).toMatch(/^log_/);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should log slow operations above threshold', () => {
      const logId = loggerUtils.logSlowOperation('slow-operation', 2000, 1000, { context: 'test' });

      expect(mockLogger.warn).toHaveBeenCalledWith('Slow Operation: slow-operation', expect.objectContaining({
        logId: expect.stringMatching(/^log_/),
        category: 'performance',
        operation: 'slow-operation',
        duration: 2000,
        threshold: 1000,
        unit: 'ms',
        severity: 'high',
        context: 'test',
      }));

      expect(logId).toMatch(/^log_/);
    });

    it('should not log operations below threshold', () => {
      const logId = loggerUtils.logSlowOperation('fast-operation', 500, 1000);

      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(logId).toBeNull();
    });

    it('should create and use performance timer', () => {
      const timer = loggerUtils.createTimer('timer-operation', { test: 'context' });

      // Simulate some work
      setTimeout(() => {
        const result = timer.end();

        expect(mockLogger.info).toHaveBeenCalledWith('Performance: timer-operation', expect.objectContaining({
          operation: 'timer-operation',
          duration: expect.any(Number),
          test: 'context',
        }));

        expect(result.duration).toBeGreaterThan(0);
      }, 10);
    });
  });

  describe('Database Query Logging', () => {
    it('should log fast database queries at debug level', () => {
      const logId = loggerUtils.logDatabaseQuery('SELECT * FROM users', 50, 10, { table: 'users' });

      expect(mockLogger.debug).toHaveBeenCalledWith('Database Query', expect.objectContaining({
        logId: expect.stringMatching(/^log_/),
        category: 'database',
        query: 'SELECT * FROM users',
        duration: 50,
        rowCount: 10,
        unit: 'ms',
        table: 'users',
      }));

      expect(logId).toMatch(/^log_/);
    });

    it('should log slow database queries at warn level', () => {
      const longQuery = 'SELECT * FROM users WHERE ' + 'condition AND '.repeat(50) + 'final_condition';
      const logId = loggerUtils.logDatabaseQuery(longQuery, 1500, 100);

      expect(mockLogger.warn).toHaveBeenCalledWith('Database Query', expect.objectContaining({
        category: 'database',
        query: expect.stringMatching(/^SELECT \* FROM users WHERE/),
        duration: 1500,
        rowCount: 100,
      }));

      // Should truncate long queries
      const call = mockLogger.warn.mock.calls[0][1];
      expect(call.query.length).toBeLessThanOrEqual(200);
    });
  });

  describe('Cache Operations Logging', () => {
    it('should log cache operations', () => {
      const operations = ['hit', 'miss', 'set', 'delete'] as const;

      operations.forEach(operation => {
        const logId = loggerUtils.logCacheOperation(operation, 'test-key', { ttl: 3600 });

        expect(mockLogger.debug).toHaveBeenCalledWith(`Cache ${operation.toUpperCase()}`, expect.objectContaining({
          logId: expect.stringMatching(/^log_/),
          category: 'cache',
          operation,
          key: 'test-key',
          ttl: 3600,
        }));

        expect(logId).toMatch(/^log_/);
      });
    });

    it('should truncate long cache keys', () => {
      const longKey = 'very-long-cache-key-'.repeat(10);
      loggerUtils.logCacheOperation('hit', longKey);

      const call = mockLogger.debug.mock.calls[0][1];
      expect(call.key.length).toBeLessThanOrEqual(100);
    });
  });

  describe('External API Logging', () => {
    it('should log successful external API calls', () => {
      const logId = loggerUtils.logExternalApiCall(
        'payment-service',
        '/api/payments',
        'POST',
        200,
        250,
        { amount: 100 }
      );

      expect(mockLogger.info).toHaveBeenCalledWith('External API: payment-service', expect.objectContaining({
        logId: expect.stringMatching(/^log_/),
        category: 'external-api',
        service: 'payment-service',
        endpoint: '/api/payments',
        method: 'POST',
        statusCode: 200,
        duration: 250,
        unit: 'ms',
        success: true,
        amount: 100,
      }));

      expect(logId).toMatch(/^log_/);
    });

    it('should log failed external API calls at warn level', () => {
      const logId = loggerUtils.logExternalApiCall(
        'payment-service',
        '/api/payments',
        'POST',
        500,
        1000
      );

      expect(mockLogger.warn).toHaveBeenCalledWith('External API: payment-service', expect.objectContaining({
        statusCode: 500,
        success: false,
      }));
    });
  });

  describe('Structured Error Logging', () => {
    it('should log structured errors with correlation context', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      const testContext = {
        correlationId: 'test-corr-id',
        requestId: 'test-req-id',
        userId: 'user-123',
      };

      correlationStorage.run(testContext, () => {
        const logId = loggerUtils.logStructuredError(
          error,
          { operation: 'test-operation' },
          ErrorCode.VALIDATION_ERROR
        );

        expect(mockLogger.error).toHaveBeenCalledWith('Structured Error', expect.objectContaining({
          logId: expect.stringMatching(/^log_/),
          category: 'error',
          errorCode: ErrorCode.VALIDATION_ERROR,
          errorName: 'Error',
          errorMessage: 'Test error',
          errorStack: 'Error stack trace',
          correlationId: 'test-corr-id',
          requestId: 'test-req-id',
          userId: 'user-123',
          operation: 'test-operation',
        }));

        expect(logId).toMatch(/^log_/);
      });
    });
  });

  describe('User Action Logging', () => {
    it('should log user actions for audit trail', () => {
      const logId = loggerUtils.logUserAction(
        'file-upload',
        'user-123',
        'file',
        'file-456',
        { fileName: 'test.pdf' }
      );

      expect(mockLogger.info).toHaveBeenCalledWith('User Action: file-upload', expect.objectContaining({
        logId: expect.stringMatching(/^log_/),
        category: 'audit',
        action: 'file-upload',
        userId: 'user-123',
        resourceType: 'file',
        resourceId: 'file-456',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        fileName: 'test.pdf',
      }));

      expect(logId).toMatch(/^log_/);
    });
  });

  describe('Rate Limiting Logging', () => {
    it('should log rate limit events', () => {
      const logId = loggerUtils.logRateLimit(
        'user-123',
        100,
        5,
        Date.now() + 60000,
        { endpoint: '/api/upload' }
      );

      expect(mockLogger.debug).toHaveBeenCalledWith('Rate Limit', expect.objectContaining({
        logId: expect.stringMatching(/^log_/),
        category: 'rate-limit',
        identifier: 'user-123',
        limit: 100,
        remaining: 5,
        blocked: false,
        endpoint: '/api/upload',
      }));
    });

    it('should log blocked rate limit events at warn level', () => {
      const logId = loggerUtils.logRateLimit('user-123', 100, 0, Date.now() + 60000);

      expect(mockLogger.warn).toHaveBeenCalledWith('Rate Limit', expect.objectContaining({
        remaining: 0,
        blocked: true,
      }));
    });
  });

  describe('Validation Error Logging', () => {
    it('should log validation errors with field details', () => {
      const logId = loggerUtils.logValidationError(
        'email',
        'invalid-email',
        'email format',
        { userId: 'user-123' }
      );

      expect(mockLogger.warn).toHaveBeenCalledWith('Validation Error', expect.objectContaining({
        logId: expect.stringMatching(/^log_/),
        category: 'validation',
        field: 'email',
        value: 'invalid-email',
        rule: 'email format',
        userId: 'user-123',
      }));
    });

    it('should truncate long validation values', () => {
      const longValue = 'very-long-value-'.repeat(20);
      loggerUtils.logValidationError('field', longValue, 'rule');

      const call = mockLogger.warn.mock.calls[0][1];
      expect(call.value.length).toBeLessThanOrEqual(100);
    });
  });
});
