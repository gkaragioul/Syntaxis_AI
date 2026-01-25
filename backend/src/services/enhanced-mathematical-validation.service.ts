import { EnhancedTemplateMatchingService } from './enhanced-template-matching.service';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

interface MathematicalValidationResult {
  isValid: boolean;
  confidence: number;
  errors: string[];
  warnings: string[];
  totalCalculation?: TotalCalculationValidation;
  lineItemCalculations?: LineItemCalculationValidation[];
  subtotalValidation?: SubtotalValidation;
  taxRateValidation?: TaxRateValidation;
  multiTaxRateValidation?: MultiTaxRateValidation;
  multiTaxCalculation?: MultiTaxCalculation;
  discountCalculation?: DiscountCalculation;
  currencyValidation?: CurrencyValidation;
  currencyConversionValidation?: CurrencyConversionValidation;
  precisionValidation?: PrecisionValidation;
  shippingValidation?: ShippingValidation;
  progressiveTaxValidation?: ProgressiveTaxValidation;
}

interface TotalCalculationValidation {
  isValid: boolean;
  calculatedValue: number;
  actualValue: number;
  discrepancy: number;
  errorType?: string;
  tolerance: number;
}

interface LineItemCalculationValidation {
  itemIndex: number;
  isValid: boolean;
  calculatedAmount: number;
  actualAmount: number;
  discrepancy: number;
  quantity: number;
  unitPrice: number;
  taxCalculation?: {
    isValid: boolean;
    taxRate: number;
    calculatedTax: number;
    actualTax: number;
  };
}

interface SubtotalValidation {
  isValid: boolean;
  calculatedSubtotal: number;
  actualSubtotal: number;
  discrepancy: number;
  lineItemSum: number;
}

interface TaxRateValidation {
  isValid: boolean;
  calculatedRate: number;
  declaredRate?: number;
  discrepancy: number;
  confidence: number;
}

interface MultiTaxRateValidation {
  isValid: boolean;
  taxRates: Array<{
    category: string;
    rate: number;
    amount: number;
    baseAmount: number;
  }>;
  totalTaxCalculated: number;
  totalTaxActual: number;
}

interface MultiTaxCalculation {
  isValid: boolean;
  taxBreakdown: Array<{
    taxType: string;
    rate: number;
    amount: number;
    baseAmount: number;
  }>;
  totalTax: number;
}

interface DiscountCalculation {
  isValid: boolean;
  discountAmount: number;
  discountPercentage: number;
  baseAmount: number;
  discountedAmount: number;
}

interface CurrencyValidation {
  isValid: boolean;
  detectedCurrencies: string[];
  consistencyScore: number;
  inconsistencies?: Array<{
    field: string;
    expectedCurrency: string;
    actualCurrency: string;
  }>;
}

interface CurrencyConversionValidation {
  isValid: boolean;
  exchangeRate: number;
  fromCurrency: string;
  toCurrency: string;
  conversionAccuracy: number;
}

interface PrecisionValidation {
  isValid: boolean;
  roundingMethod: string;
  precisionLevel: number;
  roundingErrors?: Array<{
    field: string;
    expected: number;
    actual: number;
    error: number;
  }>;
}

interface ShippingValidation {
  isValid: boolean;
  shippingAmount: number;
  handlingAmount?: number;
  totalShippingAndHandling: number;
}

interface ProgressiveTaxValidation {
  isValid: boolean;
  taxBrackets: Array<{
    bracket: number;
    rate: number;
    baseAmount: number;
    taxAmount: number;
  }>;
  totalProgressiveTax: number;
}

