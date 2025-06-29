import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { validateRequest } from '../middleware/validation';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../utils/errors';
import chunkedUploadService from '../services/ChunkedUploadService';
import { config } from '../config';

const router = Router();

/**
 * @route POST /api/v1/uploads/initialize
 * @desc Initialize a new chunked upload
 * @access Private
 */
router.post(
  '/initialize',
  authMiddleware,
  rateLimitMiddleware('upload-init', 10, 60), // 10 requests per minute
  validateRequest({
    body: {
      filename: { type: 'string', required: true },
      totalSize: { type: 'number', required: true, min: 1 },
      mimeType: { type: 'string', required: true },
    },
  }),
  asyncHandler(async (req, res) => {
    const { filename, totalSize, mimeType } = req.body;

    const { uploadId, chunkSize } = await chunkedUploadService.initializeUpload(
      req.user!.id,
      filename,
      totalSize,
      mimeType,
    );

    res.json({
      success: true,
      data: {
        uploadId,
        chunkSize,
      },
    });
  }),
);

/**
 * @route POST /api/v1/uploads/chunk/:uploadId/:chunkNumber
 * @desc Upload a chunk of a file
 * @access Private
 */
router.post(
  '/chunk/:uploadId/:chunkNumber',
  authMiddleware,
  rateLimitMiddleware('chunk-upload', 100, 60), // 100 chunks per minute
  validateRequest({
    params: {
      uploadId: { type: 'string', format: 'uuid' },
      chunkNumber: { type: 'number', min: 0 },
    },
  }),
  asyncHandler(async (req, res) => {
    const { uploadId, chunkNumber } = req.params;
    const chunkData = req.body;

    if (!Buffer.isBuffer(chunkData)) {
      throw new ValidationError('Invalid chunk data');
    }

    const { progress, status } = await chunkedUploadService.uploadChunk(
      uploadId,
      parseInt(chunkNumber, 10),
      chunkData,
      req.user!.id,
    );

    res.json({
      success: true,
      data: {
        progress,
        status,
      },
    });
  }),
);

/**
 * @route GET /api/v1/uploads/status/:uploadId
 * @desc Get upload status
 * @access Private
 */
router.get(
  '/status/:uploadId',
  authMiddleware,
  validateRequest({
    params: {
      uploadId: { type: 'string', format: 'uuid' },
    },
  }),
  asyncHandler(async (req, res) => {
    const { uploadId } = req.params;

    const status = await chunkedUploadService.getUploadStatus(
      uploadId,
      req.user!.id,
    );

    res.json({
      success: true,
      data: status,
    });
  }),
);

/**
 * @route DELETE /api/v1/uploads/:uploadId
 * @desc Cancel an upload
 * @access Private
 */
router.delete(
  '/:uploadId',
  authMiddleware,
  validateRequest({
    params: {
      uploadId: { type: 'string', format: 'uuid' },
    },
  }),
  asyncHandler(async (req, res) => {
    const { uploadId } = req.params;

    await chunkedUploadService.cancelUpload(uploadId, req.user!.id);

    res.json({
      success: true,
      message: 'Upload cancelled successfully',
    });
  }),
);

export default router;
