import request from 'supertest';
import express from 'express';
import { invoiceRoutes } from '../../routes/invoice.routes';
import { InvoiceProcessingService } from '../../services/InvoiceProcessingService';
import { PrismaClient } from '@prisma/client';
import { Bull } from 'bull';
import { EmailService } from '../../services/EmailService';
import { authMiddleware } from '../../middleware/auth';
import { rateLimiter } from '../../middleware/rateLimiter';

// Mock dependencies
jest.mock('../../services/InvoiceProcessingService');
jest.mock('../../middleware/auth');
jest.mock('../../middleware/rateLimiter');
jest.mock('@prisma/client');
jest.mock('bull');
jest.mock('../../services/EmailService');

describe('Invoice Routes', () => {
  let app: express.Application;
  let mockProcessingService: jest.Mocked<InvoiceProcessingService>;

  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    role: 'USER',
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup auth middleware mock
    (authMiddleware as jest.Mock).mockImplementation((req, res, next) => {
      req.user = mockUser;
      next();
    });

    // Setup rate limiter mock
    (rateLimiter as jest.Mock).mockImplementation((req, res, next) => next());

    // Setup processing service mock
    mockProcessingService = new InvoiceProcessingService(
      new PrismaClient(),
      new Bull('invoice-processing'),
      new EmailService(),
    ) as jest.Mocked<InvoiceProcessingService>;

    // Create express app
    app = express();
    app.use(express.json());
    app.use('/api/v1/invoices', invoiceRoutes);
  });

  describe('POST /api/v1/invoices/process/:fileId', () => {
    it('should queue invoice processing job', async () => {
      mockProcessingService.queueProcessingJob.mockResolvedValue({
        jobId: 'job123',
        message: 'Invoice processing job queued successfully',
      });

      const response = await request(app)
        .post('/api/v1/invoices/process/file123')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        jobId: 'job123',
        message: 'Invoice processing job queued successfully',
      });
      expect(mockProcessingService.queueProcessingJob).toHaveBeenCalledWith(
        'file123',
        'user123',
      );
    });

    it('should handle validation errors', async () => {
      mockProcessingService.queueProcessingJob.mockRejectedValue(
        new Error('Invalid file'),
      );

      const response = await request(app)
        .post('/api/v1/invoices/process/invalid-file')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid file',
      });
    });
  });

  describe('GET /api/v1/invoices/process/:jobId', () => {
    it('should return job status', async () => {
      mockProcessingService.getJobStatus.mockResolvedValue({
        jobId: 'job123',
        status: 'completed',
        progress: 100,
        result: { success: true },
      });

      const response = await request(app)
        .get('/api/v1/invoices/process/job123')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        jobId: 'job123',
        status: 'completed',
        progress: 100,
        result: { success: true },
      });
    });

    it('should handle non-existent job', async () => {
      mockProcessingService.getJobStatus.mockRejectedValue(
        new Error('Job not found'),
      );

      const response = await request(app)
        .get('/api/v1/invoices/process/non-existent-job')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Job not found',
      });
    });
  });

  describe('POST /api/v1/invoices/batch', () => {
    it('should queue batch processing jobs', async () => {
      const batchRequest = {
        fileIds: ['file1', 'file2', 'file3'],
        options: { priority: 'high' },
      };

      mockProcessingService.queueProcessingJob.mockResolvedValue({
        jobId: 'job123',
        message: 'Invoice processing job queued successfully',
      });

      const response = await request(app)
        .post('/api/v1/invoices/batch')
        .send(batchRequest)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Batch processing jobs queued successfully',
        jobs: expect.arrayContaining([
          expect.objectContaining({
            fileId: expect.any(String),
            jobId: expect.any(String),
          }),
        ]),
      });
      expect(mockProcessingService.queueProcessingJob).toHaveBeenCalledTimes(3);
    });

    it('should validate batch request', async () => {
      const invalidRequest = {
        fileIds: [], // Empty array
        options: { priority: 'invalid' },
      };

      const response = await request(app)
        .post('/api/v1/invoices/batch')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: expect.stringContaining('validation'),
      });
    });
  });

  describe('GET /api/v1/invoices', () => {
    it('should list user invoices with pagination', async () => {
      const mockInvoices = [
        {
          id: 'invoice1',
          vendor: 'Vendor 1',
          amount: 100.0,
          status: 'PROCESSED',
          createdAt: new Date(),
        },
        {
          id: 'invoice2',
          vendor: 'Vendor 2',
          amount: 200.0,
          status: 'PROCESSED',
          createdAt: new Date(),
        },
      ];

      mockProcessingService.listInvoices.mockResolvedValue({
        invoices: mockInvoices,
        total: 2,
        page: 1,
        limit: 10,
      });

      const response = await request(app)
        .get('/api/v1/invoices?page=1&limit=10')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          invoices: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              vendor: expect.any(String),
              amount: expect.any(Number),
            }),
          ]),
          total: 2,
          page: 1,
          limit: 10,
        },
      });
    });

    it('should handle filtering and sorting', async () => {
      const mockInvoices = [
        {
          id: 'invoice1',
          vendor: 'Vendor A',
          amount: 100.0,
          status: 'PROCESSED',
          createdAt: new Date(),
        },
      ];

      mockProcessingService.listInvoices.mockResolvedValue({
        invoices: mockInvoices,
        total: 1,
        page: 1,
        limit: 10,
      });

      const response = await request(app)
        .get('/api/v1/invoices?status=PROCESSED&sortBy=vendor&sortOrder=asc')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          invoices: expect.arrayContaining([
            expect.objectContaining({
              id: 'invoice1',
              vendor: 'Vendor A',
            }),
          ]),
          total: 1,
          page: 1,
          limit: 10,
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors', async () => {
      mockProcessingService.queueProcessingJob.mockRejectedValue(
        new Error('Service error'),
      );

      const response = await request(app)
        .post('/api/v1/invoices/process/file123')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Service error',
      });
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/v1/invoices/process/')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Not Found',
      });
    });
  });
});
