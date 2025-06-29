import { CorrectionToolsService } from '../../services/correction-tools.service';
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
    update: jest.fn(),
  },
  correction: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  correctionTemplate: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Correction Tools Service', () => {
  let correctionService: CorrectionToolsService;
  let testUserId: string;
  let testInvoiceId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    correctionService = new CorrectionToolsService(mockPrisma);
    testUserId = uuidv4();
    testInvoiceId = uuidv4();
  });

  describe('Field Correction Interface', () => {
    it('should provide inline editing capabilities for invoice fields', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        invoiceNumber: 'INV-001',
        vendorName: 'ABC Corp',
        totalAmount: 1500,
        fieldConfidences: {
          invoiceNumber: 0.95,
          vendorName: 0.65,
          totalAmount: 0.45,
        },
        extractedFields: {
          invoiceNumber: { value: 'INV-001', confidence: 0.95, editable: true },
          vendorName: { value: 'ABC Corp', confidence: 0.65, editable: true },
          totalAmount: { value: 1500, confidence: 0.45, editable: true },
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await correctionService.getEditableFields(testInvoiceId, testUserId);

      expect(result.success).toBe(true);
      expect(result.editableFields).toHaveLength(3);
      expect(result.editableFields[0].fieldName).toBe('invoiceNumber');
      expect(result.editableFields[0].currentValue).toBe('INV-001');
      expect(result.editableFields[0].confidence).toBe(0.95);
      expect(result.editableFields[0].editable).toBe(true);
      expect(result.editableFields[0].validationRules).toBeDefined();
      expect(result.editableFields[0].inputType).toBe('text');
    });

    it('should validate field corrections before applying', async () => {
      const correction = {
        fieldName: 'totalAmount',
        oldValue: 1500,
        newValue: -100, // Invalid negative amount
        reason: 'Correcting calculation error',
      };

      const result = await correctionService.validateCorrection(testInvoiceId, correction);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Total amount cannot be negative');
      expect(result.warnings).toHaveLength(0);
      expect(result.suggestions).toContain('Please enter a positive amount');
    });

    it('should apply valid field corrections', async () => {
      const correction = {
        fieldName: 'vendorName',
        oldValue: 'ABC Corp',
        newValue: 'ABC Corporation',
        reason: 'Correcting vendor name format',
        confidence: 0.95,
      };

      const mockInvoice = {
        id: testInvoiceId,
        vendorName: 'ABC Corp',
      };

      const mockCorrection = {
        id: uuidv4(),
        invoiceId: testInvoiceId,
        userId: testUserId,
        fieldName: 'vendorName',
        oldValue: 'ABC Corp',
        newValue: 'ABC Corporation',
        reason: 'Correcting vendor name format',
        status: 'applied',
        createdAt: new Date(),
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.correction.create.mockResolvedValue(mockCorrection);
      mockPrisma.invoice.update.mockResolvedValue({
        ...mockInvoice,
        vendorName: 'ABC Corporation',
      });

      const result = await correctionService.applyCorrection(testInvoiceId, testUserId, correction);

      expect(result.success).toBe(true);
      expect(result.correctionId).toBe(mockCorrection.id);
      expect(result.fieldUpdated).toBe('vendorName');
      expect(result.newValue).toBe('ABC Corporation');
      expect(result.confidenceImproved).toBe(true);
      expect(mockPrisma.correction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceId: testInvoiceId,
          userId: testUserId,
          fieldName: 'vendorName',
          oldValue: 'ABC Corp',
          newValue: 'ABC Corporation',
        }),
      });
    });

    it('should support bulk field corrections', async () => {
      const corrections = [
        {
          fieldName: 'vendorName',
          oldValue: 'ABC Corp',
          newValue: 'ABC Corporation',
          reason: 'Standardizing vendor name',
        },
        {
          fieldName: 'totalAmount',
          oldValue: 1500,
          newValue: 1200,
          reason: 'Correcting calculation error',
        },
      ];

      const result = await correctionService.applyBulkCorrections(
        testInvoiceId,
        testUserId,
        corrections
      );

      expect(result.success).toBe(true);
      expect(result.appliedCorrections).toBe(2);
      expect(result.failedCorrections).toBe(0);
      expect(result.correctionIds).toHaveLength(2);
      expect(result.summary.fieldsUpdated).toContain('vendorName');
      expect(result.summary.fieldsUpdated).toContain('totalAmount');
    });
  });

  describe('Smart Suggestions and Auto-Correction', () => {
    it('should provide smart suggestions for field corrections', async () => {
      const fieldData = {
        fieldName: 'vendorName',
        currentValue: 'ABC Corp',
        confidence: 0.65,
        context: {
          invoiceHistory: ['ABC Corporation', 'ABC Company', 'ABC Corp'],
          similarVendors: ['ABC Corporation', 'XYZ Corp'],
        },
      };

      const result = await correctionService.generateSmartSuggestions(fieldData);

      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions[0].value).toBe('ABC Corporation');
      expect(result.suggestions[0].confidence).toBeGreaterThan(0.8);
      expect(result.suggestions[0].reason).toContain('Most common format');
      expect(result.suggestions[1].value).toBe('ABC Company');
      expect(result.basedOnHistory).toBe(true);
      expect(result.contextualRelevance).toBeGreaterThan(0.7);
    });

    it('should detect and suggest corrections for common patterns', async () => {
      const fieldData = {
        fieldName: 'invoiceDate',
        currentValue: '03/15/24', // Ambiguous date format
        confidence: 0.55,
      };

      const result = await correctionService.detectPatternIssues(fieldData);

      expect(result.issuesDetected).toBe(true);
      expect(result.patterns).toContain('ambiguous_date_format');
      expect(result.suggestions[0].value).toBe('2024-03-15');
      expect(result.suggestions[0].format).toBe('ISO 8601');
      expect(result.autoCorrectible).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should provide auto-correction for high-confidence fixes', async () => {
      const fieldData = {
        fieldName: 'totalAmount',
        currentValue: '1,500.00', // String with formatting
        confidence: 0.45,
        expectedType: 'number',
      };

      const result = await correctionService.suggestAutoCorrection(fieldData);

      expect(result.canAutoCorrect).toBe(true);
      expect(result.suggestedValue).toBe(1500);
      expect(result.correctionType).toBe('format_standardization');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.reasoning).toContain('Converting formatted string to number');
      expect(result.requiresApproval).toBe(false);
    });

    it('should learn from user correction patterns', async () => {
      const userCorrections = [
        { fieldName: 'vendorName', oldValue: 'ABC Corp', newValue: 'ABC Corporation' },
        { fieldName: 'vendorName', oldValue: 'XYZ Inc', newValue: 'XYZ Incorporated' },
        { fieldName: 'vendorName', oldValue: 'DEF LLC', newValue: 'DEF Limited Liability Company' },
      ];

      const result = await correctionService.learnFromCorrections(testUserId, userCorrections);

      expect(result.patternsLearned).toBe(3);
      expect(result.rules).toContain({
        pattern: 'Corp -> Corporation',
        confidence: 0.9,
        applicability: 'vendor_name_expansion',
      });
      expect(result.rules).toContain({
        pattern: 'Inc -> Incorporated',
        confidence: 0.9,
        applicability: 'vendor_name_expansion',
      });
      expect(result.modelUpdated).toBe(true);
    });
  });

  describe('Correction Templates and Presets', () => {
    it('should create correction templates for common fixes', async () => {
      const template = {
        name: 'Vendor Name Standardization',
        description: 'Standardizes vendor name formats',
        fieldName: 'vendorName',
        rules: [
          { pattern: /Corp$/, replacement: 'Corporation' },
          { pattern: /Inc$/, replacement: 'Incorporated' },
          { pattern: /LLC$/, replacement: 'Limited Liability Company' },
        ],
        autoApply: false,
        requiresApproval: true,
      };

      const mockTemplate = {
        id: uuidv4(),
        userId: testUserId,
        ...template,
        createdAt: new Date(),
      };

      mockPrisma.correctionTemplate.create.mockResolvedValue(mockTemplate);

      const result = await correctionService.createCorrectionTemplate(testUserId, template);

      expect(result.success).toBe(true);
      expect(result.templateId).toBe(mockTemplate.id);
      expect(result.template.name).toBe('Vendor Name Standardization');
      expect(result.template.rules).toHaveLength(3);
      expect(mockPrisma.correctionTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: testUserId,
          name: 'Vendor Name Standardization',
          fieldName: 'vendorName',
        }),
      });
    });

    it('should apply correction templates to invoices', async () => {
      const mockTemplates = [
        {
          id: uuidv4(),
          name: 'Date Format Standardization',
          fieldName: 'invoiceDate',
          rules: [
            { pattern: 'MM/DD/YY', replacement: 'YYYY-MM-DD' },
          ],
          autoApply: true,
        },
      ];

      const mockInvoice = {
        id: testInvoiceId,
        invoiceDate: '03/15/24',
      };

      mockPrisma.correctionTemplate.findMany.mockResolvedValue(mockTemplates);
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await correctionService.applyTemplates(testInvoiceId, testUserId);

      expect(result.success).toBe(true);
      expect(result.templatesApplied).toBe(1);
      expect(result.correctionsApplied).toBe(1);
      expect(result.corrections[0].fieldName).toBe('invoiceDate');
      expect(result.corrections[0].newValue).toBe('2024-03-15');
      expect(result.corrections[0].templateUsed).toBe('Date Format Standardization');
    });

    it('should manage user-specific correction presets', async () => {
      const preset = {
        name: 'My Standard Corrections',
        description: 'Common corrections I apply',
        corrections: [
          { fieldName: 'vendorName', find: 'Corp', replace: 'Corporation' },
          { fieldName: 'totalAmount', validation: 'ensure_positive' },
        ],
        autoApply: false,
      };

      const result = await correctionService.saveUserPreset(testUserId, preset);

      expect(result.success).toBe(true);
      expect(result.presetId).toBeDefined();
      expect(result.preset.name).toBe('My Standard Corrections');
      expect(result.preset.corrections).toHaveLength(2);
    });
  });

  describe('Correction History and Tracking', () => {
    it('should track all corrections made to an invoice', async () => {
      const mockCorrections = [
        {
          id: uuidv4(),
          fieldName: 'vendorName',
          oldValue: 'ABC Corp',
          newValue: 'ABC Corporation',
          reason: 'Standardization',
          userId: testUserId,
          createdAt: new Date(Date.now() - 3600000), // 1 hour ago
          status: 'applied',
        },
        {
          id: uuidv4(),
          fieldName: 'totalAmount',
          oldValue: 1500,
          newValue: 1200,
          reason: 'Calculation error',
          userId: testUserId,
          createdAt: new Date(),
          status: 'applied',
        },
      ];

      mockPrisma.correction.findMany.mockResolvedValue(mockCorrections);

      const result = await correctionService.getCorrectionHistory(testInvoiceId);

      expect(result.corrections).toHaveLength(2);
      expect(result.totalCorrections).toBe(2);
      expect(result.correctionsByField.vendorName).toBe(1);
      expect(result.correctionsByField.totalAmount).toBe(1);
      expect(result.lastCorrectionDate).toBeDefined();
      expect(result.correctionTimeline).toHaveLength(2);
    });

    it('should provide correction analytics and insights', async () => {
      const mockCorrections = [
        { fieldName: 'vendorName', status: 'applied' },
        { fieldName: 'vendorName', status: 'applied' },
        { fieldName: 'totalAmount', status: 'applied' },
        { fieldName: 'invoiceDate', status: 'reverted' },
      ];

      const result = await correctionService.getCorrectionAnalytics(testUserId, {
        timeRange: '30d',
        includeFieldBreakdown: true,
      });

      expect(result.totalCorrections).toBe(4);
      expect(result.successRate).toBe(0.75); // 3 applied out of 4
      expect(result.mostCorrectedField).toBe('vendorName');
      expect(result.fieldBreakdown.vendorName.count).toBe(2);
      expect(result.fieldBreakdown.vendorName.successRate).toBe(1.0);
      expect(result.trends.improving).toBe(true);
      expect(result.recommendations).toContain('Focus on vendor name extraction quality');
    });

    it('should support correction reversal', async () => {
      const correctionId = uuidv4();
      const mockCorrection = {
        id: correctionId,
        invoiceId: testInvoiceId,
        fieldName: 'vendorName',
        oldValue: 'ABC Corp',
        newValue: 'ABC Corporation',
        status: 'applied',
      };

      mockPrisma.correction.findUnique.mockResolvedValue(mockCorrection);
      mockPrisma.correction.update.mockResolvedValue({
        ...mockCorrection,
        status: 'reverted',
      });

      const result = await correctionService.revertCorrection(correctionId, testUserId, {
        reason: 'Original value was correct',
      });

      expect(result.success).toBe(true);
      expect(result.correctionReverted).toBe(true);
      expect(result.fieldRestored).toBe('vendorName');
      expect(result.restoredValue).toBe('ABC Corp');
      expect(mockPrisma.correction.update).toHaveBeenCalledWith({
        where: { id: correctionId },
        data: {
          status: 'reverted',
          revertedAt: expect.any(Date),
          revertReason: 'Original value was correct',
        },
      });
    });
  });

  describe('Collaborative Correction Features', () => {
    it('should support correction approval workflows', async () => {
      const correction = {
        fieldName: 'totalAmount',
        oldValue: 1500,
        newValue: 1200,
        reason: 'Calculation error',
        requiresApproval: true,
      };

      const result = await correctionService.submitCorrectionForApproval(
        testInvoiceId,
        testUserId,
        correction
      );

      expect(result.success).toBe(true);
      expect(result.correctionId).toBeDefined();
      expect(result.status).toBe('pending_approval');
      expect(result.approvalRequired).toBe(true);
      expect(result.assignedApprover).toBeDefined();
      expect(result.estimatedApprovalTime).toBeDefined();
    });

    it('should handle correction approvals and rejections', async () => {
      const correctionId = uuidv4();
      const approverId = uuidv4();

      const result = await correctionService.approveCorrectionRequest(
        correctionId,
        approverId,
        {
          approved: true,
          comments: 'Correction looks accurate',
        }
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('approved');
      expect(result.correctionApplied).toBe(true);
      expect(result.approverComments).toBe('Correction looks accurate');
    });

    it('should support correction comments and discussions', async () => {
      const correctionId = uuidv4();
      const comment = {
        comment: 'This correction seems correct based on the line items',
        commentType: 'approval_note',
      };

      const result = await correctionService.addCorrectionComment(
        correctionId,
        testUserId,
        comment
      );

      expect(result.success).toBe(true);
      expect(result.commentId).toBeDefined();
      expect(result.notificationSent).toBe(true);
      expect(result.discussionUpdated).toBe(true);
    });
  });

  describe('Integration with Existing UI', () => {
    it('should enhance existing invoice forms with correction tools', async () => {
      const existingFormData = {
        invoiceId: testInvoiceId,
        fields: {
          invoiceNumber: { value: 'INV-001', editable: false },
          vendorName: { value: 'ABC Corp', editable: true },
          totalAmount: { value: 1500, editable: true },
        },
      };

      const result = await correctionService.enhanceFormWithCorrectionTools(
        existingFormData,
        testUserId
      );

      expect(result.enhanced).toBe(true);
      expect(result.correctionToolsAdded).toBe(true);
      expect(result.fields.vendorName.correctionTools).toBeDefined();
      expect(result.fields.vendorName.correctionTools.suggestions).toBeDefined();
      expect(result.fields.vendorName.correctionTools.history).toBeDefined();
      expect(result.fields.totalAmount.correctionTools.validation).toBeDefined();
      expect(result.globalActions).toContain('apply_templates');
      expect(result.globalActions).toContain('bulk_correct');
    });

    it('should provide correction tool widgets for existing views', async () => {
      const viewConfig = {
        viewType: 'detail',
        invoiceId: testInvoiceId,
        editableFields: ['vendorName', 'totalAmount'],
      };

      const result = await correctionService.generateCorrectionWidgets(viewConfig, testUserId);

      expect(result.widgets).toHaveLength(2);
      expect(result.widgets[0].fieldName).toBe('vendorName');
      expect(result.widgets[0].type).toBe('inline_editor');
      expect(result.widgets[0].features).toContain('smart_suggestions');
      expect(result.widgets[0].features).toContain('validation');
      expect(result.widgets[1].fieldName).toBe('totalAmount');
      expect(result.widgets[1].type).toBe('number_editor');
      expect(result.globalWidget.type).toBe('correction_toolbar');
      expect(result.globalWidget.actions).toContain('apply_all_suggestions');
    });

    it('should support keyboard shortcuts for correction tools', async () => {
      const result = await correctionService.getCorrectionKeyboardShortcuts();

      expect(result.shortcuts['Ctrl+E']).toBe('edit_field');
      expect(result.shortcuts['Ctrl+S']).toBe('apply_suggestion');
      expect(result.shortcuts['Ctrl+Z']).toBe('undo_correction');
      expect(result.shortcuts['Ctrl+Shift+Z']).toBe('redo_correction');
      expect(result.shortcuts['Escape']).toBe('cancel_edit');
      expect(result.contextualShortcuts.editing['Enter']).toBe('apply_change');
      expect(result.contextualShortcuts.editing['Tab']).toBe('next_field');
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large-scale correction operations efficiently', async () => {
      const invoiceIds = Array.from({ length: 100 }, () => uuidv4());
      const correctionTemplate = {
        fieldName: 'vendorName',
        find: 'Corp',
        replace: 'Corporation',
      };

      const startTime = Date.now();
      const result = await correctionService.applyBulkTemplateCorrections(
        invoiceIds,
        testUserId,
        correctionTemplate
      );
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.processedInvoices).toBe(100);
      expect(result.correctionsApplied).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(result.performance.averageTimePerInvoice).toBeLessThan(50); // Less than 50ms per invoice
    });

    it('should cache correction suggestions for performance', async () => {
      const fieldData = {
        fieldName: 'vendorName',
        currentValue: 'ABC Corp',
        confidence: 0.65,
      };

      // First call should generate suggestions
      const result1 = await correctionService.generateSmartSuggestions(fieldData);
      
      // Second call should use cache
      const result2 = await correctionService.generateSmartSuggestions(fieldData);

      expect(result1.suggestions).toEqual(result2.suggestions);
      expect(result2.fromCache).toBe(true);
      expect(result2.cacheHit).toBe(true);
    });

    it('should optimize correction tools for mobile devices', async () => {
      const mobileConfig = {
        touchOptimized: true,
        simplifiedInterface: true,
        reducedAnimations: true,
      };

      const result = await correctionService.generateMobileCorrectionInterface(
        testInvoiceId,
        testUserId,
        mobileConfig
      );

      expect(result.mobileOptimized).toBe(true);
      expect(result.touchTargets.minSize).toBe(44); // Minimum touch target size
      expect(result.interface.simplified).toBe(true);
      expect(result.animations.reduced).toBe(true);
      expect(result.gestures).toContain('swipe_to_edit');
      expect(result.gestures).toContain('long_press_for_suggestions');
    });
  });
});
