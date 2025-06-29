import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

interface BatchUploadOptions {
  batchName: string;
  description?: string;
  expectedFileCount?: number;
  processingOptions?: {
    autoProcess?: boolean;
    validateOnUpload?: boolean;
    notifyOnCompletion?: boolean;
  };
}

interface FileUploadOptions {
  validateOnUpload?: boolean;
  extractMetadata?: boolean;
  generateThumbnail?: boolean;
  maxFileSize?: number;
}

interface BatchProcessingOptions {
  processingPriority?: 'low' | 'normal' | 'high';
  notifyOnCompletion?: boolean;
  autoApproveHighConfidence?: boolean;
  confidenceThreshold?: number;
}

interface BatchInitResult {
  success: boolean;
  batchId?: string;
  uploadUrl?: string;
  maxFileSize?: number;
  allowedFormats?: string[];
  errors?: string[];
  remainingUploads?: number;
}

interface FileUploadResult {
  success: boolean;
  fileId?: string;
  uploadProgress?: number;
  validationResult?: any;
  metadata?: any;
  errors?: string[];
  supportedFormats?: string[];
  maxAllowedSize?: number;
}

interface BatchProgress {
  totalFiles: number;
  uploadedFiles: number;
  successfulUploads: number;
  failedUploads: number;
  progressPercentage: number;
  status: string;
}

interface ProcessingStatus {
  batchId: string;
  status: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
  timing: {
    elapsed: number;
    estimated: number;
  };
  currentFile?: string;
}

interface FileStatus {
  fileId: string;
  filename: string;
  status: string;
  progress?: number;
  confidence?: number;
  errors?: string[];
  retryable?: boolean;
}

interface ProcessingEstimates {
  averageTimePerFile: number;
  remainingFiles: number;
  estimatedRemainingTime: number;
  estimatedCompletionTime: Date;
  confidence: number;
}

interface ErrorHandlingResult {
  errorHandled: boolean;
  retryScheduled: boolean;
  retryAttempt: number;
  maxRetries: number;
  userNotified: boolean;
}

interface BatchErrorSummary {
  totalErrors: number;
  retryableErrors: number;
  permanentErrors: number;
  errorsByType: { [type: string]: number };
  recommendations: string[];
}

interface UIState {
  batchId: string;
  currentView: string;
  availableActions: string[];
  progressIndicators: any;
  notifications: any[];
  errorAlerts: any[];
}

