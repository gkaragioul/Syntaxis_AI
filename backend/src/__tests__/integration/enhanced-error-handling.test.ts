import { 
  OCRError, 
  OCREngineError, 
  OCRPreprocessingError, 
  OCRConfidenceError, 
  OCRValidationError, 
  OCRFallbackError,
  EnhancedErrorHandler,
  ErrorUtils
} from '../../utils/enhanced-errors';
import { OCRService } from '../../services/ocr.service';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';
import { jest } from '@jest/globals';

const TEST_TIMEOUT = 30000;

describe('Enhanced Error Handling for OCR', () => {
  let ocrService: OCRService;
  let prisma: PrismaClient;
  let testUserId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_TEST_URL || process.env.DATABASE_URL,
        },
      },
    });

    ocrService = new OCRService(prisma);

    // Create test user
    testUserId = 'test-user-error-' + Date.now();
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `test-error-${Date.now()}@example.com`,
        passwordHash: 'test-password-hash',
      },
    });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    await prisma.$disconnect();
  });

  async function cleanupTestData() {
    try {
      await prisma.ocrResult.deleteMany({ where: { userId: testUserId } });
      await prisma.file.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  describe('OCR Error Types', () => {
    it('should create OCREngineError with correct properties', () => {
      const error = new OCREngineError('tesseract', 'Engine initialization failed');
      
      expect(error).toBeInstanceOf(OCRError);
      expect(error.name).toBe('OCRError');
      expect(error.code).toBe('OCR_ENGINE_ERROR');
      expect(error.engine).toBe('tesseract');
      expect(error.recoverable).toBe(true);
      expect(error.retryable).toBe(true);
      expect(error.message).toContain('tesseract');
      expect(error.message).toContain('Engine initialization failed');
    });

    it('should create OCRPreprocessingError with correct properties', () => {
      const error = new OCRPreprocessingError('deskew', 'Failed to deskew image');
      
      expect(error.code).toBe('OCR_PREPROCESSING_ERROR');
      expect(error.metadata?.preprocessingStep).toBe('deskew');
      expect(error.recoverable).toBe(true);
      expect(error.retryable).toBe(false);
    });

    it('should create OCRConfidenceError with correct properties', () => {
      const error = new OCRConfidenceError(0.6, 0.8, 'tesseract');
      
      expect(error.code).toBe('OCR_LOW_CONFIDENCE');
      expect(error.confidence).toBe(0.6);
      expect(error.engine).toBe('tesseract');
      expect(error.metadata?.requiredConfidence).toBe(0.8);
    });

    it('should create OCRValidationError with correct properties', () => {
      const error = new OCRValidationError('invoiceNumber', 'INV-123', 'Invalid format');
      
      expect(error.code).toBe('OCR_VALIDATION_ERROR');
      expect(error.metadata?.field).toBe('invoiceNumber');
      expect(error.metadata?.value).toBe('INV-123');
      expect(error.metadata?.reason).toBe('Invalid format');
      expect(error.recoverable).toBe(false);
      expect(error.retryable).toBe(false);
    });

    it('should create OCRFallbackError with correct properties', () => {
      const errors = [
        new Error('Tesseract failed'),
        new Error('Google Vision failed'),
      ];
      const error = new OCRFallbackError('tesseract', 'google-vision', errors);
      
      expect(error.code).toBe('OCR_FALLBACK_EXHAUSTED');
      expect(error.metadata?.primaryEngine).toBe('tesseract');
      expect(error.metadata?.fallbackEngine).toBe('google-vision');
      expect(error.metadata?.errors).toHaveLength(2);
      expect(error.recoverable).toBe(false);
      expect(error.retryable).toBe(false);
    });
  });

  describe('Enhanced Error Handler', () => {
    it('should handle retryable OCR errors correctly', async () => {
      const error = new OCREngineError('tesseract', 'Temporary failure');
      const context = {
        fileId: 'test-file-123',
        userId: testUserId,
        engine: 'tesseract',
        attempt: 1,
        maxAttempts: 3,
      };

      const result = await EnhancedErrorHandler.handleOCRError(error, context);

      expect(result.shouldRetry).toBe(true);
      expect(result.shouldFallback).toBe(false);
      expect(result.delay).toBe(1000); // First retry delay
      expect(result.userMessage).toContain('tesseract');
      expect(result.logData.errorCode).toBe('OCR_ENGINE_ERROR');
    });

    it('should handle fallback scenarios correctly', async () => {
      const error = new OCRConfidenceError(0.5, 0.8, 'tesseract');
      const context = {
        fileId: 'test-file-123',
        userId: testUserId,
        engine: 'tesseract',
        attempt: 3, // Max attempts reached
        maxAttempts: 3,
      };

      const result = await EnhancedErrorHandler.handleOCRError(error, context);

      expect(result.shouldRetry).toBe(false);
      expect(result.shouldFallback).toBe(true);
      expect(result.fallbackEngine).toBe('google-vision');
      expect(result.userMessage).toContain('confidence');
    });

    it('should handle non-recoverable errors correctly', async () => {
      const error = new OCRValidationError('amount', '123abc', 'Invalid number format');
      const context = {
        fileId: 'test-file-123',
        userId: testUserId,
        engine: 'tesseract',
        attempt: 1,
      };

      const result = await EnhancedErrorHandler.handleOCRError(error, context);

      expect(result.shouldRetry).toBe(false);
      expect(result.shouldFallback).toBe(false);
      expect(result.userMessage).toContain('validation');
    });

    it('should handle non-OCR errors with default strategy', async () => {
      const error = new Error('Network timeout');
      const context = {
        fileId: 'test-file-123',
        userId: testUserId,
        engine: 'tesseract',
        attempt: 1,
      };

      const result = await EnhancedErrorHandler.handleOCRError(error, context);

      expect(result.shouldRetry).toBe(true);
      expect(result.shouldFallback).toBe(false);
      expect(result.userMessage).toContain('unexpected error');
    });

    it('should generate appropriate user messages', () => {
      const testCases = [
        {
          error: new OCREngineError('tesseract', 'Failed'),
          expectedContent: 'tesseract OCR engine',
        },
        {
          error: new OCRPreprocessingError('deskew', 'Failed'),
          expectedContent: 'preparing your document',
        },
        {
          error: new OCRConfidenceError(0.5, 0.8, 'tesseract'),
          expectedContent: 'confidence',
        },
        {
          error: new OCRValidationError('amount', '123', 'Invalid'),
          expectedContent: 'validated',
        },
        {
          error: new OCRFallbackError('tesseract', 'google-vision', []),
          expectedContent: 'multiple OCR engines',
        },
      ];

      testCases.forEach(({ error, expectedContent }) => {
        const message = (EnhancedErrorHandler as any).generateUserMessage(error);
        expect(message.toLowerCase()).toContain(expectedContent.toLowerCase());
      });
    });

    it('should provide recovery suggestions', () => {
      const error = new OCRPreprocessingError('enhance', 'Failed to enhance image');
      const suggestions = EnhancedErrorHandler.getRecoverySuggestions(error);

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.toLowerCase().includes('quality'))).toBe(true);
    });

    it('should track error patterns', () => {
      const error = new OCREngineError('tesseract', 'Test error');
      const context = { fileId: 'test-123', userId: testUserId };

      // This should not throw
      expect(() => {
        EnhancedErrorHandler.trackErrorPattern(error, context);
      }).not.toThrow();
    });
  });

  describe('Error Utilities', () => {
    it('should correctly identify retryable errors', () => {
      const retryableError = new OCREngineError('tesseract', 'Temporary failure');
      const nonRetryableError = new OCRValidationError('field', 'value', 'reason');

      expect(ErrorUtils.isRetryable(retryableError)).toBe(true);
      expect(ErrorUtils.isRetryable(nonRetryableError)).toBe(false);
    });

    it('should correctly identify recoverable errors', () => {
      const recoverableError = new OCRConfidenceError(0.5, 0.8, 'tesseract');
      const nonRecoverableError = new OCRFallbackError('tesseract', 'google-vision', []);

      expect(ErrorUtils.isRecoverable(recoverableError)).toBe(true);
      expect(ErrorUtils.isRecoverable(nonRecoverableError)).toBe(false);
    });

    it('should extract error details correctly', () => {
      const error = new OCREngineError('tesseract', 'Test error');
      const details = ErrorUtils.extractErrorDetails(error);

      expect(details.name).toBe('OCRError');
      expect(details.code).toBe('OCR_ENGINE_ERROR');
      expect(details.engine).toBe('tesseract');
      expect(details.recoverable).toBe(true);
      expect(details.retryable).toBe(true);
      expect(details.message).toContain('Test error');
    });

    it('should handle non-OCR errors in utilities', () => {
      const regularError = new Error('Regular error');
      
      expect(ErrorUtils.isRetryable(regularError)).toBe(false);
      expect(ErrorUtils.isRecoverable(regularError)).toBe(true);
      
      const details = ErrorUtils.extractErrorDetails(regularError);
      expect(details.name).toBe('Error');
      expect(details.message).toBe('Regular error');
      expect(details.code).toBeUndefined();
    });
  });

  describe('Integration with OCR Service', () => {
    it('should handle file not found errors', async () => {
      const nonExistentFileId = 'non-existent-file-' + Date.now();

      await expect(
        ocrService.processFile(nonExistentFileId, testUserId)
      ).rejects.toThrow('File not found');
    });

    it('should handle unauthorized access errors', async () => {
      // Create a file for another user
      const otherUserId = 'other-user-' + Date.now();
      await prisma.user.create({
        data: {
          id: otherUserId,
          email: `other-${Date.now()}@example.com`,
          passwordHash: 'test-password-hash',
        },
      });

      const testContent = Buffer.from('Test content');
      const testFilePath = join(process.cwd(), 'test-unauthorized.txt');
      await fs.writeFile(testFilePath, testContent);

      const fileId = 'test-file-unauthorized-' + Date.now();
      await prisma.file.create({
        data: {
          id: fileId,
          userId: otherUserId,
          filename: 'test-unauthorized.txt',
          originalFilename: 'test-unauthorized.txt',
          filePath: testFilePath,
          fileSize: BigInt(testContent.length),
          mimeType: 'text/plain',
          fileHash: `hash-${fileId}`,
          status: 'uploaded',
        },
      });

      await expect(
        ocrService.processFile(fileId, testUserId)
      ).rejects.toThrow('User does not have access');

      // Cleanup
      await fs.unlink(testFilePath).catch(() => {});
      await prisma.file.delete({ where: { id: fileId } });
      await prisma.user.delete({ where: { id: otherUserId } });
    });
  });
});
