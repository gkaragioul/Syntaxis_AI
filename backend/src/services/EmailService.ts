import nodemailer from 'nodemailer';
import { NotificationStatus } from '../models/Notification';
import { logger } from '../utils/logger';
import { config } from '../config';

interface JobStatusEmailParams {
  userId: string;
  batchJobId: string;
  status: NotificationStatus;
  message: string;
}

interface ErrorNotificationEmailParams {
  userId: string;
  batchJobId: string;
  errorType: string;
  errorMessage: string;
  errorReportId: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.smtpHost,
      port: config.email.smtpPort,
      secure: config.email.smtpSecure,
      auth: {
        user: config.email.smtpUser,
        pass: config.email.smtpPassword,
      },
    });
  }

  async sendJobStatusEmail(params: JobStatusEmailParams) {
    const { userId, batchJobId, status, message } = params;

    // Get user email from database
    const { prisma } = await import('../prisma');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!user || !user.email) {
      logger.warn('Cannot send email: user not found or email missing', { userId });
      return;
    }

    const subject = `Batch Job ${status}: ${batchJobId}`;
    const html = this.generateJobStatusEmailHtml({
      batchJobId,
      status,
      message,
    });

    try {
      await this.transporter.sendMail({
        from: config.email.fromAddress,
        to: user.email,
        subject,
        html,
      });

      logger.info('Job status email sent successfully', {
        userId,
        email: user.email,
        batchJobId,
        status,
      });
    } catch (error) {
      logger.error('Failed to send job status email', {
        error,
        userId,
        batchJobId,
        status,
      });
      throw error;
    }
  }

  async sendErrorNotificationEmail(params: ErrorNotificationEmailParams) {
    const { userId, batchJobId, errorType, errorMessage, errorReportId } =
      params;

    // Get user email from database
    const { prisma } = await import('../prisma');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!user || !user.email) {
      logger.warn('Cannot send error email: user not found or email missing', { userId });
      return;
    }

    const subject = `Error in Batch Job: ${batchJobId}`;
    const html = this.generateErrorNotificationEmailHtml({
      batchJobId,
      errorType,
      errorMessage,
      errorReportId,
    });

    try {
      await this.transporter.sendMail({
        from: config.email.fromAddress,
        to: user.email,
        subject,
        html,
      });

      logger.info('Error notification email sent successfully', {
        userId,
        email: user.email,
        batchJobId,
        errorType,
      });
    } catch (error) {
      logger.error('Failed to send error notification email', {
        error,
        userId,
        batchJobId,
        errorType,
      });
      throw error;
    }
  }

  private generateJobStatusEmailHtml(params: {
    batchJobId: string;
    status: NotificationStatus;
    message: string;
  }): string {
    const { batchJobId, status, message } = params;
    const statusColor =
      status === NotificationStatus.COMPLETED ? '#4CAF50' : '#F44336';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${statusColor};">Batch Job ${status}</h2>
        <p>Your batch job (ID: ${batchJobId}) has ${status.toLowerCase()}.</p>
        <p>${message}</p>
        <p>
          <a href="${config.app?.url || 'http://localhost:5173'}/jobs/${batchJobId}"
             style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            View Job Details
          </a>
        </p>
      </div>
    `;
  }

  private generateErrorNotificationEmailHtml(params: {
    batchJobId: string;
    errorType: string;
    errorMessage: string;
    errorReportId: string;
  }): string {
    const { batchJobId, errorType, errorMessage, errorReportId } = params;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #F44336;">Error in Batch Job</h2>
        <p>An error occurred while processing your batch job (ID: ${batchJobId}).</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0;">
          <p><strong>Error Type:</strong> ${errorType}</p>
          <p><strong>Error Message:</strong> ${errorMessage}</p>
        </div>
        <p>
          <a href="${config.app?.url || 'http://localhost:5173'}/jobs/${batchJobId}"
             style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-right: 10px;">
            View Job Details
          </a>
          <a href="${config.app?.url || 'http://localhost:5173'}/error-reports/${errorReportId}"
             style="background-color: #FF9800; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            Download Error Report
          </a>
        </p>
      </div>
    `;
  }
}
