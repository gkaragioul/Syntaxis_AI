/**
 * Comprehensive Prisma Client Mock for TDD
 * 
 * Task 1.1.2: Complete Prisma client mock implementations
 * 
 * This mock provides complete coverage for all Prisma operations used in the codebase.
 * Following TDD principles: Red-Green-Refactor approach for each mock method.
 */

import { jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

// Mock data factories for consistent test data
export const mockDataFactories = {
  user: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    subscriptionStatus: 'free',
    subscriptionId: null,
    invoicesProcessedThisMonth: 0,
    monthlyLimit: 3,
    lastResetDate: new Date(),
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }),

  invoice: (overrides = {}) => ({
    id: 'test-invoice-id',
    userId: 'test-user-id',
    extractionId: 'test-extraction-id',
    status: 'pending',
    invoiceNumber: 'INV-001',
    invoiceDate: new Date(),
    dueDate: new Date(),
    vendorName: 'Test Vendor',
    vendorAddress: '123 Test St',
    vendorTaxId: 'TAX123',
    customerName: 'Test Customer',
    customerAddress: '456 Customer Ave',
    customerTaxId: 'CUST456',
    subtotal: 100.00,
    taxAmount: 10.00,
    totalAmount: 110.00,
    currency: 'USD',
    paymentTerms: 'Net 30',
    paymentStatus: 'unpaid',
    paymentHistory: [],
    notes: null,
    tags: [],
    metadata: null,
    extractionConfidence: 0.95,
    templateId: null,
    templateType: null,
    templateConfidence: null,
    detectedLanguage: 'en',
    ocrQuality: 0.95,
    validationStatus: 'pending',
    businessRulesScore: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  reviewTask: (overrides = {}) => ({
    id: 'test-review-task-id',
    invoiceId: 'test-invoice-id',
    assignedTo: 'test-reviewer-id',
    priority: 'medium',
    reviewType: 'standard',
    status: 'pending',
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    instructions: null,
    fieldsToReview: null,
    estimatedTime: null,
    finalConfidence: null,
    reviewNotes: null,
    approvalLevel: null,
    rejectionReason: null,
    requiredActions: null,
    createdAt: new Date(),
    completedAt: null,
    ...overrides,
  }),

  ocrResult: (overrides = {}) => ({
    id: 'test-ocr-result-id',
    userId: 'test-user-id',
    ocrResultId: 'ocr-result-001',
    fields: {},
    confidence: 0.95,
    status: 'completed',
    validationErrors: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  correction: (overrides = {}) => ({
    id: 'test-correction-id',
    invoiceId: 'test-invoice-id',
    userId: 'test-user-id',
    fieldName: 'amount',
    oldValue: '100.00',
    newValue: '150.00',
    reason: 'Manual correction',
    confidence: 0.98,
    status: 'applied',
    revertedAt: null,
    revertReason: null,
    createdAt: new Date(),
    ...overrides,
  }),

  file: (overrides = {}) => ({
    id: 'test-file-id',
    userId: 'test-user-id',
    batchJobId: null,
    filename: 'test-file.pdf',
    originalFilename: 'test-file.pdf',
    filePath: '/uploads/test-file.pdf',
    fileSize: BigInt(12345),
    mimeType: 'application/pdf',
    fileHash: 'abc123hash',
    status: 'uploaded',
    uploadStatus: null,
    processingStatus: null,
    extractionConfidence: null,
    validationStatus: null,
    uploadedAt: new Date(),
    processingStartedAt: null,
    processingCompletedAt: null,
    errorMessage: null,
    retryCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  template: (overrides = {}) => ({
    id: 'test-template-id',
    userId: 'test-user-id',
    name: 'Test Template',
    vendorName: 'Test Vendor',
    patterns: {},
    fieldMappings: {},
    successRate: 0.0,
    usageCount: 0,
    templateType: null,
    language: null,
    isActive: true,
    isBuiltIn: false,
    description: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  extraction: (overrides = {}) => ({
    id: 'test-extraction-id',
    fileId: 'test-file-id',
    userId: 'test-user-id',
    vendorName: 'Test Vendor',
    vendorAddress: '123 Test St',
    invoiceNumber: 'INV-001',
    invoiceDate: new Date(),
    dueDate: new Date(),
    totalAmount: 110.00,
    taxAmount: 10.00,
    currency: 'USD',
    lineItems: [],
    extractionConfidence: 0.95,
    fieldConfidence: {},
    ocrEnginesUsed: ['tesseract'],
    processingTimeMs: 1500,
    userEdited: false,
    userCorrections: null,
    reviewStatus: 'pending',
    templateId: null,
    templateApplied: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ocrResultId: null,
    ...overrides,
  }),
};

// Create comprehensive mock for each Prisma model
const createModelMock = (modelName: string) => ({
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
  groupBy: jest.fn(),
});

// Create the complete Prisma mock
export const createPrismaMock = (): jest.Mocked<PrismaClient> => {
  const prismaMock = {
    // User model
    user: createModelMock('user'),
    
    // Invoice-related models
    invoice: createModelMock('invoice'),
    invoiceAttachment: createModelMock('invoiceAttachment'),
    invoiceLineItem: createModelMock('invoiceLineItem'),
    invoiceValidationResult: createModelMock('invoiceValidationResult'),
    invoiceChangeLog: createModelMock('invoiceChangeLog'),
    
    // OCR and extraction models
    ocrResult: createModelMock('ocrResult'),
    extraction: createModelMock('extraction'),
    extractionRule: createModelMock('extractionRule'),
    
    // Review and QA models
    reviewTask: createModelMock('reviewTask'),
    reviewComment: createModelMock('reviewComment'),
    correction: createModelMock('correction'),
    correctionTemplate: createModelMock('correctionTemplate'),
    
    // File and processing models
    file: createModelMock('file'),
    batchJob: createModelMock('batchJob'),
    
    // System models
    auditLog: createModelMock('auditLog'),
    errorReport: createModelMock('errorReport'),
    systemErrorReport: createModelMock('systemErrorReport'),
    notification: createModelMock('notification'),
    
    // Template and configuration models
    template: createModelMock('template'),
    templateApplication: createModelMock('templateApplication'),
    fieldPattern: createModelMock('fieldPattern'),
    confidenceThreshold: createModelMock('confidenceThreshold'),
    
    // Export and status models
    exportJob: createModelMock('exportJob'),
    statusUpdate: createModelMock('statusUpdate'),
    
    // Performance and monitoring models
    performanceMetric: createModelMock('performanceMetric'),
    
    // Authentication models
    session: createModelMock('session'),
    license: createModelMock('license'),
    
    // Device management
    device: createModelMock('device'),
    
    // Prisma client methods
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $executeRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $transaction: jest.fn(),
    $on: jest.fn(),
    $use: jest.fn(),
    $extends: jest.fn(),
  } as any;

  return prismaMock;
};

// Default mock implementations with realistic behavior
export const setupDefaultMockBehavior = (prismaMock: jest.Mocked<PrismaClient>) => {
  // User model defaults
  prismaMock.user.findUnique.mockImplementation(async ({ where }: any) => {
    if (where.id === 'test-user-id' || where.email === 'test@example.com') {
      return mockDataFactories.user();
    }
    return null;
  });

  prismaMock.user.findMany.mockResolvedValue([mockDataFactories.user()]);
  prismaMock.user.create.mockImplementation(async ({ data }: any) =>
    mockDataFactories.user(data)
  );
  prismaMock.user.update.mockImplementation(async ({ data }: any) =>
    mockDataFactories.user(data)
  );
  prismaMock.user.count.mockResolvedValue(1);

  // Invoice model defaults
  prismaMock.invoice.findUnique.mockImplementation(async ({ where }: any) => {
    if (where.id === 'test-invoice-id') {
      return mockDataFactories.invoice();
    }
    return null;
  });

  prismaMock.invoice.findMany.mockResolvedValue([mockDataFactories.invoice()]);
  prismaMock.invoice.create.mockImplementation(async ({ data }: any) =>
    mockDataFactories.invoice(data)
  );
  prismaMock.invoice.update.mockImplementation(async ({ data }: any) =>
    mockDataFactories.invoice(data)
  );
  prismaMock.invoice.count.mockResolvedValue(1);
  prismaMock.invoice.groupBy.mockResolvedValue([]);
  prismaMock.invoice.aggregate.mockResolvedValue({
    _count: { id: 1 },
    _avg: { extractionConfidence: 0.95 },
    _sum: {},
    _min: {},
    _max: {},
  });

  // Review task model defaults
  prismaMock.reviewTask.findMany.mockResolvedValue([mockDataFactories.reviewTask()]);
  prismaMock.reviewTask.create.mockImplementation(async ({ data }: any) =>
    mockDataFactories.reviewTask(data)
  );
  prismaMock.reviewTask.count.mockResolvedValue(1);
  prismaMock.reviewTask.groupBy.mockResolvedValue([]);

  // OCR result model defaults
  prismaMock.ocrResult.create.mockImplementation(async ({ data }: any) =>
    mockDataFactories.ocrResult(data)
  );
  prismaMock.ocrResult.findMany.mockResolvedValue([mockDataFactories.ocrResult()]);

  // Correction model defaults
  prismaMock.correction.findUnique.mockImplementation(async ({ where }: any) => {
    if (where.id === 'test-correction-id') {
      return mockDataFactories.correction();
    }
    return null;
  });
  prismaMock.correction.create.mockImplementation(async ({ data }: any) =>
    mockDataFactories.correction(data)
  );

  // File model defaults
  prismaMock.file.findUnique.mockImplementation(async ({ where }: any) => {
    if (where.id === 'test-file-id') {
      return mockDataFactories.file();
    }
    return null;
  });
  prismaMock.file.create.mockImplementation(async ({ data }: any) =>
    mockDataFactories.file(data)
  );
  prismaMock.file.update.mockImplementation(async ({ data }: any) =>
    mockDataFactories.file(data)
  );
  prismaMock.file.findMany.mockResolvedValue([mockDataFactories.file()]);

  // Template model defaults
  prismaMock.template.findUnique.mockImplementation(async ({ where }: any) => {
    if (where.id === 'test-template-id') {
      return mockDataFactories.template();
    }
    return null;
  });
  prismaMock.template.create.mockImplementation(async ({ data }: any) =>
    mockDataFactories.template(data)
  );
  prismaMock.template.findMany.mockResolvedValue([mockDataFactories.template()]);

  // Extraction model defaults
  prismaMock.extraction.create.mockImplementation(async ({ data }: any) =>
    mockDataFactories.extraction(data)
  );
  prismaMock.extraction.findMany.mockResolvedValue([mockDataFactories.extraction()]);

  // Prisma client method defaults
  prismaMock.$connect.mockResolvedValue(undefined);
  prismaMock.$disconnect.mockResolvedValue(undefined);
  prismaMock.$executeRaw.mockResolvedValue(1);
  prismaMock.$queryRaw.mockResolvedValue([]);
  prismaMock.$transaction.mockImplementation(async (fn: any) => {
    if (typeof fn === 'function') {
      return fn(prismaMock);
    }
    return Promise.all(fn);
  });

  return prismaMock;
};

// Export the main mock instance
export const prismaMock = setupDefaultMockBehavior(createPrismaMock());

// Reset function for test isolation
export const resetPrismaMock = () => {
  Object.values(prismaMock).forEach((model: any) => {
    if (model && typeof model === 'object') {
      Object.values(model).forEach((method: any) => {
        if (jest.isMockFunction(method)) {
          method.mockClear();
        }
      });
    }
  });

  // Re-setup default behavior after reset
  setupDefaultMockBehavior(prismaMock);
};

export default prismaMock;
