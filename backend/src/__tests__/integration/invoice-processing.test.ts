import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { InvoiceProcessingService } from '../../services/InvoiceProcessingService';
import { EmailService } from '../../email/email.service';
import { InvoiceService } from '../../services/invoice.service';
import { TEST_USER, TEST_FILE } from '../setup';
import { mockServices } from '../mocks/services';
import Bull from 'bull';
import { ValidationError } from '../../utils/errors';

// Mock dependencies
const mockPrisma = {
  file: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

const mockEmailService = {
  sendInvoiceProcessedEmail: jest.fn(),
} as unknown as EmailService;

const mockInvoiceService = {
  processInvoice: jest.fn(),
} as unknown as InvoiceService;

const mockRedis = {} as Redis;

const mockQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
  on: jest.fn(),
} as unknown as Bull.Queue;

// Mock Bull
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => mockQueue);
});

describe('Invoice Processing Integration', () => {
  let processingService: InvoiceProcessingService;
  const mockUserId = 'user-123';
  const mockFileId = 'file-123';

  beforeEach(() => {
    jest.clearAllMocks();
    processingService = new InvoiceProcessingService(
      mockPrisma,
      mockEmailService,
      mockInvoiceService,
      mockRedis,
    );
  });

  describe('Invoice Processing Flow', () => {
    const mockFile = {
      id: mockFileId,
      userId: mockUserId,
      name: 'test.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      status: 'PENDING',
      path: '/test/path/test.pdf',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockJob = {
      id: 'job-123',
      data: {
        fileId: mockFileId,
        userId: mockUserId,
      },
      getState: jest.fn().mockResolvedValue('completed'),
      progress: jest.fn().mockResolvedValue(100),
      returnvalue: {
        status: 'completed',
        invoiceId: 'invoice-123',
        metadata: {
          invoiceNumber: 'INV-001',
          vendorName: 'Test Vendor',
          totalAmount: 1234.56,
          processingTime: 1000,
        },
      },
    };

    it('should process invoice successfully', async () => {
      // Mock file lookup
      mockPrisma.file.findUnique.mockResolvedValueOnce(mockFile);

      // Mock queue job
      mockQueue.add.mockResolvedValueOnce(mockJob);

      // Mock invoice processing
      mockInvoiceService.processInvoice.mockResolvedValueOnce({
        id: 'invoice-123',
        confidenceScore: 0.95,
        createdAt: new Date(),
      });

      // Queue the job
      const jobId = await processingService.queueProcessingJob({
        fileId: mockFileId,
        userId: mockUserId,
      });

      expect(jobId).toBe(mockJob.id);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-invoice',
        expect.objectContaining({
          fileId: mockFileId,
          userId: mockUserId,
        }),
        expect.any(Object),
      );

      // Verify file status update
      expect(mockPrisma.file.update).toHaveBeenCalledWith({
        where: { id: mockFileId },
        data: { status: 'queued' },
      });

      // Get job status
      mockQueue.getJob.mockResolvedValueOnce(mockJob);
      mockPrisma.file.findUnique.mockResolvedValueOnce(mockFile);

      const status = await processingService.getJobStatus(jobId, mockUserId);

      expect(status).toEqual({
        status: 'completed',
        progress: 100,
        result: mockJob.returnvalue,
      });
    });

    it('should handle processing errors gracefully', async () => {
      // Mock file lookup
      mockPrisma.file.findUnique.mockResolvedValueOnce(mockFile);

      // Mock queue job
      mockQueue.add.mockResolvedValueOnce(mockJob);

      // Mock invoice processing failure
      mockInvoiceService.processInvoice.mockRejectedValueOnce(
        new Error('Processing failed'),
      );

      // Queue the job
      const jobId = await processingService.queueProcessingJob({
        fileId: mockFileId,
        userId: mockUserId,
      });

      // Get job status
      mockQueue.getJob.mockResolvedValueOnce({
        ...mockJob,
        getState: jest.fn().mockResolvedValue('failed'),
        failedReason: 'Processing failed',
      });
      mockPrisma.file.findUnique.mockResolvedValueOnce(mockFile);

      const status = await processingService.getJobStatus(jobId, mockUserId);

      expect(status).toEqual({
        status: 'failed',
        progress: 100,
        error: 'Processing failed',
      });

      // Verify file status update
      expect(mockPrisma.file.update).toHaveBeenCalledWith({
        where: { id: mockFileId },
        data: {
          status: 'failed',
          errorMessage: 'Processing failed',
        },
      });
    });

    it('should handle batch processing', async () => {
      // Create test files
      const files = await Promise.all(
        Array(3)
          .fill(null)
          .map((_, i) =>
            mockPrisma.file.create({
              data: {
                id: `test-file-${i}`,
                name: 'test.pdf',
                size: 1024,
                mimeType: 'application/pdf',
                status: 'PENDING',
                path: '/test/path/test.pdf',
                filename: 'test.pdf',
                userId: mockUserId,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            }),
          ),
      );

      // Mock file lookups
      mockPrisma.file.findUnique.mockImplementation((args) =>
        Promise.resolve(files.find((f) => f.id === args.where.id)),
      );

      // Mock queue jobs
      mockQueue.add.mockImplementation((_, job) =>
        Promise.resolve({
          id: `job-${job.fileId}`,
          data: job,
          getState: jest.fn().mockResolvedValue('completed'),
          progress: jest.fn().mockResolvedValue(100),
          returnvalue: {
            status: 'completed',
            invoiceId: `invoice-${job.fileId}`,
            metadata: {
              invoiceNumber: `INV-00${job.fileId}`,
              vendorName: 'Test Vendor',
              totalAmount: 1234.56,
              processingTime: 1000,
            },
          },
        }),
      );

      // Queue jobs
      const jobIds = await Promise.all(
        files.map((file) =>
          processingService.queueProcessingJob({
            fileId: file.id,
            userId: mockUserId,
          }),
        ),
      );

      expect(jobIds).toHaveLength(3);
      expect(mockQueue.add).toHaveBeenCalledTimes(3);

      // Verify all files were updated
      expect(mockPrisma.file.update).toHaveBeenCalledTimes(3);
      files.forEach((file) => {
        expect(mockPrisma.file.update).toHaveBeenCalledWith({
          where: { id: file.id },
          data: { status: 'queued' },
        });
      });
    });

    it('should handle concurrent processing with rate limiting', async () => {
      // Create test files
      const files = await Promise.all(
        Array(10)
          .fill(null)
          .map((_, i) =>
            mockPrisma.file.create({
              data: {
                id: `test-file-${i}`,
                name: 'test.pdf',
                size: 1024,
                mimeType: 'application/pdf',
                status: 'PENDING',
                path: '/test/path/test.pdf',
                filename: 'test.pdf',
                userId: mockUserId,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            }),
          ),
      );

      // Mock file lookups
      mockPrisma.file.findUnique.mockImplementation((args) =>
        Promise.resolve(files.find((f) => f.id === args.where.id)),
      );

      // Mock queue jobs with rate limiting
      let concurrentJobs = 0;
      mockQueue.add.mockImplementation(async (_, job) => {
        concurrentJobs++;
        if (concurrentJobs > 5) {
          throw new Error('Rate limit exceeded');
        }
        await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate processing time
        concurrentJobs--;
        return {
          id: `job-${job.fileId}`,
          data: job,
          getState: jest.fn().mockResolvedValue('completed'),
          progress: jest.fn().mockResolvedValue(100),
          returnvalue: {
            status: 'completed',
            invoiceId: `invoice-${job.fileId}`,
            metadata: {
              invoiceNumber: `INV-00${job.fileId}`,
              vendorName: 'Test Vendor',
              totalAmount: 1234.56,
              processingTime: 1000,
            },
          },
        };
      });

      // Queue jobs with concurrency control
      const results = await Promise.allSettled(
        files.map((file) =>
          processingService.queueProcessingJob({
            fileId: file.id,
            userId: mockUserId,
            options: { engine: 'tesseract' },
          }),
        ),
      );

      // Verify some jobs succeeded and some failed due to rate limiting
      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(succeeded.length).toBeLessThanOrEqual(5);
      expect(failed.length).toBeGreaterThan(0);
      expect(succeeded.length + failed.length).toBe(10);
    });
  });
});
