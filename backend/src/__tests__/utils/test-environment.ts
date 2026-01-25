// @ts-nocheck
/**
 * Test Environment Setup Utility
 * 
 * Task 1.1.4: Test Environment Setup - TDD Implementation
 * 
 * This utility provides reliable test isolation, database setup/teardown,
 * and environment validation following TDD principles.
 */

import { jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { prismaMock, resetPrismaMock } from '../__mocks__/prisma';

// Test environment state management
interface TestEnvironmentState {
  isSetup: boolean;
  prismaConnected: boolean;
  redisConnected: boolean;
  testDatabase: string;
  testRedisDb: number;
  isolationLevel: 'none' | 'test' | 'suite' | 'full';
}

let environmentState: TestEnvironmentState = {
  isSetup: false,
  prismaConnected: false,
  redisConnected: false,
  testDatabase: 'syntaxis_test',
  testRedisDb: 1,
  isolationLevel: 'test',
};

// Test isolation utilities
export class TestEnvironment {
  private static instance: TestEnvironment;
  private testPrisma: PrismaClient | null = null;
  private testRedis: Redis | null = null;
  private cleanupTasks: Array<() => Promise<void>> = [];

  private constructor() {}

  static getInstance(): TestEnvironment {
    if (!TestEnvironment.instance) {
      TestEnvironment.instance = new TestEnvironment();
    }
    return TestEnvironment.instance;
  }

  /**
   * Setup test environment with proper isolation
   * RED: Write failing test first to validate environment setup
   */
  async setup(options: {
    isolationLevel?: 'none' | 'test' | 'suite' | 'full';
    useMocks?: boolean;
    validateConnections?: boolean;
  } = {}): Promise<void> {
    const { isolationLevel = 'test', useMocks = true, validateConnections = true } = options;

    try {
      // Set environment variables for test mode
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = process.env.DATABASE_TEST_URL || 
        'postgresql://postgres:postgres@localhost:5432/syntaxis_test';
      process.env.REDIS_URL = process.env.REDIS_TEST_URL || 
        'redis://localhost:6379/1';

      if (useMocks) {
        // Use mocked Prisma client for fast, isolated tests
        this.setupMockedEnvironment();
      } else {
        // Use real database connections for integration tests
        await this.setupRealEnvironment(validateConnections);
      }

      environmentState.isSetup = true;
      environmentState.isolationLevel = isolationLevel;

      // Setup cleanup for proper test isolation
      this.setupCleanupHooks();

    } catch (error) {
      throw new Error(`Test environment setup failed: ${error.message}`);
    }
  }

  /**
   * Setup mocked environment for unit tests
   * GREEN: Implement minimal setup to pass tests
   */
  private setupMockedEnvironment(): void {
    // Reset all mocks to ensure clean state
    resetPrismaMock();
    
    // Make mocked Prisma available globally
    global.testPrisma = prismaMock as any;
    global.testRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
    } as any;

    environmentState.prismaConnected = true;
    environmentState.redisConnected = true;
  }

  /**
   * Setup real environment for integration tests
   * GREEN: Implement real connections with timeout and error handling
   */
  private async setupRealEnvironment(validateConnections: boolean): Promise<void> {
    // Initialize real Prisma client with test database
    this.testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Initialize real Redis client with test database
    this.testRedis = new Redis(process.env.REDIS_URL, {
      connectTimeout: 5000,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    if (validateConnections) {
      // Test database connection with timeout
      await Promise.race([
        this.testPrisma.$connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database connection timeout')), 10000)
        )
      ]);

      // Test Redis connection with timeout
      await Promise.race([
        this.testRedis.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
        )
      ]);
    }

    // Make real clients available globally
    global.testPrisma = this.testPrisma;
    global.testRedis = this.testRedis;

    environmentState.prismaConnected = true;
    environmentState.redisConnected = true;

    // Add cleanup tasks
    this.cleanupTasks.push(async () => {
      if (this.testPrisma) {
        await this.testPrisma.$disconnect();
      }
      if (this.testRedis) {
        await this.testRedis.quit();
      }
    });
  }

  /**
   * Setup cleanup hooks for test isolation
   * REFACTOR: Improve cleanup mechanism for better reliability
   */
  private setupCleanupHooks(): void {
    // Global cleanup function
    global.testCleanup = async () => {
      await this.cleanup();
    };

    // Process cleanup handlers
    const cleanup = () => {
      this.cleanup().catch(console.error);
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', cleanup);
  }

  /**
   * Clean up test environment
   * Ensures proper test isolation between tests
   */
  async cleanup(): Promise<void> {
    try {
      // Execute all cleanup tasks
      await Promise.all(this.cleanupTasks.map(task => 
        task().catch(error => console.warn('Cleanup task failed:', error))
      ));

      // Reset mocks if using mocked environment
      if (environmentState.isolationLevel !== 'none') {
        resetPrismaMock();
        jest.clearAllMocks();
      }

      // Reset environment state
      environmentState.isSetup = false;
      environmentState.prismaConnected = false;
      environmentState.redisConnected = false;

      // Clear global references
      global.testPrisma = null;
      global.testRedis = null;

    } catch (error) {
      console.warn('Test environment cleanup failed:', error);
    }
  }

  /**
   * Validate test environment state
   * Used for environment health checks in tests
   */
  validateEnvironment(): {
    isValid: boolean;
    issues: string[];
    state: TestEnvironmentState;
  } {
    const issues: string[] = [];

    if (!environmentState.isSetup) {
      issues.push('Test environment not setup');
    }

    if (!global.testPrisma) {
      issues.push('Prisma client not available');
    }

    if (!global.testRedis) {
      issues.push('Redis client not available');
    }

    if (process.env.NODE_ENV !== 'test') {
      issues.push('NODE_ENV not set to test');
    }

    return {
      isValid: issues.length === 0,
      issues,
      state: { ...environmentState },
    };
  }

  /**
   * Reset environment for test isolation
   * Called between tests to ensure clean state
   */
  async resetForTest(): Promise<void> {
    if (environmentState.isolationLevel === 'test' || environmentState.isolationLevel === 'full') {
      resetPrismaMock();
      jest.clearAllMocks();
    }
  }

  /**
   * Get current environment state
   */
  getState(): TestEnvironmentState {
    return { ...environmentState };
  }
}

// Export singleton instance
export const testEnvironment = TestEnvironment.getInstance();

// Export utility functions
export const setupTestEnvironment = async (options?: Parameters<TestEnvironment['setup']>[0]) => {
  await testEnvironment.setup(options);
  return {
    prisma: global.testPrisma,
    cleanup: () => testEnvironment.cleanup(),
  };
};

export const cleanupTestEnvironment = () => testEnvironment.cleanup();

export const validateTestEnvironment = () => testEnvironment.validateEnvironment();

export const resetTestEnvironment = () => testEnvironment.resetForTest();

/**
 * Create isolated test environment with seeded data
 * This function creates a completely isolated environment for each test
 */
export const createTestEnvironment = async () => {
  // Setup environment with real connections for integration tests
  await testEnvironment.setup({
    useMocks: false,
    validateConnections: true,
    isolationLevel: 'test'
  });

  const db = global.testPrisma as PrismaClient;

  // Create unique test data to avoid conflicts
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);

  // Seed with basic test data using unique emails
  const testUser = await db.user.create({
    data: {
      email: `test-${timestamp}-${randomId}@example.com`,
      passwordHash: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptpT1/GxseHlChgyu', // 'password'
      emailVerified: true,
    },
  });

  const adminUser = await db.user.create({
    data: {
      email: `admin-${timestamp}-${randomId}@example.com`,
      passwordHash: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptpT1/GxseHlChgyu', // 'password'
      emailVerified: true,
    },
  });

  return {
    db,
    seedData: {
      testUser,
      adminUser,
    },
    cleanup: async () => {
      try {
        // Clean up test data without transactions to avoid deadlocks
        await db.invoice.deleteMany({
          where: {
            userId: {
              in: [testUser.id, adminUser.id]
            }
          }
        });
        await db.user.deleteMany({
          where: {
            id: {
              in: [testUser.id, adminUser.id]
            }
          }
        });
        await testEnvironment.cleanup();
      } catch (error) {
        console.error('Error during test cleanup:', error);
        // Don't throw cleanup errors
      }
    },
  };
};

