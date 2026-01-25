// @ts-nocheck

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

const PYTHON_API_BASE = process.env.PYTHON_API_URL || 'http://localhost:8000';

async function callPythonService(endpoint: string, data: any) {
  try {
    const response = await fetch(`${PYTHON_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Python service failed: ${response.status} ${errorText}`);
    }
    return response.json();
  } catch (error) {
    logger.error('Python service call failed', { endpoint, error });
    throw error;
  }
}

/**
 * @route POST /api/detect-columns
 * @desc Detect column boundaries for a selected PDF region
 * @access Public (dev mode)
 */
router.post(
  '/detect-columns',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      pdfId,
      fileId,
      pageIndex = 0,
      pageNumber,
      selectionBbox,
      mode = 'gridlines',
    } = req.body;

    const resolvedFileId = pdfId || fileId;
    if (!resolvedFileId) {
      throw new ValidationError('pdfId is required');
    }
    if (!selectionBbox) {
      throw new ValidationError('selectionBbox is required');
    }

    const resolvedPageNumber =
      typeof pageNumber === 'number'
        ? pageNumber
        : typeof pageIndex === 'number'
          ? pageIndex + 1
          : 1;

    const fileRecord = await prisma.file.findUnique({
      where: { id: resolvedFileId },
    });
    if (!fileRecord) {
      throw new NotFoundError('File not found');
    }

    const requestedMode = mode === 'image_hough' ? 'image_hough' : 'gridlines';

    const pythonResponse = await callPythonService('/internal/detect-columns', {
      file_path: fileRecord.filePath,
      page_number: resolvedPageNumber,
      bbox_norm: selectionBbox,
      mode: requestedMode,
    });

    const columnBoundariesNorm = pythonResponse.column_boundaries || [];
    const columnsDetected =
      pythonResponse.columns_detected
      ?? (Array.isArray(columnBoundariesNorm) && columnBoundariesNorm.length > 1
        ? columnBoundariesNorm.length - 1
        : 0);

    const candidateXsCount = pythonResponse.raw_line_count || 0;
    const clustersCount =
      pythonResponse.diagnostics?.clusters_found
      ?? pythonResponse.diagnostics?.clusters
      ?? 0;
    const boundariesCount = Array.isArray(columnBoundariesNorm) ? columnBoundariesNorm.length : 0;

    let reasonIfFailed = pythonResponse.diagnostics?.reason || pythonResponse.diagnostics?.error;
    if (columnsDetected < 6 && !reasonIfFailed) {
      reasonIfFailed = `only_${columnsDetected}_columns`;
    }

    res.json({
      success: true,
      data: {
        columnsDetected,
        columnBoundariesNorm,
        modeUsed: pythonResponse.source || requestedMode,
        diagnostics: {
          candidateXsCount,
          clustersCount,
          boundariesCount,
          reasonIfFailed,
        },
      },
    });
  })
);

export default router;
