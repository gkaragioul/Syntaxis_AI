// @ts-nocheck

/**
 * Optimized Invoice Routes
 *
 * Task 2.2.2: Performance Optimizations Implementation - TDD GREEN Phase
 *
 * These routes implement performance optimizations to meet <200ms API response requirement.
 * Following TDD: Red-Green-Refactor approach.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../../middleware/auth';
import { getOptimizedDatabaseService } from '../../services/performance/optimized-database.service';
import { performanceMiddlewareStack } from '../../middleware/performance.middleware';
import { logger } from '../../utils/logger';

const router = Router();
const prisma = new PrismaClient();
const optimizedDb = getOptimizedDatabaseService(prisma);

// Apply performance middleware stack
router.use(performanceMiddlewareStack);

/**
 * GET /api/invoices
 * Optimized invoice listing with pagination and caching
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse query parameters with defaults
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 items
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
    const status = req.query.status as string;

    // Use optimized database service
    const result = await optimizedDb.findInvoicesByUserId(userId, {
      page,
      limit,
      sortBy,
      sortOrder,
      status,
    });

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        invoices: result.invoices,
        pagination: {
          page,
          limit,
          total: result.total,
          hasMore: result.hasMore,
          totalPages: Math.ceil(result.total / limit),
        },
      },
      meta: {
        responseTime,
        cached: res.getHeader('X-Cache') === 'HIT',
      },
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Optimized invoice listing failed', {
      error: error.message,
      responseTime,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve invoices',
      meta: { responseTime },
    });
  }
});

/**
 * GET /api/invoices/:id
 * Optimized single invoice retrieval with caching
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Use optimized database service
    const invoice = await optimizedDb.findInvoiceById(id, userId);

    const responseTime = Date.now() - startTime;

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
        meta: { responseTime },
      });
    }

    res.json({
      success: true,
      data: invoice,
      meta: {
        responseTime,
        cached: res.getHeader('X-Cache') === 'HIT',
      },
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Optimized invoice retrieval failed', {
      error: error.message,
      responseTime,
      invoiceId: req.params.id,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve invoice',
      meta: { responseTime },
    });
  }
});

/**
 * POST /api/invoices
 * Optimized invoice creation
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate required fields quickly
    const { fileName, fileSize, mimeType, filePath } = req.body;
    if (!fileName || !fileSize || !mimeType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fileName, fileSize, mimeType',
        meta: { responseTime: Date.now() - startTime },
      });
    }

    // Use optimized database service
    const invoice = await optimizedDb.createInvoice({
      userId,
      fileName,
      fileSize,
      mimeType,
      filePath,
    });

    const responseTime = Date.now() - startTime;

    res.status(201).json({
      success: true,
      data: invoice,
      meta: { responseTime },
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Optimized invoice creation failed', {
      error: error.message,
      responseTime,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create invoice',
      meta: { responseTime },
    });
  }
});

/**
 * PUT /api/invoices/:id
 * Optimized invoice update
 */
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify ownership quickly
    const existingInvoice = await optimizedDb.findInvoiceById(id, userId);
    if (!existingInvoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
        meta: { responseTime: Date.now() - startTime },
      });
    }

    // Filter allowed update fields for security and performance
    const allowedFields = ['status', 'extractionConfidence', 'notes'];
    const updateData: any = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
        meta: { responseTime: Date.now() - startTime },
      });
    }

    // Use optimized database service
    const updatedInvoice = await optimizedDb.updateInvoice(id, updateData);

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: updatedInvoice,
      meta: { responseTime },
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Optimized invoice update failed', {
      error: error.message,
      responseTime,
      invoiceId: req.params.id,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update invoice',
      meta: { responseTime },
    });
  }
});

/**
 * DELETE /api/invoices/:id
 * Optimized invoice deletion
 */
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify ownership quickly
    const existingInvoice = await optimizedDb.findInvoiceById(id, userId);
    if (!existingInvoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
        meta: { responseTime: Date.now() - startTime },
      });
    }

    // Soft delete for better performance (avoid cascading deletes)
    await optimizedDb.updateInvoice(id, {
      status: 'deleted',
      deletedAt: new Date(),
    });

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      message: 'Invoice deleted successfully',
      meta: { responseTime },
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Optimized invoice deletion failed', {
      error: error.message,
      responseTime,
      invoiceId: req.params.id,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to delete invoice',
      meta: { responseTime },
    });
  }
});

export default router;
