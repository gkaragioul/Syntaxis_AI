// @ts-nocheck

import {
  ExportModel,
  Export,
  ExportStatus,
  ExportFormat,
  ExportEventType,
  CreateExportInput,
  UpdateExportInput,
  ExportError,
} from '../models/Export';
import { ExtractionTableModel } from '../models/ExtractionTable';
import { TemplateModel } from '../models/Template';
import { Queue } from 'bull';
import { Redis } from 'ioredis';
import { createObjectCsvWriter } from 'csv-writer';
import ExcelJS from 'exceljs';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeData } from '../utils/sanitize';
import { BaseError } from '../utils/errors';
import { ClamAV } from 'clamav.js';
import { promisify } from 'util';
import { ErrorCodes } from '../types/ErrorMessage';
import { logger } from '../utils/logger';
import { errorMessageTemplates } from '../config/errorMessages';

export class ExportService {
  private readonly exportQueue: Queue;
  private readonly clamav: ClamAV;
  private readonly exportDir: string;

  constructor(
    private readonly exportModel: ExportModel,
    private readonly extractionTableModel: ExtractionTableModel,
    private readonly templateModel: TemplateModel,
    private readonly redis: Redis,
    exportQueue: Queue,
    clamavConfig: { host: string; port: number },
    exportDir: string,
  ) {
    this.exportQueue = exportQueue;
    this.clamav = new ClamAV(clamavConfig.host, clamavConfig.port);
    this.exportDir = exportDir;

    // Ensure export directory exists
    fs.mkdir(this.exportDir, { recursive: true }).catch(err => logger.error('Failed to create export directory', { error: err, dir: this.exportDir }));

    // Set up queue processing
    this.exportQueue.process('export', this.processExportJob.bind(this));
    this.exportQueue.process('virus-scan', this.processVirusScanJob.bind(this));
  }

  // Create a new export
  async createExport(input: CreateExportInput): Promise<Export> {
    // Validate input
    if (!input.fileId) {
      throw new ExportError('File ID is required', 'INVALID_INPUT', 400);
    }

    // Create export record
    const exportRecord = await this.exportModel.create(input);

    // Add to export queue
    await this.exportQueue.add('export', {
      exportId: exportRecord.id,
      userId: input.userId,
      fileId: input.fileId,
      format: input.format,
      templateId: input.templateId,
    });

    // Create event
    await this.exportModel.createEvent(
      exportRecord.id,
      ExportEventType.EXPORT_STARTED,
      { format: input.format },
    );

    return exportRecord;
  }

  // Get export by ID
  async getExport(id: string, userId: string): Promise<Export> {
    return this.exportModel.findById(id, userId);
  }

  // List exports
  async listExports(userId: string, filter: any = {}, limit = 50, offset = 0) {
    return this.exportModel.findMany(userId, filter, limit, offset);
  }

  // Delete export
  async deleteExport(id: string, userId: string): Promise<void> {
    const exportRecord = await this.exportModel.findById(id, userId);

    // Delete file if it exists
    if (exportRecord.filePath) {
      try {
        await fs.unlink(exportRecord.filePath);
      } catch (error) {
        logger.error('Failed to delete export file', { error, filePath: exportRecord.filePath });
      }
    }

    // Delete record
    await this.exportModel.delete(id, userId);
  }

  // Get download URL
  async getDownloadUrl(
    id: string,
    userId: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    const exportRecord = await this.exportModel.findById(id, userId);

    // Validate export is available for download
    if (exportRecord.status !== ExportStatus.COMPLETED) {
      throw new ExportError(
        `Export is not available for download (status: ${exportRecord.status})`,
        'EXPORT_NOT_READY',
        400,
      );
    }

    if (exportRecord.expiresAt < new Date()) {
      throw new ExportError('Export has expired', 'EXPORT_EXPIRED', 400);
    }

    if (
      exportRecord.downloadLimit &&
      exportRecord.downloadCount >= exportRecord.downloadLimit
    ) {
      throw new ExportError(
        'Download limit reached',
        'DOWNLOAD_LIMIT_REACHED',
        400,
      );
    }

    // Generate signed URL (implement your preferred URL signing method)
    const token = await this.generateDownloadToken(exportRecord);
    const url = `/api/v1/exports/${id}/download?token=${token}`;

    // Increment download count
    await this.exportModel.incrementDownloadCount(id, userId);

    // Create event
    await this.exportModel.createEvent(id, ExportEventType.DOWNLOAD_STARTED, {
      downloadCount: exportRecord.downloadCount + 1,
    });

    return {
      url,
      expiresAt: exportRecord.expiresAt,
    };
  }

