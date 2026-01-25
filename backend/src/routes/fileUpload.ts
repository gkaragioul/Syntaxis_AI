// @ts-nocheck

import { Router } from 'express';
import multer from 'multer';
import { FileUploadService } from '../services/FileUploadService';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { validateRequest } from '../middleware/validation';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../utils/errors';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 104857600, // 100MB
    files: 100, // Max 100 files per batch
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new ValidationError('Only PDF files are supported'));
      return;
    }
    cb(null, true);
  },
});

// Initialize services
const fileUploadService = new FileUploadService(
  // These services will be injected by dependency injection in production
  {} as any,
  {} as any,
  {} as any,
);

/**
 * @route POST /api/v1/files/upload
 * @desc Upload a single PDF file
 * @access Private
 */
router.post(
  '/upload',
  authMiddleware,
  rateLimitMiddleware('file-upload', 10, 60), // 10 requests per minute
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const { fileUpload, batchJob } = await fileUploadService.uploadFile(
      req.user!.id,
      req.file,
    );

    res.status(201).json({
      success: true,
      data: {
        fileUpload: {
          id: fileUpload.id,
          originalFilename: fileUpload.originalFilename,
          status: fileUpload.status,
        },
        batchJob: {
          id: batchJob.id,
          status: batchJob.status,
          totalFiles: batchJob.totalFiles,
        },
      },
    });
  }),
);

/**
 * @route POST /api/v1/files/batch
 * @desc Upload multiple PDF files in a batch
 * @access Private
 */
router.post(
  '/batch',
  authMiddleware,
  rateLimitMiddleware('batch-upload', 5, 60), // 5 batch uploads per minute
  upload.array('files', 100), // Max 100 files
  asyncHandler(async (req, res) => {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      throw new ValidationError('No files uploaded');
    }

    const { fileUploads, batchJob } = await fileUploadService.uploadBatch(
      req.user!.id,
      req.files,
    );

    res.status(201).json({
      success: true,
      data: {
        fileUploads: fileUploads.map((file) => ({
          id: file.id,
          originalFilename: file.originalFilename,
          status: file.status,
        })),
        batchJob: {
          id: batchJob.id,
          status: batchJob.status,
          totalFiles: batchJob.totalFiles,
        },
      },
    });
  }),
);

/**
 * @route GET /api/v1/files/batch/:batchJobId
 * @desc Get batch job status
 * @access Private
 */
router.get(
  '/batch/:batchJobId',
  authMiddleware,
  validateRequest({
    params: {
      batchJobId: { type: 'string', format: 'uuid' },
    },
  }),
  asyncHandler(async (req, res) => {
    const batchJob = await fileUploadService.getBatchJobStatus(
      req.params.batchJobId,
      req.user!.id,
    );

    res.json({
      success: true,
      data: {
        id: batchJob.id,
        status: batchJob.status,
        totalFiles: batchJob.totalFiles,
        processedFiles: batchJob.processedFiles,
        failedFiles: batchJob.failedFiles,
        progress: batchJob.getProgress(),
        errorSummary: batchJob.errorSummary,
        files: batchJob.batchJobFiles?.map((file) => ({
          id: file.fileUpload?.id,
          originalFilename: file.fileUpload?.originalFilename,
          status: file.status,
          errorMessage: file.errorMessage,
        })),
        createdAt: batchJob.createdAt,
        updatedAt: batchJob.updatedAt,
        completedAt: batchJob.completedAt,
      },
    });
  }),
);

/**
 * @route GET /api/v1/files/:fileUploadId
 * @desc Get file upload status
 * @access Private
 */
router.get(
  '/:fileUploadId',
  authMiddleware,
  validateRequest({
    params: {
      fileUploadId: { type: 'string', format: 'uuid' },
    },
  }),
  asyncHandler(async (req, res) => {
    const fileUpload = await fileUploadService.getFileUploadStatus(
      req.params.fileUploadId,
      req.user!.id,
    );

    res.json({
      success: true,
      data: {
        id: fileUpload.id,
        originalFilename: fileUpload.originalFilename,
        status: fileUpload.status,
        errorMessage: fileUpload.errorMessage,
        extractedData: fileUpload.extractedData?.map((data) => ({
          id: data.id,
          type: data.dataType,
          confidenceScore: data.confidenceScore,
        })),
        createdAt: fileUpload.createdAt,
        updatedAt: fileUpload.updatedAt,
        processedAt: fileUpload.processedAt,
      },
    });
  }),
);

export default router;