export class EnhancedMathematicalValidationService extends EnhancedTemplateMatchingService {
  private readonly defaultTolerance = 0.01; // $0.01 tolerance for rounding
  private readonly currencySymbols = new Map([
    ['$', 'USD'],
    ['€', 'EUR'],
    ['£', 'GBP'],
    ['¥', 'JPY'],
    ['₹', 'INR'],
  ]);

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async extractFields(text: string, options: any): Promise<any> {
    // First extract fields using enhanced template matching
    const result = await super.extractFields(text, options);

    // Then apply enhanced mathematical validation if enabled
    if (options.enableMathematicalValidation) {
      const mathematicalValidation = await this.performMathematicalValidation(
        result,
        text,
        options,
      );

      // Add mathematical validation results
      if (!result.validation) result.validation = {};
      result.validation.mathematicalValidation = mathematicalValidation;

      // Adjust overall confidence based on mathematical validation
      if (mathematicalValidation.confidence < 0.8) {
        result.overallConfidence = Math.min(
          result.overallConfidence || 1.0,
          mathematicalValidation.confidence,
        );
      }
    }

    logger.info('Enhanced mathematical validation completed', {
      isValid: result.validation?.mathematicalValidation?.isValid,
      confidence: result.validation?.mathematicalValidation?.confidence,
      errorCount:
        result.validation?.mathematicalValidation?.errors?.length || 0,
      warningCount:
        result.validation?.mathematicalValidation?.warnings?.length || 0,
    });

    return result;
  }

  private async performMathematicalValidation(
    result: any,
    text: string,
    options: any,
  ): Promise<MathematicalValidationResult> {
    const validation: MathematicalValidationResult = {
      isValid: true,
      confidence: 1.0,
      errors: [],
      warnings: [],
    };

    // Validate total calculations
    if (result.subtotal && result.taxAmount && result.totalAmount) {
      validation.totalCalculation = this.validateTotalCalculation(result);
      if (!validation.totalCalculation.isValid) {
        validation.isValid = false;
        validation.errors.push(
          `Total calculation error: ${validation.totalCalculation.errorType}`,
        );
      }
    }

    // Validate line item calculations
    if (result.lineItems && Array.isArray(result.lineItems)) {
      validation.lineItemCalculations = this.validateLineItemCalculations(
        result.lineItems,
        options,
      );
      const invalidItems = validation.lineItemCalculations.filter(
        (item) => !item.isValid,
      );
      if (invalidItems.length > 0) {
        validation.isValid = false;
        validation.errors.push(
          `${invalidItems.length} line item calculation errors detected`,
        );
      }
    }

    // Validate subtotal equals sum of line items
    if (result.lineItems && result.subtotal) {
      validation.subtotalValidation = this.validateSubtotal(
        result.lineItems,
        result.subtotal,
      );
      if (!validation.subtotalValidation.isValid) {
        validation.warnings.push('Subtotal does not match sum of line items');
      }
    }

    // Validate tax rate calculations
    if (
      options.enableTaxRateValidation &&
      result.subtotal &&
      result.taxAmount
    ) {
      validation.taxRateValidation = this.validateTaxRate(
        result.subtotal,
        result.taxAmount,
        text,
      );
      if (!validation.taxRateValidation.isValid) {
        validation.warnings.push('Tax rate calculation inconsistency detected');
      }
    }

    // Validate currency consistency
    if (options.enableCurrencyValidation) {
      validation.currencyValidation = this.validateCurrencyConsistency(
        result,
        text,
      );
      if (!validation.currencyValidation.isValid) {
        validation.errors.push('Currency inconsistency detected');
      }
    }

    // Validate discount calculations
    if (options.enableDiscountValidation) {
      validation.discountCalculation = this.validateDiscountCalculation(
        result,
        text,
      );
      if (
        validation.discountCalculation &&
        !validation.discountCalculation.isValid
      ) {
        validation.warnings.push('Discount calculation inconsistency detected');
      }
    }

    // Validate precision and rounding
    if (options.enablePrecisionValidation) {
      validation.precisionValidation = this.validatePrecision(result);
      if (!validation.precisionValidation.isValid) {
        validation.warnings.push('Precision or rounding errors detected');
      }
    }

    // Calculate overall confidence
    validation.confidence = this.calculateMathematicalConfidence(validation);

    return validation;
  }

