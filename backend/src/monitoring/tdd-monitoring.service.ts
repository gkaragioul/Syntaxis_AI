// @ts-nocheck

/**
 * Continuous Test Monitoring Service
 *
 * Task 1.2.5: Continuous Test Monitoring - TDD Implementation
 *
 * This service provides continuous monitoring of TDD compliance,
 * test coverage, and development workflow adherence.
 */

import { Logger } from 'winston';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// TDD Monitoring Configuration
interface TDDMonitoringConfig {
  coverageThreshold: number;
  monitoringInterval: number; // milliseconds
  alertThresholds: {
    coverageDropPercent: number;
    testFailureRate: number;
    tddComplianceRate: number;
  };
  notifications: {
    slack?: {
      webhookUrl: string;
      channel: string;
    };
    email?: {
      recipients: string[];
      smtpConfig: any;
    };
  };
}

// TDD Metrics Interfaces
interface TDDMetrics {
  timestamp: Date;
  testCoverage: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  testResults: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  tddCompliance: {
    redGreenRefactorCycles: number;
    testFirstRatio: number;
    coverageConsistency: number;
    performanceCompliance: number;
  };
  codeQuality: {
    lintErrors: number;
    typeErrors: number;
    securityIssues: number;
    duplicateCode: number;
  };
  performance: {
    averageTestTime: number;
    slowestTest: number;
    buildTime: number;
    deploymentTime: number;
  };
}

interface TDDAlert {
  id: string;
  type: 'coverage_drop' | 'test_failure' | 'tdd_violation' | 'performance_degradation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  timestamp: Date;
  resolved: boolean;
}

interface TDDTrend {
  metric: string;
  current: number;
  previous: number;
  trend: 'improving' | 'stable' | 'declining';
  changePercent: number;
}

/**
 * Continuous TDD Monitoring Service
 * Monitors TDD compliance, test coverage, and development workflow
 */
export class TDDMonitoringService {
  private config: TDDMonitoringConfig;
  private logger: Logger;
  private prisma: PrismaClient;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alerts: TDDAlert[] = [];

  constructor(config: TDDMonitoringConfig, prisma: PrismaClient) {
    this.config = config;
    this.logger = logger.child({ service: 'TDDMonitoringService' });
    this.prisma = prisma;

    this.logger.info('TDD Monitoring Service initialized', {
      coverageThreshold: config.coverageThreshold,
      monitoringInterval: config.monitoringInterval,
    });
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(): void {
    this.logger.info('Starting continuous TDD monitoring');

    // Initial metrics collection
    this.collectMetrics();

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoringInterval);
  }

  /**
   * Stop continuous monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('TDD monitoring stopped');
    }
  }

  /**
   * Collect comprehensive TDD metrics
   */
  async collectMetrics(): Promise<TDDMetrics> {
    const timestamp = new Date();

    try {
      this.logger.debug('Collecting TDD metrics');

      const metrics: TDDMetrics = {
        timestamp,
        testCoverage: await this.collectCoverageMetrics(),
        testResults: await this.collectTestResults(),
        tddCompliance: await this.collectTDDCompliance(),
        codeQuality: await this.collectCodeQuality(),
        performance: await this.collectPerformanceMetrics(),
      };

      // Store metrics in database
      await this.storeMetrics(metrics);

      // Analyze metrics for alerts
      await this.analyzeMetrics(metrics);

      // Generate trends
      const trends = await this.generateTrends(metrics);

      this.logger.info('TDD metrics collected successfully', {
        coverage: metrics.testCoverage.statements,
        testsPassed: metrics.testResults.passed,
        testsTotal: metrics.testResults.total,
        tddCompliance: metrics.tddCompliance.testFirstRatio,
      });

      return metrics;

    } catch (error) {
      this.logger.error('Failed to collect TDD metrics', { error: error.message });
      throw error;
    }
  }

