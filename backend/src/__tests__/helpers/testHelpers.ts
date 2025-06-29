import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../../index';
import { config } from '../../config';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  licenseId?: string;
}

export const createTestUser = async (overrides: Partial<TestUser> = {}): Promise<TestUser> => {
  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    licenseId: `license-${Date.now()}`,
  };

  const userData = { ...defaultUser, ...overrides };
  const hashedPassword = await bcrypt.hash(userData.password, 10);

  const user = await prisma.user.create({
    data: {
      email: userData.email,
      password: hashedPassword,
      licenseId: userData.licenseId,
      emailVerified: true,
    },
  });

  return {
    id: user.id,
    email: user.email,
    password: userData.password, // Return original password for testing
    licenseId: user.licenseId,
  };
};

export const createTestToken = (userId: string): string => {
  return jwt.sign(
    { 
      sub: userId,
      userId: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
    },
    config.jwt.secret,
    { algorithm: 'HS256' }
  );
};

export const createTestRefreshToken = (userId: string): string => {
  return jwt.sign(
    { 
      sub: userId,
      userId: userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    },
    config.jwt.refreshSecret,
    { algorithm: 'HS256' }
  );
};

export const createTestInvoice = async (userId: string, overrides: any = {}) => {
  const defaultInvoice = {
    invoiceNumber: `INV-${Date.now()}`,
    vendorName: 'Test Vendor',
    totalAmount: 100.00,
    invoiceDate: new Date(),
    status: 'pending',
  };

  const invoiceData = { ...defaultInvoice, ...overrides };

  return await prisma.invoice.create({
    data: {
      ...invoiceData,
      userId,
    },
  });
};

export const createTestFile = async (userId: string, overrides: any = {}) => {
  const defaultFile = {
    filename: `test-${Date.now()}.pdf`,
    originalFilename: 'test.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    status: 'uploaded',
  };

  const fileData = { ...defaultFile, ...overrides };

  return await prisma.file.create({
    data: {
      ...fileData,
      userId,
    },
  });
};

export const cleanupTestData = async () => {
  // Clean up test data in reverse dependency order
  await prisma.invoice.deleteMany({
    where: {
      invoiceNumber: {
        startsWith: 'INV-',
      },
    },
  });

  await prisma.file.deleteMany({
    where: {
      filename: {
        startsWith: 'test-',
      },
    },
  });

  await prisma.user.deleteMany({
    where: {
      email: {
        contains: 'test-',
      },
    },
  });
};

export const mockRequest = (overrides: any = {}) => {
  return {
    user: null,
    headers: {},
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
};

export const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

export const expectStandardSuccessResponse = (response: any) => {
  expect(response).toHaveProperty('success', true);
  expect(response).toHaveProperty('data');
  expect(response).toHaveProperty('timestamp');
  expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
};

export const expectStandardErrorResponse = (response: any) => {
  expect(response).toHaveProperty('success', false);
  expect(response).toHaveProperty('error');
  expect(response.error).toHaveProperty('code');
  expect(response.error).toHaveProperty('userMessage');
  expect(response.error).toHaveProperty('nextSteps');
  expect(response.error).toHaveProperty('helpUrl');
  expect(response).toHaveProperty('timestamp');
};

export const expectPaginatedResponse = (response: any) => {
  expectStandardSuccessResponse(response);
  expect(response.data).toHaveProperty('items');
  expect(response.data).toHaveProperty('pagination');
  expect(response.data.pagination).toHaveProperty('page');
  expect(response.data.pagination).toHaveProperty('limit');
  expect(response.data.pagination).toHaveProperty('total');
  expect(response.data.pagination).toHaveProperty('totalPages');
};

export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const generateRandomString = (length: number = 10): string => {
  return Math.random().toString(36).substring(2, 2 + length);
};

export const generateRandomEmail = (): string => {
  return `test-${generateRandomString()}@example.com`;
};

export const generateRandomUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