  private validateTotalCalculation(result: any): TotalCalculationValidation {
    const calculatedTotal = result.subtotal + result.taxAmount;
    const discrepancy = Math.abs(result.totalAmount - calculatedTotal);
    const tolerance = this.defaultTolerance;

    return {
      isValid: discrepancy <= tolerance,
      calculatedValue: calculatedTotal,
      actualValue: result.totalAmount,
      discrepancy,
      errorType: discrepancy > tolerance ? 'calculation_mismatch' : undefined,
      tolerance,
    };
  }

  private validateLineItemCalculations(
    lineItems: any[],
    options: any,
  ): LineItemCalculationValidation[] {
    return lineItems.map((item, index) => {
      const calculatedAmount = item.quantity * item.unitPrice;
      const discrepancy = Math.abs(item.amount - calculatedAmount);
      const isValid = discrepancy <= this.defaultTolerance;

      const validation: LineItemCalculationValidation = {
        itemIndex: index,
        isValid,
        calculatedAmount,
        actualAmount: item.amount,
        discrepancy,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      };

      // Validate line item tax if enabled
      if (
        options.enableLineItemTaxValidation &&
        item.taxAmount &&
        item.amount
      ) {
        const taxRate = item.taxAmount / (item.amount - item.taxAmount);
        const calculatedTax = (item.amount - item.taxAmount) * taxRate;
        const taxDiscrepancy = Math.abs(item.taxAmount - calculatedTax);

        validation.taxCalculation = {
          isValid: taxDiscrepancy <= this.defaultTolerance,
          taxRate,
          calculatedTax,
          actualTax: item.taxAmount,
        };
      }

      return validation;
    });
  }

  private validateSubtotal(
    lineItems: any[],
    subtotal: number,
  ): SubtotalValidation {
    const lineItemSum = lineItems.reduce(
      (sum, item) => sum + (item.amount || 0),
      0,
    );
    const discrepancy = Math.abs(subtotal - lineItemSum);

    return {
      isValid: discrepancy <= this.defaultTolerance,
      calculatedSubtotal: lineItemSum,
      actualSubtotal: subtotal,
      discrepancy,
      lineItemSum,
    };
  }

  private validateTaxRate(
    subtotal: number,
    taxAmount: number,
    text: string,
  ): TaxRateValidation {
    const calculatedRate = taxAmount / subtotal;

    // Try to extract declared tax rate from text
    const taxRateMatch = text.match(/tax\s*\((\d+(?:\.\d+)?)\s*%\)/i);
    const declaredRate = taxRateMatch
      ? parseFloat(taxRateMatch[1]) / 100
      : undefined;

    const discrepancy = declaredRate
      ? Math.abs(calculatedRate - declaredRate)
      : 0;
    const isValid = declaredRate ? discrepancy <= 0.005 : true; // 0.5% tolerance

    return {
      isValid,
      calculatedRate,
      declaredRate,
      discrepancy,
      confidence: isValid ? 0.9 : 0.6,
    };
  }

  private validateCurrencyConsistency(
    result: any,
    text: string,
  ): CurrencyValidation {
    const detectedCurrencies = new Set<string>();
    const inconsistencies: Array<{
      field: string;
      expectedCurrency: string;
      actualCurrency: string;
    }> = [];

    // Check declared currency
    let expectedCurrency = result.currency || 'USD';
    detectedCurrencies.add(expectedCurrency);

    // Check currency symbols in amounts
    const amountFields = ['totalAmount', 'subtotal', 'taxAmount'];
    for (const field of amountFields) {
      if (result[field]) {
        const currency = this.detectCurrencyFromText(text, field);
        if (currency && currency !== expectedCurrency) {
          detectedCurrencies.add(currency);
          inconsistencies.push({
            field,
            expectedCurrency,
            actualCurrency: currency,
          });
        }
      }
    }

    const isValid = detectedCurrencies.size === 1;
    const consistencyScore = isValid ? 1.0 : 1.0 / detectedCurrencies.size;

    return {
      isValid,
      detectedCurrencies: Array.from(detectedCurrencies),
      consistencyScore,
      inconsistencies: inconsistencies.length > 0 ? inconsistencies : undefined,
    };
  }

