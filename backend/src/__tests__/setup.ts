// Jest global setup for backend tests - TDD Implementation
import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  beforeAll,
  afterAll,
} from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import Bull from 'bull';
import { config } from '../config';
import { mockServices } from './mocks/services';
import { setupTestEnvironment, cleanupTestEnvironment } from './utils/test-environment';
import { prismaMock } from './__mocks__/prisma';

// Global test utilities
declare global {
  var testPrisma: PrismaClient;
  var testRedis: Redis;
  var testCleanup: () => Promise<void>;
  var mockServices: any;
}

// Test user and file constants
export const TEST_USER = {
  email: 'test@example.com',
  password: 'testPassword123!',
  firstName: 'Test',
  lastName: 'User',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const TEST_FILE = {
  name: 'test.pdf',
  size: 1024,
  mimeType: 'application/pdf',
  status: 'PENDING',
  path: '/test/path/test.pdf',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Test timeouts
export const TEST_TIMEOUT = 30000;
export const TEST_INTERVAL = 1000;

// Setup function
export async function setup() {
  // Initialize test database client
  testPrisma = new PrismaClient({
    datasources: {
      db: {
        url:
          process.env.DATABASE_URL ||
          'postgresql://postgres:postgres@localhost:5432/syntaxis_test',
      },
    },
  });

  // Initialize test Redis client
  testRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379/1');

  // Initialize mock services
  global.mockServices = mockServices;

  // Setup cleanup function
  global.testCleanup = async () => {
    await testPrisma.$disconnect();
    await testRedis.quit();
  };
}

// Teardown function
export async function teardown() {
  await global.testCleanup();
}

// Export Jest globals for convenience
export { describe, it, expect, beforeEach, jest };

// Export test utilities
export const getTestPrisma = (): PrismaClient => global.testPrisma;
export const getMockServices = (): typeof mockServices => global.mockServices;

// Test constants
export const TEST_RETRY_ATTEMPTS = 3;

// Test file paths
export const TEST_FILES = {
  VALID_INVOICE: '../fixtures/valid-invoice.pdf',
  INVALID_INVOICE: '../fixtures/invalid-invoice.pdf',
  LARGE_INVOICE: '../fixtures/large-invoice.pdf',
  MULTI_PAGE_INVOICE: '../fixtures/multi-page-invoice.pdf',
};

// Test timeouts
export const TEST_TIMEOUTS = {
  SHORT: 1000,
  MEDIUM: 5000,
  LONG: 10000,
  VERY_LONG: 30000,
};

// Test rate limits
export const TEST_RATE_LIMITS = {
  API: {
    window: 60000,
    max: 100,
  },
  UPLOAD: {
    window: 3600000,
    max: 50,
  },
  PROCESSING: {
    window: 3600000,
    max: 100,
  },
};

// Export all test utilities
export default {
  getTestPrisma,
  getMockServices,
  TEST_USER,
  TEST_FILE,
  TEST_TIMEOUT,
  TEST_RETRY_ATTEMPTS,
  TEST_FILES,
  TEST_TIMEOUTS,
  TEST_RATE_LIMITS,
};

// Define types for mock services
interface MockServices {
  email: jest.Mock;
  storage: jest.Mock;
  queue: jest.Mock;
}

// TDD-compliant test hooks
beforeAll(async () => {
  // Setup test environment with mocks for fast, isolated tests
  await setupTestEnvironment({
    useMocks: true,
    isolationLevel: 'suite',
    validateConnections: false
  });
});

afterAll(async () => {
  // Clean up test environment
  await cleanupTestEnvironment();
});
