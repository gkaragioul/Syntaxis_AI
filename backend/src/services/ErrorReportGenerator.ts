import PDFDocument from 'pdfkit';
import { Parser } from 'json2csv';
import fs from 'fs';
import path from 'path';
import { ErrorReport } from '../models/ErrorReport';
import { logger } from '../utils/logger';
import { config } from '../config';

export class ErrorReportGenerator {
  private readonly reportsDir: string;

  constructor() {
    this.reportsDir = path.join(config.uploadsDir, 'error-reports');
    this.ensureReportsDirectory();
  }

  private ensureReportsDirectory() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async generatePDF(report: ErrorReport): Promise<string> {
    const filePath = path.join(this.reportsDir, `${report.id}.pdf`);
    const doc = new PDFDocument();

    // Create write stream
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Add content
    doc.fontSize(20).text('Error Report', { align: 'center' });
    doc.moveDown();

    // Basic Information
    doc.fontSize(14).text('Basic Information');
    doc.fontSize(12);
    doc.text(`Error Type: ${report.errorType}`);
    doc.text(`Error Code: ${report.errorCode}`);
    doc.text(`Created At: ${report.createdAt.toLocaleString()}`);
    doc.moveDown();

    // Error Message
    doc.fontSize(14).text('Error Message');
    doc.fontSize(12).text(report.errorMessage);
    doc.moveDown();

    // Error Details
    if (report.errorDetails) {
      doc.fontSize(14).text('Error Details');
      doc.fontSize(12).text(JSON.stringify(report.errorDetails, null, 2));
      doc.moveDown();
    }

    // Troubleshooting Tips
    doc.fontSize(14).text('Troubleshooting Tips');
    doc.fontSize(12);
    report.troubleshootingTips.forEach((tip, index) => {
      doc.text(`${index + 1}. ${tip}`);
    });
    doc.moveDown();

    // Stack Trace
    if (report.stackTrace) {
      doc.fontSize(14).text('Stack Trace');
      doc.fontSize(10).text(report.stackTrace);
    }

    // Finalize PDF
    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        const stats = fs.statSync(filePath);
        logger.info('PDF report generated', {
          reportId: report.id,
          fileSize: stats.size,
        });
        resolve(filePath);
      });

      stream.on('error', (error) => {
        logger.error('Failed to generate PDF report', {
          error,
          reportId: report.id,
        });
        reject(error);
      });
    });
  }

  async generateCSV(report: ErrorReport): Promise<string> {
    const filePath = path.join(this.reportsDir, `${report.id}.csv`);

    // Prepare data for CSV
    const data = {
      errorType: report.errorType,
      errorCode: report.errorCode,
      errorMessage: report.errorMessage,
      errorDetails: JSON.stringify(report.errorDetails || {}),
      troubleshootingTips: report.troubleshootingTips.join('; '),
      stackTrace: report.stackTrace || '',
      createdAt: report.createdAt.toISOString(),
    };

    // Convert to CSV
    const fields = Object.keys(data);
    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    // Write to file
    await fs.promises.writeFile(filePath, csv);

    const stats = await fs.promises.stat(filePath);
    logger.info('CSV report generated', {
      reportId: report.id,
      fileSize: stats.size,
    });

    return filePath;
  }

  async cleanupOldReports(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const files = await fs.promises.readdir(this.reportsDir);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(this.reportsDir, file);
      const stats = await fs.promises.stat(filePath);

      if (stats.mtime < cutoffDate) {
        await fs.promises.unlink(filePath);
        deletedCount++;
      }
    }

    logger.info('Cleaned up old error reports', {
      deletedCount,
      retentionDays,
    });

    return deletedCount;
  }
}
