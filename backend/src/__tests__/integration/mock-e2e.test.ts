import { FieldExtractionService } from '../../services/field.service';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';
import { jest } from '@jest/globals';

const TEST_TIMEOUT = 30000;

// Mock OCR Service for testing
class MockOCRService {
  constructor(private prisma: PrismaClient) {}

  async processFile(fileId: string, userId: string, options?: any) {
    // Get file record
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!file) {
      throw new Error('File not found');
    }

    if (file.userId !== userId) {
      throw new Error('Not authorized to process this file');
    }

    // Read file content directly (for text files)
    const fileContent = await fs.readFile(file.filePath, 'utf-8');

    // Create OCR result
    const ocrResult = await this.prisma.oCRResult.create({
      data: {
        userId,
        ocrResultId: 'mock-ocr-' + Date.now(),
        fields: {
          text: fileContent,
          confidence: 0.95,
          status: 'completed',
          engine: 'mock',
          processingTime: 100,
          pages: [{ pageNumber: 1, text: fileContent, confidence: 0.95 }],
        },
        confidence: 0.95,
      },
    });

    // Return structure that matches what tests expect
    return {
      id: ocrResult.ocrResultId,
      fileId,
      userId,
      text: fileContent,
      confidence: 0.95,
      status: 'completed',
      metadata: ocrResult.fields,
    };
  }
}

