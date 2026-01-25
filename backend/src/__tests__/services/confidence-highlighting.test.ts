import { ConfidenceHighlightingService } from '../../services/confidence-highlighting.service';
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
  invoice: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  confidenceThreshold: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Confidence Highlighting Service', () => {
  let highlightingService: ConfidenceHighlightingService;
  let testUserId: string;
  let testInvoiceId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    highlightingService = new ConfidenceHighlightingService(mockPrisma);
    testUserId = uuidv4();
    testInvoiceId = uuidv4();
  });

  describe('Confidence Level Calculation', () => {
    it('should calculate confidence levels for invoice fields', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        extractionConfidence: 0.75,
        fieldConfidences: {
          invoiceNumber: 0.95,
          vendorName: 0.85,
          totalAmount: 0.45,
          invoiceDate: 0.6,
          taxAmount: 0.3,
          lineItems: 0.7,
        },
        validationResults: {
          totalAmount: { isValid: false, confidence: 0.4 },
          invoiceDate: { isValid: true, confidence: 0.65 },
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result =
        await highlightingService.calculateConfidenceLevels(testInvoiceId);

      expect(result.overallConfidence).toBe(0.75);
      expect(result.fieldLevels.invoiceNumber.level).toBe('high');
      expect(result.fieldLevels.invoiceNumber.confidence).toBe(0.95);
      expect(result.fieldLevels.totalAmount.level).toBe('low');
      expect(result.fieldLevels.totalAmount.confidence).toBe(0.45);
      expect(result.fieldLevels.invoiceDate.level).toBe('medium');
      expect(result.fieldLevels.invoiceDate.confidence).toBe(0.6);
      expect(result.criticalFields).toContain('totalAmount');
      expect(result.criticalFields).toContain('taxAmount');
    });

    it('should apply custom confidence thresholds', async () => {
      const customThresholds = {
        high: 0.9,
        medium: 0.7,
        low: 0.0,
      };

      const mockInvoice = {
        id: testInvoiceId,
        fieldConfidences: {
          vendorName: 0.85, // Would be high with default, medium with custom
          totalAmount: 0.75, // Would be medium with default, medium with custom
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await highlightingService.calculateConfidenceLevels(
        testInvoiceId,
        { customThresholds },
      );

      expect(result.fieldLevels.vendorName.level).toBe('medium'); // 0.85 < 0.9
      expect(result.fieldLevels.totalAmount.level).toBe('medium'); // 0.75 >= 0.7
      expect(result.thresholdsUsed).toEqual(customThresholds);
    });

    it('should handle missing confidence data gracefully', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        extractionConfidence: null,
        fieldConfidences: null,
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result =
        await highlightingService.calculateConfidenceLevels(testInvoiceId);

      expect(result.overallConfidence).toBe(0);
      expect(result.fieldLevels).toEqual({});
      expect(result.hasConfidenceData).toBe(false);
      expect(result.requiresManualReview).toBe(true);
    });
  });

  describe('Visual Highlighting Configuration', () => {
    it('should generate visual highlighting styles for confidence levels', async () => {
      const confidenceData = {
        invoiceNumber: { level: 'high', confidence: 0.95 },
        vendorName: { level: 'medium', confidence: 0.75 },
        totalAmount: { level: 'low', confidence: 0.45 },
        taxAmount: { level: 'critical', confidence: 0.25 },
      };

      const result =
        await highlightingService.generateHighlightingStyles(confidenceData);

      expect(result.invoiceNumber.backgroundColor).toBe('#e8f5e8');
      expect(result.invoiceNumber.borderColor).toBe('#4caf50');
      expect(result.invoiceNumber.textColor).toBe('#2e7d32');
      expect(result.invoiceNumber.icon).toBe('check-circle');

      expect(result.vendorName.backgroundColor).toBe('#fff3cd');
      expect(result.vendorName.borderColor).toBe('#ffc107');
      expect(result.vendorName.textColor).toBe('#856404');
      expect(result.vendorName.icon).toBe('help-circle');

      expect(result.totalAmount.backgroundColor).toBe('#f8d7da');
      expect(result.totalAmount.borderColor).toBe('#dc3545');
      expect(result.totalAmount.textColor).toBe('#721c24');
      expect(result.totalAmount.icon).toBe('alert-triangle');

      expect(result.taxAmount.backgroundColor).toBe('#f5c6cb');
      expect(result.taxAmount.borderColor).toBe('#dc3545');
      expect(result.taxAmount.textColor).toBe('#721c24');
      expect(result.taxAmount.icon).toBe('x-circle');
      expect(result.taxAmount.pulse).toBe(true);
    });

    it('should support custom color schemes', async () => {
      const confidenceData = {
        totalAmount: { level: 'low', confidence: 0.45 },
      };

      const customColorScheme = {
        low: {
          backgroundColor: '#ffebee',
          borderColor: '#f44336',
          textColor: '#c62828',
        },
      };

      const result = await highlightingService.generateHighlightingStyles(
        confidenceData,
        { colorScheme: customColorScheme },
      );

      expect(result.totalAmount.backgroundColor).toBe('#ffebee');
      expect(result.totalAmount.borderColor).toBe('#f44336');
      expect(result.totalAmount.textColor).toBe('#c62828');
    });

    it('should generate accessibility-compliant styles', async () => {
      const confidenceData = {
        vendorName: { level: 'medium', confidence: 0.75 },
      };

      const result = await highlightingService.generateHighlightingStyles(
        confidenceData,
        { accessibilityMode: true },
      );

      expect(result.vendorName.ariaLabel).toBeDefined();
      expect(result.vendorName.ariaLabel).toContain('medium confidence');
      expect(result.vendorName.contrastRatio).toBeGreaterThanOrEqual(4.5);
      expect(result.vendorName.pattern).toBeDefined(); // For colorblind users
    });
  });

  describe('Dynamic Highlighting Updates', () => {
    it('should update highlighting when confidence changes', async () => {
      const originalConfidence = {
        totalAmount: { level: 'low', confidence: 0.45 },
      };

      const updatedConfidence = {
        totalAmount: { level: 'high', confidence: 0.95 },
      };

      const result = await highlightingService.updateHighlighting(
        testInvoiceId,
        originalConfidence,
        updatedConfidence,
      );

      expect(result.updated).toBe(true);
      expect(result.changedFields).toContain('totalAmount');
      expect(result.improvements.totalAmount.from).toBe('low');
      expect(result.improvements.totalAmount.to).toBe('high');
      expect(result.improvements.totalAmount.confidenceIncrease).toBe(0.5);
    });

    it('should handle real-time confidence updates', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        fieldConfidences: {
          totalAmount: 0.45,
          vendorName: 0.85,
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const newConfidences = {
        totalAmount: 0.92,
        vendorName: 0.88,
      };

      const result = await highlightingService.updateRealTimeConfidence(
        testInvoiceId,
        newConfidences,
      );

      expect(result.success).toBe(true);
      expect(result.updatedFields).toContain('totalAmount');
      expect(result.highlightingChanged).toBe(true);
      expect(result.newHighlighting.totalAmount.level).toBe('high');
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: testInvoiceId },
        data: {
          fieldConfidences: newConfidences,
          lastConfidenceUpdate: expect.any(Date),
        },
      });
    });

    it('should batch confidence updates for performance', async () => {
      const batchUpdates = [
        { invoiceId: testInvoiceId, field: 'totalAmount', confidence: 0.95 },
        { invoiceId: testInvoiceId, field: 'vendorName', confidence: 0.88 },
        { invoiceId: uuidv4(), field: 'invoiceDate', confidence: 0.75 },
      ];

      const result =
        await highlightingService.batchUpdateConfidence(batchUpdates);

      expect(result.success).toBe(true);
      expect(result.processedUpdates).toBe(3);
      expect(result.affectedInvoices).toBe(2);
      expect(result.highlightingUpdates).toHaveLength(2);
    });
  });

  describe('Confidence Threshold Management', () => {
    it('should manage user-specific confidence thresholds', async () => {
      const userThresholds = {
        high: 0.9,
        medium: 0.7,
        low: 0.0,
        critical: 0.3,
      };

      const mockThreshold = {
        id: uuidv4(),
        userId: testUserId,
        thresholds: userThresholds,
      };

      mockPrisma.confidenceThreshold.create.mockResolvedValue(mockThreshold);

      const result = await highlightingService.setUserConfidenceThresholds(
        testUserId,
        userThresholds,
      );

      expect(result.success).toBe(true);
      expect(result.thresholds).toEqual(userThresholds);
      expect(mockPrisma.confidenceThreshold.create).toHaveBeenCalledWith({
        data: {
          userId: testUserId,
          thresholds: userThresholds,
          createdAt: expect.any(Date),
        },
      });
    });

    it('should retrieve user confidence thresholds', async () => {
      const mockThresholds = [
        {
          id: uuidv4(),
          userId: testUserId,
          thresholds: {
            high: 0.85,
            medium: 0.65,
            low: 0.0,
          },
          createdAt: new Date(),
        },
      ];

      mockPrisma.confidenceThreshold.findMany.mockResolvedValue(mockThresholds);

      const result =
        await highlightingService.getUserConfidenceThresholds(testUserId);

      expect(result.thresholds).toEqual(mockThresholds[0].thresholds);
      expect(result.isCustom).toBe(true);
      expect(result.lastUpdated).toBeDefined();
    });

    it('should use default thresholds when user has none set', async () => {
      mockPrisma.confidenceThreshold.findMany.mockResolvedValue([]);

      const result =
        await highlightingService.getUserConfidenceThresholds(testUserId);

      expect(result.thresholds).toEqual({
        high: 0.8,
        medium: 0.5,
        low: 0.0,
        critical: 0.3,
      });
      expect(result.isCustom).toBe(false);
      expect(result.isDefault).toBe(true);
    });
  });

  describe('Highlighting in Different Views', () => {
    it('should generate highlighting for invoice list view', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          extractionConfidence: 0.95,
          status: 'processed',
        },
        {
          id: uuidv4(),
          invoiceNumber: 'INV-002',
          extractionConfidence: 0.45,
          status: 'needs_review',
        },
        {
          id: uuidv4(),
          invoiceNumber: 'INV-003',
          extractionConfidence: 0.75,
          status: 'validated',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);

      const result = await highlightingService.generateListViewHighlighting(
        testUserId,
        { includeStatusIndicators: true },
      );

      expect(result.invoices).toHaveLength(3);
      expect(result.invoices[0].highlighting.level).toBe('high');
      expect(result.invoices[0].highlighting.statusIndicator).toBe('success');
      expect(result.invoices[1].highlighting.level).toBe('low');
      expect(result.invoices[1].highlighting.statusIndicator).toBe('warning');
      expect(result.invoices[2].highlighting.level).toBe('medium');
      expect(result.summary.highConfidence).toBe(1);
      expect(result.summary.lowConfidence).toBe(1);
      expect(result.summary.needsReview).toBe(1);
    });

    it('should generate highlighting for detail view', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        fieldConfidences: {
          invoiceNumber: 0.95,
          vendorName: 0.85,
          totalAmount: 0.45,
          invoiceDate: 0.6,
          lineItems: 0.7,
        },
        lineItems: [
          { id: uuidv4(), description: 'Item 1', confidence: 0.8 },
          { id: uuidv4(), description: 'Item 2', confidence: 0.4 },
        ],
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result =
        await highlightingService.generateDetailViewHighlighting(testInvoiceId);

      expect(result.headerFields.invoiceNumber.level).toBe('high');
      expect(result.headerFields.totalAmount.level).toBe('low');
      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems[0].highlighting.level).toBe('medium');
      expect(result.lineItems[1].highlighting.level).toBe('low');
      expect(result.focusAreas).toContain('totalAmount');
      expect(result.reviewRecommendations).toContain(
        'Verify total amount calculation',
      );
    });

    it('should generate highlighting for dashboard view', async () => {
      const mockStats = {
        totalInvoices: 100,
        highConfidenceCount: 70,
        mediumConfidenceCount: 20,
        lowConfidenceCount: 10,
        averageConfidence: 0.78,
      };

      const result = await highlightingService.generateDashboardHighlighting(
        testUserId,
        mockStats,
      );

      expect(result.overallHealth.level).toBe('good');
      expect(result.overallHealth.color).toBe('green');
      expect(result.confidenceDistribution.high.percentage).toBe(70);
      expect(result.confidenceDistribution.medium.percentage).toBe(20);
      expect(result.confidenceDistribution.low.percentage).toBe(10);
      expect(result.alerts).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });

  describe('Interactive Highlighting Features', () => {
    it('should support hover effects for confidence details', async () => {
      const fieldData = {
        fieldName: 'totalAmount',
        confidence: 0.45,
        level: 'low',
        validationIssues: ['Amount seems unusually high'],
      };

      const result = await highlightingService.generateHoverTooltip(fieldData);

      expect(result.title).toBe('Total Amount - Low Confidence');
      expect(result.confidence).toBe('45%');
      expect(result.description).toContain('This field has low confidence');
      expect(result.issues).toContain('Amount seems unusually high');
      expect(result.suggestions).toContain('Manual review recommended');
      expect(result.actions).toContain('Edit field');
      expect(result.actions).toContain('Mark as reviewed');
    });

    it('should provide click actions for highlighted fields', async () => {
      const fieldData = {
        invoiceId: testInvoiceId,
        fieldName: 'vendorName',
        confidence: 0.65,
        level: 'medium',
      };

      const result = await highlightingService.generateClickActions(fieldData);

      expect(result.primaryAction).toBe('edit');
      expect(result.actions).toContainEqual({
        type: 'edit',
        label: 'Edit Field',
        icon: 'edit',
      });
      expect(result.actions).toContainEqual({
        type: 'review',
        label: 'Start Review',
        icon: 'eye',
      });
      expect(result.actions).toContainEqual({
        type: 'history',
        label: 'View History',
        icon: 'clock',
      });
    });

    it('should support keyboard navigation for highlighted fields', async () => {
      const invoiceData = {
        id: testInvoiceId,
        fieldConfidences: {
          invoiceNumber: 0.95,
          vendorName: 0.65,
          totalAmount: 0.45,
          invoiceDate: 0.75,
        },
      };

      const result =
        await highlightingService.generateKeyboardNavigation(invoiceData);

      expect(result.focusOrder).toEqual([
        'totalAmount',
        'vendorName',
        'invoiceDate',
        'invoiceNumber',
      ]);
      expect(result.keyBindings['Tab']).toBe('next_field');
      expect(result.keyBindings['Shift+Tab']).toBe('previous_field');
      expect(result.keyBindings['Enter']).toBe('edit_field');
      expect(result.keyBindings['Space']).toBe('toggle_review');
      expect(result.ariaLabels.totalAmount).toContain('Low confidence');
    });
  });

  describe('Performance and Optimization', () => {
    it('should cache highlighting calculations for performance', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        fieldConfidences: { totalAmount: 0.75 },
        lastConfidenceUpdate: new Date(),
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      // First call should calculate
      const result1 =
        await highlightingService.calculateConfidenceLevels(testInvoiceId);

      // Second call should use cache
      const result2 =
        await highlightingService.calculateConfidenceLevels(testInvoiceId);

      expect(result1).toEqual(result2);
      expect(result2.fromCache).toBe(true);
      expect(mockPrisma.invoice.findUnique).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should handle large datasets efficiently', async () => {
      const largeInvoiceSet = Array.from({ length: 1000 }, (_, i) => ({
        id: uuidv4(),
        extractionConfidence: Math.random(),
        fieldConfidences: {
          totalAmount: Math.random(),
          vendorName: Math.random(),
        },
      }));

      mockPrisma.invoice.findMany.mockResolvedValue(largeInvoiceSet);

      const startTime = Date.now();
      const result = await highlightingService.generateBulkHighlighting(
        testUserId,
        { batchSize: 100 },
      );
      const endTime = Date.now();

      expect(result.processedCount).toBe(1000);
      expect(result.batchesProcessed).toBe(10);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(result.performance.averageTimePerInvoice).toBeLessThan(5); // Less than 5ms per invoice
    });

    it('should optimize highlighting for mobile devices', async () => {
      const confidenceData = {
        totalAmount: { level: 'low', confidence: 0.45 },
        vendorName: { level: 'medium', confidence: 0.75 },
      };

      const result = await highlightingService.generateHighlightingStyles(
        confidenceData,
        {
          mobileOptimized: true,
          reducedAnimations: true,
          simplifiedColors: true,
        },
      );

      expect(result.totalAmount.mobileStyles).toBeDefined();
      expect(result.totalAmount.animation).toBe('none');
      expect(result.totalAmount.touchTarget).toBeGreaterThanOrEqual(44); // Minimum touch target size
      expect(result.vendorName.simplifiedColor).toBe(true);
    });
  });

  describe('Integration with Existing Views', () => {
    it('should integrate with existing invoice list component', async () => {
      const existingInvoiceData = [
        { id: uuidv4(), invoiceNumber: 'INV-001', status: 'processed' },
        { id: uuidv4(), invoiceNumber: 'INV-002', status: 'needs_review' },
      ];

      const result = await highlightingService.enhanceExistingInvoiceList(
        existingInvoiceData,
        testUserId,
      );

      expect(result.enhanced).toBe(true);
      expect(result.invoices).toHaveLength(2);
      expect(result.invoices[0].confidenceHighlighting).toBeDefined();
      expect(result.invoices[0].originalData).toEqual(existingInvoiceData[0]);
      expect(result.cssClasses).toBeDefined();
      expect(result.jsEvents).toBeDefined();
    });

    it('should integrate with existing detail view component', async () => {
      const existingDetailData = {
        id: testInvoiceId,
        invoiceNumber: 'INV-001',
        vendorName: 'ABC Corp',
        totalAmount: 1500,
      };

      const result = await highlightingService.enhanceExistingDetailView(
        existingDetailData,
        testUserId,
      );

      expect(result.enhanced).toBe(true);
      expect(result.fieldHighlighting).toBeDefined();
      expect(result.interactiveElements).toBeDefined();
      expect(result.originalData).toEqual(existingDetailData);
      expect(result.enhancementMetadata.version).toBeDefined();
    });

    it('should provide backward compatibility', async () => {
      const legacyInvoiceData = {
        id: testInvoiceId,
        // Legacy format without confidence data
        fields: {
          invoiceNumber: 'INV-001',
          vendorName: 'ABC Corp',
        },
      };

      const result = await highlightingService.handleLegacyData(
        legacyInvoiceData,
        { enableFallback: true },
      );

      expect(result.compatible).toBe(true);
      expect(result.fallbackHighlighting).toBeDefined();
      expect(result.migrationSuggestions).toBeDefined();
      expect(result.enhancedData.confidenceHighlighting).toBeDefined();
    });
  });
});
