// @ts-nocheck

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

interface DateFilters {
  invoiceDateFrom?: Date;
  invoiceDateTo?: Date;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  createdFrom?: Date;
  createdTo?: Date;
}

interface AmountFilters {
  minAmount?: number;
  maxAmount?: number;
  minTaxAmount?: number;
  maxTaxAmount?: number;
  minSubtotal?: number;
  maxSubtotal?: number;
  currency?: string;
}

interface VendorFilters {
  vendorName?: string;
  vendorNames?: string[];
  vendorTaxId?: string;
  vendorAddress?: string;
}

interface StatusFilters {
  status?: string;
  statuses?: string[];
  paymentStatus?: string;
  paymentStatuses?: string[];
  validationStatus?: string;
}

interface ConfidenceFilters {
  minConfidence?: number;
  maxConfidence?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
  requiresManualReview?: boolean;
  templateMatchConfidence?: number;
  ocrQuality?: 'high' | 'medium' | 'low';
}

interface SearchFilters {
  searchTerm?: string;
  searchFields?: string[];
  regexPattern?: string;
  regexField?: string;
  exactMatch?: boolean;
}

interface SortOptions {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  secondarySortBy?: string;
  secondarySortOrder?: 'asc' | 'desc';
}

interface AdvancedFilterOptions {
  dateFilters?: DateFilters;
  amountFilters?: AmountFilters;
  vendorFilters?: VendorFilters;
  statusFilters?: StatusFilters;
  confidenceFilters?: ConfidenceFilters;
  searchFilters?: SearchFilters;
  sortOptions?: SortOptions;
  page?: number;
  limit?: number;
  includeArchived?: boolean;
  includeDeleted?: boolean;
}

interface FilterStatistics {
  totalCount: number;
  totalAmount: number;
  averageAmount: number;
  averageConfidence: number;
  minAmount: number;
  maxAmount: number;
  confidenceRange: {
    min: number;
    max: number;
  };
  statusDistribution: { [key: string]: number };
  vendorDistribution: { [key: string]: number };
  monthlyDistribution: { [key: string]: number };
}

interface FilteredInvoicesResult {
  invoices: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  statistics?: FilterStatistics;
}

export class AdvancedInvoiceFilteringService {
  constructor(private prisma: PrismaClient) {}

