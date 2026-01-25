/**
 * Google Vision API Integration Tests
 * 
 * TDD Phase: RED - Failing tests for Google Vision API integration
 * Task: 2.1 - Google Vision API Integration
 * 
 * These tests define the expected behavior for Google Vision API integration:
 * 1. Proper client initialization and configuration
 * 2. Text detection with confidence scoring
 * 3. Multi-engine fallback system
 * 4. Error handling and retry logic
 * 5. Performance requirements (<200ms API response)
 */

import { OCRService } from '../../services/ocr.service';
import { PrismaClient } from '@prisma/client';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { jest } from '@jest/globals';
import { setupSharpMock, cleanupSharpMock } from '../utils/sharpMockHelper';
import { setupPrismaMock } from '../utils/prismaMockHelper';

// Mock Google Vision API
jest.mock('@google-cloud/vision');

describe('Google Vision API Integration', () => {
  let ocrService: OCRService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockVisionClient: jest.Mocked<ImageAnnotatorClient>;
  let sharpMockFactory: any;

  beforeAll(() => {
    sharpMockFactory = setupSharpMock();
  });

  afterAll(() => {
    cleanupSharpMock();
  });

  beforeEach(() => {
    // Setup mocks
    const prismaMockFactory = setupPrismaMock();
    mockPrisma = prismaMockFactory.mock;
    
    sharpMockFactory.resetMocks();
    sharpMockFactory.setupSuccessfulProcessing();

    // Setup Google Vision client mock
    mockVisionClient = {
      textDetection: jest.fn(),
      close: jest.fn(),
    } as any;

    (ImageAnnotatorClient as jest.MockedClass<typeof ImageAnnotatorClient>).mockImplementation(() => mockVisionClient);

    // Set environment variable for Google Vision
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/credentials.json';

    ocrService = new OCRService(mockPrisma);
    
    // Manually set the vision client for testing
    (ocrService as any).visionClient = mockVisionClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  });

  describe('Client Initialization', () => {
    it('should initialize Google Vision client when credentials are available', async () => {
      // RED: This test should fail initially - we need to verify proper initialization
      expect(ImageAnnotatorClient).toHaveBeenCalled();
      expect((ocrService as any).visionClient).toBeDefined();
    });

    it('should handle missing credentials gracefully', async () => {
      // RED: This test should fail - we need proper credential validation
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      const serviceWithoutCredentials = new OCRService(mockPrisma);
      expect((serviceWithoutCredentials as any).visionClient).toBeNull();
    });

    it('should validate Google Vision API connectivity on initialization', async () => {
      // RED: This test should fail - we need connectivity validation
      const connectivityCheck = jest.fn().mockResolvedValue(true);
      mockVisionClient.textDetection.mockImplementationOnce(connectivityCheck);

      await expect(ocrService.validateGoogleVisionConnectivity()).resolves.toBe(true);
      expect(connectivityCheck).toHaveBeenCalled();
    });
  });

  describe('Text Detection', () => {
    it('should process image with Google Vision API and return structured results', async () => {
      // RED: This test should fail - we need enhanced result structure
      const mockDetections = [
        {
          description: 'Invoice\nCompany: ABC Corp\nAmount: $123.45\nDate: 2024-01-15',
          boundingPoly: { vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }] }
        },
        {
          description: 'Invoice',
          boundingPoly: { vertices: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 20 }, { x: 0, y: 20 }] }
        },
        {
          description: 'Company:',
          boundingPoly: { vertices: [{ x: 0, y: 25 }, { x: 40, y: 25 }, { x: 40, y: 35 }, { x: 0, y: 35 }] }
        },
        {
          description: 'ABC Corp',
          boundingPoly: { vertices: [{ x: 45, y: 25 }, { x: 85, y: 25 }, { x: 85, y: 35 }, { x: 45, y: 35 }] }
        }
      ];

      mockVisionClient.textDetection.mockResolvedValue([{
        textAnnotations: mockDetections
      }]);

      const testBuffer = Buffer.from('test image data');
      const result = await ocrService.processWithGoogleVision(testBuffer);

      expect(result).toEqual({
        text: 'Invoice\nCompany: ABC Corp\nAmount: $123.45\nDate: 2024-01-15',
        confidence: expect.any(Number),
        engine: 'google-vision',
        metadata: {
          processingTime: expect.any(Number),
          preprocessingSteps: [],
          wordCount: 3, // Excluding full text annotation
          confidenceMetrics: {
            overall: expect.any(Number),
            wordLevel: expect.any(Number),
            lineLevel: expect.any(Number),
            blockLevel: expect.any(Number)
          },
          fieldConfidences: expect.any(Object),
          boundingBoxes: expect.any(Array)
        }
      });

      expect(mockVisionClient.textDetection).toHaveBeenCalledWith({
        image: { content: testBuffer }
      });
    });

    it('should handle empty detection results gracefully', async () => {
      // RED: This test should fail - we need proper empty result handling
      mockVisionClient.textDetection.mockResolvedValue([{
        textAnnotations: []
      }]);

      const testBuffer = Buffer.from('empty image');
      const result = await ocrService.processWithGoogleVision(testBuffer);

      expect(result).toEqual({
        text: '',
        confidence: 0,
        engine: 'google-vision',
        metadata: {
          processingTime: expect.any(Number),
          preprocessingSteps: [],
          wordCount: 0,
          confidenceMetrics: {
            overall: 0,
            wordLevel: 0,
            lineLevel: 0,
            blockLevel: 0
          },
          fieldConfidences: {},
          boundingBoxes: []
        }
      });
    });

    it('should extract field-specific confidence scores', async () => {
      // RED: This test should fail - we need field confidence extraction
      const mockDetections = [
        { description: 'Invoice Total: $123.45', boundingPoly: { vertices: [] } },
        { description: 'Invoice', boundingPoly: { vertices: [] } },
        { description: 'Total:', boundingPoly: { vertices: [] } },
        { description: '$123.45', boundingPoly: { vertices: [] } }
      ];

      mockVisionClient.textDetection.mockResolvedValue([{
        textAnnotations: mockDetections
      }]);

      const testBuffer = Buffer.from('invoice image');
      const result = await ocrService.processWithGoogleVision(testBuffer);

      expect(result.metadata.fieldConfidences).toEqual({
        'total': expect.any(Number),
        'amount': expect.any(Number),
        'currency': expect.any(Number)
      });
    });
  });

  describe('Multi-Engine Fallback System', () => {
    it('should fallback to Tesseract when Google Vision fails', async () => {
      // RED: This test should fail - we need proper fallback implementation
      mockVisionClient.textDetection.mockRejectedValue(new Error('Google Vision API error'));

      const testBuffer = Buffer.from('test image');
      const config = {
        engine: 'google-vision' as const,
        fallback: {
          enabled: true,
          fallbackEngine: 'tesseract' as const,
          confidenceThreshold: 0.7
        }
      };

      const result = await ocrService.processWithFallback(testBuffer, config);

      expect(result.engine).toBe('tesseract');
      expect(result.fallbackUsed).toBe(true);
      expect(result.attempts).toHaveLength(2);
      expect(result.attempts[0].engine).toBe('google-vision');
      expect(result.attempts[0].error).toBeDefined();
      expect(result.attempts[1].engine).toBe('tesseract');
      expect(result.attempts[1].result).toBeDefined();
    });

    it('should fallback when Google Vision confidence is below threshold', async () => {
      // RED: This test should fail - we need confidence-based fallback
      mockVisionClient.textDetection.mockResolvedValue([{
        textAnnotations: [
          { description: 'Low quality text', boundingPoly: { vertices: [] } }
        ]
      }]);

      const testBuffer = Buffer.from('low quality image');
      const config = {
        engine: 'google-vision' as const,
        fallback: {
          enabled: true,
          fallbackEngine: 'tesseract' as const,
          confidenceThreshold: 0.8
        }
      };

      const result = await ocrService.processWithFallback(testBuffer, config);

      expect(result.fallbackUsed).toBe(true);
      expect(result.attempts[0].confidence).toBeLessThan(0.8);
      expect(result.attempts[1].engine).toBe('tesseract');
    });

    it('should use Google Vision as fallback for Tesseract failures', async () => {
      // RED: This test should fail - we need bidirectional fallback
      const testBuffer = Buffer.from('complex image');
      const config = {
        engine: 'tesseract' as const,
        fallback: {
          enabled: true,
          fallbackEngine: 'google-vision' as const,
          confidenceThreshold: 0.7
        }
      };

      // Mock Tesseract failure (this would be handled by existing mocks)
      mockVisionClient.textDetection.mockResolvedValue([{
        textAnnotations: [
          { description: 'High quality Google Vision result', boundingPoly: { vertices: [] } }
        ]
      }]);

      const result = await ocrService.processWithFallback(testBuffer, config);

      expect(result.fallbackUsed).toBe(true);
      expect(result.attempts[1].engine).toBe('google-vision');
      expect(result.attempts[1].confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Performance Requirements', () => {
    it('should complete Google Vision API calls within 200ms', async () => {
      // RED: This test should fail - we need performance optimization
      mockVisionClient.textDetection.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve([{ textAnnotations: [{ description: 'Fast result' }] }]), 50);
        })
      );

      const testBuffer = Buffer.from('performance test image');
      const startTime = Date.now();
      
      await ocrService.processWithGoogleVision(testBuffer);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(200);
    });

    it('should timeout Google Vision API calls after 5 seconds', async () => {
      // RED: This test should fail - we need timeout implementation
      mockVisionClient.textDetection.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve([{ textAnnotations: [] }]), 6000);
        })
      );

      const testBuffer = Buffer.from('timeout test image');
      
      await expect(ocrService.processWithGoogleVision(testBuffer))
        .rejects.toThrow('Google Vision API timeout');
    });
  });

  describe('Error Handling', () => {
    it('should handle Google Vision API rate limiting', async () => {
      // RED: This test should fail - we need rate limiting handling
      const rateLimitError = new Error('Quota exceeded');
      (rateLimitError as any).code = 8; // RESOURCE_EXHAUSTED
      
      mockVisionClient.textDetection.mockRejectedValue(rateLimitError);

      const testBuffer = Buffer.from('rate limit test');
      
      await expect(ocrService.processWithGoogleVision(testBuffer))
        .rejects.toThrow('Google Vision API rate limit exceeded');
    });

    it('should handle Google Vision API authentication errors', async () => {
      // RED: This test should fail - we need auth error handling
      const authError = new Error('Authentication failed');
      (authError as any).code = 16; // UNAUTHENTICATED
      
      mockVisionClient.textDetection.mockRejectedValue(authError);

      const testBuffer = Buffer.from('auth test');
      
      await expect(ocrService.processWithGoogleVision(testBuffer))
        .rejects.toThrow('Google Vision API authentication failed');
    });
  });
});
