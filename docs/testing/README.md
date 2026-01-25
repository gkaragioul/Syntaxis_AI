# SyntaxisAI Testing Guidelines

## Overview
This document outlines the testing strategy, standards, and best practices for the SyntaxisAI project.

## Testing Strategy

### Test Levels
1. **Unit Tests**
   - Test individual functions and components
   - Mock external dependencies
   - Focus on business logic
   - Coverage: 80% minimum

2. **Integration Tests**
   - Test component interactions
   - Test API endpoints
   - Test database operations
   - Coverage: 70% minimum

3. **End-to-End Tests**
   - Test complete user flows
   - Test critical paths
   - Test error scenarios
   - Coverage: Key user journeys

### Test Types

#### Frontend Tests
1. **Component Tests**
   ```typescript
   import { render, screen } from '@testing-library/react';
   import { InvoiceUpload } from './InvoiceUpload';

   describe('InvoiceUpload', () => {
     it('renders upload area', () => {
       render(<InvoiceUpload />);
       expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
     });
   });
   ```

2. **Hook Tests**
   ```typescript
   import { renderHook, act } from '@testing-library/react';
   import { useInvoiceUpload } from './useInvoiceUpload';

   describe('useInvoiceUpload', () => {
     it('handles file upload', async () => {
       const { result } = renderHook(() => useInvoiceUpload());
       await act(async () => {
         await result.current.uploadFile(mockFile);
       });
       expect(result.current.status).toBe('success');
     });
   });
   ```

3. **Integration Tests**
   ```typescript
   import { render, screen, fireEvent } from '@testing-library/react';
   import { InvoiceList } from './InvoiceList';

   describe('InvoiceList Integration', () => {
     it('loads and displays invoices', async () => {
       render(<InvoiceList />);
       await screen.findByText('Invoice #1');
       expect(screen.getByText('$100.00')).toBeInTheDocument();
     });
   });
   ```

#### Backend Tests
1. **Unit Tests**
   ```typescript
   import { InvoiceService } from './InvoiceService';

   describe('InvoiceService', () => {
     it('processes invoice data', async () => {
       const service = new InvoiceService();
       const result = await service.processInvoice(mockInvoiceData);
       expect(result.total).toBe(1000.00);
     });
   });
   ```

2. **API Tests**
   ```typescript
   import request from 'supertest';
   import { app } from '../app';

   describe('Invoice API', () => {
     it('uploads invoice', async () => {
       const response = await request(app)
         .post('/api/invoices/upload')
         .attach('file', 'test.pdf');
       expect(response.status).toBe(200);
     });
   });
   ```

3. **Database Tests**
   ```typescript
   import { PrismaClient } from '@prisma/client';
   import { InvoiceRepository } from './InvoiceRepository';

   describe('InvoiceRepository', () => {
     let prisma: PrismaClient;
     let repository: InvoiceRepository;

     beforeEach(async () => {
       prisma = new PrismaClient();
       repository = new InvoiceRepository(prisma);
       await prisma.$connect();
     });

     afterEach(async () => {
       await prisma.$disconnect();
     });

     it('creates invoice', async () => {
       const invoice = await repository.create(mockInvoiceData);
       expect(invoice.id).toBeDefined();
     });
   });
   ```

## Test Organization

### Directory Structure
```
src/
├── __tests__/
│   ├── unit/
│   │   ├── services/
│   │   └── utils/
│   ├── integration/
│   │   ├── api/
│   │   └── components/
│   └── e2e/
│       └── flows/
├── components/
│   └── InvoiceUpload/
│       ├── __tests__/
│       │   ├── InvoiceUpload.test.tsx
│       │   └── useInvoiceUpload.test.ts
│       ├── InvoiceUpload.tsx
│       └── useInvoiceUpload.ts
└── services/
    └── invoice/
        ├── __tests__/
        │   └── invoiceService.test.ts
        └── invoiceService.ts
```

