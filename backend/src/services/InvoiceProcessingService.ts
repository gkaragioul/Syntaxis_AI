import { PrismaClient } from '@prisma/client';
import Bull from 'bull';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import { EmailService } from '../email/email.service';
import { InvoiceService } from './invoice.service';
import { ValidationError, ServiceError } from '../utils/errors';
import { config } from '../config';

interface ProcessingJob {
  fileId: string;
  userId: string;
  priority?: number;
  retryCount?: number;
  options?: {
    engine?: 'tesseract' | 'google-vision';
    templateId?: string;
    skipValidation?: boolean;
    // Enhanced OCR options
    preprocessing?: {
      deskew?: boolean;
      denoise?: boolean;
      enhance?: boolean;
      brightness?: number;
      contrast?: number;
      threshold?: number;
    };
    validation?: {
      minConfidence?: number;
      minTextLength?: number;
      requiredFields?: string[];
    };
    fallback?: {
      enabled?: boolean;
      primaryEngine?: 'tesseract' | 'google-vision';
      fallbackEngine?: 'tesseract' | 'google-vision';
      confidenceThreshold?: number;
      fallbackConditions?: {
        lowConfidence?: boolean;
        processingError?: boolean;
        emptyResult?: boolean;
      };
    };
    // Performance monitoring
    enableMetrics?: boolean;
    trackPerformance?: boolean;
  };
}

interface ProcessingResult {
  jobId: string;
  status: 'completed' | 'failed' | 'partial';
  invoiceId?: string;
  error?: string;
  metadata?: {
    // Enhanced OCR metadata
    ocrEngine?: string;
    processingTime?: number;
    confidenceScore?: number;
    confidenceMetrics?: {
      overall: number;
      textQuality: number;
      structuralIntegrity: number;
      fieldAccuracy: number;
      processingReliability: number;
    };
    fieldConfidences?: Record<string, number>;
    fallbackUsed?: boolean;
    enginesUsed?: string[];
    preprocessingSteps?: string[];
    // Performance metrics
    queueWaitTime?: number;
    totalProcessingTime?: number;
    retryAttempts?: number;
    // Additional metadata
    [key: string]: any;
  };
}

export class InvoiceProcessingService {
  private prisma: PrismaClient;
  private emailService: EmailService;
  private invoiceService: InvoiceService;
  private queue: Bull.Queue;
  private redis: Redis;

