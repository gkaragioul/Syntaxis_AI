import {
  TemplateModel,
  Template,
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplateApplication,
  TemplateError,
} from '../models/Template';
import { ExtractionService } from './ExtractionService';
import { Queue } from '../utils/queue';
import { Redis } from '../utils/redis';
import { BaseError } from '../utils/errors';
import { sanitizeData } from '../utils/sanitize';
import { ErrorCodes } from '../types/ErrorMessage';

export class TemplateService {
  private templateModel: TemplateModel;
  private extractionService: ExtractionService;
  private queue: Queue;
  private redis: Redis;
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    templateModel: TemplateModel,
    extractionService: ExtractionService,
    queue: Queue,
    redis: Redis,
  ) {
    this.templateModel = templateModel;
    this.extractionService = extractionService;
    this.queue = queue;
    this.redis = redis;
  }

  private getCacheKey(userId: string, templateId: string): string {
    return `template:${userId}:${templateId}`;
  }

  private async getCachedTemplate(
    userId: string,
    templateId: string,
  ): Promise<Template | null> {
    const cacheKey = this.getCacheKey(userId, templateId);
    const cached = await this.redis.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }

  private async setCachedTemplate(
    userId: string,
    template: Template,
  ): Promise<void> {
    const cacheKey = this.getCacheKey(userId, template.id);
    await this.redis.set(cacheKey, JSON.stringify(template), this.CACHE_TTL);
  }

  private async invalidateCache(
    userId: string,
    templateId: string,
  ): Promise<void> {
    const cacheKey = this.getCacheKey(userId, templateId);
    await this.redis.del(cacheKey);
  }

  private validateTemplateLogic(logic: CreateTemplateInput['logic']): void {
    if (!Array.isArray(logic.pageNumbers) || logic.pageNumbers.length === 0) {
      throw new TemplateError(
        'Page numbers must be a non-empty array',
        'INVALID_TEMPLATE_LOGIC',
      );
    }

    if (typeof logic.tableIndex !== 'number' || logic.tableIndex < 0) {
      throw new TemplateError(
        'Table index must be a non-negative number',
        'INVALID_TEMPLATE_LOGIC',
      );
    }

    if (typeof logic.headerRow !== 'number' || logic.headerRow < 0) {
      throw new TemplateError(
        'Header row must be a non-negative number',
        'INVALID_TEMPLATE_LOGIC',
      );
    }

    if (
      !logic.columnMappings ||
      Object.keys(logic.columnMappings).length === 0
    ) {
      throw new TemplateError(
        'Column mappings must be a non-empty object',
        'INVALID_TEMPLATE_LOGIC',
      );
    }

    // Validate each column mapping
    Object.entries(logic.columnMappings).forEach(([key, mapping]) => {
      if (!mapping.sourceColumn || !mapping.targetField || !mapping.dataType) {
        throw new TemplateError(
          `Invalid column mapping for key ${key}: missing required fields`,
          'INVALID_TEMPLATE_LOGIC',
        );
      }

      if (
        !['string', 'number', 'date', 'currency'].includes(mapping.dataType)
      ) {
        throw new TemplateError(
          `Invalid data type for column mapping ${key}: ${mapping.dataType}`,
          'INVALID_TEMPLATE_LOGIC',
        );
      }
    });

    // Validate filters if present
    if (logic.filters) {
      if (!Array.isArray(logic.filters)) {
        throw new TemplateError(
          'Filters must be an array',
          'INVALID_TEMPLATE_LOGIC',
        );
      }

      logic.filters.forEach((filter, index) => {
        if (!filter.field || !filter.operator || filter.value === undefined) {
          throw new TemplateError(
            `Invalid filter at index ${index}: missing required fields`,
            'INVALID_TEMPLATE_LOGIC',
          );
        }

        if (
          !['equals', 'contains', 'startsWith', 'endsWith', 'regex'].includes(
            filter.operator,
          )
        ) {
          throw new TemplateError(
            `Invalid operator for filter at index ${index}: ${filter.operator}`,
            'INVALID_TEMPLATE_LOGIC',
          );
        }
      });
    }
  }

  async createTemplate(
    input: CreateTemplateInput,
    userId: string,
  ): Promise<Template> {
    // Sanitize input
    const sanitizedInput = sanitizeData(input);

    // Validate template logic
    this.validateTemplateLogic(sanitizedInput.logic);

    // Create template
    const template = await this.templateModel.create(sanitizedInput, userId);

    // Cache the template
    await this.setCachedTemplate(userId, template);

    return template;
  }

  async getTemplate(templateId: string, userId: string): Promise<Template> {
    // Try to get from cache first
    const cached = await this.getCachedTemplate(userId, templateId);
    if (cached) {
      return cached;
    }

    // Get from database
    const template = await this.templateModel.findById(templateId, userId);
    if (!template) {
      throw new TemplateError('Template not found', 'TEMPLATE_NOT_FOUND', 404);
    }

    // Cache the template
    await this.setCachedTemplate(userId, template);

    return template;
  }

  async listTemplates(
    userId: string,
    options: {
      status?: Template['status'];
      type?: Template['type'];
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ templates: Template[]; total: number }> {
    return this.templateModel.findByUserId(userId, options);
  }

  async updateTemplate(
    templateId: string,
    userId: string,
    input: UpdateTemplateInput,
  ): Promise<Template> {
    // Sanitize input
    const sanitizedInput = sanitizeData(input);

    // Validate template logic if provided
    if (sanitizedInput.logic) {
      this.validateTemplateLogic(sanitizedInput.logic);
    }

    // Update template
    const template = await this.templateModel.update(
      templateId,
      userId,
      sanitizedInput,
    );

    // Update cache
    await this.setCachedTemplate(userId, template);

    return template;
  }

  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    await this.templateModel.delete(templateId, userId);
    await this.invalidateCache(userId, templateId);
  }

  async applyTemplate(
    templateId: string,
    userId: string,
    options: { fileId?: string; batchJobId?: string },
  ): Promise<TemplateApplication> {
    // Get template
    const template = await this.getTemplate(templateId, userId);

    // Check if template is active
    if (template.status !== 'active') {
      throw new TemplateError(
        'Cannot apply inactive template',
        'TEMPLATE_INACTIVE',
        400,
      );
    }

    // Create template application record
    const application = await this.templateModel.createApplication(
      templateId,
      userId,
      options,
    );

    // Queue extraction job
    await this.queue.add('template-extraction', {
      applicationId: application.id,
      templateId,
      userId,
      fileId: options.fileId,
      batchJobId: options.batchJobId,
      templateLogic: template.logic,
    });

    return application;
  }

  async getApplicationStatus(
    applicationId: string,
    userId: string,
  ): Promise<TemplateApplication> {
    const application = await this.templateModel.getApplicationHistory(
      applicationId,
      userId,
      { limit: 1 },
    );

    if (application.applications.length === 0) {
      throw new TemplateError(
        'Application not found',
        'APPLICATION_NOT_FOUND',
        404,
      );
    }

    return application.applications[0];
  }

  async getApplicationHistory(
    templateId: string,
    userId: string,
    options: {
      status?: TemplateApplication['status'];
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ applications: TemplateApplication[]; total: number }> {
    return this.templateModel.getApplicationHistory(
      templateId,
      userId,
      options,
    );
  }

  async processTemplateExtraction(job: {
    applicationId: string;
    templateId: string;
    userId: string;
    fileId?: string;
    batchJobId?: string;
    templateLogic: Template['logic'];
  }): Promise<void> {
    const {
      applicationId,
      templateId,
      userId,
      fileId,
      batchJobId,
      templateLogic,
    } = job;

    try {
      // Update status to processing
      await this.templateModel.updateApplicationStatus(
        applicationId,
        'processing',
      );

      // Apply template to file or batch
      if (fileId) {
        await this.extractionService.extractTable(fileId, {
          templateId,
          templateLogic,
        });
      } else if (batchJobId) {
        await this.extractionService.extractBatch(batchJobId, [fileId!], {
          templateId,
          templateLogic,
        });
      }

      // Update status to completed
      await this.templateModel.updateApplicationStatus(
        applicationId,
        'completed',
      );
    } catch (error: any) {
      // Handle specific error types
      if (error instanceof BaseError) {
        await this.templateModel.updateApplicationStatus(
          applicationId,
          'failed',
          {
            errorMessage: error.message,
            errorDetails: {
              code: error.code,
              statusCode: error.statusCode,
            },
          },
        );
      } else {
        // Handle template mismatch
        if (error.message && error.message.includes('template mismatch')) {
          error.code = ErrorCodes.TEMPLATE_MISMATCH;
          error.userMessage =
            'The selected template does not match the document structure.';
          error.nextSteps =
            'Edit the template or create a new one for this document.';
          error.helpUrl = 'https://help.example.com/template-mismatch'; // TODO
          error.statusCode = 400;
        }
        await this.templateModel.updateApplicationStatus(
          applicationId,
          'failed',
          {
            errorMessage:
              error.userMessage ||
              'An unexpected error occurred during template application',
            errorDetails: {
              code: error.code,
              statusCode: error.statusCode,
              helpUrl: error.helpUrl,
            },
          },
        );
      }
      throw error; // Re-throw to let the queue handle retries
    }
  }
}
