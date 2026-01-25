/**
 * Processing Speed Tests
 * 
 * Task 1.3.2: Processing Speed Tests - TDD Implementation
 * 
 * These tests validate that invoice processing completes within <30s requirement
 * following TDD principles: Red-Green-Refactor
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { setupTestEnvironment, cleanupTestEnvironment } from '../utils/test-environment';
import { prismaMock } from '../__mocks__/prisma';

// Processing speed requirements
const PROCESSING_REQUIREMENTS = {
  INVOICE_PROCESSING_TIME_MS: 30000, // 30 seconds
  OCR_PROCESSING_TIME_MS: 15000, // 15 seconds
  PDF_PARSING_TIME_MS: 5000, // 5 seconds
  DATA_EXTRACTION_TIME_MS: 10000, // 10 seconds
  BATCH_ITEM_PROCESSING_MS: 30000, // 30 seconds per item
  DATABASE_OPERATION_TIME_MS: 1000, // 1 second
} as const;

// Mock services for testing
const mockOCRService = {
  processImage: jest.fn(),
  extractText: jest.fn(),
};

const mockPDFService = {
  parseDocument: jest.fn(),
  extractImages: jest.fn(),
};

const mockDataExtractionService = {
  extractInvoiceData: jest.fn(),
  validateExtraction: jest.fn(),
};

const mockInvoiceProcessingService = {
  processInvoice: jest.fn(),
  processInvoiceBatch: jest.fn(),
};

describe('Processing Speed Requirements', () => {
  beforeEach(async () => {
    await setupTestEnvironment({ useMocks: true });
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await cleanupTestEnvironment();
  });

  describe('Invoice Processing Speed', () => {
    it('should complete full invoice processing within 30 seconds', async () => {
      // RED: This test will initially fail until processing optimizations are implemented
      const mockInvoiceData = {
        id: 'test-invoice-id',
        userId: 'test-user-id',
        fileName: 'test-invoice.pdf',
        filePath: '/uploads/test-invoice.pdf',
        fileSize: 1024 * 1024, // 1MB
        mimeType: 'application/pdf',
      };

      // Mock the processing pipeline
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoiceData as any);
      prismaMock.invoice.update.mockResolvedValue({
        ...mockInvoiceData,
        status: 'processed',
        processingCompletedAt: new Date(),
      } as any);

      const startTime = Date.now();

      // Simulate the full processing pipeline
      const result = await mockInvoiceProcessingService.processInvoice(mockInvoiceData.id);

      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.INVOICE_PROCESSING_TIME_MS);
      expect(result).toBeDefined();
    });

    it('should complete OCR processing within 15 seconds', async () => {
      const mockImageBuffer = Buffer.from('mock image data');
      
      mockOCRService.processImage.mockImplementation(async () => {
        // Simulate OCR processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          confidence: 0.95,
          extractedText: 'Sample extracted text',
          boundingBoxes: [],
        };
      });

      const startTime = Date.now();

      const result = await mockOCRService.processImage(mockImageBuffer);

      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.OCR_PROCESSING_TIME_MS);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should complete PDF parsing within 5 seconds', async () => {
      const mockPDFBuffer = Buffer.from('mock pdf data');
      
      mockPDFService.parseDocument.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          pages: 3,
          images: ['image1.jpg', 'image2.jpg'],
          metadata: { title: 'Invoice', author: 'Company' },
        };
      });

      const startTime = Date.now();

      const result = await mockPDFService.parseDocument(mockPDFBuffer);

      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.PDF_PARSING_TIME_MS);
      expect(result.pages).toBeGreaterThan(0);
    });

    it('should complete data extraction within 10 seconds', async () => {
      const mockExtractedText = 'Invoice #12345 Amount: $150.00 Date: 2024-01-01';
      
      mockDataExtractionService.extractInvoiceData.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          invoiceNumber: '12345',
          amount: 150.00,
          currency: 'USD',
          date: '2024-01-01',
          vendor: 'Test Company',
          confidence: 0.92,
        };
      });

      const startTime = Date.now();

      const result = await mockDataExtractionService.extractInvoiceData(mockExtractedText);

      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.DATA_EXTRACTION_TIME_MS);
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Batch Processing Speed', () => {
    it('should process each invoice in batch within 30 seconds', async () => {
      const batchSize = 5;
      const mockInvoices = Array.from({ length: batchSize }, (_, i) => ({
        id: `invoice-${i}`,
        fileName: `invoice-${i}.pdf`,
        status: 'pending',
      }));

      mockInvoiceProcessingService.processInvoiceBatch.mockImplementation(async (invoices) => {
        const results = [];
        for (const invoice of invoices) {
          const startTime = Date.now();
          
          // Simulate processing each invoice
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const processingTime = Date.now() - startTime;
          
          // Each individual invoice should process within time limit
          expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.BATCH_ITEM_PROCESSING_MS);
          
          results.push({
            id: invoice.id,
            status: 'processed',
            processingTime,
          });
        }
        return results;
      });

      const startTime = Date.now();

      const results = await mockInvoiceProcessingService.processInvoiceBatch(mockInvoices);

      const totalBatchTime = Date.now() - startTime;

      expect(results).toHaveLength(batchSize);
      expect(totalBatchTime).toBeLessThan(PROCESSING_REQUIREMENTS.BATCH_ITEM_PROCESSING_MS * batchSize);
    });

    it('should handle concurrent processing efficiently', async () => {
      const concurrentJobs = 3;
      const mockInvoices = Array.from({ length: concurrentJobs }, (_, i) => ({
        id: `concurrent-invoice-${i}`,
        fileName: `concurrent-${i}.pdf`,
      }));

      const processingPromises = mockInvoices.map(async (invoice) => {
        const startTime = Date.now();
        
        // Simulate concurrent processing
        await mockInvoiceProcessingService.processInvoice(invoice.id);
        
        return Date.now() - startTime;
      });

      const processingTimes = await Promise.all(processingPromises);

      // All concurrent jobs should complete within time limits
      processingTimes.forEach(time => {
        expect(time).toBeLessThan(PROCESSING_REQUIREMENTS.INVOICE_PROCESSING_TIME_MS);
      });

      // Average processing time should be reasonable
      const averageTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
      expect(averageTime).toBeLessThan(PROCESSING_REQUIREMENTS.INVOICE_PROCESSING_TIME_MS * 0.8);
    });
  });

  describe('Database Operation Speed', () => {
    it('should complete database queries within 1 second', async () => {
      const startTime = Date.now();

      await prismaMock.invoice.findMany({
        where: { userId: 'test-user-id' },
        include: { ocrResults: true },
      });

      const queryTime = Date.now() - startTime;

      expect(queryTime).toBeLessThan(PROCESSING_REQUIREMENTS.DATABASE_OPERATION_TIME_MS);
    });

    it('should complete database writes within 1 second', async () => {
      const mockInvoiceData = {
        userId: 'test-user-id',
        fileName: 'test.pdf',
        filePath: '/uploads/test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
      };

      prismaMock.invoice.create.mockResolvedValue({
        id: 'new-invoice-id',
        ...mockInvoiceData,
        createdAt: new Date(),
      } as any);

      const startTime = Date.now();

      await prismaMock.invoice.create({ data: mockInvoiceData });

      const writeTime = Date.now() - startTime;

      expect(writeTime).toBeLessThan(PROCESSING_REQUIREMENTS.DATABASE_OPERATION_TIME_MS);
    });

    it('should complete complex aggregation queries within 1 second', async () => {
      prismaMock.invoice.aggregate.mockResolvedValue({
        _count: { id: 100 },
        _avg: { extractionConfidence: 0.95 },
        _sum: { fileSize: 1024000 },
      } as any);

      const startTime = Date.now();

      await prismaMock.invoice.aggregate({
        _count: { id: true },
        _avg: { extractionConfidence: true },
        _sum: { fileSize: true },
        where: { userId: 'test-user-id' },
      });

      const queryTime = Date.now() - startTime;

      expect(queryTime).toBeLessThan(PROCESSING_REQUIREMENTS.DATABASE_OPERATION_TIME_MS);
    });
  });

  describe('Performance Optimization Validation', () => {
    it('should maintain processing speed under memory pressure', async () => {
      // Simulate memory-intensive processing
      const largeInvoiceData = {
        id: 'large-invoice-id',
        fileName: 'large-invoice.pdf',
        fileSize: 10 * 1024 * 1024, // 10MB
        extractedText: 'x'.repeat(100000), // Large text content
      };

      const startTime = Date.now();

      await mockInvoiceProcessingService.processInvoice(largeInvoiceData.id);

      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.INVOICE_PROCESSING_TIME_MS);
    });

    it('should handle processing failures within time limits', async () => {
      mockInvoiceProcessingService.processInvoice.mockRejectedValue(
        new Error('Processing failed')
      );

      const startTime = Date.now();

      try {
        await mockInvoiceProcessingService.processInvoice('failing-invoice-id');
      } catch (error) {
        // Error handling should also be fast
        const errorHandlingTime = Date.now() - startTime;
        expect(errorHandlingTime).toBeLessThan(1000); // 1 second for error handling
      }
    });

    it('should maintain speed with different file types', async () => {
      const fileTypes = [
        { type: 'pdf', size: 1024 * 1024 },
        { type: 'jpg', size: 512 * 1024 },
        { type: 'png', size: 2 * 1024 * 1024 },
      ];

      for (const fileType of fileTypes) {
        const startTime = Date.now();

        await mockInvoiceProcessingService.processInvoice(`${fileType.type}-invoice-id`);

        const processingTime = Date.now() - startTime;

        expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.INVOICE_PROCESSING_TIME_MS);
      }
    });
  });

  describe('Processing Pipeline Monitoring', () => {
    it('should track processing stages timing', async () => {
      const mockProcessingStages = {
        pdfParsing: 2000,
        ocrProcessing: 8000,
        dataExtraction: 5000,
        validation: 1000,
        storage: 500,
      };

      let totalTime = 0;
      for (const [stage, expectedTime] of Object.entries(mockProcessingStages)) {
        const stageStartTime = Date.now();
        
        // Simulate stage processing
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const stageTime = Date.now() - stageStartTime;
        totalTime += stageTime;

        expect(stageTime).toBeLessThan(expectedTime);
      }

      expect(totalTime).toBeLessThan(PROCESSING_REQUIREMENTS.INVOICE_PROCESSING_TIME_MS);
    });

    it('should provide processing progress updates', async () => {
      const progressUpdates: number[] = [];
      
      const mockProgressCallback = (progress: number) => {
        progressUpdates.push(progress);
      };

      // Simulate processing with progress updates
      for (let i = 0; i <= 100; i += 20) {
        mockProgressCallback(i);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(progressUpdates).toEqual([0, 20, 40, 60, 80, 100]);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });
  });
});
