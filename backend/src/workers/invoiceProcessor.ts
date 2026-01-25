// @ts-nocheck

import Bull from 'bull';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { redis } from '../redis';
import { EmailService } from '../email/email.service';
import { InvoiceService } from '../services/invoice.service';
import { InvoiceProcessingService } from '../services/InvoiceProcessingService';
import { ValidationError, DeviceError } from '../utils/errors';
import { FieldExtractionService } from '../services/field.service';
import { ProcessingService } from '../services/ProcessingService';
import { StorageService } from '../services/StorageService';
import { OCRService } from '../services/ocr.service';
import { config } from '../config';

// Initialize services
const prisma = new PrismaClient();
const emailService = new EmailService();
const invoiceService = new InvoiceService(
  prisma,
  emailService,
  new FieldExtractionService(prisma),
  new ProcessingService(),
  new StorageService(),
  new OCRService(prisma),
);
const processingService = new InvoiceProcessingService(
  prisma,
  emailService,
  invoiceService,
  redis,
);

// Initialize queue
const queue = new Bull('invoice-processing', {
  redis: config.redis.url,
});

queue.on('error', (err) => {
  logger.warn('Bull queue error (invoice-processing-worker)', { error: err.message });
});

// Process jobs
queue.process('process-invoice', async (job) => {
  const { fileId, userId, options } = job.data;

  try {
    await job.progress(10);

    const result = await processingService.processInvoice({
      fileId,
      userId,
      options,
    });

    await job.progress(100);
    return result;
  } catch (error) {
    logger.error('Error processing invoice:', {
      jobId: job.id,
      fileId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof ValidationError) {
      throw error;
    }

    throw new DeviceError(
      `Invoice processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
});

queue.on('failed', (job, error) => {
  logger.error('Job failed:', {
    jobId: job.id,
    error: error instanceof Error ? error.message : 'Unknown error',
    attempts: job.attemptsMade,
  });
});

queue.on('stalled', (job) => {
  logger.warn('Job stalled:', {
    jobId: job.id,
    attempts: job.attemptsMade,
  });
});

// Handle process termination
const shutdown = async () => {
  logger.info('Shutting down invoice processor...');
  try {
    await queue.close();
    await prisma.$disconnect();
  } catch (err) { }
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in worker:', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection in worker:', reason);
});

logger.info('Invoice processor worker started');
