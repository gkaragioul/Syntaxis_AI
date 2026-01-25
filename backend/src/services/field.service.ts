// @ts-nocheck

import { logger } from '../utils/logger';
import { ValidationError } from '../utils/errors';
import { PrismaClient } from '@prisma/client';

interface FieldPattern {
  id?: string;
  field: string;
  patterns: string[];
  priority: number;
}

interface ValidationRule {
  type: 'string' | 'number' | 'date' | 'email';
  required?: boolean;
  min?: number;
  max?: number | string;
  pattern?: string;
  custom?: (value: any) => boolean;
}

interface ExtractionRule {
  id?: string;
  field: string;
  validation: ValidationRule;
  confidence: number;
}

interface ExtractedFields {
  [key: string]: any;
}

export interface ExtractionOptions {
  type: string;
  requiredFields?: string[];
  confidenceThreshold?: number;
  fieldTransformations?: Record<string, (value: any) => any>;
  ocrResult?: any; // Pass full OCR result for advanced extraction
}

export interface ExtractionResult {
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  dueDate: Date | null;
  vendorName: string | null;
  totalAmount: number | null;
  taxAmount: number | null;
  subtotal: number | null;
  currency: string | null;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  confidence: {
    [key: string]: number;
  };
  rawText: string;
}

import { TreasuryConsolidationParser } from './parsers/TreasuryConsolidationParser';
import { GenericTableParser } from './extraction/GenericTableParser';

// ... (existing imports)

export class FieldExtractionService {
  constructor(private prisma: PrismaClient) {}

