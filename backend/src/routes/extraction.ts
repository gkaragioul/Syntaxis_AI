import { Router } from 'express';
import { ExtractionService } from '../services/ExtractionService';
import { requireAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { BaseError } from '../utils/errors';

const router = Router();

// Schema for table extraction request
const extractTableSchema = z.object({
  fileId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  forceReextraction: z.boolean().optional(),
});

// Schema for batch extraction request
const extractBatchSchema = z.object({
  batchJobId: z.string().uuid(),
  fileIds: z.array(z.string().uuid()),
  templateId: z.string().uuid().optional(),
  forceReextraction: z.boolean().optional(),
});

// Schema for table edit request
const tableEditSchema = z.object({
  editedCells: z.record(z.string(), z.record(z.string(), z.string())),
  editMetadata: z.record(z.string(), z.any()).optional(),
});

export function createExtractionRouter(extractionService: ExtractionService) {
  // Extract table from a single file
  router.post(
    '/tables/extract',
    requireAuth,
    validateRequest({ body: extractTableSchema }),
    asyncHandler(async (req, res) => {
      const { fileId, templateId, forceReextraction } = req.body;
      const table = await extractionService.extractTable(fileId, {
        templateId,
        forceReextraction,
      });
      res.status(201).json(table);
    }),
  );

  // Extract tables from multiple files in a batch
  router.post(
    '/tables/extract-batch',
    requireAuth,
    validateRequest({ body: extractBatchSchema }),
    asyncHandler(async (req, res) => {
      const { batchJobId, fileIds, templateId, forceReextraction } = req.body;
      const tables = await extractionService.extractBatch(batchJobId, fileIds, {
        templateId,
        forceReextraction,
      });
      res.status(201).json(tables);
    }),
  );

  // Get table with its latest edits
  router.get(
    '/tables/:tableId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { tableId } = req.params;
      const result = await extractionService.getTableWithEdits(tableId);
      res.json(result);
    }),
  );

  // Save table edits
  router.post(
    '/tables/:tableId/edits',
    requireAuth,
    validateRequest({ body: tableEditSchema }),
    asyncHandler(async (req, res) => {
      const { tableId } = req.params;
      const { editedCells, editMetadata } = req.body;
      const edit = await extractionService.saveTableEdit({
        tableId,
        userId: req.user!.id,
        editedCells,
        editMetadata,
      });
      res.status(201).json(edit);
    }),
  );

  // Commit table edits
  router.post(
    '/tables/edits/:editId/commit',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { editId } = req.params;
      const edit = await extractionService.commitTableEdit(editId);
      res.json(edit);
    }),
  );

  // Get error report
  router.get(
    '/error-reports/:reportId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { reportId } = req.params;
      const report = await extractionService.getErrorReport(reportId);

      // Mark report as downloaded
      await extractionService.markErrorReportDownloaded(reportId);

      res.json(report);
    }),
  );

  // Download error report
  router.get(
    '/error-reports/:reportId/download',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { reportId } = req.params;
      const report = await extractionService.getErrorReport(reportId);

      // Mark report as downloaded
      await extractionService.markErrorReportDownloaded(reportId);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="error-report-${reportId}.json"`,
      );

      res.json(report);
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
      console.error('Unhandled error:', err);
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

export default createExtractionRouter;
