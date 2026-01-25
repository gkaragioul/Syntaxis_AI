import { PrismaClient } from '@prisma/client';
import { AdvancedInvoiceFilteringService } from '../../services/advanced-invoice-filtering.service';
import { v4 as uuidv4 } from 'uuid';

// Mock PrismaClient
const mockPrisma = {
  invoice: {
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Advanced Invoice Filtering Service', () => {
  let filteringService: AdvancedInvoiceFilteringService;
  let testUserId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    filteringService = new AdvancedInvoiceFilteringService(mockPrisma);
    testUserId = uuidv4();
  });

  describe('Date Range Filtering', () => {
    it('should filter invoices by invoice date range', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          invoiceDate: new Date('2024-03-15'),
          totalAmount: 1000,
          status: 'processed',
        },
        {
          id: uuidv4(),
          invoiceNumber: 'INV-002',
          invoiceDate: new Date('2024-03-20'),
          totalAmount: 2000,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(2);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        dateFilters: {
          invoiceDateFrom: new Date('2024-03-01'),
          invoiceDateTo: new Date('2024-03-31'),
        },
        page: 1,
        limit: 10,
      });

      expect(result.invoices).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: testUserId,
            invoiceDate: {
              gte: new Date('2024-03-01'),
              lte: new Date('2024-03-31'),
            },
          }),
        }),
      );
    });

    it('should filter invoices by due date range', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          dueDate: new Date('2024-04-15'),
          totalAmount: 1000,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        dateFilters: {
          dueDateFrom: new Date('2024-04-01'),
          dueDateTo: new Date('2024-04-30'),
        },
      });

      expect(result.invoices).toHaveLength(1);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: {
              gte: new Date('2024-04-01'),
              lte: new Date('2024-04-30'),
            },
          }),
        }),
      );
    });

    it('should filter invoices by created date range', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          createdAt: new Date('2024-03-15'),
          totalAmount: 1000,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        dateFilters: {
          createdFrom: new Date('2024-03-01'),
          createdTo: new Date('2024-03-31'),
        },
      });

      expect(result.invoices).toHaveLength(1);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2024-03-01'),
              lte: new Date('2024-03-31'),
            },
          }),
        }),
      );
    });
  });

  describe('Amount Filtering', () => {
    it('should filter invoices by amount range', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          totalAmount: 1500,
          status: 'processed',
        },
        {
          id: uuidv4(),
          invoiceNumber: 'INV-002',
          totalAmount: 2500,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(2);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        amountFilters: {
          minAmount: 1000,
          maxAmount: 3000,
        },
      });

      expect(result.invoices).toHaveLength(2);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            totalAmount: {
              gte: 1000,
              lte: 3000,
            },
          }),
        }),
      );
    });

    it('should filter invoices by tax amount range', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          taxAmount: 100,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        amountFilters: {
          minTaxAmount: 50,
          maxTaxAmount: 150,
        },
      });

      expect(result.invoices).toHaveLength(1);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            taxAmount: {
              gte: 50,
              lte: 150,
            },
          }),
        }),
      );
    });

    it('should filter invoices by currency', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          currency: 'EUR',
          totalAmount: 1000,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        amountFilters: {
          currency: 'EUR',
        },
      });

      expect(result.invoices).toHaveLength(1);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            currency: 'EUR',
          }),
        }),
      );
    });
  });

  describe('Vendor Filtering', () => {
    it('should filter invoices by vendor name', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          vendorName: 'ABC Corporation',
          totalAmount: 1000,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        vendorFilters: {
          vendorName: 'ABC Corporation',
        },
      });

      expect(result.invoices).toHaveLength(1);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vendorName: {
              contains: 'ABC Corporation',
              mode: 'insensitive',
            },
          }),
        }),
      );
    });

    it('should filter invoices by multiple vendors', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          vendorName: 'ABC Corporation',
          totalAmount: 1000,
          status: 'processed',
        },
        {
          id: uuidv4(),
          invoiceNumber: 'INV-002',
          vendorName: 'XYZ Inc',
          totalAmount: 2000,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(2);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        vendorFilters: {
          vendorNames: ['ABC Corporation', 'XYZ Inc'],
        },
      });

      expect(result.invoices).toHaveLength(2);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vendorName: {
              in: ['ABC Corporation', 'XYZ Inc'],
            },
          }),
        }),
      );
    });

    it('should filter invoices by vendor tax ID', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          vendorTaxId: '12-3456789',
          totalAmount: 1000,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        vendorFilters: {
          vendorTaxId: '12-3456789',
        },
      });

      expect(result.invoices).toHaveLength(1);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vendorTaxId: '12-3456789',
          }),
        }),
      );
    });
  });

  describe('Status Filtering', () => {
    it('should filter invoices by single status', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          status: 'processed',
          totalAmount: 1000,
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        statusFilters: {
          status: 'processed',
        },
      });

      expect(result.invoices).toHaveLength(1);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'processed',
          }),
        }),
      );
    });

    it('should filter invoices by multiple statuses', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          status: 'processed',
          totalAmount: 1000,
        },
        {
          id: uuidv4(),
          invoiceNumber: 'INV-002',
          status: 'pending',
          totalAmount: 2000,
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(2);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        statusFilters: {
          statuses: ['processed', 'pending'],
        },
      });

      expect(result.invoices).toHaveLength(2);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: ['processed', 'pending'],
            },
          }),
        }),
      );
    });

    it('should filter invoices by payment status', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          paymentStatus: 'paid',
          totalAmount: 1000,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        statusFilters: {
          paymentStatus: 'paid',
        },
      });

      expect(result.invoices).toHaveLength(1);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            paymentStatus: 'paid',
          }),
        }),
      );
    });
  });

  describe('Confidence-Based Filtering', () => {
    it('should filter invoices by confidence score range', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          extractionConfidence: 0.85,
          totalAmount: 1000,
          status: 'processed',
        },
        {
          id: uuidv4(),
          invoiceNumber: 'INV-002',
          extractionConfidence: 0.92,
          totalAmount: 2000,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(2);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        confidenceFilters: {
          minConfidence: 0.8,
          maxConfidence: 1.0,
        },
      });

      expect(result.invoices).toHaveLength(2);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            extractionConfidence: {
              gte: 0.8,
              lte: 1.0,
            },
          }),
        }),
      );
    });

    it('should filter invoices by confidence level categories', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          extractionConfidence: 0.95,
          totalAmount: 1000,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        confidenceFilters: {
          confidenceLevel: 'high', // high: >= 0.9, medium: 0.7-0.9, low: < 0.7
        },
      });

      expect(result.invoices).toHaveLength(1);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            extractionConfidence: {
              gte: 0.9,
            },
          }),
        }),
      );
    });

    it('should filter invoices requiring manual review', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          extractionConfidence: 0.65,
          validationStatus: 'requires_review',
          totalAmount: 1000,
          status: 'pending',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        confidenceFilters: {
          requiresManualReview: true,
        },
      });

      expect(result.invoices).toHaveLength(1);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { extractionConfidence: { lt: 0.7 } },
              { validationStatus: 'requires_review' },
              { status: 'pending' },
            ],
          }),
        }),
      );
    });
  });

  describe('Advanced Search', () => {
    it('should perform full-text search across multiple fields', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          vendorName: 'ABC Corporation',
          totalAmount: 1000,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        searchFilters: {
          searchTerm: 'ABC',
          searchFields: ['invoiceNumber', 'vendorName', 'customerName'],
        },
      });

      expect(result.invoices).toHaveLength(1);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { invoiceNumber: { contains: 'ABC', mode: 'insensitive' } },
              { vendorName: { contains: 'ABC', mode: 'insensitive' } },
              { customerName: { contains: 'ABC', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should search with regex patterns', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-001',
          totalAmount: 1000,
          status: 'processed',
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        searchFilters: {
          regexPattern: 'INV-2024-\\d{3}',
          regexField: 'invoiceNumber',
        },
      });

      expect(result.invoices).toHaveLength(1);
    });
  });

  describe('Combined Filtering', () => {
    it('should apply multiple filters simultaneously', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          vendorName: 'ABC Corporation',
          totalAmount: 1500,
          status: 'processed',
          extractionConfidence: 0.9,
          invoiceDate: new Date('2024-03-15'),
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        dateFilters: {
          invoiceDateFrom: new Date('2024-03-01'),
          invoiceDateTo: new Date('2024-03-31'),
        },
        amountFilters: {
          minAmount: 1000,
          maxAmount: 2000,
        },
        vendorFilters: {
          vendorName: 'ABC',
        },
        statusFilters: {
          status: 'processed',
        },
        confidenceFilters: {
          minConfidence: 0.8,
        },
      });

      expect(result.invoices).toHaveLength(1);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: testUserId,
            invoiceDate: {
              gte: new Date('2024-03-01'),
              lte: new Date('2024-03-31'),
            },
            totalAmount: {
              gte: 1000,
              lte: 2000,
            },
            vendorName: {
              contains: 'ABC',
              mode: 'insensitive',
            },
            status: 'processed',
            extractionConfidence: {
              gte: 0.8,
            },
          }),
        }),
      );
    });
  });

  describe('Sorting and Pagination', () => {
    it('should support advanced sorting options', async () => {
      const mockInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-001',
          totalAmount: 1000,
          status: 'processed',
          extractionConfidence: 0.9,
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await filteringService.getFilteredInvoices(testUserId, {
        sortOptions: {
          sortBy: 'extractionConfidence',
          sortOrder: 'desc',
          secondarySortBy: 'totalAmount',
          secondarySortOrder: 'asc',
        },
        page: 1,
        limit: 10,
      });

      expect(result.invoices).toHaveLength(1);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ extractionConfidence: 'desc' }, { totalAmount: 'asc' }],
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('Filter Statistics', () => {
    it('should provide filter statistics and aggregations', async () => {
      mockPrisma.invoice.aggregate.mockResolvedValue({
        _count: { _all: 100 },
        _sum: { totalAmount: 50000 },
        _avg: { totalAmount: 500, extractionConfidence: 0.85 },
        _min: { totalAmount: 100, extractionConfidence: 0.6 },
        _max: { totalAmount: 5000, extractionConfidence: 0.98 },
      });

      const stats = await filteringService.getFilterStatistics(testUserId, {
        dateFilters: {
          invoiceDateFrom: new Date('2024-03-01'),
          invoiceDateTo: new Date('2024-03-31'),
        },
      });

      expect(stats).toEqual(
        expect.objectContaining({
          totalCount: 100,
          totalAmount: 50000,
          averageAmount: 500,
          averageConfidence: 0.85,
          minAmount: 100,
          maxAmount: 5000,
          confidenceRange: {
            min: 0.6,
            max: 0.98,
          },
        }),
      );
    });
  });
});