describe('Mock End-to-End Pipeline Test', () => {
  let mockOcrService: MockOCRService;
  let fieldService: FieldExtractionService;
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

    // Initialize services
    mockOcrService = new MockOCRService(prisma);
    fieldService = new FieldExtractionService(prisma);

    // Create test user
    testUserId = 'test-user-mock-e2e-' + Date.now();
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `test-mock-e2e-${Date.now()}@example.com`,
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
      await prisma.oCRResult.deleteMany({ where: { userId: testUserId } });
      await prisma.file.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  async function createTestFile(content: string, filename: string = 'test-invoice.txt'): Promise<string> {
    const testContent = Buffer.from(content);
    const testFilePath = join(process.cwd(), 'uploads', filename);
    
    // Ensure uploads directory exists
    await fs.mkdir(join(process.cwd(), 'uploads'), { recursive: true });
    await fs.writeFile(testFilePath, testContent);

    const fileId = 'test-file-mock-e2e-' + Date.now();
    await prisma.file.create({
      data: {
        id: fileId,
        userId: testUserId,
        filename,
        originalFilename: filename,
        filePath: testFilePath,
        fileSize: BigInt(testContent.length),
        mimeType: 'text/plain',
        fileHash: `hash-${fileId}`,
        status: 'uploaded',
      },
    });

    return fileId;
  }

  describe('Complete Pipeline Flow', () => {
    const sampleInvoice = `
ACME CORPORATION
123 Business Street
Business City, BC 12345

INVOICE

Invoice Number: INV-2024-0001
Date: March 15, 2024
Due Date: April 15, 2024

Bill To:
Tech Solutions Inc.
456 Technology Blvd
Tech City, TC 67890

Description                 Qty    Unit Price    Total
Software License            5      $299.99      $1,499.95
Support Package             1      $599.99      $599.99

                           Subtotal:           $1,999.94
                           Tax (8.5%):         $169.99
                           TOTAL:              $2,169.93

Payment Terms: Net 30
    `.trim();

    it('should process complete pipeline successfully', async () => {
      // Step 1: Create test file
      const fileId = await createTestFile(sampleInvoice, 'mock-e2e-invoice.txt');

      // Step 2: Process with Mock OCR service
      const ocrResult = await mockOcrService.processFile(fileId, testUserId);

      expect(ocrResult).toBeDefined();
      expect(ocrResult.fileId).toBe(fileId);
      expect(ocrResult.userId).toBe(testUserId);
      expect(ocrResult.status).toBe('completed');
      expect(ocrResult.text).toBeDefined();
      expect(ocrResult.confidence).toBe(0.95);

      // Step 3: Extract fields from OCR text
      const fieldResult = await fieldService.extractFields(ocrResult.text, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
      });

      expect(fieldResult).toBeDefined();
      expect(fieldResult.invoiceNumber).toBeDefined();
      expect(fieldResult.vendorName).toBeDefined();
      expect(fieldResult.totalAmount).toBeDefined();
      expect(fieldResult.confidence.invoiceNumber).toBeGreaterThan(0.7);
      expect(fieldResult.confidence.vendorName).toBeGreaterThan(0.7);
      expect(fieldResult.confidence.totalAmount).toBeGreaterThan(0.7);

      // Step 4: Verify file status was updated
      const updatedFile = await prisma.file.findUnique({
        where: { id: fileId },
      });

      expect(updatedFile?.status).toBe('uploaded'); // Still uploaded since we didn't update it

      // Cleanup test file
      await fs.unlink(join(process.cwd(), 'uploads', 'mock-e2e-invoice.txt')).catch(() => {});
    }, TEST_TIMEOUT);

    it('should handle different confidence thresholds', async () => {
      const fileId = await createTestFile(sampleInvoice, 'confidence-test.txt');

      const ocrResult = await mockOcrService.processFile(fileId, testUserId);

      expect(ocrResult).toBeDefined();
      expect(ocrResult.status).toBe('completed');

      // Test field extraction with different thresholds
      const highThresholdFields = await fieldService.extractFields(ocrResult.text, {
        type: 'invoice',
        confidenceThreshold: 0.9,
      });

      const lowThresholdFields = await fieldService.extractFields(ocrResult.text, {
        type: 'invoice',
        confidenceThreshold: 0.3,
      });

      expect(highThresholdFields).toBeDefined();
      expect(lowThresholdFields).toBeDefined();

      // Both should have confidence scores
      expect(highThresholdFields.confidence).toBeDefined();
      expect(lowThresholdFields.confidence).toBeDefined();

      // Cleanup test file
      await fs.unlink(join(process.cwd(), 'uploads', 'confidence-test.txt')).catch(() => {});
    }, TEST_TIMEOUT);

    it('should handle empty file processing gracefully', async () => {
      const fileId = await createTestFile('', 'empty-file.txt');

      const ocrResult = await mockOcrService.processFile(fileId, testUserId);

      expect(ocrResult).toBeDefined();
      expect(ocrResult.text).toBe('');
      expect(ocrResult.status).toBe('completed');

      // Field extraction should handle empty text
      const fieldResult = await fieldService.extractFields(ocrResult.text, {
        type: 'invoice',
        requiredFields: [],
        confidenceThreshold: 0.1,
      });

      expect(fieldResult).toBeDefined();
      expect(fieldResult.rawText).toBe('');

      // Cleanup test file
      await fs.unlink(join(process.cwd(), 'uploads', 'empty-file.txt')).catch(() => {});
    }, TEST_TIMEOUT);

    it('should handle file not found errors', async () => {
      const nonExistentFileId = 'non-existent-file-' + Date.now();

      await expect(
        mockOcrService.processFile(nonExistentFileId, testUserId)
      ).rejects.toThrow('File not found');
    }, TEST_TIMEOUT);

    it('should handle unauthorized access errors', async () => {
      const fileId = await createTestFile('Test content', 'unauthorized-test.txt');
      const otherUserId = 'other-user-' + Date.now();

      await expect(
        mockOcrService.processFile(fileId, otherUserId)
      ).rejects.toThrow('Not authorized to process this file');

      // Cleanup test file
      await fs.unlink(join(process.cwd(), 'uploads', 'unauthorized-test.txt')).catch(() => {});
    }, TEST_TIMEOUT);

    it('should process multiple invoice formats', async () => {
      const invoiceFormats = [
        {
          name: 'standard-format.txt',
          content: sampleInvoice,
        },
        {
          name: 'minimal-format.txt',
          content: 'Invoice: 123\nAmount: $500.00\nVendor: ABC Company',
        },
        {
          name: 'european-format.txt',
          content: 'Rechnung: RE-001\nBetrag: €1.234,56\nFirma: European GmbH',
        },
      ];

      const results = [];

      for (const format of invoiceFormats) {
        const fileId = await createTestFile(format.content, format.name);
        
        const ocrResult = await mockOcrService.processFile(fileId, testUserId);

        const fieldResult = await fieldService.extractFields(ocrResult.text, {
          type: 'invoice',
          confidenceThreshold: 0.5,
        });

        results.push({
          format: format.name,
          ocrResult,
          fieldResult,
        });

        // Cleanup test file
        await fs.unlink(join(process.cwd(), 'uploads', format.name)).catch(() => {});
      }

      // Verify all formats were processed
      expect(results).toHaveLength(3);
      
      for (const result of results) {
        expect(result.ocrResult.status).toBe('completed');
        expect(result.fieldResult).toBeDefined();
        expect(result.fieldResult.confidence).toBeDefined();
      }
    }, TEST_TIMEOUT);

    it('should maintain data consistency across pipeline stages', async () => {
      const fileId = await createTestFile(sampleInvoice, 'consistency-test.txt');

      // Process through pipeline
      const ocrResult = await mockOcrService.processFile(fileId, testUserId);
      const fieldResult = await fieldService.extractFields(ocrResult.text, {
        type: 'invoice',
        confidenceThreshold: 0.7,
      });

      // Verify data consistency
      expect(ocrResult.fileId).toBe(fileId);
      expect(ocrResult.userId).toBe(testUserId);

      // Verify database consistency
      const file = await prisma.file.findUnique({ where: { id: fileId } });
      const ocr = await prisma.oCRResult.findFirst({ where: { userId: testUserId } });

      expect(file?.id).toBe(fileId);
      expect(ocr?.ocrResultId).toBeDefined();
      expect(ocr?.userId).toBe(testUserId);

      // Cleanup test file
      await fs.unlink(join(process.cwd(), 'uploads', 'consistency-test.txt')).catch(() => {});
    }, TEST_TIMEOUT);
  });
});
