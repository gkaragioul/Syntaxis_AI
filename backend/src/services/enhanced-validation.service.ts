import { EnhancedFieldExtractionService } from './enhanced-field.service';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'date' | 'email' | 'phone' | 'currency';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  customValidator?: (value: any, allFields: any) => ValidationResult;
}

interface ValidationResult {
  isValid: boolean;
  confidence: number;
  errors: string[];
  warnings: string[];
}

interface BusinessRule {
  name: string;
  description: string;
  validator: (fields: any) => ValidationResult;
}

export class EnhancedValidationService extends EnhancedFieldExtractionService {
  private readonly validationRules: Map<string, ValidationRule[]> = new Map();
  private readonly businessRules: BusinessRule[] = [];

  constructor(prisma: PrismaClient) {
    super(prisma);
    this.initializeValidationRules();
    this.initializeBusinessRules();
  }

  async extractFields(text: string, options: any): Promise<any> {
    // First extract fields using enhanced extraction
    const result = await super.extractFields(text, options);

    // Then apply comprehensive validation
    const validationResult = await this.validateExtractedFields(
      result,
      options,
    );

    // Adjust confidence based on validation results
    result.confidence = this.adjustConfidenceBasedOnValidation(
      result.confidence,
      validationResult,
    );

    // Add validation metadata
    result.validation = {
      isValid: validationResult.isValid,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      businessRulesPassed: validationResult.businessRulesPassed || 0,
      totalBusinessRules: this.businessRules.length,
    };

    logger.info('Enhanced validation completed', {
      isValid: validationResult.isValid,
      errorCount: validationResult.errors.length,
      warningCount: validationResult.warnings.length,
      businessRulesPassed: validationResult.businessRulesPassed || 0,
    });

    return result;
  }

  private initializeValidationRules(): void {
    // Invoice validation rules
    this.validationRules.set('invoice', [
      {
        field: 'invoiceNumber',
        type: 'string',
        required: true,
        pattern: /^[A-Z0-9\-\/\(\)\[\]\s]{1,50}$/,
      },
      {
        field: 'totalAmount',
        type: 'number',
        required: true,
        min: 0,
        max: 1000000,
      },
      {
        field: 'taxAmount',
        type: 'number',
        required: false,
        min: 0,
        max: 100000,
      },
      {
        field: 'subtotal',
        type: 'number',
        required: false,
        min: 0,
        max: 1000000,
      },
      {
        field: 'invoiceDate',
        type: 'date',
        required: true,
      },
      {
        field: 'dueDate',
        type: 'date',
        required: false,
      },
      {
        field: 'vendorName',
        type: 'string',
        required: true,
        pattern: /^[A-Za-z0-9\s\.\,\&\-]{1,100}$/,
      },
      {
        field: 'customerName',
        type: 'string',
        required: false,
        pattern: /^[A-Za-z0-9\s\.\,\&\-]{1,100}$/,
      },
      {
        field: 'email',
        type: 'email',
        required: false,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
      {
        field: 'phone',
        type: 'phone',
        required: false,
        pattern: /^[\+]?[1-9][\d\-\(\)\s\.]{7,15}$/,
      },
      {
        field: 'currency',
        type: 'currency',
        required: false,
        pattern: /^(USD|EUR|GBP|JPY|INR|CAD|AUD)$/,
      },
    ]);
  }

  private initializeBusinessRules(): void {
    // Mathematical consistency rules
    this.businessRules.push({
      name: 'totalAmountConsistency',
      description: 'Total amount should equal subtotal plus tax amount',
      validator: (fields: any) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let confidence = 1.0;

        if (fields.totalAmount && fields.subtotal && fields.taxAmount) {
          const calculatedTotal = fields.subtotal + fields.taxAmount;
          const discrepancy = Math.abs(fields.totalAmount - calculatedTotal);

          if (discrepancy > 0.01) {
            if (discrepancy > fields.totalAmount * 0.1) {
              errors.push(
                `Total amount discrepancy: expected ${calculatedTotal}, got ${fields.totalAmount}`,
              );
              confidence = 0.3;
            } else {
              warnings.push(
                `Minor total amount discrepancy: ${discrepancy.toFixed(2)}`,
              );
              confidence = 0.8;
            }
          }
        }

        return {
          isValid: errors.length === 0,
          confidence,
          errors,
          warnings,
        };
      },
    });

    // Date relationship rules
    this.businessRules.push({
      name: 'dateRelationships',
      description: 'Due date should be after invoice date',
      validator: (fields: any) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let confidence = 1.0;

        if (fields.invoiceDate && fields.dueDate) {
          if (fields.dueDate.getTime() < fields.invoiceDate.getTime()) {
            errors.push('Due date cannot be before invoice date');
            confidence = 0.5;
          } else if (
            fields.dueDate.getTime() === fields.invoiceDate.getTime()
          ) {
            warnings.push('Due date is the same as invoice date');
            confidence = 0.9;
          }
        }

        return {
          isValid: errors.length === 0,
          confidence,
          errors,
          warnings,
        };
      },
    });

