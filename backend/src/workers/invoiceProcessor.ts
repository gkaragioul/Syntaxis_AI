import Bull from 'bull';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { config } from '../config';
import { EmailService } from '../email/email.service';
import { InvoiceService } from '../services/invoice.service';
import { InvoiceProcessingService } from '../services/InvoiceProcessingService';
import { ValidationError, DeviceError } from '../utils/errors';
import { FieldExtractionService } from '../services/field.service';
import { ProcessingService } from '../services/ProcessingService';
import { StorageService } from '../services/StorageService';

// Initialize services
const prisma = new PrismaClient();
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
});
const emailService = new EmailService();
const invoiceService = new InvoiceService(
  prisma,
  emailService,
  new FieldExtractionService(),
  new ProcessingService(),
  new StorageService(),
);
const processingService = new InvoiceProcessingService(
  prisma,
  emailService,
  invoiceService,
  redis,
);

// Initialize queue
const queue = new Bull('invoice-processing', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
});

// Process jobs
queue.process('process-invoice', async (job) => {
  const { fileId, userId, options } = job.data;

  try {
    // Update job progress
    await job.progress(10);

    // Process invoice
    const result = await processingService.processInvoice({
      fileId,
      userId,
      options,
    });

    // Update job progress
    await job.progress(100);

    return result;
  } catch (error) {
    logger.error('Error processing invoice:', {
      jobId: job.id,
      fileId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // If it's a validation error, don't retry
    if (error instanceof ValidationError) {
      throw error;
    }

    // For other errors, let the queue handle retries
    throw new DeviceError(
      `Invoice processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
});

// Handle worker events
queue.on('error', (error) => {
  logger.error('Queue error:', error);
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
process.on('SIGTERM', async () => {
  logger.info('Shutting down invoice processor...');
  await queue.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down invoice processor...');
  await queue.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  process.exit(1);
});

logger.info('Invoice processor worker started');
