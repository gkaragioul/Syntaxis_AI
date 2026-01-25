/**
 * Optimized Database Service
 * 
 * Task 2.2.2: Performance Optimizations Implementation - TDD GREEN Phase
 * 
 * This service implements database optimizations to meet <200ms API response requirement.
 * Following TDD: Red-Green-Refactor approach.
 */

import { PrismaClient } from '@prisma/client';
import { Logger } from 'winston';
import { logger } from '../../utils/logger';

// Database optimization configuration
interface DatabaseOptimizationConfig {
  enableQueryOptimization: boolean;
  enableConnectionPooling: boolean;
  enableQueryCaching: boolean;
  maxQueryTime: number;
  connectionPoolSize: number;
}

const defaultConfig: DatabaseOptimizationConfig = {
  enableQueryOptimization: true,
  enableConnectionPooling: true,
  enableQueryCaching: true,
  maxQueryTime: 100, // 100ms
  connectionPoolSize: 10,
};

// Query cache interface
interface QueryCacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

/**
 * Optimized Database Service
 * GREEN: Implements database optimizations to pass performance tests
 */
export class OptimizedDatabaseService {
  private prisma: PrismaClient;
  private logger: Logger;
  private config: DatabaseOptimizationConfig;
  private queryCache: Map<string, QueryCacheEntry>;

  constructor(prisma: PrismaClient, config: DatabaseOptimizationConfig = defaultConfig) {
    this.prisma = prisma;
    this.logger = logger.child({ service: 'OptimizedDatabaseService' });
    this.config = config;
    this.queryCache = new Map();

    this.logger.info('Optimized Database Service initialized', {
      queryOptimization: config.enableQueryOptimization,
      connectionPooling: config.enableConnectionPooling,
      queryCaching: config.enableQueryCaching,
    });
  }

  /**
   * Optimized user queries
   * GREEN: Fast user data retrieval
   */
  async findUserById(userId: string): Promise<any> {
    const cacheKey = `user:${userId}`;
    
    // Check cache first
    if (this.config.enableQueryCaching) {
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        this.logger.debug('User query cache hit', { userId });
        return cached;
      }
    }

    const startTime = Date.now();

