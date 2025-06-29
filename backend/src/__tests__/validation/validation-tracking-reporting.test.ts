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
  validationMetric: {
    create: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  validationReport: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Validation Tracking and Reporting', () => {
  let fieldService: ConfidenceBasedRoutingService;

  beforeEach(() => {
    jest.clearAllMocks();
    fieldService = new ConfidenceBasedRoutingService(mockPrisma);
  });

  describe('Metrics Collection', () => {
    it('should collect comprehensive validation metrics', async () => {
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
        enableValidationTracking: true,
        enableMetricsCollection: true,
      });

      expect(result.validationTracking).toBeDefined();
      expect(result.validationTracking.metrics).toBeDefined();
      expect(result.validationTracking.metrics).toEqual(
        expect.objectContaining({
          extractionId: expect.any(String),
          timestamp: expect.any(String),
          processingTimeMs: expect.any(Number),
          overallConfidence: expect.any(Number),
          fieldsExtracted: expect.any(Number),
          fieldsValidated: expect.any(Number),
          validationErrors: expect.any(Number),
          validationWarnings: expect.any(Number),
          businessRulesPassed: expect.any(Number),
          businessRulesFailed: expect.any(Number),
          mathematicalValidationScore: expect.any(Number),
          templateMatchConfidence: expect.any(Number),
          routingDecision: expect.any(String),
          routingReason: expect.any(String),
        })
      );
    });

    it('should track field-level validation metrics', async () => {
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
        enableValidationTracking: true,
        enableFieldLevelTracking: true,
      });

      expect(result.validationTracking.fieldMetrics).toBeDefined();
      expect(Array.isArray(result.validationTracking.fieldMetrics)).toBe(true);
      
      if (result.validationTracking.fieldMetrics.length > 0) {
        const fieldMetric = result.validationTracking.fieldMetrics[0];
        expect(fieldMetric).toEqual(
          expect.objectContaining({
            fieldName: expect.any(String),
            extractionConfidence: expect.any(Number),
            validationStatus: expect.stringMatching(/^(valid|invalid|warning)$/),
            extractionMethod: expect.any(String),
            processingTimeMs: expect.any(Number),
            errorCount: expect.any(Number),
            warningCount: expect.any(Number),
          })
        );
      }
    });

    it('should track performance metrics over time', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableValidationTracking: true,
        enablePerformanceTracking: true,
      });

      expect(result.validationTracking.performanceMetrics).toBeDefined();
      expect(result.validationTracking.performanceMetrics).toEqual(
        expect.objectContaining({
          totalProcessingTime: expect.any(Number),
          extractionTime: expect.any(Number),
          validationTime: expect.any(Number),
          routingTime: expect.any(Number),
          uiGenerationTime: expect.any(Number),
          memoryUsage: expect.any(Number),
          cpuUsage: expect.any(Number),
        })
      );
    });
  });

  describe('Error and Warning Tracking', () => {
    it('should track validation errors with detailed context', async () => {
      const errorInvoiceText = `
        Invoice: INV-2024-001
        Date: 2024-03-15
        Due Date: 2024-03-10
        Subtotal: $1,000.00
        Tax: $100.00
        Total: $1,200.00
      `;

      const result = await fieldService.extractFields(errorInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'dueDate', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableValidationTracking: true,
        enableBusinessLogicValidation: true,
        enableMathematicalValidation: true,
      });

      expect(result.validationTracking.errorTracking).toBeDefined();
      expect(result.validationTracking.errorTracking.errors).toBeDefined();
      expect(Array.isArray(result.validationTracking.errorTracking.errors)).toBe(true);
      
      if (result.validationTracking.errorTracking.errors.length > 0) {
        const error = result.validationTracking.errorTracking.errors[0];
        expect(error).toEqual(
          expect.objectContaining({
            errorId: expect.any(String),
            errorType: expect.any(String),
            severity: expect.stringMatching(/^(low|medium|high|critical)$/),
            fieldName: expect.any(String),
            errorMessage: expect.any(String),
            timestamp: expect.any(String),
            context: expect.any(Object),
            resolution: expect.any(String),
          })
        );
      }
    });

    it('should track warning patterns and trends', async () => {
      const warningInvoiceText = `
        Invoice: INV-2024-001
        Date: 2024-03-15
        Vendor: ABC Corp
        Total: $999.99
      `;

      const result = await fieldService.extractFields(warningInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.6,
        enableValidationTracking: true,
        enableWarningTracking: true,
      });

      expect(result.validationTracking.warningTracking).toBeDefined();
      expect(result.validationTracking.warningTracking.warnings).toBeDefined();
      expect(Array.isArray(result.validationTracking.warningTracking.warnings)).toBe(true);
      
      if (result.validationTracking.warningTracking.warnings.length > 0) {
        const warning = result.validationTracking.warningTracking.warnings[0];
        expect(warning).toEqual(
          expect.objectContaining({
            warningId: expect.any(String),
            warningType: expect.any(String),
            severity: expect.stringMatching(/^(low|medium|high)$/),
            fieldName: expect.any(String),
            warningMessage: expect.any(String),
            timestamp: expect.any(String),
            recommendation: expect.any(String),
          })
        );
      }
    });
  });

  describe('Reporting Dashboard Data', () => {
    it('should generate dashboard summary metrics', async () => {
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
        enableValidationTracking: true,
        enableReporting: true,
        reportingPeriod: 'daily',
      });

      expect(result.validationTracking.reporting).toBeDefined();
      expect(result.validationTracking.reporting.dashboardSummary).toBeDefined();
      expect(result.validationTracking.reporting.dashboardSummary).toEqual(
        expect.objectContaining({
          period: expect.any(String),
          totalExtractions: expect.any(Number),
          successfulExtractions: expect.any(Number),
          failedExtractions: expect.any(Number),
          averageConfidence: expect.any(Number),
          averageProcessingTime: expect.any(Number),
          totalErrors: expect.any(Number),
          totalWarnings: expect.any(Number),
          topErrorTypes: expect.any(Array),
          confidenceDistribution: expect.any(Object),
          performanceTrends: expect.any(Object),
        })
      );
    });

    it('should generate detailed analytics reports', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableValidationTracking: true,
        enableReporting: true,
        enableDetailedAnalytics: true,
        reportingPeriod: 'weekly',
      });

      expect(result.validationTracking.reporting.detailedAnalytics).toBeDefined();
      expect(result.validationTracking.reporting.detailedAnalytics).toEqual(
        expect.objectContaining({
          fieldAccuracyAnalysis: expect.any(Object),
          templatePerformanceAnalysis: expect.any(Object),
          businessRuleAnalysis: expect.any(Object),
          routingEfficiencyAnalysis: expect.any(Object),
          userInteractionAnalysis: expect.any(Object),
          systemPerformanceAnalysis: expect.any(Object),
        })
      );
    });

    it('should generate compliance and audit reports', async () => {
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
        enableValidationTracking: true,
        enableReporting: true,
        enableComplianceReporting: true,
      });

      expect(result.validationTracking.reporting.complianceReport).toBeDefined();
      expect(result.validationTracking.reporting.complianceReport).toEqual(
        expect.objectContaining({
          complianceScore: expect.any(Number),
          auditTrail: expect.any(Array),
          regulatoryCompliance: expect.any(Object),
          dataQualityMetrics: expect.any(Object),
          securityMetrics: expect.any(Object),
          recommendations: expect.any(Array),
        })
      );
    });
  });

  describe('Performance Analytics', () => {
    it('should track system performance metrics', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableValidationTracking: true,
        enablePerformanceAnalytics: true,
      });

      expect(result.validationTracking.performanceAnalytics).toBeDefined();
      expect(result.validationTracking.performanceAnalytics).toEqual(
        expect.objectContaining({
          throughputMetrics: expect.objectContaining({
            documentsPerHour: expect.any(Number),
            fieldsPerSecond: expect.any(Number),
            averageLatency: expect.any(Number),
          }),
          resourceUtilization: expect.objectContaining({
            cpuUsage: expect.any(Number),
            memoryUsage: expect.any(Number),
            diskUsage: expect.any(Number),
          }),
          scalabilityMetrics: expect.objectContaining({
            concurrentProcessing: expect.any(Number),
            queueLength: expect.any(Number),
            loadBalancingEfficiency: expect.any(Number),
          }),
        })
      );
    });

    it('should provide predictive analytics insights', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableValidationTracking: true,
        enablePredictiveAnalytics: true,
        historicalData: {
          totalExtractions: 1000,
          averageConfidence: 0.85,
          trendData: [0.8, 0.82, 0.85, 0.87, 0.85],
        },
      });

      expect(result.validationTracking.predictiveAnalytics).toBeDefined();
      expect(result.validationTracking.predictiveAnalytics).toEqual(
        expect.objectContaining({
          confidenceTrends: expect.objectContaining({
            currentTrend: expect.any(String),
            predictedConfidence: expect.any(Number),
            trendConfidence: expect.any(Number),
          }),
          volumePredictions: expect.objectContaining({
            expectedVolume: expect.any(Number),
            peakTimes: expect.any(Array),
            resourceRequirements: expect.any(Object),
          }),
          qualityPredictions: expect.objectContaining({
            expectedErrorRate: expect.any(Number),
            riskFactors: expect.any(Array),
            recommendations: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('Real-time Monitoring', () => {
    it('should provide real-time validation monitoring data', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableValidationTracking: true,
        enableRealTimeMonitoring: true,
      });

      expect(result.validationTracking.realTimeMonitoring).toBeDefined();
      expect(result.validationTracking.realTimeMonitoring).toEqual(
        expect.objectContaining({
          currentStatus: expect.any(String),
          activeProcesses: expect.any(Number),
          queueStatus: expect.any(Object),
          systemHealth: expect.objectContaining({
            status: expect.any(String),
            uptime: expect.any(Number),
            lastError: expect.any(String),
          }),
          alerts: expect.any(Array),
          metrics: expect.objectContaining({
            requestsPerMinute: expect.any(Number),
            averageResponseTime: expect.any(Number),
            errorRate: expect.any(Number),
          }),
        })
      );
    });

    it('should generate alerts for anomalies and issues', async () => {
      const anomalousInvoiceText = `
        Invoice: INV-2024-001
        Date: 1900-01-01
        Vendor: SUSPICIOUS VENDOR
        Total: $999999.99
      `;

      const result = await fieldService.extractFields(anomalousInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableValidationTracking: true,
        enableAnomalyDetection: true,
        enableAlerts: true,
      });

      expect(result.validationTracking.alerts).toBeDefined();
      expect(Array.isArray(result.validationTracking.alerts)).toBe(true);
      
      if (result.validationTracking.alerts.length > 0) {
        const alert = result.validationTracking.alerts[0];
        expect(alert).toEqual(
          expect.objectContaining({
            alertId: expect.any(String),
            alertType: expect.any(String),
            severity: expect.stringMatching(/^(low|medium|high|critical)$/),
            message: expect.any(String),
            timestamp: expect.any(String),
            affectedFields: expect.any(Array),
            recommendedActions: expect.any(Array),
            autoResolution: expect.any(Boolean),
          })
        );
      }
    });
  });

  describe('Historical Data Analysis', () => {
    it('should analyze historical validation trends', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableValidationTracking: true,
        enableHistoricalAnalysis: true,
        historicalPeriod: '30days',
      });

      expect(result.validationTracking.historicalAnalysis).toBeDefined();
      expect(result.validationTracking.historicalAnalysis).toEqual(
        expect.objectContaining({
          trendAnalysis: expect.objectContaining({
            confidenceTrend: expect.any(String),
            errorTrend: expect.any(String),
            performanceTrend: expect.any(String),
          }),
          comparativeAnalysis: expect.objectContaining({
            vsLastPeriod: expect.any(Object),
            vsBaseline: expect.any(Object),
            vsBenchmark: expect.any(Object),
          }),
          seasonalPatterns: expect.any(Object),
          improvementOpportunities: expect.any(Array),
        })
      );
    });

    it('should provide data export capabilities', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableValidationTracking: true,
        enableDataExport: true,
        exportFormat: 'json',
      });

      expect(result.validationTracking.dataExport).toBeDefined();
      expect(result.validationTracking.dataExport).toEqual(
        expect.objectContaining({
          exportId: expect.any(String),
          format: expect.any(String),
          downloadUrl: expect.any(String),
          expiresAt: expect.any(String),
          fileSize: expect.any(Number),
          recordCount: expect.any(Number),
        })
      );
    });
  });
});