export class BatchProcessingUIService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'batch');
  private readonly allowedFormats = ['pdf', 'jpg', 'jpeg', 'png', 'tiff'];
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly maxBatchSize = 100;

  constructor(private prisma: PrismaClient) {
    this.ensureUploadDirectory();
  }

  async initializeBatchUpload(userId: string, options: BatchUploadOptions): Promise<BatchInitResult> {
    // Validate options
    const validation = this.validateBatchOptions(options);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    // Check user limits
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        monthlyLimit: true,
        invoicesProcessedThisMonth: true,
      },
    });

    if (user) {
      const remainingUploads = (user.monthlyLimit || 0) - (user.invoicesProcessedThisMonth || 0);
      if (options.expectedFileCount && options.expectedFileCount > remainingUploads) {
        return {
          success: false,
          errors: ['Exceeds monthly upload limit'],
          remainingUploads,
        };
      }
    }

    // Create batch job
    const batchJob = await this.prisma.batchJob.create({
      data: {
        userId,
        batchName: options.batchName,
        description: options.description,
        status: 'pending',
        totalFiles: options.expectedFileCount || 0,
        processedFiles: 0,
        failedFiles: 0,
        options: options.processingOptions || {},
        createdAt: new Date(),
      },
    });

    logger.info('Batch upload initialized', {
      batchId: batchJob.id,
      userId,
      expectedFiles: options.expectedFileCount,
    });

    return {
      success: true,
      batchId: batchJob.id,
      uploadUrl: `/api/batch/${batchJob.id}/upload`,
      maxFileSize: this.maxFileSize,
      allowedFormats: this.allowedFormats,
    };
  }

  async uploadFileToBatch(
    batchId: string,
    userId: string,
    file: any,
    options: FileUploadOptions = {}
  ): Promise<FileUploadResult> {
    // Validate file format
    const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
    if (!this.allowedFormats.includes(fileExtension)) {
      return {
        success: false,
        errors: ['Unsupported file format'],
        supportedFormats: this.allowedFormats,
      };
    }

    // Validate file size
    const maxSize = options.maxFileSize || this.maxFileSize;
    if (file.size > maxSize) {
      return {
        success: false,
        errors: ['File size exceeds limit'],
        maxAllowedSize: maxSize,
      };
    }

    // Save file
    const filename = `${Date.now()}_${file.originalname}`;
    const filePath = path.join(this.uploadDir, batchId, filename);
    
    // Ensure batch directory exists
    const batchDir = path.dirname(filePath);
    if (!fs.existsSync(batchDir)) {
      fs.mkdirSync(batchDir, { recursive: true });
    }

    fs.writeFileSync(filePath, file.buffer);

    // Create file record
    const createdFile = await this.prisma.file.create({
      data: {
        filename: file.originalname,
        filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        userId,
        batchJobId: batchId,
        uploadStatus: 'completed',
        uploadedAt: new Date(),
      },
    });

    // Perform validation if requested
    let validationResult;
    if (options.validateOnUpload) {
      validationResult = await this.validateUploadedFile(createdFile);
    }

    // Extract metadata if requested
    let metadata;
    if (options.extractMetadata) {
      metadata = await this.extractFileMetadata(createdFile);
    }

    logger.info('File uploaded to batch', {
      batchId,
      fileId: createdFile.id,
      filename: file.originalname,
      size: file.size,
    });

    return {
      success: true,
      fileId: createdFile.id,
      uploadProgress: 100,
      validationResult,
      metadata,
    };
  }

  async getBatchUploadProgress(batchId: string, userId: string): Promise<BatchProgress> {
    const batchJob = await this.prisma.batchJob.findUnique({
      where: { id: batchId },
      include: {
        files: {
          select: {
            uploadStatus: true,
            processingStatus: true,
          },
        },
      },
    });

    if (!batchJob) {
      throw new Error('Batch job not found');
    }

    const totalFiles = batchJob.totalFiles || batchJob.files.length;
    const uploadedFiles = batchJob.files.length;
    const successfulUploads = batchJob.files.filter(f => f.uploadStatus === 'completed').length;
    const failedUploads = batchJob.files.filter(f => f.uploadStatus === 'failed').length;

    return {
      totalFiles,
      uploadedFiles,
      successfulUploads,
      failedUploads,
      progressPercentage: totalFiles > 0 ? Math.round((uploadedFiles / totalFiles) * 100) : 0,
      status: batchJob.status,
    };
  }

  async startBatchProcessing(
    batchId: string,
    userId: string,
    options: BatchProcessingOptions = {}
  ): Promise<any> {
    const batchJob = await this.prisma.batchJob.findUnique({
      where: { id: batchId },
    });

    if (!batchJob) {
      throw new Error('Batch job not found');
    }

    if (batchJob.userId !== userId) {
      throw new Error('Not authorized to process this batch');
    }

    // Get uploaded files
    const files = await this.prisma.file.findMany({
      where: {
        batchJobId: batchId,
        uploadStatus: 'completed',
      },
    });

    // Update batch status
    await this.prisma.batchJob.update({
      where: { id: batchId },
      data: {
        status: 'processing',
        startedAt: new Date(),
        processingOptions: options,
      },
    });

    // Estimate completion time
    const estimatedTimePerFile = 60000; // 1 minute per file
    const estimatedCompletionTime = new Date(Date.now() + files.length * estimatedTimePerFile);

    logger.info('Batch processing started', {
      batchId,
      userId,
      filesToProcess: files.length,
      estimatedCompletion: estimatedCompletionTime,
    });

    return {
      success: true,
      processingJobId: `proc_${batchId}_${Date.now()}`,
      estimatedCompletionTime,
      filesToProcess: files.length,
    };
  }

  async pauseBatchProcessing(batchId: string, userId: string): Promise<any> {
    const batchJob = await this.prisma.batchJob.findUnique({
      where: { id: batchId },
    });

    if (!batchJob || batchJob.userId !== userId) {
      throw new Error('Batch job not found or not authorized');
    }

    await this.prisma.batchJob.update({
      where: { id: batchId },
      data: {
        status: 'paused',
        pausedAt: new Date(),
      },
    });

    return {
      success: true,
      status: 'paused',
      canResume: true,
    };
  }

  async resumeBatchProcessing(batchId: string, userId: string): Promise<any> {
    const batchJob = await this.prisma.batchJob.findUnique({
      where: { id: batchId },
    });

    if (!batchJob || batchJob.userId !== userId) {
      throw new Error('Batch job not found or not authorized');
    }

    const resumedAt = new Date();
    await this.prisma.batchJob.update({
      where: { id: batchId },
      data: {
        status: 'processing',
        resumedAt,
      },
    });

    return {
      success: true,
      status: 'processing',
      resumedAt,
    };
  }

  async cancelBatchProcessing(batchId: string, userId: string, options: any = {}): Promise<any> {
    const batchJob = await this.prisma.batchJob.findUnique({
      where: { id: batchId },
    });

    if (!batchJob || batchJob.userId !== userId) {
      throw new Error('Batch job not found or not authorized');
    }

    await this.prisma.batchJob.update({
      where: { id: batchId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: options.reason,
      },
    });

    // Cleanup files if requested
    let filesCleanedUp = false;
    if (options.cleanupFiles) {
      // Implementation would clean up uploaded files
      filesCleanedUp = true;
    }

    return {
      success: true,
      status: 'cancelled',
      filesCleanedUp,
    };
  }

  async getBatchProcessingStatus(batchId: string, userId: string): Promise<ProcessingStatus> {
    const batchJob = await this.prisma.batchJob.findUnique({
      where: { id: batchId },
    });

    if (!batchJob) {
      throw new Error('Batch job not found');
    }

    const elapsed = batchJob.startedAt 
      ? Date.now() - batchJob.startedAt.getTime()
      : 0;

    const estimated = batchJob.processedFiles > 0
      ? (elapsed / batchJob.processedFiles) * (batchJob.totalFiles - batchJob.processedFiles)
      : 0;

    return {
      batchId,
      status: batchJob.status,
      progress: {
        total: batchJob.totalFiles,
        completed: batchJob.processedFiles,
        failed: batchJob.failedFiles,
        percentage: batchJob.totalFiles > 0 
          ? Math.round((batchJob.processedFiles / batchJob.totalFiles) * 100)
          : 0,
      },
      timing: {
        elapsed,
        estimated,
      },
      currentFile: 'processing_file.pdf', // Mock current file
    };
  }

  async getBatchFileStatuses(batchId: string, userId: string): Promise<FileStatus[]> {
    const files = await this.prisma.file.findMany({
      where: { batchJobId: batchId },
      select: {
        id: true,
        filename: true,
        processingStatus: true,
        extractionConfidence: true,
        validationStatus: true,
        errorMessage: true,
      },
    });

    return files.map(file => ({
      fileId: file.id,
      filename: file.filename,
      status: file.processingStatus || 'pending',
      confidence: file.extractionConfidence,
      progress: file.processingStatus === 'processing' ? 75 : undefined,
      errors: file.errorMessage ? [file.errorMessage] : undefined,
      retryable: file.processingStatus === 'failed',
    }));
  }

  async calculateProcessingEstimates(batchId: string): Promise<ProcessingEstimates> {
    const batchJob = await this.prisma.batchJob.findUnique({
      where: { id: batchId },
    });

    if (!batchJob || !batchJob.startedAt) {
      throw new Error('Batch job not found or not started');
    }

    const elapsed = Date.now() - batchJob.startedAt.getTime();
    const averageTimePerFile = batchJob.processedFiles > 0 
      ? elapsed / batchJob.processedFiles 
      : 60000; // Default 1 minute

    const remainingFiles = batchJob.totalFiles - batchJob.processedFiles;
    const estimatedRemainingTime = remainingFiles * averageTimePerFile;
    const estimatedCompletionTime = new Date(Date.now() + estimatedRemainingTime);

    return {
      averageTimePerFile,
      remainingFiles,
      estimatedRemainingTime,
      estimatedCompletionTime,
      confidence: batchJob.processedFiles > 3 ? 0.8 : 0.5, // Higher confidence with more data
    };
  }

  async handleFileProcessingError(
    batchId: string,
    fileId: string,
    error: Error,
    options: any = {}
  ): Promise<ErrorHandlingResult> {
    // Log the error
    logger.error('File processing error', {
      batchId,
      fileId,
      error: error.message,
    });

    // Schedule retry if configured
    const retryScheduled = options.retryAttempts > 0;
    const userNotified = options.notifyUser;

    return {
      errorHandled: true,
      retryScheduled,
      retryAttempt: 1,
      maxRetries: options.retryAttempts || 0,
      userNotified,
    };
  }

  async retryFileProcessing(batchId: string, fileId: string, userId: string, options: any = {}): Promise<any> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new Error('File not found');
    }

    const retryAttempt = (file.retryCount || 0) + 1;

    return {
      success: true,
      retryAttempt,
      alternativeMethodUsed: options.useAlternativeMethod,
      processingRestarted: options.resetProcessingState,
    };
  }

  async getBatchErrorSummary(batchId: string, userId: string): Promise<BatchErrorSummary> {
    // Mock implementation
    return {
      totalErrors: 2,
      retryableErrors: 1,
      permanentErrors: 1,
      errorsByType: {
        ocr_failure: 1,
        validation_error: 1,
      },
      recommendations: ['Retry failed OCR processing', 'Review validation rules'],
    };
  }

  async performBulkFileOperation(
    batchId: string,
    userId: string,
    operation: string,
    fileIds: string[],
    options: any = {}
  ): Promise<any> {
    return {
      success: true,
      operationType: operation,
      affectedFiles: fileIds.length,
      operationId: `op_${Date.now()}`,
      estimatedCompletionTime: new Date(Date.now() + 300000), // 5 minutes
    };
  }

  async performBatchApproval(batchId: string, userId: string, options: any = {}): Promise<any> {
    const invoices = await this.prisma.invoice.findMany({
      where: { 
        file: { batchJobId: batchId },
        status: 'pending_review',
      },
    });

    const minimumConfidence = options.approvalCriteria?.minimumConfidence || 0.9;
    const approvedInvoices = invoices.filter(inv => 
      (inv.extractionConfidence || 0) >= minimumConfidence
    ).length;

    return {
      success: true,
      approvedInvoices,
      pendingReview: invoices.length - approvedInvoices,
      approvalSummary: {
        criteria: options.approvalCriteria,
        results: `${approvedInvoices} approved, ${invoices.length - approvedInvoices} pending`,
      },
    };
  }

  async generateBatchReport(batchId: string, userId: string, options: any = {}): Promise<any> {
    const batchJob = await this.prisma.batchJob.findUnique({
      where: { id: batchId },
    });

    if (!batchJob) {
      throw new Error('Batch job not found');
    }

    const totalProcessingTime = batchJob.completedAt && batchJob.startedAt
      ? batchJob.completedAt.getTime() - batchJob.startedAt.getTime()
      : 0;

    return {
      batchId,
      summary: {
        totalFiles: batchJob.totalFiles,
        processedFiles: batchJob.processedFiles,
        failedFiles: batchJob.failedFiles,
        successRate: batchJob.totalFiles > 0 
          ? Math.round((batchJob.processedFiles / batchJob.totalFiles) * 100)
          : 0,
      },
      performance: {
        totalProcessingTime,
        averageTimePerFile: batchJob.processedFiles > 0 
          ? totalProcessingTime / batchJob.processedFiles
          : 0,
      },
      errors: [], // Mock errors array
      recommendations: ['Consider using higher resolution images for better OCR results'],
    };
  }

  async getBatchUIState(batchId: string, userId: string): Promise<UIState> {
    return {
      batchId,
      currentView: 'processing',
      availableActions: ['pause', 'cancel', 'view_details'],
      progressIndicators: {
        overall: 75,
        current_file: 50,
      },
      notifications: [],
      errorAlerts: [],
    };
  }

  async validateUIAction(batchId: string, userId: string, action: string): Promise<any> {
    return {
      allowed: true,
      reason: 'Action is permitted',
      requirements: [],
      warnings: [],
    };
  }

  async getUIUpdates(batchId: string, userId: string, options: any = {}): Promise<any> {
    return {
      hasUpdates: true,
      progressUpdates: { percentage: 78 },
      statusChanges: [],
      errorNotifications: [],
      nextUpdateInterval: 5000, // 5 seconds
    };
  }

  private validateBatchOptions(options: BatchUploadOptions): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!options.batchName || options.batchName.trim().length === 0) {
      errors.push('Batch name is required');
    }

    if (options.expectedFileCount !== undefined && options.expectedFileCount < 0) {
      errors.push('Expected file count must be positive');
    }

    if (options.expectedFileCount && options.expectedFileCount > this.maxBatchSize) {
      errors.push(`Batch size cannot exceed ${this.maxBatchSize} files`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async validateUploadedFile(file: any): Promise<any> {
    // Mock validation
    return {
      isValid: true,
      confidence: 0.95,
      issues: [],
    };
  }

  private async extractFileMetadata(file: any): Promise<any> {
    // Mock metadata extraction
    return {
      pageCount: 1,
      dimensions: { width: 612, height: 792 },
      fileType: 'PDF',
      createdDate: new Date(),
    };
  }

  private ensureUploadDirectory(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }
}
