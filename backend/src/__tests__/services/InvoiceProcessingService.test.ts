/**
 * InvoiceProcessingService Tests
 *
 * TDD Phase: GREEN - Creating basic tests for InvoiceProcessingService
 * Task: 2.2 - Service Layer Test Fixes
 *
 * Tests for:
 * - queueProcessingJob()
 * - processInvoice()
 * - getJobStatus()
 * - cleanup()
 */

import { InvoiceProcessingService } from '../../services/InvoiceProcessingService';
import { PrismaClient } from '@prisma/client';
import { EmailService } from '../../email/email.service';
import { InvoiceService } from '../../services/invoice.service';
import { ValidationError, ServiceError } from '../../utils/errors';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../email/email.service');
jest.mock('../../services/invoice.service');
jest.mock('bull');
jest.mock('ioredis');

describe('InvoiceProcessingService', () => {
  let invoiceProcessingService: InvoiceProcessingService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockInvoiceService: jest.Mocked<InvoiceService>;
  let mockQueue: any;
  let mockRedis: any;

  beforeEach(() => {
    // Setup Prisma mock
    mockPrisma = {
      file: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      invoice: {
        create: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    // Setup EmailService mock
    mockEmailService = {
      sendProcessingCompleteEmail: jest.fn(),
      sendProcessingFailedEmail: jest.fn(),
    } as any;

    // Setup InvoiceService mock
    mockInvoiceService = {
      createInvoice: jest.fn(),
      updateInvoice: jest.fn(),
    } as any;

    // Setup Bull Queue mock
    mockQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
    };

    // Setup Redis mock
    mockRedis = {
      quit: jest.fn(),
    };

    // Mock Bull constructor
    const Bull = require('bull');
    Bull.mockImplementation(() => mockQueue);

    // Mock Redis constructor
    const { Redis } = require('ioredis');
    Redis.mockImplementation(() => mockRedis);

    // Create service instance
    invoiceProcessingService = new InvoiceProcessingService(
      mockPrisma,
      mockEmailService,
      mockInvoiceService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queueProcessingJob', () => {
    it('should queue a processing job successfully', async () => {
      const mockFile = {
        id: 'file-123',
        userId: 'user-123',
        filename: 'test-invoice.pdf',
        status: 'uploaded',
        user: { id: 'user-123', email: 'test@example.com' },
      };

      const mockJob = {
        fileId: 'file-123',
        userId: 'user-123',
        priority: 1,
      };

      mockPrisma.file.findUnique.mockResolvedValue(mockFile as any);
      mockQueue.add.mockResolvedValue({ id: 'job-123' });

      const jobId = await invoiceProcessingService.queueProcessingJob(mockJob);

      expect(jobId).toBe('job-123');
      expect(mockPrisma.file.findUnique).toHaveBeenCalledWith({
        where: { id: 'file-123' },
        include: { user: true },
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-invoice',
        mockJob,
        expect.objectContaining({
          priority: 1,
          attempts: 3,
        })
      );
    });

    it('should throw ValidationError when file not found', async () => {
      const mockJob = {
        fileId: 'nonexistent-file',
        userId: 'user-123',
      };

      mockPrisma.file.findUnique.mockResolvedValue(null);

      await expect(
        invoiceProcessingService.queueProcessingJob(mockJob)
      ).rejects.toThrow(ValidationError);

      expect(mockPrisma.file.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent-file' },
        include: { user: true },
      });
    });

    it('should throw ValidationError when user does not own file', async () => {
      const mockFile = {
        id: 'file-123',
        userId: 'other-user',
        filename: 'test-invoice.pdf',
        status: 'uploaded',
        user: { id: 'other-user', email: 'other@example.com' },
      };

      const mockJob = {
        fileId: 'file-123',
        userId: 'user-123',
      };

      mockPrisma.file.findUnique.mockResolvedValue(mockFile as any);

      await expect(
        invoiceProcessingService.queueProcessingJob(mockJob)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status successfully', async () => {
      const mockBullJob = {
        id: 'job-123',
        data: { fileId: 'file-123', userId: 'user-123' },
        progress: 50,
        opts: { attempts: 3 },
        attemptsMade: 1,
        finishedOn: null,
        failedReason: null,
      };

      mockQueue.getJob.mockResolvedValue(mockBullJob);

      const status = await invoiceProcessingService.getJobStatus('job-123', 'user-123');

      expect(status).toEqual({
        status: 'active',
        progress: 50,
        attempts: 1,
        maxAttempts: 3,
        error: null,
      });

      expect(mockQueue.getJob).toHaveBeenCalledWith('job-123');
    });

    it('should throw ValidationError when job not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      await expect(
        invoiceProcessingService.getJobStatus('nonexistent-job', 'user-123')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when user does not own job', async () => {
      const mockBullJob = {
        id: 'job-123',
        data: { fileId: 'file-123', userId: 'other-user' },
        progress: 50,
      };

      mockQueue.getJob.mockResolvedValue(mockBullJob);

      await expect(
        invoiceProcessingService.getJobStatus('job-123', 'user-123')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources successfully', async () => {
      mockQueue.close.mockResolvedValue(undefined);
      mockRedis.quit.mockResolvedValue(undefined);

      await invoiceProcessingService.cleanup();

      expect(mockQueue.close).toHaveBeenCalled();
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockQueue.close.mockRejectedValue(new Error('Queue close error'));
      mockRedis.quit.mockResolvedValue(undefined);

      // Should not throw error
      await expect(invoiceProcessingService.cleanup()).resolves.toBeUndefined();
    });
  });
});