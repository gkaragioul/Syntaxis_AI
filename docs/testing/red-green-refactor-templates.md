# Red-Green-Refactor Cycle Templates

**Task 1.2.2: Red-Green-Refactor Cycle Templates**

This document provides standardized templates for implementing the Red-Green-Refactor TDD cycle in the SyntaxisAI project.

## 🔴 RED Phase Templates

### Template 1: Service Method Testing
```typescript
/**
 * RED PHASE: Write failing test for service method
 * 
 * Purpose: Test a new service method before implementation
 * Pattern: Arrange-Act-Assert
 */
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', async () => {
      // ARRANGE: Setup test data and mocks
      const mockInput = {
        // Define test input
      };
      const expectedOutput = {
        // Define expected result
      };

      // ACT: Call the method that doesn't exist yet
      const result = await service.methodName(mockInput);

      // ASSERT: Verify expected behavior
      expect(result).toEqual(expectedOutput);
    });

    it('should throw error when [error condition]', async () => {
      // ARRANGE: Setup error scenario
      const invalidInput = {
        // Define invalid input
      };

      // ACT & ASSERT: Verify error is thrown
      await expect(service.methodName(invalidInput))
        .rejects.toThrow('Expected error message');
    });
  });
});
```

### Template 2: API Endpoint Testing
```typescript
/**
 * RED PHASE: Write failing test for API endpoint
 * 
 * Purpose: Test API endpoint before implementation
 * Pattern: HTTP request/response testing
 */
describe('POST /api/endpoint', () => {
  it('should return success response with valid data', async () => {
    // ARRANGE: Setup request data
    const requestData = {
      // Define request payload
    };
    const expectedResponse = {
      success: true,
      data: {
        // Define expected response
      },
    };

    // ACT: Make HTTP request to non-existent endpoint
    const response = await request(app)
      .post('/api/endpoint')
      .send(requestData)
      .expect(200);

    // ASSERT: Verify response structure
    expect(response.body).toEqual(expectedResponse);
  });

  it('should return 400 for invalid input', async () => {
    // ARRANGE: Setup invalid request
    const invalidData = {
      // Define invalid payload
    };

    // ACT & ASSERT: Verify error response
    const response = await request(app)
      .post('/api/endpoint')
      .send(invalidData)
      .expect(400);

    expect(response.body.error).toBeDefined();
  });
});
```

### Template 3: Database Operation Testing
```typescript
/**
 * RED PHASE: Write failing test for database operation
 * 
 * Purpose: Test database interactions before implementation
 * Pattern: Database state verification
 */
describe('DatabaseService', () => {
  beforeEach(async () => {
    await setupTestEnvironment({ useMocks: true });
  });

  it('should create record with valid data', async () => {
    // ARRANGE: Setup test data
    const createData = {
      // Define creation data
    };
    const expectedRecord = {
      id: expect.any(String),
      ...createData,
      createdAt: expect.any(Date),
    };

    // ACT: Call non-existent create method
    const result = await databaseService.create(createData);

    // ASSERT: Verify record creation
    expect(result).toEqual(expectedRecord);
    expect(prismaMock.model.create).toHaveBeenCalledWith({
      data: createData,
    });
  });
});
```

## 🟢 GREEN Phase Templates

### Template 1: Minimal Service Implementation
```typescript
/**
 * GREEN PHASE: Minimal implementation to pass tests
 * 
 * Purpose: Make failing tests pass with simplest possible code
 * Pattern: Minimal viable implementation
 */
export class ServiceName {
  async methodName(input: InputType): Promise<OutputType> {
    // MINIMAL IMPLEMENTATION: Just enough to pass the test
    if (!input || !input.requiredField) {
      throw new Error('Expected error message');
    }

    // Return minimal expected structure
    return {
      // Minimal response to satisfy test
      success: true,
      data: input,
    };
  }
}
```

