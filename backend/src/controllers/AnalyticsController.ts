import { Request, Response } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export class AnalyticsController {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  /**
   * Track onboarding events
   */
  trackOnboardingEvent = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const eventData = {
        ...req.body,
        userId,
        timestamp: new Date(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      };

      await this.analyticsService.trackOnboardingEvent(eventData);

      res.status(200).json({ message: 'Event tracked successfully' });
    } catch (error) {
      logger.error('Failed to track onboarding event', { error, userId: req.user?.id });
      res.status(500).json({
        error: 'Failed to track event',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Track batch onboarding events
   */
  trackOnboardingEventsBatch = async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { events } = req.body;
      if (!Array.isArray(events)) {
        return res.status(400).json({ error: 'Events must be an array' });
      }

      const enrichedEvents = events.map((event) => ({
        ...event,
        userId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      }));

      await this.analyticsService.trackOnboardingEventsBatch(enrichedEvents);

      res.status(200).json({
        message: 'Events tracked successfully',
        count: events.length,
      });
    } catch (error) {
      logger.error('Failed to track onboarding events batch', { error, userId: req.user?.id });
      res.status(500).json({
        error: 'Failed to track events',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Get onboarding metrics (admin only)
   */
  getOnboardingMetrics = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Check if user has admin privileges
      const isAdmin = await this.analyticsService.isUserAdmin(userId);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { startDate, endDate } = req.query;
      const dateRange =
        startDate && endDate
          ? {
              start: new Date(startDate as string),
              end: new Date(endDate as string),
            }
          : undefined;

      const metrics =
        await this.analyticsService.getOnboardingMetrics(dateRange);

      res.status(200).json(metrics);
    } catch (error) {
      logger.error('Failed to get onboarding metrics', { error, userId: req.user?.id });
      res.status(500).json({
        error: 'Failed to get metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Get user onboarding journey
   */
  getUserOnboardingJourney = async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { userId: targetUserId } = req.params;

      // Users can only access their own journey unless they're admin
      let journeyUserId = userId;
      if (targetUserId && targetUserId !== userId) {
        const isAdmin = await this.analyticsService.isUserAdmin(userId);
        if (!isAdmin) {
          return res.status(403).json({ error: 'Access denied' });
        }
        journeyUserId = targetUserId;
      }

      const journey =
        await this.analyticsService.getUserOnboardingJourney(journeyUserId);

      res.status(200).json(journey);
    } catch (error) {
      logger.error('Failed to get user onboarding journey', { error, userId: req.user?.id });
      res.status(500).json({
        error: 'Failed to get journey',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Get onboarding completion funnel
   */
  getOnboardingFunnel = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Check if user has admin privileges
      const isAdmin = await this.analyticsService.isUserAdmin(userId);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { startDate, endDate } = req.query;
      const dateRange =
        startDate && endDate
          ? {
              start: new Date(startDate as string),
              end: new Date(endDate as string),
            }
          : undefined;

      const funnel = await this.analyticsService.getOnboardingFunnel(dateRange);

      res.status(200).json(funnel);
    } catch (error) {
      logger.error('Failed to get onboarding funnel', { error, userId: req.user?.id });
      res.status(500).json({
        error: 'Failed to get funnel',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Get onboarding performance insights
   */
  getOnboardingInsights = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Check if user has admin privileges
      const isAdmin = await this.analyticsService.isUserAdmin(userId);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { startDate, endDate } = req.query;
      const dateRange =
        startDate && endDate
          ? {
              start: new Date(startDate as string),
              end: new Date(endDate as string),
            }
          : undefined;

      const insights =
        await this.analyticsService.getOnboardingInsights(dateRange);

      res.status(200).json(insights);
    } catch (error) {
      logger.error('Failed to get onboarding insights', { error, userId: req.user?.id });
      res.status(500).json({
        error: 'Failed to get insights',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Export onboarding analytics data
   */
  exportOnboardingData = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Check if user has admin privileges
      const isAdmin = await this.analyticsService.isUserAdmin(userId);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { format = 'csv', startDate, endDate } = req.query;
      const dateRange =
        startDate && endDate
          ? {
              start: new Date(startDate as string),
              end: new Date(endDate as string),
            }
          : undefined;

      const exportData = await this.analyticsService.exportOnboardingData(
        format as string,
        dateRange,
      );

      // Set appropriate headers for file download
      const filename = `onboarding_analytics_${new Date().toISOString().split('T')[0]}.${format}`;
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.setHeader('Content-Type', this.getContentType(format as string));

      res.send(exportData);
    } catch (error) {
      logger.error('Failed to export onboarding data', { error, userId: req.user?.id, format: req.query.format });
      res.status(500).json({
        error: 'Failed to export data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Get content type for export format
   */
  private getContentType(format: string): string {
    switch (format.toLowerCase()) {
      case 'csv':
        return 'text/csv';
      case 'json':
        return 'application/json';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default:
        return 'application/octet-stream';
    }
  }
}
