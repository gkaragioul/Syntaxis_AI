import { ManualReviewComponentService } from '../../services/manual-review-component.service';
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

// Mock PrismaClient
const mockPrisma = {
  manualReview: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  reviewTask: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  invoice: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  reviewComment: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Manual Review Component Service', () => {
  let reviewService: ManualReviewComponentService;
  let testUserId: string;
  let testReviewerId: string;
  let testInvoiceId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    reviewService = new ManualReviewComponentService(mockPrisma);
    testUserId = uuidv4();
    testReviewerId = uuidv4();
    testInvoiceId = uuidv4();
  });

  describe('Low-Confidence Invoice Detection', () => {
    it('should identify invoices requiring manual review', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          extractionConfidence: 0.65,
          validationStatus: 'failed',
          status: 'extracted',
          vendorName: 'ABC Corp',
          totalAmount: 1000,
        },
        {
          id: uuidv4(),
          extractionConfidence: 0.45,
          validationStatus: 'warning',
          status: 'extracted',
          vendorName: 'XYZ Inc',
          totalAmount: 2000,
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);

      const result = await reviewService.identifyInvoicesForReview({
        confidenceThreshold: 0.8,
        includeValidationFailures: true,
        includeWarnings: true,
        userId: testUserId,
      });

      expect(result.invoicesRequiringReview).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.averageConfidence).toBe(0.55);
      expect(result.priorityLevels.high).toBe(1); // confidence < 0.5
      expect(result.priorityLevels.medium).toBe(1); // confidence 0.5-0.8
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith({
        where: {
          userId: testUserId,
          OR: [
            { extractionConfidence: { lt: 0.8 } },
            { validationStatus: 'failed' },
            { validationStatus: 'warning' },
          ],
          status: { in: ['extracted', 'validated'] },
        },
        include: expect.any(Object),
      });
    });

    it('should categorize review priorities correctly', async () => {
      const mockInvoices = [
        { id: uuidv4(), extractionConfidence: 0.3, totalAmount: 5000 }, // High priority
        { id: uuidv4(), extractionConfidence: 0.6, totalAmount: 1000 }, // Medium priority
        { id: uuidv4(), extractionConfidence: 0.75, totalAmount: 500 }, // Low priority
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);

      const result = await reviewService.categorizeReviewPriorities(mockInvoices);

      expect(result.high).toHaveLength(1);
      expect(result.medium).toHaveLength(1);
      expect(result.low).toHaveLength(1);
      expect(result.high[0].extractionConfidence).toBe(0.3);
      expect(result.medium[0].extractionConfidence).toBe(0.6);
      expect(result.low[0].extractionConfidence).toBe(0.75);
    });

    it('should apply custom review criteria', async () => {
      const customCriteria = {
        confidenceThreshold: 0.9,
        amountThreshold: 10000,
        vendorWhitelist: ['Trusted Vendor'],
        requireReviewForNewVendors: true,
      };

      const result = await reviewService.applyCustomReviewCriteria(testUserId, customCriteria);

      expect(result.criteriaApplied).toBe(true);
      expect(result.affectedInvoices).toBeDefined();
      expect(result.newReviewTasks).toBeDefined();
    });
  });

  describe('Manual Review Task Creation', () => {
    it('should create manual review task for low-confidence invoice', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        userId: testUserId,
        extractionConfidence: 0.65,
        vendorName: 'ABC Corporation',
        totalAmount: 1500,
        extractedFields: {
          invoiceNumber: { value: 'INV-001', confidence: 0.8 },
          vendorName: { value: 'ABC Corporation', confidence: 0.9 },
          totalAmount: { value: 1500, confidence: 0.4 },
          invoiceDate: { value: '2024-03-15', confidence: 0.7 },
        },
      };

      const mockReviewTask = {
        id: uuidv4(),
        invoiceId: testInvoiceId,
        assignedTo: testReviewerId,
        priority: 'medium',
        status: 'pending',
        createdAt: new Date(),
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.reviewTask.create.mockResolvedValue(mockReviewTask);

      const result = await reviewService.createReviewTask(testInvoiceId, {
        assignedTo: testReviewerId,
        priority: 'medium',
        reviewType: 'field_validation',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        instructions: 'Please verify all extracted fields',
      });

      expect(result.success).toBe(true);
      expect(result.reviewTaskId).toBe(mockReviewTask.id);
      expect(result.fieldsRequiringReview).toContain('totalAmount');
      expect(result.estimatedReviewTime).toBeDefined();
      expect(mockPrisma.reviewTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceId: testInvoiceId,
          assignedTo: testReviewerId,
          priority: 'medium',
          reviewType: 'field_validation',
        }),
      });
    });

    it('should assign review tasks based on reviewer workload', async () => {
      const mockReviewers = [
        { id: uuidv4(), name: 'Reviewer 1', currentWorkload: 5, maxCapacity: 10 },
        { id: uuidv4(), name: 'Reviewer 2', currentWorkload: 8, maxCapacity: 10 },
        { id: uuidv4(), name: 'Reviewer 3', currentWorkload: 2, maxCapacity: 10 },
      ];

      const result = await reviewService.assignOptimalReviewer(testInvoiceId, {
        reviewers: mockReviewers,
        considerExpertise: true,
        balanceWorkload: true,
      });

      expect(result.assignedReviewer).toBe(mockReviewers[2].id); // Lowest workload
      expect(result.workloadBalance).toBeDefined();
      expect(result.estimatedCompletionTime).toBeDefined();
    });

    it('should create review tasks in bulk for multiple invoices', async () => {
      const invoiceIds = [uuidv4(), uuidv4(), uuidv4()];
      const mockReviewTasks = invoiceIds.map(id => ({
        id: uuidv4(),
        invoiceId: id,
        status: 'pending',
      }));

      mockPrisma.reviewTask.create.mockResolvedValueOnce(mockReviewTasks[0]);
      mockPrisma.reviewTask.create.mockResolvedValueOnce(mockReviewTasks[1]);
      mockPrisma.reviewTask.create.mockResolvedValueOnce(mockReviewTasks[2]);

      const result = await reviewService.createBulkReviewTasks(invoiceIds, {
        assignmentStrategy: 'round_robin',
        priority: 'medium',
        reviewType: 'field_validation',
      });

      expect(result.success).toBe(true);
      expect(result.createdTasks).toBe(3);
      expect(result.failedTasks).toBe(0);
      expect(result.taskIds).toHaveLength(3);
    });
  });

  describe('Field-by-Field Review Interface', () => {
    it('should provide field review data with confidence indicators', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        extractedFields: {
          invoiceNumber: { value: 'INV-001', confidence: 0.95, needsReview: false },
          vendorName: { value: 'ABC Corp', confidence: 0.85, needsReview: false },
          totalAmount: { value: 1500, confidence: 0.45, needsReview: true },
          invoiceDate: { value: '2024-03-15', confidence: 0.60, needsReview: true },
          taxAmount: { value: 150, confidence: 0.30, needsReview: true },
        },
        validationResults: {
          totalAmount: { isValid: false, errors: ['Amount seems unusually high'] },
          invoiceDate: { isValid: true, warnings: ['Date format uncertain'] },
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await reviewService.getFieldReviewData(testInvoiceId, testReviewerId);

      expect(result.invoiceId).toBe(testInvoiceId);
      expect(result.fieldsForReview).toHaveLength(3); // totalAmount, invoiceDate, taxAmount
      expect(result.fieldsForReview[0].fieldName).toBe('totalAmount');
      expect(result.fieldsForReview[0].confidence).toBe(0.45);
      expect(result.fieldsForReview[0].needsReview).toBe(true);
      expect(result.fieldsForReview[0].validationIssues).toContain('Amount seems unusually high');
      expect(result.confidenceDistribution).toBeDefined();
      expect(result.reviewGuidelines).toBeDefined();
    });

    it('should provide field editing capabilities', async () => {
      const fieldUpdate = {
        fieldName: 'totalAmount',
        oldValue: 1500,
        newValue: 1200,
        confidence: 0.95,
        reviewerNotes: 'Corrected based on line items calculation',
        validationOverride: true,
      };

      const result = await reviewService.updateFieldValue(
        testInvoiceId,
        testReviewerId,
        fieldUpdate
      );

      expect(result.success).toBe(true);
      expect(result.fieldUpdated).toBe('totalAmount');
      expect(result.previousValue).toBe(1500);
      expect(result.newValue).toBe(1200);
      expect(result.confidenceImproved).toBe(true);
      expect(result.changeTracked).toBe(true);
    });

    it('should validate field changes against business rules', async () => {
      const fieldUpdate = {
        fieldName: 'totalAmount',
        newValue: -100, // Invalid negative amount
      };

      const result = await reviewService.validateFieldChange(
        testInvoiceId,
        fieldUpdate
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Total amount cannot be negative');
      expect(result.suggestions).toContain('Please enter a positive amount');
    });

    it('should provide field suggestions based on context', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        vendorName: 'ABC Corp',
        extractedFields: {
          vendorName: { value: 'ABC Corp', confidence: 0.6 },
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await reviewService.getFieldSuggestions(
        testInvoiceId,
        'vendorName',
        'ABC Corp'
      );

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions).toContain('ABC Corporation');
      expect(result.suggestions).toContain('ABC Company');
      expect(result.confidenceScores).toBeDefined();
      expect(result.basedOnHistory).toBe(true);
    });
  });

  describe('Confidence Indicators and Visual Cues', () => {
    it('should generate confidence-based visual indicators', async () => {
      const confidenceData = {
        invoiceNumber: 0.95,
        vendorName: 0.85,
        totalAmount: 0.45,
        invoiceDate: 0.60,
        taxAmount: 0.30,
      };

      const result = await reviewService.generateConfidenceIndicators(confidenceData);

      expect(result.invoiceNumber.level).toBe('high');
      expect(result.invoiceNumber.color).toBe('green');
      expect(result.invoiceNumber.icon).toBe('check-circle');
      
      expect(result.totalAmount.level).toBe('low');
      expect(result.totalAmount.color).toBe('red');
      expect(result.totalAmount.icon).toBe('alert-triangle');
      
      expect(result.invoiceDate.level).toBe('medium');
      expect(result.invoiceDate.color).toBe('yellow');
      expect(result.invoiceDate.icon).toBe('help-circle');
    });

    it('should provide confidence improvement tracking', async () => {
      const beforeReview = {
        overallConfidence: 0.65,
        fieldConfidences: {
          invoiceNumber: 0.95,
          totalAmount: 0.45,
          vendorName: 0.85,
        },
      };

      const afterReview = {
        overallConfidence: 0.92,
        fieldConfidences: {
          invoiceNumber: 0.95,
          totalAmount: 0.95, // Improved through review
          vendorName: 0.85,
        },
      };

      const result = await reviewService.trackConfidenceImprovement(
        testInvoiceId,
        beforeReview,
        afterReview
      );

      expect(result.overallImprovement).toBe(0.27); // (0.92 - 0.65) / 0.65
      expect(result.improvedFields).toContain('totalAmount');
      expect(result.fieldImprovements.totalAmount).toBe(1.11); // (0.95 - 0.45) / 0.45
      expect(result.reviewEffectiveness).toBe('high');
    });

    it('should generate review quality metrics', async () => {
      const reviewData = {
        reviewerId: testReviewerId,
        timeSpent: 15 * 60 * 1000, // 15 minutes
        fieldsReviewed: 5,
        fieldsChanged: 2,
        confidenceImprovement: 0.25,
      };

      const result = await reviewService.calculateReviewQualityMetrics(reviewData);

      expect(result.efficiency).toBeDefined(); // fields per minute
      expect(result.accuracy).toBeDefined(); // based on subsequent validations
      expect(result.thoroughness).toBeDefined(); // fields reviewed vs total fields
      expect(result.impactScore).toBeDefined(); // confidence improvement weighted
    });
  });

  describe('Approval Workflow', () => {
    it('should handle review approval with confidence validation', async () => {
      const mockReviewTask = {
        id: uuidv4(),
        invoiceId: testInvoiceId,
        assignedTo: testReviewerId,
        status: 'in_progress',
        reviewedFields: ['totalAmount', 'vendorName', 'invoiceDate'],
      };

      mockPrisma.reviewTask.findUnique.mockResolvedValue(mockReviewTask);
      mockPrisma.reviewTask.update.mockResolvedValue({
        ...mockReviewTask,
        status: 'approved',
        completedAt: new Date(),
      });

      const result = await reviewService.approveReview(
        mockReviewTask.id,
        testReviewerId,
        {
          finalConfidence: 0.95,
          reviewNotes: 'All fields verified and corrected',
          approvalLevel: 'standard',
        }
      );

      expect(result.success).toBe(true);
      expect(result.approvalStatus).toBe('approved');
      expect(result.finalConfidence).toBe(0.95);
      expect(result.nextStage).toBe('processing');
      expect(mockPrisma.reviewTask.update).toHaveBeenCalledWith({
        where: { id: mockReviewTask.id },
        data: expect.objectContaining({
          status: 'approved',
          completedAt: expect.any(Date),
          finalConfidence: 0.95,
        }),
      });
    });

    it('should handle review rejection with feedback', async () => {
      const mockReviewTask = {
        id: uuidv4(),
        invoiceId: testInvoiceId,
        status: 'in_progress',
      };

      mockPrisma.reviewTask.findUnique.mockResolvedValue(mockReviewTask);
      mockPrisma.reviewTask.update.mockResolvedValue({
        ...mockReviewTask,
        status: 'rejected',
      });

      const result = await reviewService.rejectReview(
        mockReviewTask.id,
        testReviewerId,
        {
          rejectionReason: 'Insufficient information to verify fields',
          requiredActions: ['Request additional documentation', 'Contact vendor'],
          escalate: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.rejectionStatus).toBe('rejected');
      expect(result.escalated).toBe(true);
      expect(result.requiredActions).toHaveLength(2);
      expect(result.nextStage).toBe('escalation');
    });

    it('should support multi-level approval workflow', async () => {
      const mockReviewTask = {
        id: uuidv4(),
        invoiceId: testInvoiceId,
        totalAmount: 50000, // High value requiring senior approval
        currentApprovalLevel: 'junior',
      };

      const result = await reviewService.processApprovalWorkflow(
        mockReviewTask.id,
        testReviewerId,
        {
          approvalDecision: 'approve',
          currentLevel: 'junior',
        }
      );

      expect(result.requiresAdditionalApproval).toBe(true);
      expect(result.nextApprovalLevel).toBe('senior');
      expect(result.escalationReason).toBe('High value invoice');
      expect(result.workflowStage).toBe('pending_senior_approval');
    });

    it('should track approval workflow history', async () => {
      const mockWorkflowHistory = [
        {
          stage: 'initial_review',
          reviewer: testReviewerId,
          decision: 'approve',
          timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        },
        {
          stage: 'senior_review',
          reviewer: uuidv4(),
          decision: 'approve',
          timestamp: new Date(),
        },
      ];

      const result = await reviewService.getApprovalWorkflowHistory(testInvoiceId);

      expect(result.workflowStages).toHaveLength(2);
      expect(result.currentStage).toBe('senior_review');
      expect(result.totalProcessingTime).toBeGreaterThan(0);
      expect(result.approvalPath).toBeDefined();
    });
  });

  describe('Review Comments and Collaboration', () => {
    it('should add review comments to fields', async () => {
      const comment = {
        fieldName: 'totalAmount',
        comment: 'This amount seems high, please verify with line items',
        commentType: 'question',
        priority: 'high',
      };

      const mockComment = {
        id: uuidv4(),
        invoiceId: testInvoiceId,
        reviewerId: testReviewerId,
        ...comment,
        createdAt: new Date(),
      };

      mockPrisma.reviewComment.create.mockResolvedValue(mockComment);

      const result = await reviewService.addReviewComment(
        testInvoiceId,
        testReviewerId,
        comment
      );

      expect(result.success).toBe(true);
      expect(result.commentId).toBe(mockComment.id);
      expect(result.notificationSent).toBe(true);
      expect(mockPrisma.reviewComment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceId: testInvoiceId,
          reviewerId: testReviewerId,
          fieldName: 'totalAmount',
          comment: comment.comment,
        }),
      });
    });

    it('should retrieve review comments for invoice', async () => {
      const mockComments = [
        {
          id: uuidv4(),
          fieldName: 'totalAmount',
          comment: 'Amount verified',
          commentType: 'note',
          reviewer: { name: 'John Doe' },
          createdAt: new Date(),
        },
        {
          id: uuidv4(),
          fieldName: 'vendorName',
          comment: 'Vendor name corrected',
          commentType: 'correction',
          reviewer: { name: 'Jane Smith' },
          createdAt: new Date(),
        },
      ];

      mockPrisma.reviewComment.findMany.mockResolvedValue(mockComments);

      const result = await reviewService.getReviewComments(testInvoiceId);

      expect(result.comments).toHaveLength(2);
      expect(result.commentsByField.totalAmount).toHaveLength(1);
      expect(result.commentsByField.vendorName).toHaveLength(1);
      expect(result.commentTypes.note).toBe(1);
      expect(result.commentTypes.correction).toBe(1);
    });

    it('should support comment threading and replies', async () => {
      const parentCommentId = uuidv4();
      const reply = {
        parentCommentId,
        comment: 'I agree, the amount has been verified',
        commentType: 'reply',
      };

      const result = await reviewService.replyToComment(
        testInvoiceId,
        testReviewerId,
        reply
      );

      expect(result.success).toBe(true);
      expect(result.replyId).toBeDefined();
      expect(result.threadUpdated).toBe(true);
      expect(result.parentNotified).toBe(true);
    });
  });

  describe('Review Performance Analytics', () => {
    it('should track reviewer performance metrics', async () => {
      const reviewerMetrics = {
        reviewerId: testReviewerId,
        timeRange: '30d',
      };

      const result = await reviewService.getReviewerPerformanceMetrics(reviewerMetrics);

      expect(result.reviewsCompleted).toBeDefined();
      expect(result.averageReviewTime).toBeDefined();
      expect(result.accuracyScore).toBeDefined();
      expect(result.confidenceImprovement).toBeDefined();
      expect(result.throughputTrend).toBeDefined();
      expect(result.qualityScore).toBeDefined();
    });

    it('should generate review quality reports', async () => {
      const reportParams = {
        timeRange: '7d',
        includeReviewerBreakdown: true,
        includeFieldAccuracy: true,
      };

      const result = await reviewService.generateReviewQualityReport(reportParams);

      expect(result.overallQuality).toBeDefined();
      expect(result.reviewerPerformance).toBeDefined();
      expect(result.fieldAccuracyRates).toBeDefined();
      expect(result.improvementTrends).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should identify review bottlenecks', async () => {
      const result = await reviewService.identifyReviewBottlenecks({
        timeRange: '7d',
        includeWorkloadAnalysis: true,
      });

      expect(result.bottlenecks).toBeDefined();
      expect(result.workloadDistribution).toBeDefined();
      expect(result.averageWaitTime).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });
});
