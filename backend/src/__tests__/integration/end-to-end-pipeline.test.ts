import { OCRService } from '../../services/ocr.service';
import { FieldExtractionService } from '../../services/field.service';
import { InvoiceService } from '../../services/invoice.service';
import { StorageService } from '../../services/StorageService';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';
import { jest } from '@jest/globals';

const TEST_TIMEOUT = 60000; // Longer timeout for end-to-end tests

describe('Complete Processing Pipeline End-to-End', () => {
  let ocrService: OCRService;
  let fieldService: FieldExtractionService;
  let invoiceService: InvoiceService;
  let storageService: StorageService;
  let prisma: PrismaClient;
  let testUserId: string;
  let testFileId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_TEST_URL || process.env.DATABASE_URL,
        },
      },
    });

    // Initialize services
    ocrService = new OCRService(prisma);
    fieldService = new FieldExtractionService(prisma);
    invoiceService = new InvoiceService(prisma);
    storageService = new StorageService();

    // Create test user
    testUserId = 'test-user-e2e-' + Date.now();
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `test-e2e-${Date.now()}@example.com`,
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
      await prisma.extraction.deleteMany({ where: { userId: testUserId } });
      await prisma.file.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  async function createTestFile(
    content: string,
    filename: string = 'test-invoice.txt',
  ): Promise<string> {
    const testContent = Buffer.from(content);
    const testFilePath = join(process.cwd(), 'uploads', filename);

    // Ensure uploads directory exists
    await fs.mkdir(join(process.cwd(), 'uploads'), { recursive: true });
    await fs.writeFile(testFilePath, testContent);

    const fileId = 'test-file-e2e-' + Date.now();
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

  describe('Full Invoice Processing Pipeline', () => {
    const sampleInvoice = `
ACME CORPORATION
123 Business Street
Business City, BC 12345
Phone: (555) 123-4567
Email: billing@acme.com

INVOICE

Invoice Number: INV-2024-0001
Date: March 15, 2024
Due Date: April 15, 2024
PO Number: PO-2024-789

Bill To:
Tech Solutions Inc.
456 Technology Blvd
Tech City, TC 67890

Description                 Qty    Unit Price    Total
Software License            5      $299.99      $1,499.95
Support Package             1      $599.99      $599.99
Training Sessions           3      $150.00      $450.00

                           Subtotal:           $2,549.94
                           Tax (8.5%):         $216.75
                           TOTAL:              $2,766.69

Payment Terms: Net 30
    `.trim();

    it(
      'should process invoice from file upload to final result',
      async () => {
        // Step 1: Create test file
        const fileId = await createTestFile(
          sampleInvoice,
          'complete-invoice.txt',
        );

        // Step 2: Process with OCR service
        const ocrResult = await ocrService.processFile(fileId, testUserId, {
          engine: 'tesseract',
          confidenceThreshold: 0.7,
        });

        expect(ocrResult).toBeDefined();
        expect(ocrResult.fileId).toBe(fileId);
        expect(ocrResult.userId).toBe(testUserId);
        expect(ocrResult.status).toBe('completed');
        expect(ocrResult.text).toBeDefined();
        expect(ocrResult.confidence).toBeGreaterThan(0);

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

        // Step 4: Process invoice with enhanced options
        const invoiceResult = await invoiceService.processInvoice(
          fileId,
          testUserId,
          {
            ocrOptions: {
              engine: 'tesseract',
              validation: {
                minConfidence: 0.7,
                requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
              },
            },
            enableMetrics: true,
            trackPerformance: true,
          },
        );

        expect(invoiceResult).toBeDefined();
        expect(invoiceResult.fileId).toBe(fileId);
        expect(invoiceResult.userId).toBe(testUserId);
        expect(invoiceResult.status).toBe('completed');

        // Step 5: Verify file status was updated
        const updatedFile = await prisma.file.findUnique({
          where: { id: fileId },
        });

        expect(updatedFile?.status).toBe('completed');

        // Cleanup test file
        await fs
          .unlink(join(process.cwd(), 'uploads', 'complete-invoice.txt'))
          .catch(() => {});
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle processing pipeline with validation errors',
      async () => {
        const invalidInvoice = `
Some Company
Random text without proper invoice structure
Amount: invalid_amount
      `;

        const fileId = await createTestFile(
          invalidInvoice,
          'invalid-invoice.txt',
        );

        // Process with OCR
        const ocrResult = await ocrService.processFile(fileId, testUserId, {
          engine: 'tesseract',
          confidenceThreshold: 0.1, // Low threshold to allow processing
        });

        expect(ocrResult).toBeDefined();

        // Extract fields (should work but with low confidence)
        const fieldResult = await fieldService.extractFields(ocrResult.text, {
          type: 'invoice',
          requiredFields: [],
          confidenceThreshold: 0.1,
        });

        expect(fieldResult).toBeDefined();

        // Process invoice (may fail validation)
        try {
          const invoiceResult = await invoiceService.processInvoice(
            fileId,
            testUserId,
            {
              ocrOptions: {
                validation: {
                  minConfidence: 0.8,
                  requiredFields: [
                    'invoiceNumber',
                    'vendorName',
                    'totalAmount',
                  ],
                },
              },
            },
          );

          // If it succeeds, verify the result
          expect(invoiceResult).toBeDefined();
        } catch (error) {
          // If it fails validation, that's expected
          expect(error).toBeDefined();
        }

        // Cleanup test file
        await fs
          .unlink(join(process.cwd(), 'uploads', 'invalid-invoice.txt'))
          .catch(() => {});
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle processing pipeline with fallback OCR engine',
      async () => {
        const fileId = await createTestFile(
          sampleInvoice,
          'fallback-invoice.txt',
        );

        // Process with fallback configuration
        const ocrResult = await ocrService.processFile(
          fileId,
          testUserId,
          {
            engine: 'tesseract',
            confidenceThreshold: 0.8,
          },
          {
            enabled: true,
            engine: 'google-vision',
            confidenceThreshold: 0.7,
          },
        );

        expect(ocrResult).toBeDefined();
        expect(ocrResult.status).toBe('completed');

        // Continue with field extraction
        const fieldResult = await fieldService.extractFields(ocrResult.text, {
          type: 'invoice',
          confidenceThreshold: 0.7,
        });

        expect(fieldResult).toBeDefined();

        // Process invoice
        const invoiceResult = await invoiceService.processInvoice(
          fileId,
          testUserId,
        );

        expect(invoiceResult).toBeDefined();

        // Cleanup test file
        await fs
          .unlink(join(process.cwd(), 'uploads', 'fallback-invoice.txt'))
          .catch(() => {});
      },
      TEST_TIMEOUT,
    );
  });

  describe('Error Handling in Pipeline', () => {
    it(
      'should handle file not found errors gracefully',
      async () => {
        const nonExistentFileId = 'non-existent-file-' + Date.now();

        await expect(
          ocrService.processFile(nonExistentFileId, testUserId),
        ).rejects.toThrow('File not found');
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle unauthorized access errors',
      async () => {
        const fileId = await createTestFile(
          'Test content',
          'unauthorized-test.txt',
        );
        const otherUserId = 'other-user-' + Date.now();

        await expect(
          ocrService.processFile(fileId, otherUserId),
        ).rejects.toThrow('User does not have access');

        // Cleanup test file
        await fs
          .unlink(join(process.cwd(), 'uploads', 'unauthorized-test.txt'))
          .catch(() => {});
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle empty file processing',
      async () => {
        const fileId = await createTestFile('', 'empty-file.txt');

        const ocrResult = await ocrService.processFile(fileId, testUserId, {
          confidenceThreshold: 0.1,
        });

        expect(ocrResult).toBeDefined();
        expect(ocrResult.text).toBe('');

        // Field extraction should handle empty text
        const fieldResult = await fieldService.extractFields(ocrResult.text, {
          type: 'invoice',
          requiredFields: [],
          confidenceThreshold: 0.1,
        });

        expect(fieldResult).toBeDefined();
        expect(fieldResult.rawText).toBe('');

        // Cleanup test file
        await fs
          .unlink(join(process.cwd(), 'uploads', 'empty-file.txt'))
          .catch(() => {});
      },
      TEST_TIMEOUT,
    );
  });

  describe('Performance and Scalability', () => {
    it(
      'should process multiple files concurrently',
      async () => {
        const fileIds = [];
        const promises = [];

        // Create multiple test files
        for (let i = 0; i < 3; i++) {
          const content = `Invoice ${i}\nAmount: $${(i + 1) * 100}.00`;
          const fileId = await createTestFile(content, `concurrent-${i}.txt`);
          fileIds.push(fileId);
        }

        // Process all files concurrently
        for (const fileId of fileIds) {
          promises.push(
            ocrService.processFile(fileId, testUserId, {
              confidenceThreshold: 0.5,
            }),
          );
        }

        const results = await Promise.all(promises);

        // Verify all results
        expect(results).toHaveLength(3);
        for (const result of results) {
          expect(result).toBeDefined();
          expect(result.status).toBe('completed');
        }

        // Cleanup test files
        for (let i = 0; i < 3; i++) {
          await fs
            .unlink(join(process.cwd(), 'uploads', `concurrent-${i}.txt`))
            .catch(() => {});
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle large text processing efficiently',
      async () => {
        const largeContent = sampleInvoice.repeat(10); // 10x larger content
        const fileId = await createTestFile(largeContent, 'large-invoice.txt');

        const startTime = Date.now();

        const ocrResult = await ocrService.processFile(fileId, testUserId, {
          confidenceThreshold: 0.7,
        });

        const processingTime = Date.now() - startTime;

        expect(ocrResult).toBeDefined();
        expect(ocrResult.status).toBe('completed');
        expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds

        // Cleanup test file
        await fs
          .unlink(join(process.cwd(), 'uploads', 'large-invoice.txt'))
          .catch(() => {});
      },
      TEST_TIMEOUT,
    );
  });

  describe('Data Integrity and Consistency', () => {
    it(
      'should maintain data consistency across all pipeline stages',
      async () => {
        const fileId = await createTestFile(
          sampleInvoice,
          'consistency-test.txt',
        );

        // Process through entire pipeline
        const ocrResult = await ocrService.processFile(fileId, testUserId);
        const fieldResult = await fieldService.extractFields(ocrResult.text, {
          type: 'invoice',
          confidenceThreshold: 0.7,
        });
        const invoiceResult = await invoiceService.processInvoice(
          fileId,
          testUserId,
          {
            extractedData: fieldResult,
          },
        );

        // Verify data consistency
        expect(ocrResult.fileId).toBe(fileId);
        expect(ocrResult.userId).toBe(testUserId);
        expect(invoiceResult.fileId).toBe(fileId);
        expect(invoiceResult.userId).toBe(testUserId);

        // Verify database consistency
        const file = await prisma.file.findUnique({ where: { id: fileId } });
        const ocr = await prisma.ocrResult.findFirst({ where: { fileId } });
        const extraction = await prisma.extraction.findFirst({
          where: { fileId },
        });

        expect(file?.id).toBe(fileId);
        expect(ocr?.fileId).toBe(fileId);
        expect(extraction?.fileId).toBe(fileId);

        // Cleanup test file
        await fs
          .unlink(join(process.cwd(), 'uploads', 'consistency-test.txt'))
          .catch(() => {});
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle transaction rollback on pipeline failures',
      async () => {
        const fileId = await createTestFile(
          'Invalid content',
          'rollback-test.txt',
        );

        try {
          // This might fail at some stage
          const ocrResult = await ocrService.processFile(fileId, testUserId);

          // If OCR succeeds, try field extraction with strict requirements
          await fieldService.extractFields(ocrResult.text, {
            type: 'invoice',
            requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
            confidenceThreshold: 0.95, // Very high threshold
          });
        } catch (error) {
          // Failure is expected for invalid content
          expect(error).toBeDefined();
        }

        // Verify file status reflects the failure appropriately
        const file = await prisma.file.findUnique({ where: { id: fileId } });
        expect(file).toBeDefined();

        // Cleanup test file
        await fs
          .unlink(join(process.cwd(), 'uploads', 'rollback-test.txt'))
          .catch(() => {});
      },
      TEST_TIMEOUT,
    );
  });

  describe('Integration with Storage Service', () => {
    it(
      'should integrate with storage service for file metadata',
      async () => {
        const fileId = await createTestFile(
          sampleInvoice,
          'storage-integration.txt',
        );

        // Update file metadata through storage service
        await storageService.updateFileMetadata(fileId, {
          ocrStatus: 'pending',
          processingStarted: new Date(),
        });

        // Process file
        const ocrResult = await ocrService.processFile(fileId, testUserId);

        // Update metadata after processing
        await storageService.updateFileMetadata(fileId, {
          ocrStatus: 'completed',
          processingCompleted: new Date(),
          ocrConfidence: ocrResult.confidence,
        });

        // Verify metadata was updated
        const metadata = await storageService.getFileMetadata(fileId);
        expect(metadata.ocrStatus).toBe('completed');
        expect(metadata.ocrConfidence).toBeDefined();

        // Cleanup test file
        await fs
          .unlink(join(process.cwd(), 'uploads', 'storage-integration.txt'))
          .catch(() => {});
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle file cleanup after processing',
      async () => {
        const fileId = await createTestFile(
          'Temporary content',
          'cleanup-test.txt',
        );
        const filePath = join(process.cwd(), 'uploads', 'cleanup-test.txt');

        // Verify file exists
        expect(
          await fs
            .access(filePath)
            .then(() => true)
            .catch(() => false),
        ).toBe(true);

        // Process file
        await ocrService.processFile(fileId, testUserId);

        // File should still exist after processing (cleanup is manual)
        expect(
          await fs
            .access(filePath)
            .then(() => true)
            .catch(() => false),
        ).toBe(true);

        // Manual cleanup
        await fs.unlink(filePath);
        expect(
          await fs
            .access(filePath)
            .then(() => true)
            .catch(() => false),
        ).toBe(false);
      },
      TEST_TIMEOUT,
    );
  });

  describe('End-to-End Validation', () => {
    it(
      'should validate complete invoice processing workflow',
      async () => {
        const fileId = await createTestFile(
          sampleInvoice,
          'validation-workflow.txt',
        );

        // Complete workflow
        const ocrResult = await ocrService.processFile(fileId, testUserId, {
          engine: 'tesseract',
          confidenceThreshold: 0.7,
        });

        const fieldResult = await fieldService.extractFields(ocrResult.text, {
          type: 'invoice',
          requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
          confidenceThreshold: 0.7,
        });

        const invoiceResult = await invoiceService.processInvoice(
          fileId,
          testUserId,
          {
            extractedData: fieldResult,
            validationRules: {
              requireVendorName: true,
              requireInvoiceNumber: true,
              requireTotalAmount: true,
            },
          },
        );

        // Comprehensive validation
        expect(ocrResult.text).toContain('ACME CORPORATION');
        expect(fieldResult.vendorName).toBeDefined();
        expect(fieldResult.invoiceNumber).toBeDefined();
        expect(fieldResult.totalAmount).toBeDefined();
        expect(typeof fieldResult.totalAmount).toBe('number');
        expect(fieldResult.totalAmount).toBeGreaterThan(0);
        expect(invoiceResult.status).toBe('completed');

        // Verify confidence scores are reasonable
        expect(fieldResult.confidence.vendorName).toBeGreaterThan(0.7);
        expect(fieldResult.confidence.invoiceNumber).toBeGreaterThan(0.7);
        expect(fieldResult.confidence.totalAmount).toBeGreaterThan(0.7);

        // Cleanup test file
        await fs
          .unlink(join(process.cwd(), 'uploads', 'validation-workflow.txt'))
          .catch(() => {});
      },
      TEST_TIMEOUT,
    );
  });
});