    // Line item consistency rules
    this.businessRules.push({
      name: 'lineItemConsistency',
      description: 'Line item calculations should be accurate',
      validator: (fields: any) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let confidence = 1.0;

        if (fields.lineItems && Array.isArray(fields.lineItems)) {
          for (let i = 0; i < fields.lineItems.length; i++) {
            const item = fields.lineItems[i];
            if (item.quantity && item.unitPrice && item.amount) {
              const calculatedAmount = item.quantity * item.unitPrice;
              const discrepancy = Math.abs(item.amount - calculatedAmount);

              if (discrepancy > 0.01) {
                errors.push(
                  `Line item ${i + 1} calculation error: ${item.quantity} × ${item.unitPrice} ≠ ${item.amount}`,
                );
                confidence = Math.min(confidence, 0.7);
              }
            }
          }

          // Check if subtotal matches sum of line items
          if (fields.subtotal) {
            const calculatedSubtotal = fields.lineItems.reduce(
              (sum: number, item: any) => sum + (item.amount || 0),
              0,
            );
            const discrepancy = Math.abs(fields.subtotal - calculatedSubtotal);

            if (discrepancy > 0.01) {
              if (discrepancy > fields.subtotal * 0.05) {
                errors.push(
                  `Subtotal does not match sum of line items: expected ${calculatedSubtotal}, got ${fields.subtotal}`,
                );
                confidence = Math.min(confidence, 0.6);
              } else {
                warnings.push(
                  `Minor subtotal discrepancy: ${discrepancy.toFixed(2)}`,
                );
                confidence = Math.min(confidence, 0.9);
              }
            }
          }
        }

        return {
          isValid: errors.length === 0,
          confidence,
          errors,
          warnings,
        };
      },
    });

    // Currency consistency rules
    this.businessRules.push({
      name: 'currencyConsistency',
      description: 'All amounts should use consistent currency',
      validator: (fields: any) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let confidence = 1.0;

        const detectedCurrencies = new Set<string>();

        // Check currency field
        if (fields.currency) {
          detectedCurrencies.add(fields.currency);
        }

        // Detect currencies from amount fields (this would need to be implemented)
        // For now, we'll assume consistency if currency field is present

        if (detectedCurrencies.size > 1) {
          errors.push(
            `Inconsistent currencies detected: ${Array.from(detectedCurrencies).join(', ')}`,
          );
          confidence = 0.5;
        }

        return {
          isValid: errors.length === 0,
          confidence,
          errors,
          warnings,
        };
      },
    });

    // Vendor/Customer distinction rule
    this.businessRules.push({
      name: 'vendorCustomerDistinction',
      description: 'Vendor and customer should be different entities',
      validator: (fields: any) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let confidence = 1.0;

        if (fields.vendorName && fields.customerName) {
          if (
            fields.vendorName.toLowerCase() ===
            fields.customerName.toLowerCase()
          ) {
            warnings.push('Vendor and customer appear to be the same entity');
            confidence = 0.8;
          }
        }

        return {
          isValid: errors.length === 0,
          confidence,
          errors,
          warnings,
        };
      },
    });
  }

  private async validateExtractedFields(
    fields: any,
    options: any,
  ): Promise<any> {
    const documentType = options.type || 'invoice';
    const rules = this.validationRules.get(documentType) || [];

    const errors: string[] = [];
    const warnings: string[] = [];
    let overallConfidence = 1.0;
    let businessRulesPassed = 0;

    // Apply field-level validation rules
    for (const rule of rules) {
      const fieldValue = fields[rule.field];
      const fieldValidation = this.validateField(fieldValue, rule);

      if (!fieldValidation.isValid) {
        errors.push(...fieldValidation.errors);
        warnings.push(...fieldValidation.warnings);
      }

      overallConfidence = Math.min(
        overallConfidence,
        fieldValidation.confidence,
      );
    }

    // Apply business rules
    for (const businessRule of this.businessRules) {
      const ruleResult = businessRule.validator(fields);

      if (ruleResult.isValid) {
        businessRulesPassed++;
      } else {
        errors.push(...ruleResult.errors);
        warnings.push(...ruleResult.warnings);
      }

      overallConfidence = Math.min(overallConfidence, ruleResult.confidence);
    }

    return {
      isValid: errors.length === 0,
      confidence: overallConfidence,
      errors,
      warnings,
      businessRulesPassed,
    };
  }

  private validateField(value: any, rule: ValidationRule): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 1.0;

    // Check required fields
    if (
      rule.required &&
      (value === null || value === undefined || value === '')
    ) {
      errors.push(`Field '${rule.field}' is required but missing`);
      return { isValid: false, confidence: 0, errors, warnings };
    }

    // Skip validation if field is not present and not required
    if (value === null || value === undefined || value === '') {
      return { isValid: true, confidence: 1.0, errors, warnings };
    }

    // Type-specific validation
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`Field '${rule.field}' must be a string`);
          confidence = 0.3;
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push(`Field '${rule.field}' must be a valid number`);
          confidence = 0.3;
        } else {
          if (rule.min !== undefined && value < rule.min) {
            errors.push(`Field '${rule.field}' must be at least ${rule.min}`);
            confidence = 0.5;
          }
          if (rule.max !== undefined && value > rule.max) {
            errors.push(`Field '${rule.field}' must be at most ${rule.max}`);
            confidence = 0.5;
          }
        }
        break;

      case 'date':
        if (!(value instanceof Date) || isNaN(value.getTime())) {
          errors.push(`Field '${rule.field}' must be a valid date`);
          confidence = 0.3;
        }
        break;

      case 'email':
      case 'phone':
      case 'currency':
        if (typeof value !== 'string') {
          errors.push(`Field '${rule.field}' must be a string`);
          confidence = 0.3;
        }
        break;
    }

    // Pattern validation
    if (rule.pattern && typeof value === 'string') {
      if (!rule.pattern.test(value)) {
        errors.push(`Field '${rule.field}' does not match required format`);
        confidence = Math.min(confidence, 0.6);
      }
    }

    // Custom validation
    if (rule.customValidator) {
      const customResult = rule.customValidator(value, {});
      errors.push(...customResult.errors);
      warnings.push(...customResult.warnings);
      confidence = Math.min(confidence, customResult.confidence);
    }

    return {
      isValid: errors.length === 0,
      confidence,
      errors,
      warnings,
    };
  }

  private adjustConfidenceBasedOnValidation(
    originalConfidence: any,
    validationResult: any,
  ): any {
    const adjustedConfidence = { ...originalConfidence };

    // Reduce confidence for fields with validation errors
    for (const field in adjustedConfidence) {
      if (
        validationResult.errors.some((error: string) => error.includes(field))
      ) {
        adjustedConfidence[field] = Math.min(adjustedConfidence[field], 0.5);
      }
      if (
        validationResult.warnings.some((warning: string) =>
          warning.includes(field),
        )
      ) {
        adjustedConfidence[field] = Math.min(adjustedConfidence[field], 0.8);
      }
    }

    // Apply overall validation confidence
    for (const field in adjustedConfidence) {
      adjustedConfidence[field] =
        adjustedConfidence[field] * validationResult.confidence;
    }

    return adjustedConfidence;
  }
}
