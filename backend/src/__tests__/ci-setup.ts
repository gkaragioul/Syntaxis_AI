/**
 * Minimal CI Test Setup
 * 
 * This setup is optimized for CI environments:
 * - No external service connections
 * - Minimal database setup
 * - Fast mock implementations
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.CI = 'true';

// Mock all external services
jest.mock('@google-cloud/vision');
jest.mock('bull');
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    llen: jest.fn(),
    lpush: jest.fn(),
    lpop: jest.fn(),
    lrange: jest.fn(),
    ltrim: jest.fn(),
    zrangebyscore: jest.fn(),
    info: jest.fn().mockResolvedValue(''),
    dbsize: jest.fn().mockResolvedValue(0),
  }));
});
jest.mock('../redis', () => ({
  redis: {
    on: jest.fn(),
    quit: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    llen: jest.fn(),
    lpush: jest.fn(),
    lpop: jest.fn(),
    lrange: jest.fn(),
    ltrim: jest.fn(),
    zrangebyscore: jest.fn(),
    info: jest.fn().mockResolvedValue(''),
    dbsize: jest.fn().mockResolvedValue(0),
  }
}));
jest.mock('nodemailer');
jest.mock('aws-sdk');

// Mock Prisma for CI
jest.mock('../prisma', () => ({
  prisma: {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    user: {
      create: jest.fn().mockResolvedValue({ id: 'test-user' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'test-user' }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'test-user' }),
      delete: jest.fn().mockResolvedValue({ id: 'test-user' }),
    },
    file: {
      create: jest.fn().mockResolvedValue({ id: 'test-file' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'test-file' }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'test-file' }),
      delete: jest.fn().mockResolvedValue({ id: 'test-file' }),
    },
    ocrResult: {
      create: jest.fn().mockResolvedValue({ id: 'test-ocr' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'test-ocr' }),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'test-audit' }),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(0),
    },
  },
}));

// Mock file system operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('test file content')),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({ size: 1024 }),
  access: jest.fn().mockResolvedValue(undefined),
}));

// Mock path operations
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => '/' + args.join('/')),
}));

// Global test utilities for CI
(global as any).testUtils = {
  createMockUser: () => ({ id: 'test-user', email: 'test@example.com' }),
  createMockFile: () => ({ id: 'test-file', filename: 'test.pdf' }),
  createMockOCRResult: () => ({ id: 'test-ocr', text: 'test text' }),
};

// Shorter timeouts for CI
jest.setTimeout(5000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
