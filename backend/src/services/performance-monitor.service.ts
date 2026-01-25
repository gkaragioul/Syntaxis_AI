import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export interface PerformanceMetrics {
  // Processing metrics
  processingTime: number;
  queueWaitTime?: number;
  totalTime: number;

  // OCR metrics
  engine: string;
  confidence: number;
  textLength: number;
  pageCount: number;

  // Quality metrics
  confidenceMetrics?: {
    overall: number;
    textQuality: number;
    structuralIntegrity: number;
    fieldAccuracy: number;
    processingReliability: number;
  };

  // Resource metrics
  memoryUsage?: number;
  cpuUsage?: number;

  // Error metrics
  errorCount: number;
  retryCount: number;
  fallbackUsed: boolean;
  enginesUsed: string[];

  // Context
  fileId: string;
  userId: string;
  fileSize: number;
  mimeType: string;
  timestamp: Date;
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalProcessed: number;
    averageProcessingTime: number;
    averageConfidence: number;
    successRate: number;
    fallbackRate: number;
  };
  engineComparison: {
    [engine: string]: {
      count: number;
      averageProcessingTime: number;
      averageConfidence: number;
      successRate: number;
    };
  };
  trends: {
    processingTimeByHour: Array<{ hour: number; averageTime: number }>;
    confidenceByFileType: Array<{
      mimeType: string;
      averageConfidence: number;
    }>;
    errorsByType: Array<{ errorType: string; count: number }>;
  };
}

export class PerformanceMonitorService {
  private prisma: PrismaClient;
  private metrics: Map<string, PerformanceMetrics> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Start tracking performance for a processing session
   */
  startTracking(
    sessionId: string,
    context: {
      fileId: string;
      userId: string;
      fileSize: number;
      mimeType: string;
      engine: string;
    },
  ): void {
    const metrics: PerformanceMetrics = {
      processingTime: 0,
      totalTime: 0,
      engine: context.engine,
      confidence: 0,
      textLength: 0,
      pageCount: 0,
      errorCount: 0,
      retryCount: 0,
      fallbackUsed: false,
      enginesUsed: [context.engine],
      fileId: context.fileId,
      userId: context.userId,
      fileSize: context.fileSize,
      mimeType: context.mimeType,
      timestamp: new Date(),
    };

    this.metrics.set(sessionId, metrics);

    logger.info('Performance tracking started', {
      sessionId,
      fileId: context.fileId,
      engine: context.engine,
      fileSize: context.fileSize,
    });
  }

  /**
   * Update processing metrics
   */
  updateProcessingMetrics(
    sessionId: string,
    updates: {
      processingTime?: number;
      queueWaitTime?: number;
      confidence?: number;
      textLength?: number;
      pageCount?: number;
      confidenceMetrics?: PerformanceMetrics['confidenceMetrics'];
    },
  ): void {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) {
      logger.warn('Performance metrics not found for session', { sessionId });
      return;
    }

    Object.assign(metrics, updates);

    // Calculate total time
    metrics.totalTime = (metrics.queueWaitTime || 0) + metrics.processingTime;

