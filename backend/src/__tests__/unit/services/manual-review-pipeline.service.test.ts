import { PrismaClient } from '@prisma/client';
import { ManualReviewPipelineService } from '../../../services/manual-review-pipeline.service';
import { ManualReviewComponentService } from '../../../services/manual-review-component.service';
import { InvoiceProcessingService } from '../../../services/InvoiceProcessingService';
import { logger } from '../../../utils/logger';

// Mock dependencies
jest.mock('../../../utils/logger');
jest.mock('../../../services/manual-review-component.service');
jest.mock('../../../services/InvoiceProcessingService');

describe('ManualReviewPipelineService', () => {
  let service: ManualReviewPipelineService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockManualReviewService: jest.Mocked<ManualReviewComponentService>;
  let mockProcessingService: jest.Mocked<InvoiceProcessingService>;

  beforeEach(() => {
    mockPrisma = {
      invoice: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      reviewTask: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;

    mockManualReviewService = {
      createReviewTask: jest.fn(),
      identifyInvoicesForReview: jest.fn(),
      categorizeReviewPriorities: jest.fn(),
    } as any;

    mockProcessingService = {
      processInvoice: jest.fn(),
      getJobStatus: jest.fn(),
    } as any;

    service = new ManualReviewPipelineService(
      mockPrisma,
      mockManualReviewService,
      mockProcessingService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('integrateWithProcessingPipeline', () => {
    it('should automatically create review tasks for low-confidence invoices', async () => {
      const invoiceId = 'invoice-123';
      const userId = 'user-123';
      const mockInvoice = {
        id: invoiceId,
        userId,
        extractionConfidence: 0.65, // Below threshold
        validationStatus: 'warning',
        status: 'extracted',
        totalAmount: 5000,
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockManualReviewService.createReviewTask.mockResolvedValue({
        success: true,
        reviewTaskId: 'task-123',
        fieldsRequiringReview: ['totalAmount', 'vendorName'],
        estimatedReviewTime: 1800000, // 30 minutes
      });

      const result = await service.integrateWithProcessingPipeline(invoiceId, {
        confidenceThreshold: 0.8,
        autoCreateReviewTasks: true,
        priorityRules: {
          highValueThreshold: 10000,
          lowConfidenceThreshold: 0.5,
        },
      });

      expect(result).toEqual({
        requiresReview: true,
        reviewTaskCreated: true,
        reviewTaskId: 'task-123',
        priority: 'medium',
        reason: 'Low extraction confidence',
        estimatedReviewTime: 1800000,
        fieldsRequiringReview: ['totalAmount', 'vendorName'],
        nextStage: 'manual_review',
      });

      expect(mockManualReviewService.createReviewTask).toHaveBeenCalledWith(
        invoiceId,
        {
          priority: 'medium',
          reviewType: 'confidence_review',
          instructions: 'Review fields with low extraction confidence',
          dueDate: expect.any(Date),
        },
      );
    });

    it('should skip review for high-confidence invoices', async () => {
      const invoiceId = 'invoice-456';
      const mockInvoice = {
        id: invoiceId,
        userId: 'user-123',
        extractionConfidence: 0.95, // Above threshold
        validationStatus: 'passed',
        status: 'extracted',
        totalAmount: 2000,
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await service.integrateWithProcessingPipeline(invoiceId, {
        confidenceThreshold: 0.8,
        autoCreateReviewTasks: true,
      });

      expect(result).toEqual({
        requiresReview: false,
        reviewTaskCreated: false,
        priority: 'none',
        reason: 'High confidence extraction',
        nextStage: 'processing',
      });

      expect(mockManualReviewService.createReviewTask).not.toHaveBeenCalled();
    });

    it('should handle high-value invoices with special priority', async () => {
      const invoiceId = 'invoice-789';
      const mockInvoice = {
        id: invoiceId,
        userId: 'user-123',
        extractionConfidence: 0.75,
        validationStatus: 'passed',
        status: 'extracted',
        totalAmount: 15000, // High value
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockManualReviewService.createReviewTask.mockResolvedValue({
        success: true,
        reviewTaskId: 'task-456',
        fieldsRequiringReview: ['totalAmount'],
        estimatedReviewTime: 900000, // 15 minutes
      });

      const result = await service.integrateWithProcessingPipeline(invoiceId, {
        confidenceThreshold: 0.8,
        autoCreateReviewTasks: true,
        priorityRules: {
          highValueThreshold: 10000,
          lowConfidenceThreshold: 0.5,
        },
      });

      expect(result).toEqual({
        requiresReview: true,
        reviewTaskCreated: true,
        reviewTaskId: 'task-456',
        priority: 'high',
        reason: 'High value invoice with moderate confidence',
        estimatedReviewTime: 900000,
        fieldsRequiringReview: ['totalAmount'],
        nextStage: 'manual_review',
      });

      expect(mockManualReviewService.createReviewTask).toHaveBeenCalledWith(
        invoiceId,
        {
          priority: 'high',
          reviewType: 'high_value_review',
          instructions: 'Review high-value invoice for accuracy',
          dueDate: expect.any(Date),
        },
      );
    });

    it('should handle validation failures', async () => {
      const invoiceId = 'invoice-error';
      const mockInvoice = {
        id: invoiceId,
        userId: 'user-123',
        extractionConfidence: 0.85,
        validationStatus: 'failed',
        status: 'extracted',
        totalAmount: 3000,
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockManualReviewService.createReviewTask.mockResolvedValue({
        success: true,
        reviewTaskId: 'task-validation',
        fieldsRequiringReview: ['invoiceDate', 'vendorTaxId'],
        estimatedReviewTime: 1200000, // 20 minutes
      });

      const result = await service.integrateWithProcessingPipeline(invoiceId, {
        confidenceThreshold: 0.8,
        autoCreateReviewTasks: true,
        includeValidationFailures: true,
      });

      expect(result).toEqual({
        requiresReview: true,
        reviewTaskCreated: true,
        reviewTaskId: 'task-validation',
        priority: 'high',
        reason: 'Validation failed',
        estimatedReviewTime: 1200000,
        fieldsRequiringReview: ['invoiceDate', 'vendorTaxId'],
        nextStage: 'manual_review',
      });
    });

    it('should throw error when invoice not found', async () => {
      const invoiceId = 'non-existent';

      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(
        service.integrateWithProcessingPipeline(invoiceId, {
          confidenceThreshold: 0.8,
        }),
      ).rejects.toThrow('Invoice not found');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to integrate invoice with review pipeline',
        { error: expect.any(Error), invoiceId },
      );
    });
  });

  describe('processReviewCompletion', () => {
    it('should continue processing pipeline after review approval', async () => {
      const reviewTaskId = 'task-123';
      const mockReviewTask = {
        id: reviewTaskId,
        invoiceId: 'invoice-123',
        status: 'completed',
        finalConfidence: 0.95,
        invoice: {
          id: 'invoice-123',
          userId: 'user-123',
          status: 'under_review',
        },
      };

      mockPrisma.reviewTask.findUnique.mockResolvedValue(mockReviewTask);
      mockPrisma.invoice.update.mockResolvedValue({
        ...mockReviewTask.invoice,
        status: 'validated',
        extractionConfidence: 0.95,
      });

      const result = await service.processReviewCompletion(reviewTaskId, {
        approved: true,
        finalConfidence: 0.95,
        reviewNotes: 'All fields verified',
        continueProcessing: true,
      });

      expect(result).toEqual({
        success: true,
        invoiceId: 'invoice-123',
        nextStage: 'processing',
        updatedConfidence: 0.95,
        processingContinued: true,
      });

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-123' },
        data: {
          status: 'validated',
          extractionConfidence: 0.95,
          validationStatus: 'passed',
        },
      });
    });

    it('should handle review rejection', async () => {
      const reviewTaskId = 'task-456';
      const mockReviewTask = {
        id: reviewTaskId,
        invoiceId: 'invoice-456',
        status: 'completed',
        finalConfidence: 0.3,
        invoice: {
          id: 'invoice-456',
          userId: 'user-123',
          status: 'under_review',
        },
      };

      mockPrisma.reviewTask.findUnique.mockResolvedValue(mockReviewTask);
      mockPrisma.invoice.update.mockResolvedValue({
        ...mockReviewTask.invoice,
        status: 'rejected',
      });

      const result = await service.processReviewCompletion(reviewTaskId, {
        approved: false,
        rejectionReason: 'Insufficient data quality',
        continueProcessing: false,
      });

      expect(result).toEqual({
        success: true,
        invoiceId: 'invoice-456',
        nextStage: 'rejected',
        processingContinued: false,
        rejectionReason: 'Insufficient data quality',
      });

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-456' },
        data: {
          status: 'rejected',
          validationStatus: 'failed',
        },
      });
    });
  });

  describe('getReviewPipelineStatus', () => {
    it('should return comprehensive pipeline status', async () => {
      const userId = 'user-123';
      const mockInvoices = [
        { id: 'inv-1', status: 'under_review', extractionConfidence: 0.6 },
      ];
      const mockReviewTasks = [
        { id: 'task-1', status: 'pending', priority: 'high' },
        { id: 'task-2', status: 'completed', priority: 'medium' },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.reviewTask.findMany.mockResolvedValue(mockReviewTasks);

      const result = await service.getReviewPipelineStatus(userId);

      expect(result).toEqual({
        totalInvoicesInReview: 1,
        completedReviews: 1,
        pendingReviews: 1,
        averageReviewTime: expect.any(Number),
        priorityBreakdown: {
          high: 1,
          medium: 1,
          low: 0,
        },
        throughputMetrics: {
          reviewsPerDay: expect.any(Number),
          averageConfidence: 0.6,
        },
      });
    });
  });
});
