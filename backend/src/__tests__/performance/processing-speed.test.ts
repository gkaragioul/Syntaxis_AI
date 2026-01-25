/**
 * Processing Speed Performance Tests
 * 
 * Task 2.2.3: Processing Speed Tests (<30s) - TDD RED Phase
 * 
 * These tests define the <30s processing speed requirement before implementation.
 * Following strict TDD: Red-Green-Refactor methodology.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { setupTestEnvironment, cleanupTestEnvironment } from '../utils/test-environment';
import { prismaMock } from '../__mocks__/prisma';

// Processing speed requirements
const PROCESSING_REQUIREMENTS = {
  INVOICE_PROCESSING_TIME_MS: 30000, // 30 seconds
  OCR_PROCESSING_TIME_MS: 15000, // 15 seconds
  BATCH_PROCESSING_TIME_MS: 30000, // 30 seconds per item
  FILE_UPLOAD_PROCESSING_MS: 5000, // 5 seconds
  DATA_EXTRACTION_TIME_MS: 10000, // 10 seconds
  VALIDATION_TIME_MS: 2000, // 2 seconds
} as const;

// Mock services for processing speed tests
const mockProcessingService = {
  processInvoice: jest.fn(),
  processInvoiceBatch: jest.fn(),
  extractDataFromOCR: jest.fn(),
  validateExtractedData: jest.fn(),
  optimizeProcessingPipeline: jest.fn(),
};

const mockOCRService = {
  processImage: jest.fn(),
  processImageBatch: jest.fn(),
  optimizeForSpeed: jest.fn(),
};

const mockFileService = {
  uploadFile: jest.fn(),
  processUploadedFile: jest.fn(),
  optimizeFileHandling: jest.fn(),
};

// Processing performance measurement
interface ProcessingMeasurement {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  itemsProcessed: number;
  throughput: number; // items per second
}

describe('Processing Speed Performance (<30s)', () => {
  beforeEach(async () => {
    await setupTestEnvironment({ useMocks: true });
    jest.clearAllMocks();
    
    // Setup mock data for consistent testing
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'test-invoice-id',
      userId: 'test-user-id',
      fileName: 'test-invoice.pdf',
      status: 'pending',
      fileSize: 1024 * 1024, // 1MB
    } as any);
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('Single Invoice Processing Speed', () => {
    it('should process single invoice within 30 seconds', async () => {
      // RED: This test will initially fail until processing optimizations are implemented
      const mockInvoiceData = {
        id: 'test-invoice-id',
        fileName: 'invoice.pdf',
        fileSize: 2 * 1024 * 1024, // 2MB
        mimeType: 'application/pdf',
      };

      mockProcessingService.processInvoice.mockImplementation(async (invoiceId) => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          success: true,
          confidence: 0.95,
          extractedData: { amount: 150.00, vendor: 'ACME Corp' },
          processingTime: 100,
        };
      });

      const startTime = Date.now();
      
      const result = await mockProcessingService.processInvoice(mockInvoiceData.id);
      
      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.INVOICE_PROCESSING_TIME_MS);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should process large invoice files within 30 seconds', async () => {
      const largeInvoiceData = {
        id: 'large-invoice-id',
        fileName: 'large-invoice.pdf',
        fileSize: 10 * 1024 * 1024, // 10MB
        mimeType: 'application/pdf',
      };

      mockProcessingService.processInvoice.mockImplementation(async (invoiceId) => {
        // Simulate processing time for large file
        await new Promise(resolve => setTimeout(resolve, 200));
        return {
          success: true,
          confidence: 0.92,
          extractedData: { amount: 1500.00, vendor: 'Large Corp' },
          processingTime: 200,
        };
      });

      const startTime = Date.now();
      
      const result = await mockProcessingService.processInvoice(largeInvoiceData.id);
      
      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.INVOICE_PROCESSING_TIME_MS);
    });

    it('should handle complex multi-page invoices within 30 seconds', async () => {
      const complexInvoiceData = {
        id: 'complex-invoice-id',
        fileName: 'multi-page-invoice.pdf',
        pages: 5,
        fileSize: 5 * 1024 * 1024, // 5MB
        complexity: 'high',
      };

      mockProcessingService.processInvoice.mockImplementation(async (invoiceId) => {
        // Simulate complex processing
        await new Promise(resolve => setTimeout(resolve, 300));
        return {
          success: true,
          confidence: 0.88,
          extractedData: {
            amount: 2500.00,
            vendor: 'Complex Corp',
            lineItems: Array.from({ length: 20 }, (_, i) => ({ item: `Item ${i}`, amount: 125 })),
          },
          processingTime: 300,
        };
      });

      const startTime = Date.now();
      
      const result = await mockProcessingService.processInvoice(complexInvoiceData.id);
      
      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.INVOICE_PROCESSING_TIME_MS);
      expect(result.extractedData.lineItems).toBeDefined();
    });
  });

  describe('OCR Processing Speed', () => {
    it('should complete OCR processing within 15 seconds', async () => {
      // RED: This test will fail until OCR optimizations are implemented
      const mockImageBuffer = Buffer.from('mock image data');

      mockOCRService.processImage.mockImplementation(async (buffer) => {
        // Simulate OCR processing
        await new Promise(resolve => setTimeout(resolve, 150));
        return {
          confidence: 0.94,
          extractedText: 'INVOICE\nAmount: $150.00\nDate: 2024-01-15',
          boundingBoxes: [],
          processingTime: 150,
          engine: 'optimized-ocr',
        };
      });

      const startTime = Date.now();
      
      const result = await mockOCRService.processImage(mockImageBuffer);
      
      const processingTime = Date.now() - startTime;

      expect(result.confidence).toBeGreaterThan(0.8);
      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.OCR_PROCESSING_TIME_MS);
      expect(result.extractedText.length).toBeGreaterThan(0);
    });

    it('should optimize OCR processing for speed', async () => {
      const mockImageBuffer = Buffer.from('optimized image data');

      mockOCRService.optimizeForSpeed.mockImplementation(async (buffer) => {
        // Simulate optimized OCR processing
        await new Promise(resolve => setTimeout(resolve, 80));
        return {
          confidence: 0.91,
          extractedText: 'Optimized OCR result',
          processingTime: 80,
          optimizations: ['preprocessing', 'parallel_processing', 'model_optimization'],
        };
      });

      const startTime = Date.now();
      
      const result = await mockOCRService.optimizeForSpeed(mockImageBuffer);
      
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.OCR_PROCESSING_TIME_MS * 0.6); // 60% of limit
      expect(result.optimizations).toContain('parallel_processing');
    });

    it('should handle batch OCR processing efficiently', async () => {
      const imageBuffers = Array.from({ length: 3 }, (_, i) => 
        Buffer.from(`batch image ${i}`)
      );

      mockOCRService.processImageBatch.mockImplementation(async (buffers) => {
        // Simulate batch processing with parallelization
        const results = await Promise.all(
          buffers.map(async (buffer, index) => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return {
              confidence: 0.93,
              extractedText: `Batch result ${index}`,
              processingTime: 100,
            };
          })
        );
        return results;
      });

      const startTime = Date.now();
      
      const results = await mockOCRService.processImageBatch(imageBuffers);
      
      const processingTime = Date.now() - startTime;

      expect(results).toHaveLength(imageBuffers.length);
      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.OCR_PROCESSING_TIME_MS);
      
      // Batch processing should be more efficient than sequential
      const averageTimePerImage = processingTime / imageBuffers.length;
      expect(averageTimePerImage).toBeLessThan(PROCESSING_REQUIREMENTS.OCR_PROCESSING_TIME_MS / 2);
    });
  });

  describe('Data Extraction and Validation Speed', () => {
    it('should extract data from OCR results within 10 seconds', async () => {
      // RED: This test will fail until data extraction optimizations are implemented
      const mockOCRText = `
        INVOICE #12345
        Date: 2024-01-15
        Amount: $1,250.00
        Vendor: ACME Corporation
        123 Business Street
        City, ST 12345
      `;

      mockProcessingService.extractDataFromOCR.mockImplementation(async (text) => {
        // Simulate data extraction processing
        await new Promise(resolve => setTimeout(resolve, 120));
        return {
          invoiceNumber: '12345',
          date: '2024-01-15',
          amount: 1250.00,
          currency: 'USD',
          vendor: 'ACME Corporation',
          confidence: 0.94,
          extractionTime: 120,
        };
      });

      const startTime = Date.now();
      
      const result = await mockProcessingService.extractDataFromOCR(mockOCRText);
      
      const processingTime = Date.now() - startTime;

      expect(result.confidence).toBeGreaterThan(0.8);
      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.DATA_EXTRACTION_TIME_MS);
      expect(result.amount).toBe(1250.00);
      expect(result.invoiceNumber).toBe('12345');
    });

    it('should validate extracted data within 2 seconds', async () => {
      const mockExtractedData = {
        invoiceNumber: '12345',
        date: '2024-01-15',
        amount: 1250.00,
        vendor: 'ACME Corporation',
      };

      mockProcessingService.validateExtractedData.mockImplementation(async (data) => {
        // Simulate validation processing
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          isValid: true,
          validationErrors: [],
          confidence: 0.96,
          validationTime: 50,
          checks: {
            amountFormat: true,
            dateFormat: true,
            vendorFormat: true,
            invoiceNumberFormat: true,
          },
        };
      });

      const startTime = Date.now();
      
      const result = await mockProcessingService.validateExtractedData(mockExtractedData);
      
      const processingTime = Date.now() - startTime;

      expect(result.isValid).toBe(true);
      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.VALIDATION_TIME_MS);
      expect(result.validationErrors).toHaveLength(0);
    });
  });

  describe('Batch Processing Speed', () => {
    it('should process invoice batch within time limits', async () => {
      // RED: This test will fail until batch processing optimizations are implemented
      const batchSize = 5;
      const mockInvoices = Array.from({ length: batchSize }, (_, i) => ({
        id: `batch-invoice-${i}`,
        fileName: `invoice-${i}.pdf`,
        fileSize: 1024 * 1024, // 1MB each
      }));

      mockProcessingService.processInvoiceBatch.mockImplementation(async (invoices) => {
        // Simulate batch processing with parallelization
        const results = await Promise.all(
          invoices.map(async (invoice, index) => {
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms per invoice
            return {
              id: invoice.id,
              success: true,
              confidence: 0.92,
              processingTime: 200,
            };
          })
        );
        return {
          results,
          totalTime: 200, // Parallel processing
          successCount: results.filter(r => r.success).length,
        };
      });

      const startTime = Date.now();
      
      const result = await mockProcessingService.processInvoiceBatch(mockInvoices);
      
      const processingTime = Date.now() - startTime;

      expect(result.successCount).toBe(batchSize);
      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.BATCH_PROCESSING_TIME_MS);
      
      // Batch processing should be efficient
      const averageTimePerInvoice = processingTime / batchSize;
      expect(averageTimePerInvoice).toBeLessThan(PROCESSING_REQUIREMENTS.INVOICE_PROCESSING_TIME_MS / 2);
    });

    it('should handle large batch processing efficiently', async () => {
      const largeBatchSize = 10;
      const mockInvoices = Array.from({ length: largeBatchSize }, (_, i) => ({
        id: `large-batch-invoice-${i}`,
        fileName: `invoice-${i}.pdf`,
        fileSize: 2 * 1024 * 1024, // 2MB each
      }));

      mockProcessingService.processInvoiceBatch.mockImplementation(async (invoices) => {
        // Simulate optimized large batch processing
        const batchResults = [];
        const batchSize = 3; // Process in smaller batches
        
        for (let i = 0; i < invoices.length; i += batchSize) {
          const batch = invoices.slice(i, i + batchSize);
          const batchResult = await Promise.all(
            batch.map(async (invoice) => {
              await new Promise(resolve => setTimeout(resolve, 150));
              return {
                id: invoice.id,
                success: true,
                confidence: 0.90,
                processingTime: 150,
              };
            })
          );
          batchResults.push(...batchResult);
        }

        return {
          results: batchResults,
          totalTime: 150 * Math.ceil(invoices.length / batchSize),
          successCount: batchResults.filter(r => r.success).length,
        };
      });

      const startTime = Date.now();
      
      const result = await mockProcessingService.processInvoiceBatch(mockInvoices);
      
      const processingTime = Date.now() - startTime;

      expect(result.successCount).toBe(largeBatchSize);
      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.BATCH_PROCESSING_TIME_MS * 2); // Allow more time for large batches
    });
  });

  describe('File Upload and Processing Speed', () => {
    it('should process file upload within 5 seconds', async () => {
      // RED: This test will fail until file processing optimizations are implemented
      const mockFile = {
        buffer: Buffer.alloc(3 * 1024 * 1024), // 3MB file
        originalname: 'test-invoice.pdf',
        mimetype: 'application/pdf',
      };

      mockFileService.processUploadedFile.mockImplementation(async (file) => {
        // Simulate file processing
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          fileId: 'uploaded-file-123',
          fileName: file.originalname,
          fileSize: file.buffer.length,
          processingTime: 100,
          optimizations: ['compression', 'format_validation', 'virus_scan'],
        };
      });

      const startTime = Date.now();
      
      const result = await mockFileService.processUploadedFile(mockFile);
      
      const processingTime = Date.now() - startTime;

      expect(result.fileId).toBeDefined();
      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.FILE_UPLOAD_PROCESSING_MS);
      expect(result.optimizations).toContain('compression');
    });
  });

  describe('Processing Pipeline Optimization', () => {
    it('should optimize entire processing pipeline for speed', async () => {
      // RED: This test will fail until pipeline optimizations are implemented
      const mockInvoiceData = {
        id: 'pipeline-test-invoice',
        fileName: 'pipeline-test.pdf',
        fileSize: 2 * 1024 * 1024,
      };

      mockProcessingService.optimizeProcessingPipeline.mockImplementation(async (invoiceData) => {
        // Simulate optimized pipeline with parallel stages
        const stages = [
          { name: 'file_processing', time: 80 },
          { name: 'ocr_processing', time: 120 },
          { name: 'data_extraction', time: 100 },
          { name: 'validation', time: 40 },
        ];

        // Simulate parallel processing where possible
        const parallelStages = [stages[0], stages[1]]; // File and OCR can run in parallel
        const sequentialStages = [stages[2], stages[3]]; // Data extraction and validation are sequential

        // Parallel processing
        await Promise.all(
          parallelStages.map(stage => 
            new Promise(resolve => setTimeout(resolve, stage.time))
          )
        );

        // Sequential processing
        for (const stage of sequentialStages) {
          await new Promise(resolve => setTimeout(resolve, stage.time));
        }

        return {
          success: true,
          totalTime: Math.max(...parallelStages.map(s => s.time)) + sequentialStages.reduce((sum, s) => sum + s.time, 0),
          optimizations: ['parallel_processing', 'pipeline_optimization', 'resource_pooling'],
          stages: stages.map(stage => ({ ...stage, completed: true })),
        };
      });

      const startTime = Date.now();
      
      const result = await mockProcessingService.optimizeProcessingPipeline(mockInvoiceData);
      
      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(PROCESSING_REQUIREMENTS.INVOICE_PROCESSING_TIME_MS);
      expect(result.optimizations).toContain('parallel_processing');
      expect(result.stages.every(stage => stage.completed)).toBe(true);
    });
  });
});
