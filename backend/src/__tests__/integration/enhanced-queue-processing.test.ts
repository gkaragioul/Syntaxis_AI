import { PrismaClient } from '@prisma/client';
import { InvoiceProcessingService } from '../../services/InvoiceProcessingService';
import { OCRService } from '../../services/ocr.service';
import { Redis } from 'ioredis';
import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';

// Mock EmailService to avoid dependencies
const mockEmailService = {
  sendInvoiceProcessedEmail: jest.fn().mockResolvedValue(true),
  sendEmail: jest.fn().mockResolvedValue(true),
};

// Mock InvoiceService for testing
const mockInvoiceService = {
  processInvoice: jest.fn(),
};

const TEST_TIMEOUT = 45000; // 45 seconds

describe('Enhanced Bull Queue Processing', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let processingService: InvoiceProcessingService;
  let ocrService: OCRService;
  let testUserId: string;
  let testFileId: string;

  beforeAll(async () => {
    // Initialize test database connection
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_TEST_URL || process.env.DATABASE_URL,
        },
      },
    });

    // Initialize Redis connection for testing
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    // Initialize services
    ocrService = new OCRService(prisma);

    // Mock invoice service to return predictable results
    mockInvoiceService.processInvoice.mockImplementation(
      async (fileId: string, userId: string, options?: any) => {
        return {
          id: 'mock-invoice-' + Date.now(),
          userId,
          fileId,
          extractedData: {
            invoiceNumber: 'INV-2024-QUEUE-001',
            vendorName: 'Queue Test Vendor',
            totalAmount: 1500.0,
            ocrMetadata: {
              engine: options?.ocrOptions?.engine || 'tesseract',
              processingTime: 2500,
              confidenceMetrics: {
                overall: 0.92,
                textQuality: 0.9,
                structuralIntegrity: 0.85,
                fieldAccuracy: 0.95,
                processingReliability: 0.88,
              },
              fieldConfidences: {
                invoiceNumber: 0.95,
                totalAmount: 0.98,
                vendorName: 0.87,
              },
              fallbackUsed:
                options?.fallbackOptions?.enabled && Math.random() > 0.7,
              enginesUsed: options?.fallbackOptions?.enabled
                ? ['tesseract', 'google-vision']
                : [options?.ocrOptions?.engine || 'tesseract'],
              preprocessingSteps: Object.keys(
                options?.ocrOptions?.preprocessing || {},
              ).filter((key) => options.ocrOptions.preprocessing[key]),
            },
          },
          confidenceScore: 0.92,
          status: 'processed',
          createdAt: new Date(),
        };
      },
    );

    processingService = new InvoiceProcessingService(
      prisma,
      mockEmailService as any,
      mockInvoiceService as any,
      redis,
    );

    // Create test user
    testUserId = 'test-user-queue-' + Date.now();
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `test-queue-${Date.now()}@example.com`,
        passwordHash: 'test-password-hash',
      },
    });

    // Setup test file
    await setupTestFile();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    await redis.disconnect();
    await prisma.$disconnect();
  });

  async function setupTestFile() {
    const testDataDir = join(process.cwd(), 'src/__tests__/fixtures/invoices');
    const testFilePath = join(testDataDir, 'queue-test-invoice.txt');

    const invoiceContent = `
QUEUE TEST CORPORATION
456 Queue Street
Queue City, QC 12345

INVOICE

Invoice Number: INV-2024-QUEUE-001
Date: March 26, 2024
Due Date: April 26, 2024

Bill To:
Queue Test Client
789 Client Avenue
Client City, CC 67890

Description                    Qty    Unit Price    Total
Enhanced Queue Processing      1      $1,500.00     $1,500.00

                              TOTAL:               $1,500.00
    `.trim();

    await fs.mkdir(testDataDir, { recursive: true });
    await fs.writeFile(testFilePath, invoiceContent);

    testFileId = 'test-file-queue-' + Date.now();
    const fileStats = await fs.stat(testFilePath);

    await prisma.file.create({
      data: {
        id: testFileId,
        userId: testUserId,
        filename: 'queue-test-invoice.txt',
        originalFilename: 'queue-test-invoice.txt',
        filePath: testFilePath,
        fileSize: BigInt(fileStats.size),
        mimeType: 'text/plain',
        fileHash: `hash-${testFileId}`,
        status: 'uploaded',
      },
    });
  }

  async function cleanupTestData() {
    try {
      const testFilePath = join(
        process.cwd(),
        'src/__tests__/fixtures/invoices/queue-test-invoice.txt',
      );
      try {
        await fs.unlink(testFilePath);
      } catch (error) {
        // File might not exist
      }

      await prisma.ocrResult.deleteMany({ where: { userId: testUserId } });
      await prisma.extraction.deleteMany({ where: { userId: testUserId } });
      await prisma.invoice.deleteMany({ where: { userId: testUserId } });
      await prisma.file.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  describe('Enhanced Queue Job Processing', () => {
    it(
      'should queue job with enhanced OCR options',
      async () => {
        const jobId = await processingService.queueProcessingJob({
          fileId: testFileId,
          userId: testUserId,
          priority: 1,
          options: {
            engine: 'tesseract',
            preprocessing: {
              deskew: true,
              denoise: true,
              enhance: true,
              brightness: 1.2,
              contrast: 1.3,
            },
            validation: {
              minConfidence: 0.8,
              minTextLength: 100,
              requiredFields: ['invoiceNumber', 'totalAmount', 'vendorName'],
            },
            fallback: {
              enabled: true,
              primaryEngine: 'tesseract',
              fallbackEngine: 'google-vision',
              confidenceThreshold: 0.85,
            },
            enableMetrics: true,
            trackPerformance: true,
          },
        });

        expect(jobId).toBeDefined();
        expect(typeof jobId).toBe('string');

        // Verify file status was updated
        const file = await prisma.file.findUnique({
          where: { id: testFileId },
        });
        expect(file?.status).toBe('queued');
      },
      TEST_TIMEOUT,
    );

    it(
      'should process job with enhanced OCR features',
      async () => {
        const result = await processingService.processInvoice({
          fileId: testFileId,
          userId: testUserId,
          options: {
            engine: 'google-vision',
            preprocessing: {
              deskew: true,
              denoise: true,
              enhance: true,
            },
            validation: {
              minConfidence: 0.7,
              minTextLength: 50,
            },
            fallback: {
              enabled: true,
              primaryEngine: 'google-vision',
              fallbackEngine: 'tesseract',
              confidenceThreshold: 0.8,
            },
            enableMetrics: true,
            trackPerformance: true,
          },
        });

        expect(result.status).toBe('completed');
        expect(result.invoiceId).toBeDefined();
        expect(result.metadata).toBeDefined();

        // Verify enhanced metadata
        expect(result.metadata?.ocrEngine).toBe('google-vision');
        expect(result.metadata?.processingTime).toBeGreaterThan(0);
        expect(result.metadata?.confidenceScore).toBeGreaterThan(0);
        expect(result.metadata?.confidenceMetrics).toBeDefined();
        expect(result.metadata?.fieldConfidences).toBeDefined();
        expect(result.metadata?.enginesUsed).toContain('google-vision');
        expect(result.metadata?.totalProcessingTime).toBeGreaterThan(0);

        // Verify preprocessing steps were recorded
        expect(result.metadata?.preprocessingSteps).toContain('deskew');
        expect(result.metadata?.preprocessingSteps).toContain('denoise');
        expect(result.metadata?.preprocessingSteps).toContain('enhance');
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle fallback scenarios in queue processing',
      async () => {
        const result = await processingService.processInvoice({
          fileId: testFileId,
          userId: testUserId,
          options: {
            engine: 'tesseract',
            fallback: {
              enabled: true,
              primaryEngine: 'tesseract',
              fallbackEngine: 'google-vision',
              confidenceThreshold: 0.95, // High threshold to potentially trigger fallback
            },
            enableMetrics: true,
          },
        });

        expect(result.status).toBe('completed');
        expect(result.metadata?.enginesUsed).toBeDefined();
        expect(result.metadata?.fallbackUsed).toBeDefined();

        // If fallback was used, should have multiple engines
        if (result.metadata?.fallbackUsed) {
          expect(result.metadata.enginesUsed.length).toBeGreaterThan(1);
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should track performance metrics in queue processing',
      async () => {
        const result = await processingService.processInvoice({
          fileId: testFileId,
          userId: testUserId,
          options: {
            engine: 'tesseract',
            trackPerformance: true,
            enableMetrics: true,
          },
        });

        expect(result.metadata?.totalProcessingTime).toBeGreaterThan(0);
        expect(result.metadata?.queueWaitTime).toBeGreaterThanOrEqual(0);
        expect(result.metadata?.retryAttempts).toBeDefined();
        expect(result.metadata?.processingTime).toBeGreaterThan(0);
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle queue processing errors gracefully',
      async () => {
        // Test with non-existent file
        const nonExistentFileId = 'non-existent-file-' + Date.now();

        await expect(
          processingService.processInvoice({
            fileId: nonExistentFileId,
            userId: testUserId,
            options: {
              engine: 'tesseract',
            },
          }),
        ).rejects.toThrow();
      },
      TEST_TIMEOUT,
    );
  });

  describe('Queue Configuration and Management', () => {
    it(
      'should support different priority levels',
      async () => {
        const highPriorityJobId = await processingService.queueProcessingJob({
          fileId: testFileId,
          userId: testUserId,
          priority: 10, // High priority
          options: { engine: 'tesseract' },
        });

        const lowPriorityJobId = await processingService.queueProcessingJob({
          fileId: testFileId,
          userId: testUserId,
          priority: 1, // Low priority
          options: { engine: 'tesseract' },
        });

        expect(highPriorityJobId).toBeDefined();
        expect(lowPriorityJobId).toBeDefined();
        expect(highPriorityJobId).not.toBe(lowPriorityJobId);
      },
      TEST_TIMEOUT,
    );

    it(
      'should handle retry scenarios',
      async () => {
        const result = await processingService.processInvoice({
          fileId: testFileId,
          userId: testUserId,
          retryCount: 2,
          options: {
            engine: 'tesseract',
            enableMetrics: true,
          },
        });

        expect(result.metadata?.retryAttempts).toBe(2);
      },
      TEST_TIMEOUT,
    );
  });
});
