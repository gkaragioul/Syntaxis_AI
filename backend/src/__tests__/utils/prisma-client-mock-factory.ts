// @ts-nocheck
/**
 * Prisma Client Mock Factory
 * 
 * TDD Phase: GREEN - Minimal implementation to make Prisma client mocking tests pass
 * Task: 1.1.2 - Prisma Client Mock Implementations (Priority 3)
 * 
 * This class provides:
 * - Complete Prisma client mock creation
 * - All model CRUD operations
 * - Client-level method mocking
 * - Type-safe mock implementations
 */

import { jest } from '@jest/globals';

export interface PrismaClientMock {
  // Models
  user: any;
  file: any;
  invoice: any;
  ocrResult: any;
  
  // Client methods
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
  $queryRawUnsafe: jest.Mock;
  $executeRawUnsafe: jest.Mock;
  
  [key: string]: any;
}

export class PrismaClientMockFactory {
  private isInitialized: boolean = false;

  constructor() {}

  /**
   * Initialize factory
   * GREEN: Basic initialization
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;
  }

  /**
   * Create complete Prisma client mock
   * GREEN: Create mock with all required models and methods
   */
  createPrismaClientMock(): PrismaClientMock {
    const baseCrudOperations = {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      upsert: jest.fn()
    };

    const mockClient: PrismaClientMock = {
      // Core models with all CRUD operations
      user: { ...baseCrudOperations },
      file: { ...baseCrudOperations },
      invoice: { ...baseCrudOperations },
      ocrResult: { ...baseCrudOperations },
      
      // Client-level methods
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn()
    };

    // Setup default mock implementations
    this.setupDefaultMockBehavior(mockClient);

    return mockClient;
  }

  /**
   * Reset all mocks
   * GREEN: Basic reset implementation
   */
  resetAllMocks(): void {
    // This would reset all created mocks
    // For now, just clear Jest mocks
    jest.clearAllMocks();
  }

  /**
   * Clear mocks
   * GREEN: Basic clear implementation
   */
  clearMocks(): void {
    jest.clearAllMocks();
  }

  /**
   * Cleanup factory
   * GREEN: Basic cleanup
   */
  async cleanup(): Promise<void> {
    this.clearMocks();
    this.isInitialized = false;
  }

  /**
   * Setup default mock behavior
   * GREEN: Configure default responses for common operations
   */
  private setupDefaultMockBehavior(mockClient: PrismaClientMock): void {
    // Setup default user mock behavior
    mockClient.user.create.mockImplementation(async (args: any) => ({
      id: 'mock-user-id',
      email: args.data.email || 'mock@example.com',
      passwordHash: args.data.passwordHash || '$2a$10$mockhash',
      emailVerified: args.data.emailVerified !== undefined ? args.data.emailVerified : true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...args.data
    }));

    mockClient.user.findUnique.mockImplementation(async (args: any) => {
      if (args.where.id) {
        return {
          id: args.where.id,
          email: 'mock@example.com',
          passwordHash: '$2a$10$mockhash',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...(args.include?.files && { files: [] })
        };
      }
      return null;
    });

    mockClient.user.findMany.mockResolvedValue([]);
    mockClient.user.count.mockResolvedValue(0);

    // Setup default file mock behavior
    mockClient.file.create.mockImplementation(async (args: any) => ({
      id: 'mock-file-id',
      filename: args.data.filename || 'mock-file.pdf',
      originalName: args.data.originalName || args.data.filename || 'mock-file.pdf',
      mimeType: args.data.mimeType || 'application/pdf',
      size: args.data.size || 1024,
      path: args.data.path || '/uploads/mock-file.pdf',
      status: args.data.status || 'pending',
      userId: args.data.userId || 'mock-user-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...args.data
    }));

    mockClient.file.findMany.mockResolvedValue([]);
    mockClient.file.count.mockResolvedValue(0);

    // Setup default invoice mock behavior
    mockClient.invoice.create.mockImplementation(async (args: any) => ({
      id: 'mock-invoice-id',
      userId: args.data.userId || 'mock-user-id',
      filename: args.data.filename || 'mock-invoice.pdf',
      status: args.data.status || 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...args.data
    }));

    mockClient.invoice.findMany.mockResolvedValue([]);
    mockClient.invoice.count.mockResolvedValue(0);

    // Setup default ocrResult mock behavior
    mockClient.ocrResult.create.mockImplementation(async (args: any) => ({
      id: 'mock-ocr-result-id',
      fileId: args.data.fileId || 'mock-file-id',
      extractedText: args.data.extractedText || 'Mock extracted text',
      confidence: args.data.confidence || 0.95,
      status: args.data.status || 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...args.data
    }));

    mockClient.ocrResult.findMany.mockResolvedValue([]);
    mockClient.ocrResult.count.mockResolvedValue(0);

    // Setup transaction mock
    mockClient.$transaction.mockImplementation(async (operations: any) => {
      if (typeof operations === 'function') {
        // Callback-style transaction
        const mockTx = this.createPrismaClientMock();
        return await operations(mockTx);
      } else if (Array.isArray(operations)) {
        // Array-style transaction
        return await Promise.all(operations);
      }
      throw new Error('Invalid transaction operations');
    });

    // Setup raw query mocks
    mockClient.$queryRaw.mockResolvedValue([]);
    mockClient.$executeRaw.mockResolvedValue(0);
    mockClient.$queryRawUnsafe.mockResolvedValue([]);
    mockClient.$executeRawUnsafe.mockResolvedValue(0);
  }

  /**
   * Create model-specific mock
   * GREEN: Create mock for specific model
   */
  createModelMock(modelName: string): any {
    const baseCrudOperations = {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      upsert: jest.fn()
    };

    // Setup default behavior based on model
    switch (modelName) {
      case 'user':
        baseCrudOperations.create.mockImplementation(async (args: any) => ({
          id: 'mock-user-id',
          email: args.data.email,
          passwordHash: args.data.passwordHash,
          emailVerified: args.data.emailVerified,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
        break;
      
      case 'file':
        baseCrudOperations.create.mockImplementation(async (args: any) => ({
          id: 'mock-file-id',
          filename: args.data.filename,
          originalName: args.data.originalName,
          mimeType: args.data.mimeType,
          size: args.data.size,
          path: args.data.path,
          status: args.data.status,
          userId: args.data.userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
        break;
      
      default:
        baseCrudOperations.create.mockImplementation(async (args: any) => ({
          id: `mock-${modelName}-id`,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
    }

    // Default empty responses
    baseCrudOperations.findMany.mockResolvedValue([]);
    baseCrudOperations.count.mockResolvedValue(0);
    baseCrudOperations.findUnique.mockResolvedValue(null);

    return baseCrudOperations;
  }

  /**
   * Check if factory is initialized
   * GREEN: Simple status check
   */
  isFactoryInitialized(): boolean {
    return this.isInitialized;
  }
}

export default PrismaClientMockFactory;
