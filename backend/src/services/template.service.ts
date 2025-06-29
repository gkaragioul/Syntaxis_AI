import { PrismaClient } from '@prisma/client';
import {
  ValidationError,
  ServiceError,
  AuthorizationError,
  NotFoundError,
} from '../utils/errors';

interface FieldMapping {
  type: 'string' | 'number' | 'date' | 'email';
  required?: boolean;
  min?: number;
  max?: number | string;
  pattern?: string;
  custom?: (value: any) => boolean;
}

interface TemplatePatterns {
  [field: string]: string[];
}

interface FieldMappings {
  [field: string]: FieldMapping;
}

interface TemplateData {
  name: string;
  vendorName: string;
  patterns: TemplatePatterns;
  fieldMappings: FieldMappings;
}

interface Template extends TemplateData {
  id: string;
  userId: string;
  successRate: number;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface TemplateAnalytics {
  totalTemplates: number;
  averageSuccessRate: number;
  totalUsage: number;
  templates: Array<{
    id: string;
    name: string;
    vendorName: string;
    successRate: number;
    usageCount: number;
  }>;
}

interface ValidationError {
  field: string;
  error: string;
}

interface TemplateApplicationResult {
  id: string;
  templateId: string;
  extractionId: string;
  status: 'completed' | 'validation_failed' | 'failed';
  confidence: number;
  validationErrors?: ValidationError[];
  createdAt: Date;
  updatedAt: Date;
}

export class TemplateService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createTemplate(userId: string, data: TemplateData): Promise<Template> {
    // Validate template data
    if (!data.patterns || Object.keys(data.patterns).length === 0) {
      throw new ValidationError('Template must have at least one pattern');
    }

    if (!data.fieldMappings || Object.keys(data.fieldMappings).length === 0) {
      throw new ValidationError(
        'Template must have at least one field mapping',
      );
    }

    // Validate field mappings match patterns
    for (const field of Object.keys(data.patterns)) {
      if (!data.fieldMappings[field]) {
        throw new ValidationError(
          `Field mapping missing for pattern: ${field}`,
        );
      }
    }

    // Create template
    return this.prisma.template.create({
      data: {
        userId,
        name: data.name,
        vendorName: data.vendorName,
        patterns: data.patterns,
        fieldMappings: data.fieldMappings,
        successRate: 0,
        usageCount: 0,
      },
    });
  }

  async getTemplate(templateId: string, userId: string): Promise<Template> {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundError('Template not found');
    }

    if (template.userId !== userId) {
      throw new AuthorizationError('Not authorized to access this template');
    }

