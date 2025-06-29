import { StorageService, FileMetadata } from '../../services/StorageService';
import { OCRService } from '../../services/ocr.service';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';
import { jest } from '@jest/globals';

const TEST_TIMEOUT = 30000;

describe('Enhanced Storage Integration with OCR', () => {
  let storageService: StorageService;
  let ocrService: OCRService;
  let prisma: PrismaClient;
  let testDirectory: string;
  let testUserId: string;

  beforeAll(async () => {
    // Setup test directory
    testDirectory = join(process.cwd(), 'test-storage-' + Date.now());
    
    // Initialize services
    storageService = new StorageService({
      directory: testDirectory,
      enableMetadata: true,
      metadataDirectory: join(testDirectory, 'metadata'),
      allowedTypes: ['text/plain', 'application/pdf', 'image/jpeg', 'image/png'],
    });

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_TEST_URL || process.env.DATABASE_URL,
        },
      },
    });

    ocrService = new OCRService(prisma);

    // Create test user
    testUserId = 'test-user-storage-' + Date.now();
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `test-storage-${Date.now()}@example.com`,
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
      // Delete test directory
      await fs.rm(testDirectory, { recursive: true, force: true });

      // Delete database records
      await prisma.ocrResult.deleteMany({ where: { userId: testUserId } });
      await prisma.file.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  describe('Enhanced File Storage with Metadata', () => {
    it('should save file with enhanced metadata', async () => {
      const testContent = Buffer.from('Test invoice content for enhanced storage');
      const filename = 'test-invoice.txt';

      const savedFilename = await storageService.saveFile(testContent, filename, {
        contentType: 'text/plain',
      });

      expect(savedFilename).toBeDefined();
      expect(savedFilename).toContain(filename);

      // Verify metadata was created
      const metadata = await storageService.getFileMetadata(savedFilename);
      expect(metadata).toBeDefined();
      expect(metadata?.originalFilename).toBe(filename);
      expect(metadata?.contentType).toBe('text/plain');
      expect(metadata?.size).toBe(testContent.length);
      expect(metadata?.ocrProcessingStatus).toBe('pending');
      expect(metadata?.processingHistory).toHaveLength(1);
      expect(metadata?.processingHistory?.[0].action).toBe('file_uploaded');
    }, TEST_TIMEOUT);

    it('should update OCR processing status', async () => {
      const testContent = Buffer.from('Test content for OCR status update');
      const filename = 'ocr-status-test.txt';

      const savedFilename = await storageService.saveFile(testContent, filename, {
        contentType: 'text/plain',
      });

      // Update to processing status
      await storageService.updateOCRStatus(savedFilename, 'processing');

      let metadata = await storageService.getFileMetadata(savedFilename);
      expect(metadata?.ocrProcessingStatus).toBe('processing');
      expect(metadata?.processingHistory).toHaveLength(2);

      // Update to completed status with OCR results
      const ocrResults = {
        engine: 'tesseract',
        confidence: 0.92,
        processingTime: 2500,
        preprocessingSteps: ['deskew', 'denoise', 'enhance'],
        fallbackUsed: false,
        enginesUsed: ['tesseract'],
      };

      await storageService.updateOCRStatus(savedFilename, 'completed', ocrResults);

      metadata = await storageService.getFileMetadata(savedFilename);
      expect(metadata?.ocrProcessingStatus).toBe('completed');
      expect(metadata?.ocrResults).toEqual(ocrResults);
      expect(metadata?.processingHistory).toHaveLength(3);
    }, TEST_TIMEOUT);

    it('should get files by OCR processing status', async () => {
      // Create multiple test files with different statuses
      const files = [
        { name: 'pending-file.txt', status: 'pending' as const },
        { name: 'processing-file.txt', status: 'processing' as const },
        { name: 'completed-file.txt', status: 'completed' as const },
      ];

      const savedFilenames: string[] = [];

      for (const file of files) {
        const content = Buffer.from(`Test content for ${file.name}`);
        const savedFilename = await storageService.saveFile(content, file.name, {
          contentType: 'text/plain',
        });
        savedFilenames.push(savedFilename);

        if (file.status !== 'pending') {
          await storageService.updateOCRStatus(savedFilename, file.status);
        }
      }

      // Test getting files by status
      const pendingFiles = await storageService.getFilesByOCRStatus('pending');
      const processingFiles = await storageService.getFilesByOCRStatus('processing');
      const completedFiles = await storageService.getFilesByOCRStatus('completed');

      expect(pendingFiles.length).toBeGreaterThanOrEqual(1);
      expect(processingFiles.length).toBeGreaterThanOrEqual(1);
      expect(completedFiles.length).toBeGreaterThanOrEqual(1);

      // Verify specific files are in correct status lists
      expect(pendingFiles.some(f => f.includes('pending-file'))).toBe(true);
      expect(processingFiles.some(f => f.includes('processing-file'))).toBe(true);
      expect(completedFiles.some(f => f.includes('completed-file'))).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Integration with OCR Service', () => {
    it('should integrate storage metadata with OCR processing', async () => {
      const invoiceContent = `
STORAGE INTEGRATION TEST
Invoice Number: INV-2024-STORAGE-001
Amount: $2,500.00
Date: March 27, 2024
      `.trim();

      // Save file through storage service
      const testContent = Buffer.from(invoiceContent);
      const savedFilename = await storageService.saveFile(testContent, 'integration-test.txt', {
        contentType: 'text/plain',
      });

      // Create file record in database
      const fileId = 'test-file-storage-' + Date.now();
      const filePath = join(testDirectory, savedFilename);
      
      await prisma.file.create({
        data: {
          id: fileId,
          userId: testUserId,
          filename: savedFilename,
          originalFilename: 'integration-test.txt',
          filePath,
          fileSize: BigInt(testContent.length),
          mimeType: 'text/plain',
          fileHash: `hash-${fileId}`,
          status: 'uploaded',
        },
      });

      // Update storage metadata to processing
      await storageService.updateOCRStatus(savedFilename, 'processing');

      // Process with OCR service
      const ocrResult = await ocrService.processFile(fileId, testUserId, {
        engine: 'tesseract',
        preprocessing: {
          deskew: true,
          denoise: true,
          enhance: true,
        },
      });

      // Update storage metadata with OCR results
      await storageService.updateOCRStatus(savedFilename, 'completed', {
        engine: ocrResult.engine,
        confidence: ocrResult.confidence,
        processingTime: ocrResult.metadata?.processingTime || 0,
        preprocessingSteps: ocrResult.metadata?.preprocessingSteps || [],
        fallbackUsed: ocrResult.metadata?.fallback ? true : false,
        enginesUsed: ocrResult.metadata?.fallback?.enginesUsed || [ocrResult.engine],
      });

      // Verify integration
      const metadata = await storageService.getFileMetadata(savedFilename);
      expect(metadata?.ocrProcessingStatus).toBe('completed');
      expect(metadata?.ocrResults?.engine).toBe(ocrResult.engine);
      expect(metadata?.ocrResults?.confidence).toBe(ocrResult.confidence);
      expect(metadata?.processingHistory?.length).toBeGreaterThanOrEqual(3);

      // Verify OCR result contains expected content
      expect(ocrResult.text).toContain('STORAGE INTEGRATION TEST');
      expect(ocrResult.text).toContain('INV-2024-STORAGE-001');
      expect(ocrResult.text).toContain('$2,500.00');
    }, TEST_TIMEOUT);

    it('should handle OCR processing failures in storage metadata', async () => {
      const testContent = Buffer.from('Test content for failure scenario');
      const savedFilename = await storageService.saveFile(testContent, 'failure-test.txt', {
        contentType: 'text/plain',
      });

      // Simulate OCR processing failure
      await storageService.updateOCRStatus(savedFilename, 'processing');
      await storageService.updateOCRStatus(savedFilename, 'failed');

      const metadata = await storageService.getFileMetadata(savedFilename);
      expect(metadata?.ocrProcessingStatus).toBe('failed');
      expect(metadata?.processingHistory?.length).toBe(3);
      
      const failureEntry = metadata?.processingHistory?.find(h => h.status === 'failed');
      expect(failureEntry).toBeDefined();
      expect(failureEntry?.action).toBe('ocr_status_update');
    }, TEST_TIMEOUT);
  });

  describe('Storage Maintenance and Cleanup', () => {
    it('should cleanup old metadata files', async () => {
      // Create some test files
      const testFiles = ['old-file-1.txt', 'old-file-2.txt'];
      
      for (const filename of testFiles) {
        const content = Buffer.from(`Test content for ${filename}`);
        await storageService.saveFile(content, filename, {
          contentType: 'text/plain',
        });
      }

      // Cleanup with 0 days (should clean all files)
      const cleanedCount = await storageService.cleanupOldMetadata(0);
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    }, TEST_TIMEOUT);

    it('should handle storage errors gracefully', async () => {
      // Test with invalid content type
      const testContent = Buffer.from('Test content');
      
      await expect(
        storageService.saveFile(testContent, 'invalid-type.xyz', {
          contentType: 'application/invalid',
        })
      ).rejects.toThrow();

      // Test with oversized file (if maxFileSize is set)
      const largeContent = Buffer.alloc(20 * 1024 * 1024); // 20MB
      
      await expect(
        storageService.saveFile(largeContent, 'large-file.txt', {
          contentType: 'text/plain',
        })
      ).rejects.toThrow();
    }, TEST_TIMEOUT);
  });
});
