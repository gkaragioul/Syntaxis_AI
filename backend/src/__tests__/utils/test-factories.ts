// @ts-nocheck
/**
 * Test Data Factories
 *
 * Provides factory functions for creating test data objects
 * with sensible defaults and customizable overrides.
 */

import { User, Invoice, FileUpload } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * Create test user data
 */
export const createTestUser = (
  overrides: Partial<User> = {},
): Omit<User, 'id' | 'createdAt' | 'updatedAt'> => ({
  email: `test-${randomUUID()}@example.com`,
  password: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptpT1/GxseHlChgyu', // 'password'
  firstName: 'Test',
  lastName: 'User',
  isEmailVerified: true,
  role: 'USER',
  ...overrides,
});

/**
 * Create test invoice data
 */
export const createTestInvoice = (
  overrides: Partial<Invoice> = {},
): Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> => ({
  userId: 'test-user-id',
  fileUploadId: 'test-file-id',
  invoiceNumber: `INV-${Date.now()}`,
  amount: 1000.0,
  currency: 'USD',
  issueDate: new Date(),
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  status: 'PENDING',
  vendor: {
    name: 'Test Vendor Inc.',
    email: 'vendor@example.com',
    address: '123 Test St, Test City, TC 12345',
  },
  lineItems: [
    {
      description: 'Test Service',
      quantity: 1,
      unitPrice: 1000.0,
      total: 1000.0,
    },
  ],
  subtotal: 1000.0,
  taxAmount: 0.0,
  totalAmount: 1000.0,
  notes: null,
  confidence: 0.95,
  ...overrides,
});

/**
 * Create test file upload data
 */
export const createTestFileUpload = (
  overrides: Partial<FileUpload> = {},
): Omit<FileUpload, 'id' | 'createdAt' | 'updatedAt'> => ({
  userId: 'test-user-id',
  originalFilename: 'test-invoice.pdf',
  filename: `${randomUUID()}.pdf`,
  mimeType: 'application/pdf',
  size: 1024 * 100, // 100KB
  path: '/uploads/test-file.pdf',
  status: 'UPLOADED',
  ...overrides,
});

/**
 * Create test file buffer for upload testing
 */
export const createTestFile = (
  options: {
    filename?: string;
    mimeType?: string;
    size?: number;
    content?: string;
  } = {},
) => {
  const {
    filename = 'test-invoice.pdf',
    mimeType = 'application/pdf',
    size = 1024,
    content = 'test file content',
  } = options;

  // Create a simple PDF-like buffer
  const pdfHeader = '%PDF-1.4\n';
  const pdfContent = content.padEnd(size - pdfHeader.length, ' ');
  const buffer = Buffer.from(pdfHeader + pdfContent);

  return {
    buffer,
    filename,
    mimeType,
    size: buffer.length,
  };
};

/**
 * Create test OCR extraction data
 */
export const createTestOCRExtraction = (overrides: any = {}) => ({
  text: 'INVOICE\nInvoice Number: INV-001\nDate: 2024-01-15\nAmount: $1,000.00\nVendor: Test Company Inc.',
  confidence: 0.95,
  fields: {
    invoiceNumber: 'INV-001',
    date: '2024-01-15',
    amount: '1000.00',
    vendor: 'Test Company Inc.',
  },
  ...overrides,
});

/**
 * Create test API response data
 */
export const createTestAPIResponse = <T>(data: T, overrides: any = {}) => ({
  success: true,
  data,
  message: 'Operation completed successfully',
  timestamp: new Date().toISOString(),
  ...overrides,
});

/**
 * Create test error response data
 */
export const createTestErrorResponse = (
  message: string,
  code: string = 'GENERIC_ERROR',
  overrides: any = {},
) => ({
  success: false,
  error: {
    message,
    code,
    timestamp: new Date().toISOString(),
  },
  ...overrides,
});

/**
 * Create test JWT payload
 */
