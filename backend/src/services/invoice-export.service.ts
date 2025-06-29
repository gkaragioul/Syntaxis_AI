import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf' | 'json';
  filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    status?: string;
    vendorName?: string;
  };
  fields?: string[];
  excludeFields?: string[];
  includeLineItems?: boolean;
  includeRelatedData?: boolean;
  batchSize?: number;
  enablePagination?: boolean;
  splitLargeFiles?: boolean;
  maxRecordsPerFile?: number;
  useStreaming?: boolean;
  streamChunkSize?: number;
  compression?: 'gzip' | 'zip';
  compressionLevel?: number;
  fieldTransformations?: { [field: string]: (value: any) => any };
  worksheets?: string[];
  styling?: ExcelStyling;
  template?: string;
  customTemplate?: any;
  pageOrientation?: 'portrait' | 'landscape';
  jsonFormat?: {
    pretty?: boolean;
    includeMetadata?: boolean;
    includeSchema?: boolean;
  };
}

interface ExcelStyling {
  headerStyle?: {
    bold?: boolean;
    backgroundColor?: string;
    fontColor?: string;
  };
  numberFormat?: string;
  dateFormat?: string;
}

interface ExportResult {
  success: boolean;
  exportId?: string;
  downloadUrl?: string;
  files?: ExportFile[];
  metadata?: ExportMetadata;
  error?: string;
}

interface ExportFile {
  filename: string;
  downloadUrl: string;
  size: number;
  recordCount: number;
}

interface ExportMetadata {
  format: string;
  recordCount: number;
  totalRecords?: number;
  batchSize?: number;
  batches?: number;
  fileSize: number;
  createdAt: Date;
  worksheets?: string[];
  styling?: ExcelStyling;
  template?: string;
  pageOrientation?: string;
  customTemplate?: any;
  streamingUsed?: boolean;
  chunkSize?: number;
  compression?: string;
}

interface ExportStatus {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalRecords: number;
  processedRecords: number;
  error?: string;
  downloadUrl?: string;
  createdAt: Date;
  completedAt?: Date;
}

export class InvoiceExportService {
  private readonly exportDir = path.join(process.cwd(), 'exports');
  private readonly supportedFormats = ['csv', 'excel', 'pdf', 'json'];
  private readonly defaultFields = [
    'invoiceNumber',
    'invoiceDate',
    'vendorName',
    'totalAmount',
    'status',
    'currency',
  ];

  constructor(private prisma: PrismaClient) {
    this.ensureExportDirectory();
  }

