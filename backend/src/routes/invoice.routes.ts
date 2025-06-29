import { Router } from 'express';
import { InvoiceService } from '../services/invoice.service';
import { InvoiceProcessingService } from '../services/InvoiceProcessingService';
import { authenticate } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../utils/errors';
import { prisma } from '../index';
import { EmailService } from '../email/email.service';
import { FieldExtractionService } from '../services/field.service';
import { ProcessingService } from '../services/ProcessingService';
import { StorageService } from '../services/StorageService';
import { Redis } from 'ioredis';
import { config } from '../config';

const router = Router();

// Initialize services
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
});

const invoiceService = new InvoiceService(
  prisma,
  new EmailService(),
  new FieldExtractionService(),
  new ProcessingService(),
  new StorageService(),
);

const processingService = new InvoiceProcessingService(
  prisma,
  new EmailService(),
  invoiceService,
  redis,
);

/**
 * @route POST /api/v1/invoices/process/:fileId
 * @desc Queue an invoice file for processing
 * @access Private
 */
router.post(
  '/process/:fileId',
  authenticate,
  rateLimitMiddleware('invoice-process', 10, 60), // 10 requests per minute
  validateRequest({
    params: {
      fileId: { type: 'string', format: 'uuid' },
    },
    body: {
      options: {
        type: 'object',
        optional: true,
        properties: {
          engine: { type: 'string', enum: ['tesseract', 'google-vision'] },
          templateId: { type: 'string', format: 'uuid' },
          skipValidation: { type: 'boolean' },
        },
      },
    },
  }),
  asyncHandler(async (req, res) => {
    const jobId = await processingService.queueProcessingJob({
      fileId: req.params.fileId,
      userId: req.user!.id,
      options: req.body.options,
    });

    res.status(202).json({
      success: true,
      data: {
        jobId,
        message: 'Invoice processing queued',
      },
    });
  }),
);

/**
 * @route GET /api/v1/invoices/process/:jobId
 * @desc Get invoice processing job status
 * @access Private
 */
router.get(
  '/process/:jobId',
  authenticate,
  validateRequest({
    params: {
      jobId: { type: 'string' },
    },
  }),
  asyncHandler(async (req, res) => {
    const status = await processingService.getJobStatus(
      req.params.jobId,
      req.user!.id,
    );
    res.json({
      success: true,
      data: status,
    });
  }),
);

/**
 * @route POST /api/v1/invoices/batch
 * @desc Queue multiple invoice files for processing
 * @access Private
 */
router.post(
  '/batch',
  authenticate,
  rateLimitMiddleware('invoice-batch', 5, 60), // 5 batch requests per minute
  validateRequest({
    body: {
      fileIds: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        minItems: 1,
        maxItems: 50,
      },
      options: {
        type: 'object',
        optional: true,
        properties: {
          engine: { type: 'string', enum: ['tesseract', 'google-vision'] },
          templateId: { type: 'string', format: 'uuid' },
          skipValidation: { type: 'boolean' },
        },
      },
    },
  }),
  asyncHandler(async (req, res) => {
    const { fileIds, options } = req.body;
    const userId = req.user!.id;

    // Queue jobs for each file
    const jobs = await Promise.all(
      fileIds.map((fileId) =>
        processingService.queueProcessingJob({
          fileId,
          userId,
          options,
          priority: 0, // Process in order
        }),
      ),
    );

    res.status(202).json({
      success: true,
      data: {
        jobIds: jobs,
        message: `${jobs.length} invoice(s) queued for processing`,
      },
    });
  }),
);

/**
 * @route GET /api/v1/invoices
 * @desc List user's invoices
 * @access Private
 */
router.get(
  '/',
  authenticate,
  rateLimitMiddleware('invoice-list', 60, 60), // 60 requests per minute
  validateRequest({
    query: {
      page: { type: 'number', optional: true, min: 1 },
      limit: { type: 'number', optional: true, min: 1, max: 100 },
      status: { type: 'string', optional: true },
      search: { type: 'string', optional: true },
      sortBy: { type: 'string', optional: true },
      sortOrder: { type: 'string', optional: true, enum: ['asc', 'desc'] },
    },
  }),
  asyncHandler(async (req, res) => {
    const result = await invoiceService.listInvoices(req.user!.id, {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    });
    res.json({
      success: true,
      data: result.invoices,
      pagination: result.pagination,
    });
  }),
);

/**
 * @route GET /api/v1/invoices/:invoiceId
 * @desc Get invoice details
 * @access Private
 */
router.get(
  '/:invoiceId',
  authenticate,
  rateLimitMiddleware('invoice-get', 60, 60), // 60 requests per minute
  validateRequest({
    params: {
      invoiceId: { type: 'string', format: 'uuid' },
    },
  }),
  asyncHandler(async (req, res) => {
    const invoice = await invoiceService.getInvoice(
      req.params.invoiceId,
      req.user!.id,
    );
    res.json({
      success: true,
      data: invoice,
    });
  }),
);

/**
 * @route PATCH /api/v1/invoices/:invoiceId
 * @desc Update invoice details
 * @access Private
 */
router.patch(
  '/:invoiceId',
  authenticate,
  rateLimitMiddleware('invoice-update', 30, 60), // 30 requests per minute
  validateRequest({
    params: {
      invoiceId: { type: 'string', format: 'uuid' },
    },
    body: {
      invoiceNumber: { type: 'string', optional: true },
      invoiceDate: { type: 'string', format: 'date', optional: true },
      dueDate: { type: 'string', format: 'date', optional: true },
      vendorName: { type: 'string', optional: true },
      totalAmount: { type: 'number', optional: true },
      taxAmount: { type: 'number', optional: true },
      subtotal: { type: 'number', optional: true },
      status: { type: 'string', optional: true },
      notes: { type: 'string', optional: true },
    },
  }),
  asyncHandler(async (req, res) => {
    const invoice = await invoiceService.updateInvoice(
      req.params.invoiceId,
      req.user!.id,
      {
        ...req.body,
        invoiceDate: req.body.invoiceDate
          ? new Date(req.body.invoiceDate)
          : undefined,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      },
    );
    res.json({
      success: true,
      data: invoice,
    });
  }),
);

/**
 * @route DELETE /api/v1/invoices/:invoiceId
 * @desc Delete invoice
 * @access Private
 */
router.delete(
  '/:invoiceId',
  authenticate,
  rateLimitMiddleware('invoice-delete', 10, 60), // 10 requests per minute
  validateRequest({
    params: {
      invoiceId: { type: 'string', format: 'uuid' },
    },
  }),
  asyncHandler(async (req, res) => {
    await invoiceService.deleteInvoice(req.params.invoiceId, req.user!.id);
    res.json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  }),
);

// Clean up Redis connection on server shutdown
process.on('SIGTERM', async () => {
  await redis.quit();
});

process.on('SIGINT', async () => {
  await redis.quit();
});

export default router;
