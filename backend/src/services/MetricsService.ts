// @ts-nocheck

import { prisma } from '../prisma';
import { logger } from '../utils/logger';
import { NotificationStatus, NotificationType } from '../models/Notification';

export class MetricsService {
  async trackNotificationMetrics() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    try {
      // Get notification counts by type and status
      const notificationStats = await prisma.notification.groupBy({
        by: ['type', 'status'],
        where: {
          createdAt: {
            gte: dayAgo,
          },
        },
        _count: true,
      });

      // Get error report metrics
      const errorReportStats = await prisma.errorReport.groupBy({
        by: ['errorType'],
        where: {
          createdAt: {
            gte: dayAgo,
          },
        },
        _count: true,
        _sum: {
          downloadCount: true,
        },
      });

      // Calculate delivery times
      const deliveryTimes = await prisma.notification.findMany({
        where: {
          createdAt: {
            gte: dayAgo,
          },
          type: NotificationType.STATUS,
          status: {
            in: [NotificationStatus.COMPLETED, NotificationStatus.FAILED],
          },
        },
        select: {
          createdAt: true,
          metadata: true,
        },
      });

      const avgDeliveryTime =
        deliveryTimes.reduce((acc, notification) => {
          const jobStartTime = notification.metadata?.jobStartTime as string;
          if (jobStartTime) {
            const start = new Date(jobStartTime).getTime();
            const end = notification.createdAt.getTime();
            return acc + (end - start);
          }
          return acc;
        }, 0) / (deliveryTimes.length || 1);

      // Log metrics
      logger.info('Notification metrics', {
        period: '24h',
        notificationStats,
        errorReportStats,
        avgDeliveryTimeMs: avgDeliveryTime,
      });

      return {
        notificationStats,
        errorReportStats,
        avgDeliveryTimeMs: avgDeliveryTime,
      };
    } catch (error) {
      logger.error('Failed to track notification metrics', { error });
      throw error;
    }
  }

  async getNotificationDeliveryStats(startDate: Date, endDate: Date) {
    try {
      const stats = await prisma.notification.groupBy({
        by: ['type', 'status'],
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get notification delivery stats', { error });
      throw error;
    }
  }

  async getErrorReportStats(startDate: Date, endDate: Date) {
    try {
      const stats = await prisma.errorReport.groupBy({
        by: ['errorType'],
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
        _sum: {
          downloadCount: true,
        },
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get error report stats', { error });
      throw error;
    }
  }

  async getAverageDeliveryTime(startDate: Date, endDate: Date) {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          type: NotificationType.STATUS,
          status: {
            in: [NotificationStatus.COMPLETED, NotificationStatus.FAILED],
          },
        },
        select: {
          createdAt: true,
          metadata: true,
        },
      });

      const deliveryTimes = notifications
        .map((notification) => {
          const jobStartTime = notification.metadata?.jobStartTime as string;
          if (jobStartTime) {
            const start = new Date(jobStartTime).getTime();
            const end = notification.createdAt.getTime();
            return end - start;
          }
          return null;
        })
        .filter((time): time is number => time !== null);

      if (deliveryTimes.length === 0) {
        return 0;
      }

      const avgDeliveryTime =
        deliveryTimes.reduce((acc, time) => acc + time, 0) /
        deliveryTimes.length;
      return avgDeliveryTime;
    } catch (error) {
      logger.error('Failed to get average delivery time', { error });
      throw error;
    }
  }
}
