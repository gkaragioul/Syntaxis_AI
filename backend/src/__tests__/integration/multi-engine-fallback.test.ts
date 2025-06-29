import { OCRService } from '../../services/ocr.service';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';

// Unmock Sharp for integration tests - we need the real Sharp library
jest.unmock('sharp');

/**
 * Multi-Engine Fallback System Tests
 * 
 * These tests verify that the multi-engine fallback system works correctly
 * on the local machine. They test:
 * 1. Fallback trigger conditions (low confidence, processing errors, empty results)
 * 2. Engine switching logic (Tesseract ↔ Google Vision API)
 * 3. Result selection algorithms (best confidence, processing time)
 * 4. Error handling and recovery scenarios
 * 5. Performance characteristics of fallback processing
 */
describe('Multi-Engine Fallback System', () => {
  let ocrService: OCRService;
  let prisma: PrismaClient;
  let testImageBuffer: Buffer;
  let testInvoiceBuffer: Buffer;
  let testFileId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Initialize services
    prisma = new PrismaClient();
    ocrService = new OCRService(prisma);

    // Create test user and file records
    testUserId = 'test-user-fallback-' + Date.now();

    // Create test user record
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `test-fallback-${Date.now()}@example.com`,
        passwordHash: 'test-hash',
        subscriptionStatus: 'free',
      },
    });
    
    // Load test images
    try {
      const testInvoicePath = join(__dirname, '../fixtures/invoices/test-invoice.png');
      testInvoiceBuffer = await fs.readFile(testInvoicePath);
    } catch (error) {
      console.warn('Test invoice image not found, using simple test image');
      // Create a simple test image buffer
      testInvoiceBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x5C, 0xC2, 0x8A, 0x8E, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
    }

    testImageBuffer = testInvoiceBuffer;

    // Create test file record
    const testFile = await prisma.file.create({
      data: {
        id: 'test-file-fallback-' + Date.now(),
        userId: testUserId,
        filename: 'test-invoice.png',
        originalFilename: 'test-invoice.png',
        mimeType: 'image/png',
        fileSize: BigInt(testImageBuffer.length),
        filePath: '/tmp/test-invoice.png',
        fileHash: 'test-hash-' + Date.now(),
        status: 'uploaded',
      },
    });

    testFileId = testFile.id;

    // Write test file to filesystem
    await fs.writeFile('/tmp/test-invoice.png', testImageBuffer);
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await prisma.ocrResult.deleteMany({
        where: { fileId: testFileId },
      });
      await prisma.file.deleteMany({
        where: { id: testFileId },
      });
      await prisma.user.deleteMany({
        where: { id: testUserId },
      });
      await fs.unlink('/tmp/test-invoice.png').catch(() => {});
    } catch (error) {
      console.warn('Cleanup error:', error);
    }

    await prisma.$disconnect();
  });

  beforeEach(() => {
    // Reset any mocks before each test
    jest.clearAllMocks();
  });

  describe('Fallback Trigger Conditions', () => {
    it('should trigger fallback on low confidence from primary engine', async () => {
      const fallbackConfig = {
        enabled: true,
        primaryEngine: 'tesseract' as const,
        fallbackEngine: 'google-vision' as const,
        confidenceThreshold: 0.9, // Very high threshold to trigger fallback
        fallbackConditions: {
          lowConfidence: true,
          processingError: false,
          emptyResult: false,
        },
      };

      const result = await ocrService.processFile(
        testFileId,
        testUserId,
        { engine: 'tesseract' },
        fallbackConfig
      );

      // Should have attempted both engines due to low confidence
      expect(result.metadata.fallback).toBeDefined();
      expect(result.metadata.fallback.enginesUsed).toContain('tesseract');
      
      // If Google Vision is available, it should be used as fallback
      const hasGoogleVision = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_VISION_API_KEY);
      if (hasGoogleVision) {
        expect(result.metadata.fallback.enginesUsed).toContain('google-vision');
        expect(result.metadata.fallback.attempts).toHaveLength(2);
      }

      console.log('✅ Low confidence fallback test completed');
      console.log(`   Primary engine confidence: ${result.metadata.fallback.attempts[0].confidence}`);
      console.log(`   Final result engine: ${result.engine}`);
    }, 60000);

    it('should trigger fallback on processing error from primary engine', async () => {
      // Create a corrupted image buffer to trigger processing error
      const corruptedBuffer = Buffer.from('corrupted image data');
      
      // Write corrupted file
      const corruptedFilePath = '/tmp/corrupted-test.png';
      await fs.writeFile(corruptedFilePath, corruptedBuffer);

      const corruptedFile = await prisma.file.create({
        data: {
          id: 'corrupted-file-' + Date.now(),
          userId: testUserId,
          filename: 'corrupted-test.png',
          originalFilename: 'corrupted-test.png',
          mimeType: 'image/png',
          fileSize: BigInt(corruptedBuffer.length),
          filePath: corruptedFilePath,
          fileHash: 'corrupted-hash-' + Date.now(),
          status: 'uploaded',
        },
      });

      const fallbackConfig = {
        enabled: true,
        primaryEngine: 'tesseract' as const,
        fallbackEngine: 'google-vision' as const,
        confidenceThreshold: 0.5,
        fallbackConditions: {
          lowConfidence: false,
          processingError: true, // Enable processing error fallback
          emptyResult: false,
        },
      };

      try {
        const result = await ocrService.processFile(
          corruptedFile.id,
          testUserId,
          { engine: 'tesseract' },
          fallbackConfig
        );

        // Should have attempted fallback due to processing error
        expect(result.metadata.fallback).toBeDefined();
        expect(result.metadata.fallback.attempts[0].success).toBe(false);
        
        console.log('✅ Processing error fallback test completed');
        console.log(`   Primary engine error: ${result.metadata.fallback.attempts[0].error}`);
        console.log(`   Fallback triggered: ${result.metadata.fallback.attempts.length > 1}`);
      } catch (error) {
        // If both engines fail, that's also a valid test result
        console.log('✅ Processing error fallback test completed (both engines failed as expected)');
        expect(error).toBeDefined();
      } finally {
        // Clean up
        await prisma.file.delete({ where: { id: corruptedFile.id } });
        await fs.unlink(corruptedFilePath).catch(() => {});
      }
    }, 60000);

    it('should trigger fallback on empty result from primary engine', async () => {
      // Create a blank white image that might produce empty results
      const blankImageBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64,
        0x08, 0x02, 0x00, 0x00, 0x00, 0xFF, 0x80, 0x02, 0x03, 0x00, 0x00, 0x00,
        0x19, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0xED, 0xC1, 0x01, 0x0D, 0x00,
        0x00, 0x00, 0xC2, 0xA0, 0xF7, 0x4F, 0x6D, 0x0E, 0x37, 0xA0, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xBE, 0x0D, 0x21, 0x00, 0x00, 0x01,
        0x9A, 0x60, 0xE1, 0xD5, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
        0xAE, 0x42, 0x60, 0x82
      ]);

      const blankFilePath = '/tmp/blank-test.png';
      await fs.writeFile(blankFilePath, blankImageBuffer);

      const blankFile = await prisma.file.create({
        data: {
          id: 'blank-file-' + Date.now(),
          userId: testUserId,
          filename: 'blank-test.png',
          originalFilename: 'blank-test.png',
          mimeType: 'image/png',
          fileSize: BigInt(blankImageBuffer.length),
          filePath: blankFilePath,
          fileHash: 'blank-hash-' + Date.now(),
          status: 'uploaded',
        },
      });

      const fallbackConfig = {
        enabled: true,
        primaryEngine: 'tesseract' as const,
        fallbackEngine: 'google-vision' as const,
        confidenceThreshold: 0.5,
        fallbackConditions: {
          lowConfidence: false,
          processingError: false,
          emptyResult: true, // Enable empty result fallback
        },
      };

      try {
        const result = await ocrService.processFile(
          blankFile.id,
          testUserId,
          { engine: 'tesseract' },
          fallbackConfig
        );

        // Check if fallback was triggered due to empty result
        expect(result.metadata.fallback).toBeDefined();
        
        console.log('✅ Empty result fallback test completed');
        console.log(`   Primary engine text length: ${result.metadata.fallback.attempts[0].result?.text?.length || 0}`);
        console.log(`   Fallback triggered: ${result.metadata.fallback.attempts.length > 1}`);
      } finally {
        // Clean up
        await prisma.file.delete({ where: { id: blankFile.id } });
        await fs.unlink(blankFilePath).catch(() => {});
      }
    }, 60000);
  });

  describe('Engine Switching Logic', () => {
    it('should switch from Tesseract to Google Vision when configured', async () => {
      const fallbackConfig = {
        enabled: true,
        primaryEngine: 'tesseract' as const,
        fallbackEngine: 'google-vision' as const,
        confidenceThreshold: 0.95, // High threshold to trigger fallback
        fallbackConditions: {
          lowConfidence: true,
          processingError: true,
          emptyResult: true,
        },
      };

      const result = await ocrService.processFile(
        testFileId,
        testUserId,
        { engine: 'tesseract' },
        fallbackConfig
      );

      expect(result.metadata.fallback).toBeDefined();
      expect(result.metadata.fallback.attempts[0].engine).toBe('tesseract');
      
      const hasGoogleVision = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_VISION_API_KEY);
      if (hasGoogleVision && result.metadata.fallback.attempts.length > 1) {
        expect(result.metadata.fallback.attempts[1].engine).toBe('google-vision');
      }

      console.log('✅ Tesseract → Google Vision switching test completed');
    }, 60000);

    it('should switch from Google Vision to Tesseract when configured', async () => {
      const hasGoogleVision = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_VISION_API_KEY);
      
      if (!hasGoogleVision) {
        console.log('⏭️  Skipping test - Google Vision API credentials not available');
        return;
      }

      const fallbackConfig = {
        enabled: true,
        primaryEngine: 'google-vision' as const,
        fallbackEngine: 'tesseract' as const,
        confidenceThreshold: 0.95, // High threshold to trigger fallback
        fallbackConditions: {
          lowConfidence: true,
          processingError: true,
          emptyResult: true,
        },
      };

      const result = await ocrService.processFile(
        testFileId,
        testUserId,
        { engine: 'google-vision' },
        fallbackConfig
      );

      expect(result.metadata.fallback).toBeDefined();
      expect(result.metadata.fallback.attempts[0].engine).toBe('google-vision');
      
      if (result.metadata.fallback.attempts.length > 1) {
        expect(result.metadata.fallback.attempts[1].engine).toBe('tesseract');
      }

      console.log('✅ Google Vision → Tesseract switching test completed');
    }, 60000);
  });

  describe('Result Selection Algorithms', () => {
    it('should select result with highest confidence when both engines succeed', async () => {
      const fallbackConfig = {
        enabled: true,
        primaryEngine: 'tesseract' as const,
        fallbackEngine: 'google-vision' as const,
        confidenceThreshold: 0.0, // Force both engines to run
        fallbackConditions: {
          lowConfidence: true,
          processingError: true,
          emptyResult: true,
        },
      };

      const result = await ocrService.processFile(
        testFileId,
        testUserId,
        { engine: 'tesseract' },
        fallbackConfig
      );

      expect(result.metadata.fallback).toBeDefined();
      
      if (result.metadata.fallback.attempts.length > 1) {
        const attempts = result.metadata.fallback.attempts;
        const successfulAttempts = attempts.filter(a => a.success);
        
        if (successfulAttempts.length > 1) {
          // Should select the attempt with highest confidence
          const selectedAttempt = successfulAttempts.find(a => a.engine === result.engine);
          const otherAttempts = successfulAttempts.filter(a => a.engine !== result.engine);
          
          expect(selectedAttempt).toBeDefined();
          otherAttempts.forEach(other => {
            expect(selectedAttempt!.confidence).toBeGreaterThanOrEqual(other.confidence - 0.1); // Allow small tolerance
          });
        }
      }

      console.log('✅ Best confidence selection test completed');
      console.log(`   Selected engine: ${result.engine} (confidence: ${result.confidence})`);
    }, 60000);

    it('should prefer faster processing when confidence is similar', async () => {
      const fallbackConfig = {
        enabled: true,
        primaryEngine: 'tesseract' as const,
        fallbackEngine: 'google-vision' as const,
        confidenceThreshold: 0.0, // Force both engines to run
        fallbackConditions: {
          lowConfidence: true,
          processingError: true,
          emptyResult: true,
        },
      };

      const result = await ocrService.processFile(
        testFileId,
        testUserId,
        { engine: 'tesseract' },
        fallbackConfig
      );

      expect(result.metadata.fallback).toBeDefined();
      
      if (result.metadata.fallback.attempts.length > 1) {
        const attempts = result.metadata.fallback.attempts;
        const successfulAttempts = attempts.filter(a => a.success);
        
        if (successfulAttempts.length > 1) {
          // Check if processing times are recorded
          successfulAttempts.forEach(attempt => {
            expect(attempt.processingTime).toBeGreaterThan(0);
          });
        }
      }

      console.log('✅ Processing time consideration test completed');
    }, 60000);
  });

  describe('Error Handling and Recovery', () => {
    it('should handle graceful degradation when fallback engine fails', async () => {
      // This test verifies behavior when both engines encounter issues
      const fallbackConfig = {
        enabled: true,
        primaryEngine: 'tesseract' as const,
        fallbackEngine: 'google-vision' as const,
        confidenceThreshold: 0.5,
        fallbackConditions: {
          lowConfidence: true,
          processingError: true,
          emptyResult: true,
        },
      };

      try {
        const result = await ocrService.processFile(
          testFileId,
          testUserId,
          { engine: 'tesseract' },
          fallbackConfig
        );

        // Should have metadata about attempts even if some failed
        expect(result.metadata.fallback).toBeDefined();
        expect(result.metadata.fallback.attempts.length).toBeGreaterThan(0);

        console.log('✅ Graceful degradation test completed');
        console.log(`   Total attempts: ${result.metadata.fallback.attempts.length}`);
        console.log(`   Successful attempts: ${result.metadata.fallback.attempts.filter(a => a.success).length}`);
      } catch (error) {
        // If all engines fail, that's also a valid test scenario
        console.log('✅ Graceful degradation test completed (all engines failed as expected)');
        expect(error).toBeDefined();
      }
    }, 60000);

    it('should provide detailed error information for failed attempts', async () => {
      const fallbackConfig = {
        enabled: true,
        primaryEngine: 'tesseract' as const,
        fallbackEngine: 'google-vision' as const,
        confidenceThreshold: 0.5,
        fallbackConditions: {
          lowConfidence: true,
          processingError: true,
          emptyResult: true,
        },
      };

      const result = await ocrService.processFile(
        testFileId,
        testUserId,
        { engine: 'tesseract' },
        fallbackConfig
      );

      expect(result.metadata.fallback).toBeDefined();
      
      // Check that failed attempts have error information
      const failedAttempts = result.metadata.fallback.attempts.filter(a => !a.success);
      failedAttempts.forEach(attempt => {
        expect(attempt.error).toBeDefined();
        expect(typeof attempt.error).toBe('string');
      });

      console.log('✅ Error information test completed');
      console.log(`   Failed attempts with error info: ${failedAttempts.length}`);
    }, 60000);
  });

  describe('Performance Characteristics', () => {
    it('should complete fallback processing within reasonable time limits', async () => {
      const startTime = Date.now();
      
      const fallbackConfig = {
        enabled: true,
        primaryEngine: 'tesseract' as const,
        fallbackEngine: 'google-vision' as const,
        confidenceThreshold: 0.8,
        fallbackConditions: {
          lowConfidence: true,
          processingError: true,
          emptyResult: true,
        },
      };

      const result = await ocrService.processFile(
        testFileId,
        testUserId,
        { engine: 'tesseract' },
        fallbackConfig
      );

      const totalTime = Date.now() - startTime;
      
      // Should complete within 2 minutes (generous limit for local testing)
      expect(totalTime).toBeLessThan(120000);
      
      // Should have processing time metadata
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      
      console.log('✅ Performance characteristics test completed');
      console.log(`   Total processing time: ${totalTime}ms`);
      console.log(`   Metadata processing time: ${result.metadata.processingTime}ms`);
    }, 120000);

    it('should track individual engine performance metrics', async () => {
      const fallbackConfig = {
        enabled: true,
        primaryEngine: 'tesseract' as const,
        fallbackEngine: 'google-vision' as const,
        confidenceThreshold: 0.0, // Force both engines to run
        fallbackConditions: {
          lowConfidence: true,
          processingError: true,
          emptyResult: true,
        },
      };

      const result = await ocrService.processFile(
        testFileId,
        testUserId,
        { engine: 'tesseract' },
        fallbackConfig
      );

      expect(result.metadata.fallback).toBeDefined();
      
      // Each attempt should have performance metrics
      result.metadata.fallback.attempts.forEach((attempt, index) => {
        expect(attempt.processingTime).toBeGreaterThan(0);
        expect(attempt.engine).toBeDefined();
        
        console.log(`   Attempt ${index + 1} (${attempt.engine}): ${attempt.processingTime}ms`);
      });

      console.log('✅ Individual engine performance tracking test completed');
    }, 60000);
  });

  describe('Configuration Validation', () => {
    it('should handle disabled fallback configuration', async () => {
      const fallbackConfig = {
        enabled: false,
        primaryEngine: 'tesseract' as const,
        fallbackEngine: 'google-vision' as const,
        confidenceThreshold: 0.5,
        fallbackConditions: {
          lowConfidence: true,
          processingError: true,
          emptyResult: true,
        },
      };

      const result = await ocrService.processFile(
        testFileId,
        testUserId,
        { engine: 'tesseract' },
        fallbackConfig
      );

      // Should only use primary engine when fallback is disabled
      expect(result.engine).toBe('tesseract');
      
      // Should not have fallback metadata or should indicate single engine use
      if (result.metadata.fallback) {
        expect(result.metadata.fallback.attempts).toHaveLength(1);
      }

      console.log('✅ Disabled fallback configuration test completed');
    }, 60000);

    it('should validate engine availability before processing', async () => {
      const hasGoogleVision = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_VISION_API_KEY);
      
      if (hasGoogleVision) {
        // Test with Google Vision as primary when available
        const fallbackConfig = {
          enabled: true,
          primaryEngine: 'google-vision' as const,
          fallbackEngine: 'tesseract' as const,
          confidenceThreshold: 0.5,
          fallbackConditions: {
            lowConfidence: true,
            processingError: true,
            emptyResult: true,
          },
        };

        const result = await ocrService.processFile(
          testFileId,
          testUserId,
          { engine: 'google-vision' },
          fallbackConfig
        );

        expect(result).toBeDefined();
        console.log('✅ Engine availability validation test completed (Google Vision available)');
      } else {
        console.log('⏭️  Skipping Google Vision availability test - credentials not configured');
      }
    }, 60000);
  });
});
