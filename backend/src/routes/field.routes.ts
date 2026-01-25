// @ts-nocheck

import { Router } from 'express';
import { FieldExtractionService } from '../services/field.service';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/auth';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();
const fieldService = new FieldExtractionService(prisma);

// Extract fields from OCR result
router.post('/extract/:ocrResultId', authenticate, async (req, res) => {
  try {
    const { ocrResultId } = req.params;
    const userId = req.user!.id;

    const result = await fieldService.extractFields(ocrResultId, userId);
    res.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      logger.error('Field extraction error', { error });
      res.status(500).json({ error: 'Failed to extract fields' });
    }
  }
});

// Get extraction result
router.get('/:extractionId', authenticate, async (req, res) => {
  try {
    const { extractionId } = req.params;
    const userId = req.user!.id;

    const result = await fieldService.getExtraction(extractionId, userId);
    res.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      logger.error('Get extraction error', { error });
      res.status(500).json({ error: 'Failed to get extraction' });
    }
  }
});

// Update field patterns
router.put('/patterns', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { patterns } = req.body;

    if (!Array.isArray(patterns)) {
      throw new ValidationError('Patterns must be an array');
    }

    const result = await fieldService.updateFieldPatterns(userId, patterns);
    res.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      logger.error('Update patterns error', { error });
      res.status(500).json({ error: 'Failed to update patterns' });
    }
  }
});

// Update extraction rules
router.put('/rules', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { rules } = req.body;

    if (!Array.isArray(rules)) {
      throw new ValidationError('Rules must be an array');
    }

    const result = await fieldService.updateExtractionRules(userId, rules);
    res.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      logger.error('Update rules error', { error });
      res.status(500).json({ error: 'Failed to update rules' });
    }
  }
});

export const fieldRoutes = router;