### Naming Conventions
- Test files: `*.test.ts` or `*.spec.ts`
- Test suites: `describe` blocks
- Test cases: `it` or `test` blocks
- Test utilities: `test-utils.ts`

## Test Data

### Mock Data
```typescript
// test/fixtures/invoices.ts
export const mockInvoice = {
  id: 'inv_123',
  filename: 'invoice.pdf',
  status: 'processed',
  extractedData: {
    invoiceNumber: 'INV-001',
    total: 1000.00,
  },
};

// test/fixtures/users.ts
export const mockUser = {
  id: 'user_123',
  email: 'test@example.com',
  role: 'user',
};
```

### Test Factories
```typescript
// test/factories/invoiceFactory.ts
export const createInvoice = (overrides = {}) => ({
  id: faker.string.uuid(),
  filename: faker.system.fileName(),
  status: 'pending',
  ...overrides,
});
```

## Test Utilities

### Frontend Utilities
```typescript
// test/utils.tsx
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const renderWithProviders = (
  ui: React.ReactElement,
  {
    queryClient = new QueryClient(),
    ...options
  } = {}
) => {
  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    ),
    ...options,
  });
};
```

### Backend Utilities
```typescript
// test/utils.ts
import { PrismaClient } from '@prisma/client';

export const setupTestDatabase = async () => {
  const prisma = new PrismaClient();
  await prisma.$connect();
  return prisma;
};

export const teardownTestDatabase = async (prisma: PrismaClient) => {
  await prisma.$disconnect();
};
```

## Best Practices

### General
1. **Test Isolation**
   - Each test should be independent
   - Clean up after each test
   - Don't rely on test order
   - Reset mocks between tests

2. **Test Structure**
   - Arrange-Act-Assert pattern
   - Clear test descriptions
   - Focus on behavior
   - Avoid test duplication

3. **Mocking**
   - Mock external dependencies
   - Use realistic mock data
   - Verify mock calls
   - Reset mocks between tests

### Frontend
1. **Component Testing**
   - Test user interactions
   - Test error states
   - Test loading states
   - Test accessibility

2. **Hook Testing**
   - Test state changes
   - Test side effects
   - Test error handling
   - Test cleanup

### Backend
1. **API Testing**
   - Test all status codes
   - Test error responses
   - Test validation
   - Test authentication

2. **Database Testing**
   - Use test database
   - Clean up after tests
   - Test transactions
   - Test constraints

## Coverage Requirements

### Frontend
- Statements: 80%
- Branches: 80%
- Functions: 80%
- Lines: 80%

### Backend
- Statements: 95%
- Branches: 95%
- Functions: 95%
- Lines: 95%

## Running Tests

### Commands
```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### CI/CD Integration
- Run tests on every PR
- Enforce coverage thresholds
- Generate coverage reports
- Block PR if tests fail

## Debugging Tests

### Frontend
1. **Browser**
   - Use `debug()` from Testing Library
   - Use React DevTools
   - Check console errors

2. **Node**
   - Use `--inspect-brk`
   - Use VS Code debugger
   - Check test output

### Backend
1. **API Tests**
   - Use `console.log()`
   - Check response body
   - Use debugger

2. **Database Tests**
   - Check SQL queries
   - Verify data state
   - Use transaction logs

## Common Issues

### Frontend
1. **Async Tests**
   - Use `async/await`
   - Use `waitFor`
   - Handle loading states

2. **Mocking**
   - Reset mocks
   - Use proper types
   - Verify mock calls

### Backend
1. **Database**
   - Clean up data
   - Use transactions
   - Handle connections

2. **API**
   - Handle timeouts
   - Mock external services
   - Test error cases

## Resources

### Documentation
- [Testing Library](https://testing-library.com)
- [Jest](https://jestjs.io)
- [Vitest](https://vitest.dev)
- [Supertest](https://github.com/visionmedia/supertest)

### Tools
- VS Code Test Explorer
- Jest Runner
- React Testing Library
- Chrome DevTools

---

*Last Updated: [Current Date]*
*Version: 1.0.0* 