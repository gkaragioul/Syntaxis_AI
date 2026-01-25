import request from 'supertest';
import express from 'express';

// Mock all dependencies before importing
jest.mock('../../../services/qa-dashboard.service');
jest.mock('../../../middleware/auth.middleware');
jest.mock('../../../middleware/validation');
jest.mock('../../../middleware/rateLimit');
jest.mock('../../../utils/asyncHandler');
jest.mock('../../../index', () => ({
  prisma: {},
}));
jest.mock('../../../utils/logger');

import {
  qaDashboardRoutes,
  qaDashboardService,
} from '../../../routes/qa-dashboard.routes';
import { QADashboardService } from '../../../services/qa-dashboard.service';
import { authenticate } from '../../../middleware/auth.middleware';

describe('QA Dashboard Routes', () => {
  let app: express.Application;
  let mockQADashboardService: jest.Mocked<QADashboardService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    (authenticate as jest.Mock).mockImplementation(
      (req: any, res: any, next: any) => {
        req.user = { id: 'user-123' };
        next();
      },
    );

    // Mock other middleware
    const { validateRequest } = require('../../../middleware/validation');
    const { rateLimitMiddleware } = require('../../../middleware/rateLimit');
    const { asyncHandler } = require('../../../utils/asyncHandler');

    (validateRequest as jest.Mock).mockImplementation(
      () => (req: any, res: any, next: any) => next(),
    );
    (rateLimitMiddleware as jest.Mock).mockImplementation(
      () => (req: any, res: any, next: any) => next(),
    );
    (asyncHandler as jest.Mock).mockImplementation((fn: any) => fn);

    // Mock service methods directly on the exported service instance
    jest.spyOn(qaDashboardService, 'getQualityMetrics');
    jest.spyOn(qaDashboardService, 'getProcessingMetrics');
    jest.spyOn(qaDashboardService, 'getReviewQueueMetrics');
    jest.spyOn(qaDashboardService, 'getFilteredMetrics');

    mockQADashboardService =
      qaDashboardService as jest.Mocked<QADashboardService>;

    app.use('/api/v1/qa-dashboard', qaDashboardRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/qa-dashboard/quality-metrics', () => {
    it('should return quality metrics for authenticated user', async () => {
      const mockMetrics = {
        totalInvoices: 100,
        averageConfidence: 0.85,
        confidenceDistribution: {
          high: 60,
          medium: 30,
          low: 10,
        },
        validationStats: {
          passed: 80,
          warning: 15,
          failed: 5,
        },
        reviewTaskStats: {
          total: 20,
          completed: 15,
          pending: 5,
          averageCompletionTime: 1800000, // 30 minutes in ms
        },
        qualityTrends: [
          {
            date: '2024-01-01',
            averageConfidence: 0.85,
            totalProcessed: 10,
          },
        ],
      };

      mockQADashboardService.getQualityMetrics.mockResolvedValue(mockMetrics);

      const response = await request(app)
        .get('/api/v1/qa-dashboard/quality-metrics')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockMetrics,
      });

      expect(mockQADashboardService.getQualityMetrics).toHaveBeenCalledWith(
        'user-123',
      );
    });

    it('should handle service errors gracefully', async () => {
      mockQADashboardService.getQualityMetrics.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const response = await request(app)
        .get('/api/v1/qa-dashboard/quality-metrics')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to get quality metrics',
      });
    });
  });

  describe('GET /api/v1/qa-dashboard/processing-metrics', () => {
    it('should return processing metrics with date range', async () => {
      const mockMetrics = {
        totalProcessed: 150,
        successRate: 92.5,
        failureRate: 7.5,
        averageProcessingTime: 5000,
        throughputPerDay: 25.5,
        statusBreakdown: {
          processed: 139,
          failed: 11,
        },
      };

      mockQADashboardService.getProcessingMetrics.mockResolvedValue(
        mockMetrics,
      );

      const response = await request(app)
        .get('/api/v1/qa-dashboard/processing-metrics')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockMetrics,
      });

      expect(mockQADashboardService.getProcessingMetrics).toHaveBeenCalledWith(
        'user-123',
        {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
      );
    });

    it('should use default date range when not provided', async () => {
      const mockMetrics = {
        totalProcessed: 50,
        successRate: 90,
        failureRate: 10,
        averageProcessingTime: 4500,
        throughputPerDay: 10.5,
        statusBreakdown: {
          processed: 45,
          failed: 5,
        },
      };

      mockQADashboardService.getProcessingMetrics.mockResolvedValue(
        mockMetrics,
      );

      const response = await request(app)
        .get('/api/v1/qa-dashboard/processing-metrics')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockMetrics,
      });

      // Should use last 30 days as default
      expect(mockQADashboardService.getProcessingMetrics).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          start: expect.any(Date),
          end: expect.any(Date),
        }),
      );
    });
  });

  describe('GET /api/v1/qa-dashboard/review-queue', () => {
    it('should return review queue metrics', async () => {
      const mockMetrics = {
        totalTasks: 25,
        pendingTasks: 8,
        completedTasks: 17,
        overdueTasks: 2,
        priorityBreakdown: {
          high: 5,
          medium: 12,
          low: 8,
        },
        averageWaitTime: 3600000, // 1 hour in ms
      };

      mockQADashboardService.getReviewQueueMetrics.mockResolvedValue(
        mockMetrics,
      );

      const response = await request(app)
        .get('/api/v1/qa-dashboard/review-queue')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockMetrics,
      });

      expect(mockQADashboardService.getReviewQueueMetrics).toHaveBeenCalledWith(
        'user-123',
      );
    });
  });

  describe('POST /api/v1/qa-dashboard/filtered-metrics', () => {
    it('should return filtered metrics based on provided filters', async () => {
      const mockMetrics = {
        totalInvoices: 50,
        averageConfidence: 0.92,
        confidenceDistribution: {
          high: 45,
          medium: 5,
          low: 0,
        },
        validationStats: {
          passed: 48,
          warning: 2,
          failed: 0,
        },
        reviewTaskStats: {
          total: 5,
          completed: 5,
          pending: 0,
          averageCompletionTime: 1200000,
        },
        qualityTrends: [],
      };

      mockQADashboardService.getFilteredMetrics.mockResolvedValue(mockMetrics);

      const filters = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        confidenceThreshold: 0.8,
        status: ['processed', 'warning'],
      };

      const response = await request(app)
        .post('/api/v1/qa-dashboard/filtered-metrics')
        .send(filters)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockMetrics,
      });

      expect(mockQADashboardService.getFilteredMetrics).toHaveBeenCalledWith(
        'user-123',
        {
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31'),
          },
          confidenceThreshold: 0.8,
          status: ['processed', 'warning'],
        },
      );
    });

    it('should handle invalid filter parameters gracefully', async () => {
      const invalidFilters = {
        confidenceThreshold: 1.5, // Invalid: > 1
        status: 'invalid', // Invalid: should be array
      };

      // Mock service to throw an error for invalid filters
      mockQADashboardService.getFilteredMetrics.mockRejectedValue(
        new Error('Invalid filter parameters'),
      );

      const response = await request(app)
        .post('/api/v1/qa-dashboard/filtered-metrics')
        .send(invalidFilters)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to get filtered metrics',
      });
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      // Mock authentication to fail
      (authenticate as jest.Mock).mockImplementation(
        (req: any, res: any, next: any) => {
          res.status(401).json({ success: false, error: 'Unauthorized' });
        },
      );

      const endpoints = [
        '/api/v1/qa-dashboard/quality-metrics',
        '/api/v1/qa-dashboard/processing-metrics',
        '/api/v1/qa-dashboard/review-queue',
      ];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).toBe(401);
        expect(response.body).toEqual({
          success: false,
          error: 'Unauthorized',
        });
      }
    });
  });
});