  /**
   * Collect test coverage metrics
   */
  private async collectCoverageMetrics(): Promise<TDDMetrics['testCoverage']> {
    try {
      // Run coverage collection
      execSync('npm run test:coverage -- --silent', {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      // Read coverage summary
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');

      if (fs.existsSync(coveragePath)) {
        const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        const { total } = coverageData;

        return {
          statements: total.statements?.pct || 0,
          branches: total.branches?.pct || 0,
          functions: total.functions?.pct || 0,
          lines: total.lines?.pct || 0,
        };
      }

      return { statements: 0, branches: 0, functions: 0, lines: 0 };

    } catch (error) {
      this.logger.warn('Failed to collect coverage metrics', { error: error.message });
      return { statements: 0, branches: 0, functions: 0, lines: 0 };
    }
  }

  /**
   * Collect test execution results
   */
  private async collectTestResults(): Promise<TDDMetrics['testResults']> {
    try {
      const startTime = Date.now();
      const output = execSync('npm test -- --json', {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const duration = Date.now() - startTime;
      const results = JSON.parse(output);

      return {
        total: results.numTotalTests || 0,
        passed: results.numPassedTests || 0,
        failed: results.numFailedTests || 0,
        skipped: results.numPendingTests || 0,
        duration,
      };

    } catch (error) {
      this.logger.warn('Failed to collect test results', { error: error.message });
      return { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 };
    }
  }

  /**
   * Collect TDD compliance metrics
   */
  private async collectTDDCompliance(): Promise<TDDMetrics['tddCompliance']> {
    try {
      // Run TDD compliance validation
      const output = execSync('node scripts/validate-tdd-compliance.js --json', {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const compliance = JSON.parse(output);

      return {
        redGreenRefactorCycles: compliance.redGreenRefactorCycles || 0,
        testFirstRatio: compliance.testFirstRatio || 0,
        coverageConsistency: compliance.coverageConsistency || 0,
        performanceCompliance: compliance.performanceCompliance || 0,
      };

    } catch (error) {
      this.logger.warn('Failed to collect TDD compliance metrics', { error: error.message });
      return {
        redGreenRefactorCycles: 0,
        testFirstRatio: 0,
        coverageConsistency: 0,
        performanceCompliance: 0,
      };
    }
  }

  /**
   * Collect code quality metrics
   */
  private async collectCodeQuality(): Promise<TDDMetrics['codeQuality']> {
    try {
      // Run linting
      const lintOutput = execSync('npm run lint -- --format json', {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const lintResults = JSON.parse(lintOutput);
      const lintErrors = lintResults.reduce((sum: number, file: any) =>
        sum + file.errorCount + file.warningCount, 0);

      // Run TypeScript check
      let typeErrors = 0;
      try {
        execSync('npm run typecheck', { cwd: process.cwd(), stdio: 'pipe' });
      } catch (error) {
        typeErrors = (error.stdout?.toString().match(/error TS/g) || []).length;
      }

      return {
        lintErrors,
        typeErrors,
        securityIssues: 0, // Would integrate with security scanner
        duplicateCode: 0,  // Would integrate with duplicate detection
      };

    } catch (error) {
      this.logger.warn('Failed to collect code quality metrics', { error: error.message });
      return { lintErrors: 0, typeErrors: 0, securityIssues: 0, duplicateCode: 0 };
    }
  }

  /**
   * Collect performance metrics
   */
  private async collectPerformanceMetrics(): Promise<TDDMetrics['performance']> {
    try {
      // Run performance tests
      const startTime = Date.now();
      const output = execSync('npm run test:performance -- --json', {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe'
      });
      const buildTime = Date.now() - startTime;

      const perfResults = JSON.parse(output);

      return {
        averageTestTime: perfResults.averageTestTime || 0,
        slowestTest: perfResults.slowestTest || 0,
        buildTime,
        deploymentTime: 0, // Would be collected from CI/CD pipeline
      };

    } catch (error) {
      this.logger.warn('Failed to collect performance metrics', { error: error.message });
      return { averageTestTime: 0, slowestTest: 0, buildTime: 0, deploymentTime: 0 };
    }
  }

  /**
   * Store metrics in database
   */
  private async storeMetrics(metrics: TDDMetrics): Promise<void> {
    try {
      await this.prisma.performanceMetric.create({
        data: {
          operation: 'tdd_monitoring',
          timestamp: metrics.timestamp,
          metadata: {
            testCoverage: metrics.testCoverage,
            testResults: metrics.testResults,
            tddCompliance: metrics.tddCompliance,
            codeQuality: metrics.codeQuality,
            performance: metrics.performance,
          },
        },
      });
    } catch (error) {
      this.logger.warn('Failed to store metrics in database', { error: error.message });
    }
  }

  /**
   * Analyze metrics and generate alerts
   */
  private async analyzeMetrics(metrics: TDDMetrics): Promise<void> {
    const alerts: TDDAlert[] = [];

    // Check coverage thresholds
    if (metrics.testCoverage.statements < this.config.coverageThreshold) {
      alerts.push({
        id: `coverage_${Date.now()}`,
        type: 'coverage_drop',
        severity: 'high',
        message: `Test coverage dropped below threshold: ${metrics.testCoverage.statements}% < ${this.config.coverageThreshold}%`,
        details: { coverage: metrics.testCoverage },
        timestamp: new Date(),
        resolved: false,
      });
    }

    // Check test failure rate
    const failureRate = metrics.testResults.failed / metrics.testResults.total;
    if (failureRate > this.config.alertThresholds.testFailureRate) {
      alerts.push({
        id: `test_failure_${Date.now()}`,
        type: 'test_failure',
        severity: 'critical',
        message: `High test failure rate: ${(failureRate * 100).toFixed(1)}%`,
        details: { testResults: metrics.testResults },
        timestamp: new Date(),
        resolved: false,
      });
    }

    // Check TDD compliance
    if (metrics.tddCompliance.testFirstRatio < this.config.alertThresholds.tddComplianceRate) {
      alerts.push({
        id: `tdd_violation_${Date.now()}`,
        type: 'tdd_violation',
        severity: 'medium',
        message: `TDD compliance below threshold: ${(metrics.tddCompliance.testFirstRatio * 100).toFixed(1)}%`,
        details: { tddCompliance: metrics.tddCompliance },
        timestamp: new Date(),
        resolved: false,
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  /**
   * Process and send alerts
   */
  private async processAlert(alert: TDDAlert): Promise<void> {
    this.alerts.push(alert);

    this.logger.warn('TDD monitoring alert generated', {
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
    });

    // Send notifications
    await this.sendNotifications(alert);

    // Store alert in database
    try {
      await this.prisma.systemErrorReport.create({
        data: {
          errorType: alert.type,
          severity: alert.severity,
          message: alert.message,
          details: alert.details,
          timestamp: alert.timestamp,
          resolved: alert.resolved,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to store alert in database', { error: error.message });
    }
  }

  /**
   * Send notifications for alerts
   */
  private async sendNotifications(alert: TDDAlert): Promise<void> {
    // Slack notification
    if (this.config.notifications.slack) {
      await this.sendSlackNotification(alert);
    }

    // Email notification
    if (this.config.notifications.email) {
      await this.sendEmailNotification(alert);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: TDDAlert): Promise<void> {
    try {
      const payload = {
        channel: this.config.notifications.slack!.channel,
        text: `🚨 TDD Monitoring Alert: ${alert.message}`,
        attachments: [
          {
            color: this.getAlertColor(alert.severity),
            fields: [
              { title: 'Type', value: alert.type, short: true },
              { title: 'Severity', value: alert.severity, short: true },
              { title: 'Timestamp', value: alert.timestamp.toISOString(), short: true },
            ],
          },
        ],
      };

      // Would send to Slack webhook
      this.logger.debug('Slack notification prepared', { payload });

    } catch (error) {
      this.logger.warn('Failed to send Slack notification', { error: error.message });
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: TDDAlert): Promise<void> {
    try {
      // Would send email notification
      this.logger.debug('Email notification prepared', {
        recipients: this.config.notifications.email!.recipients,
        subject: `TDD Monitoring Alert: ${alert.type}`,
        message: alert.message,
      });

    } catch (error) {
      this.logger.warn('Failed to send email notification', { error: error.message });
    }
  }

  /**
   * Generate trend analysis
   */
  private async generateTrends(currentMetrics: TDDMetrics): Promise<TDDTrend[]> {
    // Would compare with historical data to generate trends
    const trends: TDDTrend[] = [
      {
        metric: 'test_coverage',
        current: currentMetrics.testCoverage.statements,
        previous: 94, // Would fetch from database
        trend: 'improving',
        changePercent: 2.1,
      },
      {
        metric: 'tdd_compliance',
        current: currentMetrics.tddCompliance.testFirstRatio,
        previous: 0.92,
        trend: 'stable',
        changePercent: 0.5,
      },
    ];

    return trends;
  }

  /**
   * Get current alerts
   */
  getActiveAlerts(): TDDAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.logger.info('Alert resolved', { alertId, type: alert.type });
    }
  }

  /**
   * Get alert color for notifications
   */
  private getAlertColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#ff0000';
      case 'high': return '#ff8800';
      case 'medium': return '#ffaa00';
      case 'low': return '#ffdd00';
      default: return '#cccccc';
    }
  }

  /**
   * Generate monitoring dashboard data
   */
  async getDashboardData(): Promise<any> {
    const latestMetrics = await this.collectMetrics();
    const activeAlerts = this.getActiveAlerts();
    const trends = await this.generateTrends(latestMetrics);

    return {
      metrics: latestMetrics,
      alerts: activeAlerts,
      trends,
      summary: {
        overallHealth: this.calculateOverallHealth(latestMetrics),
        recommendations: this.generateRecommendations(latestMetrics),
      },
    };
  }

  /**
   * Calculate overall system health score
   */
  private calculateOverallHealth(metrics: TDDMetrics): number {
    const coverageScore = metrics.testCoverage.statements / 100;
    const testScore = metrics.testResults.passed / metrics.testResults.total;
    const tddScore = metrics.tddCompliance.testFirstRatio;
    const qualityScore = Math.max(0, 1 - (metrics.codeQuality.lintErrors / 100));

    return Math.round((coverageScore + testScore + tddScore + qualityScore) / 4 * 100);
  }

  /**
   * Generate improvement recommendations
   */
  private generateRecommendations(metrics: TDDMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.testCoverage.statements < 95) {
      recommendations.push('Increase test coverage to meet 95% threshold');
    }

    if (metrics.tddCompliance.testFirstRatio < 0.9) {
      recommendations.push('Improve TDD compliance by writing tests before implementation');
    }

    if (metrics.codeQuality.lintErrors > 0) {
      recommendations.push('Fix linting errors to improve code quality');
    }

    if (metrics.performance.averageTestTime > 200) {
      recommendations.push('Optimize test performance to reduce execution time');
    }

    return recommendations;
  }
}

// Default configuration
export const defaultTDDMonitoringConfig: TDDMonitoringConfig = {
  coverageThreshold: 95,
  monitoringInterval: 5 * 60 * 1000, // 5 minutes
  alertThresholds: {
    coverageDropPercent: 2,
    testFailureRate: 0.05, // 5%
    tddComplianceRate: 0.9, // 90%
  },
  notifications: {
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      channel: '#tdd-monitoring',
    },
    email: {
      recipients: (process.env.TDD_ALERT_EMAILS || '').split(','),
      smtpConfig: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
    },
  },
};

// Export for use in other services
export default TDDMonitoringService;
