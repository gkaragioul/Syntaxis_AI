// @ts-nocheck

import { PrismaClient, Prisma, Invoice, File, User } from '@prisma/client';
import { ValidationError } from '../utils/errors';
import { EmailService } from '../email/email.service';
import { FieldExtractionService, ExtractionResult } from './field.service';
import { ProcessingService, ProcessingResult } from './ProcessingService';
import { StorageService } from './StorageService';
import { OCRService } from './ocr.service';
import { logger } from '../utils/logger';

type InvoiceWithRelations = Invoice & {
  file: File;
  user: Pick<User, 'id' | 'email'>;
};

type InvoiceCreateData = Prisma.InvoiceCreateInput & {
  userId: string;
  fileId: string;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  dueDate: Date | null;
  vendorName: string | null;
  totalAmount: number | null;
  taxAmount: number | null;
  subtotal: number | null;
  status: string;
  extractedData: ExtractionResult;
  confidenceScore: number;
};

type InvoiceUpdateData = Partial<{
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  vendorName: string;
  totalAmount: number;
  taxAmount: number;
  subtotal: number;
  status: string;
  notes: string;
}>;

type ListInvoicesOptions = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sortBy?: keyof Invoice;
  sortOrder?: 'asc' | 'desc';
};

export class InvoiceService {
  private prisma: PrismaClient;
  private emailService: EmailService;
  private fieldExtractionService: FieldExtractionService;
  private processingService: ProcessingService;
  private storageService: StorageService;
  private ocrService: OCRService;

  constructor(
    prisma: PrismaClient,
    emailService: EmailService,
    fieldExtractionService: FieldExtractionService,
    processingService: ProcessingService,
    storageService: StorageService,
    ocrService: OCRService,
  ) {
    this.prisma = prisma;
    this.emailService = emailService;
    this.fieldExtractionService = fieldExtractionService;
    this.processingService = processingService;
    this.storageService = storageService;
    this.ocrService = ocrService;
  }

  /**
   * Process an uploaded invoice file with enhanced OCR options
   */
  async processInvoice(
    fileId: string,
    userId: string,
    enhancedOptions?: {
      ocrOptions?: {
        engine?: 'tesseract' | 'google-vision';
        preprocessing?: {
          deskew?: boolean;
          denoise?: boolean;
          enhance?: boolean;
          brightness?: number;
          contrast?: number;
        };
        validation?: {
          minConfidence?: number;
          minTextLength?: number;
          requiredFields?: string[];
        };
      };
      fallbackOptions?: {
        enabled?: boolean;
        primaryEngine?: 'tesseract' | 'google-vision';
        fallbackEngine?: 'tesseract' | 'google-vision';
        confidenceThreshold?: number;
      };
      enableMetrics?: boolean;
      trackPerformance?: boolean;
    },
  ): Promise<Invoice> {
    // Get file record
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!file) {
      throw new ValidationError('File not found');
    }

    if (file.userId !== userId) {
      throw new ValidationError('Not authorized to process this file');
    }