### Template 2: Minimal API Controller
```typescript
/**
 * GREEN PHASE: Minimal API controller implementation
 * 
 * Purpose: Create endpoint that passes tests
 * Pattern: Basic request/response handling
 */
export const endpointController = async (req: Request, res: Response) => {
  try {
    // MINIMAL VALIDATION: Basic input check
    if (!req.body || !req.body.requiredField) {
      return res.status(400).json({
        error: 'Required field missing',
      });
    }

    // MINIMAL PROCESSING: Just return expected structure
    const result = {
      success: true,
      data: req.body,
    };

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};
```

### Template 3: Minimal Database Service
```typescript
/**
 * GREEN PHASE: Minimal database service implementation
 * 
 * Purpose: Implement database operations to pass tests
 * Pattern: Basic CRUD operations
 */
export class DatabaseService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateData): Promise<CreatedRecord> {
    // MINIMAL IMPLEMENTATION: Basic create operation
    const record = await this.prisma.model.create({
      data,
    });

    return record;
  }

  async findById(id: string): Promise<Record | null> {
    // MINIMAL IMPLEMENTATION: Basic find operation
    return await this.prisma.model.findUnique({
      where: { id },
    });
  }
}
```

## 🔵 REFACTOR Phase Templates

### Template 1: Enhanced Service Implementation
```typescript
/**
 * REFACTOR PHASE: Improve implementation while keeping tests green
 * 
 * Purpose: Add proper error handling, validation, and business logic
 * Pattern: Production-ready implementation
 */
export class ServiceName {
  constructor(
    private logger: Logger,
    private validator: Validator,
    private repository: Repository
  ) {}

  async methodName(input: InputType): Promise<OutputType> {
    // ENHANCED VALIDATION: Comprehensive input validation
    const validationResult = await this.validator.validate(input);
    if (!validationResult.isValid) {
      this.logger.warn('Invalid input', { input, errors: validationResult.errors });
      throw new ValidationError(validationResult.errors);
    }

    try {
      // ENHANCED PROCESSING: Business logic implementation
      const processedData = await this.processBusinessLogic(input);
      
      // ENHANCED PERSISTENCE: Proper data handling
      const result = await this.repository.save(processedData);

      this.logger.info('Operation completed successfully', { 
        input: input.id, 
        result: result.id 
      });

      return {
        success: true,
        data: result,
        metadata: {
          processedAt: new Date(),
          version: '1.0',
        },
      };
    } catch (error) {
      this.logger.error('Operation failed', { error, input });
      throw new ServiceError('Operation failed', error);
    }
  }

  private async processBusinessLogic(input: InputType): Promise<ProcessedData> {
    // Business logic implementation
    return {
      ...input,
      processed: true,
      processedAt: new Date(),
    };
  }
}
```

### Template 2: Enhanced API Controller
```typescript
/**
 * REFACTOR PHASE: Production-ready API controller
 * 
 * Purpose: Add proper middleware, validation, and error handling
 * Pattern: Enterprise-grade API implementation
 */
export const endpointController = [
  // ENHANCED MIDDLEWARE: Add validation and security
  validateRequest(requestSchema),
  authenticateUser,
  authorizeAction('endpoint:write'),
  rateLimitMiddleware,

  // ENHANCED HANDLER: Comprehensive request handling
  async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.headers['x-correlation-id'] as string;
    
    try {
      // ENHANCED LOGGING: Structured logging
      logger.info('Processing request', {
        correlationId,
        endpoint: req.path,
        userId: req.user?.id,
      });

      // ENHANCED PROCESSING: Use service layer
      const result = await endpointService.processRequest({
        ...req.body,
        userId: req.user.id,
        correlationId,
      });

      // ENHANCED RESPONSE: Consistent response format
      res.status(200).json({
        success: true,
        data: result,
        metadata: {
          correlationId,
          timestamp: new Date().toISOString(),
          version: 'v1',
        },
      });

    } catch (error) {
      next(error); // Let error middleware handle it
    }
  },
];
```

