// @ts-nocheck

import { redis } from '../redis';
import { User } from '../models/User';
import { OnboardingEvent } from '../models/OnboardingEvent';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface OnboardingAnalyticsEvent {
  eventType:
  | 'step_started'
  | 'step_completed'
  | 'step_skipped'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'onboarding_abandoned'
  | 'help_accessed';
  stepId?: string;
  stepName?: string;
  timeSpent?: number;
  metadata?: Record<string, any>;
  timestamp: Date;
  userId: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
}

export interface OnboardingMetrics {
  totalUsers: number;
  completionRate: number;
  averageTimeToComplete: number;
  stepCompletionRates: Record<string, number>;
  abandonmentPoints: Record<string, number>;
  helpAccessCount: number;
  commonIssues: Array<{
    issue: string;
    count: number;
    stepId?: string;
  }>;
}

export interface OnboardingFunnel {
  steps: Array<{
    stepId: string;
    stepName: string;
    started: number;
    completed: number;
    abandoned: number;
    conversionRate: number;
    averageTime: number;
  }>;
  overallConversion: number;
}

export interface OnboardingInsights {
  trends: {
    completionRateOverTime: Array<{ date: string; rate: number }>;
    averageTimeOverTime: Array<{ date: string; time: number }>;
  };
  userSegments: {
    byDevice: Record<string, { count: number; completionRate: number }>;
    byReferrer: Record<string, { count: number; completionRate: number }>;
  };
  recommendations: Array<{
    type: 'improvement' | 'warning' | 'success';
    message: string;
    stepId?: string;
    impact: 'high' | 'medium' | 'low';
  }>;
}

export class AnalyticsService {
  private redis = redis;

  constructor() {
  }

  /**
   * Track a single onboarding event
   */
  async trackOnboardingEvent(event: OnboardingAnalyticsEvent): Promise<void> {
    try {
      // Store in database
      await OnboardingEvent.create({
        userId: event.userId,
        eventType: event.eventType,
        stepId: event.stepId,
        stepName: event.stepName,
        timeSpent: event.timeSpent,
        metadata: event.metadata,
        timestamp: event.timestamp,
        sessionId: event.sessionId,
        userAgent: event.userAgent,
        ip: event.ip,
      });

      // Update real-time metrics in Redis
      await this.updateRealTimeMetrics(event);
    } catch (error) {
      logger.error('Failed to track onboarding event', { error });
      throw error;
    }
  }

  /**
   * Track multiple onboarding events in batch
   */
  async trackOnboardingEventsBatch(
    events: OnboardingAnalyticsEvent[],
  ): Promise<void> {
    try {
      // Bulk insert to database
      await OnboardingEvent.bulkCreate(
        events.map((event) => ({
          userId: event.userId,
          eventType: event.eventType,
          stepId: event.stepId,
          stepName: event.stepName,
          timeSpent: event.timeSpent,
          metadata: event.metadata,
          timestamp: event.timestamp,
          sessionId: event.sessionId,
          userAgent: event.userAgent,
          ip: event.ip,
        })),
      );

      // Update real-time metrics for each event
      for (const event of events) {
        await this.updateRealTimeMetrics(event);
      }
    } catch (error) {
      logger.error('Failed to track onboarding events batch', { error });
      throw error;
    }
  }

  /**
   * Get onboarding metrics
   */
  async getOnboardingMetrics(dateRange?: {
    start: Date;
    end: Date;
  }): Promise<OnboardingMetrics> {
    try {
      const whereClause = dateRange
        ? {
          timestamp: {
            $gte: dateRange.start,
            $lte: dateRange.end,
          },
        }
        : {};

      // Get total users who started onboarding
      const totalUsers = await OnboardingEvent.countDocuments({
        ...whereClause,
        eventType: 'onboarding_started',
      });

      // Get users who completed onboarding
      const completedUsers = await OnboardingEvent.countDocuments({
        ...whereClause,
        eventType: 'onboarding_completed',
      });

      const completionRate =
        totalUsers > 0 ? (completedUsers / totalUsers) * 100 : 0;

      // Calculate average time to complete
      const completedSessions = await OnboardingEvent.aggregate([
        {
          $match: {
            ...whereClause,
            eventType: 'onboarding_completed',
          },
        },
        {
          $group: {
            _id: '$sessionId',
            totalTime: { $sum: '$timeSpent' },
          },
        },
        {
          $group: {
            _id: null,
            averageTime: { $avg: '$totalTime' },
          },
        },
      ]);

      const averageTimeToComplete = completedSessions[0]?.averageTime || 0;

      // Get step completion rates
      const stepCompletionRates =
        await this.getStepCompletionRates(whereClause);

      // Get abandonment points
      const abandonmentPoints = await this.getAbandonmentPoints(whereClause);

      // Get help access count
      const helpAccessCount = await OnboardingEvent.countDocuments({
        ...whereClause,
        eventType: 'help_accessed',
      });

      // Get common issues (simplified - would need more sophisticated analysis)
      const commonIssues = await this.getCommonIssues(whereClause);

      return {
        totalUsers,
        completionRate,
        averageTimeToComplete,
        stepCompletionRates,
        abandonmentPoints,
        helpAccessCount,
        commonIssues,
      };
    } catch (error) {
      logger.error('Failed to get onboarding metrics', { error });
      throw error;
    }
  }