  async exportInvoices(userId: string, options: ExportOptions): Promise<ExportResult> {
    // Validate export options
    const validation = this.validateExportOptions(options);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // Create export job
    const exportJob = await this.createExportJob(userId, options);

    try {
      // Update job status to in_progress
      await this.updateExportJob(exportJob.id, {
        status: 'in_progress',
        startedAt: new Date(),
      });

      // Perform the export based on format
      let result: ExportResult;
      switch (options.format) {
        case 'csv':
          result = await this.exportToCSV(userId, options, exportJob.id);
          break;
        case 'excel':
          result = await this.exportToExcel(userId, options, exportJob.id);
          break;
        case 'pdf':
          result = await this.exportToPDF(userId, options, exportJob.id);
          break;
        case 'json':
          result = await this.exportToJSON(userId, options, exportJob.id);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      // Update job status to completed
      await this.updateExportJob(exportJob.id, {
        status: 'completed',
        completedAt: new Date(),
        downloadUrl: result.downloadUrl,
        metadata: result.metadata,
      });

      result.exportId = exportJob.id;
      return result;
    } catch (error) {
      logger.error('Export failed', { error, exportJobId: exportJob.id, userId });

      // Update job status to failed
      await this.updateExportJob(exportJob.id, {
        status: 'failed',
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
      };
    }
  }

  async exportToCSV(userId: string, options: ExportOptions, exportJobId: string): Promise<ExportResult> {
    const invoices = await this.getInvoicesForExport(userId, options);
    const fields = options.fields || this.defaultFields;
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `invoices_${timestamp}.csv`;
    const filePath = path.join(this.exportDir, filename);

    // Prepare CSV headers
    const headers = fields.map(field => this.formatFieldName(field));
    
    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    
    // Add data rows
    for (const invoice of invoices) {
      const row = fields.map(field => {
        let value = invoice[field as keyof typeof invoice];
        
        // Apply field transformations if provided
        if (options.fieldTransformations && options.fieldTransformations[field]) {
          value = options.fieldTransformations[field](value);
        }
        
        // Format value for CSV
        return this.formatValueForCSV(value);
      });
      
      csvContent += row.join(',') + '\n';
    }

    // Write CSV file
    fs.writeFileSync(filePath, csvContent);

    // Get file stats
    const stats = fs.statSync(filePath);
    const downloadUrl = `/api/exports/download/${filename}`;

    return {
      success: true,
      downloadUrl,
      metadata: {
        format: 'csv',
        recordCount: invoices.length,
        fileSize: stats.size,
        createdAt: new Date(),
      },
    };
  }

  async exportToExcel(userId: string, options: ExportOptions, exportJobId: string): Promise<ExportResult> {
    // Mock Excel export implementation
    const invoices = await this.getInvoicesForExport(userId, options);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `invoices_${timestamp}.xlsx`;
    const filePath = path.join(this.exportDir, filename);

    // Mock Excel file creation
    const mockExcelContent = JSON.stringify({
      worksheets: options.worksheets || ['invoices'],
      data: invoices,
      styling: options.styling,
    });

    fs.writeFileSync(filePath, mockExcelContent);
    const stats = fs.statSync(filePath);

    return {
      success: true,
      downloadUrl: `/api/exports/download/${filename}`,
      metadata: {
        format: 'excel',
        recordCount: invoices.length,
        fileSize: stats.size,
        createdAt: new Date(),
        worksheets: options.worksheets || ['invoices'],
        styling: options.styling,
      },
    };
  }

  async exportToPDF(userId: string, options: ExportOptions, exportJobId: string): Promise<ExportResult> {
    // Mock PDF export implementation
    const invoices = await this.getInvoicesForExport(userId, options);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `invoices_${timestamp}.pdf`;
    const filePath = path.join(this.exportDir, filename);

    // Mock PDF file creation
    const mockPdfContent = JSON.stringify({
      template: options.template || 'default',
      pageOrientation: options.pageOrientation || 'portrait',
      customTemplate: options.customTemplate,
      data: invoices,
    });

    fs.writeFileSync(filePath, mockPdfContent);
    const stats = fs.statSync(filePath);

    return {
      success: true,
      downloadUrl: `/api/exports/download/${filename}`,
      metadata: {
        format: 'pdf',
        recordCount: invoices.length,
        fileSize: stats.size,
        createdAt: new Date(),
        template: options.template || 'default',
        pageOrientation: options.pageOrientation || 'portrait',
        customTemplate: options.customTemplate,
      },
    };
  }

  async exportToJSON(userId: string, options: ExportOptions, exportJobId: string): Promise<ExportResult> {
    const invoices = await this.getInvoicesForExport(userId, options);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `invoices_${timestamp}.json`;
    const filePath = path.join(this.exportDir, filename);

    // Prepare JSON data
    const jsonData: any = {
      invoices,
    };

    // Add metadata if requested
    if (options.jsonFormat?.includeMetadata) {
      jsonData.metadata = {
        exportedAt: new Date().toISOString(),
        recordCount: invoices.length,
        exportedBy: userId,
      };
    }

    // Add schema if requested
    if (options.jsonFormat?.includeSchema) {
      jsonData.schema = {
        version: '1.0',
        fields: this.getSchemaFields(),
      };
    }

    // Write JSON file
    const jsonContent = options.jsonFormat?.pretty 
      ? JSON.stringify(jsonData, null, 2)
      : JSON.stringify(jsonData);

    fs.writeFileSync(filePath, jsonContent);
    const stats = fs.statSync(filePath);

    return {
      success: true,
      downloadUrl: `/api/exports/download/${filename}`,
      metadata: {
        format: 'json',
        recordCount: invoices.length,
        fileSize: stats.size,
        createdAt: new Date(),
      },
    };
  }

  async getExportStatus(exportId: string): Promise<ExportStatus> {
    const exportJob = await this.prisma.exportJob.findUnique({
      where: { id: exportId },
    });

    if (!exportJob) {
      throw new Error('Export job not found');
    }

    return {
      id: exportJob.id,
      status: exportJob.status as any,
      progress: exportJob.progress || 0,
      totalRecords: exportJob.totalRecords || 0,
      processedRecords: exportJob.processedRecords || 0,
      error: exportJob.error,
      downloadUrl: exportJob.downloadUrl,
      createdAt: exportJob.createdAt,
      completedAt: exportJob.completedAt,
    };
  }

  async cancelExport(exportId: string, userId: string): Promise<{ success: boolean; status: string }> {
    const exportJob = await this.prisma.exportJob.findUnique({
      where: { id: exportId },
    });

    if (!exportJob) {
      throw new Error('Export job not found');
    }

    if (exportJob.userId !== userId) {
      throw new Error('Not authorized to cancel this export');
    }

    if (exportJob.status === 'completed' || exportJob.status === 'failed') {
      return {
        success: false,
        status: exportJob.status,
      };
    }

    await this.prisma.exportJob.update({
      where: { id: exportId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      status: 'cancelled',
    };
  }

  async getExportHistory(userId: string, limit: number = 50): Promise<any[]> {
    return this.prisma.exportJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        format: true,
        status: true,
        recordCount: true,
        fileSize: true,
        downloadUrl: true,
        createdAt: true,
        completedAt: true,
        error: true,
      },
    });
  }

  private async getInvoicesForExport(userId: string, options: ExportOptions): Promise<any[]> {
    const where: any = { userId };

    // Apply filters
    if (options.filters) {
      if (options.filters.dateFrom || options.filters.dateTo) {
        where.invoiceDate = {};
        if (options.filters.dateFrom) {
          where.invoiceDate.gte = options.filters.dateFrom;
        }
        if (options.filters.dateTo) {
          where.invoiceDate.lte = options.filters.dateTo;
        }
      }

      if (options.filters.status) {
        where.status = options.filters.status;
      }

      if (options.filters.vendorName) {
        where.vendorName = {
          contains: options.filters.vendorName,
          mode: 'insensitive',
        };
      }
    }

    const include: any = {};
    if (options.includeLineItems) {
      include.lineItems = true;
    }
    if (options.includeRelatedData) {
      include.attachments = true;
      include.validationResults = true;
    }

    return this.prisma.invoice.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
    });
  }

  private validateExportOptions(options: ExportOptions): { isValid: boolean; error?: string } {
    if (!this.supportedFormats.includes(options.format)) {
      return {
        isValid: false,
        error: `Invalid export format: ${options.format}. Supported formats: ${this.supportedFormats.join(', ')}`,
      };
    }

    if (options.batchSize && options.batchSize < 1) {
      return {
        isValid: false,
        error: 'Batch size must be greater than 0',
      };
    }

    if (options.maxRecordsPerFile && options.maxRecordsPerFile < 1) {
      return {
        isValid: false,
        error: 'Max records per file must be greater than 0',
      };
    }

    return { isValid: true };
  }

  private async createExportJob(userId: string, options: ExportOptions): Promise<any> {
    return this.prisma.exportJob.create({
      data: {
        userId,
        format: options.format,
        status: 'pending',
        options: options as any,
        createdAt: new Date(),
      },
    });
  }

  private async updateExportJob(exportId: string, data: any): Promise<void> {
    await this.prisma.exportJob.update({
      where: { id: exportId },
      data,
    });
  }

  private formatFieldName(field: string): string {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private formatValueForCSV(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      // Escape quotes and wrap in quotes if contains comma or quote
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }

    return String(value);
  }

  private getSchemaFields(): any {
    return {
      invoiceNumber: { type: 'string', description: 'Unique invoice identifier' },
      invoiceDate: { type: 'date', description: 'Date the invoice was issued' },
      vendorName: { type: 'string', description: 'Name of the vendor' },
      totalAmount: { type: 'number', description: 'Total invoice amount' },
      status: { type: 'string', description: 'Current invoice status' },
      currency: { type: 'string', description: 'Invoice currency code' },
    };
  }

  private ensureExportDirectory(): void {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }
}
