import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

describe('Enhanced Invoice Models', () => {
  let testUserId: string;
  let testExtractionId: string;
  let testFileId: string;

  beforeAll(async () => {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: `test-${uuidv4()}@example.com`,
        passwordHash: 'hashed_password',
      },
    });
    testUserId = testUser.id;

    // Create test file
    const testFile = await prisma.file.create({
      data: {
        userId: testUserId,
        filename: 'test-invoice.pdf',
        originalFilename: 'test-invoice.pdf',
        filePath: '/test/path',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileHash: 'test-hash-123',
        status: 'processed',
      },
    });
    testFileId = testFile.id;

    // Create test extraction
    const testExtraction = await prisma.extraction.create({
      data: {
        userId: testUserId,
        fileId: testFileId,
        extractionConfidence: 0.85,
        processingTimeMs: 1000,
      },
    });
    testExtractionId = testExtraction.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.invoiceValidationResult.deleteMany({ where: { userId: testUserId } });
    await prisma.invoiceAttachment.deleteMany({ where: { userId: testUserId } });
    await prisma.invoiceLineItem.deleteMany({ where: { userId: testUserId } });
    await prisma.invoice.deleteMany({ where: { userId: testUserId } });
    await prisma.extraction.deleteMany({ where: { userId: testUserId } });
    await prisma.file.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe('Enhanced Invoice Model', () => {
    it('should create invoice with enhanced validation metadata', async () => {
      const invoiceData = {
        userId: testUserId,
        extractionId: testExtractionId,
        invoiceNumber: 'INV-2024-001',
        invoiceDate: new Date('2024-03-15'),
        dueDate: new Date('2024-04-15'),
        vendorName: 'ABC Corporation',
        vendorAddress: '123 Business St, New York, NY 10001',
        vendorTaxId: '12-3456789',
        customerName: 'Customer Inc',
        customerAddress: '456 Client Ave, Los Angeles, CA 90001',
        subtotal: 1000.00,
        taxAmount: 100.00,
        totalAmount: 1100.00,
        currency: 'USD',
        paymentTerms: 'Net 30',
        metadata: {
          extractionConfidence: {
            invoiceNumber: 0.95,
            totalAmount: 0.92,
            vendorName: 0.88,
            customerName: 0.85,
          },
          validationResults: {
            isValid: true,
            errors: [],
            warnings: ['Minor date format inconsistency'],
            businessRulesPassed: 5,
            totalBusinessRules: 5,
          },
          templateMatch: {
            templateType: 'standard_invoice',
            templateId: 'builtin-standard-invoice',
            confidence: 0.90,
            similarityScore: 0.88,
          },
          ocrQuality: {
            overallScore: 0.92,
            textClarity: 0.94,
            structureRecognition: 0.90,
          },
          processingMetrics: {
            extractionTime: 2.5,
            validationTime: 0.8,
            templateMatchingTime: 0.3,
          },
        },
      };

      const invoice = await prisma.invoice.create({
        data: invoiceData,
      });

      expect(invoice).toBeDefined();
      expect(invoice.id).toBeTruthy();
      expect(invoice.invoiceNumber).toBe('INV-2024-001');
      expect(invoice.metadata).toBeDefined();
      
      // Verify enhanced metadata structure
      const metadata = invoice.metadata as any;
      expect(metadata.extractionConfidence).toBeDefined();
      expect(metadata.validationResults).toBeDefined();
      expect(metadata.templateMatch).toBeDefined();
      expect(metadata.ocrQuality).toBeDefined();
      expect(metadata.processingMetrics).toBeDefined();
    });

    it('should create invoice with confidence scores for each field', async () => {
      const invoiceData = {
        userId: testUserId,
        extractionId: testExtractionId,
        invoiceNumber: 'INV-2024-002',
        totalAmount: 500.00,
        metadata: {
          fieldConfidences: {
            invoiceNumber: 0.98,
            invoiceDate: 0.85,
            totalAmount: 0.92,
            vendorName: 0.78,
            customerName: 0.82,
            subtotal: 0.88,
            taxAmount: 0.90,
          },
          overallConfidence: 0.87,
          confidenceFactors: {
            patternMatch: 0.90,
            contextualRelevance: 0.85,
            dataQuality: 0.88,
            mathematicalConsistency: 0.95,
            fieldCompleteness: 0.80,
            validationScore: 0.92,
          },
        },
      };

      const invoice = await prisma.invoice.create({
        data: invoiceData,
      });

      const metadata = invoice.metadata as any;
      expect(metadata.fieldConfidences).toBeDefined();
      expect(metadata.overallConfidence).toBe(0.87);
      expect(metadata.confidenceFactors).toBeDefined();
      expect(metadata.confidenceFactors.patternMatch).toBe(0.90);
    });

    it('should create invoice with template association metadata', async () => {
      const invoiceData = {
        userId: testUserId,
        extractionId: testExtractionId,
        invoiceNumber: 'INV-2024-003',
        totalAmount: 750.00,
        metadata: {
          templateAssociation: {
            selectedTemplateId: 'template-123',
            templateName: 'Standard Business Invoice',
            templateType: 'standard_invoice',
            matchConfidence: 0.92,
            similarityScore: 0.89,
            matchedPatterns: [
              { field: 'invoiceNumber', pattern: 'Invoice Number:', confidence: 0.95 },
              { field: 'totalAmount', pattern: 'Total Amount:', confidence: 0.90 },
              { field: 'vendorName', pattern: 'From:', confidence: 0.88 },
            ],
            enhancedFields: ['dueDate', 'paymentTerms'],
            templatePerformance: {
              usageCount: 150,
              successRate: 0.94,
              averageConfidence: 0.89,
            },
          },
          languageDetection: {
            detectedLanguage: 'en',
            confidence: 0.98,
            alternativeLanguages: [
              { language: 'es', confidence: 0.15 },
              { language: 'fr', confidence: 0.08 },
            ],
          },
        },
      };

      const invoice = await prisma.invoice.create({
        data: invoiceData,
      });

      const metadata = invoice.metadata as any;
      expect(metadata.templateAssociation).toBeDefined();
      expect(metadata.templateAssociation.selectedTemplateId).toBe('template-123');
      expect(metadata.templateAssociation.matchedPatterns).toHaveLength(3);
      expect(metadata.languageDetection).toBeDefined();
      expect(metadata.languageDetection.detectedLanguage).toBe('en');
    });
  });

  describe('Enhanced Line Item Model', () => {
    let testInvoiceId: string;

    beforeAll(async () => {
      const invoice = await prisma.invoice.create({
        data: {
          userId: testUserId,
          extractionId: testExtractionId,
          invoiceNumber: 'INV-2024-LINEITEMS',
          totalAmount: 1000.00,
        },
      });
      testInvoiceId = invoice.id;
    });

    it('should create line items with enhanced extraction metadata', async () => {
      const lineItemData = {
        invoiceId: testInvoiceId,
        userId: testUserId,
        description: 'Professional Services - Software Development',
        quantity: 40,
        unitPrice: 150.00,
        amount: 6000.00,
        taxRate: 0.08,
        taxAmount: 480.00,
        metadata: {
          extractionConfidence: {
            description: 0.92,
            quantity: 0.95,
            unitPrice: 0.90,
            amount: 0.88,
          },
          patternMatches: [
            { pattern: 'Professional Services', confidence: 0.95 },
            { pattern: '40 hrs @ $150/hr', confidence: 0.90 },
          ],
          calculationValidation: {
            isValid: true,
            calculatedAmount: 6000.00,
            discrepancy: 0.00,
            confidence: 1.00,
          },
          itemType: 'service',
          category: 'professional_services',
          extractionMethod: 'structured_table',
        },
      };

      const lineItem = await prisma.invoiceLineItem.create({
        data: lineItemData,
      });

      expect(lineItem).toBeDefined();
      expect(lineItem.description).toBe('Professional Services - Software Development');
      
      const metadata = lineItem.metadata as any;
      expect(metadata.extractionConfidence).toBeDefined();
      expect(metadata.calculationValidation.isValid).toBe(true);
      expect(metadata.itemType).toBe('service');
    });

    it('should create line items with product-specific metadata', async () => {
      const productLineItemData = {
        invoiceId: testInvoiceId,
        userId: testUserId,
        description: 'Laptop Computer - Model XYZ123',
        quantity: 2,
        unitPrice: 1200.00,
        amount: 2400.00,
        metadata: {
          productDetails: {
            sku: 'XYZ123',
            category: 'electronics',
            brand: 'TechCorp',
            model: 'XYZ123',
          },
          extractionContext: {
            tableRow: 2,
            columnMapping: {
              description: 'A',
              quantity: 'B',
              unitPrice: 'C',
              amount: 'D',
            },
          },
          qualityIndicators: {
            textClarity: 0.95,
            numberAccuracy: 0.98,
            structuralIntegrity: 0.92,
          },
        },
      };

      const lineItem = await prisma.invoiceLineItem.create({
        data: productLineItemData,
      });

      const metadata = lineItem.metadata as any;
      expect(metadata.productDetails).toBeDefined();
      expect(metadata.productDetails.sku).toBe('XYZ123');
      expect(metadata.extractionContext.tableRow).toBe(2);
    });
  });

  describe('Enhanced Validation Results Model', () => {
    let testInvoiceId: string;

    beforeAll(async () => {
      const invoice = await prisma.invoice.create({
        data: {
          userId: testUserId,
          extractionId: testExtractionId,
          invoiceNumber: 'INV-2024-VALIDATION',
          totalAmount: 800.00,
        },
      });
      testInvoiceId = invoice.id;
    });

    it('should create detailed validation results with enhanced metadata', async () => {
      const validationData = {
        invoiceId: testInvoiceId,
        userId: testUserId,
        field: 'totalAmount',
        status: 'warning',
        message: 'Total amount calculation has minor discrepancy',
        severity: 'low',
        metadata: {
          validationType: 'mathematical_consistency',
          expectedValue: 800.00,
          actualValue: 799.98,
          discrepancy: 0.02,
          tolerance: 0.01,
          businessRule: 'total_equals_subtotal_plus_tax',
          confidenceImpact: -0.05,
          suggestedAction: 'review_calculation',
          relatedFields: ['subtotal', 'taxAmount'],
          validationTimestamp: new Date().toISOString(),
        },
      };

      const validationResult = await prisma.invoiceValidationResult.create({
        data: validationData,
      });

      expect(validationResult).toBeDefined();
      expect(validationResult.field).toBe('totalAmount');
      expect(validationResult.status).toBe('warning');
      
      const metadata = validationResult.metadata as any;
      expect(metadata.validationType).toBe('mathematical_consistency');
      expect(metadata.discrepancy).toBe(0.02);
      expect(metadata.relatedFields).toContain('subtotal');
    });

    it('should create validation results for field format validation', async () => {
      const formatValidationData = {
        invoiceId: testInvoiceId,
        userId: testUserId,
        field: 'invoiceNumber',
        status: 'passed',
        message: 'Invoice number format is valid',
        severity: 'info',
        metadata: {
          validationType: 'format_validation',
          pattern: '^[A-Z]{2,}-[0-9]{4}-[0-9]{3,}$',
          matchResult: true,
          extractedValue: 'INV-2024-001',
          formatConfidence: 0.95,
          alternativeFormats: [
            { pattern: '^[A-Z0-9\\-]+$', confidence: 0.85 },
            { pattern: '^[0-9]+$', confidence: 0.20 },
          ],
        },
      };

      const validationResult = await prisma.invoiceValidationResult.create({
        data: formatValidationData,
      });

      const metadata = validationResult.metadata as any;
      expect(metadata.validationType).toBe('format_validation');
      expect(metadata.matchResult).toBe(true);
      expect(metadata.alternativeFormats).toHaveLength(2);
    });

    it('should create validation results for business rule validation', async () => {
      const businessRuleValidationData = {
        invoiceId: testInvoiceId,
        userId: testUserId,
        field: 'dueDate',
        status: 'error',
        message: 'Due date cannot be before invoice date',
        severity: 'high',
        metadata: {
          validationType: 'business_rule',
          ruleName: 'due_date_after_invoice_date',
          ruleDescription: 'Due date must be on or after the invoice date',
          invoiceDate: '2024-03-15',
          dueDate: '2024-03-10',
          daysDifference: -5,
          suggestedCorrection: '2024-04-15',
          impactAssessment: {
            confidenceReduction: 0.3,
            processingRisk: 'high',
            userActionRequired: true,
          },
        },
      };

      const validationResult = await prisma.invoiceValidationResult.create({
        data: businessRuleValidationData,
      });

      const metadata = validationResult.metadata as any;
      expect(metadata.validationType).toBe('business_rule');
      expect(metadata.ruleName).toBe('due_date_after_invoice_date');
      expect(metadata.daysDifference).toBe(-5);
      expect(metadata.impactAssessment.userActionRequired).toBe(true);
    });
  });

  describe('Model Relationships and Queries', () => {
    it('should query invoice with all enhanced relationships', async () => {
      // Create a complete invoice with all relationships
      const invoice = await prisma.invoice.create({
        data: {
          userId: testUserId,
          extractionId: testExtractionId,
          invoiceNumber: 'INV-2024-COMPLETE',
          totalAmount: 1500.00,
          metadata: {
            extractionConfidence: { overall: 0.90 },
            templateMatch: { templateType: 'standard_invoice' },
          },
        },
      });

      // Add line items
      await prisma.invoiceLineItem.createMany({
        data: [
          {
            invoiceId: invoice.id,
            userId: testUserId,
            description: 'Item 1',
            quantity: 1,
            unitPrice: 1000.00,
            amount: 1000.00,
          },
          {
            invoiceId: invoice.id,
            userId: testUserId,
            description: 'Item 2',
            quantity: 1,
            unitPrice: 500.00,
            amount: 500.00,
          },
        ],
      });

      // Add validation results
      await prisma.invoiceValidationResult.create({
        data: {
          invoiceId: invoice.id,
          userId: testUserId,
          field: 'totalAmount',
          status: 'passed',
          message: 'Total amount validation passed',
          severity: 'info',
        },
      });

      // Query with all relationships
      const completeInvoice = await prisma.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          lineItems: true,
          validationResults: true,
          extraction: true,
          attachments: true,
        },
      });

      expect(completeInvoice).toBeDefined();
      expect(completeInvoice?.lineItems).toHaveLength(2);
      expect(completeInvoice?.validationResults).toHaveLength(1);
      expect(completeInvoice?.extraction).toBeDefined();
      expect(completeInvoice?.metadata).toBeDefined();
    });

    it('should support complex queries with enhanced metadata', async () => {
      // Query invoices with high confidence scores
      const highConfidenceInvoices = await prisma.invoice.findMany({
        where: {
          userId: testUserId,
          metadata: {
            path: ['extractionConfidence', 'overall'],
            gte: 0.85,
          },
        },
      });

      expect(Array.isArray(highConfidenceInvoices)).toBe(true);

      // Query invoices by template type
      const standardInvoices = await prisma.invoice.findMany({
        where: {
          userId: testUserId,
          metadata: {
            path: ['templateMatch', 'templateType'],
            equals: 'standard_invoice',
          },
        },
      });

      expect(Array.isArray(standardInvoices)).toBe(true);
    });
  });
});
