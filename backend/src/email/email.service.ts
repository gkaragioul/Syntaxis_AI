import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private templates: Map<string, handlebars.TemplateDelegate> = new Map();

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.loadTemplates();
  }

  private loadTemplates() {
    const templatesDir = path.join(__dirname, 'templates');
    const templateFiles = fs.readdirSync(templatesDir);

    templateFiles.forEach((file) => {
      if (file.endsWith('.hbs')) {
        const templateName = path.basename(file, '.hbs');
        const templateContent = fs.readFileSync(
          path.join(templatesDir, file),
          'utf-8',
        );
        this.templates.set(templateName, handlebars.compile(templateContent));
      }
    });
  }

  async sendEmail({
    to,
    subject,
    template,
    data,
  }: {
    to: string;
    subject: string;
    template: string;
    data: any;
  }) {
    const templateFn = this.templates.get(template);
    if (!templateFn) {
      throw new Error(`Template ${template} not found`);
    }

    const html = templateFn(data);

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  async sendVerificationEmail(email: string, token: string) {
    await this.sendEmail({
      to: email,
      subject: 'Verify your email',
      template: 'email-verification',
      data: {
        verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${token}`,
      },
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    await this.sendEmail({
      to: email,
      subject: 'Reset your password',
      template: 'password-reset',
      data: {
        resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${token}`,
      },
    });
  }

  async sendWelcomeEmail(email: string, name: string) {
    await this.sendEmail({
      to: email,
      subject: 'Welcome to SyntaxisAI',
      template: 'welcome',
      data: {
        name,
        loginLink: `${process.env.FRONTEND_URL}/login`,
      },
    });
  }

  async sendInvoiceProcessedEmail(email: string, invoiceData: any) {
    await this.sendEmail({
      to: email,
      subject: 'Invoice Processed Successfully',
      template: 'invoice-processed',
      data: {
        invoiceNumber: invoiceData.invoiceNumber,
        vendorName: invoiceData.vendorName,
        totalAmount: invoiceData.totalAmount,
        viewLink: `${process.env.FRONTEND_URL}/invoices/${invoiceData.id}`,
      },
    });
  }

  async sendErrorNotificationEmail(email: string, errorData: any) {
    await this.sendEmail({
      to: email,
      subject: 'Invoice Processing Error',
      template: 'error-notification',
      data: {
        errorMessage: errorData.message,
        invoiceNumber: errorData.invoiceNumber,
        supportLink: `${process.env.FRONTEND_URL}/support`,
      },
    });
  }
}
