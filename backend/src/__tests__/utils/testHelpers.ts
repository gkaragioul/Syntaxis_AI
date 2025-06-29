import { PrismaClient, User, File, Invoice, Template } from '@prisma/client';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { jest, expect } from '@jest/globals';

// Type definitions
export interface TestUser extends Partial<User> {
  id: string;
  email: string;
  password: string;
  role: string;
  status: string;
}

export interface TestFile extends Partial<File> {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: string;
  path: string;
}

// Remove declare module block for Invoice
export type TestInvoice = Record<string, any>;

export interface TestTemplate extends Partial<Template> {
  id: string;
  userId: string;
  name: string;
  vendorName: string;
  patterns: Record<string, string[]>;
  fieldMappings: Record<string, any>;
  successRate: number;
  usageCount: number;
}

// Test database management
export const setupTestDatabase = async (
  prisma: PrismaClient,
): Promise<void> => {
  try {
    // Clear all tables
    const tables = await prisma.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

    for (const { tablename } of tables) {
      if (tablename !== '_prisma_migrations') {
        await prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "public"."${tablename}" CASCADE;`,
        );
      }
    }
  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  }
};

// Test data generators with proper typing
export const generateTestUser = (
  overrides: Partial<TestUser> = {},
): TestUser => ({
  id: uuidv4(),
  email: `test-${uuidv4()}@example.com`,
  password: createHash('sha256').update('test123').digest('hex'),
  role: 'USER',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const generateTestFile = (
  userId: string,
  overrides: Partial<TestFile> = {},
): TestFile => ({
  id: uuidv4(),
  userId,
  filename: `test-${uuidv4()}.pdf`,
  originalName: 'test-invoice.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  status: 'PENDING',
  path: `/uploads/${uuidv4()}.pdf`,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const generateTestInvoice = (
  userId: string,
  fileId: string,
  overrides: Partial<TestInvoice> = {},
): TestInvoice => ({
  id: uuidv4(),
  userId,
  fileId,
  vendor: 'Test Vendor',
  invoiceNumber: `INV-${uuidv4().slice(0, 8)}`,
  amount: 1000.0,
  taxAmount: 100.0 as any,
  date: new Date(),
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  status: 'PROCESSED',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const generateTestTemplate = (
  userId: string,
  overrides: Partial<TestTemplate> = {},
): TestTemplate => ({
  id: uuidv4(),
  userId,
  name: `Test Template ${uuidv4().slice(0, 8)}`,
  vendorName: 'Test Vendor',
  patterns: {
    vendor: ['From:', 'Vendor:', 'Supplier:'],
    invoiceNumber: ['Invoice #:', 'Invoice Number:', 'Bill #:'],
    totalAmount: ['Total Amount:', 'Total:', 'Amount Due:'],
  },
  fieldMappings: {
    vendor: { type: 'string', required: true },
    invoiceNumber: { type: 'string', required: true, pattern: '^[A-Z0-9-]+$' },
    totalAmount: { type: 'number', required: true, min: 0 },
  },
  successRate: 0.95,
  usageCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Email service mocks
const sendJobStatusEmail = jest
  .fn<() => Promise<boolean>>()
  .mockResolvedValue(true);
const sendErrorNotification = jest
  .fn<() => Promise<boolean>>()
  .mockResolvedValue(true);
const sendWelcomeEmail = jest
  .fn<() => Promise<boolean>>()
  .mockResolvedValue(true);
const sendPasswordResetEmail = jest
  .fn<() => Promise<boolean>>()
  .mockResolvedValue(true);
export const mockEmailService = {
  sendJobStatusEmail,
  sendErrorNotification,
  sendWelcomeEmail,
  sendPasswordResetEmail,
};

// Storage service mocks
const uploadFile = jest
  .fn<() => Promise<{ path: string }>>()
  .mockResolvedValue({ path: '/uploads/test.pdf' });
const deleteFile = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
const getFileUrl = jest
  .fn<() => Promise<string>>()
  .mockResolvedValue('https://storage.example.com/test.pdf');
const getFileBuffer = jest
  .fn<() => Promise<Buffer>>()
  .mockResolvedValue(Buffer.from('test'));
export const mockStorageService = {
  uploadFile,
  deleteFile,
  getFileUrl,
  getFileBuffer,
};

// Queue service mocks
const add = jest
  .fn<() => Promise<{ id: string }>>()
  .mockResolvedValue({ id: 'job-123' });
const getJob = jest
  .fn<
    () => Promise<{
      id: string;
      status: string;
      progress: number;
      result: { success: boolean };
    }>
  >()
  .mockResolvedValue({
    id: 'job-123',
    status: 'completed',
    progress: 100,
    result: { success: true },
  });
const getJobs = jest.fn<() => Promise<any[]>>().mockResolvedValue([]);
const remove = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
export const mockQueueService = {
  add,
  getJob,
  getJobs,
  remove,
};

// Test file utilities with error handling
export const getTestFileBuffer = (filename: string): Buffer => {
  try {
    const filePath = path.join(__dirname, '../fixtures', filename);
    return readFileSync(filePath);
  } catch (error) {
    console.error(`Error reading test file ${filename}:`, error);
    throw error;
  }
};

// Type-safe test assertions
export const expectValidInvoice = (invoice: Partial<Invoice>): void => {
  expect(invoice).toHaveProperty('id');
  expect(invoice).toHaveProperty('userId');
  expect(invoice).toHaveProperty('fileId');
  expect(invoice).toHaveProperty('vendor');
  expect(invoice).toHaveProperty('invoiceNumber');
  expect(invoice).toHaveProperty('amount');
  expect(invoice).toHaveProperty('date');
  expect(invoice).toHaveProperty('status');
  expect(invoice).toHaveProperty('createdAt');
  expect(invoice).toHaveProperty('updatedAt');
};

export const expectValidTemplate = (template: Partial<Template>): void => {
  expect(template).toHaveProperty('id');
  expect(template).toHaveProperty('userId');
  expect(template).toHaveProperty('name');
  expect(template).toHaveProperty('vendorName');
  expect(template).toHaveProperty('patterns');
  expect(template).toHaveProperty('fieldMappings');
  expect(template).toHaveProperty('successRate');
  expect(template).toHaveProperty('usageCount');
  expect(template).toHaveProperty('createdAt');
  expect(template).toHaveProperty('updatedAt');
};

// Performance monitoring with proper typing
export const measureExecutionTime = async <T>(
  fn: () => Promise<T>,
): Promise<{ result: T; duration: number }> => {
  const start = process.hrtime();
  const result = await fn();
  const [seconds, nanoseconds] = process.hrtime(start);
  const duration = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds
  return { result, duration };
};

// Test environment setup with proper error handling
export const setupTestEnvironment = async () => {
  try {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.REDIS_URL = process.env.TEST_REDIS_URL;
    process.env.STORAGE_BUCKET = 'test-bucket';
    process.env.EMAIL_FROM = 'test@example.com';

    // Initialize test database
    const prisma = new PrismaClient();
    await setupTestDatabase(prisma);

    return {
      prisma,
      cleanup: async () => {
        try {
          await prisma.$disconnect();
        } catch (error) {
          console.error('Error disconnecting from test database:', error);
          throw error;
        }
      },
    };
  } catch (error) {
    console.error('Error setting up test environment:', error);
    throw error;
  }
};

// Export all utilities
export default {
  setupTestDatabase,
  generateTestUser,
  generateTestFile,
  generateTestInvoice,
  generateTestTemplate,
  mockEmailService,
  mockStorageService,
  mockQueueService,
  getTestFileBuffer,
  expectValidInvoice,
  expectValidTemplate,
  measureExecutionTime,
  setupTestEnvironment,
};
