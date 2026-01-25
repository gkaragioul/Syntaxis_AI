import { PrismaClient } from '@prisma/client';
import { QADashboardService } from '../../../services/qa-dashboard.service';
import { logger } from '../../../utils/logger';

// Mock dependencies
jest.mock('../../../utils/logger');
jest.mock('@prisma/client');

describe('QADashboardService', () => {
  let service: QADashboardService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      invoice: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      reviewTask: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
    } as any;

    service = new QADashboardService(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getQualityMetrics', () => {
    it('should return comprehensive quality metrics for a user', async () => {
      const userId = 'user-123';
      const mockInvoices = [
        {
          id: 'inv-1',
          extractionConfidence: 0.95,
          validationStatus: 'passed',
          status: 'processed',
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'inv-2',
          extractionConfidence: 0.75,
          validationStatus: 'warning',
          status: 'processed',
          createdAt: new Date('2024-01-02'),
        },
      ];

      const mockReviewTasks = [
        {
          id: 'task-1',
          status: 'completed',
          priority: 'high',
          estimatedTime: 30,
          createdAt: new Date('2024-01-01'),
          completedAt: new Date('2024-01-01'),
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.reviewTask.findMany.mockResolvedValue(mockReviewTasks);
      mockPrisma.invoice.count.mockResolvedValue(2);
      mockPrisma.reviewTask.count.mockResolvedValue(1);

      const result = await service.getQualityMetrics(userId);

      expect(result).toEqual({
        totalInvoices: 2,
        averageConfidence: 0.85,
        confidenceDistribution: {
          high: 1, // >= 0.9
          medium: 1, // 0.7-0.89
          low: 0, // < 0.7
        },
        validationStats: {
          passed: 1,
          warning: 1,
          failed: 0,
        },
        reviewTaskStats: {
          total: 1,
          completed: 1,
          pending: 0,
          averageCompletionTime: expect.any(Number),
        },
        qualityTrends: expect.any(Array),
      });

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith({
        where: { userId },
        select: {
          id: true,
          extractionConfidence: true,
          validationStatus: true,
          status: true,
          createdAt: true,
        },
      });
    });

    it('should handle empty data gracefully', async () => {
      const userId = 'user-empty';

      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.reviewTask.findMany.mockResolvedValue([]);
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.reviewTask.count.mockResolvedValue(0);

      const result = await service.getQualityMetrics(userId);

      expect(result).toEqual({
        totalInvoices: 0,
        averageConfidence: 0,
        confidenceDistribution: {
          high: 0,
          medium: 0,
          low: 0,
        },
        validationStats: {
          passed: 0,
          warning: 0,
          failed: 0,
        },
        reviewTaskStats: {
          total: 0,
          completed: 0,
          pending: 0,
          averageCompletionTime: 0,
        },
        qualityTrends: [],
      });
    });

    it('should throw error when database query fails', async () => {
      const userId = 'user-error';
      const dbError = new Error('Database connection failed');

      mockPrisma.invoice.findMany.mockRejectedValue(dbError);

      await expect(service.getQualityMetrics(userId)).rejects.toThrow(
        'Database connection failed',
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get quality metrics',
        { error: dbError, userId },
      );
    });
  });

  describe('getProcessingMetrics', () => {
    it('should return processing performance metrics', async () => {
      const userId = 'user-123';
      const timeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      const mockProcessingData = [
        {
          status: 'processed',
          _count: 10,
          _avg: { extractionConfidence: 0.85 },
        },
        {
          status: 'failed',
          _count: 2,
          _avg: { extractionConfidence: null },
        },
      ];

      mockPrisma.invoice.groupBy.mockResolvedValue(mockProcessingData);

      const result = await service.getProcessingMetrics(userId, timeRange);

      expect(result).toEqual({
        totalProcessed: 12,
        successRate: 83.33, // 10/12 * 100
        failureRate: 16.67, // 2/12 * 100
        averageProcessingTime: expect.any(Number),
        throughputPerDay: expect.any(Number),
        statusBreakdown: {
          processed: 10,
          failed: 2,
        },
      });
    });
  });

  describe('getReviewQueueMetrics', () => {
    it('should return review queue statistics', async () => {
      const userId = 'user-123';
      const mockReviewTasks = [
        {
          id: 'task-1',
          status: 'pending',
          priority: 'high',
          createdAt: new Date('2024-01-01'),
          dueDate: new Date('2024-01-02'),
        },
        {
          id: 'task-2',
          status: 'completed',
          priority: 'medium',
          createdAt: new Date('2024-01-01'),
          completedAt: new Date('2024-01-01'),
        },
      ];

      mockPrisma.reviewTask.findMany.mockResolvedValue(mockReviewTasks);

      const result = await service.getReviewQueueMetrics(userId);

      expect(result).toEqual({
        totalTasks: 2,
        pendingTasks: 1,
        completedTasks: 1,
        overdueTasks: expect.any(Number),
        priorityBreakdown: {
          high: 1,
          medium: 1,
          low: 0,
        },
        averageWaitTime: expect.any(Number),
      });
    });
  });

  describe('getFilteredMetrics', () => {
    it('should apply filters correctly', async () => {
      const userId = 'user-123';
      const filters = {
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
        confidenceThreshold: 0.8,
        status: ['processed', 'warning'],
      };

      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.reviewTask.findMany.mockResolvedValue([]);

      await service.getFilteredMetrics(userId, filters);

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          createdAt: {
            gte: filters.dateRange.start,
            lte: filters.dateRange.end,
          },
          extractionConfidence: {
            gte: filters.confidenceThreshold,
          },
          validationStatus: {
            in: filters.status,
          },
        },
        select: expect.any(Object),
      });
    });
  });
});
