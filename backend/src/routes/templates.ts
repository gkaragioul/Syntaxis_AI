// @ts-nocheck

import { Router } from 'express';
import { TemplateService } from '../services/TemplateService';
import { requireAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { BaseError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();

// Schema for template creation
const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['invoice', 'receipt', 'statement', 'custom']).optional(),
  logic: z.object({
    pageNumbers: z.array(z.number().int().min(1)),
    tableIndex: z.number().int().min(0),
    headerRow: z.number().int().min(0),
    columnMappings: z.record(
      z.object({
        sourceColumn: z.string(),
        targetField: z.string(),
        dataType: z.enum(['string', 'number', 'date', 'currency']),
        required: z.boolean(),
        validation: z
          .object({
            pattern: z.string().optional(),
            min: z.number().optional(),
            max: z.number().optional(),
            format: z.string().optional(),
          })
          .optional(),
      }),
    ),
    filters: z
      .array(
        z.object({
          field: z.string(),
          operator: z.enum([
            'equals',
            'contains',
            'startsWith',
            'endsWith',
            'regex',
          ]),
          value: z.union([z.string(), z.number()]),
          caseSensitive: z.boolean().optional(),
        }),
      )
      .optional(),
    preprocessing: z
      .object({
        deskew: z.boolean().optional(),
        denoise: z.boolean().optional(),
        enhance: z.boolean().optional(),
      })
      .optional(),
    postprocessing: z
      .object({
        validateTotals: z.boolean().optional(),
        validateDates: z.boolean().optional(),
        validateRequired: z.boolean().optional(),
      })
      .optional(),
  }),
  vendorName: z.string().optional(),
  vendorPattern: z.string().optional(),
});

// Schema for template update
const updateTemplateSchema = createTemplateSchema.partial();

// Schema for template application
const applyTemplateSchema = z
  .object({
    fileId: z.string().uuid().optional(),
    batchJobId: z.string().uuid().optional(),
  })
  .refine((data) => data.fileId || data.batchJobId, {
    message: 'Either fileId or batchJobId must be provided',
  });

// Schema for template listing
const listTemplatesSchema = z.object({
  status: z.enum(['active', 'archived', 'deleted']).optional(),
  type: z.enum(['invoice', 'receipt', 'statement', 'custom']).optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

// Schema for application history
const applicationHistorySchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

export function createTemplateRouter(templateService: TemplateService) {
  // Create template
  router.post(
    '/',
    requireAuth,
    validateRequest({ body: createTemplateSchema }),
    asyncHandler(async (req, res) => {
      const template = await templateService.createTemplate(
        req.body,
        req.user!.id,
      );
      res.status(201).json(template);
    }),
  );

  // Get template by ID
  router.get(
    '/:templateId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const template = await templateService.getTemplate(
        req.params.templateId,
        req.user!.id,
      );
      res.json(template);
    }),
  );

  // List templates
  router.get(
    '/',
    requireAuth,
    validateRequest({ query: listTemplatesSchema }),
    asyncHandler(async (req, res) => {
      const result = await templateService.listTemplates(
        req.user!.id,
        req.query,
      );
      res.json(result);
    }),
  );

  // Update template
  router.put(
    '/:templateId',
    requireAuth,
    validateRequest({ body: updateTemplateSchema }),
    asyncHandler(async (req, res) => {
      const template = await templateService.updateTemplate(
        req.params.templateId,
        req.user!.id,
        req.body,
      );
      res.json(template);
    }),
  );

  // Delete template
  router.delete(
    '/:templateId',
    requireAuth,
    asyncHandler(async (req, res) => {
      await templateService.deleteTemplate(req.params.templateId, req.user!.id);
      res.status(204).send();
    }),
  );

  // Apply template
  router.post(
    '/:templateId/apply',
    requireAuth,
    validateRequest({ body: applyTemplateSchema }),
    asyncHandler(async (req, res) => {
      const application = await templateService.applyTemplate(
        req.params.templateId,
        req.user!.id,
        req.body,
      );
      res.status(201).json(application);
    }),
  );

  // Get application status
  router.get(
    '/applications/:applicationId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const application = await templateService.getApplicationStatus(
        req.params.applicationId,
        req.user!.id,
      );
      res.json(application);
    }),
  );

  // Get application history
  router.get(
    '/:templateId/applications',
    requireAuth,
    validateRequest({ query: applicationHistorySchema }),
    asyncHandler(async (req, res) => {
      const result = await templateService.getApplicationHistory(
        req.params.templateId,
        req.user!.id,
        req.query,
      );
      res.json(result);
    }),
  );

  // Error handling middleware
  router.use((err: Error, req: any, res: any, next: any) => {
    if (err instanceof BaseError) {
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
        },
      });
    } else {
      logger.error('Unhandled error', { error: err });
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    }
  });

  return router;
}

export default createTemplateRouter;
