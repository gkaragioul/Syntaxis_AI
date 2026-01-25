// @ts-nocheck

import { Router } from 'express';
import { QADashboardService } from '../services/qa-dashboard.service';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';

// Mock prisma for testing
const prisma = {} as any;

const router = Router();

// Initialize QA Dashboard service - make it exportable for testing
export const qaDashboardService = new QADashboardService(prisma);

/**
 * @route GET /api/v1/qa-dashboard/quality-metrics
 * @desc Get quality metrics for the authenticated user
 * @access Private
 */
router.get('/quality-metrics', authenticate, async (req, res) => {
  try {
    const metrics = await qaDashboardService.getQualityMetrics(req.user!.id);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('Failed to get quality metrics', {
      error,
      userId: req.user!.id,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get quality metrics',
    });
  }
});

/**
 * @route GET /api/v1/qa-dashboard/processing-metrics
 * @desc Get processing performance metrics with optional date range
 * @access Private
 */
router.get('/processing-metrics', authenticate, async (req, res) => {
  try {
    // Default to last 30 days if no date range provided
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const metrics = await qaDashboardService.getProcessingMetrics(
      req.user!.id,
      { start: startDate, end: endDate },
    );

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('Failed to get processing metrics', {
      error,
      userId: req.user!.id,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get processing metrics',
    });
  }
});

/**
 * @route GET /api/v1/qa-dashboard/review-queue
 * @desc Get review queue metrics
 * @access Private
 */
router.get('/review-queue', authenticate, async (req, res) => {
  try {
    const metrics = await qaDashboardService.getReviewQueueMetrics(
      req.user!.id,
    );

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('Failed to get review queue metrics', {
      error,
      userId: req.user!.id,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get review queue metrics',
    });
  }
});

/**
 * @route POST /api/v1/qa-dashboard/filtered-metrics
 * @desc Get filtered quality metrics based on provided criteria
 * @access Private
 */
router.post('/filtered-metrics', authenticate, async (req, res) => {
  try {
    const filters: any = {};

    // Parse date range
    if (req.body.dateRange) {
      filters.dateRange = {
        start: new Date(req.body.dateRange.start),
        end: new Date(req.body.dateRange.end),
      };
    }

    // Add other filters
    if (req.body.confidenceThreshold !== undefined) {
      filters.confidenceThreshold = req.body.confidenceThreshold;
    }

    if (req.body.status && req.body.status.length > 0) {
      filters.status = req.body.status;
    }

    if (req.body.priority && req.body.priority.length > 0) {
      filters.priority = req.body.priority;
    }

    const metrics = await qaDashboardService.getFilteredMetrics(
      req.user!.id,
      filters,
    );

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('Failed to get filtered metrics', {
      error,
      userId: req.user!.id,
      filters: req.body,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get filtered metrics',
    });
  }
});

/**
 * @route GET /api/v1/qa-dashboard/summary
 * @desc Get a summary of all QA dashboard metrics
 * @access Private
 */
router.get('/summary', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get all metrics in parallel
    const [qualityMetrics, reviewQueueMetrics] = await Promise.all([
      qaDashboardService.getQualityMetrics(userId),
      qaDashboardService.getReviewQueueMetrics(userId),
    ]);

    // Get processing metrics for last 7 days
    const endDate = new Date();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const processingMetrics = await qaDashboardService.getProcessingMetrics(
      userId,
      { start: startDate, end: endDate },
    );

    const summary = {
      overview: {
        totalInvoices: qualityMetrics.totalInvoices,
        averageConfidence: qualityMetrics.averageConfidence,
        successRate: processingMetrics.successRate,
        pendingReviews: reviewQueueMetrics.pendingTasks,
      },
      alerts: {
        lowConfidenceInvoices: qualityMetrics.confidenceDistribution.low,
        overdueTasks: reviewQueueMetrics.overdueTasks,
        failedProcessing: processingMetrics.statusBreakdown.failed || 0,
      },
      trends: {
        qualityTrends: qualityMetrics.qualityTrends.slice(-7), // Last 7 days
        throughputPerDay: processingMetrics.throughputPerDay,
      },
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Failed to get QA dashboard summary', {
      error,
      userId: req.user!.id,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get QA dashboard summary',
    });
  }
});

export { router as qaDashboardRoutes };
