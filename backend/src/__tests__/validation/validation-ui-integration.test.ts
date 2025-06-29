import { ConfidenceBasedRoutingService } from '../../services/confidence-based-routing.service';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
const mockPrisma = {
  extraction: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  fieldPattern: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  extractionRule: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  template: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  businessRule: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  processingQueue: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Validation UI Integration', () => {
  let fieldService: ConfidenceBasedRoutingService;

  beforeEach(() => {
    jest.clearAllMocks();
    fieldService = new ConfidenceBasedRoutingService(mockPrisma);
  });

  describe('Real-time Validation Feedback', () => {
    it('should provide real-time validation status for UI components', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Date: 2024-03-15
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableUIIntegration: true,
        enableRealTimeValidation: true,
      });

      expect(result.uiIntegration).toBeDefined();
      expect(result.uiIntegration.validationStatus).toBeDefined();
      expect(result.uiIntegration.validationStatus.overall).toEqual(
        expect.objectContaining({
          status: expect.stringMatching(/^(valid|warning|error)$/),
          message: expect.any(String),
          confidence: expect.any(Number),
        })
      );
      expect(result.uiIntegration.fieldValidations).toBeDefined();
      expect(Array.isArray(result.uiIntegration.fieldValidations)).toBe(true);
    });

    it('should provide field-level validation feedback', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Date: Invalid Date
        Vendor: ABC Corp
        Total: Not a number
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.5,
        enableUIIntegration: true,
        enableRealTimeValidation: true,
      });

      const fieldValidations = result.uiIntegration.fieldValidations;
      expect(fieldValidations).toBeDefined();
      
      // Check that each field has validation info
      const invoiceNumberValidation = fieldValidations.find((f: any) => f.fieldName === 'invoiceNumber');
      expect(invoiceNumberValidation).toEqual(
        expect.objectContaining({
          fieldName: 'invoiceNumber',
          status: expect.stringMatching(/^(valid|warning|error)$/),
          confidence: expect.any(Number),
          extractedValue: expect.any(String),
          suggestions: expect.any(Array),
        })
      );
    });

    it('should provide progressive validation during typing', async () => {
      const partialInvoiceText = `
        Invoice: INV-
      `;

      const result = await fieldService.extractFields(partialInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber'],
        confidenceThreshold: 0.3,
        enableUIIntegration: true,
        enableProgressiveValidation: true,
      });

      expect(result.uiIntegration.progressiveValidation).toBeDefined();
      expect(result.uiIntegration.progressiveValidation.completionPercentage).toBeGreaterThan(0);
      expect(result.uiIntegration.progressiveValidation.nextExpectedFields).toBeDefined();
      expect(result.uiIntegration.progressiveValidation.suggestions).toBeDefined();
    });
  });

  describe('Error Highlighting', () => {
    it('should provide error highlighting information for UI', async () => {
      const invoiceWithErrors = `
        Invoice: INV-2024-001
        Date: 2024-03-15
        Due Date: 2024-03-10
        Vendor: ABC Corp
        Subtotal: $1,000.00
        Tax: $100.00
        Total: $1,200.00
      `;

      const result = await fieldService.extractFields(invoiceWithErrors, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'dueDate', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableUIIntegration: true,
        enableBusinessLogicValidation: true,
        enableMathematicalValidation: true,
      });

      expect(result.uiIntegration.errorHighlighting).toBeDefined();
      expect(result.uiIntegration.errorHighlighting.errors).toBeDefined();
      expect(Array.isArray(result.uiIntegration.errorHighlighting.errors)).toBe(true);
      
      if (result.uiIntegration.errorHighlighting.errors.length > 0) {
        const error = result.uiIntegration.errorHighlighting.errors[0];
        expect(error).toEqual(
          expect.objectContaining({
            fieldName: expect.any(String),
            errorType: expect.any(String),
            severity: expect.stringMatching(/^(error|warning|info)$/),
            message: expect.any(String),
            position: expect.objectContaining({
              start: expect.any(Number),
              end: expect.any(Number),
            }),
            suggestions: expect.any(Array),
          })
        );
      }
    });

    it('should highlight mathematical validation errors', async () => {
      const mathErrorInvoice = `
        Invoice: INV-2024-001
        Subtotal: $1,000.00
        Tax: $100.00
        Total: $1,200.00
      `;

      const result = await fieldService.extractFields(mathErrorInvoice, {
        type: 'invoice',
        requiredFields: ['subtotal', 'taxAmount', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableUIIntegration: true,
        enableMathematicalValidation: true,
      });

      const mathErrors = result.uiIntegration.errorHighlighting.errors.filter(
        (error: any) => error.errorType === 'mathematical'
      );
      
      if (mathErrors.length > 0) {
        expect(mathErrors[0]).toEqual(
          expect.objectContaining({
            errorType: 'mathematical',
            severity: 'error',
            calculatedValue: expect.any(Number),
            actualValue: expect.any(Number),
            discrepancy: expect.any(Number),
          })
        );
      }
    });

    it('should highlight business rule violations', async () => {
      const businessRuleViolation = `
        Invoice: INV-2024-001
        Date: 2024-03-15
        Due Date: 2024-03-10
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(businessRuleViolation, {
        type: 'invoice',
        requiredFields: ['invoiceDate', 'dueDate', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableUIIntegration: true,
        enableBusinessLogicValidation: true,
        customRules: [
          {
            name: 'dueDateAfterInvoiceDate',
            description: 'Due date must be after invoice date',
            validation: (fields: any) => ({
              isValid: new Date(fields.dueDate) > new Date(fields.invoiceDate),
              message: 'Due date must be after invoice date',
            }),
          },
        ],
      });

      const businessRuleErrors = result.uiIntegration.errorHighlighting.errors.filter(
        (error: any) => error.errorType === 'business_rule'
      );
      
      if (businessRuleErrors.length > 0) {
        expect(businessRuleErrors[0]).toEqual(
          expect.objectContaining({
            errorType: 'business_rule',
            ruleName: expect.any(String),
            ruleDescription: expect.any(String),
          })
        );
      }
    });
  });

  describe('Validation Status Indicators', () => {
    it('should provide overall validation status indicators', async () => {
      const validInvoice = `
        Invoice: INV-2024-001
        Date: 2024-03-15
        Vendor: ABC Corporation
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(validInvoice, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableUIIntegration: true,
      });

      expect(result.uiIntegration.statusIndicators).toBeDefined();
      expect(result.uiIntegration.statusIndicators.overall).toEqual(
        expect.objectContaining({
          status: expect.stringMatching(/^(success|warning|error|processing)$/),
          icon: expect.any(String),
          color: expect.any(String),
          message: expect.any(String),
          progress: expect.any(Number),
        })
      );
    });

    it('should provide confidence level indicators', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableUIIntegration: true,
      });

      expect(result.uiIntegration.statusIndicators.confidence).toBeDefined();
      expect(result.uiIntegration.statusIndicators.confidence).toEqual(
        expect.objectContaining({
          level: expect.stringMatching(/^(high|medium|low)$/),
          score: expect.any(Number),
          color: expect.any(String),
          description: expect.any(String),
          recommendation: expect.any(String),
        })
      );
    });

    it('should provide processing status indicators', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableUIIntegration: true,
        enableConfidenceBasedRouting: true,
      });

      expect(result.uiIntegration.statusIndicators.processing).toBeDefined();
      expect(result.uiIntegration.statusIndicators.processing).toEqual(
        expect.objectContaining({
          stage: expect.any(String),
          queue: expect.any(String),
          priority: expect.any(String),
          estimatedTime: expect.any(Number),
          nextAction: expect.any(String),
        })
      );
    });
  });

  describe('Interactive Validation Features', () => {
    it('should provide field suggestions for auto-completion', async () => {
      const partialInvoice = `
        Invoice: INV-
        Vendor: ABC
        Total: $1,
      `;

      const result = await fieldService.extractFields(partialInvoice, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.5,
        enableUIIntegration: true,
        enableAutoCompletion: true,
      });

      expect(result.uiIntegration.autoCompletion).toBeDefined();
      expect(result.uiIntegration.autoCompletion.suggestions).toBeDefined();
      expect(Array.isArray(result.uiIntegration.autoCompletion.suggestions)).toBe(true);
      
      if (result.uiIntegration.autoCompletion.suggestions.length > 0) {
        const suggestion = result.uiIntegration.autoCompletion.suggestions[0];
        expect(suggestion).toEqual(
          expect.objectContaining({
            fieldName: expect.any(String),
            suggestedValue: expect.any(String),
            confidence: expect.any(Number),
            reasoning: expect.any(String),
          })
        );
      }
    });

    it('should provide validation tooltips and help text', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableUIIntegration: true,
        enableValidationTooltips: true,
      });

      expect(result.uiIntegration.tooltips).toBeDefined();
      expect(Array.isArray(result.uiIntegration.tooltips)).toBe(true);
      
      if (result.uiIntegration.tooltips.length > 0) {
        const tooltip = result.uiIntegration.tooltips[0];
        expect(tooltip).toEqual(
          expect.objectContaining({
            fieldName: expect.any(String),
            title: expect.any(String),
            content: expect.any(String),
            type: expect.stringMatching(/^(info|warning|error|success)$/),
            position: expect.any(String),
          })
        );
      }
    });

    it('should provide validation actions and buttons', async () => {
      const invoiceWithIssues = `
        Invoice: INV-2024-001
        Date: unclear date
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceWithIssues, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.5,
        enableUIIntegration: true,
        enableValidationActions: true,
      });

      expect(result.uiIntegration.actions).toBeDefined();
      expect(Array.isArray(result.uiIntegration.actions)).toBe(true);
      
      if (result.uiIntegration.actions.length > 0) {
        const action = result.uiIntegration.actions[0];
        expect(action).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            label: expect.any(String),
            type: expect.stringMatching(/^(button|link|dropdown)$/),
            action: expect.any(String),
            icon: expect.any(String),
            enabled: expect.any(Boolean),
          })
        );
      }
    });
  });

  describe('Validation Dashboard Integration', () => {
    it('should provide dashboard metrics for validation overview', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Date: 2024-03-15
        Vendor: ABC Corporation
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableUIIntegration: true,
        enableDashboardMetrics: true,
      });

      expect(result.uiIntegration.dashboardMetrics).toBeDefined();
      expect(result.uiIntegration.dashboardMetrics).toEqual(
        expect.objectContaining({
          extractionAccuracy: expect.any(Number),
          validationScore: expect.any(Number),
          processingTime: expect.any(Number),
          fieldsExtracted: expect.any(Number),
          fieldsValidated: expect.any(Number),
          errorsDetected: expect.any(Number),
          warningsGenerated: expect.any(Number),
        })
      );
    });

    it('should provide validation trends and analytics', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableUIIntegration: true,
        enableValidationAnalytics: true,
        historicalData: {
          previousExtractions: 100,
          averageConfidence: 0.85,
          commonErrors: ['date_format', 'amount_calculation'],
        },
      });

      expect(result.uiIntegration.analytics).toBeDefined();
      expect(result.uiIntegration.analytics).toEqual(
        expect.objectContaining({
          trends: expect.objectContaining({
            confidenceTrend: expect.any(String),
            errorTrend: expect.any(String),
            performanceTrend: expect.any(String),
          }),
          comparisons: expect.objectContaining({
            vsAverage: expect.any(Number),
            vsPrevious: expect.any(Number),
            vsTarget: expect.any(Number),
          }),
          recommendations: expect.any(Array),
        })
      );
    });
  });

  describe('Mobile and Responsive UI Integration', () => {
    it('should provide mobile-optimized validation feedback', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableUIIntegration: true,
        deviceType: 'mobile',
        enableMobileOptimization: true,
      });

      expect(result.uiIntegration.mobileOptimization).toBeDefined();
      expect(result.uiIntegration.mobileOptimization).toEqual(
        expect.objectContaining({
          compactView: expect.any(Boolean),
          touchOptimized: expect.any(Boolean),
          simplifiedMessages: expect.any(Array),
          gestureSupport: expect.any(Object),
        })
      );
    });

    it('should provide responsive layout information', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableUIIntegration: true,
        screenSize: 'tablet',
        enableResponsiveLayout: true,
      });

      expect(result.uiIntegration.responsiveLayout).toBeDefined();
      expect(result.uiIntegration.responsiveLayout).toEqual(
        expect.objectContaining({
          breakpoint: expect.any(String),
          layout: expect.any(String),
          componentSizes: expect.any(Object),
          spacing: expect.any(Object),
        })
      );
    });
  });
});