  async getFilteredInvoices(
    userId: string,
    options: AdvancedFilterOptions = {},
  ): Promise<FilteredInvoicesResult> {
    const {
      page = 1,
      limit = 10,
      includeArchived = false,
      includeDeleted = false,
    } = options;

    // Build where clause
    const where = this.buildWhereClause(userId, options);

    // Build order by clause
    const orderBy = this.buildOrderByClause(options.sortOptions);

    // Calculate pagination
    const skip = (page - 1) * limit;

    try {
      // Execute queries in parallel
      const [invoices, total] = await Promise.all([
        this.prisma.invoice.findMany({
          where,
          include: {
            file: true,
            user: { select: { id: true, email: true } },
            lineItems: true,
            attachments: true,
            validationResults: true,
          },
          orderBy,
          skip,
          take: limit,
        }),
        this.prisma.invoice.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      logger.info('Advanced invoice filtering completed', {
        userId,
        total,
        page,
        limit,
        filtersApplied: Object.keys(options).length,
      });

      return {
        invoices,
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    } catch (error) {
      logger.error('Failed to filter invoices', { error, userId, options });
      throw error;
    }
  }

  async getFilterStatistics(
    userId: string,
    options: AdvancedFilterOptions = {},
  ): Promise<FilterStatistics> {
    const where = this.buildWhereClause(userId, options);

    try {
      const [aggregation, statusCounts, vendorCounts] = await Promise.all([
        this.prisma.invoice.aggregate({
          where,
          _count: { _all: true },
          _sum: { totalAmount: true },
          _avg: { totalAmount: true, extractionConfidence: true },
          _min: { totalAmount: true, extractionConfidence: true },
          _max: { totalAmount: true, extractionConfidence: true },
        }),
        this.prisma.invoice.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.invoice.groupBy({
          by: ['vendorName'],
          where: { ...where, vendorName: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { _all: 'desc' } },
          take: 10,
        }),
      ]);

      const statusDistribution = statusCounts.reduce(
        (acc, item) => {
          acc[item.status] = item._count._all;
          return acc;
        },
        {} as { [key: string]: number },
      );

      const vendorDistribution = vendorCounts.reduce(
        (acc, item) => {
          if (item.vendorName) {
            acc[item.vendorName] = item._count._all;
          }
          return acc;
        },
        {} as { [key: string]: number },
      );

      // Calculate monthly distribution
      const monthlyData = await this.prisma.invoice.groupBy({
        by: ['invoiceDate'],
        where: { ...where, invoiceDate: { not: null } },
        _count: { _all: true },
      });

      const monthlyDistribution = monthlyData.reduce(
        (acc, item) => {
          if (item.invoiceDate) {
            const monthKey = new Date(item.invoiceDate).toISOString().substring(0, 7); // YYYY-MM
            acc[monthKey] = (acc[monthKey] || 0) + item._count._all;
          }
          return acc;
        },
        {} as { [key: string]: number },
      );

      return {
        totalCount: aggregation._count._all,
        totalAmount: Number(aggregation._sum.totalAmount) || 0,
        averageAmount: Number(aggregation._avg.totalAmount) || 0,
        averageConfidence: Number(aggregation._avg.extractionConfidence) || 0,
        minAmount: Number(aggregation._min.totalAmount) || 0,
        maxAmount: Number(aggregation._max.totalAmount) || 0,
        confidenceRange: {
          min: Number(aggregation._min.extractionConfidence) || 0,
          max: Number(aggregation._max.extractionConfidence) || 0,
        },
        statusDistribution,
        vendorDistribution,
        monthlyDistribution,
      };
    } catch (error) {
      logger.error('Failed to get filter statistics', {
        error,
        userId,
        options,
      });
      throw error;
    }
  }

  private buildWhereClause(
    userId: string,
    options: AdvancedFilterOptions,
  ): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = {
      userId,
    };

    // Handle archived and deleted items
    if (!options.includeArchived) {
      where.archivedAt = null;
    }

    // Date filters
    if (options.dateFilters) {
      this.applyDateFilters(where, options.dateFilters);
    }

    // Amount filters
    if (options.amountFilters) {
      this.applyAmountFilters(where, options.amountFilters);
    }

    // Vendor filters
    if (options.vendorFilters) {
      this.applyVendorFilters(where, options.vendorFilters);
    }

    // Status filters
    if (options.statusFilters) {
      this.applyStatusFilters(where, options.statusFilters);
    }

    // Confidence filters
    if (options.confidenceFilters) {
      this.applyConfidenceFilters(where, options.confidenceFilters);
    }

    // Search filters
    if (options.searchFilters) {
      this.applySearchFilters(where, options.searchFilters);
    }

    return where;
  }

  private applyDateFilters(
    where: Prisma.InvoiceWhereInput,
    filters: DateFilters,
  ): void {
    if (filters.invoiceDateFrom || filters.invoiceDateTo) {
      where.invoiceDate = {};
      if (filters.invoiceDateFrom) {
        where.invoiceDate.gte = filters.invoiceDateFrom;
      }
      if (filters.invoiceDateTo) {
        where.invoiceDate.lte = filters.invoiceDateTo;
      }
    }

    if (filters.dueDateFrom || filters.dueDateTo) {
      where.dueDate = {};
      if (filters.dueDateFrom) {
        where.dueDate.gte = filters.dueDateFrom;
      }
      if (filters.dueDateTo) {
        where.dueDate.lte = filters.dueDateTo;
      }
    }

    if (filters.createdFrom || filters.createdTo) {
      where.createdAt = {};
      if (filters.createdFrom) {
        where.createdAt.gte = filters.createdFrom;
      }
      if (filters.createdTo) {
        where.createdAt.lte = filters.createdTo;
      }
    }
  }

  private applyAmountFilters(
    where: Prisma.InvoiceWhereInput,
    filters: AmountFilters,
  ): void {
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.totalAmount = {};
      if (filters.minAmount !== undefined) {
        where.totalAmount.gte = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        where.totalAmount.lte = filters.maxAmount;
      }
    }

    if (
      filters.minTaxAmount !== undefined ||
      filters.maxTaxAmount !== undefined
    ) {
      where.taxAmount = {};
      if (filters.minTaxAmount !== undefined) {
        where.taxAmount.gte = filters.minTaxAmount;
      }
      if (filters.maxTaxAmount !== undefined) {
        where.taxAmount.lte = filters.maxTaxAmount;
      }
    }

    if (
      filters.minSubtotal !== undefined ||
      filters.maxSubtotal !== undefined
    ) {
      where.subtotal = {};
      if (filters.minSubtotal !== undefined) {
        where.subtotal.gte = filters.minSubtotal;
      }
      if (filters.maxSubtotal !== undefined) {
        where.subtotal.lte = filters.maxSubtotal;
      }
    }

    if (filters.currency) {
      where.currency = filters.currency;
    }
  }

  private applyVendorFilters(
    where: Prisma.InvoiceWhereInput,
    filters: VendorFilters,
  ): void {
    if (filters.vendorName) {
      where.vendorName = {
        contains: filters.vendorName,
        mode: Prisma.QueryMode.insensitive,
      };
    }

    if (filters.vendorNames && filters.vendorNames.length > 0) {
      where.vendorName = {
        in: filters.vendorNames,
      };
    }

    if (filters.vendorTaxId) {
      where.vendorTaxId = filters.vendorTaxId;
    }

    if (filters.vendorAddress) {
      where.vendorAddress = {
        contains: filters.vendorAddress,
        mode: Prisma.QueryMode.insensitive,
      };
    }
  }

  private applyStatusFilters(
    where: Prisma.InvoiceWhereInput,
    filters: StatusFilters,
  ): void {
    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.statuses && filters.statuses.length > 0) {
      where.status = {
        in: filters.statuses,
      };
    }

    if (filters.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
    }

    if (filters.paymentStatuses && filters.paymentStatuses.length > 0) {
      where.paymentStatus = {
        in: filters.paymentStatuses,
      };
    }

    if (filters.validationStatus) {
      where.validationStatus = filters.validationStatus;
    }
  }

