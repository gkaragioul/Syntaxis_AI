/**
 * Integration Test Setup
 *
 * Setup configuration for integration tests that require
 * database connections and external services.
 */

import {
  setupTestDatabase,
  resetTestDatabase,
  disconnectTestDb,
} from './setup-test-db';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:password@localhost:5432/syntaxis_ai_test';
process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.LOG_LEVEL = 'error';

// Global test timeout for integration tests
jest.setTimeout(30000);

// Setup before all tests
beforeAll(async () => {
  console.log('🔧 Setting up integration test environment...');

  try {
    await setupTestDatabase();
    console.log('✅ Integration test database ready');
  } catch (error) {
    console.error('❌ Failed to setup integration test database:', error);
    throw error;
  }
});

// Cleanup after each test
afterEach(async () => {
  try {
    await resetTestDatabase();
  } catch (error) {
    console.warn('⚠️ Failed to reset test database after test:', error);
  }
});

// Cleanup after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...');

  try {
    await disconnectTestDb();
    console.log('✅ Integration test cleanup completed');
  } catch (error) {
    console.error('❌ Failed to cleanup integration test environment:', error);
  }
});

// Mock external services for integration tests
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  })),
}));

jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  return jest.fn(() => mockRedis);
});

// Mock file system operations for integration tests
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    ...jest.requireActual('fs').promises,
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock OCR services for integration tests
jest.mock('tesseract.js', () => ({
  recognize: jest.fn().mockResolvedValue({
    data: {
      text: 'Mock OCR text result',
      confidence: 85,
    },
  }),
  createWorker: jest.fn(() => ({
    load: jest.fn().mockResolvedValue(undefined),
    loadLanguage: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
    recognize: jest.fn().mockResolvedValue({
      data: {
        text: 'Mock OCR text result',
        confidence: 85,
      },
    }),
    terminate: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export {};
