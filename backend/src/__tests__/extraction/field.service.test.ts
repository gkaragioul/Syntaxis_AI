import { FieldExtractionService } from '../../services/field.service';
import { ValidationError } from '../../utils/errors';
import { PrismaClient } from '@prisma/client';
import { TEST_USER } from '../setup';

// Mock PrismaClient
const mockPrisma = {
  extraction: {
    findUnique: jest.fn(),
  },
  fieldPattern: {
    create: jest.fn(),
    update: jest.fn(),
  },
  extractionRule: {
    create: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('FieldExtractionService', () => {
  let fieldService: FieldExtractionService;
  const mockUserId = 'user-123';
  const mockExtractionId = 'extraction-123';
  const mockOcrId = 'ocr-123';

  beforeEach(() => {
    jest.clearAllMocks();
    fieldService = new FieldExtractionService(mockPrisma);
  });

  describe('extractFields', () => {
    const mockText = 'Sample invoice text';
    const mockOptions = {
      type: 'invoice' as const,
      requiredFields: ['vendorName', 'totalAmount'],
      confidenceThreshold: 0.8,
    };

    it('should extract fields from OCR text', async () => {
      const result = await fieldService.extractFields(mockText, mockOptions);

      expect(result).toHaveProperty('vendorName');
      expect(result).toHaveProperty('totalAmount');
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toHaveProperty('vendorName');
      expect(result.confidence).toHaveProperty('totalAmount');
    });

    it('should handle missing fields', async () => {
      const result = await fieldService.extractFields(mockText, {
        ...mockOptions,
        requiredFields: ['vendorName', 'totalAmount', 'invoiceNumber'],
      });

      expect(result).toHaveProperty('vendorName');
      expect(result).toHaveProperty('totalAmount');
      expect(result).not.toHaveProperty('invoiceNumber');
    });

    it('should validate extracted fields against rules', async () => {
      const result = await fieldService.extractFields(mockText, {
        ...mockOptions,
        requiredFields: ['vendorName', 'totalAmount'],
      });

      expect(result).toHaveProperty('vendorName');
      expect(result).toHaveProperty('totalAmount');
      expect(result.confidence.vendorName).toBeGreaterThanOrEqual(
        mockOptions.confidenceThreshold,
      );
      expect(result.confidence.totalAmount).toBeGreaterThanOrEqual(
        mockOptions.confidenceThreshold,
      );
    });
  });

  describe('getExtraction', () => {
    const mockExtraction = {
      id: mockExtractionId,
      result: {
        vendorName: 'Test Vendor',
        totalAmount: 1234.56,
        confidence: {
          vendorName: 0.95,
          totalAmount: 0.98,
        },
      },
      file: {
        userId: mockUserId,
      },
    };

    it('should return extraction for authorized user', async () => {
      mockPrisma.extraction.findUnique.mockResolvedValueOnce(mockExtraction);

      const result = await fieldService.getExtraction(
        mockExtractionId,
        mockUserId,
      );

      expect(result).toEqual(mockExtraction.result);
      expect(mockPrisma.extraction.findUnique).toHaveBeenCalledWith({
        where: { id: mockExtractionId },
        include: { file: true },
      });
    });

    it('should reject unauthorized access', async () => {
      mockPrisma.extraction.findUnique.mockResolvedValueOnce({
        ...mockExtraction,
        file: { userId: 'other-user' },
      });

      await expect(
        fieldService.getExtraction(mockExtractionId, 'other-user'),
      ).rejects.toThrow(
        new ValidationError('Not authorized to access this extraction'),
      );
    });

    it('should reject non-existent extraction', async () => {
      mockPrisma.extraction.findUnique.mockResolvedValueOnce(null);

      await expect(
        fieldService.getExtraction(mockExtractionId, mockUserId),
      ).rejects.toThrow(new ValidationError('Extraction not found'));
    });
  });

  describe('updateFieldPatterns', () => {
    const mockPatterns = [
      {
        field: 'vendorName',
        patterns: ['Vendor:', 'Company:'],
        priority: 1,
      },
      {
        field: 'totalAmount',
        patterns: ['Total:', 'Amount:'],
        priority: 2,
      },
    ];

    it('should create new field pattern', async () => {
      const mockCreatedPattern = {
        id: 'pattern-123',
        ...mockPatterns[0],
        userId: mockUserId,
      };

      mockPrisma.fieldPattern.create.mockResolvedValueOnce(mockCreatedPattern);

      const result = await fieldService.updateFieldPatterns(mockUserId, [
        mockPatterns[0],
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockCreatedPattern);
      expect(mockPrisma.fieldPattern.create).toHaveBeenCalledWith({
        data: {
          ...mockPatterns[0],
          userId: mockUserId,
        },
      });
    });

    it('should update existing field pattern', async () => {
      const mockUpdatedPattern = {
        id: 'pattern-123',
        ...mockPatterns[0],
        userId: mockUserId,
      };

      mockPrisma.fieldPattern.update.mockResolvedValueOnce(mockUpdatedPattern);

      const result = await fieldService.updateFieldPatterns(mockUserId, [
        {
          id: 'pattern-123',
          ...mockPatterns[0],
        },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockUpdatedPattern);
      expect(mockPrisma.fieldPattern.update).toHaveBeenCalledWith({
        where: { id: 'pattern-123' },
        data: {
          ...mockPatterns[0],
          userId: mockUserId,
        },
      });
    });

    it('should validate pattern format', async () => {
      const invalidPattern = {
        field: 'vendorName',
        // Missing patterns array
        priority: 1,
      };

      await expect(
        fieldService.updateFieldPatterns(mockUserId, [invalidPattern as any]),
      ).rejects.toThrow(new ValidationError('Invalid pattern format'));
    });
  });

  describe('updateExtractionRules', () => {
    const mockRules = [
      {
        field: 'vendorName',
        validation: {
          type: 'string' as const,
          required: true,
        },
        confidence: 0.8,
      },
      {
        field: 'totalAmount',
        validation: {
          type: 'number' as const,
          required: true,
          min: 0,
        },
        confidence: 0.9,
      },
    ];

    it('should create new extraction rule', async () => {
      const mockCreatedRule = {
        id: 'rule-123',
        ...mockRules[0],
        userId: mockUserId,
      };

      mockPrisma.extractionRule.create.mockResolvedValueOnce(mockCreatedRule);

      const result = await fieldService.updateExtractionRules(mockUserId, [
        mockRules[0],
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockCreatedRule);
      expect(mockPrisma.extractionRule.create).toHaveBeenCalledWith({
        data: {
          ...mockRules[0],
          userId: mockUserId,
        },
      });
    });

    it('should update existing extraction rule', async () => {
      const mockUpdatedRule = {
        id: 'rule-123',
        ...mockRules[0],
        userId: mockUserId,
      };

      mockPrisma.extractionRule.update.mockResolvedValueOnce(mockUpdatedRule);

      const result = await fieldService.updateExtractionRules(mockUserId, [
        {
          id: 'rule-123',
          ...mockRules[0],
        },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockUpdatedRule);
      expect(mockPrisma.extractionRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-123' },
        data: {
          ...mockRules[0],
          userId: mockUserId,
        },
      });
    });

    it('should validate rule format', async () => {
      const invalidRule = {
        field: 'vendorName',
        // Missing validation
        confidence: 0.8,
      };

      await expect(
        fieldService.updateExtractionRules(mockUserId, [invalidRule as any]),
      ).rejects.toThrow(new ValidationError('Invalid rule format'));
    });
  });
});

describe('Enhanced Field Extraction Patterns', () => {
  let fieldService: FieldExtractionService;

  beforeEach(() => {
    jest.clearAllMocks();
    fieldService = new FieldExtractionService(mockPrisma);
  });

  describe('Multi-language Pattern Recognition', () => {
    it('should extract fields from English invoices', async () => {
      const englishText = `
        INVOICE
        Invoice Number: INV-2024-001
        Date: March 15, 2024
        Bill To: John Doe
        Company: ABC Corp
        Total Amount: $1,234.56
        Tax: $123.46
        Subtotal: $1,111.10
      `;

      const result = await fieldService.extractFields(englishText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount', 'vendorName'],
        confidenceThreshold: 0.7,
      });

      expect(result.invoiceNumber).toBe('INV-2024-001');
      expect(result.totalAmount).toBe(1234.56);
      expect(result.vendorName).toBe('ABC Corp');
      expect(result.confidence.invoiceNumber).toBeGreaterThan(0.8);
    });

    it('should extract fields from Spanish invoices', async () => {
      const spanishText = `
        FACTURA
        Número de Factura: FAC-2024-001
        Fecha: 15 de Marzo, 2024
        Cliente: Juan Pérez
        Empresa: XYZ S.A.
        Importe Total: €1.234,56
        IVA: €123,46
        Subtotal: €1.111,10
      `;

      const result = await fieldService.extractFields(spanishText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount', 'vendorName'],
        confidenceThreshold: 0.7,
      });

      expect(result.invoiceNumber).toBe('FAC-2024-001');
      expect(result.totalAmount).toBe(1234.56);
      expect(result.vendorName).toBe('XYZ S.A.');
      expect(result.confidence.invoiceNumber).toBeGreaterThan(0.8);
    });

    it('should extract fields from German invoices', async () => {
      const germanText = `
        RECHNUNG
        Rechnungsnummer: RG-2024-001
        Datum: 15. März 2024
        Kunde: Hans Mueller
        Firma: Deutsche GmbH
        Gesamtbetrag: 1.234,56 €
        MwSt: 123,46 €
        Zwischensumme: 1.111,10 €
      `;

      const result = await fieldService.extractFields(germanText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount', 'vendorName'],
        confidenceThreshold: 0.7,
      });

      expect(result.invoiceNumber).toBe('RG-2024-001');
      expect(result.totalAmount).toBe(1234.56);
      expect(result.vendorName).toBe('Deutsche GmbH');
      expect(result.confidence.invoiceNumber).toBeGreaterThan(0.8);
    });
  });

  describe('Enhanced Pattern Matching', () => {
    it('should handle various invoice number formats', async () => {
      const testCases = [
        { text: 'Invoice #: 12345', expected: '12345' },
        { text: 'INV-2024-001', expected: 'INV-2024-001' },
        { text: 'Invoice Number: ABC123XYZ', expected: 'ABC123XYZ' },
        { text: 'Ref: 2024/03/001', expected: '2024/03/001' },
        { text: 'Document No. 456789', expected: '456789' },
      ];

      for (const testCase of testCases) {
        const result = await fieldService.extractFields(testCase.text, {
          type: 'invoice',
          requiredFields: ['invoiceNumber'],
          confidenceThreshold: 0.5,
        });

        expect(result.invoiceNumber).toBe(testCase.expected);
        expect(result.confidence.invoiceNumber).toBeGreaterThan(0.5);
      }
    });

    it('should handle various amount formats', async () => {
      const testCases = [
        { text: 'Total: $1,234.56', expected: 1234.56 },
        { text: 'Amount: €1.234,56', expected: 1234.56 },
        { text: 'Sum: 1234.56 USD', expected: 1234.56 },
        { text: 'Total Amount: £1,234.56', expected: 1234.56 },
        { text: 'Grand Total: ¥123,456', expected: 123456 },
      ];

      for (const testCase of testCases) {
        const result = await fieldService.extractFields(testCase.text, {
          type: 'invoice',
          requiredFields: ['totalAmount'],
          confidenceThreshold: 0.5,
        });

        expect(result.totalAmount).toBe(testCase.expected);
        expect(result.confidence.totalAmount).toBeGreaterThan(0.5);
      }
    });

    it('should handle various date formats', async () => {
      const testCases = [
        { text: 'Date: 03/15/2024', expected: new Date('2024-03-15') },
        { text: 'Invoice Date: 15-03-2024', expected: new Date('2024-03-15') },
        { text: 'Due: March 15, 2024', expected: new Date('2024-03-15') },
        { text: 'Issued: 2024-03-15', expected: new Date('2024-03-15') },
      ];

      for (const testCase of testCases) {
        const result = await fieldService.extractFields(testCase.text, {
          type: 'invoice',
          requiredFields: ['invoiceDate'],
          confidenceThreshold: 0.5,
        });

        expect(result.invoiceDate).toEqual(testCase.expected);
        expect(result.confidence.invoiceDate).toBeGreaterThan(0.5);
      }
    });
  });

  describe('Contextual Field Extraction', () => {
    it('should extract vendor information with context', async () => {
      const invoiceText = `
        From: ABC Corporation
        123 Business St
        New York, NY 10001
        Tax ID: 12-3456789

        To: Customer Inc
        456 Client Ave
        Los Angeles, CA 90001

        Invoice: INV-2024-001
        Total: $1,234.56
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['vendorName', 'vendorAddress', 'vendorTaxId', 'customerName'],
        confidenceThreshold: 0.7,
      });

      expect(result.vendorName).toBe('ABC Corporation');
      expect(result.vendorAddress).toContain('123 Business St');
      expect(result.vendorTaxId).toBe('12-3456789');
      expect(result.customerName).toBe('Customer Inc');
    });

    it('should extract line items with proper structure', async () => {
      const invoiceText = `
        Item 1: Product A - Qty: 2 - Price: $500.00 - Total: $1,000.00
        Item 2: Service B - Qty: 1 - Price: $234.56 - Total: $234.56

        Subtotal: $1,234.56
        Tax: $123.46
        Total: $1,358.02
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['lineItems', 'subtotal', 'taxAmount', 'totalAmount'],
        confidenceThreshold: 0.7,
      });

      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems[0].description).toBe('Product A');
      expect(result.lineItems[0].quantity).toBe(2);
      expect(result.lineItems[0].unitPrice).toBe(500.00);
      expect(result.lineItems[0].amount).toBe(1000.00);
    });
  });
});
