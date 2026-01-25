// @ts-nocheck

import { EnhancedValidationService } from './enhanced-validation.service';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

interface ConfidenceFactors {
  patternMatch: number;
  contextualRelevance: number;
  dataQuality: number;
  mathematicalConsistency: number;
  fieldCompleteness: number;
  validationScore: number;
}

interface FieldImportance {
  [key: string]: number;
}

interface ConfidenceWeights {
  patternMatch: number;
  contextualRelevance: number;
  dataQuality: number;
  mathematicalConsistency: number;
  fieldCompleteness: number;
  validationScore: number;
}

export class EnhancedConfidenceService extends EnhancedValidationService {
  private readonly fieldImportanceWeights: FieldImportance = {
    invoiceNumber: 1.0,
    totalAmount: 1.0,
    invoiceDate: 0.9,
    vendorName: 0.8,
    customerName: 0.7,
    dueDate: 0.7,
    subtotal: 0.8,
    taxAmount: 0.8,
    currency: 0.6,
    lineItems: 0.9,
  };

  private readonly confidenceWeights: ConfidenceWeights = {
    patternMatch: 0.25,
    contextualRelevance: 0.15,
    dataQuality: 0.2,
    mathematicalConsistency: 0.15,
    fieldCompleteness: 0.1,
    validationScore: 0.15,
  };

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async extractFields(text: string, options: any): Promise<any> {
    // First extract fields using enhanced validation
    const result = await super.extractFields(text, options);

    // Then apply enhanced confidence scoring
    const enhancedConfidence = await this.calculateEnhancedConfidence(
      result,
      text,
      options,
    );

    // Replace the confidence scores with enhanced ones
    result.confidence = enhancedConfidence.fieldConfidences;
    result.overallConfidence = enhancedConfidence.overallConfidence;
    result.confidenceFactors = enhancedConfidence.factors;

    logger.info('Enhanced confidence scoring completed', {
      overallConfidence: enhancedConfidence.overallConfidence,
      avgFieldConfidence:
        Object.values(enhancedConfidence.fieldConfidences).reduce(
          (sum: number, conf: number) => sum + conf,
          0,
        ) / Object.values(enhancedConfidence.fieldConfidences).length,
      confidenceFactors: enhancedConfidence.factors,
    });

    return result;
  }

  private async calculateEnhancedConfidence(
    result: any,
    text: string,
    options: any,
  ): Promise<any> {
    const fieldConfidences: { [key: string]: number } = {};
    const factors: ConfidenceFactors = {
      patternMatch: 0,
      contextualRelevance: 0,
      dataQuality: 0,
      mathematicalConsistency: 0,
      fieldCompleteness: 0,
      validationScore: 0,
    };

    // Calculate confidence for each extracted field
    for (const [fieldName, fieldValue] of Object.entries(result)) {
      if (
        fieldName === 'confidence' ||
        fieldName === 'rawText' ||
        fieldName === 'validation' ||
        fieldValue === null ||
        fieldValue === undefined
      ) {
        continue;
      }

      const fieldConfidence = await this.calculateFieldConfidence(
        fieldName,
        fieldValue,
        result,
        text,
        options,
      );
      fieldConfidences[fieldName] = fieldConfidence.confidence;

      // Aggregate factors (weighted by field importance)
      const importance = this.fieldImportanceWeights[fieldName] || 0.5;
      factors.patternMatch += fieldConfidence.factors.patternMatch * importance;
      factors.contextualRelevance +=
        fieldConfidence.factors.contextualRelevance * importance;
      factors.dataQuality += fieldConfidence.factors.dataQuality * importance;
    }

    // Calculate document-level factors
    factors.mathematicalConsistency =
      this.calculateMathematicalConsistency(result);
    factors.fieldCompleteness = this.calculateFieldCompleteness(
      result,
      options,
    );
    factors.validationScore = this.calculateValidationScore(result);

    // Normalize factors by number of fields
    const fieldCount = Object.keys(fieldConfidences).length;
    if (fieldCount > 0) {
      factors.patternMatch /= fieldCount;
      factors.contextualRelevance /= fieldCount;
      factors.dataQuality /= fieldCount;
    }

    // Calculate overall confidence using weighted factors
    const overallConfidence = this.aggregateConfidenceFactors(factors);

    return {
      fieldConfidences,
      overallConfidence,
      factors,
    };
  }

