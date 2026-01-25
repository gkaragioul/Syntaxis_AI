# TDD Workflow Documentation

**Task 1.2.1: TDD Workflow Documentation and Guidelines**

This document establishes the Test-Driven Development (TDD) workflow for the SyntaxisAI project, ensuring 95%+ test coverage and production-ready code quality.

## 🎯 TDD Principles

### Core TDD Cycle: Red-Green-Refactor

1. **🔴 RED**: Write a failing test that describes the desired functionality
2. **🟢 GREEN**: Write the minimal code to make the test pass
3. **🔵 REFACTOR**: Improve the code while keeping tests green

### TDD Quality Gates

- **95%+ Test Coverage**: All code must maintain 95% or higher test coverage
- **Test-First Development**: No production code without corresponding tests
- **100% Test Pass Rate**: All tests must pass before merging
- **Continuous Integration**: Tests run on every commit

## 📋 TDD Workflow Steps

### Step 1: Requirements Analysis
```markdown
Before writing any code:
1. Understand the feature requirements
2. Break down into testable units
3. Identify edge cases and error conditions
4. Plan test scenarios
```

### Step 2: Write Failing Test (RED Phase)
```typescript
// Example: Testing a new invoice validation service
describe('InvoiceValidationService', () => {
  it('should validate invoice amount is positive', () => {
    // RED: This test will fail initially
    const service = new InvoiceValidationService();
    const invoice = { amount: -100 };
    
    expect(() => service.validate(invoice)).toThrow('Amount must be positive');
  });
});
```

### Step 3: Implement Minimal Code (GREEN Phase)
```typescript
// Minimal implementation to pass the test
export class InvoiceValidationService {
  validate(invoice: { amount: number }): void {
    if (invoice.amount <= 0) {
      throw new Error('Amount must be positive');
    }
  }
}
```

### Step 4: Refactor (REFACTOR Phase)
```typescript
// Improve the implementation while keeping tests green
export class InvoiceValidationService {
  validate(invoice: Invoice): ValidationResult {
    const errors: string[] = [];
    
    if (invoice.amount <= 0) {
      errors.push('Amount must be positive');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
```

## 🛠️ TDD Tools and Setup

### Required Tools
- **Jest**: Primary testing framework
- **Supertest**: API endpoint testing
- **@testing-library**: Component testing
- **Coverage Reports**: Istanbul/NYC for coverage tracking

### Test Environment Setup
```bash
# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
```

### Mock Configuration
```typescript
// Use our standardized mocks
import { setupTestEnvironment } from '../__tests__/utils/test-environment';
import { prismaMock } from '../__tests__/__mocks__/prisma';

beforeEach(async () => {
  await setupTestEnvironment({ useMocks: true });
});
```

## 📊 Coverage Requirements

### Coverage Thresholds
```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 95,
    functions: 95,
    lines: 95,
    statements: 95,
  },
}
```

### Coverage Validation
```bash
# Validate coverage meets requirements
npm run test:coverage
npm run validate:coverage
```

## 🔄 Development Workflow

### Feature Development Process

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/invoice-validation-tdd
   ```

2. **Write Failing Tests First**
   ```typescript
   // Always start with failing tests
   describe('New Feature', () => {
     it('should handle expected behavior', () => {
       // RED: Write failing test
       expect(newFeature()).toBe(expectedResult);
     });
   });
   ```

3. **Implement Minimal Code**
   ```typescript
   // GREEN: Make test pass with minimal code
   export function newFeature() {
     return expectedResult;
   }
   ```

4. **Refactor and Improve**
   ```typescript
   // REFACTOR: Improve while keeping tests green
   export function newFeature(input: InputType): OutputType {
     // Improved implementation
     return processedResult;
   }
   ```

5. **Validate Coverage**
   ```bash
   npm run test:coverage
   # Ensure 95%+ coverage maintained
   ```

6. **Commit and Push**
   ```bash
   git add .
   git commit -m "feat: implement invoice validation with TDD"
   git push origin feature/invoice-validation-tdd
   ```

### Code Review Checklist

- [ ] All tests pass (`npm test`)
- [ ] Coverage meets 95% threshold
- [ ] Tests follow TDD principles (written first)
- [ ] Code follows Red-Green-Refactor cycle
- [ ] Edge cases are tested
- [ ] Error conditions are handled
- [ ] Mocks are properly configured
- [ ] Integration tests included where appropriate

## 🧪 Test Categories

### Unit Tests
```typescript
// Test individual functions/methods in isolation
describe('CalculationService', () => {
  it('should calculate tax correctly', () => {
    const service = new CalculationService();
    expect(service.calculateTax(100, 0.1)).toBe(10);
  });
});
```

### Integration Tests
```typescript
// Test component interactions
describe('Invoice Processing Integration', () => {
  it('should process invoice end-to-end', async () => {
    const result = await processInvoice(mockInvoiceData);
    expect(result.status).toBe('processed');
  });
});
```

### End-to-End Tests
```typescript
// Test complete user workflows
describe('Invoice Upload E2E', () => {
  it('should upload and process invoice successfully', async () => {
    const response = await request(app)
      .post('/api/invoices/upload')
      .attach('file', 'test-invoice.pdf');
    
    expect(response.status).toBe(200);
  });
});
```

## 🚨 Common TDD Pitfalls to Avoid

### ❌ Don't Do This
```typescript
// Writing implementation first, then tests
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Test written after implementation
it('should calculate total', () => {
  expect(calculateTotal([{price: 10}, {price: 20}])).toBe(30);
});
```

### ✅ Do This Instead
```typescript
// Write test first (RED)
it('should calculate total of item prices', () => {
  const items = [{price: 10}, {price: 20}];
  expect(calculateTotal(items)).toBe(30);
});

// Then implement (GREEN)
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

## 📈 TDD Metrics and Monitoring

### Key Metrics
- **Test Coverage**: Must maintain 95%+
- **Test Pass Rate**: Must be 100%
- **Test Execution Time**: Keep under 30 seconds for unit tests
- **Code Quality**: ESLint and TypeScript compliance

### Monitoring Tools
```bash
# Coverage reporting
npm run test:coverage

# Performance monitoring
npm run test:performance

# Quality gates
npm run validate:all
```

## 🔧 Troubleshooting

### Common Issues

1. **Tests Failing After Refactor**
   - Ensure mocks are properly reset
   - Check test isolation
   - Verify environment setup

2. **Coverage Below Threshold**
   - Identify uncovered code paths
   - Add tests for edge cases
   - Review exclusion patterns

3. **Slow Test Execution**
   - Use mocks instead of real dependencies
   - Optimize test setup/teardown
   - Parallelize test execution

### Debug Commands
```bash
# Run tests with debug output
npm run test:debug

# Analyze coverage gaps
npm run coverage:analyze

# Validate test environment
npm run test:validate-env
```

## 📚 Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [TDD Best Practices](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Testing Library Guide](https://testing-library.com/docs/)
- [SyntaxisAI Testing Guidelines](./testing-guidelines.md)

---

**Last Updated**: Phase 1 TDD Implementation
**Status**: Active TDD Workflow
**Next Review**: After Phase 1 completion
