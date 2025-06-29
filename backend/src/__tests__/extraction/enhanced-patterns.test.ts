import { EnhancedFieldExtractionService } from '../../services/enhanced-field.service';
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
} as unknown as PrismaClient;

// Add custom Jest matcher
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },
});

describe('Enhanced Pattern Recognition', () => {
  let fieldService: EnhancedFieldExtractionService;

  beforeEach(() => {
    jest.clearAllMocks();
    fieldService = new EnhancedFieldExtractionService(mockPrisma);
  });

  describe('Fuzzy Pattern Matching', () => {
    it('should handle OCR errors in field labels', async () => {
      const noisyText = `
        lnvoice Number: INV-2024-001
        0ate: March 15, 2024
        Tota1 Amount: $1,234.56
        Vend0r: ABC Corp
      `;

      const result = await fieldService.extractFields(noisyText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'totalAmount', 'vendorName'],
        confidenceThreshold: 0.6,
      });

      expect(result.invoiceNumber).toBe('INV-2024-001');
      expect(result.totalAmount).toBe(1234.56);
      expect(result.vendorName).toBe('ABC Corp');
      // Confidence should be lower due to OCR errors but still acceptable
      expect(result.confidence.invoiceNumber).toBeGreaterThan(0.6);
    });

    it('should handle partial matches with confidence scoring', async () => {
      const partialText = `
        Inv: 2024-001
        Amt: $500.00
        From: XYZ Inc
      `;

      const result = await fieldService.extractFields(partialText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount', 'vendorName'],
        confidenceThreshold: 0.5,
      });

      expect(result.invoiceNumber).toBe('2024-001');
      expect(result.totalAmount).toBe(500.00);
      expect(result.vendorName).toBe('XYZ Inc');
      // Confidence should reflect partial matches
      expect(result.confidence.invoiceNumber).toBeLessThan(0.9);
      expect(result.confidence.invoiceNumber).toBeGreaterThan(0.5);
    });
  });

  describe('Advanced Regex Patterns', () => {
    it('should extract complex invoice numbers', async () => {
      const testCases = [
        { text: 'Invoice: 2024-Q1-001-REV', expected: '2024-Q1-001-REV' },
        { text: 'Ref#: ABC/2024/03/001', expected: 'ABC/2024/03/001' },
        { text: 'Doc ID: [INV-2024-001]', expected: 'INV-2024-001' },
        { text: 'Number: (2024) 001-A', expected: '(2024) 001-A' },
      ];

      for (const testCase of testCases) {
        const result = await fieldService.extractFields(testCase.text, {
          type: 'invoice',
          requiredFields: ['invoiceNumber'],
          confidenceThreshold: 0.7,
        });

        expect(result.invoiceNumber).toBe(testCase.expected);
      }
    });

    it('should extract amounts with various currency symbols', async () => {
      const testCases = [
        { text: 'Total: $1,234.56', expected: 1234.56, currency: 'USD' },
        { text: 'Amount: €1.234,56', expected: 1234.56, currency: 'EUR' },
        { text: 'Sum: £1,234.56', expected: 1234.56, currency: 'GBP' },
        { text: 'Total: ¥123,456', expected: 123456, currency: 'JPY' },
        { text: 'Amount: ₹1,23,456.78', expected: 123456.78, currency: 'INR' },
      ];

      for (const testCase of testCases) {
        const result = await fieldService.extractFields(testCase.text, {
          type: 'invoice',
          requiredFields: ['totalAmount', 'currency'],
          confidenceThreshold: 0.7,
        });

        expect(result.totalAmount).toBe(testCase.expected);
        expect(result.currency).toBe(testCase.currency);
      }
    });

    it('should extract dates in multiple formats', async () => {
      const testCases = [
        { text: 'Date: 2024-03-15', expected: new Date('2024-03-15') },
        { text: 'Due: 15/03/2024', expected: new Date('2024-03-15') },
        { text: 'Issued: Mar 15, 2024', expected: new Date('2024-03-15') },
        { text: 'Date: 15-Mar-2024', expected: new Date('2024-03-15') },
        { text: 'Due Date: March 15th, 2024', expected: new Date('2024-03-15') },
      ];

      for (const testCase of testCases) {
        const result = await fieldService.extractFields(testCase.text, {
          type: 'invoice',
          requiredFields: ['invoiceDate'],
          confidenceThreshold: 0.7,
        });

        expect(result.invoiceDate).toEqual(testCase.expected);
      }
    });
  });

  describe('Pattern Priority and Weighting', () => {
    it('should prioritize high-priority patterns', async () => {
      const ambiguousText = `
        Invoice: INV-001
        Reference: REF-002
        Document: DOC-003
      `;

      // Mock pattern priorities
      mockPrisma.fieldPattern.findMany.mockResolvedValue([
        {
          field: 'invoiceNumber',
          patterns: ['Invoice:', 'Reference:', 'Document:'],
          priority: 1, // Highest priority for 'Invoice:'
        },
      ]);

      const result = await fieldService.extractFields(ambiguousText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber'],
        confidenceThreshold: 0.7,
      });

      // Should prefer 'Invoice:' due to higher priority
      expect(result.invoiceNumber).toBe('INV-001');
    });

    it('should handle pattern conflicts with confidence weighting', async () => {
      const conflictText = `
        Total Amount: $1,000.00
        Grand Total: $1,234.56
        Final Total: $999.99
      `;

      const result = await fieldService.extractFields(conflictText, {
        type: 'invoice',
        requiredFields: ['totalAmount'],
        confidenceThreshold: 0.7,
      });

      // Should extract the most confident match
      expect(result.totalAmount).toBeOneOf([1000.00, 1234.56, 999.99]);
      expect(result.confidence.totalAmount).toBeGreaterThan(0.7);
    });
  });

  describe('Context-Aware Extraction', () => {
    it('should distinguish between vendor and customer information', async () => {
      const invoiceText = `
        FROM:
        ABC Corporation
        123 Vendor Street
        New York, NY 10001
        
        TO:
        XYZ Customer Inc
        456 Customer Ave
        Los Angeles, CA 90001
        
        Invoice: INV-2024-001
        Total: $1,234.56
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['vendorName', 'vendorAddress', 'customerName', 'customerAddress'],
        confidenceThreshold: 0.7,
      });

      expect(result.vendorName).toBe('ABC Corporation');
      expect(result.vendorAddress).toContain('123 Vendor Street');
      expect(result.customerName).toBe('XYZ Customer Inc');
      expect(result.customerAddress).toContain('456 Customer Ave');
    });

    it('should extract structured line items', async () => {
      const invoiceText = `
        ITEMS:
        1. Product A    Qty: 2    Price: $500.00    Total: $1,000.00
        2. Service B    Qty: 1    Price: $234.56    Total: $234.56
        3. Item C       Qty: 3    Price: $100.00    Total: $300.00
        
        Subtotal: $1,534.56
        Tax (8%): $122.76
        Total: $1,657.32
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['lineItems', 'subtotal', 'taxAmount', 'totalAmount'],
        confidenceThreshold: 0.7,
      });

      expect(result.lineItems).toHaveLength(3);
      expect(result.lineItems[0]).toMatchObject({
        description: 'Product A',
        quantity: 2,
        unitPrice: 500.00,
        amount: 1000.00,
      });
      expect(result.subtotal).toBe(1534.56);
      expect(result.taxAmount).toBe(122.76);
      expect(result.totalAmount).toBe(1657.32);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty or whitespace-only text', async () => {
      const result = await fieldService.extractFields('   \n\t   ', {
        type: 'invoice',
        requiredFields: ['invoiceNumber'],
        confidenceThreshold: 0.5,
      });

      expect(result.invoiceNumber).toBeUndefined();
      expect(result.confidence.invoiceNumber).toBe(0);
    });

    it('should handle malformed currency amounts', async () => {
      const malformedText = `
        Total: $1,234..56
        Amount: €1.234,56,78
        Sum: £abc.def
      `;

      const result = await fieldService.extractFields(malformedText, {
        type: 'invoice',
        requiredFields: ['totalAmount'],
        confidenceThreshold: 0.3,
      });

      // Should attempt to extract valid parts or return undefined
      expect(typeof result.totalAmount === 'number' || result.totalAmount === undefined).toBe(true);
    });

    it('should handle very long text efficiently', async () => {
      const longText = 'Invoice: INV-2024-001\n' + 'Filler text '.repeat(10000) + '\nTotal: $1,234.56';

      const startTime = Date.now();
      const result = await fieldService.extractFields(longText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.7,
      });
      const endTime = Date.now();

      expect(result.invoiceNumber).toBe('INV-2024-001');
      expect(result.totalAmount).toBe(1234.56);
      // Should complete within reasonable time (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});
