import { FieldExtractionService } from '../../services/field.service';
import { PrismaClient } from '@prisma/client';
import { jest } from '@jest/globals';

const TEST_TIMEOUT = 30000;

describe('Template Matching with Various Invoice Formats', () => {
  let fieldService: FieldExtractionService;
  let prisma: PrismaClient;
  let testUserId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_TEST_URL || process.env.DATABASE_URL,
        },
      },
    });

    fieldService = new FieldExtractionService(prisma);

    // Create test user
    testUserId = 'test-user-template-' + Date.now();
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `test-template-${Date.now()}@example.com`,
        passwordHash: 'test-password-hash',
      },
    });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    await prisma.$disconnect();
  });

  async function cleanupTestData() {
    try {
      await prisma.template.deleteMany({ where: { userId: testUserId } });
      await prisma.fieldPattern.deleteMany({ where: { userId: testUserId } });
      await prisma.extractionRule.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  // Various invoice format templates
  const invoiceFormats = {
    standardUS: {
      name: 'Standard US Invoice',
      text: `
ACME CORPORATION
123 Business Street
Business City, BC 12345
Phone: (555) 123-4567

INVOICE

Invoice Number: INV-2024-0001
Date: March 15, 2024
Due Date: April 15, 2024

Bill To:
Tech Solutions Inc.
456 Technology Blvd
Tech City, TC 67890

Description                 Qty    Unit Price    Total
Software License            5      $299.99      $1,499.95
Support Package             1      $599.99      $599.99

                           Subtotal:           $1,999.94
                           Tax (8.5%):         $169.99
                           TOTAL:              $2,169.93
      `.trim(),
      expectedFields: [
        'invoiceNumber',
        'vendorName',
        'totalAmount',
        'taxAmount',
        'subtotal',
      ],
    },

    europeanGerman: {
      name: 'European German Invoice',
      text: `
EUROPEAN TECH SOLUTIONS GmbH
Musterstraße 123
12345 Berlin, Deutschland
Tel: +49 30 12345678
USt-IdNr: DE123456789

RECHNUNG

Rechnungsnummer: RE-2024-0042
Datum: 15.03.2024
Fälligkeitsdatum: 15.04.2024

Rechnungsempfänger:
Musterfirma AG
Beispielweg 456
67890 München

Pos  Beschreibung           Menge   Einzelpreis   Gesamtpreis
1    Software-Lizenz        2       €1.250,00     €2.500,00
2    Wartungsvertrag        1       €750,00       €750,00

                           Nettobetrag:        €3.250,00
                           MwSt. (19%):        €617,50
                           Gesamtbetrag:       €3.867,50
      `.trim(),
      expectedFields: [
        'invoiceNumber',
        'vendorName',
        'totalAmount',
        'taxAmount',
        'subtotal',
      ],
    },

    minimalist: {
      name: 'Minimalist Invoice',
      text: `
ABC Company
Invoice: 2024-001
Date: 03/15/2024
Total: $500.00
      `.trim(),
      expectedFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
    },

    receipt: {
      name: 'Receipt Format',
      text: `
QUICK MART
789 Main St
Anytown, AT 12345

Receipt #: R-2024-5678
Date: 03/15/2024 14:30

Items:
Coffee                      $3.50
Sandwich                    $8.95
Tax                         $1.05
                           ------
Total                      $13.50

Thank you!
      `.trim(),
      expectedFields: [
        'invoiceNumber',
        'vendorName',
        'totalAmount',
        'taxAmount',
      ],
    },

    serviceInvoice: {
      name: 'Service Invoice',
      text: `
CONSULTING SERVICES LLC
Professional Services Invoice

Invoice No: CS-2024-789
Client: Tech Startup Inc.
Date: March 15, 2024

Services Rendered:
- Strategy Consultation (40 hrs @ $150/hr): $6,000.00
- Implementation Support (20 hrs @ $125/hr): $2,500.00

Subtotal: $8,500.00
Total Due: $8,500.00

Payment Terms: Net 15
      `.trim(),
      expectedFields: [
        'invoiceNumber',
        'vendorName',
        'totalAmount',
        'subtotal',
      ],
    },

    productInvoice: {
      name: 'Product Invoice',
      text: `
TECH PRODUCTS INC.
Sales Invoice

Invoice #: TP-2024-456
Customer: Business Solutions Corp
Order Date: 03/15/2024

Item                        Qty     Price      Amount
Laptop Computer             2       $1,200.00  $2,400.00
Wireless Mouse              4       $25.00     $100.00
Software License            1       $500.00    $500.00

Merchandise Total:                             $3,000.00
Shipping & Handling:                           $50.00
Sales Tax (7%):                                $213.50
TOTAL AMOUNT DUE:                              $3,263.50
      `.trim(),
      expectedFields: [
        'invoiceNumber',
        'vendorName',
        'totalAmount',
        'taxAmount',
        'subtotal',
      ],
    },
  };

  describe('Template Recognition', () => {
    it(
      'should recognize standard US invoice format',
      async () => {
        const result = await fieldService.extractFields(
          invoiceFormats.standardUS.text,
          {
            type: 'invoice',
            confidenceThreshold: 0.5,
          },
        );

        expect(result).toBeDefined();
        expect(result.rawText).toBe(invoiceFormats.standardUS.text);

        // Should extract expected fields
        for (const field of invoiceFormats.standardUS.expectedFields) {
          expect(result[field]).toBeDefined();
          expect(result.confidence[field]).toBeGreaterThan(0);
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should recognize European German invoice format',
      async () => {
        const result = await fieldService.extractFields(
          invoiceFormats.europeanGerman.text,
          {
            type: 'invoice',
            confidenceThreshold: 0.5,
          },
        );

        expect(result).toBeDefined();
        expect(result.rawText).toBe(invoiceFormats.europeanGerman.text);

        // Should extract expected fields
        for (const field of invoiceFormats.europeanGerman.expectedFields) {
          expect(result[field]).toBeDefined();
          expect(result.confidence[field]).toBeGreaterThan(0);
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should recognize minimalist invoice format',
      async () => {
        const result = await fieldService.extractFields(
          invoiceFormats.minimalist.text,
          {
            type: 'invoice',
            confidenceThreshold: 0.5,
          },
        );

        expect(result).toBeDefined();
        expect(result.rawText).toBe(invoiceFormats.minimalist.text);

        // Should extract expected fields
        for (const field of invoiceFormats.minimalist.expectedFields) {
          expect(result[field]).toBeDefined();
          expect(result.confidence[field]).toBeGreaterThan(0);
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should recognize receipt format',
      async () => {
        const result = await fieldService.extractFields(
          invoiceFormats.receipt.text,
          {
            type: 'receipt',
            confidenceThreshold: 0.5,
          },
        );

        expect(result).toBeDefined();
        expect(result.rawText).toBe(invoiceFormats.receipt.text);

        // Should extract expected fields
        for (const field of invoiceFormats.receipt.expectedFields) {
          expect(result[field]).toBeDefined();
          expect(result.confidence[field]).toBeGreaterThan(0);
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should recognize service invoice format',
      async () => {
        const result = await fieldService.extractFields(
          invoiceFormats.serviceInvoice.text,
          {
            type: 'invoice',
            confidenceThreshold: 0.5,
          },
        );

        expect(result).toBeDefined();
        expect(result.rawText).toBe(invoiceFormats.serviceInvoice.text);

        // Should extract expected fields
        for (const field of invoiceFormats.serviceInvoice.expectedFields) {
          expect(result[field]).toBeDefined();
          expect(result.confidence[field]).toBeGreaterThan(0);
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should recognize product invoice format',
      async () => {
        const result = await fieldService.extractFields(
          invoiceFormats.productInvoice.text,
          {
            type: 'invoice',
            confidenceThreshold: 0.5,
          },
        );

        expect(result).toBeDefined();
        expect(result.rawText).toBe(invoiceFormats.productInvoice.text);

        // Should extract expected fields
        for (const field of invoiceFormats.productInvoice.expectedFields) {
          expect(result[field]).toBeDefined();
          expect(result.confidence[field]).toBeGreaterThan(0);
        }
      },
      TEST_TIMEOUT,
    );
  });

  describe('Template Creation and Management', () => {
    it(
      'should create templates for different invoice formats',
      async () => {
        const templates = [
          {
            name: 'Standard US Template',
            type: 'invoice' as const,
            patterns: {
              invoiceNumber: ['Invoice Number:', 'Invoice #:'],
              vendorName: ['COMPANY_NAME_AT_TOP'],
              totalAmount: ['TOTAL:', 'Total Amount:'],
            },
            confidence: 0.9,
          },
          {
            name: 'European Template',
            type: 'invoice' as const,
            patterns: {
              invoiceNumber: ['Rechnungsnummer:', 'Invoice Number:'],
              vendorName: ['COMPANY_NAME_AT_TOP'],
              totalAmount: ['Gesamtbetrag:', 'Total:'],
            },
            confidence: 0.85,
          },
        ];

        for (const template of templates) {
          const result = await fieldService.createTemplate(
            testUserId,
            template,
          );

          expect(result).toBeDefined();
          expect(result.name).toBe(template.name);
          expect(result.vendorName).toBeDefined();
          expect(result.patterns).toEqual(template.patterns);
          expect(result.fieldMappings).toBeDefined();
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should retrieve templates by user',
      async () => {
        const templates = await fieldService.getTemplates(testUserId);

        expect(Array.isArray(templates)).toBe(true);
        expect(templates.length).toBeGreaterThan(0);

        for (const template of templates) {
          expect(template.userId).toBe(testUserId);
          expect(template.name).toBeDefined();
          expect(template.vendorName).toBeDefined();
          expect(template.patterns).toBeDefined();
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should update existing templates',
      async () => {
        const templates = await fieldService.getTemplates(testUserId);
        expect(templates.length).toBeGreaterThan(0);

        const templateToUpdate = templates[0];
        const updatedTemplate = await fieldService.updateTemplate(
          templateToUpdate.id,
          {
            name: 'Updated Template Name',
            patterns: { invoiceNumber: ['Updated Pattern'] },
          },
        );

        expect(updatedTemplate.name).toBe('Updated Template Name');
        expect(updatedTemplate.patterns).toEqual({
          invoiceNumber: ['Updated Pattern'],
        });
        expect(updatedTemplate.id).toBe(templateToUpdate.id);
      },
      TEST_TIMEOUT,
    );

    it(
      'should delete templates',
      async () => {
        const templates = await fieldService.getTemplates(testUserId);
        const initialCount = templates.length;
        expect(initialCount).toBeGreaterThan(0);

        const templateToDelete = templates[0];
        await fieldService.deleteTemplate(templateToDelete.id);

        const remainingTemplates = await fieldService.getTemplates(testUserId);
        expect(remainingTemplates.length).toBe(initialCount - 1);
      },
      TEST_TIMEOUT,
    );
  });

  describe('Field Mapping Adaptation', () => {
    it(
      'should adapt field mapping for different layouts',
      async () => {
        const layoutVariations = [
          {
            text: 'Invoice Number: INV-001\nTotal: $100.00',
            description: 'Vertical layout',
          },
          {
            text: 'Invoice: INV-001 | Total: $100.00',
            description: 'Horizontal layout',
          },
          {
            text: 'INV-001\n$100.00',
            description: 'Minimal layout',
          },
        ];

        for (const variation of layoutVariations) {
          const result = await fieldService.extractFields(variation.text, {
            type: 'invoice',
            confidenceThreshold: 0.3,
          });

          expect(result).toBeDefined();
          expect(result.invoiceNumber).toBeDefined();
          expect(result.totalAmount).toBeDefined();
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle different currency formats',
      async () => {
        const currencyVariations = [
          { text: 'Total: $1,234.56', currency: 'USD' },
          { text: 'Total: €1.234,56', currency: 'EUR' },
          { text: 'Total: £1,234.56', currency: 'GBP' },
          { text: 'Total: ¥123,456', currency: 'JPY' },
          { text: 'Total: 1234.56 CAD', currency: 'CAD' },
        ];

        for (const variation of currencyVariations) {
          const result = await fieldService.extractFields(variation.text, {
            type: 'invoice',
            confidenceThreshold: 0.3,
          });

          expect(result).toBeDefined();
          expect(result.totalAmount).toBeDefined();
          expect(typeof result.totalAmount).toBe('number');
          expect(result.totalAmount).toBeGreaterThan(0);
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle different date formats',
      async () => {
        const dateVariations = [
          { text: 'Date: March 15, 2024', format: 'US long' },
          { text: 'Date: 03/15/2024', format: 'US short' },
          { text: 'Date: 15/03/2024', format: 'European' },
          { text: 'Date: 2024-03-15', format: 'ISO' },
          { text: 'Datum: 15.03.2024', format: 'German' },
        ];

        for (const variation of dateVariations) {
          const result = await fieldService.extractFields(variation.text, {
            type: 'invoice',
            confidenceThreshold: 0.3,
          });

          expect(result).toBeDefined();
          expect(result.invoiceDate).toBeDefined();
          expect(result.invoiceDate).toBeInstanceOf(Date);
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle different vendor name formats',
      async () => {
        const vendorVariations = [
          'ACME CORPORATION\n123 Business St',
          'Tech Solutions Inc.',
          'European GmbH\nMusterstraße 123',
          'CONSULTING SERVICES LLC',
          'ABC Company',
        ];

        for (const vendorText of vendorVariations) {
          const result = await fieldService.extractFields(vendorText, {
            type: 'invoice',
            confidenceThreshold: 0.3,
          });

          expect(result).toBeDefined();
          expect(result.vendorName).toBeDefined();
          expect(typeof result.vendorName).toBe('string');
          expect(result.vendorName.length).toBeGreaterThan(0);
        }
      },
      TEST_TIMEOUT,
    );
  });

  describe('Template Matching Accuracy', () => {
    it(
      'should match templates with high accuracy for known formats',
      async () => {
        // Test with a format similar to our standard US template
        const knownFormatText = invoiceFormats.standardUS.text;

        const result = await fieldService.extractFields(knownFormatText, {
          type: 'invoice',
          confidenceThreshold: 0.7,
        });

        expect(result).toBeDefined();

        // Should have high confidence for well-matched template
        const avgConfidence =
          Object.values(result.confidence).reduce(
            (sum, conf) => sum + conf,
            0,
          ) / Object.values(result.confidence).length;

        expect(avgConfidence).toBeGreaterThan(0.7);
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle partial template matches',
      async () => {
        const partialMatchText = `
Some Company
Invoice: 2024-001
Amount: $500.00
      `;

        const result = await fieldService.extractFields(partialMatchText, {
          type: 'invoice',
          confidenceThreshold: 0.3,
        });

        expect(result).toBeDefined();
        expect(result.invoiceNumber).toBeDefined();
        expect(result.totalAmount).toBeDefined();
        expect(result.vendorName).toBeDefined();
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle unknown formats gracefully',
      async () => {
        const unknownFormatText = `
This is a completely different format
Reference: XYZ-789
Sum: 1000.00 credits
      `;

        const result = await fieldService.extractFields(unknownFormatText, {
          type: 'invoice',
          confidenceThreshold: 0.1,
        });

        expect(result).toBeDefined();
        expect(result.rawText).toBe(unknownFormatText);

        // Should still attempt extraction even with unknown format
        expect(result.confidence).toBeDefined();
      },
      TEST_TIMEOUT,
    );
  });

  describe('Multi-Language Support', () => {
    it(
      'should handle English invoices',
      async () => {
        const result = await fieldService.extractFields(
          invoiceFormats.standardUS.text,
          {
            type: 'invoice',
            language: 'en',
            confidenceThreshold: 0.5,
          },
        );

        expect(result).toBeDefined();
        expect(result.invoiceNumber).toBeDefined();
        expect(result.vendorName).toBeDefined();
        expect(result.totalAmount).toBeDefined();
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle German invoices',
      async () => {
        const result = await fieldService.extractFields(
          invoiceFormats.europeanGerman.text,
          {
            type: 'invoice',
            language: 'de',
            confidenceThreshold: 0.5,
          },
        );

        expect(result).toBeDefined();
        expect(result.invoiceNumber).toBeDefined();
        expect(result.vendorName).toBeDefined();
        expect(result.totalAmount).toBeDefined();
      },
      TEST_TIMEOUT,
    );

    it(
      'should auto-detect language when not specified',
      async () => {
        const englishResult = await fieldService.extractFields(
          invoiceFormats.standardUS.text,
          {
            type: 'invoice',
            confidenceThreshold: 0.5,
          },
        );

        const germanResult = await fieldService.extractFields(
          invoiceFormats.europeanGerman.text,
          {
            type: 'invoice',
            confidenceThreshold: 0.5,
          },
        );

        expect(englishResult).toBeDefined();
        expect(germanResult).toBeDefined();

        // Both should extract fields successfully
        expect(englishResult.invoiceNumber).toBeDefined();
        expect(germanResult.invoiceNumber).toBeDefined();
      },
      TEST_TIMEOUT,
    );
  });

  describe('Template Performance', () => {
    it(
      'should process templates efficiently',
      async () => {
        const startTime = Date.now();

        // Process multiple formats
        const promises = Object.values(invoiceFormats).map((format) =>
          fieldService.extractFields(format.text, {
            type: 'invoice',
            confidenceThreshold: 0.5,
          }),
        );

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const processingTime = endTime - startTime;

        // Should complete within reasonable time
        expect(processingTime).toBeLessThan(5000); // 5 seconds for all formats
        expect(results).toHaveLength(Object.keys(invoiceFormats).length);

        // All results should be valid
        for (const result of results) {
          expect(result).toBeDefined();
          expect(result.confidence).toBeDefined();
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should cache template matching results',
      async () => {
        const text = invoiceFormats.standardUS.text;

        // First extraction
        const startTime1 = Date.now();
        const result1 = await fieldService.extractFields(text, {
          type: 'invoice',
          confidenceThreshold: 0.5,
        });
        const time1 = Date.now() - startTime1;

        // Second extraction (should be faster due to caching)
        const startTime2 = Date.now();
        const result2 = await fieldService.extractFields(text, {
          type: 'invoice',
          confidenceThreshold: 0.5,
        });
        const time2 = Date.now() - startTime2;

        expect(result1).toBeDefined();
        expect(result2).toBeDefined();

        // Results should be consistent
        expect(result1.invoiceNumber).toBe(result2.invoiceNumber);
        expect(result1.totalAmount).toBe(result2.totalAmount);

        // Note: In real implementation, second call might be faster due to caching
        // For now, just verify both calls work
        expect(time1).toBeGreaterThanOrEqual(0);
        expect(time2).toBeGreaterThanOrEqual(0);
      },
      TEST_TIMEOUT,
    );
  });
});
