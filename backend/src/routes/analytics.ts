// @ts-nocheck

import { Router } from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController';
import { auth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, query, param } from 'express-validator';

const router = Router();
const analyticsController = new AnalyticsController();

// Validation schemas
const trackEventValidation = [
  body('eventType')
    .isIn([
      'step_started',
      'step_completed',
      'step_skipped',
      'onboarding_started',
      'onboarding_completed',
      'onboarding_abandoned',
      'help_accessed',
    ])
    .withMessage('Invalid event type'),
  body('stepId')
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('stepId must be a string between 1 and 50 characters'),
  body('stepName')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('stepName must be a string between 1 and 100 characters'),
  body('timeSpent')
    .optional()
    .isNumeric()
    .isFloat({ min: 0, max: 3600 })
    .withMessage('timeSpent must be a number between 0 and 3600 seconds'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('metadata must be an object'),
  body('sessionId')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('sessionId must be a string between 1 and 100 characters'),
];

const trackBatchValidation = [
  body('events')
    .isArray({ min: 1, max: 100 })
    .withMessage('events must be an array with 1-100 items'),
  body('events.*.eventType')
    .isIn([
      'step_started',
      'step_completed',
      'step_skipped',
      'onboarding_started',
      'onboarding_completed',
      'onboarding_abandoned',
      'help_accessed',
    ])
    .withMessage('Invalid event type'),
];

const dateRangeValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date'),
];

const exportValidation = [
  query('format')
    .optional()
    .isIn(['csv', 'json', 'xlsx'])
    .withMessage('format must be csv, json, or xlsx'),
  ...dateRangeValidation,
];

// Routes

/**
 * @route POST /api/analytics/onboarding/events
 * @desc Track a single onboarding event
 * @access Private
 */
router.post(
  '/onboarding/events',
  auth,
  trackEventValidation,
  validateRequest,
  analyticsController.trackOnboardingEvent,
);

/**
 * @route POST /api/analytics/onboarding/events/batch
 * @desc Track multiple onboarding events in batch
 * @access Private
 */
router.post(
  '/onboarding/events/batch',
  auth,
  trackBatchValidation,
  validateRequest,
  analyticsController.trackOnboardingEventsBatch,
);

/**
 * @route GET /api/analytics/onboarding/metrics
 * @desc Get onboarding metrics (admin only)
 * @access Private (Admin)
 */
router.get(
  '/onboarding/metrics',
  auth,
  dateRangeValidation,
  validateRequest,
  analyticsController.getOnboardingMetrics,
);

/**
 * @route GET /api/analytics/onboarding/journey/:userId?
 * @desc Get user onboarding journey
 * @access Private
 */
router.get(
  '/onboarding/journey/:userId?',
  auth,
  param('userId')
    .optional()
    .isMongoId()
    .withMessage('userId must be a valid MongoDB ObjectId'),
  validateRequest,
  analyticsController.getUserOnboardingJourney,
);

/**
 * @route GET /api/analytics/onboarding/funnel
 * @desc Get onboarding completion funnel (admin only)
 * @access Private (Admin)
 */
router.get(
  '/onboarding/funnel',
  auth,
  dateRangeValidation,
  validateRequest,
  analyticsController.getOnboardingFunnel,
);

/**
 * @route GET /api/analytics/onboarding/insights
 * @desc Get onboarding performance insights (admin only)
 * @access Private (Admin)
 */
router.get(
  '/onboarding/insights',
  auth,
  dateRangeValidation,
  validateRequest,
  analyticsController.getOnboardingInsights,
);

/**
 * @route GET /api/analytics/onboarding/export
 * @desc Export onboarding analytics data (admin only)
 * @access Private (Admin)
 */
router.get(
  '/onboarding/export',
  auth,
  exportValidation,
  validateRequest,
  analyticsController.exportOnboardingData,
);

// Health check endpoint for analytics service
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'analytics',
    timestamp: new Date().toISOString(),
  });
});

export { router as analyticsRoutes };
