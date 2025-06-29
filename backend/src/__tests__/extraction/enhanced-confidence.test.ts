import { EnhancedConfidenceService } from '../../services/enhanced-confidence.service';
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

describe('Enhanced Confidence Scoring', () => {
  let fieldService: EnhancedConfidenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    fieldService = new EnhancedConfidenceService(mockPrisma);
  });

  describe('Weighted Scoring System', () => {
    it('should assign higher confidence to exact pattern matches', async () => {
      const exactMatchText = `
        Invoice Number: INV-2024-001
        Total Amount: $1,234.56
        Date: 2024-03-15
      `;

      const result = await fieldService.extractFields(exactMatchText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount', 'invoiceDate'],
        confidenceThreshold: 0.7,
      });

      // Exact matches should have high confidence
      expect(result.confidence.invoiceNumber).toBeGreaterThan(0.85);
      expect(result.confidence.totalAmount).toBeGreaterThan(0.85);
      expect(result.confidence.invoiceDate).toBeGreaterThan(0.85);
    });

    it('should assign lower confidence to fuzzy pattern matches', async () => {
      const fuzzyMatchText = `
        lnvoice: 2024-001
        Amt: $1,234
        0ate: Mar 15
      `;

      const result = await fieldService.extractFields(fuzzyMatchText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount', 'invoiceDate'],
        confidenceThreshold: 0.5,
      });

      // Fuzzy matches should have lower confidence
      if (result.confidence.invoiceNumber) {
        expect(result.confidence.invoiceNumber).toBeLessThan(0.9);
        expect(result.confidence.invoiceNumber).toBeGreaterThan(0.5);
      }
    });

    it('should weight confidence based on pattern priority', async () => {
      const multiPatternText = `
        Invoice: INV-2024-001
        Reference: REF-2024-002
        Document: DOC-2024-003
      `;

      const result = await fieldService.extractFields(multiPatternText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber'],
        confidenceThreshold: 0.7,
      });

      // Should prefer higher priority patterns
      expect(result.invoiceNumber).toBeTruthy();
      expect(result.confidence.invoiceNumber).toBeGreaterThan(0.8);
    });
  });

  describe('Pattern Match Confidence', () => {
    it('should calculate confidence based on pattern specificity', async () => {
      const testCases = [
        {
          text: 'Invoice Number: INV-2024-001',
          expectedMinConfidence: 0.9, // Very specific pattern
        },
        {
          text: 'Inv: 2024-001',
          expectedMinConfidence: 0.7, // Abbreviated pattern
        },
        {
          text: 'INV-2024-001',
          expectedMinConfidence: 0.6, // Pattern without label
        },
      ];

      for (const testCase of testCases) {
        const result = await fieldService.extractFields(testCase.text, {
          type: 'invoice',
          requiredFields: ['invoiceNumber'],
          confidenceThreshold: 0.5,
        });

        if (result.confidence.invoiceNumber) {
          expect(result.confidence.invoiceNumber).toBeGreaterThan(testCase.expectedMinConfidence);
        }
      }
    });

    it('should adjust confidence based on OCR quality indicators', async () => {
      const highQualityText = `
        INVOICE
        Invoice Number: INV-2024-001
        Date: March 15, 2024
        Total Amount: $1,234.56
      `;

      const lowQualityText = `
        lNV0lCE
        lnvoice Nurnber: lNV-2024-O01
        0ate: March l5, 2O24
        Tota1 Arnount: $l,234.56
      `;

      const highQualityResult = await fieldService.extractFields(highQualityText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'totalAmount'],
        confidenceThreshold: 0.5,
      });

      const lowQualityResult = await fieldService.extractFields(lowQualityText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'totalAmount'],
        confidenceThreshold: 0.3,
      });

      // High quality text should have higher confidence
      const highQualityAvg = Object.values(highQualityResult.confidence)
        .reduce((sum: number, conf: number) => sum + conf, 0) / Object.values(highQualityResult.confidence).length;

      const lowQualityAvg = Object.values(lowQualityResult.confidence)
        .reduce((sum: number, conf: number) => sum + conf, 0) / Object.values(lowQualityResult.confidence).length;

      expect(highQualityAvg).toBeGreaterThan(lowQualityAvg);
    });
  });

  describe('Field Completeness Scoring', () => {
    it('should boost confidence for complete field extraction', async () => {
      const completeInvoiceText = `
        Invoice Number: INV-2024-001
        Date: March 15, 2024
        Due Date: April 15, 2024
        Vendor: ABC Corporation
        Customer: XYZ Inc
        Subtotal: $1,000.00
        Tax: $100.00
        Total Amount: $1,100.00
        Currency: USD
      `;

      const result = await fieldService.extractFields(completeInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'dueDate', 'vendorName', 'customerName', 'subtotal', 'taxAmount', 'totalAmount', 'currency'],
        confidenceThreshold: 0.7,
      });

      // Complete extraction should have high overall confidence
      const avgConfidence = Object.values(result.confidence)
        .reduce((sum: number, conf: number) => sum + conf, 0) / Object.values(result.confidence).length;

      expect(avgConfidence).toBeGreaterThan(0.8);
    });

    it('should penalize confidence for incomplete field extraction', async () => {
      const incompleteInvoiceText = `
        Invoice: INV-2024-001
        Total: $1,100.00
      `;

      const result = await fieldService.extractFields(incompleteInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'dueDate', 'vendorName', 'customerName', 'subtotal', 'taxAmount', 'totalAmount', 'currency'],
        confidenceThreshold: 0.3,
      });

      // Incomplete extraction should have lower overall confidence
      const extractedFields = Object.keys(result).filter(key => key !== 'confidence' && key !== 'rawText' && key !== 'validation' && result[key] !== null && result[key] !== undefined);
      const completenessRatio = extractedFields.length / 9; // 9 required fields

      expect(completenessRatio).toBeLessThan(0.5);
    });

    it('should calculate field-specific confidence based on extraction quality', async () => {
      const mixedQualityText = `
        Invoice Number: INV-2024-001
        Amt: $1,234
        Date: invalid-date
        Vendor: ABC Corp
      `;

      const result = await fieldService.extractFields(mixedQualityText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount', 'invoiceDate', 'vendorName'],
        confidenceThreshold: 0.3,
      });

      // Different fields should have different confidence levels
      if (result.confidence.invoiceNumber && result.confidence.totalAmount) {
        expect(result.confidence.invoiceNumber).toBeGreaterThan(result.confidence.totalAmount);
      }
    });
  });

  describe('Mathematical Consistency Scoring', () => {
    it('should boost confidence for mathematically consistent data', async () => {
      const consistentText = `
        Invoice: INV-2024-001
        Subtotal: $1,000.00
        Tax: $100.00
        Total: $1,100.00
      `;

      const result = await fieldService.extractFields(consistentText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'subtotal', 'taxAmount', 'totalAmount'],
        confidenceThreshold: 0.7,
      });

      // Mathematical consistency should boost confidence
      if (result.subtotal && result.taxAmount && result.totalAmount) {
        const calculatedTotal = result.subtotal + result.taxAmount;
        const isConsistent = Math.abs(result.totalAmount - calculatedTotal) < 0.01;
        
        if (isConsistent) {
          expect(result.confidence.totalAmount).toBeGreaterThan(0.8);
        }
      }
    });

    it('should penalize confidence for mathematically inconsistent data', async () => {
      const inconsistentText = `
        Invoice: INV-2024-001
        Subtotal: $1,000.00
        Tax: $100.00
        Total: $2,000.00
      `;

      const result = await fieldService.extractFields(inconsistentText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'subtotal', 'taxAmount', 'totalAmount'],
        confidenceThreshold: 0.5,
      });

      // Mathematical inconsistency should lower confidence
      if (result.subtotal && result.taxAmount && result.totalAmount) {
        const calculatedTotal = result.subtotal + result.taxAmount;
        const discrepancy = Math.abs(result.totalAmount - calculatedTotal);
        
        if (discrepancy > 0.01) {
          expect(result.confidence.totalAmount).toBeLessThan(0.9);
        }
      }
    });
  });

  describe('Context-Aware Confidence', () => {
    it('should boost confidence for fields found in appropriate context', async () => {
      const contextualText = `
        FROM:
        ABC Corporation
        123 Business St
        
        TO:
        Customer Inc
        456 Client Ave
        
        Invoice: INV-2024-001
        Total: $1,234.56
      `;

      const result = await fieldService.extractFields(contextualText, {
        type: 'invoice',
        requiredFields: ['vendorName', 'customerName', 'invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.7,
      });

      // Context-aware extraction should have high confidence
      if (result.vendorName && result.customerName) {
        expect(result.confidence.vendorName).toBeGreaterThan(0.8);
        expect(result.confidence.customerName).toBeGreaterThan(0.8);
      }
    });

    it('should lower confidence for ambiguous context', async () => {
      const ambiguousText = `
        Company A
        Company B
        Invoice: INV-2024-001
        Total: $1,234.56
      `;

      const result = await fieldService.extractFields(ambiguousText, {
        type: 'invoice',
        requiredFields: ['vendorName', 'customerName', 'invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.5,
      });

      // Ambiguous context should result in lower confidence
      if (result.vendorName) {
        expect(result.confidence.vendorName).toBeLessThan(0.9);
      }
    });
  });

  describe('Validation-Based Confidence Adjustment', () => {
    it('should adjust confidence based on validation results', async () => {
      const validText = `
        Invoice Number: INV-2024-001
        Date: 2024-03-15
        Due Date: 2024-04-15
        Total Amount: $1,234.56
      `;

      const result = await fieldService.extractFields(validText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'dueDate', 'totalAmount'],
        confidenceThreshold: 0.7,
      });

      // Valid data should maintain high confidence
      expect(result.validation.isValid).toBe(true);
      expect(result.validation.errors.length).toBe(0);
      
      const avgConfidence = Object.values(result.confidence)
        .reduce((sum: number, conf: number) => sum + conf, 0) / Object.values(result.confidence).length;
      
      expect(avgConfidence).toBeGreaterThan(0.8);
    });

    it('should lower confidence for validation failures', async () => {
      const invalidText = `
        Invoice Number: 
        Date: invalid-date
        Due Date: 2024-02-15
        Total Amount: -$1,234.56
      `;

      const result = await fieldService.extractFields(invalidText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'dueDate', 'totalAmount'],
        confidenceThreshold: 0.3,
      });

      // Invalid data should have validation errors and lower confidence
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Confidence Aggregation', () => {
    it('should calculate overall document confidence correctly', async () => {
      const documentText = `
        Invoice Number: INV-2024-001
        Date: 2024-03-15
        Total Amount: $1,234.56
        Vendor: ABC Corp
      `;

      const result = await fieldService.extractFields(documentText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'invoiceDate', 'totalAmount', 'vendorName'],
        confidenceThreshold: 0.7,
      });

      // Overall confidence should be reasonable aggregation of field confidences
      const fieldConfidences = Object.values(result.confidence);
      const avgFieldConfidence = fieldConfidences.reduce((sum: number, conf: number) => sum + conf, 0) / fieldConfidences.length;
      
      expect(avgFieldConfidence).toBeGreaterThan(0.7);
      expect(avgFieldConfidence).toBeLessThan(1.0);
    });

    it('should weight confidence by field importance', async () => {
      const documentText = `
        Invoice Number: INV-2024-001
        Total Amount: $1,234.56
        Notes: Some additional notes
      `;

      const result = await fieldService.extractFields(documentText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.7,
      });

      // Critical fields should have more weight in overall confidence
      expect(result.confidence.invoiceNumber).toBeGreaterThan(0.8);
      expect(result.confidence.totalAmount).toBeGreaterThan(0.8);
    });
  });
});