  private applyConfidenceFilters(
    where: Prisma.InvoiceWhereInput,
    filters: ConfidenceFilters,
  ): void {
    if (
      filters.minConfidence !== undefined ||
      filters.maxConfidence !== undefined
    ) {
      where.extractionConfidence = {};
      if (filters.minConfidence !== undefined) {
        where.extractionConfidence.gte = filters.minConfidence;
      }
      if (filters.maxConfidence !== undefined) {
        where.extractionConfidence.lte = filters.maxConfidence;
      }
    }

    if (filters.confidenceLevel) {
      const confidenceRanges = {
        high: { gte: 0.9 },
        medium: { gte: 0.7, lt: 0.9 },
        low: { lt: 0.7 },
      };
      where.extractionConfidence = confidenceRanges[filters.confidenceLevel];
    }

    if (filters.requiresManualReview) {
      where.OR = [
        { extractionConfidence: { lt: 0.7 } },
        { validationStatus: 'requires_review' },
        { status: 'pending' },
      ];
    }

    if (filters.templateMatchConfidence !== undefined) {
      where.templateConfidence = {
        gte: filters.templateMatchConfidence,
      };
    }

    if (filters.ocrQuality) {
      const qualityRanges = {
        high: { gte: 0.9 },
        medium: { gte: 0.7, lt: 0.9 },
        low: { lt: 0.7 },
      };
      where.ocrQuality = qualityRanges[filters.ocrQuality];
    }
  }

  private applySearchFilters(
    where: Prisma.InvoiceWhereInput,
    filters: SearchFilters,
  ): void {
    if (filters.searchTerm && filters.searchFields) {
      const searchConditions = filters.searchFields.map((field) => ({
        [field]: {
          contains: filters.searchTerm,
          mode: Prisma.QueryMode.insensitive,
        },
      }));

      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    if (filters.regexPattern && filters.regexField) {
      // Note: Prisma doesn't support regex directly, so this would need to be handled differently
      // For now, we'll use a contains search as a fallback
      where[filters.regexField as keyof Prisma.InvoiceWhereInput] = {
        contains: filters.regexPattern.replace(/[.*+?^${}()|[\]\\]/g, ''),
        mode: Prisma.QueryMode.insensitive,
      };
    }
  }

  private buildOrderByClause(
    sortOptions?: SortOptions,
  ): Prisma.InvoiceOrderByWithRelationInput[] {
    const orderBy: Prisma.InvoiceOrderByWithRelationInput[] = [];

    if (sortOptions?.sortBy) {
      orderBy.push({
        [sortOptions.sortBy]: sortOptions.sortOrder || 'desc',
      });
    }

    if (sortOptions?.secondarySortBy) {
      orderBy.push({
        [sortOptions.secondarySortBy]: sortOptions.secondarySortOrder || 'asc',
      });
    }

    // Default sort by creation date if no sort specified
    if (orderBy.length === 0) {
      orderBy.push({ createdAt: 'desc' });
    }

    return orderBy;
  }

  async getSavedFilters(userId: string): Promise<any[]> {
    // FUTURE FEATURE: Saved filters functionality
    // Will allow users to save commonly used filter combinations for quick access
    // Stored in a SavedFilter table with userId, filterName, and filterOptions
    return [];
  }

  async saveFilter(
    userId: string,
    filterName: string,
    filterOptions: AdvancedFilterOptions,
  ): Promise<any> {
    // FUTURE FEATURE: Save filter functionality
    // Creates a new saved filter preset for the user
    throw new Error('Saved filters feature is not yet implemented. Please apply filters manually.');
  }

  async deleteFilter(userId: string, filterId: string): Promise<void> {
    // FUTURE FEATURE: Delete saved filter functionality
    throw new Error('Saved filters feature is not yet implemented.');
  }
}