  /**
   * Get user onboarding journey
   */
  async getUserOnboardingJourney(userId: string): Promise<any> {
    try {
      const events = await OnboardingEvent.find({ userId })
        .sort({ timestamp: 1 })
        .lean();

      if (events.length === 0) {
        return null;
      }

      const startEvent = events.find(
        (e) => e.eventType === 'onboarding_started',
      );
      const completedEvent = events.find(
        (e) => e.eventType === 'onboarding_completed',
      );
      const abandonedEvent = events.find(
        (e) => e.eventType === 'onboarding_abandoned',
      );

      const stepsCompleted = events
        .filter((e) => e.eventType === 'step_completed')
        .map((e) => e.stepId)
        .filter(Boolean);

      const timeSpentPerStep = events
        .filter((e) => e.eventType === 'step_completed' && e.timeSpent)
        .reduce(
          (acc, e) => {
            if (e.stepId && e.timeSpent) {
              acc[e.stepId] = e.timeSpent;
            }
            return acc;
          },
          {} as Record<string, number>,
        );

      const helpAccessedSteps = events
        .filter((e) => e.eventType === 'help_accessed' && e.stepId)
        .map((e) => e.stepId)
        .filter(Boolean);

      let completionStatus:
        | 'in_progress'
        | 'completed'
        | 'abandoned'
        | 'skipped' = 'in_progress';
      if (completedEvent) {
        completionStatus = 'completed';
      } else if (abandonedEvent) {
        completionStatus =
          abandonedEvent.metadata?.reason === 'user_skip'
            ? 'skipped'
            : 'abandoned';
      }

      return {
        userId,
        startedAt: startEvent?.timestamp,
        completedAt: completedEvent?.timestamp,
        currentStep: events[events.length - 1]?.stepId || 'welcome',
        stepsCompleted,
        timeSpentPerStep,
        helpAccessedSteps,
        abandonedAt: abandonedEvent?.timestamp,
        completionStatus,
      };
    } catch (error) {
      logger.error('Failed to get user onboarding journey', { error });
      throw error;
    }
  }

  /**
   * Get onboarding funnel data
   */
  async getOnboardingFunnel(dateRange?: {
    start: Date;
    end: Date;
  }): Promise<OnboardingFunnel> {
    try {
      const whereClause = dateRange
        ? {
          timestamp: {
            $gte: dateRange.start,
            $lte: dateRange.end,
          },
        }
        : {};

      const steps = [
        'welcome',
        'upload',
        'extraction',
        'templates',
        'batch',
        'export',
      ];
      const stepNames = [
        'Welcome',
        'Upload PDFs',
        'Table Extraction',
        'Templates',
        'Batch Processing',
        'Export Results',
      ];

      const funnelSteps = [];
      let previousStepUsers = 0;

      for (let i = 0; i < steps.length; i++) {
        const stepId = steps[i];
        const stepName = stepNames[i];

        const started = await OnboardingEvent.countDocuments({
          ...whereClause,
          eventType: 'step_started',
          stepId,
        });

        const completed = await OnboardingEvent.countDocuments({
          ...whereClause,
          eventType: 'step_completed',
          stepId,
        });

        const abandoned = await OnboardingEvent.countDocuments({
          ...whereClause,
          eventType: 'onboarding_abandoned',
          stepId,
        });

        const conversionRate = started > 0 ? (completed / started) * 100 : 0;

        // Calculate average time for this step
        const avgTimeResult = await OnboardingEvent.aggregate([
          {
            $match: {
              ...whereClause,
              eventType: 'step_completed',
              stepId,
              timeSpent: { $exists: true },
            },
          },
          {
            $group: {
              _id: null,
              averageTime: { $avg: '$timeSpent' },
            },
          },
        ]);

        const averageTime = avgTimeResult[0]?.averageTime || 0;

        funnelSteps.push({
          stepId,
          stepName,
          started,
          completed,
          abandoned,
          conversionRate,
          averageTime,
        });

        if (i === 0) {
          previousStepUsers = started;
        }
      }

      // Calculate overall conversion rate
      const totalStarted = await OnboardingEvent.countDocuments({
        ...whereClause,
        eventType: 'onboarding_started',
      });

      const totalCompleted = await OnboardingEvent.countDocuments({
        ...whereClause,
        eventType: 'onboarding_completed',
      });

      const overallConversion =
        totalStarted > 0 ? (totalCompleted / totalStarted) * 100 : 0;

      return {
        steps: funnelSteps,
        overallConversion,
      };
    } catch (error) {
      logger.error('Failed to get onboarding funnel', { error });
      throw error;
    }
  }

