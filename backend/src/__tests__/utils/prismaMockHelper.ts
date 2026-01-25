// @ts-nocheck
/**
 * Prisma Mock Helper Utility
 * 
 * TDD Phase: GREEN - Implementation to make Prisma mocking tests pass
 * Task: 1.1.2 - Complete Prisma client mock implementations
 * 
 * This utility provides:
 * 1. Comprehensive Prisma client mock for all models
 * 2. Realistic mock behavior that matches real Prisma operations
 * 3. Easy setup and teardown for test isolation
 * 4. Factory functions for creating test data
 * 5. Advanced query operation mocking (aggregation, transactions, etc.)
 */

import { jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { prismaMock, resetPrismaMock, mockDataFactories } from '../__mocks__/prisma';

// Export the main mock and utilities
export { prismaMock, resetPrismaMock, mockDataFactories };

// Prisma mock factory interface
export interface PrismaMockFactory {
  mock: jest.Mocked<PrismaClient>;
  resetMocks: () => void;
  setupSuccessfulOperations: () => void;
  setupFailedOperations: (errorMessage?: string) => void;
  createTestData: typeof mockDataFactories;
}

/**
 * Creates a fresh Prisma mock instance with all methods
 */
export const createPrismaMockFactory = (): PrismaMockFactory => {
  // Use the comprehensive mock from the __mocks__ directory
  const mock = prismaMock;

  const resetMocks = () => {
    resetPrismaMock();
  };

  const setupSuccessfulOperations = () => {
    resetMocks();
    
    // Ensure all operations return successful results
    // User operations
    mock.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.id || where.email) {
        return mockDataFactories.user({ id: where.id || 'test-user-id' });
      }
      return null;
    });
    
    mock.user.create.mockImplementation(async ({ data }) => 
      mockDataFactories.user(data)
    );
    
    mock.user.update.mockImplementation(async ({ data }) => 
      mockDataFactories.user(data)
    );

    // Invoice operations
    mock.invoice.findUnique.mockImplementation(async ({ where }) => {
      if (where.id) {
        return mockDataFactories.invoice({ id: where.id });
      }
      return null;
    });
    
    mock.invoice.create.mockImplementation(async ({ data }) => 
      mockDataFactories.invoice(data)
    );
    
    mock.invoice.update.mockImplementation(async ({ data }) => 
      mockDataFactories.invoice(data)
    );

    // File operations
    mock.file.findUnique.mockImplementation(async ({ where }) => {
      if (where.id) {
        return {
          id: where.id,
          userId: 'test-user-id',
          filename: 'test-file.pdf',
          originalName: 'test-file.pdf',
          mimeType: 'application/pdf',
          size: 12345,
          status: 'uploaded',
          path: '/uploads/test-file.pdf',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      return null;
    });

    // OCR result operations
    mock.ocrResult.create.mockImplementation(async ({ data }) => 
      mockDataFactories.ocrResult(data)
    );

    // Correction operations
    mock.correction.findUnique.mockImplementation(async ({ where }) => {
      if (where.id) {
        return mockDataFactories.correction({ id: where.id });
      }
      return null;
    });
    
    mock.correction.create.mockImplementation(async ({ data }) => 
      mockDataFactories.correction(data)
    );

    // Database operations
    mock.$connect.mockResolvedValue(undefined);
    mock.$disconnect.mockResolvedValue(undefined);
    mock.$queryRaw.mockResolvedValue([{ test: 1 }]);
    mock.$executeRaw.mockResolvedValue(1);
    
    // Transaction operations
    mock.$transaction.mockImplementation(async (operations) => {
      if (typeof operations === 'function') {
        return operations(mock);
      }
      return Promise.all(operations);
    });
  };

  const setupFailedOperations = (errorMessage = 'Database operation failed') => {
    resetMocks();
    
    // Make all operations fail
    const error = new Error(errorMessage);
    
    mock.user.findUnique.mockRejectedValue(error);
    mock.user.create.mockRejectedValue(error);
    mock.user.update.mockRejectedValue(error);
    
    mock.invoice.findUnique.mockRejectedValue(error);
    mock.invoice.create.mockRejectedValue(error);
    mock.invoice.update.mockRejectedValue(error);
    
    mock.file.findUnique.mockRejectedValue(error);
    mock.file.create.mockRejectedValue(error);
    mock.file.update.mockRejectedValue(error);
    
    mock.$connect.mockRejectedValue(error);
    mock.$queryRaw.mockRejectedValue(error);
    mock.$executeRaw.mockRejectedValue(error);
    mock.$transaction.mockRejectedValue(error);
  };

  return {
    mock,
    resetMocks,
    setupSuccessfulOperations,
    setupFailedOperations,
    createTestData: mockDataFactories,
  };
};

/**
 * Sets up Prisma mock for the entire test suite
 * Call this in beforeAll or beforeEach
 */
export const setupPrismaMock = (): PrismaMockFactory => {
  const mockFactory = createPrismaMockFactory();
  
  // Setup successful operations by default
  mockFactory.setupSuccessfulOperations();
  
  return mockFactory;
};

/**
 * Validates that all required Prisma methods are mocked
 */
export const validatePrismaMock = (mock: jest.Mocked<PrismaClient>): {
  isValid: boolean;
  missingMethods: string[];
} => {
  const requiredMethods = [
    'user.findUnique', 'user.create', 'user.update', 'user.findMany',
    'invoice.findUnique', 'invoice.create', 'invoice.update', 'invoice.findMany',
    'file.findUnique', 'file.create', 'file.update',
    'ocrResult.create', 'correction.findUnique', 'correction.create',
    '$connect', '$disconnect', '$queryRaw', '$executeRaw', '$transaction'
  ];
  
  const missingMethods: string[] = [];
  
  for (const methodPath of requiredMethods) {
    const parts = methodPath.split('.');
    let current: any = mock;
    
    for (const part of parts) {
      if (!current || !current[part]) {
        missingMethods.push(methodPath);
        break;
      }
      current = current[part];
    }
    
    // Check if it's a mock function
    if (current && !jest.isMockFunction(current)) {
      missingMethods.push(`${methodPath} (not a mock function)`);
    }
  }
  
  return {
    isValid: missingMethods.length === 0,
    missingMethods,
  };
};

/**
 * Creates test data with relationships
 */
export const createTestDataWithRelations = () => {
  const user = mockDataFactories.user();
  const invoice = mockDataFactories.invoice({ userId: user.id });
  const ocrResult = mockDataFactories.ocrResult({ 
    invoiceId: invoice.id, 
    userId: user.id 
  });
  const correction = mockDataFactories.correction({ 
    invoiceId: invoice.id, 
    userId: user.id 
  });

  return {
    user,
    invoice,
    ocrResult,
    correction,
  };
};

// Export for use in tests
export default {
  createPrismaMockFactory,
  setupPrismaMock,
  validatePrismaMock,
  createTestDataWithRelations,
  prismaMock,
  resetPrismaMock,
  mockDataFactories,
};
