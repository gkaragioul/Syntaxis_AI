// @ts-nocheck

/**
 * TDD Monitoring API Routes
 *
 * Task 1.2.5: Continuous Test Monitoring - API Implementation
 *
 * These routes provide access to TDD monitoring data and controls.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import TDDMonitoringService, { defaultTDDMonitoringConfig } from '../monitoring/tdd-monitoring.service';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Initialize TDD monitoring service
const tddMonitoringService = new TDDMonitoringService(defaultTDDMonitoringConfig, prisma);

// Start monitoring on service initialization
tddMonitoringService.startMonitoring();

/**
 * GET /api/monitoring/tdd/dashboard
 * Get TDD monitoring dashboard data
 */
router.get('/tdd/dashboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    logger.info('TDD dashboard data requested', { userId: req.user?.id });

    const dashboardData = await tddMonitoringService.getDashboardData();

    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Failed to get TDD dashboard data', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard data',
    });
  }
});

/**
 * GET /api/monitoring/tdd/metrics
 * Get current TDD metrics
 */
router.get('/tdd/metrics', authenticateToken, async (req: Request, res: Response) => {
  try {
    logger.info('TDD metrics requested', { userId: req.user?.id });

    const metrics = await tddMonitoringService.collectMetrics();

    res.json({
      success: true,
      data: {
        metrics,
        summary: {
          coverageStatus: metrics.testCoverage.statements >= 95 ? 'passing' : 'failing',
          testStatus: metrics.testResults.failed === 0 ? 'passing' : 'failing',
          tddCompliance: metrics.tddCompliance.testFirstRatio >= 0.9 ? 'compliant' : 'non-compliant',
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Failed to get TDD metrics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
    });
  }
});

/**
 * GET /api/monitoring/tdd/alerts
 * Get active TDD alerts
 */
router.get('/tdd/alerts', authenticateToken, async (req: Request, res: Response) => {
  try {
    logger.info('TDD alerts requested', { userId: req.user?.id });

    const alerts = tddMonitoringService.getActiveAlerts();

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        severityCounts: {
          critical: alerts.filter(a => a.severity === 'critical').length,
          high: alerts.filter(a => a.severity === 'high').length,
          medium: alerts.filter(a => a.severity === 'medium').length,
          low: alerts.filter(a => a.severity === 'low').length,
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Failed to get TDD alerts', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts',
    });
  }
});

/**
 * POST /api/monitoring/tdd/alerts/:alertId/resolve
 * Resolve a specific alert
 */
router.post('/tdd/alerts/:alertId/resolve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;

    logger.info('Resolving TDD alert', { alertId, userId: req.user?.id });

    await tddMonitoringService.resolveAlert(alertId);

    res.json({
      success: true,
      message: 'Alert resolved successfully',
      alertId,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Failed to resolve TDD alert', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert',
    });
  }
});

/**
 * GET /api/monitoring/tdd/coverage/history
 * Get test coverage history
 */
router.get('/tdd/coverage/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { days = 7 } = req.query;
    const daysNumber = parseInt(days as string);

    logger.info('Coverage history requested', { days: daysNumber, userId: req.user?.id });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNumber);

    const coverageHistory = await prisma.performanceMetric.findMany({
      where: {
        operation: 'tdd_monitoring',
        timestamp: {
          gte: startDate,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
      select: {
        timestamp: true,
        metadata: true,
      },
    });

    const formattedHistory = coverageHistory.map(record => ({
      timestamp: record.timestamp,
      coverage: (record.metadata as any)?.testCoverage || {},
      testResults: (record.metadata as any)?.testResults || {},
      tddCompliance: (record.metadata as any)?.tddCompliance || {},
    }));

    res.json({
      success: true,
      data: {
        history: formattedHistory,
        period: `${daysNumber} days`,
        dataPoints: formattedHistory.length,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Failed to get coverage history', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve coverage history',
    });
  }
});

/**
 * GET /api/monitoring/tdd/health
 * Get TDD monitoring service health
 */
router.get('/tdd/health', async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      monitoring: {
        active: true,
        lastCollection: new Date().toISOString(),
      },
      thresholds: {
        coverage: defaultTDDMonitoringConfig.coverageThreshold,
        testFailureRate: defaultTDDMonitoringConfig.alertThresholds.testFailureRate,
        tddCompliance: defaultTDDMonitoringConfig.alertThresholds.tddComplianceRate,
      },
      notifications: {
        slack: !!defaultTDDMonitoringConfig.notifications.slack?.webhookUrl,
        email: defaultTDDMonitoringConfig.notifications.email?.recipients.length > 0,
      },
    };

    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Failed to get TDD monitoring health', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve health status',
    });
  }
});

/**
 * POST /api/monitoring/tdd/trigger-collection
 * Manually trigger metrics collection
 */
router.post('/tdd/trigger-collection', authenticateToken, async (req: Request, res: Response) => {
  try {
    logger.info('Manual metrics collection triggered', { userId: req.user?.id });

    const metrics = await tddMonitoringService.collectMetrics();

    res.json({
      success: true,
      message: 'Metrics collection completed',
      data: metrics,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Failed to trigger metrics collection', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to collect metrics',
    });
  }
});

/**
 * GET /api/monitoring/tdd/recommendations
 * Get TDD improvement recommendations
 */
router.get('/tdd/recommendations', authenticateToken, async (req: Request, res: Response) => {
  try {
    logger.info('TDD recommendations requested', { userId: req.user?.id });

    const dashboardData = await tddMonitoringService.getDashboardData();
    const recommendations = dashboardData.summary.recommendations;

    res.json({
      success: true,
      data: {
        recommendations,
        count: recommendations.length,
        priority: recommendations.length > 3 ? 'high' : recommendations.length > 1 ? 'medium' : 'low',
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Failed to get TDD recommendations', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recommendations',
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Shutting down TDD monitoring service');
  tddMonitoringService.stopMonitoring();
});

process.on('SIGINT', () => {
  logger.info('Shutting down TDD monitoring service');
  tddMonitoringService.stopMonitoring();
});

export default router;
