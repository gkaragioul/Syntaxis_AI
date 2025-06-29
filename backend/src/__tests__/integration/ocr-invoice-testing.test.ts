import { OCRService } from '../../services/ocr.service';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';
import { jest } from '@jest/globals';

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds for OCR processing

describe('OCR Invoice Testing - Local Integration', () => {
  let ocrService: OCRService;
  let prisma: PrismaClient;
  let testUserId: string;
  let testFiles: Array<{ id: string; path: string; type: string }> = [];

  beforeAll(async () => {
    // Initialize test database connection
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_TEST_URL || process.env.DATABASE_URL,
        },
      },
    });

    // Initialize OCR service
    ocrService = new OCRService(prisma);

    // Create test user
    testUserId = 'test-user-ocr-' + Date.now();
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `test-ocr-${Date.now()}@example.com`,
        passwordHash: 'test-password-hash',
      },
    });

    // Setup test files
    await setupTestInvoiceFiles();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    await prisma.$disconnect();
  });

  async function setupTestInvoiceFiles() {
    const testDataDir = join(process.cwd(), 'src/__tests__/fixtures/invoices');
    
    // Ensure test directory exists
    try {
      await fs.mkdir(testDataDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Create sample invoice files for testing
    testFiles = [
      {
        id: 'invoice-simple-' + Date.now(),
        path: join(testDataDir, 'simple-invoice.txt'),
        type: 'simple',
      },
      {
        id: 'invoice-complex-' + Date.now(),
        path: join(testDataDir, 'complex-invoice.txt'),
        type: 'complex',
      },
      {
        id: 'invoice-poor-quality-' + Date.now(),
        path: join(testDataDir, 'poor-quality-invoice.txt'),
        type: 'poor-quality',
      },
    ];

    // Create sample invoice content
    const simpleInvoiceContent = `
INVOICE

Invoice Number: INV-2024-001
Date: January 15, 2024
Due Date: February 15, 2024

Bill To:
John Smith
123 Main Street
Anytown, ST 12345

Description: Web Development Services
Amount: $1,500.00
Tax: $120.00
Total: $1,620.00

Thank you for your business!
    `.trim();

    const complexInvoiceContent = `
ACME CORPORATION
123 Business Ave, Suite 100
Business City, BC 12345
Phone: (555) 123-4567
Email: billing@acme.com

INVOICE

Invoice #: INV-2024-0157
Date: March 22, 2024
Due Date: April 21, 2024
PO Number: PO-2024-789

Bill To:                          Ship To:
Tech Solutions Inc.               Tech Solutions Inc.
456 Technology Blvd              789 Delivery Street
Tech City, TC 67890              Tech City, TC 67890
Attn: Accounts Payable           Attn: Receiving Dept

Item Description                 Qty    Unit Price    Total
Software License - Premium       5      $299.99      $1,499.95
Support Package - Annual         1      $599.99      $599.99
Training Sessions                3      $150.00      $450.00
Setup Fee                        1      $200.00      $200.00

                                 Subtotal:           $2,749.94
                                 Tax (8.5%):         $233.74
                                 Shipping:           $25.00
                                 TOTAL:              $3,008.68

Payment Terms: Net 30
Payment Method: Check or ACH
    `.trim();

    const poorQualityInvoiceContent = `
inv0ice

numb3r: 1NV-2O24-OO2
d4te: f3bru4ry 1O, 2O24

bill t0:
j4ne d03
456 0ak str33t
s0m3t0wn, st 54321

4m0unt: $75O.OO
t0t4l: $75O.OO
    `.trim();

    // Write test files
    await fs.writeFile(testFiles[0].path, simpleInvoiceContent);
    await fs.writeFile(testFiles[1].path, complexInvoiceContent);
    await fs.writeFile(testFiles[2].path, poorQualityInvoiceContent);

    // Create file records in database
    for (const file of testFiles) {
      const fileStats = await fs.stat(file.path);
      await prisma.file.create({
        data: {
          id: file.id,
          userId: testUserId,
          filename: `${file.type}-invoice.txt`,
          originalFilename: `${file.type}-invoice.txt`,
          filePath: file.path,
          fileSize: BigInt(fileStats.size),
          mimeType: 'text/plain',
          fileHash: `hash-${file.id}`,
          status: 'uploaded',
        },
      });
    }
  }

  async function cleanupTestData() {
    try {
      // Delete test files
      if (testFiles && Array.isArray(testFiles)) {
        for (const file of testFiles) {
          try {
            await fs.unlink(file.path);
          } catch (error) {
            // File might not exist
          }
        }
      }

      // Delete database records
      await prisma.ocrResult.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.file.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.delete({
        where: { id: testUserId },
      });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  describe('Enhanced OCR Processing with Real Invoice Data', () => {
    it('should process simple invoice with high confidence', async () => {
      const simpleInvoiceFile = testFiles.find(f => f.type === 'simple');
      expect(simpleInvoiceFile).toBeDefined();

      const result = await ocrService.processFile(
        simpleInvoiceFile!.id,
        testUserId,
        {
          engine: 'tesseract',
          preprocessing: {
            deskew: true,
            denoise: true,
            enhance: true,
          },
          validation: {
            minConfidence: 0.8,
            minTextLength: 50,
          },
        }
      );

      // Verify basic result structure
      expect(result).toBeDefined();
      expect(result.text).toContain('INVOICE');
      expect(result.text).toContain('INV-2024-001');
      expect(result.text).toContain('$1,620.00');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.engine).toBe('tesseract');

      // Verify enhanced metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(result.metadata.preprocessingSteps).toContain('deskew');
      expect(result.metadata.preprocessingSteps).toContain('denoise');
      expect(result.metadata.preprocessingSteps).toContain('enhance');
    }, TEST_TIMEOUT);

    it('should process complex invoice and extract structured data', async () => {
      const complexInvoiceFile = testFiles.find(f => f.type === 'complex');
      expect(complexInvoiceFile).toBeDefined();

      const result = await ocrService.processFile(
        complexInvoiceFile!.id,
        testUserId,
        {
          engine: 'tesseract',
          preprocessing: {
            deskew: true,
            denoise: true,
            enhance: true,
          },
        }
      );

      // Verify complex invoice content
      expect(result.text).toContain('ACME CORPORATION');
      expect(result.text).toContain('INV-2024-0157');
      expect(result.text).toContain('$3,008.68');
      expect(result.text).toContain('Tech Solutions Inc.');

      // Verify field extraction capabilities
      expect(result.metadata?.fieldConfidences).toBeDefined();
      
      // Check for common invoice fields
      const hasInvoiceNumber = result.text.includes('INV-2024-0157');
      const hasAmount = result.text.includes('3,008.68') || result.text.includes('3008.68');
      const hasDate = result.text.includes('March') || result.text.includes('2024');
      
      expect(hasInvoiceNumber).toBe(true);
      expect(hasAmount).toBe(true);
      expect(hasDate).toBe(true);
    }, TEST_TIMEOUT);

    it('should handle poor quality invoice with fallback', async () => {
      const poorQualityFile = testFiles.find(f => f.type === 'poor-quality');
      expect(poorQualityFile).toBeDefined();

      const result = await ocrService.processFile(
        poorQualityFile!.id,
        testUserId,
        {
          engine: 'tesseract',
          preprocessing: {
            deskew: true,
            denoise: true,
            enhance: true,
            brightness: 1.3,
            contrast: 1.5,
          },
          validation: {
            minConfidence: 0.3, // Lower threshold for poor quality
          },
        },
        {
          enabled: true,
          primaryEngine: 'tesseract',
          fallbackEngine: 'google-vision',
          confidenceThreshold: 0.6,
          fallbackConditions: {
            lowConfidence: true,
            processingError: true,
            emptyResult: true,
          },
        }
      );

      // Should still extract some content even from poor quality
      expect(result).toBeDefined();
      expect(result.text.length).toBeGreaterThan(10);
      
      // May have lower confidence due to poor quality
      expect(result.confidence).toBeGreaterThan(0.1);
      
      // Should have attempted preprocessing
      expect(result.metadata?.preprocessingSteps).toContain('enhance');
    }, TEST_TIMEOUT);
  });

  describe('Confidence Scoring Validation', () => {
    it('should provide detailed confidence metrics for invoice processing', async () => {
      const simpleInvoiceFile = testFiles.find(f => f.type === 'simple');
      
      const result = await ocrService.processFile(
        simpleInvoiceFile!.id,
        testUserId,
        { engine: 'tesseract' }
      );

      // Verify confidence metrics structure
      expect(result.metadata?.confidenceMetrics).toBeDefined();
      
      if (result.metadata?.confidenceMetrics) {
        const metrics = result.metadata.confidenceMetrics;
        expect(metrics.overall).toBeGreaterThan(0);
        expect(metrics.textQuality).toBeGreaterThan(0);
        expect(metrics.structuralIntegrity).toBeGreaterThan(0);
        expect(metrics.fieldAccuracy).toBeGreaterThan(0);
        expect(metrics.processingReliability).toBeGreaterThan(0);
        
        // All metrics should be between 0 and 1
        expect(metrics.overall).toBeLessThanOrEqual(1);
        expect(metrics.textQuality).toBeLessThanOrEqual(1);
        expect(metrics.structuralIntegrity).toBeLessThanOrEqual(1);
        expect(metrics.fieldAccuracy).toBeLessThanOrEqual(1);
        expect(metrics.processingReliability).toBeLessThanOrEqual(1);
      }
    }, TEST_TIMEOUT);

    it('should provide field-specific confidence scores', async () => {
      const complexInvoiceFile = testFiles.find(f => f.type === 'complex');
      
      const result = await ocrService.processFile(
        complexInvoiceFile!.id,
        testUserId,
        { engine: 'tesseract' }
      );

      // Check for field-specific confidences
      expect(result.metadata?.fieldConfidences).toBeDefined();
      
      if (result.metadata?.fieldConfidences) {
        const fieldConfidences = result.metadata.fieldConfidences;
        
        // Should detect common invoice fields
        const detectedFields = Object.keys(fieldConfidences);
        expect(detectedFields.length).toBeGreaterThan(0);
        
        // All field confidences should be valid
        Object.values(fieldConfidences).forEach(confidence => {
          expect(confidence).toBeGreaterThan(0);
          expect(confidence).toBeLessThanOrEqual(1);
        });
      }
    }, TEST_TIMEOUT);
  });

  describe('Performance and Resource Usage', () => {
    it('should process invoices within acceptable time limits', async () => {
      const simpleInvoiceFile = testFiles.find(f => f.type === 'simple');
      
      const startTime = Date.now();
      const result = await ocrService.processFile(
        simpleInvoiceFile!.id,
        testUserId,
        { engine: 'tesseract' }
      );
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      
      // Should process within reasonable time (adjust based on your requirements)
      expect(processingTime).toBeLessThan(15000); // 15 seconds max
      expect(result.metadata?.processingTime).toBeGreaterThan(0);
      
      console.log(`Processing time: ${processingTime}ms`);
      console.log(`Reported processing time: ${result.metadata?.processingTime}ms`);
    }, TEST_TIMEOUT);
  });
});
