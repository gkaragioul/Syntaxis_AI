import { Router } from 'express';
import { FileService } from '../services/file.service';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth.middleware';
import multer from 'multer';
import { ValidationError } from '../utils/errors';
import {
  createSuccessResponse,
  createErrorResponse,
  commonErrors,
  asyncHandler
} from '../utils/response';
import { ErrorCode } from '../types/errors';

const router = Router();
const fileService = new FileService(prisma);

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(
        new ValidationError(
          'file',
          file.mimetype,
          'Only PDF files are allowed',
        ),
      );
    }
  },
});

// Upload file
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json(createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'No file uploaded',
        'Please select a file to upload',
        '/help/file-upload',
        undefined,
        undefined,
        req.headers['x-request-id'] as string
      ));
    }

    const file = await fileService.uploadFile(req.file, req.user!.id);
    res.status(201).json(createSuccessResponse(
      file,
      'File uploaded successfully',
      req.headers['x-request-id'] as string
    ));
  }),
);

// Get file metadata
router.get('/:fileId', authenticate, asyncHandler(async (req, res) => {
  const file = await fileService.getFile(req.params.fileId, req.user!.id);

  if (!file) {
    return res.status(404).json(commonErrors.notFound(
      'File',
      req.headers['x-request-id'] as string
    ));
  }

  res.json(createSuccessResponse(
    file,
    'File metadata retrieved successfully',
    req.headers['x-request-id'] as string
  ));
}));

// List user's files
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const status = req.query.status as
    | 'uploaded'
    | 'processing'
    | 'completed'
    | 'failed'
    | undefined;

  const files = await fileService.listFiles(req.user!.id, { status });

  res.json(createSuccessResponse(
    files,
    'Files retrieved successfully',
    req.headers['x-request-id'] as string
  ));
}));

// Delete file
router.delete('/:fileId', authenticate, asyncHandler(async (req, res) => {
  const file = await fileService.getFile(req.params.fileId, req.user!.id);

  if (!file) {
    return res.status(404).json(commonErrors.notFound(
      'File',
      req.headers['x-request-id'] as string
    ));
  }

  await fileService.deleteFile(req.params.fileId, req.user!.id);

  res.json(createSuccessResponse(
    null,
    'File deleted successfully',
    req.headers['x-request-id'] as string
  ));
}));

// Download file
router.get('/:fileId/download', authenticate, async (req, res) => {
  try {
    const file = await fileService.getFile(req.params.fileId, req.user!.id);
    const fileStream = await fileService.getFileStream(
      req.params.fileId,
      req.user!.id,
    );

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.originalFilename}"`,
    );

    fileStream.pipe(res);
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === 'File not found' ||
        error.message === 'File not found on disk'
      ) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
});

export const fileRoutes = router;
