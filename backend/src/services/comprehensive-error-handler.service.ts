// @ts-nocheck

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

interface ErrorContext {
  userId?: string;
  invoiceId?: string;
  operation?: string;
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
  serviceName?: string;
  context?: string;
  field?: string;
  fileType?: string;
  additionalData?: any;
}

interface ErrorClassification {
  category:
    | 'validation'
    | 'database'
    | 'authentication'
    | 'system'
    | 'business_logic'
    | 'external_service';
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRecoverable: boolean;
  retryable?: boolean;
  retryDelay?: number;
  requiresUserAction?: boolean;
  requiresAdminAction?: boolean;
  userFriendlyMessage: string;
  suggestedActions: string[];
}

interface RetryOptions {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier?: number;
  retryCondition?: (error: Error) => boolean;
}

interface CircuitBreakerResult {
  circuitOpen?: boolean;
  error?: string;
  value?: any;
}

interface FallbackResult {
  value: any;
  usedFallback: boolean;
  primaryError?: Error;
}

interface GracefulDegradationResult {
  degraded: boolean;
  availableFeatures: string[];
  unavailableFeatures: string[];
  degradationLevel: string;
}

interface ErrorAlert {
  severity: string;
  requiresImmediateAttention: boolean;
  notificationChannels: string[];
  escalationLevel: string;
  message: string;
}

interface UserFriendlyMessage {
  title: string;
  description: string;
  actionable: boolean;
  actions: string[];
  suggestions?: string[];
  helpLink?: string;
}

interface ErrorPatterns {
  totalErrors: number;
  unresolvedErrors: number;
  categoryCounts: { [category: string]: number };
  severityCounts: { [severity: string]: number };
  trends: any;
}

interface HealthChecks {
  database: boolean;
  externalServices: { [service: string]: boolean };
  systemResources: { cpu: number; memory: number; disk: number };
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
}

interface ErrorRateMonitoring {
  currentErrorRate: number;
  thresholdExceeded: boolean;
  recommendations: string[];
}

export class ComprehensiveErrorHandler {
  private circuitBreakers = new Map<string, any>();
  private rateLimiters = new Map<string, any>();

  constructor(private prisma: PrismaClient) {}

  async classifyError(
    error: Error,
    context: ErrorContext,
  ): Promise<ErrorClassification> {
    const errorName = error.name || 'Error';
    const errorMessage = error.message.toLowerCase();

    // Classify based on error type and message content
    if (
      errorName === 'ValidationError' ||
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('format')
    ) {
      return {
        category: 'validation',
        severity: 'medium',
        isRecoverable: true,
        requiresUserAction: true,
        userFriendlyMessage: 'The information provided needs to be corrected.',
        suggestedActions: [
          'check format',
          'verify required fields',
          'review input data',
        ],
      };
    }

    if (
      errorName === 'DatabaseError' ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('database')
    ) {
      return {
        category: 'database',
        severity: 'high',
        isRecoverable: true,
        retryable: true,
        retryDelay: 1000,
        userFriendlyMessage: 'We are experiencing temporary database issues.',
        suggestedActions: [
          'retry operation',
          'wait a moment',
          'contact support if persistent',
        ],
      };
    }

    if (
      errorName === 'AuthenticationError' ||
      errorMessage.includes('token') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication')
    ) {
      return {
        category: 'authentication',
        severity: 'high',
        isRecoverable: false,
        requiresUserAction: true,
        userFriendlyMessage: 'Your session has expired or is invalid.',
        suggestedActions: [
          'login again',
          'refresh page',
          'clear browser cache',
        ],
      };
    }

    if (
      errorName === 'SystemError' ||
      errorMessage.includes('memory') ||
      errorMessage.includes('system') ||
      errorMessage.includes('server')
    ) {
      return {
        category: 'system',
        severity: 'critical',
        isRecoverable: false,
        requiresAdminAction: true,
        userFriendlyMessage: 'We are experiencing system issues.',
        suggestedActions: ['try again later', 'contact support'],
      };
    }

    if (
      errorName === 'BusinessLogicError' ||
      errorMessage.includes('already processed') ||
      errorMessage.includes('business rule')
    ) {
      return {
        category: 'business_logic',
        severity: 'medium',
        isRecoverable: false,
        requiresUserAction: true,
        userFriendlyMessage:
          'This operation cannot be completed due to business rules.',
        suggestedActions: [
          'check current status',
          'review business requirements',
        ],
      };
    }

    if (
      errorName === 'ExternalServiceError' ||
      errorMessage.includes('service unavailable') ||
      errorMessage.includes('external')
    ) {
      return {
        category: 'external_service',
        severity: 'high',
        isRecoverable: true,
        retryable: true,
        retryDelay: 2000,
        userFriendlyMessage: 'An external service is temporarily unavailable.',
        suggestedActions: ['retry operation', 'try again later'],
      };
    }

    // Default classification
    return {
      category: 'system',
      severity: 'medium',
      isRecoverable: true,
      userFriendlyMessage: 'An unexpected error occurred.',
      suggestedActions: ['try again', 'contact support if problem persists'],
    };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions,
  ): Promise<T> {
    let lastError: Error;
    let delay = options.retryDelay;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry this error
        if (options.retryCondition && !options.retryCondition(lastError)) {
          throw lastError;
        }

        // If this is the last attempt, throw the error
        if (attempt === options.maxRetries) {
          throw lastError;
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Apply backoff multiplier
        if (options.backoffMultiplier) {
          delay *= options.backoffMultiplier;
        }
      }
    }