    return template;
  }

  async applyTemplate(
    templateId: string,
    extractionId: string,
    userId: string,
  ): Promise<TemplateApplicationResult> {
    // Get template and extraction
    const [template, extraction] = await Promise.all([
      this.getTemplate(templateId, userId),
      this.prisma.extraction.findUnique({
        where: { id: extractionId },
      }),
    ]);

    if (!extraction) {
      throw new NotFoundError('Extraction not found');
    }

    if (extraction.userId !== userId) {
      throw new AuthorizationError('Not authorized to access this extraction');
    }

    // Validate fields against template mappings
    const validationErrors = this.validateFields(
      extraction.fields,
      template.fieldMappings,
    );

    // Calculate confidence
    const confidence = this.calculateConfidence(
      extraction.fields,
      template.patterns,
      extraction.confidence,
    );

    // Create template application result
    const result = await this.prisma.templateApplication.create({
      data: {
        userId,
        templateId,
        extractionId,
        status: validationErrors.length > 0 ? 'validation_failed' : 'completed',
        confidence,
        validationErrors:
          validationErrors.length > 0 ? validationErrors : undefined,
      },
    });

    // Update template usage and success rate
    await this.learnFromExtraction(
      templateId,
      extractionId,
      userId,
      validationErrors.length === 0,
    );

    return result;
  }

  async updateTemplate(
    templateId: string,
    userId: string,
    data: Partial<TemplateData>,
  ): Promise<Template> {
    // Verify template exists and user has access
    await this.getTemplate(templateId, userId);

    // Validate updated data
    if (data.patterns && Object.keys(data.patterns).length === 0) {
      throw new ValidationError('Template must have at least one pattern');
    }

    if (data.fieldMappings && Object.keys(data.fieldMappings).length === 0) {
      throw new ValidationError(
        'Template must have at least one field mapping',
      );
    }

    // Update template
    return this.prisma.template.update({
      where: { id: templateId },
      data,
    });
  }

  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    // Verify template exists and user has access
    await this.getTemplate(templateId, userId);

    // Delete template
    await this.prisma.template.delete({
      where: { id: templateId },
    });
  }

  async getTemplateAnalytics(userId: string): Promise<TemplateAnalytics> {
    const templates = await this.prisma.template.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        vendorName: true,
        successRate: true,
        usageCount: true,
      },
    });

    const totalTemplates = templates.length;
    const totalUsage = templates.reduce((sum, t) => sum + t.usageCount, 0);
    const averageSuccessRate =
      templates.reduce((sum, t) => sum + t.successRate * t.usageCount, 0) /
        totalUsage || 0;

    return {
      totalTemplates,
      averageSuccessRate,
      totalUsage,
      templates,
    };
  }

  async learnFromExtraction(
    templateId: string,
    extractionId: string,
    userId: string,
    success: boolean,
  ): Promise<Template> {
    const template = await this.getTemplate(templateId, userId);

    // Calculate new success rate using exponential moving average
    const alpha = 0.1; // Learning rate
    const newSuccessRate =
      template.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;

    // Update template
    return this.prisma.template.update({
      where: { id: templateId },
      data: {
        successRate: newSuccessRate,
        usageCount: template.usageCount + 1,
      },
    });
  }

  private validateFields(
    fields: any,
    mappings: FieldMappings,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [field, mapping] of Object.entries(mappings)) {
      const value = fields[field];

      // Check required fields
      if (
        mapping.required &&
        (value === undefined || value === null || value === '')
      ) {
        errors.push({
          field,
          error: 'Field is required',
        });
        continue;
      }

      if (value === undefined || value === null) continue;

      // Type validation
      switch (mapping.type) {
        case 'number':
          if (typeof value !== 'number') {
            errors.push({
              field,
              error: 'Value must be a number',
            });
            continue;
          }
          if (mapping.min !== undefined && value < mapping.min) {
            errors.push({
              field,
              error: `Value must be greater than ${mapping.min}`,
            });
          }
          if (mapping.max !== undefined) {
            const maxValue =
              typeof mapping.max === 'string'
                ? fields[mapping.max]
                : mapping.max;
            if (value > maxValue) {
              errors.push({
                field,
                error: `Value must be less than or equal to ${maxValue}`,
              });
            }
          }
          break;

        case 'date':
          if (!(value instanceof Date) || isNaN(value.getTime())) {
            errors.push({
              field,
              error: 'Value must be a valid date',
            });
          }
          break;

        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push({
              field,
              error: 'Value must be a valid email address',
            });
          }
          break;

        case 'string':
          if (mapping.pattern && !new RegExp(mapping.pattern).test(value)) {
            errors.push({
              field,
              error: 'Value does not match required pattern',
            });
          }
          break;
      }

      // Custom validation
      if (mapping.custom && !mapping.custom(value)) {
        errors.push({
          field,
          error: 'Value failed custom validation',
        });
      }
    }

    return errors;
  }

  private calculateConfidence(
    fields: any,
    patterns: TemplatePatterns,
    extractionConfidence: number,
  ): number {
    // Base confidence on extraction result
    let confidence = extractionConfidence;

    // Adjust confidence based on field coverage
    const extractedFields = Object.keys(fields).length;
    const totalFields = Object.keys(patterns).length;
    const fieldConfidence = extractedFields / totalFields;

    // Weight extraction confidence and field coverage
    confidence = confidence * 0.7 + fieldConfidence * 0.3;

    // Penalize for missing required fields
    const requiredFields = Object.keys(patterns).filter((field) => {
      const value = fields[field];
      return value === undefined || value === null || value === '';
    });

    if (requiredFields.length > 0) {
      confidence *= 1 - (requiredFields.length / totalFields) * 0.5;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }
}
