import { PrismaClient } from '@prisma/client';
import { redis } from '../../config/redis';
import { config } from '../../config';
import { app } from '../../app';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';

// Create a separate Prisma client for E2E tests
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.E2E_TEST_DATABASE_URL,
    },
  },
});

// Global variables for E2E tests
export let server: any;
export let baseUrl: string;
export let testUser: any;
export let testUserToken: string;

// Global setup for E2E tests
beforeAll(async () => {
  // Start the server
  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://localhost:${address.port}`;
      resolve();
    });
  });

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
  const keys = await redis.keys(`${config.redis.prefix}:e2e:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  // Create test user and get authentication token
  testUser = await createTestUser();
  const loginResponse = await request(baseUrl).post('/api/v1/auth/login').send({
    email: testUser.email,
    password: 'test-password',
  });
  testUserToken = loginResponse.body.token;
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
  const keys = await redis.keys(`${config.redis.prefix}:e2e:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
});

// Global teardown
afterAll(async () => {
  // Close server
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  // Disconnect from test database
  await testPrisma.$disconnect();
});

// Helper functions for E2E tests
export const createTestUser = async (data = {}) => {
  const userData = {
    email: `e2e-test-${Date.now()}@example.com`,
    password: 'test-password',
    firstName: 'E2E',
    lastName: 'Test',
    role: 'USER',
    ...data,
  };

  // Create user through API
  const response = await request(baseUrl)
    .post('/api/v1/auth/register')
    .send(userData);

  return response.body.user;
};

export const createTestFile = async (token: string, fileData: Buffer) => {
  const response = await request(baseUrl)
    .post('/api/v1/files/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', fileData, 'test-invoice.pdf');

  return response.body.file;
};

export const processTestFile = async (token: string, fileId: string) => {
  const response = await request(baseUrl)
    .post(`/api/v1/invoices/process/${fileId}`)
    .set('Authorization', `Bearer ${token}`);

  return response.body;
};

export const getJobStatus = async (token: string, jobId: string) => {
  const response = await request(baseUrl)
    .get(`/api/v1/invoices/process/${jobId}`)
    .set('Authorization', `Bearer ${token}`);

  return response.body;
};

export const listInvoices = async (token: string, query = {}) => {
  const response = await request(baseUrl)
    .get('/api/v1/invoices')
    .set('Authorization', `Bearer ${token}`)
    .query(query);

  return response.body;
};

export const createTestTemplate = async (token: string, data = {}) => {
  const response = await request(baseUrl)
    .post('/api/v1/templates')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `E2E Test Template ${Date.now()}`,
      description: 'E2E test template description',
      isActive: true,
      ...data,
    });

  return response.body.template;
};

// Mock external services for E2E tests
export const mockExternalServices = {
  email: {
    sendJobStatusEmail: jest.fn().mockResolvedValue(undefined),
    sendErrorNotification: jest.fn().mockResolvedValue(undefined),
  },
  ocr: {
    processFile: jest.fn().mockResolvedValue({
      text: 'E2E Test OCR text',
      confidence: 0.95,
    }),
  },
  storage: {
    uploadFile: jest.fn().mockResolvedValue({
      url: 'https://e2e-test-bucket.s3.amazonaws.com/test-file.pdf',
      key: 'test-file.pdf',
    }),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  },
};
