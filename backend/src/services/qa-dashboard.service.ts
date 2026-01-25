import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export interface QualityMetrics {
  totalInvoices: number;
  averageConfidence: number;
  confidenceDistribution: {
    high: number; // >= 0.9
    medium: number; // 0.7-0.89
    low: number; // < 0.7
  };
  validationStats: {
    passed: number;
    warning: number;
    failed: number;
  };
  reviewTaskStats: {
    total: number;
    completed: number;
    pending: number;
    averageCompletionTime: number;
  };
  qualityTrends: Array<{
    date: string;
    averageConfidence: number;
    totalProcessed: number;
  }>;
}

export interface ProcessingMetrics {
  totalProcessed: number;
  successRate: number;
  failureRate: number;
  averageProcessingTime: number;
  throughputPerDay: number;
  statusBreakdown: Record<string, number>;
}

export interface ReviewQueueMetrics {
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  overdueTasks: number;
  priorityBreakdown: {
    high: number;
    medium: number;
    low: number;
  };
  averageWaitTime: number;
}

export interface MetricFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  confidenceThreshold?: number;
  status?: string[];
  priority?: string[];
}

export class QADashboardService {
  constructor(private prisma: PrismaClient) {}

  async getQualityMetrics(userId: string): Promise<QualityMetrics> {
    try {
      // Get all invoices for the user
      const invoices = await this.prisma.invoice.findMany({
        where: { userId },
        select: {
          id: true,
          extractionConfidence: true,
          validationStatus: true,
          status: true,
          createdAt: true,
        },
      });

      // Get review tasks
      const reviewTasks = await this.prisma.reviewTask.findMany({
        where: {
          invoice: { userId },
        },
        select: {
          id: true,
          status: true,
          priority: true,
          estimatedTime: true,
          createdAt: true,
          completedAt: true,
        },
      });

      // Calculate metrics
      const totalInvoices = invoices.length;
      const averageConfidence =
        totalInvoices > 0
          ? invoices.reduce(
              (sum: number, inv: any) =>
                sum + this.getConfidenceValue(inv.extractionConfidence),
              0,
            ) / totalInvoices
          : 0;

      // Confidence distribution
      const confidenceDistribution = {
        high: invoices.filter(
          (inv: any) => this.getConfidenceValue(inv.extractionConfidence) >= 0.9,
        ).length,
        medium: invoices.filter((inv: any) => {
          const conf = this.getConfidenceValue(inv.extractionConfidence);
          return conf >= 0.7 && conf < 0.9;
        }).length,
        low: invoices.filter(
          (inv: any) => this.getConfidenceValue(inv.extractionConfidence) < 0.7,
        ).length,
      };

      // Validation stats
      const validationStats = {
        passed: invoices.filter((inv: any) => inv.validationStatus === 'passed')
          .length,
        warning: invoices.filter((inv: any) => inv.validationStatus === 'warning')
          .length,
        failed: invoices.filter((inv: any) => inv.validationStatus === 'failed')
          .length,
      };

      // Review task stats
      const completedTasks = reviewTasks.filter(
        (task: any) => task.status === 'completed',
      );
      const averageCompletionTime =
        completedTasks.length > 0
          ? completedTasks.reduce((sum: number, task: any) => {
              if (task.completedAt && task.createdAt) {
                return (
                  sum + (task.completedAt.getTime() - task.createdAt.getTime())
                );
              }
              return sum;
            }, 0) / completedTasks.length
          : 0;

      const reviewTaskStats = {
        total: reviewTasks.length,
        completed: completedTasks.length,
        pending: reviewTasks.filter((task: any) => task.status === 'pending').length,
        averageCompletionTime,
      };

      // Quality trends (simplified for now)
      const qualityTrends = this.calculateQualityTrends(invoices);

      return {
        totalInvoices,
        averageConfidence,
        confidenceDistribution,
        validationStats,
        reviewTaskStats,
        qualityTrends,
      };
    } catch (error) {
      logger.error('Failed to get quality metrics', { error, userId });
      throw error;
    }
  }

