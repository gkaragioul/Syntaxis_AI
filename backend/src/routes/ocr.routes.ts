// @ts-nocheck

import { Router } from 'express';
import { OCRService } from '../services/ocr.service';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/auth';
import { ValidationError, ServiceError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();
const ocrService = new OCRService(prisma);

// Process file with OCR - Enhanced with new features
router.post('/process/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const {
      engine = 'tesseract',
      language = 'eng',
      preprocessing = {},
      validation = {},
      fallback = {},
    } = req.body;

    // Validate engine
    if (!['tesseract', 'google-vision'].includes(engine)) {
      throw new ValidationError(
        'engine',
        engine,
        'Invalid OCR engine specified',
      );
    }

    // Validate language
    const supportedLanguages = [
      'eng',
      'spa',
      'fra',
      'deu',
      'ita',
      'por',
      'rus',
      'chi_sim',
      'jpn',
      'kor',
    ];
    if (!supportedLanguages.includes(language)) {
      throw new ValidationError(
        'language',
        language,
        `Unsupported language. Supported languages: ${supportedLanguages.join(', ')}`,
      );
    }

    // Build OCR configuration
    const ocrConfig = {
      engine,
      language,
      preprocessing: {
        deskew: preprocessing.deskew ?? true,
        denoise: preprocessing.denoise ?? true,
        enhance: preprocessing.enhance ?? true,
        brightness: preprocessing.brightness ?? 1.1,
        contrast: preprocessing.contrast ?? 1.2,
        threshold: preprocessing.threshold ?? 0.5,
      },
      validation: {
        minConfidence: validation.minConfidence ?? 0.85,
        minTextLength: validation.minTextLength ?? 50,
        requiredFields: validation.requiredFields ?? [],
      },
    };

    // Build fallback configuration
    const fallbackConfig = {
      enabled: fallback.enabled ?? true,
      primaryEngine: fallback.primaryEngine ?? engine,
      fallbackEngine:
        fallback.fallbackEngine ??
        (engine === 'tesseract' ? 'google-vision' : 'tesseract'),
      confidenceThreshold: fallback.confidenceThreshold ?? 0.7,
      maxRetries: fallback.maxRetries ?? 2,
      fallbackConditions: {
        lowConfidence: fallback.fallbackConditions?.lowConfidence ?? true,
        processingError: fallback.fallbackConditions?.processingError ?? true,
        emptyResult: fallback.fallbackConditions?.emptyResult ?? true,
      },
    };

    const result = await ocrService.processFile(
      fileId,
      req.user!.id,
      ocrConfig,
      fallbackConfig,
    );

    res.status(201).json({
      ...result,
      processingConfig: {
        engine: ocrConfig.engine,
        language: ocrConfig.language,
        preprocessing: ocrConfig.preprocessing,
        fallback: fallbackConfig,
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, field: error.field });
    } else if (error instanceof ServiceError) {
      res.status(500).json({ error: error.message });
    } else {
      logger.error('OCR processing error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get OCR result
router.get('/:resultId', authenticate, async (req, res) => {
  try {
    const result = await ocrService.getOCRResult(
      req.params.resultId,
      req.user!.id,
    );
    res.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    } else {
      logger.error('Error retrieving OCR result', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get enhanced confidence metrics for an OCR result
router.get('/:resultId/metrics', authenticate, async (req, res) => {
  try {
    const result = await ocrService.getOCRResult(
      req.params.resultId,
      req.user!.id,
    );

    // Extract enhanced metrics from metadata
    const metrics = {
      overall: result.confidence,
      confidenceMetrics: result.metadata?.confidenceMetrics || null,
      fieldConfidences: result.metadata?.fieldConfidences || {},
      processingMetrics: {
        engine: result.engine,
        processingTime: result.metadata?.processingTime || 0,
        preprocessingSteps: result.metadata?.preprocessingSteps || [],
        fallbackUsed: result.metadata?.fallback ? true : false,
        enginesUsed: result.metadata?.fallback?.enginesUsed || [result.engine],
      },
      qualityAssessment: {
        textLength: result.text.length,
        wordCount: result.text.split(/\s+/).filter((word) => word.length > 0)
          .length,
        hasStructuredData:
          Object.keys(result.metadata?.fieldConfidences || {}).length > 0,
        confidenceGrade:
          result.confidence >= 0.9
            ? 'A'
            : result.confidence >= 0.8
              ? 'B'
              : result.confidence >= 0.7
                ? 'C'
                : result.confidence >= 0.6
                  ? 'D'
                  : 'F',
      },
    };

    res.json(metrics);
  } catch (error) {
    if (error instanceof ValidationError) {
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    } else {
      logger.error('Error retrieving OCR metrics', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get processing configuration recommendations
router.post('/recommend-config', authenticate, async (req, res) => {
  try {
    const { fileType, imageQuality, documentType, priority } = req.body;

    // Generate recommendations based on input parameters
    const recommendations = {
      engine: 'tesseract', // Default
      preprocessing: {
        deskew: true,
        denoise: true,
        enhance: true,
        brightness: 1.1,
        contrast: 1.2,
      },
      fallback: {
        enabled: true,
        confidenceThreshold: 0.7,
      },
      validation: {
        minConfidence: 0.85,
        minTextLength: 50,
      },
    };

    // Adjust recommendations based on parameters
    if (imageQuality === 'low') {
      recommendations.preprocessing.denoise = true;
      recommendations.preprocessing.enhance = true;
      recommendations.preprocessing.brightness = 1.3;
      recommendations.preprocessing.contrast = 1.4;
      recommendations.fallback.enabled = true;
      recommendations.fallback.confidenceThreshold = 0.6;
    }

    if (documentType === 'invoice' || documentType === 'receipt') {
      recommendations.engine = 'google-vision'; // Better for structured documents
      recommendations.validation.requiredFields = ['amount', 'date'];
    }

    if (priority === 'speed') {
      recommendations.engine = 'tesseract';
      recommendations.fallback.enabled = false;
      recommendations.preprocessing.denoise = false;
    } else if (priority === 'accuracy') {
      recommendations.engine = 'google-vision';
      recommendations.fallback.enabled = true;
      recommendations.fallback.confidenceThreshold = 0.8;
    }

    res.json({
      recommendations,
      reasoning: {
        engineChoice: `Selected ${recommendations.engine} based on ${documentType || 'general'} document type and ${priority || 'balanced'} priority`,
        preprocessingSettings: `Configured for ${imageQuality || 'normal'} image quality`,
        fallbackStrategy: recommendations.fallback.enabled
          ? `Fallback enabled with ${recommendations.fallback.confidenceThreshold} confidence threshold`
          : 'Fallback disabled for speed optimization',
      },
    });
  } catch (error) {
    logger.error('Error generating config recommendations', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Advanced OCR processing with enhanced features
router.post('/process-advanced/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const {
      engines = ['tesseract', 'google-vision'],
      compareResults = true,
      selectBest = true,
      preprocessing = {},
      validation = {},
    } = req.body;

    // Validate engines
    const validEngines = engines.filter((engine) =>
      ['tesseract', 'google-vision'].includes(engine),
    );
    if (validEngines.length === 0) {
      throw new ValidationError(
        'engines',
        engines,
        'At least one valid engine must be specified',
      );
    }

    const results = [];
    const processingConfig = {
      preprocessing: {
        deskew: preprocessing.deskew ?? true,
        denoise: preprocessing.denoise ?? true,
        enhance: preprocessing.enhance ?? true,
        brightness: preprocessing.brightness ?? 1.1,
        contrast: preprocessing.contrast ?? 1.2,
      },
      validation: {
        minConfidence: validation.minConfidence ?? 0.85,
        minTextLength: validation.minTextLength ?? 50,
      },
    };

    // Process with each engine
    for (const engine of validEngines) {
      try {
        const result = await ocrService.processFile(fileId, req.user!.id, {
          engine,
          ...processingConfig,
        });
        results.push({
          engine,
          result,
          success: true,
        });
      } catch (error) {
        results.push({
          engine,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false,
        });
      }
    }

    let response = { results };

    // Compare results if requested
    if (compareResults && results.filter((r) => r.success).length >= 2) {
      const successfulResults = results.filter((r) => r.success);
      const comparisons = [];

      for (let i = 0; i < successfulResults.length - 1; i++) {
        for (let j = i + 1; j < successfulResults.length; j++) {
          const comparison = ocrService.compareOCRResults(
            {
              text: successfulResults[i].result.text,
              confidence: successfulResults[i].result.confidence,
              engine: successfulResults[i].engine,
            },
            {
              text: successfulResults[j].result.text,
              confidence: successfulResults[j].result.confidence,
              engine: successfulResults[j].engine,
            },
          );
          comparisons.push({
            engines: [successfulResults[i].engine, successfulResults[j].engine],
            comparison,
          });
        }
      }

      response.comparisons = comparisons;
    }

    // Select best result if requested
    if (selectBest && results.filter((r) => r.success).length > 0) {
      const successfulResults = results.filter((r) => r.success);
      const bestResult = successfulResults.reduce((best, current) => {
        if (current.result.confidence > best.result.confidence) {
          return current;
        }
        return best;
      });

      response.bestResult = bestResult;
    }

    res.json(response);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, field: error.field });
    } else if (error instanceof ServiceError) {
      res.status(500).json({ error: error.message });
    } else {
      logger.error('Advanced OCR processing error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Compare OCR results from different engines
router.post('/compare', authenticate, async (req, res) => {
  try {
    const { fileId } = req.body;

    if (!fileId) {
      throw new ValidationError('fileId', fileId, 'File ID is required');
    }

    // Process with both engines
    const [tesseractResult, visionResult] = await Promise.all([
      ocrService.processFile(fileId, req.user!.id, { engine: 'tesseract' }),
      ocrService.processFile(fileId, req.user!.id, { engine: 'google-vision' }),
    ]);

    // Compare results
    const comparison = ocrService.compareOCRResults(
      {
        text: tesseractResult.text,
        confidence: tesseractResult.confidence,
        engine: 'tesseract',
      },
      {
        text: visionResult.text,
        confidence: visionResult.confidence,
        engine: 'google-vision',
      },
    );

    res.json({
      tesseractResult,
      visionResult,
      comparison,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else if (error instanceof ServiceError) {
      res.status(500).json({ error: error.message });
    } else {
      logger.error('OCR comparison error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Cleanup OCR service on server shutdown
process.on('SIGTERM', async () => {
  await ocrService.cleanup();
});

export const ocrRoutes = router;
