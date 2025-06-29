import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { config } from '../config';

interface PerformanceMetric {
  timestamp: number;
  value: number;
  metadata?: Record<string, any>;
}

interface PerformanceAlert {
  type: string;
  message: string;
  threshold: number;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export class PerformanceMonitoringService {
  private static readonly METRICS_KEY_PREFIX = 'metrics:';
  private static readonly ALERTS_KEY_PREFIX = 'alerts:';
  private static readonly METRICS_RETENTION_DAYS =
    config.monitoring.metrics.retentionDays;
  private static readonly ALERT_THRESHOLDS =
    config.monitoring.metrics.alertThresholds;

  /**
   * Record a performance metric
   */
  public static async recordMetric(
    metricName: string,
    value: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const timestamp = Date.now();
    const metric: PerformanceMetric = {
      timestamp,
      value,
      metadata,
    };

    const key = `${this.METRICS_KEY_PREFIX}${metricName}`;
    await redis.zadd(key, timestamp, JSON.stringify(metric));

    // Set expiry for metrics
    await redis.expire(key, this.METRICS_RETENTION_DAYS * 24 * 60 * 60);

    // Check for alerts
    await this.checkAlertThresholds(metricName, value, metadata);
  }

  /**
   * Get metrics for a specific time range
   */
  public static async getMetrics(
    metricName: string,
    startTime: number,
    endTime: number,
  ): Promise<PerformanceMetric[]> {
    const key = `${this.METRICS_KEY_PREFIX}${metricName}`;
    const metrics = await redis.zrangebyscore(key, startTime, endTime);
    return metrics.map((metric) => JSON.parse(metric));
  }

  /**
   * Get aggregated metrics (e.g., average, min, max) for a time range
   */
  public static async getAggregatedMetrics(
    metricName: string,
    startTime: number,
    endTime: number,
    aggregation: 'avg' | 'min' | 'max' | 'sum' | 'count',
  ): Promise<number> {
    const metrics = await this.getMetrics(metricName, startTime, endTime);
    if (metrics.length === 0) return 0;

    switch (aggregation) {
      case 'avg':
        return (
          metrics.reduce((sum, metric) => sum + metric.value, 0) /
          metrics.length
        );
      case 'min':
        return Math.min(...metrics.map((metric) => metric.value));
      case 'max':
        return Math.max(...metrics.map((metric) => metric.value));
      case 'sum':
        return metrics.reduce((sum, metric) => sum + metric.value, 0);
      case 'count':
        return metrics.length;
      default:
        throw new Error('Invalid aggregation type');
    }
  }

  /**
   * Get recent alerts
   */
  public static async getRecentAlerts(
    limit: number = 100,
  ): Promise<PerformanceAlert[]> {
    const key = `${this.ALERTS_KEY_PREFIX}recent`;
    const alerts = await redis.lrange(key, 0, limit - 1);
    return alerts.map((alert) => JSON.parse(alert));
  }

  /**
   * Check if a metric exceeds alert thresholds
   */
  private static async checkAlertThresholds(
    metricName: string,
    value: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const threshold =
      this.ALERT_THRESHOLDS[metricName as keyof typeof this.ALERT_THRESHOLDS];
    if (!threshold) return;

    if (value > threshold) {
      const alert: PerformanceAlert = {
        type: metricName,
        message: `${metricName} exceeded threshold of ${threshold} (current value: ${value})`,
        threshold,
        value,
        timestamp: Date.now(),
        metadata,
      };

      // Store alert
      const key = `${this.ALERTS_KEY_PREFIX}recent`;
      await redis.lpush(key, JSON.stringify(alert));
      await redis.ltrim(key, 0, 999); // Keep last 1000 alerts

      // Log alert
      logger.warn('Performance alert', {
        ...alert,
        metricName,
      });

      // TODO: Send notification (email, Slack, etc.)
    }
  }

  /**
   * Record upload performance metrics
   */
  public static async recordUploadMetrics(
    fileSize: number,
    uploadTime: number,
    userId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    // Record upload time
    await this.recordMetric('uploadTime', uploadTime, {
      fileSize,
      userId,
      ...metadata,
    });

    // Record upload speed (bytes per second)
    const uploadSpeed = fileSize / (uploadTime / 1000);
    await this.recordMetric('uploadSpeed', uploadSpeed, {
      fileSize,
      userId,
      ...metadata,
    });

    // Record upload size
    await this.recordMetric('uploadSize', fileSize, {
      userId,
      ...metadata,
    });
  }

  /**
   * Record processing performance metrics
   */
  public static async recordProcessingMetrics(
    fileSize: number,
    processingTime: number,
    userId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    // Record processing time
    await this.recordMetric('processingTime', processingTime, {
      fileSize,
      userId,
      ...metadata,
    });

    // Record processing speed (bytes per second)
    const processingSpeed = fileSize / (processingTime / 1000);
    await this.recordMetric('processingSpeed', processingSpeed, {
      fileSize,
      userId,
      ...metadata,
    });
  }

  /**
   * Record export performance metrics
   */
  public static async recordExportMetrics(
    fileSize: number,
    exportTime: number,
    userId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    // Record export time
    await this.recordMetric('exportTime', exportTime, {
      fileSize,
      userId,
      ...metadata,
    });

    // Record export speed (bytes per second)
    const exportSpeed = fileSize / (exportTime / 1000);
    await this.recordMetric('exportSpeed', exportSpeed, {
      fileSize,
      userId,
      ...metadata,
    });
  }

  /**
   * Get system health metrics
   */
  public static async getSystemHealth(): Promise<{
    uploadHealth: number;
    processingHealth: number;
    exportHealth: number;
    errorRate: number;
  }> {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Get average metrics for the last hour
    const [uploadTime, processingTime, exportTime, errorCount, totalRequests] =
      await Promise.all([
        this.getAggregatedMetrics('uploadTime', oneHourAgo, now, 'avg'),
        this.getAggregatedMetrics('processingTime', oneHourAgo, now, 'avg'),
        this.getAggregatedMetrics('exportTime', oneHourAgo, now, 'avg'),
        this.getAggregatedMetrics('errorCount', oneHourAgo, now, 'sum'),
        this.getAggregatedMetrics('requestCount', oneHourAgo, now, 'sum'),
      ]);

    // Calculate health scores (0-100)
    const uploadHealth = Math.max(
      0,
      100 - (uploadTime / this.ALERT_THRESHOLDS.uploadTime) * 100,
    );
    const processingHealth = Math.max(
      0,
      100 - (processingTime / this.ALERT_THRESHOLDS.processingTime) * 100,
    );
    const exportHealth = Math.max(
      0,
      100 - (exportTime / this.ALERT_THRESHOLDS.exportTime) * 100,
    );
    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

    return {
      uploadHealth,
      processingHealth,
      exportHealth,
      errorRate,
    };
  }
}

export default PerformanceMonitoringService;