  async getProcessingMetrics(
    userId: string,
    timeRange: { start: Date; end: Date },
  ): Promise<ProcessingMetrics> {
    try {
      const processingData = await this.prisma.invoice.groupBy({
        by: ['status'],
        where: {
          userId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
        _count: true,
        _avg: {
          extractionConfidence: true,
        },
      });

      const totalProcessed = processingData.reduce(
        (sum: number, item: any) => sum + item._count,
        0,
      );
      const processedCount =
        processingData.find((item: any) => item.status === 'processed')?._count || 0;
      const failedCount =
        processingData.find((item: any) => item.status === 'failed')?._count || 0;

      const successRate =
        totalProcessed > 0 ? (processedCount / totalProcessed) * 100 : 0;
      const failureRate =
        totalProcessed > 0 ? (failedCount / totalProcessed) * 100 : 0;

      // Calculate throughput per day
      const daysDiff = Math.max(
        1,
        Math.ceil(
          (timeRange.end.getTime() - timeRange.start.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      const throughputPerDay = totalProcessed / daysDiff;

      const statusBreakdown = processingData.reduce(
        (acc: any, item: any) => {
          acc[item.status] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Calculate average processing time from extraction data
      const extractionStats = await this.prisma.extraction.aggregate({
        where: {
          userId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
        _avg: {
          processingTimeMs: true,
        },
      });

      const averageProcessingTime = extractionStats._avg.processingTimeMs || 0;

      return {
        totalProcessed,
        successRate: Math.round(successRate * 100) / 100,
        failureRate: Math.round(failureRate * 100) / 100,
        averageProcessingTime: Math.round(averageProcessingTime),
        throughputPerDay: Math.round(throughputPerDay * 100) / 100,
        statusBreakdown,
      };
    } catch (error) {
      logger.error('Failed to get processing metrics', {
        error,
        userId,
        timeRange,
      });
      throw error;
    }
  }

  async getReviewQueueMetrics(userId: string): Promise<ReviewQueueMetrics> {
    try {
      const reviewTasks = await this.prisma.reviewTask.findMany({
        where: {
          invoice: { userId },
        },
        select: {
          id: true,
          status: true,
          priority: true,
          createdAt: true,
          dueDate: true,
          completedAt: true,
        },
      });

      const now = new Date();
      const overdueTasks = reviewTasks.filter(
        (task: any) =>
          task.status === 'pending' && task.dueDate && task.dueDate < now,
      ).length;

      const priorityBreakdown = {
        high: reviewTasks.filter((task: any) => task.priority === 'high').length,
        medium: reviewTasks.filter((task: any) => task.priority === 'medium').length,
        low: reviewTasks.filter((task: any) => task.priority === 'low').length,
      };

      // Calculate average wait time for pending tasks
      const pendingTasks = reviewTasks.filter(
        (task: any) => task.status === 'pending',
      );
      const averageWaitTime =
        pendingTasks.length > 0
          ? pendingTasks.reduce(
              (sum: number, task: any) => sum + (now.getTime() - task.createdAt.getTime()),
              0,
            ) / pendingTasks.length
          : 0;

      return {
        totalTasks: reviewTasks.length,
        pendingTasks: pendingTasks.length,
        completedTasks: reviewTasks.filter(
          (task: any) => task.status === 'completed',
        ).length,
        overdueTasks,
        priorityBreakdown,
        averageWaitTime,
      };
    } catch (error) {
      logger.error('Failed to get review queue metrics', { error, userId });
      throw error;
    }
  }

  async getFilteredMetrics(
    userId: string,
    filters: MetricFilters,
  ): Promise<QualityMetrics> {
    try {
      const whereConditions: any = { userId };

      if (filters.dateRange) {
        whereConditions.createdAt = {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end,
        };
      }

      if (filters.confidenceThreshold !== undefined) {
        whereConditions.extractionConfidence = {
          gte: filters.confidenceThreshold,
        };
      }

      if (filters.status && filters.status.length > 0) {
        whereConditions.validationStatus = {
          in: filters.status,
        };
      }

      const invoices = await this.prisma.invoice.findMany({
        where: whereConditions,
        select: {
          id: true,
          extractionConfidence: true,
          validationStatus: true,
          status: true,
          createdAt: true,
        },
      });

      // Use the same calculation logic as getQualityMetrics but with filtered data
      return this.calculateQualityMetricsFromInvoices(invoices, userId);
    } catch (error) {
      logger.error('Failed to get filtered metrics', {
        error,
        userId,
        filters,
      });
      throw error;
    }
  }

  private calculateQualityTrends(
    invoices: any[],
  ): Array<{
    date: string;
    averageConfidence: number;
    totalProcessed: number;
  }> {
    // Group invoices by date and calculate trends
    const groupedByDate = invoices.reduce(
      (acc, invoice) => {
        const date = invoice.createdAt.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(invoice);
        return acc;
      },
      {} as Record<string, any[]>,
    );

    return Object.entries(groupedByDate).map(([date, dayInvoices]: any) => ({
      date,
      averageConfidence:
        (dayInvoices as any[]).reduce(
          (sum: number, inv: any) => sum + this.getConfidenceValue(inv.extractionConfidence),
          0,
        ) / (dayInvoices as any[]).length,
      totalProcessed: (dayInvoices as any[]).length,
    }));
  }

  private getConfidenceValue(confidence: any): number {
    if (confidence === null || confidence === undefined) {
      return 0;
    }
    // Handle Prisma Decimal type
    if (
      typeof confidence === 'object' &&
      typeof confidence.toNumber === 'function'
    ) {
      return confidence.toNumber();
    }
    // Handle regular number
    if (typeof confidence === 'number') {
      return confidence;
    }
    return 0;
  }

  private async calculateQualityMetricsFromInvoices(
    invoices: any[],
    userId: string,
  ): Promise<QualityMetrics> {
    // This is a helper method to avoid code duplication
    // Implementation would be similar to getQualityMetrics but using the provided invoices
    const reviewTasks = await this.prisma.reviewTask.findMany({
      where: { invoice: { userId } },
      select: {
        id: true,
        status: true,
        priority: true,
        estimatedTime: true,
        createdAt: true,
        completedAt: true,
      },
    });

    // Calculate metrics using the same logic as getQualityMetrics
    const totalInvoices = invoices.length;
    const averageConfidence =
      totalInvoices > 0
        ? invoices.reduce(
            (sum, inv) =>
              sum + this.getConfidenceValue(inv.extractionConfidence),
            0,
          ) / totalInvoices
        : 0;

    const confidenceDistribution = {
      high: invoices.filter(
        (inv) => this.getConfidenceValue(inv.extractionConfidence) >= 0.9,
      ).length,
      medium: invoices.filter((inv) => {
        const conf = this.getConfidenceValue(inv.extractionConfidence);
        return conf >= 0.7 && conf < 0.9;
      }).length,
      low: invoices.filter(
        (inv) => this.getConfidenceValue(inv.extractionConfidence) < 0.7,
      ).length,
    };

    const validationStats = {
      passed: invoices.filter((inv) => inv.validationStatus === 'passed')
        .length,
      warning: invoices.filter((inv) => inv.validationStatus === 'warning')
        .length,
      failed: invoices.filter((inv) => inv.validationStatus === 'failed')
        .length,
    };

    const completedTasks = reviewTasks.filter(
      (task: any) => task.status === 'completed',
    );
    const averageCompletionTime =
      completedTasks.length > 0
        ? completedTasks.reduce((sum: number, task: any) => {
            if (task.completedAt && task.createdAt) {
              return (
                sum + (task.completedAt.getTime() - task.createdAt.getTime())
              );
            }
            return sum;
          }, 0) / completedTasks.length
        : 0;

    const reviewTaskStats = {
      total: reviewTasks.length,
      completed: completedTasks.length,
      pending: reviewTasks.filter((task: any) => task.status === 'pending').length,
      averageCompletionTime,
    };

    const qualityTrends = this.calculateQualityTrends(invoices);

    return {
      totalInvoices,
      averageConfidence,
      confidenceDistribution,
      validationStats,
      reviewTaskStats,
      qualityTrends,
    };
  }
}