  private async calculateFieldConfidence(
    fieldName: string,
    fieldValue: any,
    allFields: any,
    text: string,
    options: any,
  ): Promise<any> {
    const factors: ConfidenceFactors = {
      patternMatch: 0,
      contextualRelevance: 0,
      dataQuality: 0,
      mathematicalConsistency: 0,
      fieldCompleteness: 0,
      validationScore: 0,
    };

    // Pattern match confidence
    factors.patternMatch = this.calculatePatternMatchConfidence(
      fieldName,
      fieldValue,
      text,
    );

    // Contextual relevance confidence
    factors.contextualRelevance = this.calculateContextualRelevance(
      fieldName,
      fieldValue,
      text,
    );

    // Data quality confidence
    factors.dataQuality = this.calculateDataQuality(
      fieldName,
      fieldValue,
      text,
    );

    // Aggregate field confidence
    const confidence = this.aggregateConfidenceFactors(factors);

    return { confidence, factors };
  }

  private calculatePatternMatchConfidence(
    fieldName: string,
    fieldValue: any,
    text: string,
  ): number {
    // Base confidence on how well the field matches expected patterns
    let confidence = 0.5; // Base confidence

    switch (fieldName) {
      case 'invoiceNumber':
        if (typeof fieldValue === 'string') {
          // Check for strong patterns
          if (/^[A-Z]{2,}-[0-9]{4}-[0-9]{3,}$/.test(fieldValue)) {
            confidence = 0.95; // Strong pattern like INV-2024-001
          } else if (/^[A-Z0-9\-]{5,}$/.test(fieldValue)) {
            confidence = 0.85; // Good pattern
          } else if (fieldValue.length >= 3) {
            confidence = 0.7; // Acceptable pattern
          }
        }
        break;

      case 'totalAmount':
      case 'taxAmount':
      case 'subtotal':
        if (typeof fieldValue === 'number' && fieldValue > 0) {
          // Check if amount has reasonable precision
          const decimalPlaces = (fieldValue.toString().split('.')[1] || '')
            .length;
          if (decimalPlaces <= 2) {
            confidence = 0.9; // Standard currency precision
          } else {
            confidence = 0.7; // Unusual precision
          }
        }
        break;

      case 'invoiceDate':
      case 'dueDate':
        if (fieldValue instanceof Date && !isNaN(fieldValue.getTime())) {
          const year = fieldValue.getFullYear();
          const currentYear = new Date().getFullYear();

          // Check if date is reasonable
          if (year >= currentYear - 5 && year <= currentYear + 2) {
            confidence = 0.9; // Reasonable date range
          } else {
            confidence = 0.6; // Unusual date range
          }
        }
        break;

      case 'vendorName':
      case 'customerName':
        if (typeof fieldValue === 'string' && fieldValue.length > 0) {
          // Check for business name patterns
          if (/\b(Inc|Corp|LLC|Ltd|Company|Co\.)\b/i.test(fieldValue)) {
            confidence = 0.9; // Contains business entity indicators
          } else if (fieldValue.length >= 3) {
            confidence = 0.8; // Reasonable name length
          }
        }
        break;

      default:
        confidence = 0.7; // Default confidence for other fields
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  private calculateContextualRelevance(
    fieldName: string,
    fieldValue: any,
    text: string,
  ): number {
    let relevance = 0.5; // Base relevance

    const textLower = text.toLowerCase();

    switch (fieldName) {
      case 'vendorName':
        // Check if found in vendor context
        if (
          textLower.includes('from:') ||
          textLower.includes('vendor:') ||
          textLower.includes('seller:')
        ) {
          relevance = 0.9;
        } else if (
          textLower.includes('bill from') ||
          textLower.includes('invoice from')
        ) {
          relevance = 0.85;
        }
        break;

      case 'customerName':
        // Check if found in customer context
        if (
          textLower.includes('to:') ||
          textLower.includes('customer:') ||
          textLower.includes('buyer:')
        ) {
          relevance = 0.9;
        } else if (
          textLower.includes('bill to') ||
          textLower.includes('ship to')
        ) {
          relevance = 0.85;
        }
        break;

      case 'totalAmount':
        // Check if found near total indicators
        if (
          textLower.includes('total') ||
          textLower.includes('amount due') ||
          textLower.includes('grand total')
        ) {
          relevance = 0.95;
        }
        break;

      case 'taxAmount':
        // Check if found near tax indicators
        if (
          textLower.includes('tax') ||
          textLower.includes('vat') ||
          textLower.includes('gst')
        ) {
          relevance = 0.9;
        }
        break;

      default:
        relevance = 0.7;
    }

    return Math.min(Math.max(relevance, 0), 1);
  }

  private calculateDataQuality(
    fieldName: string,
    fieldValue: any,
    text: string,
  ): number {
    let quality = 0.5; // Base quality

    // Check for OCR quality indicators in the surrounding text
    const ocrErrorPatterns = [
      /[0O]{2,}/, // Multiple zeros/Os
      /[1Il]{3,}/, // Multiple 1s/Is/ls
      /[^\w\s\-\.\,\$€£¥₹\(\)\[\]\/]{2,}/, // Multiple special characters
    ];

    let ocrErrorCount = 0;
    for (const pattern of ocrErrorPatterns) {
      if (pattern.test(text)) {
        ocrErrorCount++;
      }
    }

    // Adjust quality based on OCR error indicators
    if (ocrErrorCount === 0) {
      quality = 0.95; // High quality text
    } else if (ocrErrorCount <= 2) {
      quality = 0.8; // Medium quality text
    } else {
      quality = 0.6; // Lower quality text
    }

    // Field-specific quality checks
    if (typeof fieldValue === 'string') {
      // Check for common OCR errors in the field value itself
      if (/[0O][1Il]|[1Il][0O]/.test(fieldValue)) {
        quality *= 0.8; // Potential OCR confusion
      }

      // Check for reasonable field length
      if (fieldValue.length < 2) {
        quality *= 0.7; // Very short fields are suspicious
      }
    }

    return Math.min(Math.max(quality, 0), 1);
  }

  private calculateMathematicalConsistency(result: any): number {
    let consistency = 1.0; // Start with perfect consistency

    // Check total = subtotal + tax
    if (result.totalAmount && result.subtotal && result.taxAmount) {
      const calculatedTotal = result.subtotal + result.taxAmount;
      const discrepancy = Math.abs(result.totalAmount - calculatedTotal);
      const relativeError = discrepancy / result.totalAmount;

      if (relativeError > 0.1) {
        consistency = 0.3; // Major discrepancy
      } else if (relativeError > 0.01) {
        consistency = 0.7; // Minor discrepancy
      } else {
        consistency = 1.0; // Good consistency
      }
    }

    // Check line item calculations
    if (result.lineItems && Array.isArray(result.lineItems)) {
      let lineItemConsistency = 1.0;

      for (const item of result.lineItems) {
        if (item.quantity && item.unitPrice && item.amount) {
          const calculatedAmount = item.quantity * item.unitPrice;
          const discrepancy = Math.abs(item.amount - calculatedAmount);

          if (discrepancy > 0.01) {
            lineItemConsistency *= 0.8;
          }
        }
      }

      consistency = Math.min(consistency, lineItemConsistency);
    }

    return Math.min(Math.max(consistency, 0), 1);
  }

  private calculateFieldCompleteness(result: any, options: any): number {
    const requiredFields = options.requiredFields || [];
    if (requiredFields.length === 0) return 1.0;

    const extractedFields = requiredFields.filter(
      (field: string) =>
        result[field] !== null &&
        result[field] !== undefined &&
        result[field] !== '',
    );

    const completeness = extractedFields.length / requiredFields.length;

    // Apply bonus for over-completion (extracting more than required)
    const allExtractedFields = Object.keys(result).filter(
      (key) =>
        key !== 'confidence' &&
        key !== 'rawText' &&
        key !== 'validation' &&
        result[key] !== null &&
        result[key] !== undefined,
    );

    const overCompletionBonus = Math.min(
      (allExtractedFields.length - requiredFields.length) * 0.05,
      0.2,
    );

    return Math.min(completeness + overCompletionBonus, 1.0);
  }

  private calculateValidationScore(result: any): number {
    if (!result.validation) return 0.8; // Default if no validation

    let score = 1.0;

    // Penalize for validation errors
    if (result.validation.errors && result.validation.errors.length > 0) {
      score -= result.validation.errors.length * 0.2;
    }

    // Minor penalty for warnings
    if (result.validation.warnings && result.validation.warnings.length > 0) {
      score -= result.validation.warnings.length * 0.05;
    }

    // Bonus for passing business rules
    if (
      result.validation.businessRulesPassed &&
      result.validation.totalBusinessRules
    ) {
      const businessRuleScore =
        result.validation.businessRulesPassed /
        result.validation.totalBusinessRules;
      score = score * 0.8 + businessRuleScore * 0.2;
    }

    return Math.min(Math.max(score, 0), 1);
  }

  private aggregateConfidenceFactors(factors: ConfidenceFactors): number {
    return (
      factors.patternMatch * this.confidenceWeights.patternMatch +
      factors.contextualRelevance * this.confidenceWeights.contextualRelevance +
      factors.dataQuality * this.confidenceWeights.dataQuality +
      factors.mathematicalConsistency *
        this.confidenceWeights.mathematicalConsistency +
      factors.fieldCompleteness * this.confidenceWeights.fieldCompleteness +
      factors.validationScore * this.confidenceWeights.validationScore
    );
  }
}
