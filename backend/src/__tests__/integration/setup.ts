import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { config } from '../../config';

// Initialize Redis client for integration tests
const redis = new Redis(config.redis.url);

// Create a separate Prisma client for testing
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL,
    },
  },
});

// Global setup for integration tests
beforeAll(async () => {
  // Connect to test database
  await testPrisma.$connect();

  // Clear test database
  await testPrisma.$transaction([
    testPrisma.invoice.deleteMany(),
    testPrisma.file.deleteMany(),
    testPrisma.user.deleteMany(),
    testPrisma.template.deleteMany(),
    testPrisma.extraction.deleteMany(),
    testPrisma.auditLog.deleteMany(),
    testPrisma.notification.deleteMany(),
    testPrisma.errorReport.deleteMany(),
  ]);

  // Clear Redis test keys
  const keys = await redis.keys('test:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
});

// Cleanup after each test
afterEach(async () => {
  // Clear test data
  await testPrisma.$transaction([
    testPrisma.invoice.deleteMany(),
    testPrisma.file.deleteMany(),
    testPrisma.user.deleteMany(),
    testPrisma.template.deleteMany(),
    testPrisma.extraction.deleteMany(),
    testPrisma.auditLog.deleteMany(),
    testPrisma.notification.deleteMany(),
    testPrisma.errorReport.deleteMany(),
  ]);

  // Clear Redis test keys
  const keys = await redis.keys('test:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
});

// Global teardown
afterAll(async () => {
  // Disconnect from test database
  await testPrisma.$disconnect();
});

// Helper functions for integration tests
export const createTestUser = async (data = {}) => {
  return testPrisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      password: 'hashed-password',
      firstName: 'Test',
      lastName: 'User',
      role: 'USER',
      ...data,
    },
  });
};

export const createTestFile = async (userId: string, data = {}) => {
  return testPrisma.file.create({
    data: {
      userId,
      filename: `test-file-${Date.now()}.pdf`,
      status: 'PENDING',
      ...data,
    },
  });
};

export const createTestInvoice = async (
  userId: string,
  fileId: string,
  data = {},
) => {
  return testPrisma.invoice.create({
    data: {
      userId,
      fileId,
      vendor: 'Test Vendor',
      amount: 100.0,
      status: 'PROCESSED',
      ...data,
    },
  });
};

export const createTestTemplate = async (userId: string, data = {}) => {
  return testPrisma.template.create({
    data: {
      userId,
      name: `Test Template ${Date.now()}`,
      description: 'Test template description',
      isActive: true,
      ...data,
    },
  });
};

// Mock services for integration tests
export const mockServices = {
  email: {
    sendJobStatusEmail: jest.fn().mockResolvedValue(undefined),
    sendErrorNotification: jest.fn().mockResolvedValue(undefined),
  },
  ocr: {
    processFile: jest.fn().mockResolvedValue({
      text: 'Test OCR text',
      confidence: 0.95,
    }),
  },
  storage: {
    uploadFile: jest.fn().mockResolvedValue({
      url: 'https://test-bucket.s3.amazonaws.com/test-file.pdf',
      key: 'test-file.pdf',
    }),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  },
};
