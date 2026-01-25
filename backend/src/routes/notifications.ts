// @ts-nocheck

import { Router } from 'express';
import { z } from 'zod';
import { NotificationService } from '../services/NotificationService';
import {
  NotificationType,
  NotificationPriority,
  EmailFrequency,
} from '../models/Notification';
import { requireAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { asyncHandler } from '../utils/asyncHandler';
import { NotificationError } from '../models/Notification';
import { EmailService } from '../services/EmailService';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const notificationService = new NotificationService(new EmailService());

// Validation schemas
const createNotificationSchema = z.object({
  type: z.nativeEnum(NotificationType),
  priority: z.nativeEnum(NotificationPriority).optional(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  metadata: z.record(z.any()).optional(),
  expiresAt: z.string().datetime().optional(),
});

const createErrorReportSchema = z.object({
  batchJobId: z.string().uuid().optional(),
  fileId: z.string().uuid().optional(),
  errorType: z.string().min(1).max(100),
  errorCode: z.string().min(1).max(50),
  errorMessage: z.string().min(1).max(500),
  errorDetails: z.record(z.any()).optional(),
  troubleshootingTips: z.array(z.string()).optional(),
  stackTrace: z.string().optional(),
  contextData: z.record(z.any()).optional(),
  expiresAt: z.string().datetime().optional(),
});

const updatePreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  inAppNotifications: z.boolean().optional(),
  notificationTypes: z
    .record(z.nativeEnum(NotificationType), z.boolean())
    .optional(),
  emailFrequency: z.nativeEnum(EmailFrequency).optional(),
});

const listNotificationsSchema = z.object({
  type: z.nativeEnum(NotificationType).optional(),
  read: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

const markAsReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()).optional(),
});

// Routes
router.post(
  '/notifications',
  requireAuth,
  validateRequest({ body: createNotificationSchema }),
  asyncHandler(async (req, res) => {
    const notificationService = req.app.get(
      'notificationService',
    ) as NotificationService;
    await notificationService.createNotification({
      ...req.body,
      userId: req.user.id,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
    });
    res.status(201).json({ message: 'Notification created successfully' });
  }),
);

router.post(
  '/error-reports',
  requireAuth,
  validateRequest({ body: createErrorReportSchema }),
  asyncHandler(async (req, res) => {
    const notificationService = req.app.get(
      'notificationService',
    ) as NotificationService;
    await notificationService.createErrorReport({
      ...req.body,
      userId: req.user.id,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
    });
    res.status(201).json({ message: 'Error report created successfully' });
  }),
);

router.get(
  '/notifications',
  requireAuth,
  validateRequest({ query: listNotificationsSchema }),
  asyncHandler(async (req, res) => {
    const notificationService = req.app.get(
      'notificationService',
    ) as NotificationService;
    const {
      type,
      read,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = req.query;

    const result = await notificationService.getNotifications(
      req.user.id,
      {
        type: type as NotificationType | undefined,
        read: read as boolean | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      },
      Number(limit),
      Number(offset),
    );

    res.json(result);
  }),
);

router.get(
  '/notifications/unread-count',
  requireAuth,
  asyncHandler(async (req, res) => {
    const notificationService = req.app.get(
      'notificationService',
    ) as NotificationService;
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json({ count });
  }),
);

router.post(
  '/notifications/mark-read',
  requireAuth,
  validateRequest({ body: markAsReadSchema }),
  asyncHandler(async (req, res) => {
    const notificationService = req.app.get(
      'notificationService',
    ) as NotificationService;
    const count = await notificationService.markNotificationsAsRead(
      req.user.id,
      req.body.notificationIds,
    );
    res.json({ count });
  }),
);

router.get(
  '/error-reports/:id',
  requireAuth,
  validateRequest({
    params: z.object({
      id: z.string(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const notificationService = req.app.get(
      'notificationService',
    ) as NotificationService;
    const { id } = req.params;
    const report = await notificationService.getErrorReport(id);

    if (!report) {
      return res.status(404).json({ error: 'Error report not found' });
    }

    // Check if user has access to this error report
    if (report.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!report.reportPath) {
      return res.status(404).json({ error: 'Error report file not found' });
    }

    // Serve the error report file for download
    // Increment download count asynchronously
    notificationService.incrementDownloadCount(id).catch(err => {
      logger.error('Failed to increment download count', { error: err, reportId: id });
    });

    res.download(report.reportPath, `error-report-${id}.txt`, (err) => {
      if (err) {
        logger.error('Error downloading file', { error: err, reportPath: report.reportPath });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download file' });
        }
      }
    });
  }),
);

router.get(
  '/error-reports/:id/download/:format',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id, format } = req.params;
    if (!['pdf', 'csv'].includes(format)) {
      throw new NotificationError('Invalid format', 'INVALID_FORMAT', 400);
    }

    const notificationService = req.app.get(
      'notificationService',
    ) as NotificationService;
    const report = await notificationService.getErrorReport(req.user.id, id);

    if (!report.reportPath || report.reportFormat !== format) {
      throw new NotificationError(
        'Report file not found',
        'FILE_NOT_FOUND',
        404,
      );
    }

    res.download(report.reportPath, `error-report-${id}.${format}`);
  }),
);

router.get(
  '/preferences',
  requireAuth,
  asyncHandler(async (req, res) => {
    const notificationService = req.app.get(
      'notificationService',
    ) as NotificationService;
    const preferences = await notificationService.getUserPreferences(
      req.user.id,
    );
    res.json(preferences);
  }),
);

router.patch(
  '/preferences',
  requireAuth,
  validateRequest({ body: updatePreferencesSchema }),
  asyncHandler(async (req, res) => {
    const notificationService = req.app.get(
      'notificationService',
    ) as NotificationService;
    const preferences = await notificationService.updateUserPreferences(
      req.user.id,
      req.body,
    );
    res.json(preferences);
  }),
);

// Error handling middleware
router.use((err: Error, req: any, res: any, next: any) => {
  if (err instanceof NotificationError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
  } else {
    next(err);
  }
});

export default router;
