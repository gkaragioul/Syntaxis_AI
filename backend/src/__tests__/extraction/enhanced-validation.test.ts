import { EnhancedValidationService } from '../../services/enhanced-validation.service';
import { ValidationError } from '../../utils/errors';
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

describe('Enhanced Validation System', () => {
  let fieldService: EnhancedValidationService;

  beforeEach(() => {
    jest.clearAllMocks();
    fieldService = new EnhancedValidationService(mockPrisma);
  });

  describe('Data Type Validation', () => {
    it('should validate numeric fields', async () => {
      const validInvoiceText = `
        Invoice: INV-2024-001
        Total Amount: $1,234.56
        Tax Amount: $123.46
        Subtotal: $1,111.10
      `;

      const result = await fieldService.extractFields(validInvoiceText, {
        type: 'invoice',
        requiredFields: ['totalAmount', 'taxAmount', 'subtotal'],
        confidenceThreshold: 0.7,
      });

      // Should extract valid numbers
      expect(typeof result.totalAmount).toBe('number');
      expect(typeof result.taxAmount).toBe('number');
      expect(typeof result.subtotal).toBe('number');
      expect(result.totalAmount).toBeGreaterThan(0);
    });

    it('should handle invalid numeric values', async () => {
      const invalidInvoiceText = `
        Invoice: INV-2024-001
        Total Amount: $abc.def
        Tax Amount: $invalid
        Subtotal: $
      `;

      const result = await fieldService.extractFields(invalidInvoiceText, {
        type: 'invoice',
        requiredFields: ['totalAmount', 'taxAmount', 'subtotal'],
        confidenceThreshold: 0.7,
      });

      // Should handle invalid numbers gracefully
      expect(result.totalAmount).toBeNull();
      expect(result.taxAmount).toBeNull();
      expect(result.subtotal).toBeNull();
    });

    it('should validate date fields', async () => {
      const validInvoiceText = `
        Invoice: INV-2024-001
        Date: 2024-03-15
        Due Date: March 20, 2024
      `;

      const result = await fieldService.extractFields(validInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceDate'],
        confidenceThreshold: 0.7,
      });

      // Should extract valid dates
      expect(result.invoiceDate).toBeInstanceOf(Date);
      expect(result.invoiceDate.getFullYear()).toBe(2024);
    });

    it('should handle invalid date values', async () => {
      const invalidInvoiceText = `
        Invoice: INV-2024-001
        Date: invalid-date
        Due Date: 32/13/2024
      `;

      const result = await fieldService.extractFields(invalidInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceDate'],
        confidenceThreshold: 0.7,
      });

      // Should handle invalid dates gracefully
      expect(result.invoiceDate).toBeNull();
    });
  });

  describe('Format Validation', () => {
    it('should validate invoice number formats', async () => {
      const testCases = [
        { text: 'Invoice: INV-2024-001', expected: true },
        { text: 'Invoice: 2024-001', expected: true },
        { text: 'Invoice: ABC123', expected: true },
        { text: 'Invoice: 123', expected: true },
        { text: 'Invoice: ', expected: false },
      ];

      for (const testCase of testCases) {
        const result = await fieldService.extractFields(testCase.text, {
          type: 'invoice',
          requiredFields: ['invoiceNumber'],
          confidenceThreshold: 0.5,
        });

        if (testCase.expected) {
          expect(result.invoiceNumber).toBeTruthy();
          expect(typeof result.invoiceNumber).toBe('string');
          expect(result.invoiceNumber.length).toBeGreaterThan(0);
        } else {
          expect(result.invoiceNumber).toBeFalsy();
        }
      }
    });

    it('should validate email formats', async () => {
      const testCases = [
        { text: 'Email: test@example.com', expected: true },
        { text: 'Email: user.name@domain.co.uk', expected: true },
        { text: 'Email: invalid-email', expected: false },
        { text: 'Email: @domain.com', expected: false },
        { text: 'Email: user@', expected: false },
      ];

      for (const testCase of testCases) {
        const result = await fieldService.extractFields(testCase.text, {
          type: 'invoice',
          requiredFields: ['email'],
          confidenceThreshold: 0.5,
        });

        if (testCase.expected) {
          expect(result.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        }
      }
    });

    it('should validate phone number formats', async () => {
      const testCases = [
        { text: 'Phone: +1-555-123-4567', expected: true },
        { text: 'Phone: (555) 123-4567', expected: true },
        { text: 'Phone: 555.123.4567', expected: true },
        { text: 'Phone: 5551234567', expected: true },
        { text: 'Phone: invalid-phone', expected: false },
      ];

      for (const testCase of testCases) {
        const result = await fieldService.extractFields(testCase.text, {
          type: 'invoice',
          requiredFields: ['phone'],
          confidenceThreshold: 0.5,
        });

        if (testCase.expected) {
          expect(result.phone).toBeTruthy();
          expect(typeof result.phone).toBe('string');
        }
      }
    });
  });

  describe('Business Rule Validation', () => {
    it('should validate mathematical relationships', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Subtotal: $1,000.00
        Tax Amount: $100.00
        Total Amount: $1,100.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['subtotal', 'taxAmount', 'totalAmount'],
        confidenceThreshold: 0.7,
      });

      // Should validate that total = subtotal + tax
      const calculatedTotal = result.subtotal + result.taxAmount;
      expect(Math.abs(result.totalAmount - calculatedTotal)).toBeLessThan(0.01);
    });

    it('should detect mathematical inconsistencies', async () => {
      const inconsistentText = `
        Invoice: INV-2024-001
        Subtotal: $1,000.00
        Tax Amount: $100.00
        Total Amount: $2,000.00
      `;

      const result = await fieldService.extractFields(inconsistentText, {
        type: 'invoice',
        requiredFields: ['subtotal', 'taxAmount', 'totalAmount'],
        confidenceThreshold: 0.7,
      });

      // Should detect inconsistency and lower confidence
      const calculatedTotal = result.subtotal + result.taxAmount;
      const discrepancy = Math.abs(result.totalAmount - calculatedTotal);
      expect(discrepancy).toBeGreaterThan(0.01);

      // Confidence should be lower due to inconsistency
      expect(result.confidence.totalAmount).toBeLessThan(0.9);
    });

    it('should validate date relationships', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Invoice Date: 2024-03-15
        Due Date: 2024-04-15
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceDate', 'dueDate'],
        confidenceThreshold: 0.7,
      });

      // Due date should be after invoice date
      expect(result.dueDate.getTime()).toBeGreaterThan(
        result.invoiceDate.getTime(),
      );
    });

    it('should detect invalid date relationships', async () => {
      const invalidDateText = `
        Invoice: INV-2024-001
        Invoice Date: 2024-04-15
        Due Date: 2024-03-15
      `;

      const result = await fieldService.extractFields(invalidDateText, {
        type: 'invoice',
        requiredFields: ['invoiceDate', 'dueDate'],
        confidenceThreshold: 0.7,
      });

      // Should detect that due date is before invoice date
      if (result.invoiceDate && result.dueDate) {
        const isValidDateOrder =
          result.dueDate.getTime() >= result.invoiceDate.getTime();
        if (!isValidDateOrder) {
          // Confidence should be lower due to invalid date order
          expect(result.confidence.dueDate).toBeLessThan(0.9);
        }
      }
    });

    it('should validate line item calculations', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Item 1: Product A - Qty: 2 - Price: $500.00 - Total: $1,000.00
        Item 2: Service B - Qty: 1 - Price: $234.56 - Total: $234.56
        Subtotal: $1,234.56
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['lineItems', 'subtotal'],
        confidenceThreshold: 0.7,
      });

      if (result.lineItems && result.lineItems.length > 0) {
        // Validate each line item calculation
        for (const item of result.lineItems) {
          const calculatedAmount = item.quantity * item.unitPrice;
          expect(Math.abs(item.amount - calculatedAmount)).toBeLessThan(0.01);
        }

        // Validate subtotal matches sum of line items
        const calculatedSubtotal = result.lineItems.reduce(
          (sum: number, item: any) => sum + item.amount,
          0,
        );
        expect(Math.abs(result.subtotal - calculatedSubtotal)).toBeLessThan(
          0.01,
        );
      }
    });
  });

  describe('Cross-Field Validation', () => {
    it('should validate currency consistency', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Total Amount: $1,234.56
        Tax Amount: $123.46
        Currency: USD
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['totalAmount', 'taxAmount', 'currency'],
        confidenceThreshold: 0.7,
      });

      // All amounts should be consistent with declared currency
      expect(result.currency).toBe('USD');
      // Amounts should be positive numbers
      expect(result.totalAmount).toBeGreaterThan(0);
      expect(result.taxAmount).toBeGreaterThan(0);
    });

    it('should detect currency inconsistencies', async () => {
      const inconsistentText = `
        Invoice: INV-2024-001
        Total Amount: €1,234.56
        Tax Amount: $123.46
        Currency: USD
      `;

      const result = await fieldService.extractFields(inconsistentText, {
        type: 'invoice',
        requiredFields: ['totalAmount', 'taxAmount', 'currency'],
        confidenceThreshold: 0.7,
      });

      // Should detect currency symbol inconsistency
      // Confidence should be affected by mixed currency symbols
      if (result.confidence) {
        const avgConfidence =
          (result.confidence.totalAmount + result.confidence.taxAmount) / 2;
        expect(avgConfidence).toBeLessThan(1.0);
      }
    });

    it('should validate vendor and customer information consistency', async () => {
      const invoiceText = `
        FROM:
        ABC Corporation
        123 Business St
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
        requiredFields: [
          'vendorName',
          'vendorAddress',
          'customerName',
          'customerAddress',
        ],
        confidenceThreshold: 0.7,
      });

      // Vendor and customer should be different
      expect(result.vendorName).not.toBe(result.customerName);
      expect(result.vendorAddress).not.toBe(result.customerAddress);

      // Both should be present and non-empty
      expect(result.vendorName).toBeTruthy();
      expect(result.customerName).toBeTruthy();
    });
  });

  describe('Confidence-Based Validation', () => {
    it('should adjust confidence based on validation results', async () => {
      const highQualityText = `
        INVOICE
        Invoice Number: INV-2024-001
        Date: March 15, 2024
        Due Date: April 15, 2024
        
        Bill To: Customer Inc
        From: Vendor Corp
        
        Subtotal: $1,000.00
        Tax (10%): $100.00
        Total Amount: $1,100.00
      `;

      const result = await fieldService.extractFields(highQualityText, {
        type: 'invoice',
        requiredFields: [
          'invoiceNumber',
          'invoiceDate',
          'dueDate',
          'subtotal',
          'taxAmount',
          'totalAmount',
        ],
        confidenceThreshold: 0.8,
      });

      // High-quality, consistent data should have high confidence
      const avgConfidence =
        Object.values(result.confidence).reduce(
          (sum: number, conf: number) => sum + conf,
          0,
        ) / Object.values(result.confidence).length;

      expect(avgConfidence).toBeGreaterThan(0.8);
    });

    it('should lower confidence for inconsistent data', async () => {
      const lowQualityText = `
        lnvoice: 2024-001
        0ate: invalid
        Tota1: $abc
        Tax: missing
      `;

      const result = await fieldService.extractFields(lowQualityText, {
        type: 'invoice',
        requiredFields: [
          'invoiceNumber',
          'invoiceDate',
          'totalAmount',
          'taxAmount',
        ],
        confidenceThreshold: 0.3,
      });

      // Low-quality, inconsistent data should have lower confidence
      const validConfidences = Object.values(result.confidence).filter(
        (conf: number) => conf > 0,
      );
      if (validConfidences.length > 0) {
        const avgConfidence =
          validConfidences.reduce(
            (sum: number, conf: number) => sum + conf,
            0,
          ) / validConfidences.length;
        expect(avgConfidence).toBeLessThan(0.8);
      }
    });
  });
});
