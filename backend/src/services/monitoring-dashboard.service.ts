// @ts-nocheck

import { PerformanceMonitoringService } from './PerformanceMonitoringService';
import { MetricsService } from './MetricsService';
import { logger } from '../utils/logger';
import { redis } from '../redis';
import { prisma } from '../prisma';
import { EmailService } from '../email/email.service';

export interface DashboardMetrics {
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: number;
    loadAverage: number[];
  };
  application: {
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
    activeUsers: number;
    processingQueue: number;
  };
  security: {
    blockedRequests: number;
    suspiciousActivity: number;
    rateLimitViolations: number;
    authFailures: number;
  };
  performance: {
    uploadTime: number;
    processingTime: number;
    exportTime: number;
    ocrAccuracy: number;
  };
  infrastructure: {
    database: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      connections: number;
      queryTime: number;
    };
    redis: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      memory: number;
      keyCount: number;
    };
    storage: {
      used: number;
      available: number;
      uploadCount: number;
    };
  };
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered?: Date;
}

export class MonitoringDashboardService {
  private static instance: MonitoringDashboardService;
  private alertRules: Map<string, AlertRule> = new Map();
  private alertCooldowns: Map<string, Date> = new Map();

  public static getInstance(): MonitoringDashboardService {
    if (!MonitoringDashboardService.instance) {
      MonitoringDashboardService.instance = new MonitoringDashboardService();
    }
    return MonitoringDashboardService.instance;
  }

  constructor() {
    this.initializeDefaultAlertRules();
  }

  /**
   * Get comprehensive dashboard metrics
   */
  public async getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      const [
        systemMetrics,
        applicationMetrics,
        securityMetrics,
        performanceMetrics,
        infrastructureMetrics,
      ] = await Promise.all([
        this.getSystemMetrics(),
        this.getApplicationMetrics(),
        this.getSecurityMetrics(),
        this.getPerformanceMetrics(),
        this.getInfrastructureMetrics(),
      ]);

      const metrics: DashboardMetrics = {
        system: systemMetrics,
        application: applicationMetrics,
        security: securityMetrics,
        performance: performanceMetrics,
        infrastructure: infrastructureMetrics,
      };

      // Check alert rules
      await this.checkAlertRules(metrics);