export const createTestJWTPayload = (overrides: any = {}) => ({
  userId: 'test-user-id',
  email: 'test@example.com',
  role: 'USER',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
  ...overrides,
});

/**
 * Create test queue job data
 */
export const createTestQueueJob = (
  type: string,
  data: any = {},
  overrides: any = {},
) => ({
  id: randomUUID(),
  type,
  data: {
    userId: 'test-user-id',
    fileId: 'test-file-id',
    ...data,
  },
  attempts: 0,
  maxAttempts: 3,
  createdAt: new Date(),
  ...overrides,
});

/**
 * Create test email data
 */
export const createTestEmailData = (overrides: any = {}) => ({
  to: 'test@example.com',
  from: 'noreply@syntaxis.ai',
  subject: 'Test Email',
  html: '<p>This is a test email</p>',
  text: 'This is a test email',
  ...overrides,
});

/**
 * Create test pagination data
 */
export const createTestPaginationData = (overrides: any = {}) => ({
  page: 1,
  limit: 10,
  total: 100,
  totalPages: 10,
  hasNext: true,
  hasPrev: false,
  ...overrides,
});

/**
 * Create test filter data
 */
export const createTestFilterData = (overrides: any = {}) => ({
  status: 'PENDING',
  dateFrom: new Date('2024-01-01'),
  dateTo: new Date('2024-12-31'),
  amountMin: 0,
  amountMax: 10000,
  ...overrides,
});

/**
 * Create test validation error data
 */
export const createTestValidationError = (
  field: string,
  message: string,
  overrides: any = {},
) => ({
  field,
  message,
  code: 'VALIDATION_ERROR',
  value: null,
  ...overrides,
});

/**
 * Create test system health data
 */
export const createTestSystemHealth = (overrides: any = {}) => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  services: {
    database: {
      status: 'healthy',
      responseTime: 50,
      connections: 5,
    },
    redis: {
      status: 'healthy',
      responseTime: 10,
      memory: '10MB',
    },
    ocr: {
      status: 'healthy',
      queueSize: 0,
      processing: 0,
    },
  },
  performance: {
    uptime: 3600,
    memoryUsage: '256MB',
    cpuUsage: '15%',
  },
  ...overrides,
});

/**
 * Create test device info data
 */
export const createTestDeviceInfo = (overrides: any = {}) => ({
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.version,
  memory: process.memoryUsage(),
  uptime: process.uptime(),
  ...overrides,
});

/**
 * Create test environment data
 */
export const createTestEnvironmentData = (overrides: any = {}) => ({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'test-jwt-secret',
  ...overrides,
});

/**
 * Helper function to create multiple test objects
 */
export const createMultiple = <T>(factory: () => T, count: number): T[] => {
  return Array.from({ length: count }, factory);
};

/**
 * Helper function to create test data with relationships
 */
export const createTestDataWithRelations = async () => {
  const userData = createTestUser();
  const fileUploadData = createTestFileUpload({ userId: 'user-id' });
  const invoiceData = createTestInvoice({
    userId: 'user-id',
    fileUploadId: 'file-id',
  });

  return {
    user: userData,
    fileUpload: fileUploadData,
    invoice: invoiceData,
  };
};

/**
 * Helper function to clean test data
 */
export const cleanTestData = {
  email: (email: string) => email.toLowerCase().trim(),
  phone: (phone: string) => phone.replace(/\D/g, ''),
  currency: (amount: number) => Math.round(amount * 100) / 100,
  date: (date: string | Date) => new Date(date).toISOString(),
};

/**
 * Helper function to generate random test data
 */
export const generateRandom = {
  email: () => `test-${randomUUID()}@example.com`,
  string: (length: number = 10) => randomUUID().substring(0, length),
  number: (min: number = 0, max: number = 1000) =>
    Math.floor(Math.random() * (max - min + 1)) + min,
  boolean: () => Math.random() > 0.5,
  date: (daysFromNow: number = 0) =>
    new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000),
  currency: () => Math.round(Math.random() * 10000 * 100) / 100,
};