  private validateDiscountCalculation(
    result: any,
    text: string,
  ): DiscountCalculation | undefined {
    // Try to extract discount information from text
    const discountMatch = text.match(
      /discount\s*\((\d+(?:\.\d+)?)\s*%\)\s*:?\s*\$?([\d,\.]+)/i,
    );
    if (!discountMatch) return undefined;

    const discountPercentage = parseFloat(discountMatch[1]);
    const discountAmount = parseFloat(discountMatch[2].replace(/,/g, ''));

    // Calculate expected discount
    const baseAmount = result.subtotal || 0;
    const expectedDiscountAmount = baseAmount * (discountPercentage / 100);
    const discountedAmount = baseAmount - discountAmount;

    return {
      isValid:
        Math.abs(discountAmount - expectedDiscountAmount) <=
        this.defaultTolerance,
      discountAmount,
      discountPercentage,
      baseAmount,
      discountedAmount,
    };
  }

  private validatePrecision(result: any): PrecisionValidation {
    const roundingErrors: Array<{
      field: string;
      expected: number;
      actual: number;
      error: number;
    }> = [];

    // Check if amounts have appropriate decimal precision (typically 2 decimal places for currency)
    const amountFields = ['totalAmount', 'subtotal', 'taxAmount'];
    let isValid = true;

    for (const field of amountFields) {
      if (result[field] && typeof result[field] === 'number') {
        const value = result[field];
        const rounded = Math.round(value * 100) / 100;
        const error = Math.abs(value - rounded);

        if (error > 0.001) {
          // More than 0.1 cent error
          isValid = false;
          roundingErrors.push({
            field,
            expected: rounded,
            actual: value,
            error,
          });
        }
      }
    }

    return {
      isValid,
      roundingMethod: 'standard',
      precisionLevel: 2,
      roundingErrors: roundingErrors.length > 0 ? roundingErrors : undefined,
    };
  }

  private detectCurrencyFromText(
    text: string,
    field: string,
  ): string | undefined {
    // Look for currency symbols near the field value
    const fieldRegex = new RegExp(`${field}[^\\d]*([\\$€£¥₹])`, 'i');
    const match = text.match(fieldRegex);

    if (match && match[1]) {
      return this.currencySymbols.get(match[1]);
    }

    return undefined;
  }

  private calculateMathematicalConfidence(
    validation: MathematicalValidationResult,
  ): number {
    let confidence = 1.0;
    let factors = 0;

    // Factor in total calculation validation
    if (validation.totalCalculation) {
      confidence += validation.totalCalculation.isValid ? 1.0 : 0.3;
      factors++;
    }

    // Factor in line item validations
    if (validation.lineItemCalculations) {
      const validItems = validation.lineItemCalculations.filter(
        (item) => item.isValid,
      ).length;
      const itemConfidence =
        validItems / validation.lineItemCalculations.length;
      confidence += itemConfidence;
      factors++;
    }

    // Factor in subtotal validation
    if (validation.subtotalValidation) {
      confidence += validation.subtotalValidation.isValid ? 1.0 : 0.7;
      factors++;
    }

    // Factor in tax rate validation
    if (validation.taxRateValidation) {
      confidence += validation.taxRateValidation.confidence;
      factors++;
    }

    // Factor in currency validation
    if (validation.currencyValidation) {
      confidence += validation.currencyValidation.consistencyScore;
      factors++;
    }

    // Calculate average confidence
    return factors > 0 ? confidence / factors : 1.0;
  }
}
