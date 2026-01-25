import Bull from 'bull';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { InvoiceService } from '../services/invoice.service';
import { config } from '../config';
import { logger } from '../utils/logger';
import { redis, redisConfig } from '../redis';

export interface ProcessingResult {
  success: boolean;
  fileId: string;
  invoiceId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export class InvoiceProcessingService {
  private prisma: PrismaClient;
  private emailService: EmailService;
  private invoiceService: InvoiceService;
  private queue: Bull.Queue;
  private sharedRedis: Redis;

  constructor(
    prisma: PrismaClient,
    emailService: EmailService,
    invoiceService: InvoiceService,
    redisInstance: Redis,
  ) {
    this.prisma = prisma;
    this.emailService = emailService;
    this.invoiceService = invoiceService;
    this.sharedRedis = redisInstance;

    this.queue = new Bull('invoice-processing', {
      createClient: (type) => {
        switch (type) {
          case 'client':
            return this.sharedRedis;
          default:
            const client = new Redis(config.redis.url, {
              ...redisConfig,
              maxRetriesPerRequest: null,
            });
            client.on('error', (err) => {
              logger.warn(`Bull internal redis client (${type}) error:`, { error: err.message });
            });
            return client;
        }
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 10,
        removeOnFail: 50,
        timeout: 300000,
      },
    });

    this.queue.on('error', (err) => {
      logger.warn('Bull queue error.', { error: err.message });
    });
  }

  /**
   * Alias for queueProcessingJob used in routes
   */
  async queueProcessingJob(data: {
    fileId: string;
    userId: string;
    options?: Record<string, unknown>;
  }): Promise<string> {
    const job = await this.addJob(data);
    return job.id.toString();
  }

  /**
   * Alias for getJobStatus used in routes
   */
  async getJobStatus(jobId: string, userId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) return { status: 'not_found' };

    return {
      id: job.id,
      status: await job.getState(),
      progress: job.progress(),
      result: job.returnvalue,
      failedReason: job.failedReason,
    };
  }

  async processInvoice(data: {
    fileId: string;
    userId: string;
    options?: Record<string, unknown>;
  }): Promise<ProcessingResult> {
    const { fileId, userId, options } = data;
    try {
      const file = await this.prisma.file.findUnique({ where: { id: fileId } });
      if (!file) throw new Error(`File not found: ${fileId}`);

      await this.prisma.file.update({
        where: { id: fileId },
        data: { status: 'processing' },
      });

      const invoice = await this.invoiceService.processInvoice(fileId, userId, options as any);

      await this.prisma.file.update({
        where: { id: fileId },
        data: { status: 'completed' },
      });

      return { success: true, fileId, invoiceId: invoice.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Invoice processing failed', { fileId, userId, error });
      return { success: false, fileId, error: errorMessage };
    }
  }

  async addJob(data: {
    fileId: string;
    userId: string;
    options?: Record<string, unknown>;
  }): Promise<Bull.Job> {
    return await this.queue.add('process-invoice', data);
  }

  async cleanup() {
    try { await this.queue.close(); } catch (err) { }
  }
}
