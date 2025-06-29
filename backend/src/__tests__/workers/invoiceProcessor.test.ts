import { InvoiceProcessingService } from '../../services/InvoiceProcessingService';
import { PrismaClient } from '@prisma/client';
import { Bull } from 'bull';
import { EmailService } from '../../services/EmailService';
import { config } from '../../config';
import { processInvoiceJob } from '../../workers/invoiceProcessor';

// Mock dependencies
jest.mock('../../services/InvoiceProcessingService');
jest.mock('@prisma/client');
jest.mock('bull');
jest.mock('../../services/EmailService');
jest.mock('../../config/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

describe('Invoice Processor Worker', () => {
  let mockProcessingService: jest.Mocked<InvoiceProcessingService>;
  let mockQueue: jest.Mocked<Bull>;
  let mockJob: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup processing service mock
    mockProcessingService = new InvoiceProcessingService(
      new PrismaClient(),
      new Bull('invoice-processing'),
      new EmailService(),
    ) as jest.Mocked<InvoiceProcessingService>;

    // Setup queue mock
    mockQueue = new Bull('invoice-processing') as jest.Mocked<Bull>;

    // Setup job mock
    mockJob = {
      id: 'job123',
      data: {
        fileId: 'file123',
        userId: 'user123',
      },
      progress: jest.fn(),
      finished: jest.fn(),
      failed: jest.fn(),
    };
  });

  describe('processInvoiceJob', () => {
    it('should process invoice successfully', async () => {
      const mockResult = {
        success: true,
        invoiceId: 'invoice123',
        data: {
          vendor: 'Test Vendor',
          amount: 100.0,
          date: new Date(),
        },
      };

      mockProcessingService.processInvoice.mockResolvedValue(mockResult);

      await processInvoiceJob(mockJob);

      expect(mockProcessingService.processInvoice).toHaveBeenCalledWith(
        'file123',
        'user123',
      );
      expect(mockJob.progress).toHaveBeenCalledWith(100);
      expect(mockJob.finished).toHaveBeenCalledWith(mockResult);
      expect(mockJob.failed).not.toHaveBeenCalled();
    });

    it('should handle processing errors', async () => {
      const error = new Error('Processing failed');
      mockProcessingService.processInvoice.mockRejectedValue(error);

      await processInvoiceJob(mockJob);

      expect(mockProcessingService.processInvoice).toHaveBeenCalledWith(
        'file123',
        'user123',
      );
      expect(mockJob.failed).toHaveBeenCalledWith(error);
      expect(mockJob.finished).not.toHaveBeenCalled();
    });

    it('should update progress during processing', async () => {
      // Mock progress updates
      let progress = 0;
      mockProcessingService.processInvoice.mockImplementation(async () => {
        progress += 25;
        mockJob.progress(progress);
        if (progress === 100) {
          return {
            success: true,
            invoiceId: 'invoice123',
            data: {
              vendor: 'Test Vendor',
              amount: 100.0,
              date: new Date(),
            },
          };
        }
        return new Promise((resolve) => setTimeout(resolve, 100));
      });

      await processInvoiceJob(mockJob);

      expect(mockJob.progress).toHaveBeenCalledTimes(4);
      expect(mockJob.progress).toHaveBeenCalledWith(25);
      expect(mockJob.progress).toHaveBeenCalledWith(50);
      expect(mockJob.progress).toHaveBeenCalledWith(75);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });

    it('should handle validation errors', async () => {
      const validationError = new Error('Invalid file format');
      mockProcessingService.processInvoice.mockRejectedValue(validationError);

      await processInvoiceJob(mockJob);

      expect(mockJob.failed).toHaveBeenCalledWith(validationError);
      expect(mockJob.finished).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('Service unavailable');
      mockProcessingService.processInvoice.mockRejectedValue(serviceError);

      await processInvoiceJob(mockJob);

      expect(mockJob.failed).toHaveBeenCalledWith(serviceError);
      expect(mockJob.finished).not.toHaveBeenCalled();
    });
  });

  describe('Queue Event Handlers', () => {
    it('should handle queue errors', async () => {
      const error = new Error('Queue error');
      const errorHandler = mockQueue.on.mock.calls.find(
        (call) => call[0] === 'error',
      )?.[1];

      if (errorHandler) {
        await errorHandler(error);
      }

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        'Invoice processing queue error:',
        error,
      );
    });

    it('should handle job failures', async () => {
      const error = new Error('Job failed');
      const job = { id: 'job123', data: { fileId: 'file123' } };
      const failureHandler = mockQueue.on.mock.calls.find(
        (call) => call[0] === 'failed',
      )?.[1];

      if (failureHandler) {
        await failureHandler(job, error);
      }

      // Verify failure was logged
      expect(console.error).toHaveBeenCalledWith(
        'Invoice processing job failed:',
        expect.objectContaining({
          jobId: 'job123',
          fileId: 'file123',
          error,
        }),
      );
    });

    it('should handle stalled jobs', async () => {
      const job = { id: 'job123', data: { fileId: 'file123' } };
      const stalledHandler = mockQueue.on.mock.calls.find(
        (call) => call[0] === 'stalled',
      )?.[1];

      if (stalledHandler) {
        await stalledHandler(job);
      }

      // Verify stall was logged
      expect(console.warn).toHaveBeenCalledWith(
        'Invoice processing job stalled:',
        expect.objectContaining({
          jobId: 'job123',
          fileId: 'file123',
        }),
      );
    });
  });

  describe('Process Termination', () => {
    it('should handle graceful shutdown', async () => {
      const closeSpy = jest.spyOn(mockQueue, 'close');
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

      // Simulate SIGTERM
      process.emit('SIGTERM');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(closeSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle uncaught exceptions', async () => {
      const error = new Error('Uncaught exception');
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

      // Simulate uncaught exception
      process.emit('uncaughtException', error);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(console.error).toHaveBeenCalledWith('Uncaught exception:', error);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle unhandled rejections', async () => {
      const error = new Error('Unhandled rejection');
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

      // Simulate unhandled rejection
      process.emit('unhandledRejection', error);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(console.error).toHaveBeenCalledWith('Unhandled rejection:', error);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