      return metrics;
    } catch (error) {
      logger.error('Failed to get dashboard metrics', { error });
      throw error;
    }
  }

  private async getSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    const loadAverage = require('os').loadavg();

    // Get CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    return {
      uptime,
      memoryUsage,
      cpuUsage: cpuPercent,
      loadAverage,
    };
  }

  private async getApplicationMetrics() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    const [totalRequests, errorCount, responseTime, activeUsers, queueSize] = await Promise.all([
      PerformanceMonitoringService.getAggregatedMetrics('requestCount', oneHourAgo, now, 'sum'),
      PerformanceMonitoringService.getAggregatedMetrics('errorCount', oneHourAgo, now, 'sum'),
      PerformanceMonitoringService.getAggregatedMetrics('responseTime', oneHourAgo, now, 'avg'),
      this.getActiveUserCount(),
      this.getProcessingQueueSize(),
    ]);

    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

    return {
      totalRequests: totalRequests || 0,
      errorRate,
      averageResponseTime: responseTime || 0,
      activeUsers: activeUsers || 0,
      processingQueue: queueSize || 0,
    };
  }

  private async getSecurityMetrics() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    const [blockedRequests, suspiciousActivity, rateLimitViolations, authFailures] = await Promise.all([
      this.getSecurityMetric('blocked_requests', oneHourAgo, now),
      this.getSecurityMetric('suspicious_activity', oneHourAgo, now),
      this.getSecurityMetric('rate_limit_violations', oneHourAgo, now),
      this.getSecurityMetric('auth_failures', oneHourAgo, now),
    ]);

    return {
      blockedRequests: blockedRequests || 0,
      suspiciousActivity: suspiciousActivity || 0,
      rateLimitViolations: rateLimitViolations || 0,
      authFailures: authFailures || 0,
    };
  }

  private async getPerformanceMetrics() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    const [uploadTime, processingTime, exportTime, ocrAccuracy] = await Promise.all([
      PerformanceMonitoringService.getAggregatedMetrics('uploadTime', oneHourAgo, now, 'avg'),
      PerformanceMonitoringService.getAggregatedMetrics('processingTime', oneHourAgo, now, 'avg'),
      PerformanceMonitoringService.getAggregatedMetrics('exportTime', oneHourAgo, now, 'avg'),
      this.getOCRAccuracy(oneHourAgo, now),
    ]);

    return {
      uploadTime: uploadTime || 0,
      processingTime: processingTime || 0,
      exportTime: exportTime || 0,
      ocrAccuracy: ocrAccuracy || 0,
    };
  }

  private async getInfrastructureMetrics() {
    const [databaseHealth, redisHealth, storageInfo] = await Promise.all([
      this.getDatabaseHealth(),
      this.getRedisHealth(),
      this.getStorageInfo(),
    ]);

    return {
      database: databaseHealth,
      redis: redisHealth,
      storage: storageInfo,
    };
  }

  private async getActiveUserCount(): Promise<number> {
    try {
      // Count unique users in the last hour
      const oneHourAgo = new Date(Date.now() - 3600000);
      const activeUsers = await prisma.user.count({
        where: {
          lastLoginAt: {
            gte: oneHourAgo,
          },
        },
      });
      return activeUsers;
    } catch (error) {
      logger.error('Failed to get active user count', { error });
      return 0;
    }
  }

  private async getProcessingQueueSize(): Promise<number> {
    try {
      const queueSize = await redis.llen('processing_queue');
      return queueSize || 0;
    } catch (error) {
      logger.error('Failed to get processing queue size', { error });
      return 0;
    }
  }

  private async getSecurityMetric(metric: string, startTime: number, endTime: number): Promise<number> {
    try {
      const key = `security:metrics:${metric}`;
      const values = await redis.zrangebyscore(key, startTime, endTime);
      return values.length;
    } catch (error) {
      logger.error('Failed to get security metric', { error, metric });
      return 0;
    }
  }

  private async getOCRAccuracy(startTime: number, endTime: number): Promise<number> {
    try {
      const accuracyMetrics = await PerformanceMonitoringService.getAggregatedMetrics(
        'ocrAccuracy',
        startTime,
        endTime,
        'avg'
      );
      return accuracyMetrics || 0;
    } catch (error) {
      logger.error('Failed to get OCR accuracy', { error });
      return 0;
    }
  }

  private async getDatabaseHealth() {
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const queryTime = Date.now() - start;

      // Get connection count (simplified)
      const connections = 10; // This would need to be implemented based on your DB setup

      return {
        status: queryTime < 100 ? 'healthy' as const : queryTime < 500 ? 'degraded' as const : 'unhealthy' as const,
        connections,
        queryTime,
      };
    } catch (error) {
      logger.error('Database health check failed', { error });
      return {
        status: 'unhealthy' as const,
        connections: 0,
        queryTime: -1,
      };
    }
  }

  private async getRedisHealth() {
    try {
      const start = Date.now();
      await redis.ping();
      const responseTime = Date.now() - start;

      const info = await redis.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memory = memoryMatch ? parseInt(memoryMatch[1]) : 0;

      const keyCount = await redis.dbsize();

      return {
        status: responseTime < 50 ? 'healthy' as const : responseTime < 200 ? 'degraded' as const : 'unhealthy' as const,
        memory,
        keyCount,
      };
    } catch (error) {
      logger.error('Redis health check failed', { error });
      return {
        status: 'unhealthy' as const,
        memory: 0,
        keyCount: 0,
      };
    }
  }

  private async getStorageInfo() {
    try {
      const fs = require('fs');
      const path = require('path');

      const uploadDir = path.join(process.cwd(), 'uploads');
      const stats = fs.statSync(uploadDir);

      // Get upload count from database
      const uploadCount = await prisma.file.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      return {
        used: stats.size || 0,
        available: 1000000000, // 1GB - this would need to be calculated properly
        uploadCount,
      };
    } catch (error) {
      logger.error('Failed to get storage info', { error });
      return {
        used: 0,
        available: 0,
        uploadCount: 0,
      };
    }
  }

  private initializeDefaultAlertRules() {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        metric: 'application.errorRate',
        condition: 'greater_than',
        threshold: 0.05, // 5%
        severity: 'high',
        enabled: true,
        cooldownMinutes: 15,
      },
      {
        id: 'slow_response_time',
        name: 'Slow Response Time',
        metric: 'application.averageResponseTime',
        condition: 'greater_than',
        threshold: 5000, // 5 seconds
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 10,
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        metric: 'system.memoryUsage.heapUsed',
        condition: 'greater_than',
        threshold: 500000000, // 500MB
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 5,
      },
      {
        id: 'database_unhealthy',
        name: 'Database Unhealthy',
        metric: 'infrastructure.database.status',
        condition: 'equals',
        threshold: 'unhealthy' as any,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 1,
      },
      {
        id: 'redis_unhealthy',
        name: 'Redis Unhealthy',
        metric: 'infrastructure.redis.status',
        condition: 'equals',
        threshold: 'unhealthy' as any,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 1,
      },
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  private async checkAlertRules(metrics: DashboardMetrics) {
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      // Check cooldown
      const lastTriggered = this.alertCooldowns.get(ruleId);
      if (lastTriggered) {
        const cooldownExpiry = new Date(lastTriggered.getTime() + rule.cooldownMinutes * 60000);
        if (new Date() < cooldownExpiry) {
          continue;
        }
      }

      const metricValue = this.getMetricValue(metrics, rule.metric);
      const shouldTrigger = this.evaluateCondition(metricValue, rule.condition, rule.threshold);

      if (shouldTrigger) {
        await this.triggerAlert(rule, metricValue);
        this.alertCooldowns.set(ruleId, new Date());
      }
    }
  }

  private getMetricValue(metrics: DashboardMetrics, metricPath: string): any {
    const parts = metricPath.split('.');
    let value: any = metrics;

    for (const part of parts) {
      value = value?.[part];
    }

    return value;
  }

  private evaluateCondition(value: any, condition: string, threshold: any): boolean {
    switch (condition) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(rule: AlertRule, currentValue: any) {
    const alert = {
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      metric: rule.metric,
      threshold: rule.threshold,
      currentValue,
      timestamp: new Date(),
    };

    // Log the alert
    logger.warn('Alert triggered', alert);

    // Store alert in Redis for dashboard
    await redis.lpush('alerts:recent', JSON.stringify(alert));
    await redis.ltrim('alerts:recent', 0, 99); // Keep last 100 alerts

    // Send alert notification
    await this.sendAlertNotification(alert);
  }

  private async sendAlertNotification(alert: any) {
    try {
      const emailService = new EmailService();
      
      // Get admin users for critical alerts
      if (alert.severity === 'critical' || alert.severity === 'high') {
        const adminUsers = await prisma.user.findMany({
          where: { role: 'admin' },
          select: { email: true, name: true }
        });

        for (const admin of adminUsers) {
          await emailService.sendErrorNotificationEmail(admin.email, {
            type: 'System Alert',
            message: alert.message,
            severity: alert.severity,
            metric: alert.metric,
            value: alert.value,
            threshold: alert.threshold,
            timestamp: alert.timestamp,
            adminName: admin.name
          });
        }
      }

      logger.info('Alert notification sent', { 
        alert,
        recipientCount: alert.severity === 'critical' || alert.severity === 'high' ? 'admins' : 'logged'
      });
    } catch (error) {
      logger.error('Failed to send alert notification', { error, alert });
    }
  }

  /**
   * Get recent alerts
   */
  public async getRecentAlerts(limit: number = 20) {
    try {
      const alerts = await redis.lrange('alerts:recent', 0, limit - 1);
      return alerts.map(alert => JSON.parse(alert));
    } catch (error) {
      logger.error('Failed to get recent alerts', { error });
      return [];
    }
  }

  /**
   * Add or update alert rule
   */
  public addAlertRule(rule: AlertRule) {
    this.alertRules.set(rule.id, rule);
  }

  /**
   * Get all alert rules
   */
  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Enable/disable alert rule
   */
  public toggleAlertRule(ruleId: string, enabled: boolean) {
    const rule = this.alertRules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }
}
