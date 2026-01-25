import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../app';
import { PrismaClient } from '@prisma/client';
import { TEST_USER, TEST_FILE } from '../setup';
import { mockServices } from '../mocks/services';

describe('Invoice Processing E2E', () => {
  let prisma: jest.Mocked<PrismaClient>;
  let testUser: any;
  let testFile: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;

    // Create test user
    testUser = await prisma.user.create({
      data: {
        ...TEST_USER,
        id: 'test-user-id',
      },
    });

    // Create test file
    testFile = await prisma.file.create({
      data: {
        ...TEST_FILE,
        id: 'test-file-id',
        userId: testUser.id,
        status: 'PENDING',
      },
    });
  });

  describe('Complete Invoice Processing Flow', () => {
    it('should process invoice from upload to completion', async () => {
      // Upload file
      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .attach('file', Buffer.from('test'), {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        })
        .set('Authorization', `Bearer ${testUser.id}`);

      expect(uploadResponse.status).toBe(200);
      expect(uploadResponse.body.success).toBe(true);

      const uploadedFile = await prisma.file.findFirst({
        where: { userId: testUser.id },
      });

      expect(uploadedFile?.status).toBe('PENDING');

      // Start processing
      const processResponse = await request(app)
        .post(`/api/invoices/process/${uploadedFile?.id}`)
        .set('Authorization', `Bearer ${testUser.id}`);

      expect(processResponse.status).toBe(200);
      expect(processResponse.body.success).toBe(true);

      const testJobId = processResponse.body.jobId;

      // Check initial job status
      const initialStatus = await request(app)
        .get(`/api/jobs/${testJobId}/status`)
        .set('Authorization', `Bearer ${testUser.id}`);

      expect(initialStatus.success).toBe(true);
      expect(initialStatus.jobId).toBe(testJobId);
      expect(initialStatus.status).toBe('active');
      expect(initialStatus.progress).toBe(0);

      // Mock successful processing
      mockServices.queue.getJobResult.mockResolvedValueOnce({
        success: true,
        data: {
          vendor: 'Test Vendor',
          amount: 100.0,
          date: new Date(),
          invoiceNumber: 'INV-001',
        },
      });

      // Wait for processing to complete
      let finalStatus;
      for (let i = 0; i < 10; i++) {
        finalStatus = await request(app)
          .get(`/api/jobs/${testJobId}/status`)
          .set('Authorization', `Bearer ${testUser.id}`);

        if (finalStatus.status === 'completed') {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      expect(finalStatus.status).toBe('completed');
      expect(finalStatus.progress).toBe(100);
      expect(finalStatus.result.success).toBe(true);

      // Verify invoice creation
      const invoicesResponse = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${testUser.id}`);

      expect(invoicesResponse.success).toBe(true);
      expect(invoicesResponse.data.invoices).toHaveLength(1);

      const invoice = invoicesResponse.data.invoices[0];
      expect(invoice.status).toBe('PROCESSED');
      expect(invoice.fileId).toBe(uploadedFile?.id);
      expect(invoice.vendor).toBeDefined();
      expect(invoice.amount).toBeDefined();
      expect(invoice.date).toBeDefined();

      // Verify file status update
      const fileResponse = await request(app)
        .get(`/api/files/${uploadedFile?.id}`)
        .set('Authorization', `Bearer ${testUser.id}`);

      expect(fileResponse.status).toBe(200);
      expect(fileResponse.body.file.status).toBe('PROCESSED');

      // Verify email notification
      expect(mockServices.email.sendJobStatusEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUser.id,
          jobId: testJobId,
          status: 'completed',
          result: expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              vendor: 'Test Vendor',
              amount: 100.0,
            }),
          }),
        }),
      );
    });

    it('should handle processing errors gracefully', async () => {
      // Upload file
      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .attach('file', Buffer.from('test'), {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        })
        .set('Authorization', `Bearer ${testUser.id}`);

      const uploadedFile = await prisma.file.findFirst({
        where: { userId: testUser.id },
      });

      // Start processing
      const processResponse = await request(app)
        .post(`/api/invoices/process/${uploadedFile?.id}`)
        .set('Authorization', `Bearer ${testUser.id}`);

      const testJobId = processResponse.body.jobId;

      // Mock processing failure
      mockServices.queue.getJobResult.mockResolvedValueOnce({
        success: false,
        error: 'OCR processing failed',
      });

      // Wait for processing to complete
      let finalStatus;
      for (let i = 0; i < 10; i++) {
        finalStatus = await request(app)
          .get(`/api/jobs/${testJobId}/status`)
          .set('Authorization', `Bearer ${testUser.id}`);

        if (finalStatus.status === 'failed') {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      expect(finalStatus.status).toBe('failed');
      expect(finalStatus.error).toContain('OCR processing failed');

      // Verify file status update
      const fileResponse = await request(app)
        .get(`/api/files/${uploadedFile?.id}`)
        .set('Authorization', `Bearer ${testUser.id}`);

      expect(fileResponse.status).toBe(200);
      expect(fileResponse.body.file.status).toBe('FAILED');

      // Verify error notification
      expect(mockServices.email.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUser.id,
          error: expect.stringContaining('OCR processing failed'),
          fileId: uploadedFile?.id,
        }),
      );

      // Verify error report creation
      const errorReportResponse = await request(app)
        .get('/api/error-reports')
        .set('Authorization', `Bearer ${testUser.id}`);

      expect(errorReportResponse.status).toBe(200);
      expect(errorReportResponse.body.reports).toHaveLength(1);
      expect(errorReportResponse.body.reports[0].errorMessage).toContain(
        'OCR processing failed',
      );
    });

    it('should handle batch processing', async () => {
      // Upload multiple files
      const files = await Promise.all(
        Array(3)
          .fill(null)
          .map((_, i) =>
            request(app)
              .post('/api/files/upload')
              .attach('file', Buffer.from('test'), {
                filename: `test-${i}.pdf`,
                contentType: 'application/pdf',
              })
              .set('Authorization', `Bearer ${testUser.id}`),
          ),
      );

      const uploadedFiles = await prisma.file.findMany({
        where: { userId: testUser.id },
      });

      // Start batch processing
      const batchResponse = await request(app)
        .post('/api/invoices/batch-process')
        .send({
          fileIds: uploadedFiles.map((f) => f.id),
        })
        .set('Authorization', `Bearer ${testUser.id}`);

      expect(batchResponse.status).toBe(200);
      expect(batchResponse.body.success).toBe(true);
      expect(batchResponse.body.jobs).toHaveLength(3);

      // Mock successful processing for all files
      mockServices.queue.getJobResult.mockResolvedValue({
        success: true,
        data: {
          vendor: 'Test Vendor',
          amount: 100.0,
          date: new Date(),
          invoiceNumber: 'INV-001',
        },
      });

      // Wait for all jobs to complete
      const jobStatuses = await Promise.all(
        batchResponse.body.jobs.map((job: any) =>
          request(app)
            .get(`/api/jobs/${job.id}/status`)
            .set('Authorization', `Bearer ${testUser.id}`)
            .then((res) => res.body),
        ),
      );

      expect(jobStatuses.every((s) => s.status === 'completed')).toBe(true);

      // Verify all invoices created
      const invoicesResponse = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${testUser.id}`);

      expect(invoicesResponse.success).toBe(true);
      expect(invoicesResponse.data.invoices).toHaveLength(3);

      expect(
        invoicesResponse.data.invoices.every(
          (i: any) =>
            i.status === 'PROCESSED' &&
            i.vendor === 'Test Vendor' &&
            i.amount === 100.0,
        ),
      ).toBe(true);

      expect(
        invoicesResponse.data.invoices.every((i: any) =>
          uploadedFiles.some((f) => f.id === i.fileId),
        ),
      ).toBe(true);

      // Verify email notifications
      expect(mockServices.email.sendJobStatusEmail).toHaveBeenCalledTimes(3);
    });
  });
});
