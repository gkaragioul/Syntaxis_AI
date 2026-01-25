# Testing Guide - TDD Best Practices

## Overview

This guide outlines Test-Driven Development (TDD) best practices for SyntaxisAI, implementing comprehensive testing strategies that ensure code quality and reliability.

## TDD Methodology

### The Red-Green-Refactor Cycle

1. **🔴 Red**: Write a failing test first
2. **🟢 Green**: Write minimal code to make the test pass
3. **🔵 Refactor**: Improve code while keeping tests green

### TDD Benefits

- **Better Design**: Tests drive better API design
- **Documentation**: Tests serve as living documentation
- **Confidence**: Refactoring with safety net
- **Quality**: Fewer bugs in production

## Test Structure and Organization

This section covers test structure, organization patterns, and best practices for maintaining clean, readable test suites.

### AAA Pattern

```typescript
describe('UserService', () => {
  it('should create user with valid data', async () => {
    // 🔧 Arrange - Setup test data and mocks
    const userData = {
      email: 'test@example.com',
      password: 'securePassword123'
    };
    
    // 🎬 Act - Execute the function under test
    const result = await userService.createUser(userData);
    
    // ✅ Assert - Verify the expected outcome
    expect(result.success).toBe(true);
    expect(result.user.email).toBe(userData.email);
  });
});
```

### Test Naming Convention

```typescript
// ✅ Good: Descriptive and specific
it('should return 400 when email is missing from registration data', () => {});
it('should successfully upload PDF file under 10MB', () => {});
it('should extract invoice total from OCR text with 95% confidence', () => {});

// ❌ Bad: Vague and unclear
it('should work', () => {});
it('should test user creation', () => {});
it('should handle errors', () => {});
```

## Test Categories

### 1. Unit Tests

**Purpose**: Test individual functions/methods in isolation

```typescript
// Example: Testing a utility function
describe('formatCurrency', () => {
  it('should format positive numbers with currency symbol', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });
  
  it('should handle zero values', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });
  
  it('should handle negative values', () => {
    expect(formatCurrency(-100)).toBe('-$100.00');
  });
});
```

**Best Practices**:
- Mock all external dependencies
- Test edge cases and error conditions
- Keep tests fast (< 100ms each)
- One assertion per test when possible

### 2. Integration Tests

**Purpose**: Test interactions between components

```typescript
// Example: Testing API endpoint with database
describe('POST /api/users', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('should create user and return 201 status', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123'
    };

    const response = await request(app)
      .post('/api/users')
      .send(userData)
      .expect(201);

    expect(response.body.user.email).toBe(userData.email);
    
    // Verify database state
    const dbUser = await User.findByEmail(userData.email);
    expect(dbUser).toBeTruthy();
  });
});
```

**Best Practices**:
- Use real database for data persistence tests
- Mock external APIs and services
- Test happy path and error scenarios
- Clean up data between tests

### 3. Component Tests (Frontend)

**Purpose**: Test React components in isolation

```typescript
// Example: Testing a React component
describe('LoginForm', () => {
  it('should display validation error for invalid email', async () => {
    render(<LoginForm onSubmit={mockSubmit} />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /login/i });
    
    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);
    
    expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
```

**Best Practices**:
- Test user interactions, not implementation details
- Use accessible queries (getByRole, getByLabelText)
- Mock API calls and external dependencies
- Test error states and loading states

## Mocking Strategies

### 1. External Services

```typescript
// Mock external API
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

beforeEach(() => {
  mockedAxios.post.mockResolvedValue({
    data: { success: true }
  });
});
```

### 2. Database Operations

```typescript
// Mock Prisma client for unit tests
jest.mock('@prisma/client');
const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
};
```

### 3. File System Operations

```typescript
// Mock fs operations
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('mock file content'),
    unlink: jest.fn().mockResolvedValue(undefined)
  }
}));
```

## Test Data Management

### 1. Test Factories

```typescript
// Create reusable test data factories
export const createTestUser = (overrides = {}) => ({
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  password: 'hashedPassword',
  isEmailVerified: true,
  ...overrides
});

export const createTestInvoice = (overrides = {}) => ({
  filename: 'test-invoice.pdf',
  originalName: 'invoice.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  status: 'PENDING',
  ...overrides
});
```

### 2. Database Seeding

