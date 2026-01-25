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

describe('Confidence-Based Routing', () => {
  let fieldService: ConfidenceBasedRoutingService;

  beforeEach(() => {
    jest.clearAllMocks();
    fieldService = new ConfidenceBasedRoutingService(mockPrisma);
  });

  describe('High Confidence Routing', () => {
    it('should route high confidence extractions to auto-approval', async () => {
      const highConfidenceInvoiceText = `
        INVOICE
        Invoice Number: INV-2024-001
        Date: March 15, 2024
        Vendor: ABC Corporation
        Customer: XYZ Inc
        Subtotal: $1,000.00
        Tax: $100.00
        Total Amount: $1,100.00
      `;

      const result = await fieldService.extractFields(
        highConfidenceInvoiceText,
        {
          type: 'invoice',
          requiredFields: [
            'invoiceNumber',
            'invoiceDate',
            'vendorName',
            'totalAmount',
          ],
          confidenceThreshold: 0.9,
          enableConfidenceBasedRouting: true,
          routingRules: {
            highConfidenceThreshold: 0.9,
            mediumConfidenceThreshold: 0.7,
            autoApprovalThreshold: 0.95,
          },
        },
      );

      expect(result.routing).toBeDefined();
      expect(result.routing.recommendedQueue).toBe('auto-approval');
      expect(result.routing.routingReason).toContain('high confidence');
      expect(result.routing.priority).toBe('low');
      expect(result.routing.estimatedProcessingTime).toBeLessThan(60); // seconds
    });

    it('should route high confidence but high amount to manager review', async () => {
      const highAmountInvoiceText = `
        INVOICE
        Invoice Number: INV-2024-001
        Date: March 15, 2024
        Vendor: ABC Corporation
        Total Amount: $50,000.00
      `;

      const result = await fieldService.extractFields(highAmountInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.9,
        enableConfidenceBasedRouting: true,
        routingRules: {
          highConfidenceThreshold: 0.9,
          highAmountThreshold: 10000,
          autoApprovalThreshold: 0.95,
        },
      });

      expect(result.routing.recommendedQueue).toBe('manager-review');
      expect(result.routing.routingReason).toContain('high amount');
      expect(result.routing.priority).toBe('medium');
    });
  });

  describe('Medium Confidence Routing', () => {
    it('should route medium confidence extractions to human review', async () => {
      const mediumConfidenceInvoiceText = `
        lnvoice: 2024-001
        0ate: Mar 15
        Vendor: ABC Corp
        Tota1: $1,234
      `;

      const result = await fieldService.extractFields(
        mediumConfidenceInvoiceText,
        {
          type: 'invoice',
          requiredFields: [
            'invoiceNumber',
            'invoiceDate',
            'vendorName',
            'totalAmount',
          ],
          confidenceThreshold: 0.5,
          enableConfidenceBasedRouting: true,
          routingRules: {
            highConfidenceThreshold: 0.9,
            mediumConfidenceThreshold: 0.7,
            lowConfidenceThreshold: 0.5,
          },
        },
      );

      expect(result.routing.recommendedQueue).toBe('human-review');
      expect(result.routing.routingReason).toContain('medium confidence');
      expect(result.routing.priority).toBe('medium');
      expect(result.routing.reviewType).toBe('standard');
    });

    it('should route medium confidence with validation errors to expert review', async () => {
      const validationErrorInvoiceText = `
        Invoice: INV-2024-001
        Date: 2024-03-15
        Due Date: 2024-03-10
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(
        validationErrorInvoiceText,
        {
          type: 'invoice',
          requiredFields: [
            'invoiceNumber',
            'invoiceDate',
            'dueDate',
            'totalAmount',
          ],
          confidenceThreshold: 0.5,
          enableConfidenceBasedRouting: true,
          enableBusinessLogicValidation: true,
          routingRules: {
            mediumConfidenceThreshold: 0.7,
            validationErrorEscalation: true,
          },
        },
      );

      expect(result.routing.recommendedQueue).toBe('expert-review');
      expect(result.routing.routingReason).toContain('validation errors');
      expect(result.routing.priority).toBe('high');
    });
  });

  describe('Low Confidence Routing', () => {
    it('should route low confidence extractions to manual processing', async () => {
      const lowConfidenceInvoiceText = `
        unclear text
        some numbers: 123
        maybe date: ???
        total: unclear
      `;

      const result = await fieldService.extractFields(
        lowConfidenceInvoiceText,
        {
          type: 'invoice',
          requiredFields: ['invoiceNumber', 'totalAmount'],
          confidenceThreshold: 0.3,
          enableConfidenceBasedRouting: true,
          routingRules: {
            lowConfidenceThreshold: 0.5,
            manualProcessingThreshold: 0.4,
          },
        },
      );

      expect(result.routing.recommendedQueue).toBe('manual-processing');
      expect(result.routing.routingReason).toContain('low confidence');
      expect(result.routing.priority).toBe('high');
      expect(result.routing.requiresHumanIntervention).toBe(true);
    });

    it('should route failed extractions to error queue', async () => {
      const failedExtractionText = `
        completely unreadable text
        no structure
        random characters: @#$%^&*
      `;

      const result = await fieldService.extractFields(failedExtractionText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.3,
        enableConfidenceBasedRouting: true,
        routingRules: {
          errorThreshold: 0.2,
        },
      });

      expect(result.routing.recommendedQueue).toBe('error-queue');
      expect(result.routing.routingReason).toContain('extraction failed');
      expect(result.routing.priority).toBe('high');
      expect(result.routing.requiresReprocessing).toBe(true);
    });
  });

  describe('Specialized Routing Rules', () => {
    it('should route international invoices to compliance review', async () => {
      const internationalInvoiceText = `
        COMMERCIAL INVOICE
        Invoice: INT-2024-001
        Exporter: ABC Export Co.
        Importer: XYZ Import Ltd.
        Country: Canada
        HS Code: 8471.30.01
        Total: $5,000.00 USD
      `;

      const result = await fieldService.extractFields(
        internationalInvoiceText,
        {
          type: 'invoice',
          requiredFields: ['invoiceNumber', 'totalAmount'],
          confidenceThreshold: 0.7,
          enableConfidenceBasedRouting: true,
          enableBusinessLogicValidation: true,
          enableTradeCompliance: true,
          routingRules: {
            internationalInvoiceRouting: 'compliance-review',
          },
        },
      );

      expect(result.routing.recommendedQueue).toBe('compliance-review');
      expect(result.routing.routingReason).toContain('international trade');
      expect(result.routing.specialistRequired).toBe('trade-compliance');
    });

    it('should route healthcare invoices to specialized review', async () => {
      const healthcareInvoiceText = `
        MEDICAL INVOICE
        Provider: ABC Medical Center
        Provider NPI: 1234567890
        Patient: John Doe
        Procedure Code: 99213
        Total: $250.00
      `;

      const result = await fieldService.extractFields(healthcareInvoiceText, {
        type: 'invoice',
        industry: 'healthcare',
        requiredFields: ['vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableConfidenceBasedRouting: true,
        enableBusinessLogicValidation: true,
        routingRules: {
          industrySpecificRouting: {
            healthcare: 'healthcare-review',
            construction: 'construction-review',
            legal: 'legal-review',
          },
        },
      });

      expect(result.routing.recommendedQueue).toBe('healthcare-review');
      expect(result.routing.routingReason).toContain('healthcare industry');
      expect(result.routing.specialistRequired).toBe('healthcare-compliance');
    });

    it('should route high-risk invoices to fraud investigation', async () => {
      const suspiciousInvoiceText = `
        Invoice: INV-2024-001
        Vendor: New Vendor LLC
        Amount: $9,999.00
        Payment: Wire Transfer
        Urgency: Immediate Payment Required
      `;

      const result = await fieldService.extractFields(suspiciousInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableConfidenceBasedRouting: true,
        enableBusinessLogicValidation: true,
        enableRiskAssessment: true,
        routingRules: {
          fraudRiskThreshold: 0.7,
          fraudInvestigationQueue: 'fraud-investigation',
        },
      });

      expect(result.routing.recommendedQueue).toBe('fraud-investigation');
      expect(result.routing.routingReason).toContain('high fraud risk');
      expect(result.routing.priority).toBe('urgent');
      expect(result.routing.specialistRequired).toBe('fraud-investigator');
    });
  });

  describe('Dynamic Priority Assignment', () => {
    it('should assign urgent priority to time-sensitive invoices', async () => {
      const urgentInvoiceText = `
        URGENT INVOICE
        Invoice: INV-2024-001
        Due Date: Tomorrow
        Late Fee: $100.00
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(urgentInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableConfidenceBasedRouting: true,
        routingRules: {
          urgencyKeywords: ['urgent', 'immediate', 'asap', 'rush'],
          urgentPriorityBoost: true,
        },
      });

      expect(result.routing.priority).toBe('urgent');
      expect(result.routing.estimatedProcessingTime).toBeLessThan(30); // minutes
      expect(result.routing.slaDeadline).toBeDefined();
    });

    it('should assign priority based on vendor importance', async () => {
      const vipVendorInvoiceText = `
        Invoice: INV-2024-001
        Vendor: Strategic Partner Corp
        Contract: Premium Support
        Total: $5,000.00
      `;

      const result = await fieldService.extractFields(vipVendorInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableConfidenceBasedRouting: true,
        routingRules: {
          vipVendors: ['Strategic Partner Corp', 'Key Supplier Inc'],
          vipPriorityBoost: true,
        },
      });

      expect(result.routing.priority).toBe('high');
      expect(result.routing.routingReason).toContain('VIP vendor');
      expect(result.routing.slaDeadline).toBeDefined();
    });

    it('should assign priority based on amount thresholds', async () => {
      const highAmountInvoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $100,000.00
      `;

      const result = await fieldService.extractFields(highAmountInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableConfidenceBasedRouting: true,
        routingRules: {
          amountThresholds: [
            { amount: 100000, priority: 'urgent' },
            { amount: 50000, priority: 'high' },
            { amount: 10000, priority: 'medium' },
          ],
        },
      });

      expect(result.routing.priority).toBe('urgent');
      expect(result.routing.routingReason).toContain('high amount');
    });
  });

  describe('Queue Load Balancing', () => {
    it('should consider queue capacity in routing decisions', async () => {
      const standardInvoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(standardInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.8,
        enableConfidenceBasedRouting: true,
        routingRules: {
          enableLoadBalancing: true,
          queueCapacities: {
            'human-review': 50,
            'auto-approval': 100,
            'manager-review': 20,
          },
          currentQueueLoads: {
            'human-review': 45,
            'auto-approval': 30,
            'manager-review': 18,
          },
        },
      });

      expect(result.routing.recommendedQueue).toBe('auto-approval');
      expect(result.routing.loadBalancingApplied).toBe(true);
      expect(result.routing.alternativeQueues).toBeDefined();
    });

    it('should route to alternative queue when primary is full', async () => {
      const standardInvoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(standardInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.75,
        enableConfidenceBasedRouting: true,
        routingRules: {
          enableLoadBalancing: true,
          queueCapacities: {
            'human-review': 50,
            'expert-review': 30,
          },
          currentQueueLoads: {
            'human-review': 50, // Full
            'expert-review': 15,
          },
        },
      });

      expect(result.routing.recommendedQueue).toBe('expert-review');
      expect(result.routing.routingReason).toContain('load balancing');
      expect(result.routing.originalQueue).toBe('human-review');
    });
  });

  describe('SLA and Deadline Management', () => {
    it('should calculate SLA deadlines based on priority', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.8,
        enableConfidenceBasedRouting: true,
        routingRules: {
          slaTargets: {
            urgent: 30, // minutes
            high: 2, // hours
            medium: 24, // hours
            low: 72, // hours
          },
        },
      });

      expect(result.routing.slaDeadline).toBeDefined();
      expect(result.routing.slaTarget).toBeDefined();
      expect(result.routing.timeToDeadline).toBeGreaterThan(0);
    });

    it('should escalate overdue items', async () => {
      const overdueInvoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Total: $1,000.00
        Processing Started: 2 days ago
      `;

      const result = await fieldService.extractFields(overdueInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.8,
        enableConfidenceBasedRouting: true,
        routingRules: {
          escalationRules: {
            overdueThreshold: 24, // hours
            escalationQueue: 'escalation-queue',
          },
        },
        processingStartTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      });

      expect(result.routing.isOverdue).toBe(true);
      expect(result.routing.recommendedQueue).toBe('escalation-queue');
      expect(result.routing.escalationLevel).toBeGreaterThan(0);
    });
  });
});
