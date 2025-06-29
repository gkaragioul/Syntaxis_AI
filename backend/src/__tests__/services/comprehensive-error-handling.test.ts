import { ComprehensiveErrorHandler } from '../../services/comprehensive-error-handler.service';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock PrismaClient
const mockPrisma = {
  systemErrorReport: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  invoice: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Comprehensive Error Handling Service', () => {
  let errorHandler: ComprehensiveErrorHandler;
  let testUserId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    errorHandler = new ComprehensiveErrorHandler(mockPrisma);
    testUserId = uuidv4();
  });

  describe('Error Classification and Categorization', () => {
    it('should classify validation errors correctly', async () => {
      const error = new Error('Invoice number format is invalid');
      error.name = 'ValidationError';

      const classification = await errorHandler.classifyError(error, {
        context: 'invoice_validation',
        userId: testUserId,
        invoiceId: uuidv4(),
      });

      expect(classification.category).toBe('validation');
      expect(classification.severity).toBe('medium');
      expect(classification.isRecoverable).toBe(true);
      expect(classification.userFriendlyMessage).toContain('corrected');
      expect(classification.suggestedActions).toContain('check format');
    });

    it('should classify database errors correctly', async () => {
      const error = new Error('Connection timeout');
      error.name = 'DatabaseError';

      const classification = await errorHandler.classifyError(error, {
        context: 'database_operation',
        userId: testUserId,
      });

      expect(classification.category).toBe('database');
      expect(classification.severity).toBe('high');
      expect(classification.isRecoverable).toBe(true);
      expect(classification.retryable).toBe(true);
      expect(classification.suggestedActions).toContain('retry');
    });

    it('should classify authentication errors correctly', async () => {
      const error = new Error('Invalid token');
      error.name = 'AuthenticationError';

      const classification = await errorHandler.classifyError(error, {
        context: 'authentication',
        userId: testUserId,
      });

      expect(classification.category).toBe('authentication');
      expect(classification.severity).toBe('high');
      expect(classification.isRecoverable).toBe(false);
      expect(classification.requiresUserAction).toBe(true);
      expect(classification.suggestedActions).toContain('login');
    });

    it('should classify system errors correctly', async () => {
      const error = new Error('Out of memory');
      error.name = 'SystemError';

      const classification = await errorHandler.classifyError(error, {
        context: 'system_operation',
        userId: testUserId,
      });

      expect(classification.category).toBe('system');
      expect(classification.severity).toBe('critical');
      expect(classification.isRecoverable).toBe(false);
      expect(classification.requiresAdminAction).toBe(true);
    });

    it('should classify business logic errors correctly', async () => {
      const error = new Error('Invoice already processed');
      error.name = 'BusinessLogicError';

      const classification = await errorHandler.classifyError(error, {
        context: 'invoice_processing',
        userId: testUserId,
        invoiceId: uuidv4(),
      });

      expect(classification.category).toBe('business_logic');
      expect(classification.severity).toBe('medium');
      expect(classification.isRecoverable).toBe(false);
      expect(classification.userFriendlyMessage).toContain('already processed');
    });

    it('should classify external service errors correctly', async () => {
      const error = new Error('OCR service unavailable');
      error.name = 'ExternalServiceError';

      const classification = await errorHandler.classifyError(error, {
        context: 'ocr_processing',
        userId: testUserId,
        serviceName: 'ocr_service',
      });

      expect(classification.category).toBe('external_service');
      expect(classification.severity).toBe('high');
      expect(classification.isRecoverable).toBe(true);
      expect(classification.retryable).toBe(true);
      expect(classification.retryDelay).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery Strategies', () => {
    it('should implement retry strategy for transient errors', async () => {
      const error = new Error('Network timeout');
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const result = await errorHandler.executeWithRetry(mockOperation, {
        maxRetries: 3,
        retryDelay: 100,
        backoffMultiplier: 1.5,
        retryCondition: (err) => err.message.includes('timeout'),
      });

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should implement circuit breaker for failing services', async () => {
      const error = new Error('Service unavailable');
      const mockOperation = jest.fn().mockRejectedValue(error);

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await errorHandler.executeWithCircuitBreaker('test_service', mockOperation);
        } catch (e) {
          // Expected to fail
        }
      }

      // Circuit should be open now
      const result = await errorHandler.executeWithCircuitBreaker('test_service', mockOperation);
      
      expect(result.circuitOpen).toBe(true);
      expect(result.error).toContain('Circuit breaker is open');
    });

    it('should implement fallback strategies', async () => {
      const primaryError = new Error('Primary service failed');
      const primaryOperation = jest.fn().mockRejectedValue(primaryError);
      const fallbackOperation = jest.fn().mockResolvedValue('fallback_result');

      const result = await errorHandler.executeWithFallback(
        primaryOperation,
        fallbackOperation,
        {
          fallbackCondition: (err) => err.message.includes('Primary service'),
        }
      );

      expect(result.value).toBe('fallback_result');
      expect(result.usedFallback).toBe(true);
      expect(primaryOperation).toHaveBeenCalledTimes(1);
      expect(fallbackOperation).toHaveBeenCalledTimes(1);
    });

    it('should implement graceful degradation', async () => {
      const error = new Error('Advanced feature unavailable');
      
      const result = await errorHandler.executeWithGracefulDegradation(
        () => { throw error; },
        {
          degradationLevel: 'basic',
          fallbackFeatures: ['basic_validation', 'simple_extraction'],
        }
      );

      expect(result.degraded).toBe(true);
      expect(result.availableFeatures).toContain('basic_validation');
      expect(result.unavailableFeatures).toContain('advanced_validation');
    });
  });

  describe('Error Reporting and Tracking', () => {
    it('should create comprehensive error reports', async () => {
      const error = new Error('Test error');
      const context = {
        userId: testUserId,
        invoiceId: uuidv4(),
        operation: 'invoice_processing',
        requestId: uuidv4(),
        userAgent: 'test-browser',
        ipAddress: '127.0.0.1',
      };

      const mockErrorReport = {
        id: uuidv4(),
        ...context,
        error: error.message,
        stack: error.stack,
        timestamp: new Date(),
      };

      mockPrisma.systemErrorReport.create.mockResolvedValue(mockErrorReport);

      const report = await errorHandler.createErrorReport(error, context);

      expect(report.id).toBeDefined();
      expect(report.userId).toBe(testUserId);
      expect(report.operation).toBe('invoice_processing');
      expect(report.severity).toBeDefined();
      expect(report.category).toBeDefined();
      expect(mockPrisma.systemErrorReport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: testUserId,
          error: error.message,
          stack: error.stack,
          context: expect.any(Object),
        }),
      });
    });

    it('should track error patterns and trends', async () => {
      const mockErrorReports = [
        {
          id: uuidv4(),
          category: 'validation',
          severity: 'medium',
          timestamp: new Date(),
          resolved: false,
        },
        {
          id: uuidv4(),
          category: 'validation',
          severity: 'medium',
          timestamp: new Date(),
          resolved: false,
        },
        {
          id: uuidv4(),
          category: 'database',
          severity: 'high',
          timestamp: new Date(),
          resolved: true,
        },
      ];

      mockPrisma.systemErrorReport.findMany.mockResolvedValue(mockErrorReports);

      const patterns = await errorHandler.analyzeErrorPatterns({
        timeRange: '24h',
        userId: testUserId,
      });

      expect(patterns.totalErrors).toBe(3);
      expect(patterns.unresolvedErrors).toBe(2);
      expect(patterns.categoryCounts.validation).toBe(2);
      expect(patterns.categoryCounts.database).toBe(1);
      expect(patterns.severityCounts.medium).toBe(2);
      expect(patterns.severityCounts.high).toBe(1);
      expect(patterns.trends).toBeDefined();
    });

    it('should generate error alerts for critical issues', async () => {
      const criticalError = new Error('System failure');
      const context = {
        userId: testUserId,
        operation: 'system_critical',
        severity: 'critical',
      };

      const alert = await errorHandler.generateErrorAlert(criticalError, context);

      expect(alert.severity).toBe('critical');
      expect(alert.requiresImmediateAttention).toBe(true);
      expect(alert.notificationChannels).toContain('email');
      expect(alert.notificationChannels).toContain('slack');
      expect(alert.escalationLevel).toBe('admin');
    });
  });

  describe('User-Friendly Error Messages', () => {
    it('should generate user-friendly messages for validation errors', async () => {
      const error = new Error('Field "invoiceNumber" is required');
      
      const message = await errorHandler.generateUserFriendlyMessage(error, {
        context: 'form_validation',
        field: 'invoiceNumber',
      });

      expect(message.title).toBe('Required Field Missing');
      expect(message.description).toContain('invoice number');
      expect(message.actionable).toBe(true);
      expect(message.actions).toContain('Please enter an invoice number');
    });

    it('should generate user-friendly messages for system errors', async () => {
      const error = new Error('Database connection failed');
      
      const message = await errorHandler.generateUserFriendlyMessage(error, {
        context: 'system_error',
      });

      expect(message.title).toBe('System Temporarily Unavailable');
      expect(message.description).toContain('experiencing technical difficulties');
      expect(message.actionable).toBe(true);
      expect(message.actions).toContain('try again');
    });

    it('should provide contextual help and suggestions', async () => {
      const error = new Error('Invalid file format');
      
      const message = await errorHandler.generateUserFriendlyMessage(error, {
        context: 'file_upload',
        fileType: 'invoice',
      });

      expect(message.title).toBe('Unsupported File Format');
      expect(message.description).toContain('file format');
      expect(message.suggestions).toContain('PDF');
      expect(message.suggestions).toContain('JPEG');
      expect(message.helpLink).toBeDefined();
    });
  });

  describe('Error Prevention and Monitoring', () => {
    it('should implement proactive error detection', async () => {
      const healthChecks = await errorHandler.performHealthChecks();

      expect(healthChecks.database).toBeDefined();
      expect(healthChecks.externalServices).toBeDefined();
      expect(healthChecks.systemResources).toBeDefined();
      expect(healthChecks.overallHealth).toBeDefined();
    });

    it('should monitor error rates and thresholds', async () => {
      const monitoring = await errorHandler.monitorErrorRates({
        timeWindow: '5m',
        thresholds: {
          errorRate: 0.05, // 5%
          criticalErrors: 3,
        },
      });

      expect(monitoring.currentErrorRate).toBeDefined();
      expect(monitoring.thresholdExceeded).toBeDefined();
      expect(monitoring.recommendations).toBeDefined();
    });

    it('should provide error prevention recommendations', async () => {
      const mockErrorHistory = [
        { category: 'validation', count: 10 },
        { category: 'authentication', count: 5 },
      ];

      const recommendations = await errorHandler.generatePreventionRecommendations(
        mockErrorHistory
      );

      expect(recommendations).toContain('Implement client-side validation');
      expect(recommendations).toContain('Add authentication checks');
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Error Context and Debugging', () => {
    it('should capture comprehensive error context', async () => {
      const error = new Error('Test error');
      const context = await errorHandler.captureErrorContext(error, {
        userId: testUserId,
        operation: 'test_operation',
        additionalData: { key: 'value' },
      });

      expect(context.timestamp).toBeDefined();
      expect(context.userId).toBe(testUserId);
      expect(context.operation).toBe('test_operation');
      expect(context.stackTrace).toBeDefined();
      expect(context.systemInfo).toBeDefined();
      expect(context.userSession).toBeDefined();
      expect(context.additionalData.key).toBe('value');
    });

    it('should provide debugging information for developers', async () => {
      const error = new Error('Complex error');
      const debugInfo = await errorHandler.generateDebugInfo(error, {
        includeStackTrace: true,
        includeSystemState: true,
        includeUserContext: true,
      });

      expect(debugInfo.errorDetails).toBeDefined();
      expect(debugInfo.stackTrace).toBeDefined();
      expect(debugInfo.systemState).toBeDefined();
      expect(debugInfo.userContext).toBeDefined();
      expect(debugInfo.possibleCauses).toBeDefined();
      expect(debugInfo.debuggingSteps).toBeDefined();
    });
  });

  describe('Error Recovery and Rollback', () => {
    it('should implement transaction rollback on errors', async () => {
      const mockTransaction = {
        rollback: jest.fn(),
        commit: jest.fn(),
      };

      const error = new Error('Transaction failed');
      
      const result = await errorHandler.executeWithTransactionRollback(
        async (tx) => {
          throw error;
        },
        mockTransaction
      );

      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockTransaction.commit).not.toHaveBeenCalled();
    });

    it('should implement state recovery mechanisms', async () => {
      const previousState = {
        invoiceStatus: 'pending',
        processingStage: 'validation',
      };

      const error = new Error('Processing failed');
      
      const recovery = await errorHandler.recoverState(error, {
        entityId: uuidv4(),
        entityType: 'invoice',
        previousState,
      });

      expect(recovery.stateRecovered).toBe(true);
      expect(recovery.recoveredState).toEqual(previousState);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume error processing efficiently', async () => {
      const errors = Array.from({ length: 1000 }, (_, i) => 
        new Error(`Error ${i}`)
      );

      const startTime = Date.now();
      
      const results = await errorHandler.processBatchErrors(errors, {
        batchSize: 100,
        parallel: true,
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(results.processed).toBe(1000);
      expect(results.failed).toBe(0);
      expect(processingTime).toBeLessThan(5000); // Should process in under 5 seconds
    });

    it('should implement error rate limiting', async () => {
      const rateLimiter = await errorHandler.createErrorRateLimiter({
        maxErrorsPerMinute: 10,
        userId: testUserId,
      });

      // Generate errors up to the limit
      for (let i = 0; i < 10; i++) {
        const allowed = await rateLimiter.allowError();
        expect(allowed).toBe(true);
      }

      // Next error should be rate limited
      const rateLimited = await rateLimiter.allowError();
      expect(rateLimited).toBe(false);
    });
  });
});