    try {
      // Update file status
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          status: 'processing',
          processingStartedAt: new Date(),
        },
      });

      // Process file with enhanced OCR service using provided options
      const ocrOptions = enhancedOptions?.ocrOptions || {};
      const fallbackOptions = enhancedOptions?.fallbackOptions || {};

      const ocrResult = await this.ocrService.processFile(
        fileId,
        userId,
        {
          engine: ocrOptions.engine || 'tesseract',
          preprocessing: {
            deskew: ocrOptions.preprocessing?.deskew ?? true,
            enhance: ocrOptions.preprocessing?.enhance ?? true,
            denoise: ocrOptions.preprocessing?.denoise ?? true,
            brightness: ocrOptions.preprocessing?.brightness ?? 1.1,
            contrast: ocrOptions.preprocessing?.contrast ?? 1.2,
          },
          validation: {
            minConfidence: ocrOptions.validation?.minConfidence ?? 0.7,
            minTextLength: ocrOptions.validation?.minTextLength ?? 50,
            requiredFields: ocrOptions.validation?.requiredFields ?? [
              'invoiceNumber',
              'totalAmount',
              'vendorName',
            ],
          },
        },
        {
          enabled: fallbackOptions.enabled ?? true,
          primaryEngine:
            fallbackOptions.primaryEngine || ocrOptions.engine || 'tesseract',
          fallbackEngine: fallbackOptions.fallbackEngine || 'google-vision',
          confidenceThreshold: fallbackOptions.confidenceThreshold ?? 0.8,
          fallbackConditions: {
            lowConfidence: true,
            processingError: true,
            emptyResult: true,
          },
        },
      );

      // Extract invoice fields
  
    const extractedData = await this.fieldExtractionService.extractFields(
      ocrResult.text,
      {
        type: 'invoice',
        requiredFields: [
          'invoiceNumber',
          'invoiceDate',
          'totalAmount',
          'vendorName',
        ],
        confidenceThreshold: 0.8,
        fieldTransformations: {
          invoiceDate: (value: string) => {
            // Normalize date format
            return new Date(value).toISOString();
          },
        },
        ocrResult: ocrResult, // Pass full result for generic table extraction
      },
    );
   // Create invoice record with enhanced OCR metadata
      const invoiceData: InvoiceCreateData = {
        userId,
        fileId,
        invoiceNumber: extractedData.invoiceNumber,
        invoiceDate: extractedData.invoiceDate,
        dueDate: extractedData.dueDate,
        vendorName: extractedData.vendorName,
        totalAmount: extractedData.totalAmount,
        taxAmount: extractedData.taxAmount,
        subtotal: extractedData.subtotal,
        status: 'processed',
        extractedData: {
          ...extractedData,
          // Include enhanced OCR metadata
          ocrMetadata: {
            engine: ocrResult.engine,
            processingTime: ocrResult.metadata?.processingTime || 0,
            preprocessingSteps: ocrResult.metadata?.preprocessingSteps || [],
            confidenceMetrics: ocrResult.metadata?.confidenceMetrics,
            fieldConfidences: ocrResult.metadata?.fieldConfidences,
            fallbackUsed: ocrResult.metadata?.fallback ? true : false,
            enginesUsed: ocrResult.metadata?.fallback?.enginesUsed || [
              ocrResult.engine,
            ],
          },
        },
        confidenceScore: ocrResult.confidence,
      };

      const invoice = await this.prisma.invoice.create({
        data: invoiceData,
      });

      // Update file status with completion time
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          status: 'completed',
          processingCompletedAt: new Date(),
        },
      });

      // Send success email
      if (file.user && file.user.email) {
        await this.emailService.sendInvoiceProcessedEmail(file.user.email, {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          vendorName: invoice.vendorName,
          totalAmount: invoice.totalAmount,
        });
      }

      return invoice;
    } catch (error) {
      // Update file status
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          status: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        },
      });

      // Send error notification
      if (file.user && file.user.email) {
        await this.emailService.sendErrorNotificationEmail(file.user.email, {
          message: error instanceof Error ? error.message : 'Unknown error',
          invoiceNumber: 'Unknown',
        });
      }

      logger.error('Invoice processing failed', {
        fileId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get invoice details
   */
  async getInvoice(
    invoiceId: string,
    userId: string,
  ): Promise<InvoiceWithRelations> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        file: true,
        user: { select: { id: true, email: true } },
      },
    });

    if (!invoice) {
      throw new ValidationError('Invoice not found');
    }

    if (invoice.userId !== userId) {
      throw new ValidationError('Not authorized to view this invoice');
    }

    return invoice as InvoiceWithRelations;
  }

  /**
   * List user's invoices
   */
  async listInvoices(
    userId: string,
    options: ListInvoicesOptions = {},
  ): Promise<{
    invoices: InvoiceWithRelations[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const where: Prisma.InvoiceWhereInput = {
      userId,
      ...(status && { status }),
      ...(search && {
        OR: [
          {
            invoiceNumber: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            vendorName: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        ],
      }),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          file: true,
          user: { select: { id: true, email: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      invoices: invoices as InvoiceWithRelations[],
      total,
      page,
      limit,
    };
  }

  /**
   * Update invoice details
   */
  async updateInvoice(
    invoiceId: string,
    userId: string,
    data: InvoiceUpdateData,
  ): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new ValidationError('Invoice not found');
    }

    if (invoice.userId !== userId) {
      throw new ValidationError('Not authorized to update this invoice');
    }

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data,
    });
  }

  /**
   * Delete invoice
   */
  async deleteInvoice(invoiceId: string, userId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { file: true },
    });

    if (!invoice) {
      throw new ValidationError('Invoice not found');
    }

    if (invoice.userId !== userId) {
      throw new ValidationError('Not authorized to delete this invoice');
    }

    // Delete associated file from storage
    if (invoice.file) {
      await this.storageService.deleteFile(invoice.file.filePath);
    }

    // Delete invoice and file records
    await this.prisma.$transaction([
      this.prisma.invoice.delete({ where: { id: invoiceId } }),
      this.prisma.file.delete({ where: { id: invoice.fileId } }),
    ]);
  }
}
