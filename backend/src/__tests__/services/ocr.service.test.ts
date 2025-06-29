import { OCRService } from '../../services/ocr.service';
import { PrismaClient } from '@prisma/client';
import { ValidationError, ServiceError } from '../../utils/errors';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { ocrWorkerPool } from '../../utils/OCRWorkerPool';
import { promises as fs } from 'fs';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('@google-cloud/vision', () => ({
  ImageAnnotatorClient: jest.fn().mockImplementation(() => ({
    textDetection: jest.fn(),
  })),
}));

jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(),
  Worker: jest.fn(),
}));

jest.mock('../../utils/OCRWorkerPool');
jest.mock('pdfjs-dist');
jest.mock('pdf-lib');

jest.mock('sharp', () => {
  const mockSharpInstance = {
    grayscale: jest.fn().mockReturnThis(),
    modulate: jest.fn().mockReturnThis(),
    threshold: jest.fn().mockReturnThis(),
    median: jest.fn().mockReturnThis(),
    toBuffer: jest.fn(() => Promise.resolve(Buffer.from('processed image'))),
    metadata: jest.fn(() => Promise.resolve({ width: 100, height: 100, format: 'jpeg' })),
  };

  const mockSharp = jest.fn(() => mockSharpInstance);
  // For namespace import (import * as sharp)
  return mockSharp;
});

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('OCRService', () => {
  let ocrService: OCRService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockVisionClient: jest.Mocked<ImageAnnotatorClient>;
  let mockWorker: any;

  beforeEach(() => {
    // Setup Prisma mock
    mockPrisma = {
      file: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      ocrResult: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    } as any;

    // Setup Vision API mock
    mockVisionClient = {
      textDetection: jest.fn(),
    } as any;

    // Setup OCR worker mock
    mockWorker = {
      loadLanguage: jest.fn().mockResolvedValue(undefined),
      initialize: jest.fn().mockResolvedValue(undefined),
      recognize: jest.fn().mockResolvedValue({
        data: {
          text: 'Sample OCR text',
          confidence: 95,
        },
      }),
    };

    // Setup worker pool mock
    (ocrWorkerPool.acquire as jest.Mock).mockResolvedValue(mockWorker);
    (ocrWorkerPool.release as jest.Mock).mockImplementation(() => {});
    (ocrWorkerPool.init as jest.Mock).mockResolvedValue(undefined);

    // Setup fs mock
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('test image data'));

    // Create service instance
    ocrService = new OCRService(mockPrisma);

    // Manually set the vision client for testing
    (ocrService as any).visionClient = mockVisionClient;

    // Skip the initialization to avoid async issues in tests
    (ocrService as any).poolInitialised = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Google Vision API Integration', () => {
    const mockFile = {
      id: 'file-123',
      userId: 'user-123',
      filePath: '/path/to/file.jpg',
      status: 'pending',
    };

    const mockGoogleVisionResponse = [
      {
        textAnnotations: [
          {
            description: 'INVOICE\nInvoice Number: INV-001\nTotal: $100.00',
            confidence: 0.95,
          },
          {
            description: 'INVOICE',
            confidence: 0.98,
          },
          {
            description: 'Invoice',
            confidence: 0.96,
          },
          {
            description: 'Number:',
            confidence: 0.94,
          },
          {
            description: 'INV-001',
            confidence: 0.92,
          },
          {
            description: 'Total:',
            confidence: 0.97,
          },
          {
            description: '$100.00',
            confidence: 0.93,
          },
        ],
      },
    ];

    beforeEach(() => {
      mockPrisma.file.findUnique.mockResolvedValue(mockFile as any);
      mockPrisma.ocrResult.create.mockResolvedValue({
        id: 'ocr-result-123',
        fileId: 'file-123',
        userId: 'user-123',
        text: 'INVOICE\nInvoice Number: INV-001\nTotal: $100.00',
        confidence: 0.95,
        engine: 'google-vision',
        status: 'completed',
        metadata: {},
      } as any);
      mockPrisma.file.update.mockResolvedValue(mockFile as any);
    });

    it('should process file with Google Vision API successfully', async () => {
      mockVisionClient.textDetection.mockResolvedValue(mockGoogleVisionResponse as any);

      const result = await ocrService.processFile('file-123', 'user-123', {
        engine: 'google-vision',
      });

      expect(mockVisionClient.textDetection).toHaveBeenCalledWith({
        image: { content: expect.any(Buffer) },
      });

      expect(result.text).toBe('INVOICE\nInvoice Number: INV-001\nTotal: $100.00');
      expect(result.confidence).toBeCloseTo(0.95, 2);
      expect(result.engine).toBe('google-vision');
    });

    it('should handle Google Vision API with no text detected', async () => {
      mockVisionClient.textDetection.mockResolvedValue([{ textAnnotations: [] }] as any);

      const result = await ocrService.processFile('file-123', 'user-123', {
        engine: 'google-vision',
      });

      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
      expect(result.engine).toBe('google-vision');
    });

    it('should calculate confidence correctly from word detections', async () => {
      const responseWithVariedConfidence = [
        {
          textAnnotations: [
            { description: 'Full text', confidence: 0.95 },
            { description: 'Word1', confidence: 0.9 },
            { description: 'Word2', confidence: 0.8 },
            { description: 'Word3', confidence: 1.0 },
          ],
        },
      ];

      mockVisionClient.textDetection.mockResolvedValue(responseWithVariedConfidence as any);

      const result = await ocrService.processFile('file-123', 'user-123', {
        engine: 'google-vision',
      });

      // Expected confidence: (0.9 + 0.8 + 1.0) / 3 = 0.9
      expect(result.confidence).toBeCloseTo(0.9, 2);
    });

    it('should handle Google Vision API errors gracefully', async () => {
      mockVisionClient.textDetection.mockRejectedValue(new Error('API quota exceeded'));

      await expect(
        ocrService.processFile('file-123', 'user-123', {
          engine: 'google-vision',
        }),
      ).rejects.toThrow(ServiceError);

      expect(mockPrisma.file.update).toHaveBeenCalledWith({
        where: { id: 'file-123' },
        data: { status: 'failed' },
      });
    });

    it('should throw error when Google Vision client is not initialized', async () => {
      // Remove the vision client
      (ocrService as any).visionClient = null;

      await expect(
        ocrService.processFile('file-123', 'user-123', {
          engine: 'google-vision',
        }),
      ).rejects.toThrow('Google Vision API client not initialized');
    });

    it('should handle missing confidence values in Google Vision response', async () => {
      const responseWithoutConfidence = [
        {
          textAnnotations: [
            { description: 'Full text' },
            { description: 'Word1' },
            { description: 'Word2' },
          ],
        },
      ];

      mockVisionClient.textDetection.mockResolvedValue(responseWithoutConfidence as any);

      const result = await ocrService.processFile('file-123', 'user-123', {
        engine: 'google-vision',
      });

      // Should use default confidence of 0.5 when no confidence values available
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('Engine Selection and Validation', () => {
    const mockFile = {
      id: 'file-123',
      userId: 'user-123',
      filePath: '/path/to/file.jpg',
      status: 'pending',
    };

    beforeEach(() => {
      mockPrisma.file.findUnique.mockResolvedValue(mockFile as any);
      mockPrisma.file.update.mockResolvedValue(mockFile as any);
    });

    it('should validate OCR engine selection', async () => {
      await expect(
        ocrService.processFile('file-123', 'user-123', {
          engine: 'invalid-engine' as any,
        }),
      ).rejects.toThrow('Selected OCR engine is not available');
    });

    it('should default to tesseract engine when not specified', async () => {
      mockPrisma.ocrResult.create.mockResolvedValue({
        id: 'ocr-result-123',
        engine: 'tesseract',
      } as any);

      const result = await ocrService.processFile('file-123', 'user-123');

      expect(mockWorker.recognize).toHaveBeenCalled();
      expect(result.engine).toBe('tesseract');
    });
  });

  describe('File Access and Security', () => {
    it('should verify file access before processing', async () => {
      mockPrisma.file.findUnique.mockResolvedValue(null);

      await expect(
        ocrService.processFile('nonexistent-file', 'user-123'),
      ).rejects.toThrow(ValidationError);

      expect(mockPrisma.file.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent-file' },
      });
    });

    it('should prevent unauthorized file access', async () => {
      mockPrisma.file.findUnique.mockResolvedValue({
        id: 'file-123',
        userId: 'other-user',
        filePath: '/path/to/file.jpg',
      } as any);

      await expect(
        ocrService.processFile('file-123', 'user-123'),
      ).rejects.toThrow('Not authorized to process this file');
    });
  });

  describe('Enhanced Image Preprocessing', () => {
    const mockFile = {
      id: 'file-123',
      userId: 'user-123',
      filePath: '/path/to/file.jpg',
      status: 'pending',
    };

    beforeEach(() => {
      mockPrisma.file.findUnique.mockResolvedValue(mockFile as any);
      mockPrisma.file.update.mockResolvedValue(mockFile as any);
      mockPrisma.ocrResult.create.mockResolvedValue({
        id: 'ocr-result-123',
        text: 'Processed text',
        confidence: 0.9,
        engine: 'tesseract',
      } as any);
    });

    it('should apply advanced preprocessing with deskewing enabled', async () => {
      const mockSharpInstance = {
        metadata: jest.fn().mockResolvedValue({ width: 1000, height: 800, density: 150 }),
        grayscale: jest.fn().mockReturnThis(),
        convolve: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        rotate: jest.fn().mockReturnThis(),
        median: jest.fn().mockReturnThis(),
        blur: jest.fn().mockReturnThis(),
        modulate: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed image')),
      };

      // Mock sharp to return our mock instance
      const sharp = require('sharp');
      sharp.mockReturnValue(mockSharpInstance);

      const config = {
        engine: 'tesseract' as const,
        preprocessing: {
          deskew: true,
          denoise: true,
          enhance: true,
          brightness: 1.2,
          contrast: 1.3,
        },
      };

      await ocrService.processFile('file-123', 'user-123', config);

      // Verify preprocessing steps were called
      expect(mockSharpInstance.grayscale).toHaveBeenCalled();
      expect(mockSharpInstance.median).toHaveBeenCalled();
      expect(mockSharpInstance.modulate).toHaveBeenCalledWith({
        brightness: 1.2,
        contrast: 1.3,
        saturation: 0.8,
      });
      expect(mockSharpInstance.threshold).toHaveBeenCalled();
    });
  });

  describe('Enhanced Confidence Scoring System', () => {
    const mockFile = {
      id: 'file-123',
      userId: 'user-123',
      filePath: '/path/to/file.jpg',
      status: 'pending',
    };

    const mockGoogleVisionResponseWithFields = [
      {
        textAnnotations: [
          {
            description: 'INVOICE\nInvoice Number: INV-2024-001\nDate: 12/15/2024\nAmount: $1,250.50\nEmail: billing@company.com',
            confidence: 0.95,
          },
          { description: 'INVOICE', confidence: 0.98 },
          { description: 'Invoice', confidence: 0.96 },
          { description: 'Number:', confidence: 0.94 },
          { description: 'INV-2024-001', confidence: 0.92 },
          { description: 'Date:', confidence: 0.97 },
          { description: '12/15/2024', confidence: 0.93 },
          { description: 'Amount:', confidence: 0.95 },
          { description: '$1,250.50', confidence: 0.91 },
          { description: 'Email:', confidence: 0.96 },
          { description: 'billing@company.com', confidence: 0.89 },
        ],
      },
    ];

    beforeEach(() => {
      mockPrisma.file.findUnique.mockResolvedValue(mockFile as any);
      mockPrisma.file.update.mockResolvedValue(mockFile as any);
    });

    it('should calculate advanced confidence metrics for Google Vision results', async () => {
      mockVisionClient.textDetection.mockResolvedValue(mockGoogleVisionResponseWithFields as any);

      const mockOcrResult = {
        id: 'ocr-result-123',
        text: 'INVOICE\nInvoice Number: INV-2024-001\nDate: 12/15/2024\nAmount: $1,250.50\nEmail: billing@company.com',
        confidence: 0.94,
        engine: 'google-vision',
        metadata: {
          confidenceMetrics: {
            overall: 0.94,
            textQuality: 0.93,
            structuralIntegrity: 0.8,
            fieldAccuracy: 0.9,
            processingReliability: 0.85,
          },
          fieldConfidences: {
            invoiceNumber: 0.9,
            amount: 1.0,
            date: 0.95,
            email: 1.0,
          },
        },
      };

      mockPrisma.ocrResult.create.mockResolvedValue(mockOcrResult as any);

      const result = await ocrService.processFile('file-123', 'user-123', {
        engine: 'google-vision',
      });

      expect(result.metadata.confidenceMetrics).toBeDefined();
      expect(result.metadata.confidenceMetrics.overall).toBeGreaterThan(0.8);
      expect(result.metadata.confidenceMetrics.textQuality).toBeGreaterThan(0.8);
      expect(result.metadata.confidenceMetrics.fieldAccuracy).toBeGreaterThan(0.8);

      expect(result.metadata.fieldConfidences).toBeDefined();
      expect(result.metadata.fieldConfidences.amount).toBeGreaterThan(0.9);
      expect(result.metadata.fieldConfidences.email).toBeGreaterThan(0.9);
    });

    it('should provide field-specific confidence scores', async () => {
      mockVisionClient.textDetection.mockResolvedValue(mockGoogleVisionResponseWithFields as any);

      const mockOcrResult = {
        id: 'ocr-result-123',
        metadata: {
          fieldConfidences: {
            invoiceNumber: 0.8,
            amount: 1.0,
            date: 0.95,
            email: 1.0,
          },
        },
      };

      mockPrisma.ocrResult.create.mockResolvedValue(mockOcrResult as any);

      const result = await ocrService.processFile('file-123', 'user-123', {
        engine: 'google-vision',
      });

      const fieldConfidences = result.metadata.fieldConfidences;
      expect(fieldConfidences).toBeDefined();

      // Well-formatted amount should have high confidence
      expect(fieldConfidences.amount).toBeGreaterThanOrEqual(0.9);

      // Valid email should have high confidence
      expect(fieldConfidences.email).toBeGreaterThanOrEqual(0.95);

      // Properly formatted date should have good confidence
      expect(fieldConfidences.date).toBeGreaterThanOrEqual(0.85);
    });

    it('should handle documents with poor quality gracefully', async () => {
      const poorQualityResponse = [
        {
          textAnnotations: [
            { description: 'blurry text', confidence: 0.3 },
            { description: 'blurry', confidence: 0.2 },
            { description: 'text', confidence: 0.4 },
          ],
        },
      ];

      mockVisionClient.textDetection.mockResolvedValue(poorQualityResponse as any);

      const mockOcrResult = {
        id: 'ocr-result-123',
        confidence: 0.3,
        metadata: {
          confidenceMetrics: {
            overall: 0.3,
            textQuality: 0.3,
            structuralIntegrity: 0.5,
            fieldAccuracy: 0.0,
            processingReliability: 0.4,
          },
        },
      };

      mockPrisma.ocrResult.create.mockResolvedValue(mockOcrResult as any);

      const result = await ocrService.processFile('file-123', 'user-123', {
        engine: 'google-vision',
        validation: { minConfidence: 0.1 }, // Lower threshold for this test
      });

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.metadata.confidenceMetrics.textQuality).toBeLessThan(0.5);
      expect(result.metadata.confidenceMetrics.fieldAccuracy).toBe(0);
    });

    it('should boost confidence for documents with recognizable patterns', async () => {
      const structuredResponse = [
        {
          textAnnotations: [
            { description: 'INVOICE #12345\nDate: 01/15/2024\nTotal: $999.99', confidence: 0.85 },
            { description: 'INVOICE', confidence: 0.9 },
            { description: '#12345', confidence: 0.88 },
            { description: 'Date:', confidence: 0.92 },
            { description: '01/15/2024', confidence: 0.87 },
            { description: 'Total:', confidence: 0.91 },
            { description: '$999.99', confidence: 0.89 },
          ],
        },
      ];

      mockVisionClient.textDetection.mockResolvedValue(structuredResponse as any);

      const mockOcrResult = {
        id: 'ocr-result-123',
        confidence: 0.88,
        metadata: {
          confidenceMetrics: {
            overall: 0.88,
            textQuality: 0.89,
            structuralIntegrity: 0.9,
            fieldAccuracy: 0.85,
            processingReliability: 0.8,
          },
        },
      };

      mockPrisma.ocrResult.create.mockResolvedValue(mockOcrResult as any);

      const result = await ocrService.processFile('file-123', 'user-123', {
        engine: 'google-vision',
      });

      // Structured documents should have higher structural integrity
      expect(result.metadata.confidenceMetrics.structuralIntegrity).toBeGreaterThan(0.8);
      expect(result.metadata.confidenceMetrics.fieldAccuracy).toBeGreaterThan(0.8);
    });
  });

  describe('Multi-Engine Fallback System', () => {
    const mockFile = {
      id: 'file-123',
      userId: 'user-123',
      filePath: '/path/to/file.jpg',
      status: 'pending',
    };

    beforeEach(() => {
      mockPrisma.file.findUnique.mockResolvedValue(mockFile as any);
      mockPrisma.file.update.mockResolvedValue(mockFile as any);
    });

    it('should use primary engine when confidence is above threshold', async () => {
      // Mock successful Tesseract result with high confidence
      mockWorker.recognize.mockResolvedValue({
        data: {
          text: 'High quality OCR text with good confidence',
          confidence: 90, // 0.9 after division by 100
        },
      });

      const mockOcrResult = {
        id: 'ocr-result-123',
        text: 'High quality OCR text with good confidence',
        confidence: 0.9,
        engine: 'tesseract',
        metadata: {
          fallback: {
            attempts: [
              {
                engine: 'tesseract',
                confidence: 0.9,
                success: true,
              },
            ],
            enginesUsed: ['tesseract'],
          },
        },
      };

      mockPrisma.ocrResult.create.mockResolvedValue(mockOcrResult as any);

      const result = await ocrService.processFile('file-123', 'user-123', {
        engine: 'tesseract',
      }, {
        enabled: true,
        primaryEngine: 'tesseract',
        fallbackEngine: 'google-vision',
        confidenceThreshold: 0.7,
      });

      expect(result.engine).toBe('tesseract');
      expect(result.confidence).toBe(0.9);
      expect(mockWorker.recognize).toHaveBeenCalled();
      expect(mockVisionClient.textDetection).not.toHaveBeenCalled();
    });

    it('should fallback to secondary engine when primary has low confidence', async () => {
      // Mock low confidence Tesseract result
      mockWorker.recognize.mockResolvedValue({
        data: {
          text: 'Poor quality text',
          confidence: 50, // 0.5 after division by 100
        },
      });

      // Mock high confidence Google Vision result
      const mockGoogleVisionResponse = [
        {
          textAnnotations: [
            { description: 'High quality Google Vision text', confidence: 0.95 },
            { description: 'High', confidence: 0.96 },
            { description: 'quality', confidence: 0.94 },
            { description: 'Google', confidence: 0.95 },
            { description: 'Vision', confidence: 0.93 },
            { description: 'text', confidence: 0.97 },
          ],
        },
      ];

      mockVisionClient.textDetection.mockResolvedValue(mockGoogleVisionResponse as any);

      const mockOcrResult = {
        id: 'ocr-result-123',
        text: 'High quality Google Vision text',
        confidence: 0.95,
        engine: 'google-vision',
        metadata: {
          fallback: {
            attempts: [
              {
                engine: 'tesseract',
                confidence: 0.5,
                success: true,
              },
              {
                engine: 'google-vision',
                confidence: 0.95,
                success: true,
              },
            ],
            enginesUsed: ['tesseract', 'google-vision'],
          },
        },
      };

      mockPrisma.ocrResult.create.mockResolvedValue(mockOcrResult as any);

      const result = await ocrService.processFile('file-123', 'user-123', {
        engine: 'tesseract',
      }, {
        enabled: true,
        primaryEngine: 'tesseract',
        fallbackEngine: 'google-vision',
        confidenceThreshold: 0.7,
        fallbackConditions: {
          lowConfidence: true,
          processingError: true,
          emptyResult: true,
        },
      });

      expect(result.engine).toBe('google-vision');
      expect(result.confidence).toBe(0.95);
      expect(mockWorker.recognize).toHaveBeenCalled();
      expect(mockVisionClient.textDetection).toHaveBeenCalled();
      expect(result.metadata.fallback.enginesUsed).toEqual(['tesseract', 'google-vision']);
    });

    it('should fallback when primary engine fails with error', async () => {
      // Mock Tesseract failure
      mockWorker.recognize.mockRejectedValue(new Error('Tesseract processing failed'));

      // Mock successful Google Vision result
      const mockGoogleVisionResponse = [
        {
          textAnnotations: [
            { description: 'Fallback success text', confidence: 0.88 },
            { description: 'Fallback', confidence: 0.9 },
            { description: 'success', confidence: 0.86 },
            { description: 'text', confidence: 0.88 },
          ],
        },
      ];

      mockVisionClient.textDetection.mockResolvedValue(mockGoogleVisionResponse as any);

      const mockOcrResult = {
        id: 'ocr-result-123',
        text: 'Fallback success text',
        confidence: 0.88,
        engine: 'google-vision',
        metadata: {
          fallback: {
            attempts: [
              {
                engine: 'tesseract',
                confidence: 0,
                success: false,
                error: 'Tesseract processing failed',
              },
              {
                engine: 'google-vision',
                confidence: 0.88,
                success: true,
              },
            ],
            enginesUsed: ['tesseract', 'google-vision'],
          },
        },
      };

      mockPrisma.ocrResult.create.mockResolvedValue(mockOcrResult as any);

      const result = await ocrService.processFile('file-123', 'user-123', {
        engine: 'tesseract',
      }, {
        enabled: true,
        primaryEngine: 'tesseract',
        fallbackEngine: 'google-vision',
        confidenceThreshold: 0.7,
        fallbackConditions: {
          processingError: true,
          lowConfidence: false,
          emptyResult: false,
        },
      });

      expect(result.engine).toBe('google-vision');
      expect(result.confidence).toBe(0.88);
      expect(result.metadata.fallback.attempts[0].success).toBe(false);
      expect(result.metadata.fallback.attempts[1].success).toBe(true);
    });

    it('should fallback when primary engine returns empty result', async () => {
      // Mock Tesseract returning empty text
      mockWorker.recognize.mockResolvedValue({
        data: {
          text: '',
          confidence: 80,
        },
      });

      // Mock Google Vision with actual text
      const mockGoogleVisionResponse = [
        {
          textAnnotations: [
            { description: 'Recovered text content', confidence: 0.85 },
            { description: 'Recovered', confidence: 0.87 },
            { description: 'text', confidence: 0.83 },
            { description: 'content', confidence: 0.85 },
          ],
        },
      ];

      mockVisionClient.textDetection.mockResolvedValue(mockGoogleVisionResponse as any);

      const mockOcrResult = {
        id: 'ocr-result-123',
        text: 'Recovered text content',
        confidence: 0.85,
        engine: 'google-vision',
      };

      mockPrisma.ocrResult.create.mockResolvedValue(mockOcrResult as any);

      const result = await ocrService.processFile('file-123', 'user-123', {
        engine: 'tesseract',
      }, {
        enabled: true,
        primaryEngine: 'tesseract',
        fallbackEngine: 'google-vision',
        confidenceThreshold: 0.7,
        fallbackConditions: {
          emptyResult: true,
          lowConfidence: false,
          processingError: false,
        },
      });

      expect(result.engine).toBe('google-vision');
      expect(result.text).toBe('Recovered text content');
    });

    it('should disable fallback when explicitly configured', async () => {
      // Mock low confidence Tesseract result
      mockWorker.recognize.mockResolvedValue({
        data: {
          text: 'Low confidence text',
          confidence: 40,
        },
      });

      const mockOcrResult = {
        id: 'ocr-result-123',
        text: 'Low confidence text',
        confidence: 0.4,
        engine: 'tesseract',
      };

      mockPrisma.ocrResult.create.mockResolvedValue(mockOcrResult as any);

      const result = await ocrService.processFile('file-123', 'user-123', {
        engine: 'tesseract',
        validation: { minConfidence: 0.3 }, // Lower threshold to allow low confidence
      }, {
        enabled: false, // Disable fallback
      });

      expect(result.engine).toBe('tesseract');
      expect(result.confidence).toBe(0.4);
      expect(mockVisionClient.textDetection).not.toHaveBeenCalled();
    });

    it('should select best result when both engines succeed', async () => {
      // Mock moderate confidence Tesseract result
      mockWorker.recognize.mockResolvedValue({
        data: {
          text: 'Tesseract result',
          confidence: 75,
        },
      });

      // Mock higher confidence Google Vision result
      const mockGoogleVisionResponse = [
        {
          textAnnotations: [
            { description: 'Google Vision result with higher confidence', confidence: 0.92 },
            { description: 'Google', confidence: 0.94 },
            { description: 'Vision', confidence: 0.90 },
            { description: 'result', confidence: 0.92 },
          ],
        },
      ];

      mockVisionClient.textDetection.mockResolvedValue(mockGoogleVisionResponse as any);

      const mockOcrResult = {
        id: 'ocr-result-123',
        text: 'Google Vision result with higher confidence',
        confidence: 0.92,
        engine: 'google-vision',
      };

      mockPrisma.ocrResult.create.mockResolvedValue(mockOcrResult as any);

      const result = await ocrService.processFile('file-123', 'user-123', {
        engine: 'tesseract',
      }, {
        enabled: true,
        primaryEngine: 'tesseract',
        fallbackEngine: 'google-vision',
        confidenceThreshold: 0.8, // Both results trigger fallback
        fallbackConditions: {
          lowConfidence: true,
          processingError: true,
          emptyResult: true,
        },
      });

      // Should select Google Vision result due to higher confidence
      expect(result.engine).toBe('google-vision');
      expect(result.confidence).toBe(0.92);
    });
  });
});