/**
 * Reset test database to clean state
 * This function resets the database to a known seed state
 */
export const resetTestDatabase = async () => {
  const db = global.testPrisma as PrismaClient;

  if (!db) {
    throw new Error('Test database not initialized. Call setupTestEnvironment first.');
  }

  try {
    // Clean up test data in reverse order of dependencies
    await db.invoice.deleteMany();
    await db.file.deleteMany();
    await db.user.deleteMany();

    // Re-seed with basic data
    await db.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptpT1/GxseHlChgyu',
        emailVerified: true,
      },
    });

    await db.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptpT1/GxseHlChgyu',
        emailVerified: true,
      },
    });

    console.log('✅ Test database reset completed');
  } catch (error) {
    console.error('Failed to reset test database:', error);
    throw error;
  }
};

/**
 * Cleanup test database after testing
 * This function performs final cleanup of test data
 */
export const cleanupTestDatabase = async () => {
  const db = global.testPrisma as PrismaClient;

  if (!db) {
    console.warn('Test database not initialized, skipping cleanup');
    return;
  }

  try {
    await db.invoice.deleteMany();
    await db.file.deleteMany();
    await db.user.deleteMany();
    console.log('✅ Test database cleanup completed');
  } catch (error) {
    console.error('Failed to cleanup test database:', error);
    // Don't throw cleanup errors
  }
};

// Export for Jest setup files
export default testEnvironment;