  async extractFields(
    text: string,
    options: ExtractionOptions,
  ): Promise<ExtractionResult> {
    try {
      logger.info('Extracting fields from text', {
        type: options.type,
        requiredFields: options.requiredFields,
      });

      // Check for specialized Treasury Consolidation template
      if (TreasuryConsolidationParser.matches(text)) {
         logger.info('Detected Treasury Consolidation template');
         const tableData = TreasuryConsolidationParser.parse(text);
         
         // Return a specialized result
         return {
            invoiceNumber: 'Treasury-Consolidation', 
            invoiceDate: new Date(), 
            dueDate: null,
            vendorName: 'Government of Puducherry',
            totalAmount: 0, 
            taxAmount: 0,
            subtotal: 0,
            currency: 'INR',
            lineItems: [], 
            confidence: {
                template: 1.0,
            },
            rawText: text,
            // @ts-ignore
            customTable: tableData 
         };
      }

      // GENERIC TABLE EXTRACTION FALLBACK
      // If no specific template matched, try to find ANY tables using machine vision
      // We check if we have bounding box data available in options (passed from InvoiceService)
      if (options.ocrResult?.metadata?.boundingBoxes) {
          logger.info('Attempting generic table extraction');
          try {
              const genericParser = new GenericTableParser(null as any); // Service dependency not needed for purely static processing
              const detectedTables = genericParser.processOCRData(options.ocrResult.metadata.boundingBoxes);
              
              if (detectedTables.length > 0) {
                  logger.info(`Detected ${detectedTables.length} generic tables`);
                  // Use the first detected table
                  const tableData = detectedTables[0];
                  
                  return {
                    invoiceNumber: 'Generic-Table-Extract',
                    invoiceDate: new Date(),
                    dueDate: null,
                    vendorName: 'Detected Table',
                    totalAmount: 0,
                    taxAmount: 0,
                    subtotal: 0,
                    currency: 'USD',
                    lineItems: [],
                    confidence: {
                        template: 0.8,
                    },
                    rawText: text,
                    // @ts-ignore
                    customTable: tableData
                  };
              }
          } catch (err) {
              logger.warn('Generic table extraction failed', { error: err });
              // Continue to mock fallback
          }
      }

      // PLACEHOLDER: Mock implementation for testing
      // Actual field extraction is handled by the ExtractionService which uses:
      // 1. Template-based extraction (TemplateService)
      // 2. AI/ML-powered extraction (when configured)
      // 3. Rule-based pattern matching for standard invoice formats
      // This service provides a fallback/mock response for development and testing
      const result: ExtractionResult = {
        invoiceNumber: 'INV-2024-001',
        invoiceDate: new Date('2024-03-15'),
        dueDate: new Date('2024-04-15'),
        vendorName: 'Sample Vendor Inc.',
        totalAmount: 1234.56,
        taxAmount: 123.46,
        subtotal: 1111.1,
        currency: 'USD',
        lineItems: [
          {
            description: 'Product A',
            quantity: 2,
            unitPrice: 500.0,
            amount: 1000.0,
          },
          {
            description: 'Service B',
            quantity: 1,
            unitPrice: 111.1,
            amount: 111.1,
          },
        ],
        confidence: {
          invoiceNumber: 0.95,
          invoiceDate: 0.98,
          dueDate: 0.98,
          vendorName: 0.92,
          totalAmount: 0.99,
          taxAmount: 0.97,
          subtotal: 0.99,
          currency: 1.0,
        },
        rawText: text,
      };

      // Validate required fields
      if (options.requiredFields) {
        const missingFields = options.requiredFields.filter(
          (field) => !result[field as keyof ExtractionResult],
        );

        if (missingFields.length > 0) {
          throw new ValidationError(
            `Missing required fields: ${missingFields.join(', ')}`,
          );
        }
      }

      // Check confidence threshold
      const confidenceThreshold = options.confidenceThreshold || 0.8;
      const lowConfidenceFields = Object.entries(result.confidence)
        .filter(([_, value]) => value < confidenceThreshold)
        .map(([key]) => key);

      if (lowConfidenceFields.length > 0) {
        logger.warn('Low confidence fields detected', {
          fields: lowConfidenceFields,
          threshold: confidenceThreshold,
        });
      }

      logger.info('Field extraction completed', {
        type: options.type,
        confidence:
          Object.values(result.confidence).reduce((a, b) => a + b, 0) /
          Object.keys(result.confidence).length,
      });

      return result;
    } catch (error) {
      logger.error('Field extraction failed', {
        type: options.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getExtraction(
    extractionId: string,
    userId: string,
  ): Promise<ExtractionResult> {
    // Find extraction and verify ownership
    const extraction = await this.prisma.extraction.findUnique({
      where: { id: extractionId },
      include: { file: true },
    });

    if (!extraction) {
      throw new ValidationError('Extraction not found');
    }

    if (extraction.file.userId !== userId) {
      throw new ValidationError('Not authorized to access this extraction');
    }

    return extraction.result as ExtractionResult;
  }

  async updateFieldPatterns(
    userId: string,
    patterns: FieldPattern[],
  ): Promise<FieldPattern[]> {
    // Validate patterns
    for (const pattern of patterns) {
      if (!pattern.field || pattern.field.trim() === '') {
        throw new ValidationError(
          'field',
          pattern.field,
          'Field name is required',
        );
      }

      if (!pattern.patterns || !Array.isArray(pattern.patterns)) {
        throw new ValidationError(
          'patterns',
          pattern.patterns,
          'Patterns must be an array',
        );
      }

      // Validate that patterns array is not empty for required fields
      if (pattern.patterns.length === 0) {
        throw new ValidationError(
          'patterns',
          pattern.patterns,
          'Patterns array cannot be empty',
        );
      }

      // Validate pattern format
      for (const patternStr of pattern.patterns) {
        if (typeof patternStr !== 'string' || patternStr.trim() === '') {
          throw new ValidationError(
            'patterns',
            patternStr,
            'Each pattern must be a non-empty string',
          );
        }
      }

      if (
        pattern.priority === undefined ||
        pattern.priority < 1 ||
        pattern.priority > 10
      ) {
        throw new ValidationError(
          'priority',
          pattern.priority,
          'Priority is required and must be between 1 and 10',
        );
      }
    }

    // Update or create patterns
    const updatedPatterns = await Promise.all(
      patterns.map(async (pattern) => {
        if (pattern.id) {
          // Update existing pattern
          return this.prisma.fieldPattern.update({
            where: { id: pattern.id },
            data: {
              field: pattern.field,
              patterns: pattern.patterns,
              priority: pattern.priority,
              userId,
            },
          });
        } else {
          // Create new pattern
          return this.prisma.fieldPattern.create({
            data: {
              field: pattern.field,
              patterns: pattern.patterns,
              priority: pattern.priority,
              userId,
            },
          });
        }
      }),
    );

    return updatedPatterns;
  }

  async updateExtractionRules(
    userId: string,
    rules: ExtractionRule[],
  ): Promise<ExtractionRule[]> {
    // Validate rules
    for (const rule of rules) {
      if (!rule.field || rule.field.trim() === '') {
        throw new ValidationError(
          'field',
          rule.field,
          'Field name is required',
        );
      }

      if (!rule.validation || !rule.validation.type) {
        throw new ValidationError(
          'validation',
          rule.validation,
          'Validation type is required',
        );
      }

      // Validate type is valid
      const validTypes = ['string', 'number', 'date', 'boolean', 'email'];
      if (!validTypes.includes(rule.validation.type)) {
        throw new ValidationError(
          'validation.type',
          rule.validation.type,
          'Invalid validation type',
        );
      }

      // Validate number constraints
      if (rule.validation.type === 'number') {
        if (
          rule.validation.min !== undefined &&
          rule.validation.max !== undefined
        ) {
          if (rule.validation.min > rule.validation.max) {
            throw new ValidationError(
              'validation',
              rule.validation,
              'Min value cannot be greater than max value',
            );
          }
        }
      }

      // Validate string constraints
      if (rule.validation.type === 'string') {
        if (
          rule.validation.min !== undefined &&
          rule.validation.max !== undefined
        ) {
          if (rule.validation.min > rule.validation.max) {
            throw new ValidationError(
              'validation',
              rule.validation,
              'Min length cannot be greater than max length',
            );
          }
        }
      }

      // Validate confidence
      if (
        rule.confidence !== undefined &&
        (rule.confidence < 0 || rule.confidence > 1)
      ) {
        throw new ValidationError(
          'confidence',
          rule.confidence,
          'Confidence must be between 0 and 1',
        );
      }

      // Handle custom functions by converting them to strings for storage
      if (
        rule.validation.custom &&
        typeof rule.validation.custom === 'function'
      ) {
        // Convert function to string for storage
        rule.validation.custom = rule.validation.custom.toString();
      }
    }

    // Update or create rules
    const updatedRules = await Promise.all(
      rules.map(async (rule) => {
        if (rule.id) {
          // Update existing rule
          return this.prisma.extractionRule.update({
            where: { id: rule.id },
            data: {
              field: rule.field,
              validation: rule.validation,
              confidence: rule.confidence,
              userId,
            },
          });
        } else {
          // Create new rule
          return this.prisma.extractionRule.create({
            data: {
              field: rule.field,
              validation: rule.validation,
              confidence: rule.confidence,
              userId,
            },
          });
        }
      }),
    );

    return updatedRules;
  }

  async createTemplate(
    userId: string,
    template: {
      name: string;
      type: 'invoice' | 'receipt';
      patterns: Record<string, string[]>;
      confidence: number;
      vendorName?: string;
      fieldMappings?: Record<string, any>;
    },
  ): Promise<any> {
    // Validate template
    if (!template.name || template.name.trim() === '') {
      throw new ValidationError(
        'name',
        template.name,
        'Template name is required',
      );
    }

    if (!template.type || !['invoice', 'receipt'].includes(template.type)) {
      throw new ValidationError(
        'type',
        template.type,
        'Template type must be invoice or receipt',
      );
    }

    if (template.confidence < 0 || template.confidence > 1) {
      throw new ValidationError(
        'confidence',
        template.confidence,
        'Confidence must be between 0 and 1',
      );
    }

    // Create template in database
    const createdTemplate = await this.prisma.template.create({
      data: {
        userId,
        name: template.name,
        vendorName: template.vendorName || 'Default Vendor',
        patterns: template.patterns,
        fieldMappings: template.fieldMappings || {},
      },
    });

    return createdTemplate;
  }

  async getTemplates(userId: string): Promise<any[]> {
    const templates = await this.prisma.template.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return templates;
  }

  async updateTemplate(
    templateId: string,
    updates: {
      name?: string;
      patterns?: Record<string, string[]>;
      fieldMappings?: Record<string, any>;
    },
  ): Promise<any> {
    // Validate updates
    if (updates.name !== undefined && updates.name.trim() === '') {
      throw new ValidationError(
        'name',
        updates.name,
        'Template name cannot be empty',
      );
    }

    const updatedTemplate = await this.prisma.template.update({
      where: { id: templateId },
      data: updates,
    });

    return updatedTemplate;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.prisma.template.delete({
      where: { id: templateId },
    });
  }

  private extractFieldsFromText(
    text: string,
    patterns: FieldPattern[],
  ): ExtractedFields {
    const fields: ExtractedFields = {};
    const lines = text.split('\n');

    for (const pattern of patterns) {
      for (const line of lines) {
        for (const patternStr of pattern.patterns) {
          if (line.includes(patternStr)) {
            const value = line.split(patternStr)[1]?.trim();
            if (value) {
              fields[pattern.field] = this.parseFieldValue(
                value,
                pattern.field,
              );
              break;
            }
          }
        }
        if (fields[pattern.field]) break;
      }
    }

    return fields;
  }

  private parseFieldValue(value: string, field: string): any {
    // Remove currency symbols and commas
    const cleanValue = value.replace(/[$,]/g, '');

    switch (field) {
      case 'totalAmount':
      case 'taxAmount':
      case 'subtotal':
        return parseFloat(cleanValue);
      case 'invoiceDate':
      case 'dueDate':
        return new Date(cleanValue);
      default:
        return cleanValue;
      }
    }
  
    private validateFields(
      fields: ExtractedFields,
      rules: ExtractionRule[],
    ): ValidationError[] {
      const errors: ValidationError[] = [];
  
      for (const rule of rules) {
        const value = fields[rule.field];
  
        // Check required fields
        if (
          rule.validation.required &&
          (value === undefined || value === null || value === '')
        ) {
          errors.push({
            field: rule.field,
            error: 'Field is required',
          });
          continue;
        }
  
        if (value === undefined || value === null) continue;
  
        // Type validation
        switch (rule.validation.type) {
          case 'number':
            if (typeof value !== 'number') {
              errors.push({
                field: rule.field,
                error: 'Value must be a number',
              });
              continue;
            }
            if (
              rule.validation.min !== undefined &&
              value < rule.validation.min
            ) {
              errors.push({
                field: rule.field,
                error: `Value must be greater than ${rule.validation.min}`,
              });
            }
            if (rule.validation.max !== undefined) {
              const maxValue =
                typeof rule.validation.max === 'string'
                  ? fields[rule.validation.max]
                  : rule.validation.max;
              if (value > maxValue) {
                errors.push({
                  field: rule.field,
                  error: `Value must be less than or equal to ${maxValue}`,
                });
              }
            }
            break;
  
          case 'date':
            if (!(value instanceof Date) || isNaN(value.getTime())) {
              errors.push({
                field: rule.field,
                error: 'Value must be a valid date',
              });
            }
            break;
  
          case 'email':
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              errors.push({
                field: rule.field,
                error: 'Value must be a valid email address',
              });
            }
            break;
  
          case 'string':
            if (
              rule.validation.pattern &&
              !new RegExp(rule.validation.pattern).test(value)
            ) {
              errors.push({
                field: rule.field,
                error: 'Value does not match required pattern',
              });
            }
            break;
        }
  
        // Custom validation
        if (rule.validation.custom && !rule.validation.custom(value)) {
          errors.push({
            field: rule.field,
            error: 'Value failed custom validation',
          });
        }
      }
  
      return errors;
    }
  
    private calculateConfidence(
      fields: ExtractedFields,
      patterns: FieldPattern[],
      ocrConfidence: number,
    ): number {
      // Base confidence on OCR result
      let confidence = ocrConfidence;
  
      // Adjust confidence based on field extraction
      const extractedFields = Object.keys(fields).length;
      const totalFields = patterns.length;
      const fieldConfidence = extractedFields / totalFields;
  
      // Weight OCR confidence and field extraction confidence
      confidence = confidence * 0.7 + fieldConfidence * 0.3;
  
      // Penalize for missing required fields
      const requiredFields = patterns.filter((p) => p.priority === 1);
      const missingRequired = requiredFields.filter(
        (p) => !fields[p.field],
      ).length;
      if (missingRequired > 0) {
        confidence *= 1 - (missingRequired / requiredFields.length) * 0.5;
      }
  
      return Math.min(Math.max(confidence, 0), 1);
    }
  }
