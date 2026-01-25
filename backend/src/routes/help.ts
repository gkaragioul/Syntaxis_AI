// @ts-nocheck

import { Router } from 'express';
import { HelpService } from '../services/HelpService';
import { authenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const router = Router();
const helpService = new HelpService();

// Onboarding routes
router.get('/onboarding/status', authenticate, async (req, res, next) => {
  try {
    const status = await helpService.getOnboardingStatus(req.user!.id);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/onboarding/step/:stepId',
  authenticate,
  validateRequest({
    params: z.object({
      stepId: z.string(),
    }),
    body: z.object({
      completed: z.boolean(),
    }),
  }),
  async (req, res, next) => {
    try {
      await helpService.updateOnboardingStatus(
        req.user!.id,
        req.params.stepId,
        req.body.completed,
      );
      res.json({ message: 'Onboarding step updated' });
    } catch (error) {
      next(error);
    }
  },
);

router.post('/onboarding/skip', authenticate, async (req, res, next) => {
  try {
    await helpService.skipOnboarding(req.user!.id);
    res.json({ message: 'Onboarding skipped' });
  } catch (error) {
    next(error);
  }
});

// Help content routes
router.get(
  '/content',
  authenticate,
  validateRequest({
    query: z.object({
      category: z.string().optional(),
      tags: z.string().optional(),
      search: z.string().optional(),
    }),
  }),
  rateLimit({ windowMs: 60000, max: 30 }), // 30 requests per minute
  async (req, res, next) => {
    try {
      const { category, tags, search } = req.query;
      const content = await helpService.getHelpContent(
        category as string,
        tags ? (tags as string).split(',') : undefined,
        search as string,
      );
      res.json(content);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/content/:id',
  authenticate,
  validateRequest({
    params: z.object({
      id: z.string(),
    }),
  }),
  rateLimit({ windowMs: 60000, max: 30 }),
  async (req, res, next) => {
    try {
      const article = await helpService.getHelpArticle(req.params.id);
      if (!article) {
        res.status(404).json({ message: 'Help article not found' });
        return;
      }
      res.json(article);
    } catch (error) {
      next(error);
    }
  },
);

// Feedback routes
router.post(
  '/feedback',
  authenticate,
  validateRequest({
    body: z.object({
      page: z.string(),
      context: z.string(),
      feedback: z.string().min(1),
      rating: z.number().min(1).max(5).optional(),
      type: z.enum(['bug', 'suggestion', 'question', 'other']),
    }),
  }),
  rateLimit({ windowMs: 3600000, max: 10 }), // 10 requests per hour
  async (req, res, next) => {
    try {
      await helpService.submitFeedback(req.user!.id, req.body);
      res.json({ message: 'Feedback submitted successfully' });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/feedback',
  authenticate,
  validateRequest({
    query: z.object({
      page: z.string().optional(),
      type: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const feedback = await helpService.getFeedback(
        req.user!.id,
        req.query.page as string,
        req.query.type as string,
      );
      res.json(feedback);
    } catch (error) {
      next(error);
    }
  },
);

export const helpRoutes = router;
