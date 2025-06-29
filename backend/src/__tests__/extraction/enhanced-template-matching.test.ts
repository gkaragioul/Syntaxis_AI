import { EnhancedTemplateMatchingService } from '../../services/enhanced-template-matching.service';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
const mockPrisma = {
  extraction: {
    findUnique: jest.fn(),
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
} as unknown as PrismaClient;

describe('Enhanced Template Matching', () => {
  let fieldService: EnhancedTemplateMatchingService;

  beforeEach(() => {
    jest.clearAllMocks();
    fieldService = new EnhancedTemplateMatchingService(mockPrisma);
  });

  describe('Template Recognition', () => {
    it('should recognize standard invoice templates', async () => {
      const standardInvoiceText = `
        INVOICE
        
        From: ABC Corporation
        123 Business Street
        New York, NY 10001
        
        To: Customer Inc
        456 Client Avenue
        Los Angeles, CA 90001
        
        Invoice Number: INV-2024-001
        Date: March 15, 2024
        Due Date: April 15, 2024
        
        Description          Qty    Price    Total
        Product A             2    $500.00  $1,000.00
        Service B             1    $234.56    $234.56
        
        Subtotal:                           $1,234.56
        Tax (8%):                             $98.76
        Total:                              $1,333.32
      `;

      const result = await fieldService.extractFields(standardInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'dueDate', 'vendorName', 'customerName', 'lineItems', 'subtotal', 'taxAmount', 'totalAmount'],
        confidenceThreshold: 0.7,
      });

      // Should recognize this as an invoice template (could be standard or product invoice)
      expect(result.templateMatch).toBeDefined();
      expect(result.templateMatch.templateType).toMatch(/invoice$/); // Ends with 'invoice'
      expect(result.templateMatch.confidence).toBeGreaterThan(0.8);
    });

    it('should recognize receipt templates', async () => {
      const receiptText = `
        RECEIPT
        
        Store: Quick Mart
        Location: 789 Main St
        
        Date: 2024-03-15
        Time: 14:30:25
        
        Item 1: Coffee        $3.50
        Item 2: Sandwich      $7.99
        Item 3: Chips         $2.49
        
        Subtotal:            $13.98
        Tax:                  $1.12
        Total:               $15.10
        
        Payment: Credit Card
        Thank you!
      `;

      const result = await fieldService.extractFields(receiptText, {
        type: 'receipt',
        requiredFields: ['vendorName', 'invoiceDate', 'lineItems', 'subtotal', 'taxAmount', 'totalAmount'],
        confidenceThreshold: 0.7,
      });

      // Should recognize this as a receipt template
      expect(result.templateMatch).toBeDefined();
      expect(result.templateMatch.templateType).toBe('receipt');
      expect(result.templateMatch.confidence).toBeGreaterThan(0.7);
    });

    it('should recognize service invoice templates', async () => {
      const serviceInvoiceText = `
        PROFESSIONAL SERVICES INVOICE
        
        Consultant: John Doe Consulting
        Client: Tech Startup Inc
        
        Invoice #: CONS-2024-001
        Period: March 1-15, 2024
        
        Services Rendered:
        - Software Development (40 hrs @ $150/hr)  $6,000.00
        - Code Review (8 hrs @ $100/hr)              $800.00
        - Documentation (4 hrs @ $75/hr)             $300.00
        
        Total Professional Fees:                   $7,100.00
      `;

      const result = await fieldService.extractFields(serviceInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'customerName', 'lineItems', 'totalAmount'],
        confidenceThreshold: 0.7,
      });

      // Should recognize this as a service invoice template
      expect(result.templateMatch).toBeDefined();
      expect(result.templateMatch.templateType).toBe('service_invoice');
      expect(result.templateMatch.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Similarity Scoring', () => {
    it('should calculate template similarity accurately', async () => {
      const template1Text = `
        Invoice Number: INV-001
        Date: 2024-01-01
        Total: $100.00
      `;

      const template2Text = `
        Invoice #: INV-002
        Date: 2024-01-02
        Amount: $200.00
      `;

      const result1 = await fieldService.extractFields(template1Text, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'totalAmount'],
        confidenceThreshold: 0.5,
      });

      const result2 = await fieldService.extractFields(template2Text, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'totalAmount'],
        confidenceThreshold: 0.5,
      });

      // Both should be recognized as similar invoice templates
      expect(result1.templateMatch).toBeDefined();
      expect(result2.templateMatch).toBeDefined();
      
      // Similarity should be high due to similar structure
      if (result1.templateMatch && result2.templateMatch) {
        expect(result1.templateMatch.templateType).toBe(result2.templateMatch.templateType);
      }
    });

    it('should distinguish between different template types', async () => {
      const invoiceText = `
        INVOICE
        Invoice Number: INV-001
        Total Amount: $1,000.00
      `;

      const receiptText = `
        RECEIPT
        Store: ABC Store
        Total: $50.00
      `;

      const invoiceResult = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.5,
      });

      const receiptResult = await fieldService.extractFields(receiptText, {
        type: 'receipt',
        requiredFields: ['vendorName', 'totalAmount'],
        confidenceThreshold: 0.5,
      });

      // Should recognize different template types
      expect(invoiceResult.templateMatch?.templateType).not.toBe(receiptResult.templateMatch?.templateType);
    });
  });

  describe('Automatic Template Selection', () => {
    it('should automatically select the best matching template', async () => {
      // Mock existing templates
      mockPrisma.template.findMany.mockResolvedValue([
        {
          id: 'template-1',
          name: 'Standard Invoice',
          templateType: 'standard_invoice',
          patterns: {
            invoiceNumber: ['Invoice Number:', 'Invoice #:'],
            totalAmount: ['Total:', 'Total Amount:'],
          },
          successRate: 0.95,
          usageCount: 100,
        },
        {
          id: 'template-2',
          name: 'Simple Receipt',
          templateType: 'receipt',
          patterns: {
            vendorName: ['Store:', 'Shop:'],
            totalAmount: ['Total:', 'Amount:'],
          },
          successRate: 0.88,
          usageCount: 50,
        },
      ]);

      const invoiceText = `
        Invoice Number: INV-2024-001
        Total Amount: $1,234.56
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.7,
        autoSelectTemplate: true,
      });

      // Should automatically select the best matching template
      expect(result.templateMatch).toBeDefined();
      expect(result.templateMatch.selectedTemplate).toBeDefined();
      expect(result.templateMatch.selectedTemplate.id).toBe('template-1');
    });

    it('should consider template success rate in selection', async () => {
      // Mock templates with different success rates
      mockPrisma.template.findMany.mockResolvedValue([
        {
          id: 'template-low',
          name: 'Low Success Template',
          templateType: 'invoice',
          patterns: {
            invoiceNumber: ['Inv:'],
            totalAmount: ['Amt:'],
          },
          successRate: 0.60,
          usageCount: 10,
        },
        {
          id: 'template-high',
          name: 'High Success Template',
          templateType: 'invoice',
          patterns: {
            invoiceNumber: ['Invoice Number:'],
            totalAmount: ['Total Amount:'],
          },
          successRate: 0.95,
          usageCount: 100,
        },
      ]);

      const invoiceText = `
        Invoice Number: INV-2024-001
        Total Amount: $1,234.56
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.7,
        autoSelectTemplate: true,
      });

      // Should prefer template with higher success rate
      expect(result.templateMatch.selectedTemplate.id).toBe('template-high');
    });
  });

  describe('Template Learning', () => {
    it('should learn from successful extractions', async () => {
      const successfulText = `
        Invoice ID: INV-2024-001
        Amount Due: $1,234.56
        Vendor: ABC Corp
      `;

      const result = await fieldService.extractFields(successfulText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount', 'vendorName'],
        confidenceThreshold: 0.7,
        enableLearning: true,
      });

      // Should learn new patterns from successful extraction
      expect(result.templateMatch).toBeDefined();
      expect(result.templateMatch.learnedPatterns).toBeDefined();
      expect(result.templateMatch.learnedPatterns.length).toBeGreaterThan(0);
    });

    it('should adapt templates based on extraction feedback', async () => {
      const adaptiveText = `
        Ref Number: REF-2024-001
        Final Total: $1,234.56
      `;

      const result = await fieldService.extractFields(adaptiveText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.5,
        enableLearning: true,
        adaptiveTemplates: true,
      });

      // Should adapt to new patterns
      expect(result.templateMatch).toBeDefined();
      if (result.templateMatch.adaptedPatterns) {
        expect(result.templateMatch.adaptedPatterns.invoiceNumber).toContain('Ref Number:');
        expect(result.templateMatch.adaptedPatterns.totalAmount).toContain('Final Total:');
      }
    });

    it('should create new templates for unique patterns', async () => {
      const uniqueText = `
        UNIQUE INVOICE FORMAT
        
        Document Reference: UNQ-2024-001
        Payment Required: $1,234.56
        Service Provider: Unique Corp
        
        Special Field: Special Value
      `;

      const result = await fieldService.extractFields(uniqueText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount', 'vendorName'],
        confidenceThreshold: 0.5,
        enableLearning: true,
        createNewTemplates: true,
      });

      // Should suggest creating a new template for unique patterns
      expect(result.templateMatch).toBeDefined();
      expect(result.templateMatch.suggestNewTemplate).toBe(true);
      expect(result.templateMatch.newTemplatePatterns).toBeDefined();
    });
  });

  describe('Template Performance Tracking', () => {
    it('should track template usage and success rates', async () => {
      const invoiceText = `
        Invoice Number: INV-2024-001
        Total Amount: $1,234.56
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.7,
        trackPerformance: true,
      });

      // Should track template performance
      expect(result.templateMatch).toBeDefined();
      expect(result.templateMatch.performanceMetrics).toBeDefined();
      expect(result.templateMatch.performanceMetrics.usageCount).toBeGreaterThan(0);
      expect(result.templateMatch.performanceMetrics.successRate).toBeGreaterThan(0);
    });

    it('should update template confidence based on historical performance', async () => {
      // Mock template with performance history
      mockPrisma.template.findMany.mockResolvedValue([
        {
          id: 'template-1',
          name: 'Reliable Template',
          templateType: 'invoice',
          patterns: {
            invoiceNumber: ['Invoice Number:'],
            totalAmount: ['Total Amount:'],
          },
          successRate: 0.95,
          usageCount: 1000,
          recentPerformance: [0.98, 0.96, 0.94, 0.97, 0.95], // Recent success rates
        },
      ]);

      const invoiceText = `
        Invoice Number: INV-2024-001
        Total Amount: $1,234.56
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.7,
        useHistoricalPerformance: true,
      });

      // Template confidence should be boosted by historical performance
      expect(result.templateMatch.confidence).toBeGreaterThan(0.9);
      expect(result.templateMatch.historicalConfidenceBoost).toBeGreaterThan(0);
    });
  });

  describe('Multi-Language Template Support', () => {
    it('should match templates across different languages', async () => {
      const spanishInvoiceText = `
        FACTURA
        
        Número de Factura: FAC-2024-001
        Fecha: 15 de Marzo, 2024
        Importe Total: €1.234,56
      `;

      const result = await fieldService.extractFields(spanishInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'totalAmount'],
        confidenceThreshold: 0.7,
        language: 'es',
      });

      // Should recognize Spanish invoice template
      expect(result.templateMatch).toBeDefined();
      expect(result.templateMatch.templateType).toBe('invoice');
      expect(result.templateMatch.language).toBe('es');
    });

    it('should auto-detect language and select appropriate templates', async () => {
      const germanInvoiceText = `
        RECHNUNG
        
        Rechnungsnummer: RG-2024-001
        Datum: 15. März 2024
        Gesamtbetrag: 1.234,56 €
      `;

      const result = await fieldService.extractFields(germanInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'totalAmount'],
        confidenceThreshold: 0.7,
        autoDetectLanguage: true,
      });

      // Should auto-detect German and use appropriate templates
      expect(result.templateMatch).toBeDefined();
      expect(result.templateMatch.detectedLanguage).toBe('de');
      expect(result.templateMatch.templateType).toBe('invoice');
    });
  });
});