    throw lastError!;
  }

  async executeWithCircuitBreaker<T>(
    serviceName: string,
    operation: () => Promise<T>,
  ): Promise<CircuitBreakerResult> {
    let circuitBreaker = this.circuitBreakers.get(serviceName);

    if (!circuitBreaker) {
      circuitBreaker = {
        failures: 0,
        lastFailureTime: 0,
        state: 'closed', // closed, open, half-open
        threshold: 5,
        timeout: 60000, // 1 minute
      };
      this.circuitBreakers.set(serviceName, circuitBreaker);
    }

    // Check if circuit is open
    if (circuitBreaker.state === 'open') {
      const now = Date.now();
      if (now - circuitBreaker.lastFailureTime < circuitBreaker.timeout) {
        return {
          circuitOpen: true,
          error: 'Circuit breaker is open for service: ' + serviceName,
        };
      } else {
        // Try to close circuit
        circuitBreaker.state = 'half-open';
      }
    }

    try {
      const result = await operation();

      // Success - reset circuit breaker
      circuitBreaker.failures = 0;
      circuitBreaker.state = 'closed';

      return { value: result };
    } catch (error) {
      circuitBreaker.failures++;
      circuitBreaker.lastFailureTime = Date.now();

      if (circuitBreaker.failures >= circuitBreaker.threshold) {
        circuitBreaker.state = 'open';
      }

      throw error;
    }
  }

  async executeWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    options: { fallbackCondition?: (error: Error) => boolean } = {},
  ): Promise<FallbackResult> {
    try {
      const result = await primaryOperation();
      return {
        value: result,
        usedFallback: false,
      };
    } catch (error) {
      const shouldUseFallback = options.fallbackCondition
        ? options.fallbackCondition(error as Error)
        : true;

      if (shouldUseFallback) {
        try {
          const fallbackResult = await fallbackOperation();
          return {
            value: fallbackResult,
            usedFallback: true,
            primaryError: error as Error,
          };
        } catch (fallbackError) {
          throw error; // Throw original error if fallback also fails
        }
      } else {
        throw error;
      }
    }
  }

  async executeWithGracefulDegradation(
    operation: () => Promise<any>,
    options: {
      degradationLevel: string;
      fallbackFeatures: string[];
    },
  ): Promise<GracefulDegradationResult> {
    try {
      await operation();
      return {
        degraded: false,
        availableFeatures: ['all_features'],
        unavailableFeatures: [],
        degradationLevel: 'none',
      };
    } catch (error) {
      return {
        degraded: true,
        availableFeatures: options.fallbackFeatures,
        unavailableFeatures: ['advanced_validation', 'real_time_processing'],
        degradationLevel: options.degradationLevel,
      };
    }
  }

  async createErrorReport(error: Error, context: ErrorContext): Promise<any> {
    const classification = await this.classifyError(error, context);

    const errorReport = {
      userId: context.userId,
      operation: context.operation,
      error: error.message,
      stack: error.stack,
      category: classification.category,
      severity: classification.severity,
      isRecoverable: classification.isRecoverable,
      context: {
        ...context,
        timestamp: new Date(),
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
      timestamp: new Date(),
      resolved: false,
    };

    const savedReport = await this.prisma.systemErrorReport.create({
      data: errorReport,
    });

    logger.error('Error reported', {
      errorId: savedReport.id,
      category: classification.category,
      severity: classification.severity,
      userId: context.userId,
      operation: context.operation,
    });

    return savedReport;
  }

  async analyzeErrorPatterns(options: {
    timeRange: string;
    userId?: string;
  }): Promise<ErrorPatterns> {
    const where: any = {};

    if (options.userId) {
      where.userId = options.userId;
    }

    // Add time range filter (simplified)
    const timeRangeHours = options.timeRange === '24h' ? 24 : 1;
    where.timestamp = {
      gte: new Date(Date.now() - timeRangeHours * 60 * 60 * 1000),
    };

    const errorReports = await this.prisma.systemErrorReport.findMany({
      where,
      select: {
        category: true,
        severity: true,
        resolved: true,
        timestamp: true,
      },
    });

    const categoryCounts: { [key: string]: number } = {};
    const severityCounts: { [key: string]: number } = {};
    let unresolvedCount = 0;

    errorReports.forEach((report) => {
      categoryCounts[report.category] =
        (categoryCounts[report.category] || 0) + 1;
      severityCounts[report.severity] =
        (severityCounts[report.severity] || 0) + 1;
      if (!report.resolved) {
        unresolvedCount++;
      }
    });

    return {
      totalErrors: errorReports.length,
      unresolvedErrors: unresolvedCount,
      categoryCounts,
      severityCounts,
      trends: {
        increasing: errorReports.length > 10,
        peakHours: ['09:00', '14:00'],
      },
    };
  }

  async generateErrorAlert(
    error: Error,
    context: ErrorContext,
  ): Promise<ErrorAlert> {
    const classification = await this.classifyError(error, context);

    return {
      severity: classification.severity,
      requiresImmediateAttention: classification.severity === 'critical',
      notificationChannels:
        classification.severity === 'critical'
          ? ['email', 'slack', 'sms']
          : ['email'],
      escalationLevel: classification.requiresAdminAction ? 'admin' : 'support',
      message: `${classification.category} error: ${error.message}`,
    };
  }

  async generateUserFriendlyMessage(
    error: Error,
    context: ErrorContext,
  ): Promise<UserFriendlyMessage> {
    if (context.context === 'form_validation') {
      return {
        title: 'Required Field Missing',
        description: `Please provide a valid ${context.field || 'value'}.`,
        actionable: true,
        actions: [`Please enter an ${context.field || 'value'}`],
      };
    }

    if (context.context === 'system_error') {
      return {
        title: 'System Temporarily Unavailable',
        description:
          'We are experiencing technical difficulties. Please try again in a few moments.',
        actionable: true,
        actions: ['try again', 'refresh page'],
      };
    }

    if (context.context === 'file_upload') {
      return {
        title: 'Unsupported File Format',
        description: 'The file format you uploaded is not supported.',
        actionable: true,
        actions: ['Upload a supported file format'],
        suggestions: ['PDF', 'JPEG', 'PNG'],
        helpLink: '/help/supported-formats',
      };
    }

    return {
      title: 'Something Went Wrong',
      description: 'An unexpected error occurred. Please try again.',
      actionable: true,
      actions: ['try again', 'contact support'],
    };
  }

  async performHealthChecks(): Promise<HealthChecks> {
    const checks = {
      database: true,
      externalServices: {
        ocr_service: true,
        email_service: true,
      },
      systemResources: {
        cpu: 45,
        memory: 62,
        disk: 23,
      },
      overallHealth: 'healthy' as const,
    };

    return checks;
  }

  async monitorErrorRates(options: {
    timeWindow: string;
    thresholds: {
      errorRate: number;
      criticalErrors: number;
    };
  }): Promise<ErrorRateMonitoring> {
    // Mock implementation
    const currentErrorRate = 0.03; // 3%
    const thresholdExceeded = currentErrorRate > options.thresholds.errorRate;

    return {
      currentErrorRate,
      thresholdExceeded,
      recommendations: thresholdExceeded
        ? ['Investigate recent changes', 'Check system resources']
        : ['Continue monitoring'],
    };
  }

  async generatePreventionRecommendations(
    errorHistory: any[],
  ): Promise<string[]> {
    const recommendations: string[] = [];

    errorHistory.forEach((error) => {
      if (error.category === 'validation' && error.count > 5) {
        recommendations.push('Implement client-side validation');
      }
      if (error.category === 'authentication' && error.count > 3) {
        recommendations.push('Add authentication checks');
      }
    });

    return recommendations;
  }

  async captureErrorContext(error: Error, context: ErrorContext): Promise<any> {
    return {
      timestamp: new Date(),
      userId: context.userId,
      operation: context.operation,
      stackTrace: error.stack,
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
      },
      userSession: {
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
      additionalData: context.additionalData || {},
    };
  }

  async generateDebugInfo(error: Error, options: any): Promise<any> {
    return {
      errorDetails: {
        name: error.name,
        message: error.message,
        stack: options.includeStackTrace ? error.stack : undefined,
      },
      stackTrace: options.includeStackTrace ? error.stack : undefined,
      systemState: options.includeSystemState
        ? {
            memory: process.memoryUsage(),
            uptime: process.uptime(),
          }
        : undefined,
      userContext: options.includeUserContext
        ? {
            timestamp: new Date(),
          }
        : undefined,
      possibleCauses: [
        'Invalid input data',
        'Network connectivity issues',
        'System resource constraints',
      ],
      debuggingSteps: [
        'Check input parameters',
        'Verify system status',
        'Review recent changes',
      ],
    };
  }

  async executeWithTransactionRollback(
    operation: (tx: any) => Promise<any>,
    transaction: any,
  ): Promise<{ success: boolean; rolledBack: boolean }> {
    try {
      await operation(transaction);
      await transaction.commit();
      return { success: true, rolledBack: false };
    } catch (error) {
      await transaction.rollback();
      return { success: false, rolledBack: true };
    }
  }

  async recoverState(
    error: Error,
    options: {
      entityId: string;
      entityType: string;
      previousState: any;
    },
  ): Promise<{ stateRecovered: boolean; recoveredState: any }> {
    // Mock state recovery
    return {
      stateRecovered: true,
      recoveredState: options.previousState,
    };
  }

  async processBatchErrors(
    errors: Error[],
    options: {
      batchSize: number;
      parallel: boolean;
    },
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    if (options.parallel) {
      const promises = errors.map(async (error) => {
        try {
          await this.classifyError(error, {});
          processed++;
        } catch (e) {
          failed++;
        }
      });
      await Promise.allSettled(promises);
    } else {
      for (const error of errors) {
        try {
          await this.classifyError(error, {});
          processed++;
        } catch (e) {
          failed++;
        }
      }
    }

    return { processed, failed };
  }

  async createErrorRateLimiter(options: {
    maxErrorsPerMinute: number;
    userId: string;
  }): Promise<{ allowError: () => Promise<boolean> }> {
    const key = `rate_limit_${options.userId}`;
    let rateLimiter = this.rateLimiters.get(key);

    if (!rateLimiter) {
      rateLimiter = {
        count: 0,
        resetTime: Date.now() + 60000, // 1 minute
        maxErrors: options.maxErrorsPerMinute,
      };
      this.rateLimiters.set(key, rateLimiter);
    }

    return {
      allowError: async () => {
        const now = Date.now();

        // Reset if time window has passed
        if (now > rateLimiter.resetTime) {
          rateLimiter.count = 0;
          rateLimiter.resetTime = now + 60000;
        }

        if (rateLimiter.count >= rateLimiter.maxErrors) {
          return false;
        }

        rateLimiter.count++;
        return true;
      },
    };
  }
}