  constructor(
    prisma: PrismaClient,
    emailService: EmailService,
    invoiceService: InvoiceService,
    redis: Redis,
  ) {
    this.prisma = prisma;
    this.emailService = emailService;
    this.invoiceService = invoiceService;
    this.redis = redis;

    // Initialize queue with enhanced processing support
    this.queue = new Bull('invoice-processing', {
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5 seconds
        },
        removeOnComplete: 10, // Keep last 10 completed jobs for monitoring
        removeOnFail: 50, // Keep last 50 failed jobs for debugging
        // Enhanced job options
        delay: 0, // No delay by default
        timeout: 300000, // 5 minutes timeout for complex OCR processing
        // Job data validation
        jobId: undefined, // Will be set per job
      },
      settings: {
        stalledInterval: 30000, // 30 seconds
        maxStalledCount: 1,
        retryProcessDelay: 5000,
      },
    });

    // Set up queue event handlers
    this.setupQueueHandlers();
  }

  private setupQueueHandlers() {
    // Handle completed jobs
    this.queue.on('completed', async (job, result: ProcessingResult) => {
      try {
        await this.handleJobCompletion(job, result);
      } catch (error) {
        logger.error('Error handling job completion:', error);
      }
    });

    // Handle failed jobs
    this.queue.on('failed', async (job, error) => {
      try {
        await this.handleJobFailure(job, error);
      } catch (err) {
        logger.error('Error handling job failure:', err);
      }
    });

    // Handle stalled jobs
    this.queue.on('stalled', async (job) => {
      try {
        await this.handleStalledJob(job);
      } catch (error) {
        logger.error('Error handling stalled job:', error);
      }
    });
  }

  /**
   * Queue a new invoice processing job
   */
  async queueProcessingJob(job: ProcessingJob): Promise<string> {
    // Validate file exists and user has access
    const file = await this.prisma.file.findUnique({
      where: { id: job.fileId },
      include: { user: true },
    });

    if (!file) {
      throw new ValidationError('file', job.fileId, 'File not found');
    }

    if (file.userId !== job.userId) {
      throw new ValidationError(
        'user',
        job.userId,
        'Not authorized to process this file',
      );
    }

    // Add job to queue
    const queuedJob = await this.queue.add('process-invoice', job, {
      priority: job.priority || 0,
      jobId: `invoice-${job.fileId}-${Date.now()}`,
      attempts: job.retryCount || 3,
    });

    // Update file status
    await this.prisma.file.update({
      where: { id: job.fileId },
      data: { status: 'queued' },
    });

    return queuedJob.id.toString();
  }

  /**
   * Process a single invoice with enhanced OCR features
   */
  async processInvoice(job: ProcessingJob): Promise<ProcessingResult> {
    const { fileId, userId, options } = job;
    const startTime = Date.now();

    try {
      // Update file status to processing
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          status: 'processing',
          processingStartedAt: new Date(),
        },
      });

      // Process invoice with enhanced options
      const invoice = await this.invoiceService.processInvoice(fileId, userId, {
        ocrOptions: {
          engine: options?.engine || 'tesseract',
          preprocessing: options?.preprocessing || {
            deskew: true,
            denoise: true,
            enhance: true,
          },
          validation: options?.validation || {
            minConfidence: 0.7,
            minTextLength: 50,
          },
        },
        fallbackOptions: options?.fallback || {
          enabled: true,
          primaryEngine: options?.engine || 'tesseract',
          fallbackEngine: options?.engine === 'tesseract' ? 'google-vision' : 'tesseract',
          confidenceThreshold: 0.8,
        },
        enableMetrics: options?.enableMetrics ?? true,
        trackPerformance: options?.trackPerformance ?? true,
      });

      const processingTime = Date.now() - startTime;

      // Extract enhanced metadata from invoice
      const extractedData = invoice.extractedData as any;
      const ocrMetadata = extractedData?.ocrMetadata || {};

      return {
        jobId: job.fileId,
        status: 'completed',
        invoiceId: invoice.id,
        metadata: {
          // Enhanced OCR metadata
          ocrEngine: ocrMetadata.engine || options?.engine || 'tesseract',
          processingTime: ocrMetadata.processingTime || 0,
          confidenceScore: invoice.confidenceScore,
          confidenceMetrics: ocrMetadata.confidenceMetrics,
          fieldConfidences: ocrMetadata.fieldConfidences,
          fallbackUsed: ocrMetadata.fallbackUsed || false,
          enginesUsed: ocrMetadata.enginesUsed || [options?.engine || 'tesseract'],
          preprocessingSteps: ocrMetadata.preprocessingSteps || [],
          // Performance metrics
          queueWaitTime: startTime - invoice.createdAt.getTime(),
          totalProcessingTime: processingTime,
          retryAttempts: job.retryCount || 0,
          // Job metadata
          jobOptions: options,
          templateId: options?.templateId,
          skipValidation: options?.skipValidation || false,
        },
      };
    } catch (error) {
      // Update file status to failed
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      }).catch(() => {
        // Ignore update errors during error handling
      });

      throw new ServiceError(
        `Invoice processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(
    jobId: string,
    userId: string,
  ): Promise<{
    status: string;
    progress: number;
    result?: ProcessingResult;
    error?: string;
  }> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new ValidationError('job', jobId, 'Job not found');
    }

    // Verify user has access to this job
    const file = await this.prisma.file.findUnique({
      where: { id: job.data.fileId },
    });

    if (!file || file.userId !== userId) {
      throw new ValidationError(
        'user',
        userId,
        'Not authorized to access this job',
      );
    }

    const state = await job.getState();
    const progress = await job.progress();
    const result = job.returnvalue as ProcessingResult | undefined;
    const failedReason = job.failedReason;

    return {
      status: state,
      progress: typeof progress === 'number' ? progress : 0,
      result,
      error: failedReason,
    };
  }

  /**
   * Handle job completion
   */
  private async handleJobCompletion(job: Bull.Job, result: ProcessingResult) {
    const { fileId, userId } = job.data as ProcessingJob;

    try {
      // Update file status
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          status: 'completed',
          processedAt: new Date(),
        },
      });

      // Get user email for notification
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (user?.email) {
        await this.emailService.sendInvoiceProcessedEmail(user.email, {
          id: result.invoiceId!,
          invoiceNumber: result.metadata?.invoiceNumber,
          vendorName: result.metadata?.vendorName,
          totalAmount: result.metadata?.totalAmount,
        });
      }

      logger.info('Invoice processing completed', {
        jobId: job.id,
        fileId,
        userId,
        processingTime: result.metadata?.processingTime,
      });
    } catch (error) {
      logger.error('Error handling job completion:', error);
    }
  }

  /**
   * Handle job failure
   */
  private async handleJobFailure(job: Bull.Job, error: Error) {
    const { fileId, userId } = job.data as ProcessingJob;

    try {
      // Update file status
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          status: 'failed',
          errorMessage: error.message,
        },
      });

      // Get user email for notification
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (user?.email) {
        await this.emailService.sendErrorNotificationEmail(user.email, {
          message: error.message,
          invoiceNumber: 'Unknown',
        });
      }

      logger.error('Invoice processing failed', {
        jobId: job.id,
        fileId,
        userId,
        error: error.message,
        attempts: job.attemptsMade,
      });
    } catch (err) {
      logger.error('Error handling job failure:', err);
    }
  }

  /**
   * Handle stalled job
   */
  private async handleStalledJob(job: Bull.Job) {
    const { fileId } = job.data as ProcessingJob;

    try {
      // Update file status
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          status: 'failed',
          errorMessage: 'Processing stalled',
        },
      });

      logger.warn('Invoice processing stalled', {
        jobId: job.id,
        fileId,
        attempts: job.attemptsMade,
      });
    } catch (error) {
      logger.error('Error handling stalled job:', error);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    await this.queue.close();
    await this.redis.quit();
  }
}