  // Process export job
  private async processExportJob(job: any): Promise<void> {
    const { exportId, userId, fileId, format, templateId } = job.data;

    try {
      // Update status to processing
      await this.exportModel.update(exportId, userId, {
        status: ExportStatus.PROCESSING,
      });

      // Get extraction data
      const extractionData =
        await this.extractionTableModel.findByFileId(fileId);
      if (!extractionData || extractionData.length === 0) {
        throw new ExportError('No extraction data found', 'NO_DATA', 404);
      }

      // Get template if specified
      let template = null;
      if (templateId) {
        template = await this.templateModel.findById(templateId, userId);
      }

      // Generate export file
      const exportPath = await this.generateExportFile(
        exportId,
        extractionData,
        format,
        template,
      );

      // Update export record with file info
      const fileStats = await fs.stat(exportPath);
      await this.exportModel.update(exportId, userId, {
        status: ExportStatus.VIRUS_SCANNING,
        filePath: exportPath,
        fileSize: fileStats.size,
        mimeType:
          format === ExportFormat.XLSX
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv',
      });

      // Queue virus scan
      await this.exportQueue.add('virus-scan', {
        exportId,
        userId,
        filePath: exportPath,
      });

      // Create event
      await this.exportModel.createEvent(
        exportId,
        ExportEventType.EXPORT_COMPLETED,
        { format, fileSize: fileStats.size },
      );
    } catch (error) {
      // Handle error
      await this.handleExportError(exportId, userId, error);
      throw error;
    }
  }

  // Process virus scan job
  private async processVirusScanJob(job: any): Promise<void> {
    const { exportId, userId, filePath } = job.data;

    try {
      // Scan file
      const scanResult = await this.scanFile(filePath);

      if (scanResult.isInfected) {
        // Update status and error
        await this.exportModel.update(exportId, userId, {
          status: ExportStatus.VIRUS_SCAN_FAILED,
          virusScanStatus: 'infected',
          virusScanResult: scanResult,
          errorCode: 'VIRUS_DETECTED',
          errorMessage: 'Export file failed virus scan',
          errorDetails: scanResult,
        });

        // Create event
        await this.exportModel.createEvent(
          exportId,
          ExportEventType.VIRUS_SCAN_FAILED,
          scanResult,
        );

        // Delete infected file
        await fs.unlink(filePath).catch(err => logger.error('Failed to delete infected file', { error: err, filePath }));
      } else {
        // Update status
        await this.exportModel.update(exportId, userId, {
          status: ExportStatus.COMPLETED,
          virusScanStatus: 'clean',
          virusScanResult: scanResult,
        });

        // Create event
        await this.exportModel.createEvent(
          exportId,
          ExportEventType.VIRUS_SCAN_COMPLETED,
          scanResult,
        );
      }
    } catch (error) {
      // Handle error
      await this.handleExportError(exportId, userId, error);
      throw error;
    }
  }

  // Generate export file
  private async generateExportFile(
    exportId: string,
    extractionData: any[],
    format: ExportFormat,
    template: any,
  ): Promise<string> {
    const filename = `${exportId}.${format}`;
    const filePath = path.join(this.exportDir, filename);

    if (format === ExportFormat.CSV) {
      await this.generateCsvFile(filePath, extractionData, template);
    } else {
      await this.generateExcelFile(filePath, extractionData, template);
    }

    return filePath;
  }