  /**
   * Check if user is admin
   */
  async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      return user?.role === 'admin' || user?.isAdmin === true;
    } catch (error) {
      logger.error('Failed to check user admin status', { error });
      return false;
    }
  }

  /**
   * Update real-time metrics in Redis
   */
  private async updateRealTimeMetrics(
    event: OnboardingAnalyticsEvent,
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `onboarding_metrics:${today}`;

      // Increment counters
      await this.redis.hincrby(key, `${event.eventType}_count`, 1);

      if (event.stepId) {
        await this.redis.hincrby(
          key,
          `step_${event.stepId}_${event.eventType}`,
          1,
        );
      }

      // Set expiration for 30 days
      await this.redis.expire(key, 30 * 24 * 60 * 60);
    } catch (error) {
      logger.warn('Failed to update real-time metrics', { error });
      // Don't throw error as this is not critical
    }
  }

  /**
   * Get step completion rates
   */
  private async getStepCompletionRates(
    whereClause: any,
  ): Promise<Record<string, number>> {
    const steps = [
      'welcome',
      'upload',
      'extraction',
      'templates',
      'batch',
      'export',
    ];
    const rates: Record<string, number> = {};

    for (const stepId of steps) {
      const started = await OnboardingEvent.countDocuments({
        ...whereClause,
        eventType: 'step_started',
        stepId,
      });

      const completed = await OnboardingEvent.countDocuments({
        ...whereClause,
        eventType: 'step_completed',
        stepId,
      });

      rates[stepId] = started > 0 ? (completed / started) * 100 : 0;
    }

    return rates;
  }

  /**
   * Get abandonment points
   */
  private async getAbandonmentPoints(
    whereClause: any,
  ): Promise<Record<string, number>> {
    const abandonmentData = await OnboardingEvent.aggregate([
      {
        $match: {
          ...whereClause,
          eventType: 'onboarding_abandoned',
        },
      },
      {
        $group: {
          _id: '$stepId',
          count: { $sum: 1 },
        },
      },
    ]);

    const points: Record<string, number> = {};
    abandonmentData.forEach((item) => {
      if (item._id) {
        points[item._id] = item.count;
      }
    });

    return points;
  }

  /**
   * Get common issues (simplified implementation)
   */
  private async getCommonIssues(
    whereClause: any,
  ): Promise<Array<{ issue: string; count: number; stepId?: string }>> {
    const helpEvents = await OnboardingEvent.aggregate([
      {
        $match: {
          ...whereClause,
          eventType: 'help_accessed',
        },
      },
      {
        $group: {
          _id: {
            stepId: '$stepId',
            helpType: '$metadata.helpType',
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    return helpEvents.map((item) => ({
      issue: item._id.helpType || 'General help request',
      count: item.count,
      stepId: item._id.stepId,
    }));
  }

  /**
   * Get onboarding insights
   */
  async getOnboardingInsights(dateRange?: {
    start: Date;
    end: Date;
  }): Promise<OnboardingInsights> {
    return {
      trends: {
        completionRateOverTime: [],
        averageTimeOverTime: [],
      },
      userSegments: {
        byDevice: {},
        byReferrer: {},
      },
      recommendations: [],
    };
  }

  /**
   * Export onboarding data
   */
  async exportOnboardingData(
    format: string,
    dateRange?: { start: Date; end: Date },
  ): Promise<string> {
    return 'Export data would be generated here';
  }
}