```typescript
// Seed test database with consistent data
export const seedTestData = async () => {
  const testUser = await prisma.user.create({
    data: createTestUser()
  });
  
  const testInvoice = await prisma.invoice.create({
    data: {
      ...createTestInvoice(),
      userId: testUser.id
    }
  });
  
  return { testUser, testInvoice };
};
```

## Error Testing

### 1. Exception Handling

```typescript
describe('UserService.createUser', () => {
  it('should throw ValidationError for invalid email', async () => {
    const invalidUserData = { email: 'invalid', password: 'password' };
    
    await expect(userService.createUser(invalidUserData))
      .rejects
      .toThrow(ValidationError);
  });
  
  it('should handle database connection errors gracefully', async () => {
    // Mock database error
    mockPrisma.user.create.mockRejectedValue(new Error('Connection failed'));
    
    const result = await userService.createUser(validUserData);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection failed');
  });
});
```

### 2. Network Errors

```typescript
describe('API Error Handling', () => {
  it('should retry failed requests up to 3 times', async () => {
    mockedAxios.post
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: { success: true } });
    
    const result = await apiService.uploadFile(fileData);
    
    expect(result.success).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledTimes(3);
  });
});
```

## Performance Testing

### 1. Load Testing

```typescript
describe('Performance Tests', () => {
  it('should process 100 invoices within 30 seconds', async () => {
    const startTime = Date.now();
    const invoices = Array.from({ length: 100 }, () => createTestInvoice());
    
    const results = await Promise.all(
      invoices.map(invoice => invoiceProcessor.process(invoice))
    );
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(30000); // 30 seconds
    expect(results.every(r => r.success)).toBe(true);
  }, 35000); // 35 second timeout
});
```

### 2. Memory Usage

```typescript
describe('Memory Tests', () => {
  it('should not leak memory during file processing', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Process multiple files
    for (let i = 0; i < 50; i++) {
      await fileProcessor.process(createTestFile());
    }
    
    // Force garbage collection
    if (global.gc) global.gc();
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase should be reasonable (< 50MB)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });
});
```

## Coverage Guidelines

### Coverage Targets

- **Critical Business Logic**: 100%
- **API Endpoints**: 95%
- **Utility Functions**: 90%
- **UI Components**: 80%
- **Configuration Files**: 70%

### Coverage Analysis

```bash
# Generate detailed coverage report
npm run test:coverage

# View coverage by function
npm test -- --coverage --coverageReporters=text-summary

# Check coverage for specific files
npm test -- --coverage --collectCoverageFrom="src/services/**/*.ts"
```

## Debugging Tests

### 1. Debug Mode

```typescript
// Add debug logging to tests
describe('Debug Example', () => {
  it('should debug test execution', async () => {
    console.log('🔍 Starting test execution');
    
    const result = await functionUnderTest();
    
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    
    expect(result.success).toBe(true);
  });
});
```

### 2. Isolate Failing Tests

```bash
# Run only specific test
npm test -- --testNamePattern="should create user"

# Run only one test file
npm test -- src/__tests__/user.test.ts

# Run tests in watch mode
npm test -- --watch
```

## Continuous Integration

### 1. Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:unit && npm run lint",
      "pre-push": "npm test"
    }
  }
}
```

### 2. CI Pipeline

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run tests
        run: npm test
      - name: Upload coverage
        uses: codecov/codecov-action@v1
```

## Best Practices Summary

### ✅ Do

- Write tests before implementation (TDD)
- Use descriptive test names
- Test edge cases and error conditions
- Keep tests independent and isolated
- Mock external dependencies
- Maintain high coverage for critical code
- Clean up resources after tests
- Use factories for test data

### ❌ Don't

- Test implementation details
- Write tests that depend on other tests
- Mock business logic
- Ignore failing tests
- Write tests without assertions
- Use production data in tests
- Skip error testing
- Write overly complex tests

## Tools and Libraries

### Backend Testing Stack

- **Jest**: Test framework
- **Supertest**: HTTP testing
- **Prisma**: Database testing utilities
- **ts-jest**: TypeScript support

### Frontend Testing Stack

- **Vitest**: Test framework
- **Testing Library**: Component testing
- **jsdom**: DOM simulation
- **MSW**: API mocking

This comprehensive testing guide ensures consistent, high-quality testing practices across the SyntaxisAI codebase.
