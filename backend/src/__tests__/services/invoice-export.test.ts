import { InvoiceExportService } from '../../services/invoice-export.service';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// Mock file system operations
jest.mock('fs');
jest.mock('path');

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

// Mock PrismaClient
const mockPrisma = {
  invoice: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  exportJob: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Invoice Export Service', () => {
  let exportService: InvoiceExportService;
  let testUserId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    testUserId = uuidv4();

    // Setup path mocks
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.resolve.mockImplementation((...args) => '/' + args.join('/'));

    // Setup fs mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation(() => {});

    exportService = new InvoiceExportService(mockPrisma);
  });

  describe('CSV Export', () => {
    it('should export invoices to CSV format', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-001',
          invoiceDate: new Date('2024-03-15'),
          vendorName: 'ABC Corporation',
          totalAmount: 1000,
          status: 'processed',
          currency: 'USD',
        },
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-002',
          invoiceDate: new Date('2024-03-16'),
          vendorName: 'XYZ Inc',
          totalAmount: 2000,
          status: 'processed',
          currency: 'USD',
        },
      ];

      const mockExportJob = {
        id: uuidv4(),
        userId: testUserId,
        format: 'csv',
        status: 'completed',
        filePath: '/exports/invoices.csv',
      };

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.exportJob.create.mockResolvedValue(mockExportJob);
      mockPrisma.exportJob.update.mockResolvedValue({
        ...mockExportJob,
        status: 'completed',
      });
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      const result = await exportService.exportInvoices(testUserId, {
        format: 'csv',
        filters: {
          dateFrom: new Date('2024-03-01'),
          dateTo: new Date('2024-03-31'),
        },
        fields: [
          'invoiceNumber',
          'invoiceDate',
          'vendorName',
          'totalAmount',
          'status',
        ],
      });

      console.log('Export result:', result);
      expect(result.success).toBe(true);
      expect(result.exportId).toBeDefined();
      expect(result.downloadUrl).toContain('.csv');
      expect(mockFs.writeFileSync).toHaveBeenCalled();

      // Check CSV content structure
      const csvCall = mockFs.writeFileSync.mock.calls[0];
      const csvContent = csvCall[1] as string;
      expect(csvContent).toContain(
        'Invoice Number,Invoice Date,Vendor Name,Total Amount,Status',
      );
      expect(csvContent).toContain('INV-2024-001');
      expect(csvContent).toContain('ABC Corporation');
    });

    it('should handle custom field selection for CSV export', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-001',
          vendorName: 'ABC Corporation',
          totalAmount: 1000,
          taxAmount: 100,
          currency: 'USD',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'completed' });
      mockFs.writeFileSync.mockImplementation(() => {});

      await exportService.exportInvoices(testUserId, {
        format: 'csv',
        fields: ['invoiceNumber', 'vendorName', 'totalAmount'],
      });

      const csvCall = mockFs.writeFileSync.mock.calls[0];
      const csvContent = csvCall[1] as string;
      expect(csvContent).toContain('Invoice Number,Vendor Name,Total Amount');
      expect(csvContent).not.toContain('Tax Amount');
      expect(csvContent).not.toContain('Currency');
    });

    it('should escape special characters in CSV', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-001',
          vendorName: 'ABC "Corporation", Ltd.',
          description: 'Service with, commas and "quotes"',
          totalAmount: 1000,
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'completed' });
      mockFs.writeFileSync.mockImplementation(() => {});

      await exportService.exportInvoices(testUserId, {
        format: 'csv',
        fields: ['invoiceNumber', 'vendorName', 'description'],
      });

      const csvCall = mockFs.writeFileSync.mock.calls[0];
      const csvContent = csvCall[1] as string;
      expect(csvContent).toContain('"ABC ""Corporation"", Ltd."');
      expect(csvContent).toContain('"Service with, commas and ""quotes"""');
    });
  });

  describe('Excel Export', () => {
    it('should export invoices to Excel format', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-001',
          invoiceDate: new Date('2024-03-15'),
          vendorName: 'ABC Corporation',
          totalAmount: 1000,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'completed' });

      const result = await exportService.exportInvoices(testUserId, {
        format: 'excel',
        fields: [
          'invoiceNumber',
          'invoiceDate',
          'vendorName',
          'totalAmount',
          'status',
        ],
      });

      expect(result.success).toBe(true);
      expect(result.downloadUrl).toContain('.xlsx');
      expect(result.metadata.format).toBe('excel');
      expect(result.metadata.recordCount).toBe(1);
    });

    it('should create multiple worksheets for Excel export', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-001',
          vendorName: 'ABC Corporation',
          totalAmount: 1000,
          lineItems: [
            {
              description: 'Product A',
              quantity: 2,
              unitPrice: 500,
              amount: 1000,
            },
          ],
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'completed' });

      const result = await exportService.exportInvoices(testUserId, {
        format: 'excel',
        includeLineItems: true,
        worksheets: ['invoices', 'line_items'],
      });

      expect(result.success).toBe(true);
      expect(result.metadata.worksheets).toEqual(['invoices', 'line_items']);
    });

    it('should apply Excel formatting and styling', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-001',
          totalAmount: 1000,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'completed' });

      const result = await exportService.exportInvoices(testUserId, {
        format: 'excel',
        styling: {
          headerStyle: {
            bold: true,
            backgroundColor: '#4472C4',
            fontColor: '#FFFFFF',
          },
          numberFormat: '#,##0.00',
          dateFormat: 'mm/dd/yyyy',
        },
      });

      expect(result.success).toBe(true);
      expect(result.metadata.styling).toBeDefined();
    });
  });

  describe('PDF Export', () => {
    it('should export invoices to PDF format', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-001',
          invoiceDate: new Date('2024-03-15'),
          vendorName: 'ABC Corporation',
          totalAmount: 1000,
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'completed' });

      const result = await exportService.exportInvoices(testUserId, {
        format: 'pdf',
        template: 'invoice_summary',
        pageOrientation: 'landscape',
      });

      expect(result.success).toBe(true);
      expect(result.downloadUrl).toContain('.pdf');
      expect(result.metadata.template).toBe('invoice_summary');
      expect(result.metadata.pageOrientation).toBe('landscape');
    });

    it('should generate PDF with custom template', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-001',
          vendorName: 'ABC Corporation',
          totalAmount: 1000,
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'completed' });

      const result = await exportService.exportInvoices(testUserId, {
        format: 'pdf',
        template: 'detailed_report',
        customTemplate: {
          header: 'Invoice Export Report',
          footer: 'Generated on {{date}}',
          includeCharts: true,
          includeSummary: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.metadata.customTemplate).toBeDefined();
    });
  });

  describe('JSON Export', () => {
    it('should export invoices to JSON format', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-001',
          vendorName: 'ABC Corporation',
          totalAmount: 1000,
          lineItems: [{ description: 'Product A', amount: 1000 }],
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'completed' });
      mockFs.writeFileSync.mockImplementation(() => {});

      const result = await exportService.exportInvoices(testUserId, {
        format: 'json',
        includeRelatedData: true,
      });

      expect(result.success).toBe(true);
      expect(result.downloadUrl).toContain('.json');

      const jsonCall = mockFs.writeFileSync.mock.calls[0];
      const jsonContent = JSON.parse(jsonCall[1] as string);
      expect(jsonContent.invoices).toHaveLength(1);
      expect(jsonContent.invoices[0].lineItems).toBeDefined();
    });

    it('should format JSON with proper structure', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-001',
          totalAmount: 1000,
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'completed' });
      mockFs.writeFileSync.mockImplementation(() => {});

      await exportService.exportInvoices(testUserId, {
        format: 'json',
        jsonFormat: {
          pretty: true,
          includeMetadata: true,
          includeSchema: true,
        },
      });

      const jsonCall = mockFs.writeFileSync.mock.calls[0];
      const jsonContent = jsonCall[1] as string;
      expect(jsonContent).toContain('"metadata"');
      expect(jsonContent).toContain('"schema"');
      expect(jsonContent).toContain('\n'); // Pretty formatted
    });
  });

  describe('Batch Export', () => {
    it('should handle large dataset export with pagination', async () => {
      const mockInvoices = Array.from({ length: 1000 }, (_, i) => ({
        id: uuidv4(),
        invoiceNumber: `INV-2024-${String(i + 1).padStart(3, '0')}`,
        totalAmount: 1000 + i,
      }));

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1000);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'completed' });
      mockFs.writeFileSync.mockImplementation(() => {});

      const result = await exportService.exportInvoices(testUserId, {
        format: 'csv',
        batchSize: 100,
        enablePagination: true,
      });

      expect(result.success).toBe(true);
      expect(result.metadata.totalRecords).toBe(1000);
      expect(result.metadata.batchSize).toBe(100);
      expect(result.metadata.batches).toBe(10);
    });

    it('should export multiple files for large datasets', async () => {
      const mockInvoices = Array.from({ length: 5000 }, (_, i) => ({
        id: uuidv4(),
        invoiceNumber: `INV-2024-${String(i + 1).padStart(4, '0')}`,
        totalAmount: 1000 + i,
      }));

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(5000);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'completed' });
      mockFs.writeFileSync.mockImplementation(() => {});

      const result = await exportService.exportInvoices(testUserId, {
        format: 'csv',
        splitLargeFiles: true,
        maxRecordsPerFile: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(5);
      expect(result.files[0].filename).toContain('_part_1');
      expect(result.files[4].filename).toContain('_part_5');
    });
  });

  describe('Custom Field Selection', () => {
    it('should export only selected fields', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-001',
          invoiceDate: new Date('2024-03-15'),
          vendorName: 'ABC Corporation',
          vendorAddress: '123 Main St',
          totalAmount: 1000,
          taxAmount: 100,
          currency: 'USD',
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'completed' });
      mockFs.writeFileSync.mockImplementation(() => {});

      await exportService.exportInvoices(testUserId, {
        format: 'csv',
        fields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        excludeFields: ['id', 'vendorAddress', 'taxAmount'],
      });

      const csvCall = mockFs.writeFileSync.mock.calls[0];
      const csvContent = csvCall[1] as string;
      expect(csvContent).toContain('Invoice Number,Vendor Name,Total Amount');
      expect(csvContent).not.toContain('Vendor Address');
      expect(csvContent).not.toContain('Tax Amount');
    });

    it('should apply field transformations', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-001',
          totalAmount: 1000.5,
          invoiceDate: new Date('2024-03-15'),
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'completed' });
      mockFs.writeFileSync.mockImplementation(() => {});

      await exportService.exportInvoices(testUserId, {
        format: 'csv',
        fieldTransformations: {
          totalAmount: (value: number) => `$${value.toFixed(2)}`,
          invoiceDate: (value: Date) => value.toISOString().split('T')[0],
        },
      });

      const csvCall = mockFs.writeFileSync.mock.calls[0];
      const csvContent = csvCall[1] as string;
      expect(csvContent).toContain('$1000.50');
      expect(csvContent).toContain('2024-03-15');
    });
  });

  describe('Export Job Management', () => {
    it('should track export job status', async () => {
      const exportJobId = uuidv4();
      const mockExportJob = {
        id: exportJobId,
        userId: testUserId,
        status: 'in_progress',
        progress: 50,
        totalRecords: 100,
        processedRecords: 50,
      };

      mockPrisma.exportJob.findUnique.mockResolvedValue(mockExportJob);

      const status = await exportService.getExportStatus(exportJobId);

      expect(status.status).toBe('in_progress');
      expect(status.progress).toBe(50);
      expect(status.totalRecords).toBe(100);
      expect(status.processedRecords).toBe(50);
    });

    it('should handle export job cancellation', async () => {
      const exportJobId = uuidv4();
      const mockExportJob = {
        id: exportJobId,
        userId: testUserId,
        status: 'in_progress',
      };

      mockPrisma.exportJob.findUnique.mockResolvedValue(mockExportJob);
      mockPrisma.exportJob.update.mockResolvedValue({
        ...mockExportJob,
        status: 'cancelled',
      });

      const result = await exportService.cancelExport(exportJobId, testUserId);

      expect(result.success).toBe(true);
      expect(result.status).toBe('cancelled');
      expect(mockPrisma.exportJob.update).toHaveBeenCalledWith({
        where: { id: exportJobId },
        data: { status: 'cancelled', completedAt: expect.any(Date) },
      });
    });

    it('should provide export history for user', async () => {
      const mockExportHistory = [
        {
          id: uuidv4(),
          userId: testUserId,
          format: 'csv',
          status: 'completed',
          recordCount: 100,
          createdAt: new Date(),
        },
        {
          id: uuidv4(),
          userId: testUserId,
          format: 'excel',
          status: 'completed',
          recordCount: 50,
          createdAt: new Date(),
        },
      ];

      mockPrisma.exportJob.findMany.mockResolvedValue(mockExportHistory);

      const history = await exportService.getExportHistory(testUserId);

      expect(history).toHaveLength(2);
      expect(history[0].format).toBe('csv');
      expect(history[1].format).toBe('excel');
    });
  });

  describe('Error Handling', () => {
    it('should handle export failures gracefully', async () => {
      mockPrisma.invoice.findMany.mockRejectedValue(
        new Error('Database error'),
      );
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'failed' });

      const result = await exportService.exportInvoices(testUserId, {
        format: 'csv',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
      expect(mockPrisma.exportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
            error: expect.any(String),
          }),
        }),
      );
    });

    it('should validate export parameters', async () => {
      const result = await exportService.exportInvoices(testUserId, {
        format: 'invalid_format' as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid export format');
    });

    it('should handle file system errors', async () => {
      const mockInvoices = [{ id: uuidv4(), invoiceNumber: 'INV-001' }];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'failed' });
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });

      const result = await exportService.exportInvoices(testUserId, {
        format: 'csv',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Disk full');
    });
  });

  describe('Performance and Optimization', () => {
    it('should stream large exports to avoid memory issues', async () => {
      const mockInvoices = Array.from({ length: 10000 }, (_, i) => ({
        id: uuidv4(),
        invoiceNumber: `INV-${i}`,
        totalAmount: 1000,
      }));

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'completed' });

      const result = await exportService.exportInvoices(testUserId, {
        format: 'csv',
        useStreaming: true,
        streamChunkSize: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.metadata.streamingUsed).toBe(true);
      expect(result.metadata.chunkSize).toBe(1000);
    });

    it('should compress large export files', async () => {
      const mockInvoices = Array.from({ length: 5000 }, (_, i) => ({
        id: uuidv4(),
        invoiceNumber: `INV-${i}`,
        totalAmount: 1000,
      }));

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.exportJob.create.mockResolvedValue({ id: uuidv4() });
      mockPrisma.exportJob.update.mockResolvedValue({ status: 'completed' });

      const result = await exportService.exportInvoices(testUserId, {
        format: 'csv',
        compression: 'gzip',
        compressionLevel: 6,
      });

      expect(result.success).toBe(true);
      expect(result.downloadUrl).toContain('.gz');
      expect(result.metadata.compression).toBe('gzip');
    });
  });
});
