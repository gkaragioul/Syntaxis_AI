import { BatchProcessingUIService } from '../../services/batch-processing-ui.service';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  statSync: jest.fn(),
}));

// Mock PrismaClient
const mockPrisma = {
  batchJob: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  file: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  invoice: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Batch Processing UI Service', () => {
  let batchService: BatchProcessingUIService;
  let testUserId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    batchService = new BatchProcessingUIService(mockPrisma);
    testUserId = uuidv4();
  });

  describe('Batch Upload Initialization', () => {
    it('should initialize batch upload session', async () => {
      const mockBatchJob = {
        id: uuidv4(),
        userId: testUserId,
        status: 'pending',
        totalFiles: 0,
        processedFiles: 0,
        failedFiles: 0,
        createdAt: new Date(),
      };

      mockPrisma.batchJob.create.mockResolvedValue(mockBatchJob);

      const result = await batchService.initializeBatchUpload(testUserId, {
        batchName: 'Monthly Invoices',
        description: 'Processing monthly invoices for March 2024',
        expectedFileCount: 50,
        processingOptions: {
          autoProcess: true,
          validateOnUpload: true,
          notifyOnCompletion: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.batchId).toBe(mockBatchJob.id);
      expect(result.uploadUrl).toBeDefined();
      expect(result.maxFileSize).toBeDefined();
      expect(result.allowedFormats).toContain('pdf');
      expect(mockPrisma.batchJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: testUserId,
          status: 'pending',
          totalFiles: 50,
          options: expect.any(Object),
        }),
      });
    });

    it('should validate batch upload parameters', async () => {
      const result = await batchService.initializeBatchUpload(testUserId, {
        batchName: '',
        expectedFileCount: -1,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Batch name is required');
      expect(result.errors).toContain('Expected file count must be positive');
    });

    it('should check user upload limits', async () => {
      const mockUser = {
        id: testUserId,
        subscriptionStatus: 'free',
        monthlyLimit: 10,
        invoicesProcessedThisMonth: 8,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await batchService.initializeBatchUpload(testUserId, {
        batchName: 'Large Batch',
        expectedFileCount: 50,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Exceeds monthly upload limit');
      expect(result.remainingUploads).toBe(2);
    });
  });

  describe('File Upload Management', () => {
    it('should handle individual file uploads in batch', async () => {
      const batchId = uuidv4();
      const mockFile = {
        originalname: 'invoice1.pdf',
        buffer: Buffer.from('mock file content'),
        mimetype: 'application/pdf',
        size: 1024,
      };

      const mockCreatedFile = {
        id: uuidv4(),
        filename: 'invoice1.pdf',
        filePath: '/uploads/batch/invoice1.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadStatus: 'completed',
      };

      mockPrisma.file.create.mockResolvedValue(mockCreatedFile);

      const result = await batchService.uploadFileToBatch(batchId, testUserId, mockFile, {
        validateOnUpload: true,
        extractMetadata: true,
        generateThumbnail: false,
      });

      expect(result.success).toBe(true);
      expect(result.fileId).toBe(mockCreatedFile.id);
      expect(result.uploadProgress).toBe(100);
      expect(result.validationResult).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(mockPrisma.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          filename: 'invoice1.pdf',
          userId: testUserId,
          batchJobId: batchId,
        }),
      });
    });

    it('should handle file upload validation errors', async () => {
      const batchId = uuidv4();
      const mockFile = {
        originalname: 'invalid.txt',
        buffer: Buffer.from('text content'),
        mimetype: 'text/plain',
        size: 1024,
      };

      const result = await batchService.uploadFileToBatch(batchId, testUserId, mockFile, {
        validateOnUpload: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unsupported file format');
      expect(result.supportedFormats).toContain('pdf');
    });

    it('should handle file size limits', async () => {
      const batchId = uuidv4();
      const mockFile = {
        originalname: 'large-invoice.pdf',
        buffer: Buffer.alloc(50 * 1024 * 1024), // 50MB
        mimetype: 'application/pdf',
        size: 50 * 1024 * 1024,
      };

      const result = await batchService.uploadFileToBatch(batchId, testUserId, mockFile, {
        maxFileSize: 10 * 1024 * 1024, // 10MB limit
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('File size exceeds limit');
      expect(result.maxAllowedSize).toBe(10 * 1024 * 1024);
    });

    it('should track upload progress for batch', async () => {
      const batchId = uuidv4();
      const mockBatchJob = {
        id: batchId,
        totalFiles: 10,
        processedFiles: 7,
        failedFiles: 1,
        status: 'processing',
      };

      mockPrisma.batchJob.findUnique.mockResolvedValue(mockBatchJob);

      const progress = await batchService.getBatchUploadProgress(batchId, testUserId);

      expect(progress.totalFiles).toBe(10);
      expect(progress.uploadedFiles).toBe(8);
      expect(progress.successfulUploads).toBe(7);
      expect(progress.failedUploads).toBe(1);
      expect(progress.progressPercentage).toBe(80);
      expect(progress.status).toBe('processing');
    });
  });

  describe('Batch Processing Control', () => {
    it('should start batch processing', async () => {
      const batchId = uuidv4();
      const mockBatchJob = {
        id: batchId,
        userId: testUserId,
        status: 'uploaded',
        totalFiles: 5,
        processedFiles: 0,
      };

      const mockFiles = [
        { id: uuidv4(), filename: 'invoice1.pdf', uploadStatus: 'completed' },
        { id: uuidv4(), filename: 'invoice2.pdf', uploadStatus: 'completed' },
        { id: uuidv4(), filename: 'invoice3.pdf', uploadStatus: 'completed' },
      ];

      mockPrisma.batchJob.findUnique.mockResolvedValue(mockBatchJob);
      mockPrisma.file.findMany.mockResolvedValue(mockFiles);
      mockPrisma.batchJob.update.mockResolvedValue({
        ...mockBatchJob,
        status: 'processing',
      });

      const result = await batchService.startBatchProcessing(batchId, testUserId, {
        processingPriority: 'high',
        notifyOnCompletion: true,
        autoApproveHighConfidence: true,
        confidenceThreshold: 0.9,
      });

      expect(result.success).toBe(true);
      expect(result.processingJobId).toBeDefined();
      expect(result.estimatedCompletionTime).toBeDefined();
      expect(result.filesToProcess).toBe(3);
      expect(mockPrisma.batchJob.update).toHaveBeenCalledWith({
        where: { id: batchId },
        data: {
          status: 'processing',
          startedAt: expect.any(Date),
        },
      });
    });

    it('should pause batch processing', async () => {
      const batchId = uuidv4();
      const mockBatchJob = {
        id: batchId,
        userId: testUserId,
        status: 'processing',
      };

      mockPrisma.batchJob.findUnique.mockResolvedValue(mockBatchJob);
      mockPrisma.batchJob.update.mockResolvedValue({
        ...mockBatchJob,
        status: 'paused',
      });

      const result = await batchService.pauseBatchProcessing(batchId, testUserId);

      expect(result.success).toBe(true);
      expect(result.status).toBe('paused');
      expect(result.canResume).toBe(true);
      expect(mockPrisma.batchJob.update).toHaveBeenCalledWith({
        where: { id: batchId },
        data: {
          status: 'paused',
          pausedAt: expect.any(Date),
        },
      });
    });

    it('should resume batch processing', async () => {
      const batchId = uuidv4();
      const mockBatchJob = {
        id: batchId,
        userId: testUserId,
        status: 'paused',
        pausedAt: new Date(),
      };

      mockPrisma.batchJob.findUnique.mockResolvedValue(mockBatchJob);
      mockPrisma.batchJob.update.mockResolvedValue({
        ...mockBatchJob,
        status: 'processing',
      });

      const result = await batchService.resumeBatchProcessing(batchId, testUserId);

      expect(result.success).toBe(true);
      expect(result.status).toBe('processing');
      expect(result.resumedAt).toBeDefined();
      expect(mockPrisma.batchJob.update).toHaveBeenCalledWith({
        where: { id: batchId },
        data: {
          status: 'processing',
          resumedAt: expect.any(Date),
        },
      });
    });

    it('should cancel batch processing', async () => {
      const batchId = uuidv4();
      const mockBatchJob = {
        id: batchId,
        userId: testUserId,
        status: 'processing',
      };

      mockPrisma.batchJob.findUnique.mockResolvedValue(mockBatchJob);
      mockPrisma.batchJob.update.mockResolvedValue({
        ...mockBatchJob,
        status: 'cancelled',
      });

      const result = await batchService.cancelBatchProcessing(batchId, testUserId, {
        reason: 'User requested cancellation',
        cleanupFiles: true,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('cancelled');
      expect(result.filesCleanedUp).toBe(true);
      expect(mockPrisma.batchJob.update).toHaveBeenCalledWith({
        where: { id: batchId },
        data: {
          status: 'cancelled',
          cancelledAt: expect.any(Date),
          cancellationReason: 'User requested cancellation',
        },
      });
    });
  });

  describe('Real-time Progress Tracking', () => {
    it('should provide real-time processing updates', async () => {
      const batchId = uuidv4();
      const mockBatchJob = {
        id: batchId,
        totalFiles: 10,
        processedFiles: 6,
        failedFiles: 1,
        status: 'processing',
        startedAt: new Date(Date.now() - 300000), // 5 minutes ago
      };

      mockPrisma.batchJob.findUnique.mockResolvedValue(mockBatchJob);

      const status = await batchService.getBatchProcessingStatus(batchId, testUserId);

      expect(status.batchId).toBe(batchId);
      expect(status.status).toBe('processing');
      expect(status.progress.total).toBe(10);
      expect(status.progress.completed).toBe(6);
      expect(status.progress.failed).toBe(1);
      expect(status.progress.percentage).toBe(70);
      expect(status.timing.elapsed).toBeGreaterThan(0);
      expect(status.timing.estimated).toBeGreaterThan(0);
      expect(status.currentFile).toBeDefined();
    });

    it('should provide detailed file processing status', async () => {
      const batchId = uuidv4();
      const mockFiles = [
        {
          id: uuidv4(),
          filename: 'invoice1.pdf',
          processingStatus: 'completed',
          extractionConfidence: 0.95,
          validationStatus: 'passed',
        },
        {
          id: uuidv4(),
          filename: 'invoice2.pdf',
          processingStatus: 'processing',
          extractionProgress: 75,
          currentStage: 'field_extraction',
        },
        {
          id: uuidv4(),
          filename: 'invoice3.pdf',
          processingStatus: 'failed',
          errorMessage: 'OCR processing failed',
          retryable: true,
        },
      ];

      mockPrisma.file.findMany.mockResolvedValue(mockFiles);

      const fileStatuses = await batchService.getBatchFileStatuses(batchId, testUserId);

      expect(fileStatuses).toHaveLength(3);
      expect(fileStatuses[0].status).toBe('completed');
      expect(fileStatuses[0].confidence).toBe(0.95);
      expect(fileStatuses[1].status).toBe('processing');
      expect(fileStatuses[1].progress).toBe(75);
      expect(fileStatuses[2].status).toBe('failed');
      expect(fileStatuses[2].retryable).toBe(true);
    });

    it('should calculate accurate time estimates', async () => {
      const batchId = uuidv4();
      const mockBatchJob = {
        id: batchId,
        totalFiles: 20,
        processedFiles: 8,
        startedAt: new Date(Date.now() - 480000), // 8 minutes ago
        status: 'processing',
      };

      mockPrisma.batchJob.findUnique.mockResolvedValue(mockBatchJob);

      const estimates = await batchService.calculateProcessingEstimates(batchId);

      expect(estimates.averageTimePerFile).toBe(60000); // 1 minute per file
      expect(estimates.remainingFiles).toBe(12);
      expect(estimates.estimatedRemainingTime).toBe(720000); // 12 minutes
      expect(estimates.estimatedCompletionTime).toBeDefined();
      expect(estimates.confidence).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle individual file processing errors', async () => {
      const batchId = uuidv4();
      const fileId = uuidv4();
      const error = new Error('OCR processing failed');

      const result = await batchService.handleFileProcessingError(
        batchId,
        fileId,
        error,
        {
          retryAttempts: 2,
          escalateAfterRetries: true,
          notifyUser: true,
        }
      );

      expect(result.errorHandled).toBe(true);
      expect(result.retryScheduled).toBe(true);
      expect(result.retryAttempt).toBe(1);
      expect(result.maxRetries).toBe(2);
      expect(result.userNotified).toBe(true);
    });

    it('should implement retry logic for failed files', async () => {
      const batchId = uuidv4();
      const fileId = uuidv4();
      const mockFile = {
        id: fileId,
        filename: 'problematic-invoice.pdf',
        processingStatus: 'failed',
        retryCount: 1,
        maxRetries: 3,
      };

      mockPrisma.file.findUnique.mockResolvedValue(mockFile);

      const result = await batchService.retryFileProcessing(batchId, fileId, testUserId, {
        resetProcessingState: true,
        useAlternativeMethod: true,
      });

      expect(result.success).toBe(true);
      expect(result.retryAttempt).toBe(2);
      expect(result.alternativeMethodUsed).toBe(true);
      expect(result.processingRestarted).toBe(true);
    });

    it('should provide batch error summary', async () => {
      const batchId = uuidv4();
      const mockErrors = [
        {
          fileId: uuidv4(),
          filename: 'invoice1.pdf',
          errorType: 'ocr_failure',
          errorMessage: 'Poor image quality',
          retryable: true,
        },
        {
          fileId: uuidv4(),
          filename: 'invoice2.pdf',
          errorType: 'validation_error',
          errorMessage: 'Invalid invoice format',
          retryable: false,
        },
      ];

      const summary = await batchService.getBatchErrorSummary(batchId, testUserId);

      expect(summary.totalErrors).toBe(2);
      expect(summary.retryableErrors).toBe(1);
      expect(summary.permanentErrors).toBe(1);
      expect(summary.errorsByType.ocr_failure).toBe(1);
      expect(summary.errorsByType.validation_error).toBe(1);
      expect(summary.recommendations).toContain('Retry failed OCR processing');
    });
  });

  describe('Batch Operations and Bulk Actions', () => {
    it('should support bulk file operations', async () => {
      const batchId = uuidv4();
      const fileIds = [uuidv4(), uuidv4(), uuidv4()];

      const result = await batchService.performBulkFileOperation(
        batchId,
        testUserId,
        'reprocess',
        fileIds,
        {
          processingOptions: {
            useHighAccuracyMode: true,
            skipValidation: false,
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.operationType).toBe('reprocess');
      expect(result.affectedFiles).toBe(3);
      expect(result.operationId).toBeDefined();
      expect(result.estimatedCompletionTime).toBeDefined();
    });

    it('should support batch approval workflows', async () => {
      const batchId = uuidv4();
      const mockInvoices = [
        { id: uuidv4(), status: 'pending_review', confidence: 0.95 },
        { id: uuidv4(), status: 'pending_review', confidence: 0.88 },
        { id: uuidv4(), status: 'pending_review', confidence: 0.92 },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);

      const result = await batchService.performBatchApproval(
        batchId,
        testUserId,
        {
          approvalCriteria: {
            minimumConfidence: 0.9,
            requireManualReview: false,
          },
          approvalAction: 'auto_approve',
        }
      );

      expect(result.success).toBe(true);
      expect(result.approvedInvoices).toBe(2); // Only those with confidence >= 0.9
      expect(result.pendingReview).toBe(1);
      expect(result.approvalSummary).toBeDefined();
    });

    it('should generate batch processing reports', async () => {
      const batchId = uuidv4();
      const mockBatchJob = {
        id: batchId,
        totalFiles: 50,
        processedFiles: 48,
        failedFiles: 2,
        status: 'completed',
        startedAt: new Date(Date.now() - 3600000), // 1 hour ago
        completedAt: new Date(),
      };

      mockPrisma.batchJob.findUnique.mockResolvedValue(mockBatchJob);

      const report = await batchService.generateBatchReport(batchId, testUserId, {
        includeFileDetails: true,
        includeErrorAnalysis: true,
        includePerformanceMetrics: true,
      });

      expect(report.batchId).toBe(batchId);
      expect(report.summary.totalFiles).toBe(50);
      expect(report.summary.successRate).toBe(96); // 48/50 * 100
      expect(report.performance.totalProcessingTime).toBe(3600000);
      expect(report.performance.averageTimePerFile).toBe(75000); // 1 hour / 48 files
      expect(report.errors).toHaveLength(2);
      expect(report.recommendations).toBeDefined();
    });
  });

  describe('User Interface Integration', () => {
    it('should provide UI state management', async () => {
      const batchId = uuidv4();
      
      const uiState = await batchService.getBatchUIState(batchId, testUserId);

      expect(uiState.batchId).toBe(batchId);
      expect(uiState.currentView).toBeDefined();
      expect(uiState.availableActions).toBeDefined();
      expect(uiState.progressIndicators).toBeDefined();
      expect(uiState.notifications).toBeDefined();
      expect(uiState.errorAlerts).toBeDefined();
    });

    it('should support UI action validation', async () => {
      const batchId = uuidv4();
      const action = 'start_processing';

      const validation = await batchService.validateUIAction(batchId, testUserId, action);

      expect(validation.allowed).toBeDefined();
      expect(validation.reason).toBeDefined();
      expect(validation.requirements).toBeDefined();
      expect(validation.warnings).toBeDefined();
    });

    it('should provide real-time UI updates', async () => {
      const batchId = uuidv4();
      
      const updates = await batchService.getUIUpdates(batchId, testUserId, {
        lastUpdateTimestamp: new Date(Date.now() - 30000), // 30 seconds ago
        includeProgressUpdates: true,
        includeStatusChanges: true,
        includeErrorNotifications: true,
      });

      expect(updates.hasUpdates).toBeDefined();
      expect(updates.progressUpdates).toBeDefined();
      expect(updates.statusChanges).toBeDefined();
      expect(updates.errorNotifications).toBeDefined();
      expect(updates.nextUpdateInterval).toBeDefined();
    });
  });
});
