// @ts-nocheck

import { logger } from '../utils/logger';

/**
 * Stub EmailService to allow the app to run without nodemailer/handlebars
 * during initial stabilization.
 */
export class EmailService {
  constructor() {
    logger.info('EmailService initialized (STUB MODE)');
  }

  private async mockSend(options: any) {
    logger.info('MOCK EMAIL SEND:', {
      to: options.to,
      subject: options.subject,
      template: options.template,
      data: options.data
    });
    return Promise.resolve();
  }

  async sendEmail(options: any) {
    return this.mockSend(options);
  }

  async sendVerificationEmail(email: string, token: string) {
    await this.sendEmail({
      to: email,
      subject: 'Verify your email',
      template: 'email-verification',
      data: { token },
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    await this.sendEmail({
      to: email,
      subject: 'Reset your password',
      template: 'password-reset',
      data: { token },
    });
  }

  async sendWelcomeEmail(email: string, name: string) {
    await this.sendEmail({
      to: email,
      subject: 'Welcome to SyntaxisAI',
      template: 'welcome',
      data: { name },
    });
  }

  async sendInvoiceProcessedEmail(email: string, invoiceData: any) {
    await this.sendEmail({
      to: email,
      subject: 'Invoice Processed Successfully',
      template: 'invoice-processed',
      data: invoiceData,
    });
  }

  async sendErrorNotificationEmail(email: string, errorData: any) {
    await this.sendEmail({
      to: email,
      subject: 'Invoice Processing Error',
      template: 'error-notification',
      data: errorData,
    });
  }
}
