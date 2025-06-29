import { CronJob } from 'cron';
import { ErrorReportGenerator } from '../services/ErrorReportGenerator';
import { AuditLogService } from '../services/AuditLogService';
import { MetricsService } from '../services/MetricsService';
import { logger } from '../utils/logger';
import { config } from '../config';

export class CleanupTask {
  private errorReportGenerator: ErrorReportGenerator;
  private auditLogService: AuditLogService;
  private metricsService: MetricsService;
  private jobs: CronJob[] = [];

  constructor() {
    this.errorReportGenerator = new ErrorReportGenerator();
    this.auditLogService = new AuditLogService();
    this.metricsService = new MetricsService();
  }

  start() {
    // Clean up old error reports daily at 2 AM
    this.jobs.push(
      new CronJob('0 2 * * *', async () => {
        try {
          const deletedCount =
            await this.errorReportGenerator.cleanupOldReports(
              config.cleanup.errorReportRetentionDays,
            );
          logger.info('Cleaned up old error reports', { deletedCount });
        } catch (error) {
          logger.error('Failed to clean up old error reports', { error });
        }
      }),
    );

    // Clean up old audit logs weekly on Sunday at 3 AM
    this.jobs.push(
      new CronJob('0 3 * * 0', async () => {
        try {
          const deletedCount = await this.auditLogService.cleanupOldLogs(
            config.cleanup.auditLogRetentionDays,
          );
          logger.info('Cleaned up old audit logs', { deletedCount });
        } catch (error) {
          logger.error('Failed to clean up old audit logs', { error });
        }
      }),
    );

    // Collect metrics every hour
    this.jobs.push(
      new CronJob('0 * * * *', async () => {
        try {
          const metrics = await this.metricsService.trackNotificationMetrics();
          logger.info('Collected notification metrics', { metrics });
        } catch (error) {
          logger.error('Failed to collect notification metrics', { error });
        }
      }),
    );

    // Start all jobs
    this.jobs.forEach((job) => job.start());
    logger.info('Started cleanup and metrics collection tasks');
  }

  stop() {
    this.jobs.forEach((job) => job.stop());
    logger.info('Stopped cleanup and metrics collection tasks');
  }
}