    this.metrics.set(sessionId, metrics);
  }

  /**
   * Record error occurrence
   */
  recordError(
    sessionId: string,
    errorType: string,
    isRetry: boolean = false,
  ): void {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) return;

    metrics.errorCount++;
    if (isRetry) {
      metrics.retryCount++;
    }

    logger.info('Performance error recorded', {
      sessionId,
      errorType,
      isRetry,
      totalErrors: metrics.errorCount,
      retries: metrics.retryCount,
    });
  }

  /**
   * Record fallback usage
   */
  recordFallback(sessionId: string, fallbackEngine: string): void {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) return;

    metrics.fallbackUsed = true;
    if (!metrics.enginesUsed.includes(fallbackEngine)) {
      metrics.enginesUsed.push(fallbackEngine);
    }

    logger.info('Performance fallback recorded', {
      sessionId,
      fallbackEngine,
      enginesUsed: metrics.enginesUsed,
    });
  }

  /**
   * Record resource usage
   */
  recordResourceUsage(
    sessionId: string,
    memoryUsage: number,
    cpuUsage?: number,
  ): void {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) return;

    metrics.memoryUsage = memoryUsage;
    if (cpuUsage !== undefined) {
      metrics.cpuUsage = cpuUsage;
    }
  }

  /**
   * Finish tracking and persist metrics
   */
  async finishTracking(
    sessionId: string,
    success: boolean = true,
  ): Promise<void> {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) {
      logger.warn('No metrics found to finish tracking', { sessionId });
      return;
    }

    try {
      // Store metrics in database
      await this.persistMetrics(metrics, success);

      // Log performance summary
      this.logPerformanceSummary(sessionId, metrics, success);

      // Check for performance alerts
      await this.checkPerformanceAlerts(metrics);

      // Clean up
      this.metrics.delete(sessionId);
    } catch (error) {
      logger.error('Failed to finish performance tracking', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Persist metrics to database
   */
  private async persistMetrics(
    metrics: PerformanceMetrics,
    success: boolean,
  ): Promise<void> {
    try {
      await this.prisma.performanceMetric.create({
        data: {
          fileId: metrics.fileId,
          userId: metrics.userId,
          engine: metrics.engine,
          processingTime: metrics.processingTime,
          queueWaitTime: metrics.queueWaitTime || 0,
          totalTime: metrics.totalTime,
          confidence: metrics.confidence,
          textLength: metrics.textLength,
          pageCount: metrics.pageCount,
          errorCount: metrics.errorCount,
          retryCount: metrics.retryCount,
          fallbackUsed: metrics.fallbackUsed,
          enginesUsed: metrics.enginesUsed,
          fileSize: metrics.fileSize,
          mimeType: metrics.mimeType,
          success,
          confidenceMetrics: metrics.confidenceMetrics as any,
          resourceUsage: {
            memory: metrics.memoryUsage,
            cpu: metrics.cpuUsage,
          },
          timestamp: metrics.timestamp,
        },
      });
    } catch (error) {
      logger.error('Failed to persist performance metrics', {
        fileId: metrics.fileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Log performance summary
   */
  private logPerformanceSummary(
    sessionId: string,
    metrics: PerformanceMetrics,
    success: boolean,
  ): void {
    const summary = {
      sessionId,
      success,
      engine: metrics.engine,
      processingTime: metrics.processingTime,
      totalTime: metrics.totalTime,
      confidence: metrics.confidence,
      textLength: metrics.textLength,
      errorCount: metrics.errorCount,
      retryCount: metrics.retryCount,
      fallbackUsed: metrics.fallbackUsed,
      enginesUsed: metrics.enginesUsed,
      fileSize: metrics.fileSize,
      mimeType: metrics.mimeType,
    };

    if (success) {
      logger.info('OCR processing completed successfully', summary);
    } else {
      logger.warn('OCR processing failed', summary);
    }
  }

  /**
   * Check for performance alerts
   */
  private async checkPerformanceAlerts(
    metrics: PerformanceMetrics,
  ): Promise<void> {
    const alerts: string[] = [];

    // Processing time alerts
    if (metrics.processingTime > 30000) {
      // 30 seconds
      alerts.push(`High processing time: ${metrics.processingTime}ms`);
    }

    // Confidence alerts
    if (metrics.confidence < 0.7) {
      alerts.push(`Low confidence: ${metrics.confidence}`);
    }

    // Error rate alerts
    if (metrics.errorCount > 2) {
      alerts.push(`High error count: ${metrics.errorCount}`);
    }

    // Memory usage alerts
    if (metrics.memoryUsage && metrics.memoryUsage > 500 * 1024 * 1024) {
      // 500MB
      alerts.push(
        `High memory usage: ${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`,
      );
    }

    if (alerts.length > 0) {
      logger.warn('Performance alerts detected', {
        fileId: metrics.fileId,
        engine: metrics.engine,
        alerts,
      });
    }
  }

  /**
   * Generate performance report for a time period
   */
  async generateReport(
    startDate: Date,
    endDate: Date,
  ): Promise<PerformanceReport> {
    const metrics = await this.prisma.performanceMetric.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalProcessed = metrics.length;
    const successfulMetrics = metrics.filter((m: any) => m.success);

    const summary = {
      totalProcessed,
      averageProcessingTime: this.calculateAverage(
        metrics.map((m: any) => m.processingTime),
      ),
      averageConfidence: this.calculateAverage(
        successfulMetrics.map((m: any) => m.confidence),
      ),
      successRate:
        totalProcessed > 0 ? successfulMetrics.length / totalProcessed : 0,
      fallbackRate:
        totalProcessed > 0
          ? metrics.filter((m: any) => m.fallbackUsed).length / totalProcessed
          : 0,
    };

    const engineComparison = this.generateEngineComparison(metrics);
    const trends = this.generateTrends(metrics);

    return {
      period: { start: startDate, end: endDate },
      summary,
      engineComparison,
      trends,
    };
  }

  /**
   * Get real-time performance statistics
   */
  async getRealTimeStats(): Promise<{
    activeProcessing: number;
    averageProcessingTime: number;
    currentSuccessRate: number;
    recentErrors: number;
  }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const recentMetrics = await this.prisma.performanceMetric.findMany({
      where: {
        timestamp: {
          gte: oneHourAgo,
        },
      },
    });

    const activeProcessing = this.metrics.size;
    const averageProcessingTime = this.calculateAverage(
      recentMetrics.map((m: any) => m.processingTime),
    );
    const currentSuccessRate =
      recentMetrics.length > 0
        ? recentMetrics.filter((m: any) => m.success).length / recentMetrics.length
        : 0;
    const recentErrors = recentMetrics.reduce(
      (sum: any, m: any) => sum + m.errorCount,
      0,
    );

    return {
      activeProcessing,
      averageProcessingTime,
      currentSuccessRate,
      recentErrors,
    };
  }

  /**
   * Helper methods
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private generateEngineComparison(
    metrics: any[],
  ): PerformanceReport['engineComparison'] {
    const engines = [...new Set(metrics.map((m) => m.engine))];
    const comparison: PerformanceReport['engineComparison'] = {};

    engines.forEach((engine) => {
      const engineMetrics = metrics.filter((m) => m.engine === engine);
      const successfulMetrics = engineMetrics.filter((m) => m.success);

      comparison[engine] = {
        count: engineMetrics.length,
        averageProcessingTime: this.calculateAverage(
          engineMetrics.map((m) => m.processingTime),
        ),
        averageConfidence: this.calculateAverage(
          successfulMetrics.map((m) => m.confidence),
        ),
        successRate:
          engineMetrics.length > 0
            ? successfulMetrics.length / engineMetrics.length
            : 0,
      };
    });

    return comparison;
  }

  private generateTrends(metrics: any[]): PerformanceReport['trends'] {
    // Processing time by hour
    const processingTimeByHour = Array.from({ length: 24 }, (_, hour) => {
      const hourMetrics = metrics.filter(
        (m) => new Date(m.timestamp).getHours() === hour,
      );
      return {
        hour,
        averageTime: this.calculateAverage(
          hourMetrics.map((m) => m.processingTime),
        ),
      };
    });

    // Confidence by file type
    const mimeTypes = [...new Set(metrics.map((m) => m.mimeType))];
    const confidenceByFileType = mimeTypes.map((mimeType) => {
      const typeMetrics = metrics.filter(
        (m) => m.mimeType === mimeType && m.success,
      );
      return {
        mimeType,
        averageConfidence: this.calculateAverage(
          typeMetrics.map((m) => m.confidence),
        ),
      };
    });

    // Errors by type (simplified - would need more detailed error tracking)
    const errorsByType = [
      {
        errorType: 'processing_errors',
        count: metrics.reduce((sum, m) => sum + m.errorCount, 0),
      },
      {
        errorType: 'fallback_usage',
        count: metrics.filter((m) => m.fallbackUsed).length,
      },
      {
        errorType: 'low_confidence',
        count: metrics.filter((m) => m.confidence < 0.7).length,
      },
    ];

    return {
      processingTimeByHour,
      confidenceByFileType,
      errorsByType,
    };
  }
}