    try {
      // Optimized query with selective fields
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          subscriptionStatus: true,
          createdAt: true,
          // Exclude heavy fields for performance
        },
      });

      const queryTime = Date.now() - startTime;
      this.logQueryPerformance('findUserById', queryTime);

      // Cache result
      if (this.config.enableQueryCaching && user) {
        this.setCachedResult(cacheKey, user, 300000); // 5 minutes TTL
      }

      return user;

    } catch (error) {
      this.logger.error('Optimized user query failed', { userId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Optimized invoice queries
   * GREEN: Fast invoice data retrieval with pagination
   */
  async findInvoicesByUserId(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      status?: string;
    } = {}
  ): Promise<{ invoices: any[]; total: number; hasMore: boolean }> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', status } = options;
    const offset = (page - 1) * limit;

    const cacheKey = `invoices:${userId}:${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.config.enableQueryCaching) {
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        this.logger.debug('Invoice query cache hit', { userId, options });
        return cached;
      }
    }

    const startTime = Date.now();

    try {
      // Build optimized where clause
      const where: any = { userId };
      if (status) {
        where.status = status;
      }

      // Parallel queries for better performance
      const [invoices, total] = await Promise.all([
        this.prisma.invoice.findMany({
          where,
          select: {
            id: true,
            fileName: true,
            status: true,
            extractionConfidence: true,
            createdAt: true,
            updatedAt: true,
            // Exclude heavy fields like file content
          },
          orderBy: { [sortBy]: sortOrder },
          skip: offset,
          take: limit,
        }),
        this.prisma.invoice.count({ where }),
      ]);

      const queryTime = Date.now() - startTime;
      this.logQueryPerformance('findInvoicesByUserId', queryTime);

      const result = {
        invoices,
        total,
        hasMore: offset + invoices.length < total,
      };

      // Cache result
      if (this.config.enableQueryCaching) {
        this.setCachedResult(cacheKey, result, 60000); // 1 minute TTL
      }

      return result;

    } catch (error) {
      this.logger.error('Optimized invoice query failed', { userId, options, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Optimized single invoice query
   * GREEN: Fast single invoice retrieval
   */
  async findInvoiceById(invoiceId: string, userId?: string): Promise<any> {
    const cacheKey = `invoice:${invoiceId}`;
    
    // Check cache first
    if (this.config.enableQueryCaching) {
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        this.logger.debug('Invoice query cache hit', { invoiceId });
        return cached;
      }
    }

    const startTime = Date.now();

    try {
      const where: any = { id: invoiceId };
      if (userId) {
        where.userId = userId;
      }

      const invoice = await this.prisma.invoice.findUnique({
        where,
        select: {
          id: true,
          userId: true,
          fileName: true,
          status: true,
          extractionConfidence: true,
          createdAt: true,
          updatedAt: true,
          // Include related data efficiently
          ocrResults: {
            select: {
              id: true,
              confidence: true,
              extractedText: true,
              engine: true,
            },
            take: 1, // Only latest result
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      const queryTime = Date.now() - startTime;
      this.logQueryPerformance('findInvoiceById', queryTime);

      // Cache result
      if (this.config.enableQueryCaching && invoice) {
        this.setCachedResult(cacheKey, invoice, 300000); // 5 minutes TTL
      }

      return invoice;

    } catch (error) {
      this.logger.error('Optimized invoice query failed', { invoiceId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Optimized dashboard statistics
   * GREEN: Fast dashboard data aggregation
   */
  async getDashboardStats(userId: string): Promise<any> {
    const cacheKey = `dashboard:${userId}`;
    
    // Check cache first
    if (this.config.enableQueryCaching) {
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        this.logger.debug('Dashboard stats cache hit', { userId });
        return cached;
      }
    }

    const startTime = Date.now();

    try {
      // Parallel aggregation queries for better performance
      const [
        totalInvoices,
        processedInvoices,
        averageConfidence,
        recentActivity,
      ] = await Promise.all([
        this.prisma.invoice.count({
          where: { userId },
        }),
        this.prisma.invoice.count({
          where: { userId, status: 'processed' },
        }),
        this.prisma.invoice.aggregate({
          where: { userId, status: 'processed' },
          _avg: { extractionConfidence: true },
        }),
        this.prisma.invoice.findMany({
          where: { userId },
          select: {
            id: true,
            fileName: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

      const queryTime = Date.now() - startTime;
      this.logQueryPerformance('getDashboardStats', queryTime);

      const stats = {
        totalInvoices,
        processedInvoices,
        pendingInvoices: totalInvoices - processedInvoices,
        averageConfidence: averageConfidence._avg.extractionConfidence || 0,
        recentActivity,
        processingRate: totalInvoices > 0 ? (processedInvoices / totalInvoices) * 100 : 0,
      };

      // Cache result
      if (this.config.enableQueryCaching) {
        this.setCachedResult(cacheKey, stats, 120000); // 2 minutes TTL
      }

      return stats;

    } catch (error) {
      this.logger.error('Dashboard stats query failed', { userId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Optimized invoice creation
   * GREEN: Fast invoice creation with minimal data
   */
  async createInvoice(data: {
    userId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    filePath?: string;
  }): Promise<any> {
    const startTime = Date.now();

    try {
      const invoice = await this.prisma.invoice.create({
        data: {
          ...data,
          status: 'pending',
          createdAt: new Date(),
        },
        select: {
          id: true,
          userId: true,
          fileName: true,
          status: true,
          createdAt: true,
        },
      });

      const queryTime = Date.now() - startTime;
      this.logQueryPerformance('createInvoice', queryTime);

      // Invalidate related caches
      this.invalidateUserCaches(data.userId);

      return invoice;

    } catch (error) {
      this.logger.error('Invoice creation failed', { data, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Optimized invoice update
   * GREEN: Fast invoice status updates
   */
  async updateInvoice(invoiceId: string, data: any): Promise<any> {
    const startTime = Date.now();

    try {
      const invoice = await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          userId: true,
          status: true,
          extractionConfidence: true,
          updatedAt: true,
        },
      });

      const queryTime = Date.now() - startTime;
      this.logQueryPerformance('updateInvoice', queryTime);

      // Invalidate related caches
      this.invalidateInvoiceCaches(invoiceId);
      this.invalidateUserCaches(invoice.userId);

      return invoice;

    } catch (error) {
      this.logger.error('Invoice update failed', { invoiceId, data, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Cache management methods
   */
  private getCachedResult(key: string): any | null {
    const entry = this.queryCache.get(key);
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      return entry.data;
    }
    
    if (entry) {
      this.queryCache.delete(key);
    }
    
    return null;
  }

  private setCachedResult(key: string, data: any, ttl: number): void {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Clean up expired entries periodically
    if (this.queryCache.size > 1000) {
      this.cleanupExpiredCache();
    }
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.queryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.queryCache.delete(key);
      }
    }
  }

  private invalidateUserCaches(userId: string): void {
    for (const key of this.queryCache.keys()) {
      if (key.includes(`user:${userId}`) || key.includes(`invoices:${userId}`) || key.includes(`dashboard:${userId}`)) {
        this.queryCache.delete(key);
      }
    }
  }

  private invalidateInvoiceCaches(invoiceId: string): void {
    for (const key of this.queryCache.keys()) {
      if (key.includes(`invoice:${invoiceId}`)) {
        this.queryCache.delete(key);
      }
    }
  }

  private logQueryPerformance(operation: string, queryTime: number): void {
    if (queryTime > this.config.maxQueryTime) {
      this.logger.warn('Slow database query detected', {
        operation,
        queryTime,
        threshold: this.config.maxQueryTime,
      });
    } else {
      this.logger.debug('Database query completed', {
        operation,
        queryTime,
      });
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.queryCache.size,
      hitRate: 0, // Would track hit rate in production
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.queryCache.clear();
    this.logger.info('Database query cache cleared');
  }
}

// Create singleton instance for application use
let optimizedDbInstance: OptimizedDatabaseService | null = null;

export const getOptimizedDatabaseService = (prisma: PrismaClient): OptimizedDatabaseService => {
  if (!optimizedDbInstance) {
    optimizedDbInstance = new OptimizedDatabaseService(prisma);
  }
  return optimizedDbInstance;
};

// Export for use in other services
export default OptimizedDatabaseService;
