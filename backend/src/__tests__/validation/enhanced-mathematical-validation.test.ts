import { EnhancedMathematicalValidationService } from '../../services/enhanced-mathematical-validation.service';
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

describe('Enhanced Mathematical Validation', () => {
  let fieldService: EnhancedMathematicalValidationService;

  beforeEach(() => {
    jest.clearAllMocks();
    fieldService = new EnhancedMathematicalValidationService(mockPrisma);
  });

  describe('Total Amount Calculations', () => {
    it('should validate basic total = subtotal + tax calculation', async () => {
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
        enableMathematicalValidation: true,
      });

      expect(result.validation.mathematicalValidation).toBeDefined();
      expect(
        result.validation.mathematicalValidation.totalCalculation.isValid,
      ).toBe(true);
      expect(
        result.validation.mathematicalValidation.totalCalculation
          .calculatedValue,
      ).toBe(1100.0);
      expect(
        result.validation.mathematicalValidation.totalCalculation.actualValue,
      ).toBe(1100.0);
      expect(
        result.validation.mathematicalValidation.totalCalculation.discrepancy,
      ).toBe(0);
    });

    it('should detect total calculation errors', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Subtotal: $1,000.00
        Tax Amount: $100.00
        Total Amount: $1,200.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['subtotal', 'taxAmount', 'totalAmount'],
        confidenceThreshold: 0.5,
        enableMathematicalValidation: true,
      });

      expect(
        result.validation.mathematicalValidation.totalCalculation.isValid,
      ).toBe(false);
      expect(
        result.validation.mathematicalValidation.totalCalculation.discrepancy,
      ).toBe(100.0);
      expect(
        result.validation.mathematicalValidation.totalCalculation.errorType,
      ).toBe('calculation_mismatch');
    });

    it('should handle multiple tax types', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Subtotal: $1,000.00
        Sales Tax (8%): $80.00
        Service Tax (2%): $20.00
        Total Tax: $100.00
        Total Amount: $1,100.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['subtotal', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableMathematicalValidation: true,
        enableMultiTaxValidation: true,
      });

      expect(
        result.validation.mathematicalValidation.multiTaxCalculation,
      ).toBeDefined();
      expect(
        result.validation.mathematicalValidation.multiTaxCalculation.isValid,
      ).toBe(true);
      expect(
        result.validation.mathematicalValidation.multiTaxCalculation
          .taxBreakdown,
      ).toHaveLength(2);
    });

    it('should validate discount calculations', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Subtotal: $1,000.00
        Discount (10%): $100.00
        Discounted Subtotal: $900.00
        Tax (10%): $90.00
        Total Amount: $990.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['subtotal', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableMathematicalValidation: true,
        enableDiscountValidation: true,
      });

      expect(
        result.validation.mathematicalValidation.discountCalculation,
      ).toBeDefined();
      expect(
        result.validation.mathematicalValidation.discountCalculation.isValid,
      ).toBe(true);
      expect(
        result.validation.mathematicalValidation.discountCalculation
          .discountAmount,
      ).toBe(100.0);
      expect(
        result.validation.mathematicalValidation.discountCalculation
          .discountPercentage,
      ).toBe(10);
    });
  });

  describe('Line Item Calculations', () => {
    it('should validate line item quantity × price = amount', async () => {
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
        enableMathematicalValidation: true,
      });

      expect(
        result.validation.mathematicalValidation.lineItemCalculations,
      ).toBeDefined();
      expect(
        result.validation.mathematicalValidation.lineItemCalculations.length,
      ).toBe(2);

      for (const itemValidation of result.validation.mathematicalValidation
        .lineItemCalculations) {
        expect(itemValidation.isValid).toBe(true);
        expect(itemValidation.calculatedAmount).toBe(
          itemValidation.actualAmount,
        );
      }
    });

    it('should detect line item calculation errors', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Item 1: Product A - Qty: 2 - Price: $500.00 - Total: $1,100.00
        Item 2: Service B - Qty: 3 - Price: $100.00 - Total: $250.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['lineItems'],
        confidenceThreshold: 0.5,
        enableMathematicalValidation: true,
      });

      const lineItemValidations =
        result.validation.mathematicalValidation.lineItemCalculations;
      expect(lineItemValidations[0].isValid).toBe(false);
      expect(lineItemValidations[0].discrepancy).toBe(100.0);
      expect(lineItemValidations[1].isValid).toBe(false);
      expect(lineItemValidations[1].discrepancy).toBe(50.0);
    });

    it('should validate line item tax calculations', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Item 1: Product A - Qty: 2 - Price: $500.00 - Subtotal: $1,000.00 - Tax: $100.00 - Total: $1,100.00
        Item 2: Service B - Qty: 1 - Price: $200.00 - Subtotal: $200.00 - Tax: $20.00 - Total: $220.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['lineItems'],
        confidenceThreshold: 0.7,
        enableMathematicalValidation: true,
        enableLineItemTaxValidation: true,
      });

      const lineItemValidations =
        result.validation.mathematicalValidation.lineItemCalculations;
      expect(lineItemValidations[0].taxCalculation.isValid).toBe(true);
      expect(lineItemValidations[0].taxCalculation.taxRate).toBe(0.1);
      expect(lineItemValidations[1].taxCalculation.isValid).toBe(true);
      expect(lineItemValidations[1].taxCalculation.taxRate).toBe(0.1);
    });

    it('should validate subtotal equals sum of line items', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Item 1: Product A - Total: $500.00
        Item 2: Product B - Total: $300.00
        Item 3: Product C - Total: $200.00
        Subtotal: $1,000.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['lineItems', 'subtotal'],
        confidenceThreshold: 0.7,
        enableMathematicalValidation: true,
      });

      expect(
        result.validation.mathematicalValidation.subtotalValidation.isValid,
      ).toBe(true);
      expect(
        result.validation.mathematicalValidation.subtotalValidation
          .calculatedSubtotal,
      ).toBe(1000.0);
      expect(
        result.validation.mathematicalValidation.subtotalValidation
          .actualSubtotal,
      ).toBe(1000.0);
    });
  });

  describe('Tax Rate Calculations', () => {
    it('should calculate and validate tax rates', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Subtotal: $1,000.00
        Tax (8.5%): $85.00
        Total: $1,085.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['subtotal', 'taxAmount', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableMathematicalValidation: true,
        enableTaxRateValidation: true,
      });

      expect(
        result.validation.mathematicalValidation.taxRateValidation.isValid,
      ).toBe(true);
      expect(
        result.validation.mathematicalValidation.taxRateValidation
          .calculatedRate,
      ).toBe(0.085);
      expect(
        result.validation.mathematicalValidation.taxRateValidation.declaredRate,
      ).toBe(0.085);
    });

    it('should detect tax rate inconsistencies', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Subtotal: $1,000.00
        Tax (10%): $75.00
        Total: $1,075.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['subtotal', 'taxAmount', 'totalAmount'],
        confidenceThreshold: 0.5,
        enableMathematicalValidation: true,
        enableTaxRateValidation: true,
      });

      expect(
        result.validation.mathematicalValidation.taxRateValidation.isValid,
      ).toBe(false);
      expect(
        result.validation.mathematicalValidation.taxRateValidation
          .calculatedRate,
      ).toBe(0.075);
      expect(
        result.validation.mathematicalValidation.taxRateValidation.declaredRate,
      ).toBe(0.1);
      expect(
        result.validation.mathematicalValidation.taxRateValidation.discrepancy,
      ).toBe(0.025);
    });

    it('should handle multiple tax rates', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Item 1: Food - $100.00 - Tax (5%): $5.00
        Item 2: Electronics - $200.00 - Tax (10%): $20.00
        Total Tax: $25.00
        Total: $325.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['lineItems', 'taxAmount', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableMathematicalValidation: true,
        enableMultiTaxRateValidation: true,
      });

      expect(
        result.validation.mathematicalValidation.multiTaxRateValidation.isValid,
      ).toBe(true);
      expect(
        result.validation.mathematicalValidation.multiTaxRateValidation
          .taxRates,
      ).toHaveLength(2);
      expect(
        result.validation.mathematicalValidation.multiTaxRateValidation
          .totalTaxCalculated,
      ).toBe(25.0);
    });
  });

  describe('Currency Consistency', () => {
    it('should validate single currency consistency', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Subtotal: $1,000.00
        Tax: $100.00
        Total: $1,100.00
        Currency: USD
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['subtotal', 'taxAmount', 'totalAmount', 'currency'],
        confidenceThreshold: 0.7,
        enableMathematicalValidation: true,
        enableCurrencyValidation: true,
      });

      expect(
        result.validation.mathematicalValidation.currencyValidation.isValid,
      ).toBe(true);
      expect(
        result.validation.mathematicalValidation.currencyValidation
          .detectedCurrencies,
      ).toEqual(['USD']);
      expect(
        result.validation.mathematicalValidation.currencyValidation
          .consistencyScore,
      ).toBe(1.0);
    });

    it('should detect currency inconsistencies', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Subtotal: €1,000.00
        Tax: $100.00
        Total: £1,100.00
        Currency: USD
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['subtotal', 'taxAmount', 'totalAmount', 'currency'],
        confidenceThreshold: 0.5,
        enableMathematicalValidation: true,
        enableCurrencyValidation: true,
      });

      expect(
        result.validation.mathematicalValidation.currencyValidation.isValid,
      ).toBe(false);
      expect(
        result.validation.mathematicalValidation.currencyValidation
          .detectedCurrencies.length,
      ).toBeGreaterThan(1);
      expect(
        result.validation.mathematicalValidation.currencyValidation
          .inconsistencies,
      ).toBeDefined();
    });

    it('should validate currency conversion calculations', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Subtotal: €1,000.00
        Exchange Rate: 1.10 USD/EUR
        Subtotal (USD): $1,100.00
        Tax (USD): $110.00
        Total (USD): $1,210.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['subtotal', 'taxAmount', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableMathematicalValidation: true,
        enableCurrencyConversionValidation: true,
      });

      expect(
        result.validation.mathematicalValidation.currencyConversionValidation
          .isValid,
      ).toBe(true);
      expect(
        result.validation.mathematicalValidation.currencyConversionValidation
          .exchangeRate,
      ).toBe(1.1);
      expect(
        result.validation.mathematicalValidation.currencyConversionValidation
          .conversionAccuracy,
      ).toBeGreaterThan(0.95);
    });
  });

  describe('Precision and Rounding', () => {
    it('should handle decimal precision correctly', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Item 1: Service - Qty: 3 - Price: $33.333 - Total: $99.999
        Rounded Total: $100.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['lineItems'],
        confidenceThreshold: 0.7,
        enableMathematicalValidation: true,
        enablePrecisionValidation: true,
      });

      expect(
        result.validation.mathematicalValidation.precisionValidation.isValid,
      ).toBe(true);
      expect(
        result.validation.mathematicalValidation.precisionValidation
          .roundingMethod,
      ).toBe('standard');
      expect(
        result.validation.mathematicalValidation.precisionValidation
          .precisionLevel,
      ).toBe(2);
    });

    it('should detect rounding errors', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Item 1: Service - Qty: 3 - Price: $33.33 - Total: $100.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['lineItems'],
        confidenceThreshold: 0.5,
        enableMathematicalValidation: true,
        enablePrecisionValidation: true,
      });

      expect(
        result.validation.mathematicalValidation.precisionValidation.isValid,
      ).toBe(false);
      expect(
        result.validation.mathematicalValidation.precisionValidation
          .roundingErrors,
      ).toBeDefined();
    });
  });

  describe('Complex Mathematical Scenarios', () => {
    it('should validate invoices with shipping and handling', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Subtotal: $1,000.00
        Shipping: $50.00
        Handling: $25.00
        Pre-tax Total: $1,075.00
        Tax (8%): $86.00
        Total Amount: $1,161.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['subtotal', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableMathematicalValidation: true,
        enableShippingValidation: true,
      });

      expect(
        result.validation.mathematicalValidation.shippingValidation.isValid,
      ).toBe(true);
      expect(
        result.validation.mathematicalValidation.shippingValidation
          .shippingAmount,
      ).toBe(50.0);
      expect(
        result.validation.mathematicalValidation.shippingValidation
          .handlingAmount,
      ).toBe(25.0);
    });

    it('should validate progressive tax calculations', async () => {
      const invoiceText = `
        Invoice: INV-2024-001
        Subtotal: $10,000.00
        Tax Bracket 1 (5% on first $5,000): $250.00
        Tax Bracket 2 (10% on remaining $5,000): $500.00
        Total Tax: $750.00
        Total Amount: $10,750.00
      `;

      const result = await fieldService.extractFields(invoiceText, {
        type: 'invoice',
        requiredFields: ['subtotal', 'taxAmount', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableMathematicalValidation: true,
        enableProgressiveTaxValidation: true,
      });

      expect(
        result.validation.mathematicalValidation.progressiveTaxValidation
          .isValid,
      ).toBe(true);
      expect(
        result.validation.mathematicalValidation.progressiveTaxValidation
          .taxBrackets,
      ).toHaveLength(2);
    });
  });
});
