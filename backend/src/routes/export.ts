import express from 'express';
import { z } from 'zod';
import { ExportService } from '../services/ExportService';
import { requireAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { asyncHandler } from '../utils/asyncHandler';
import { ExportError } from '../models/Export';
import { ExportFormat } from '../models/Export';

const router = express.Router();

// Schema definitions
const createExportSchema = z.object({
  fileId: z.string().uuid(),
  format: z.enum([ExportFormat.CSV, ExportFormat.XLSX]),
  templateId: z.string().uuid().optional(),
  downloadLimit: z.number().int().min(1).max(10).optional(),
  expiresIn: z.number().int().min(300).max(86400).optional(), // 5 minutes to 24 hours
});

const listExportsSchema = z.object({
  status: z
    .enum(['pending', 'processing', 'completed', 'failed', 'expired'])
    .optional(),
  format: z.enum([ExportFormat.CSV, ExportFormat.XLSX]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

const downloadTokenSchema = z.object({
  token: z.string().uuid(),
});

// Create export
router.post(
  '/',
  requireAuth,
  validateRequest({ body: createExportSchema }),
  asyncHandler(async (req, res) => {
    const exportService = req.app.get('exportService') as ExportService;
    const exportRecord = await exportService.createExport({
      userId: req.user.id,
      ...req.body,
    });

    res.status(201).json(exportRecord);
  }),
);

// List exports
router.get(
  '/',
  requireAuth,
  validateRequest({ query: listExportsSchema }),
  asyncHandler(async (req, res) => {
    const exportService = req.app.get('exportService') as ExportService;
    const { limit, offset, ...filter } = req.query;

    const exports = await exportService.listExports(
      req.user.id,
      filter,
      Number(limit),
      Number(offset),
    );

    res.json(exports);
  }),
);

// Get export by ID
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const exportService = req.app.get('exportService') as ExportService;
    const exportRecord = await exportService.getExport(
      req.params.id,
      req.user.id,
    );
    res.json(exportRecord);
  }),
);

// Delete export
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const exportService = req.app.get('exportService') as ExportService;
    await exportService.deleteExport(req.params.id, req.user.id);
    res.status(204).send();
  }),
);

// Get download URL
router.get(
  '/:id/download-url',
  requireAuth,
  asyncHandler(async (req, res) => {
    const exportService = req.app.get('exportService') as ExportService;
    const { url, expiresAt } = await exportService.getDownloadUrl(
      req.params.id,
      req.user.id,
    );
    res.json({ url, expiresAt });
  }),
);

// Download file (protected by token)
router.get(
  '/:id/download',
  validateRequest({ query: downloadTokenSchema }),
  asyncHandler(async (req, res) => {
    const exportService = req.app.get('exportService') as ExportService;
    const redis = req.app.get('redis');

    // Verify token
    const tokenKey = `export:download:${req.query.token}`;
    const tokenData = await redis.get(tokenKey);

    if (!tokenData) {
      throw new ExportError(
        'Invalid or expired download token',
        'INVALID_TOKEN',
        401,
      );
    }

    const { exportId, userId } = JSON.parse(tokenData);

    // Verify export ID matches
    if (exportId !== req.params.id) {
      throw new ExportError('Invalid export ID', 'INVALID_EXPORT', 400);
    }

    // Get export record
    const exportRecord = await exportService.getExport(exportId, userId);

    // Delete token after use
    await redis.del(tokenKey);

    // Set headers
    res.setHeader('Content-Type', exportRecord.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportRecord.id}.${exportRecord.format}"`,
    );
    res.setHeader('Content-Length', exportRecord.fileSize);

    // Stream file
    const fileStream = await exportService.getFileStream(exportId);
    fileStream.pipe(res);
  }),
);

// Error handling middleware
router.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (err instanceof ExportError) {
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
        },
      });
    } else {
      next(err);
    }
  },
);

export default router;
