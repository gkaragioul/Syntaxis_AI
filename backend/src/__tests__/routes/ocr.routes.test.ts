import request from 'supertest';
import express from 'express';
import { ocrRoutes } from '../../routes/ocr.routes';
import { OCRService } from '../../services/ocr.service';
import { jest } from '@jest/globals';

// Mock the OCR service
jest.mock('../../services/ocr.service');
jest.mock('../../index', () => ({
  prisma: {},
}));

// Mock authentication middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'user-123' };
    next();
  },
}));

describe('OCR Routes - Enhanced Processing', () => {
  let app: express.Application;
  let mockOCRService: jest.Mocked<OCRService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Setup OCR service mock
    mockOCRService = {
      processFile: jest.fn(),
      getOCRResult: jest.fn(),
      compareOCRResults: jest.fn(),
      cleanup: jest.fn(),
    } as any;

    // Mock the OCR service constructor to return our mock
    const MockedOCRService = OCRService as jest.MockedClass<typeof OCRService>;
    MockedOCRService.mockImplementation(() => mockOCRService);

    app.use('/ocr', ocrRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /ocr/process/:fileId - Enhanced Processing', () => {
    const mockOCRResult = {
      id: 'ocr-result-123',
      text: 'Sample OCR text',
      confidence: 0.92,
      engine: 'tesseract',
      metadata: {
        confidenceMetrics: {
          overall: 0.92,
          textQuality: 0.9,
          structuralIntegrity: 0.85,
          fieldAccuracy: 0.88,
          processingReliability: 0.95,
        },
        fieldConfidences: {
          amount: 0.95,
          date: 0.88,
        },
        processingTime: 1500,
        preprocessingSteps: ['deskew', 'denoise', 'enhance'],
      },
    };

    it('should process file with default enhanced configuration', async () => {
      mockOCRService.processFile.mockResolvedValue(mockOCRResult as any);

      const response = await request(app)
        .post('/ocr/process/file-123')
        .send({
          engine: 'tesseract',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id', 'ocr-result-123');
      expect(response.body).toHaveProperty('processingConfig');
      expect(response.body.processingConfig).toHaveProperty('preprocessing');
      expect(response.body.processingConfig).toHaveProperty('fallback');

      expect(mockOCRService.processFile).toHaveBeenCalledWith(
        'file-123',
        'user-123',
        expect.objectContaining({
          engine: 'tesseract',
          preprocessing: expect.objectContaining({
            deskew: true,
            denoise: true,
            enhance: true,
          }),
        }),
        expect.objectContaining({
          enabled: true,
          primaryEngine: 'tesseract',
          fallbackEngine: 'google-vision',
        }),
      );
    });

    it('should process file with custom preprocessing options', async () => {
      mockOCRService.processFile.mockResolvedValue(mockOCRResult as any);

      const response = await request(app)
        .post('/ocr/process/file-123')
        .send({
          engine: 'google-vision',
          language: 'spa',
          preprocessing: {
            deskew: false,
            denoise: true,
            enhance: true,
            brightness: 1.3,
            contrast: 1.5,
          },
          validation: {
            minConfidence: 0.9,
            minTextLength: 100,
          },
          fallback: {
            enabled: false,
          },
        })
        .expect(201);

      expect(mockOCRService.processFile).toHaveBeenCalledWith(
        'file-123',
        'user-123',
        expect.objectContaining({
          engine: 'google-vision',
          language: 'spa',
          preprocessing: expect.objectContaining({
            deskew: false,
            brightness: 1.3,
            contrast: 1.5,
          }),
          validation: expect.objectContaining({
            minConfidence: 0.9,
            minTextLength: 100,
          }),
        }),
        expect.objectContaining({
          enabled: false,
        }),
      );
    });

    it('should validate engine parameter', async () => {
      const response = await request(app)
        .post('/ocr/process/file-123')
        .send({
          engine: 'invalid-engine',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid OCR engine');
    });

    it('should validate language parameter', async () => {
      const response = await request(app)
        .post('/ocr/process/file-123')
        .send({
          engine: 'tesseract',
          language: 'invalid-lang',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Unsupported language');
    });
  });

  describe('GET /ocr/:resultId/metrics - Enhanced Metrics', () => {
    const mockOCRResultWithMetrics = {
      id: 'ocr-result-123',
      text: 'INVOICE\nInvoice Number: INV-001\nAmount: $1,250.50',
      confidence: 0.92,
      engine: 'google-vision',
      metadata: {
        confidenceMetrics: {
          overall: 0.92,
          textQuality: 0.9,
          structuralIntegrity: 0.85,
          fieldAccuracy: 0.95,
          processingReliability: 0.88,
        },
        fieldConfidences: {
          invoiceNumber: 0.9,
          amount: 0.98,
        },
        processingTime: 2100,
        preprocessingSteps: ['deskew', 'denoise', 'enhance'],
        fallback: {
          enginesUsed: ['tesseract', 'google-vision'],
          attempts: [
            { engine: 'tesseract', confidence: 0.7, success: true },
            { engine: 'google-vision', confidence: 0.92, success: true },
          ],
        },
      },
    };

    it('should return enhanced confidence metrics', async () => {
      mockOCRService.getOCRResult.mockResolvedValue(
        mockOCRResultWithMetrics as any,
      );

      const response = await request(app)
        .get('/ocr/ocr-result-123/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('overall', 0.92);
      expect(response.body).toHaveProperty('confidenceMetrics');
      expect(response.body.confidenceMetrics).toHaveProperty(
        'textQuality',
        0.9,
      );
      expect(response.body.confidenceMetrics).toHaveProperty(
        'fieldAccuracy',
        0.95,
      );

      expect(response.body).toHaveProperty('fieldConfidences');
      expect(response.body.fieldConfidences).toHaveProperty('amount', 0.98);

      expect(response.body).toHaveProperty('processingMetrics');
      expect(response.body.processingMetrics).toHaveProperty(
        'fallbackUsed',
        true,
      );
      expect(response.body.processingMetrics).toHaveProperty('enginesUsed');

      expect(response.body).toHaveProperty('qualityAssessment');
      expect(response.body.qualityAssessment).toHaveProperty(
        'confidenceGrade',
        'A',
      );
      expect(response.body.qualityAssessment).toHaveProperty(
        'hasStructuredData',
        true,
      );
    });

    it('should handle results without enhanced metrics', async () => {
      const basicResult = {
        id: 'ocr-result-123',
        text: 'Basic OCR text',
        confidence: 0.75,
        engine: 'tesseract',
        metadata: {
          processingTime: 1000,
        },
      };

      mockOCRService.getOCRResult.mockResolvedValue(basicResult as any);

      const response = await request(app)
        .get('/ocr/ocr-result-123/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('overall', 0.75);
      expect(response.body).toHaveProperty('confidenceMetrics', null);
      expect(response.body).toHaveProperty('fieldConfidences', {});
      expect(response.body.processingMetrics).toHaveProperty(
        'fallbackUsed',
        false,
      );
      expect(response.body.qualityAssessment).toHaveProperty(
        'confidenceGrade',
        'C',
      );
    });
  });

  describe('POST /ocr/recommend-config - Configuration Recommendations', () => {
    it('should provide recommendations for low quality images', async () => {
      const response = await request(app)
        .post('/ocr/recommend-config')
        .send({
          imageQuality: 'low',
          documentType: 'general',
          priority: 'accuracy',
        })
        .expect(200);

      expect(response.body).toHaveProperty('recommendations');
      expect(response.body.recommendations.preprocessing).toHaveProperty(
        'denoise',
        true,
      );
      expect(response.body.recommendations.preprocessing).toHaveProperty(
        'brightness',
        1.3,
      );
      expect(response.body.recommendations.fallback).toHaveProperty(
        'enabled',
        true,
      );
      expect(response.body.recommendations.fallback).toHaveProperty(
        'confidenceThreshold',
        0.6,
      );

      expect(response.body).toHaveProperty('reasoning');
    });

    it('should recommend Google Vision for invoice processing', async () => {
      const response = await request(app)
        .post('/ocr/recommend-config')
        .send({
          documentType: 'invoice',
          priority: 'accuracy',
        })
        .expect(200);

      expect(response.body.recommendations).toHaveProperty(
        'engine',
        'google-vision',
      );
      expect(response.body.recommendations.validation).toHaveProperty(
        'requiredFields',
      );
      expect(response.body.recommendations.validation.requiredFields).toContain(
        'amount',
      );
      expect(response.body.recommendations.validation.requiredFields).toContain(
        'date',
      );
    });

    it('should optimize for speed when requested', async () => {
      const response = await request(app)
        .post('/ocr/recommend-config')
        .send({
          priority: 'speed',
        })
        .expect(200);

      expect(response.body.recommendations).toHaveProperty(
        'engine',
        'tesseract',
      );
      expect(response.body.recommendations.fallback).toHaveProperty(
        'enabled',
        false,
      );
      expect(response.body.recommendations.preprocessing).toHaveProperty(
        'denoise',
        false,
      );
    });
  });

  describe('POST /ocr/process-advanced/:fileId - Advanced Processing', () => {
    it('should process with multiple engines and compare results', async () => {
      const tesseractResult = {
        id: 'result-1',
        text: 'Tesseract result',
        confidence: 0.8,
        engine: 'tesseract',
      };

      const visionResult = {
        id: 'result-2',
        text: 'Google Vision result',
        confidence: 0.95,
        engine: 'google-vision',
      };

      const comparison = {
        match: false,
        confidence: 0.7,
        differences: ['Different text content'],
      };

      mockOCRService.processFile
        .mockResolvedValueOnce(tesseractResult as any)
        .mockResolvedValueOnce(visionResult as any);

      mockOCRService.compareOCRResults.mockReturnValue(comparison as any);

      const response = await request(app)
        .post('/ocr/process-advanced/file-123')
        .send({
          engines: ['tesseract', 'google-vision'],
          compareResults: true,
          selectBest: true,
        })
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body.results).toHaveLength(2);
      expect(response.body).toHaveProperty('comparisons');
      expect(response.body).toHaveProperty('bestResult');
      expect(response.body.bestResult.engine).toBe('google-vision');
      expect(response.body.bestResult.result.confidence).toBe(0.95);
    });
  });
});
