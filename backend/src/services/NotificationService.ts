// @ts-nocheck

import {
  NotificationModel,
  NotificationType,
  NotificationPriority,
  EmailFrequency,
  CreateNotificationInput,
  CreateErrorReportInput,
  UpdateUserPreferencesInput,
  NotificationError,
  NotificationStatus,
} from '../models/Notification';
import { Queue } from 'bull';
import { redis } from '../redis';
import { createTransport } from 'nodemailer';
import { generatePDF } from '../utils/pdf';
import { generateCSV } from '../utils/csv';
import { sanitizeData } from '../utils/sanitize';
import { logger } from '../utils/logger';
import { config } from '../config';
import { ErrorReportModel } from '../models/ErrorReport';
import { EmailService } from './EmailService';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class NotificationService {
  private readonly emailQueue: Queue;
  private readonly emailTransport: ReturnType<typeof createTransport>;
  private readonly redis: Redis;

  constructor(
    private readonly notificationModel: NotificationModel,
    private readonly errorReportModel: ErrorReportModel,
    private readonly emailService: EmailService,
    redisUrl: string,
    emailConfig: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    },
  ) {
    // Initialize email queue
    this.emailQueue = new Queue('email-notifications', redisUrl);
    this.emailQueue.on('error', (err) => logger.warn('Bull queue error (email-notifications)', { error: err.message }));
    this.emailQueue.process(this.processEmailJob.bind(this));

    // Initialize email transport
    this.emailTransport = createTransport(emailConfig);

    // Use shared Redis instance
    this.redis = redis;

    // Start cleanup job
    this.startCleanupJob();
  }

  // Notification methods
  async createNotification(input: CreateNotificationInput): Promise<void> {
    // Sanitize input
    const sanitizedInput = {
      ...input,
      title: sanitizeData(input.title),
      message: sanitizeData(input.message),
      metadata: sanitizeData(input.metadata || {}),
    };

    // Create notification
    const notification = await this.notificationModel.create(sanitizedInput);

    // Get user preferences
    const preferences = await this.notificationModel.getUserPreferences(
      input.userId,
    );

    // Create in-app notification if enabled
    if (
      preferences.inAppNotifications &&
      preferences.notificationTypes[input.type]
    ) {
      await this.notificationModel.createDeliveryLog(
        notification.id,
        'in_app',
        'pending',
      );
    }

    // Queue email if enabled and frequency matches
    if (
      preferences.emailNotifications &&
      preferences.notificationTypes[input.type] &&
      this.shouldSendEmail(
        preferences.emailFrequency,
        preferences.lastEmailSentAt,
      )
    ) {
      await this.queueEmailNotification(notification);
    }
  }

  async getNotifications(
    userId: string,
    filter: {
      type?: NotificationType;
      read?: boolean;
      startDate?: Date;
      endDate?: Date;
    } = {},
    limit = 50,
    offset = 0,
  ): Promise<{ notifications: any[]; total: number }> {
    return this.notificationModel.findMany(userId, filter, limit, offset);
  }

  async markNotificationsAsRead(
    userId: string,
    notificationIds?: string[],
  ): Promise<number> {
    const count = await this.notificationModel.markAsRead(
      userId,
      notificationIds,
    );

    // Update delivery logs for marked notifications
    if (notificationIds) {
      await Promise.all(
        notificationIds.map((id) =>
          this.notificationModel.createDeliveryLog(id, 'in_app', 'read'),
        ),
      );
    }

    return count;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.getUnreadCount(userId);
  }

  // Error report methods
  async createErrorReport(input: CreateErrorReportInput): Promise<void> {
    // Sanitize input
    const sanitizedInput = {
      ...input,
      errorMessage: sanitizeData(input.errorMessage),
      errorDetails: sanitizeData(input.errorDetails || {}),
      contextData: sanitizeData(input.contextData || {}),
    };

    // Create error report
    const errorReport = await this.errorReportModel.create(sanitizedInput);

    // Generate error report file
    await this.generateErrorReportFile(errorReport);

    // Create notification for the error
    await this.createNotification({
      userId: input.userId,
      batchJobId: input.batchJobId,
      type: NotificationType.EXTRACTION_ERROR,
      priority: NotificationPriority.HIGH,
      title: 'Extraction Error Report Available',
      message: `An error occurred during processing. Error report #${errorReport.id} is available for download.`,
      metadata: {
        errorReportId: errorReport.id,
        errorType: input.errorType,
        errorCode: input.errorCode,
      },
    });
  }

  async getErrorReport(userId: string, reportId: string): Promise<any> {
    const report = await this.notificationModel.findErrorReportById(
      reportId,
      userId,
    );

    // Increment download count
    await this.notificationModel.incrementDownloadCount(reportId);

    return report;
  }

  // User preferences methods
  async getUserPreferences(userId: string): Promise<any> {
    return this.notificationModel.getUserPreferences(userId);
  }

  async updateUserPreferences(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<any> {
    return this.notificationModel.updateUserPreferences(userId, input);
  }

  // Private methods
  private async queueEmailNotification(notification: any): Promise<void> {
    await this.emailQueue.add(
      'send-email',
      {
        notificationId: notification.id,
        userId: notification.userId,
        type: notification.type,
        priority: notification.priority,
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );
  }

  private async processEmailJob(job: any): Promise<void> {
    const { notificationId, userId, type, priority, title, message, metadata } =
      job.data;

    try {
      // Get user preferences
      const preferences =
        await this.notificationModel.getUserPreferences(userId);

      // Check if email notifications are still enabled
      if (
        !preferences.emailNotifications ||
        !preferences.notificationTypes[type]
      ) {
        await this.notificationModel.updateEmailStatus(
          notificationId,
          'failed',
          'Email notifications disabled',
        );
        return;
      }

      // Generate email template
      const template = await this.generateEmailTemplate({
        type,
        priority,
        title,
        message,
        metadata,
      });

      // Send email
      await this.emailTransport.sendMail({
        from: config.email.from,
        to: preferences.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      // Update notification status
      await this.notificationModel.updateEmailStatus(notificationId, 'sent');

      // Create delivery log
      await this.notificationModel.createDeliveryLog(
        notificationId,
        'email',
        'sent',
      );

      // Update last email sent timestamp
      await this.notificationModel.updateUserPreferences(userId, {
        lastEmailSentAt: new Date(),
      });
    } catch (error) {
      logger.error('Failed to send email notification:', error);

      // Update notification status
      await this.notificationModel.updateEmailStatus(
        notificationId,
        'failed',
        error.message,
      );

      // Create delivery log
      await this.notificationModel.createDeliveryLog(
        notificationId,
        'email',
        'failed',
        error.message,
      );

      throw error;
    }
  }

  private async generateEmailTemplate(data: {
    type: NotificationType;
    priority: NotificationPriority;
    title: string;
    message: string;
    metadata: Record<string, any>;
  }): Promise<EmailTemplate> {
    const { type, priority, title, message, metadata } = data;

    // Generate email subject
    const subject = `[${priority.toUpperCase()}] ${title}`;

    // Generate email HTML
    const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: ${this.getPriorityColor(priority)};">${title}</h2>
                <p>${message}</p>
                ${this.generateMetadataHTML(metadata)}
                <hr>
                <p style="color: #666; font-size: 12px;">
                    This is an automated message from SyntaxisAI.
                    You can manage your notification preferences in your account settings.
                </p>
            </div>
        `;

    // Generate email text
    const text = `
            ${title}
            ${'='.repeat(title.length)}

            ${message}

            ${this.generateMetadataText(metadata)}

            ---
            This is an automated message from SyntaxisAI.
            You can manage your notification preferences in your account settings.
        `;

    return { subject, html, text };
  }

  private async generateErrorReportFile(report: any): Promise<void> {
    const {
      id,
      errorType,
      errorCode,
      errorMessage,
      errorDetails,
      troubleshootingTips,
      contextData,
    } = report;

    // Generate PDF report
    const pdfPath = await generatePDF({
      title: `Error Report #${id}`,
      content: [
        {
          type: 'heading',
          text: `Error Report #${id}`,
        },
        {
          type: 'section',
          title: 'Error Details',
          content: [
            { label: 'Type', value: errorType },
            { label: 'Code', value: errorCode },
            { label: 'Message', value: errorMessage },
          ],
        },
        {
          type: 'section',
          title: 'Troubleshooting Tips',
          content: troubleshootingTips.map((tip: string) => ({
            type: 'bullet',
            text: tip,
          })),
        },
        {
          type: 'section',
          title: 'Context Data',
          content: Object.entries(contextData).map(([key, value]) => ({
            label: key,
            value: JSON.stringify(value, null, 2),
          })),
        },
        {
          type: 'section',
          title: 'Error Details',
          content: Object.entries(errorDetails).map(([key, value]) => ({
            label: key,
            value: JSON.stringify(value, null, 2),
          })),
        },
      ],
    });

    // Generate CSV report
    const csvPath = await generateCSV([
      {
        name: 'error_details',
        data: [
          { field: 'error_type', value: errorType },
          { field: 'error_code', value: errorCode },
          { field: 'error_message', value: errorMessage },
        ],
      },
      {
        name: 'troubleshooting_tips',
        data: troubleshootingTips.map((tip: string) => ({
          tip,
        })),
      },
      {
        name: 'context_data',
        data: [contextData],
      },
      {
        name: 'error_details',
        data: [errorDetails],
      },
    ]);

    // Update report with file paths
    await Promise.all([
      this.notificationModel.updateErrorReportFile(
        id,
        pdfPath,
        await this.getFileSize(pdfPath),
        'pdf',
      ),
      this.notificationModel.updateErrorReportFile(
        id,
        csvPath,
        await this.getFileSize(csvPath),
        'csv',
      ),
    ]);
  }

  private shouldSendEmail(
    frequency: EmailFrequency,
    lastEmailSentAt?: Date,
  ): boolean {
    if (!lastEmailSentAt) return true;

    const now = new Date();
    const hoursSinceLastEmail =
      (now.getTime() - lastEmailSentAt.getTime()) / (1000 * 60 * 60);

    switch (frequency) {
      case EmailFrequency.IMMEDIATE:
        return true;
      case EmailFrequency.DAILY:
        return hoursSinceLastEmail >= 24;
      case EmailFrequency.WEEKLY:
        return hoursSinceLastEmail >= 24 * 7;
      default:
        return false;
    }
  }

  private getPriorityColor(priority: NotificationPriority): string {
    switch (priority) {
      case NotificationPriority.URGENT:
        return '#dc3545';
      case NotificationPriority.HIGH:
        return '#fd7e14';
      case NotificationPriority.MEDIUM:
        return '#ffc107';
      case NotificationPriority.LOW:
        return '#28a745';
      default:
        return '#6c757d';
    }
  }

  private generateMetadataHTML(metadata: Record<string, any>): string {
    if (!metadata || Object.keys(metadata).length === 0) return '';

    return `
            <div style="margin-top: 20px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
                <h3 style="margin-top: 0;">Additional Information</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    ${Object.entries(metadata)
        .map(
          ([key, value]) => `
                        <tr>
                            <td style="padding: 5px; font-weight: bold;">${key}:</td>
                            <td style="padding: 5px;">${JSON.stringify(value)}</td>
                        </tr>
                    `,
        )
        .join('')}
                </table>
            </div>
        `;
  }

  private generateMetadataText(metadata: Record<string, any>): string {
    if (!metadata || Object.keys(metadata).length === 0) return '';

    return `
            Additional Information:
            ${Object.entries(metadata)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n')}
        `;
  }

  private async getFileSize(filePath: string): Promise<number> {
    const fs = await import('fs/promises');
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  private startCleanupJob(): void {
    // Run cleanup every hour
    setInterval(
      async () => {
        try {
          const count = await this.notificationModel.cleanupExpired();
          logger.info(
            `Cleaned up ${count} expired notifications and error reports`,
          );
        } catch (error) {
          logger.error('Failed to cleanup expired notifications:', error);
        }
      },
      60 * 60 * 1000,
    );
  }

  async createJobStatusNotification(params: {
    userId: string;
    batchJobId: string;
    status: NotificationStatus;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    const { userId, batchJobId, status, message, metadata } = params;

    // Create in-app notification
    const notification = await NotificationModel.create({
      userId,
      batchJobId,
      type: NotificationType.STATUS,
      status,
      message,
      metadata,
    });

    // Send email notification if status is completed or failed
    if (
      status === NotificationStatus.COMPLETED ||
      status === NotificationStatus.FAILED
    ) {
      try {
        await this.emailService.sendJobStatusEmail({
          userId,
          batchJobId,
          status,
          message,
        });
      } catch (error) {
        logger.error('Failed to send job status email', {
          error,
          userId,
          batchJobId,
          status,
        });
        // Don't throw - we still want to return the in-app notification
      }
    }

    return notification;
  }

  async createErrorNotification(params: {
    userId: string;
    batchJobId: string;
    errorType: string;
    errorCode: string;
    errorMessage: string;
    errorDetails?: Record<string, unknown>;
    troubleshootingTips: string[];
    stackTrace?: string;
  }) {
    const {
      userId,
      batchJobId,
      errorType,
      errorCode,
      errorMessage,
      errorDetails,
      troubleshootingTips,
      stackTrace,
    } = params;

    // Create error report
    const errorReport = await ErrorReportModel.create({
      userId,
      batchJobId,
      errorType,
      errorCode,
      errorMessage,
      errorDetails,
      troubleshootingTips,
      stackTrace,
    });

    // Create in-app notification
    const notification = await NotificationModel.create({
      userId,
      batchJobId,
      type: NotificationType.ERROR,
      status: NotificationStatus.FAILED,
      message: `Error in batch job: ${errorMessage}`,
      metadata: {
        errorReportId: errorReport.id,
        errorType,
        errorCode,
      },
    });

    // Send error notification email
    try {
      await this.emailService.sendErrorNotificationEmail({
        userId,
        batchJobId,
        errorType,
        errorMessage,
        errorReportId: errorReport.id,
      });
    } catch (error) {
      logger.error('Failed to send error notification email', {
        error,
        userId,
        batchJobId,
        errorType,
      });
      // Don't throw - we still want to return the notification and error report
    }

    return { notification, errorReport };
  }

  async getUserNotifications(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    return NotificationModel.findByUserId(userId, options);
  }

  async markNotificationAsRead(id: string) {
    return NotificationModel.markAsRead(id);
  }
}