### Template 3: Enhanced Database Service
```typescript
/**
 * REFACTOR PHASE: Production-ready database service
 * 
 * Purpose: Add transactions, caching, and optimizations
 * Pattern: Enterprise database operations
 */
export class DatabaseService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheService,
    private logger: Logger
  ) {}

  async create(data: CreateData, options: CreateOptions = {}): Promise<CreatedRecord> {
    const { useTransaction = true, skipCache = false } = options;

    try {
      // ENHANCED VALIDATION: Schema validation
      const validatedData = await this.validateCreateData(data);

      // ENHANCED TRANSACTION: Proper transaction handling
      const result = await this.prisma.$transaction(async (tx) => {
        const record = await tx.model.create({
          data: validatedData,
          include: {
            // Include related data
            relatedModel: true,
          },
        });

        // ENHANCED AUDIT: Audit trail
        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            modelName: 'Model',
            recordId: record.id,
            userId: data.userId,
            changes: validatedData,
          },
        });

        return record;
      });

      // ENHANCED CACHING: Cache management
      if (!skipCache) {
        await this.cache.set(`model:${result.id}`, result, { ttl: 3600 });
      }

      this.logger.info('Record created successfully', {
        modelName: 'Model',
        recordId: result.id,
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to create record', { error, data });
      throw new DatabaseError('Create operation failed', error);
    }
  }

  private async validateCreateData(data: CreateData): Promise<ValidatedData> {
    // Enhanced validation logic
    const schema = z.object({
      // Define validation schema
    });

    return schema.parse(data);
  }
}
```

## 🔄 Complete TDD Cycle Example

### Iteration 1: Basic Functionality
```typescript
// RED: Write failing test
it('should calculate invoice total', () => {
  expect(calculateTotal([])).toBe(0);
});

// GREEN: Minimal implementation
function calculateTotal(items: any[]): number {
  return 0;
}

// REFACTOR: Improve while keeping test green
function calculateTotal(items: InvoiceItem[]): number {
  return items.length === 0 ? 0 : items.reduce((sum, item) => sum + item.amount, 0);
}
```

### Iteration 2: Add Complexity
```typescript
// RED: Add test for tax calculation
it('should include tax in total calculation', () => {
  const items = [{ amount: 100, taxRate: 0.1 }];
  expect(calculateTotal(items)).toBe(110);
});

// GREEN: Extend implementation
function calculateTotal(items: InvoiceItem[]): number {
  return items.reduce((sum, item) => {
    const itemTotal = item.amount + (item.amount * (item.taxRate || 0));
    return sum + itemTotal;
  }, 0);
}

// REFACTOR: Improve structure
class InvoiceCalculator {
  calculateTotal(items: InvoiceItem[]): number {
    return items.reduce((sum, item) => sum + this.calculateItemTotal(item), 0);
  }

  private calculateItemTotal(item: InvoiceItem): number {
    const tax = item.amount * (item.taxRate || 0);
    return item.amount + tax;
  }
}
```

## 📋 TDD Cycle Checklist

### Before Starting
- [ ] Understand requirements clearly
- [ ] Identify testable behaviors
- [ ] Plan test scenarios
- [ ] Set up test environment

### RED Phase
- [ ] Write failing test first
- [ ] Test describes desired behavior
- [ ] Test is specific and focused
- [ ] Run test to confirm it fails

### GREEN Phase
- [ ] Write minimal code to pass test
- [ ] Don't add extra functionality
- [ ] Focus on making test pass
- [ ] Run test to confirm it passes

### REFACTOR Phase
- [ ] Improve code quality
- [ ] Add error handling
- [ ] Optimize performance
- [ ] Maintain test coverage
- [ ] All tests still pass

### Completion
- [ ] Code meets requirements
- [ ] Tests are comprehensive
- [ ] Coverage meets 95% threshold
- [ ] Code is production-ready

---

**Last Updated**: Phase 1 TDD Implementation
**Status**: Active Templates
**Usage**: Copy templates for new TDD cycles