  // Generate CSV file
  private async generateCsvFile(
    filePath: string,
    data: any[],
    template: any,
  ): Promise<void> {
    const headers = this.getHeaders(data, template);
    const records = this.formatData(data, template);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: headers.map((h) => ({ id: h.key, title: h.label })),
    });

    await csvWriter.writeRecords(records);
  }

  // Generate Excel file
  private async generateExcelFile(
    filePath: string,
    data: any[],
    template: any,
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Extracted Data');

    // Add headers
    const headers = this.getHeaders(data, template);
    worksheet.addRow(headers.map((h) => h.label));

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data
    const records = this.formatData(data, template);
    worksheet.addRows(records);

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 15;
    });

    // Save file
    await workbook.xlsx.writeFile(filePath);
  }

  // Get headers for export
  private getHeaders(
    data: any[],
    template: any,
  ): Array<{ key: string; label: string }> {
    if (template?.columnMappings) {
      return Object.entries(template.columnMappings).map(
        ([key, mapping]: [string, any]) => ({
          key,
          label: mapping.targetField,
        }),
      );
    }

    // Fallback to data headers
    const headers = new Set<string>();
    data.forEach((row) => {
      Object.keys(row).forEach((key) => headers.add(key));
    });

    return Array.from(headers).map((key) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
    }));
  }

  // Format data for export
  private formatData(data: any[], template: any): any[] {
    if (template?.columnMappings) {
      return data.map((row) => {
        const formatted: any = {};
        Object.entries(template.columnMappings).forEach(
          ([key, mapping]: [string, any]) => {
            formatted[mapping.targetField] = this.formatValue(
              row[key],
              mapping.dataType,
            );
          },
        );
        return formatted;
      });
    }

    // Fallback to raw data
    return data.map((row) => {
      const formatted: any = {};
      Object.entries(row).forEach(([key, value]) => {
        formatted[key] = this.formatValue(value);
      });
      return formatted;
    });
  }

  // Format value based on data type
  private formatValue(value: any, dataType?: string): any {
    if (value === null || value === undefined) return '';

    switch (dataType) {
      case 'date':
        return value instanceof Date
          ? value.toISOString().split('T')[0]
          : value;
      case 'number':
        return typeof value === 'number' ? value : parseFloat(value);
      case 'currency':
        return typeof value === 'number' ? value.toFixed(2) : value;
      default:
        return String(value);
    }
  }

  // Scan file for viruses
  private async scanFile(filePath: string): Promise<any> {
    const scan = promisify(this.clamav.scanFile.bind(this.clamav));
    try {
      const result = await scan(filePath);
      return {
        isInfected: false,
        scanDate: new Date(),
        engine: 'ClamAV',
        version: result.version,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('FOUND')) {
        return {
          isInfected: true,
          scanDate: new Date(),
          engine: 'ClamAV',
          version: error.message.split(' ')[1],
          threat: error.message.split('FOUND: ')[1],
        };
      }
      throw error;
    }
  }

  // Generate download token
  private async generateDownloadToken(exportRecord: Export): Promise<string> {
    const token = uuidv4();
    const key = `export:download:${token}`;

    // Store token with export info
    await this.redis.setex(
      key,
      Math.floor((exportRecord.expiresAt.getTime() - Date.now()) / 1000),
      JSON.stringify({
        exportId: exportRecord.id,
        userId: exportRecord.userId,
      }),
    );

    return token;
  }

  // Handle export error
  private async handleExportError(
    exportId: string,
    userId: string,
    error: any,
  ): Promise<void> {
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: error instanceof BaseError ? error.code : ErrorCodes.EXPORT_FAILED,
      stack: error instanceof Error ? error.stack : undefined,
    };

    // Update export record
    await this.exportModel.update(exportId, userId, {
      status: ExportStatus.FAILED,
      errorCode: errorDetails.code,
      errorMessage: errorDetails.message,
      errorDetails,
    });

    // Create event
    await this.exportModel.createEvent(
      exportId,
      ExportEventType.EXPORT_FAILED,
      errorDetails,
    );

    // Attach user-friendly error info
    const errorTemplate = errorMessageTemplates[ErrorCodes.EXPORT_FAILED];
    error.code = ErrorCodes.EXPORT_FAILED;
    error.userMessage = errorTemplate.userMessage;
    error.nextSteps = errorTemplate.nextSteps;
    error.helpUrl = errorTemplate.helpUrl;
    error.statusCode = 500;
  }

  // Clean up expired exports
  async cleanupExpiredExports(): Promise<number> {
    const count = await this.exportModel.cleanupExpired();

    // Delete expired files
    const expiredExports = await this.exportModel.findMany(
      'system',
      { status: ExportStatus.EXPIRED },
      1000,
      0,
    );

    for (const exportRecord of expiredExports.exports) {
      if (exportRecord.filePath) {
        try {
          await fs.unlink(exportRecord.filePath);
        } catch (error) {
          logger.error('Failed to delete expired export file', { error, filePath: exportRecord.filePath });
        }
      }
    }

    return count;
  }
}
