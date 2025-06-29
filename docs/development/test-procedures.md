# Test Procedures Documentation

## Overview

This document outlines the comprehensive testing procedures for SyntaxisAI, implementing Tasks 1.4.5 and 2.2.5 from the scratchpad with TDD best practices, system verification, and end-to-end testing procedures.

## Test Environment Setup

### Prerequisites

Before running tests, ensure you have:

1. **PostgreSQL** installed and running
2. **Redis** installed and running  
3. **Test database** created and configured
4. **Dependencies** installed in all workspaces

### Quick Setup

```bash
# Setup test environment
npm run setup:test

# Or setup specific workspaces
npm run setup:test:backend
npm run setup:test:frontend
```

## Test Categories

### 1. Unit Tests

**Purpose**: Test individual functions and components in isolation

**Backend Unit Tests**:
```bash
# Run all unit tests
cd backend && npm run test:unit

# Run specific unit test files
cd backend && npm run test:unit -- --testPathPattern=setup-dependencies

# Run with watch mode
cd backend && npm run test:unit:watch

# Run with coverage
cd backend && npm run test:unit -- --coverage
```

**Frontend Unit Tests**:
```bash
# Run all frontend unit tests
cd frontend && npm test

# Run with UI
cd frontend && npm run test:ui

# Run with coverage
cd frontend && npm run test:coverage
```

### 2. Integration Tests

**Purpose**: Test interactions between components and services

```bash
# Run all integration tests
cd backend && npm run test:integration

# Run specific integration test suites
cd backend && npm run test:auth
cd backend && npm run test:extraction
cd backend && npm run test:processing
```

### 3. End-to-End Tests

**Purpose**: Test complete user workflows

```bash
# Run E2E tests
cd backend && npm run test:e2e

# Run E2E tests with specific configuration
cd backend && npm run test:e2e -- --config=jest.e2e.config.js
```

### 4. System Verification Tests (Phase 2)

**Purpose**: Verify local system setup and service connectivity

```bash
# Run all system verification tests
cd backend && npm run test:unit -- --testPathPattern=system-verification

# Test backend/frontend development scripts
cd backend && npm run test:unit -- --testPathPattern=system-verification --testNamePattern="Start existing"

# Test database connectivity
cd backend && npm run test:unit -- --testPathPattern=system-verification --testNamePattern="database connectivity"

# Test Redis connectivity
cd backend && npm run test:unit -- --testPathPattern=system-verification --testNamePattern="Redis connectivity"

# Test service communication
cd backend && npm run test:unit -- --testPathPattern=system-verification --testNamePattern="services are communicating"
```

### 5. End-to-End Flow Tests (Phase 2)

**Purpose**: Test complete user flows and error handling

```bash
# Run all E2E flow tests
cd backend && npm run test:unit -- --testPathPattern=end-to-end-flows

# Test user registration and login flow
cd backend && npm run test:unit -- --testPathPattern=end-to-end-flows --testNamePattern="registration.*login"

# Test file upload and processing flow
cd backend && npm run test:unit -- --testPathPattern=end-to-end-flows --testNamePattern="file upload.*processing"

# Test invoice creation and viewing flow
cd backend && npm run test:unit -- --testPathPattern=end-to-end-flows --testNamePattern="invoice creation.*viewing"

# Test error handling and user feedback
cd backend && npm run test:unit -- --testPathPattern=end-to-end-flows --testNamePattern="error handling"
```

## Test Database Management

### Database Setup

```bash
# Create test database
createdb syntaxis_ai_test

# Run test migrations
cd backend && npm run test:db:migrate

# Reset test database
cd backend && npm run test:db:reset
```

### Environment Configuration

Create `.env.test` in backend directory:

```env
NODE_ENV=test
DATABASE_URL=postgresql://postgres:password@localhost:5432/syntaxis_ai_test
JWT_SECRET=test-jwt-secret
REDIS_URL=redis://localhost:6379/1
LOG_LEVEL=error
DISABLE_RATE_LIMITING=true
```

## Running Tests

### All Tests

```bash
# Run all tests across workspaces
npm test

# Run all backend tests
cd backend && npm test

# Run all frontend tests
cd frontend && npm test
```

### Specific Test Suites

```bash
# Dependency setup tests
npm run test:dependencies

# Setup utilities tests
cd backend && npm run test:setup-utils

# Phase 1 tests (Development Setup)
cd backend && npm test -- --testPathPattern=phase1

# Phase 2 tests (System Verification & E2E Flows)
cd backend && npm test -- --testPathPattern=phase2

# System verification tests only
cd backend && npm run test:unit -- --testPathPattern=system-verification

# End-to-end flow tests only
cd backend && npm run test:unit -- --testPathPattern=end-to-end-flows
```

### Coverage Reports

```bash
# Generate coverage report
cd backend && npm run test:coverage

# View coverage in browser
open backend/coverage/lcov-report/index.html
```

## Test Configuration Files

### Backend Jest Configurations

1. **`jest.config.js`** - Main configuration for all tests
2. **`jest.unit.config.js`** - Unit tests only (no database)
3. **`jest.integration.config.js`** - Integration tests with database
4. **`jest.e2e.config.js`** - End-to-end tests

### Frontend Vitest Configuration

1. **`vitest.config.ts`** - Main Vitest configuration
2. **`src/test/setup.ts`** - Test environment setup

## Test Writing Guidelines

### Unit Test Structure

```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should do something when condition is met', () => {
      // Arrange
      const input = 'test input';
      
      // Act
      const result = methodName(input);
      
      // Assert
      expect(result).toBe('expected output');
    });
  });
});
```

### Integration Test Structure

```typescript
describe('Integration: FeatureName', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('should complete full workflow', async () => {
    // Setup test data
    const testData = await seedTestData();
    
    // Execute workflow
    const result = await executeWorkflow(testData);
    
    // Verify results
    expect(result.success).toBe(true);
  });
});
```

## Debugging Tests

### Debug Mode

```bash
# Run tests with debug output
DEBUG=1 npm test

# Run specific test with verbose output
cd backend && npm test -- --testPathPattern=specific-test --verbose
```

### Test Database Debugging

```bash
# Connect to test database
psql postgresql://postgres:password@localhost:5432/syntaxis_ai_test

# View test data
cd backend && npx prisma studio --schema=prisma/schema.prisma
```

## Continuous Integration

### GitHub Actions

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Scheduled nightly runs

### Local CI Simulation

```bash
# Run full CI test suite
npm run validate

# This runs:
# - Linting
# - Type checking
# - All tests
# - Coverage validation
```

## Test Performance

### Optimization Tips

1. **Use unit tests** for business logic
2. **Mock external services** in integration tests
3. **Reset database** efficiently between tests
4. **Run tests in parallel** when possible

### Performance Monitoring

```bash
# Run tests with timing information
cd backend && npm test -- --verbose --detectOpenHandles

# Profile test performance
cd backend && npm test -- --logHeapUsage
```

## Troubleshooting

### Common Issues

1. **Database connection errors**:
   ```bash
   # Check PostgreSQL is running
   brew services list | grep postgresql
   
   # Restart PostgreSQL
   brew services restart postgresql@15
   ```

2. **Redis connection errors**:
   ```bash
   # Check Redis is running
   redis-cli ping
   
   # Start Redis
   brew services start redis
   ```

3. **Test timeouts**:
   - Increase timeout in Jest configuration
   - Check for hanging promises
   - Verify database cleanup

4. **Memory leaks**:
   ```bash
   # Detect open handles
   cd backend && npm test -- --detectOpenHandles --forceExit
   ```

### Debug Commands

```bash
# Check test environment
cd backend && npm run test:unit -- --listTests

# Verify test configuration
cd backend && npm test -- --showConfig

# Run single test file
cd backend && npm test -- src/__tests__/specific.test.ts
```

## Test Coverage Goals

### Coverage Targets

- **Unit Tests**: 95%+ coverage
- **Integration Tests**: 80%+ coverage
- **Critical Paths**: 100% coverage

### Coverage Reports

```bash
# Generate detailed coverage
cd backend && npm run test:coverage

# View coverage by file
cd backend && npm test -- --coverage --coverageReporters=text-summary
```

## Best Practices

### Test Organization

1. **Group related tests** in describe blocks
2. **Use descriptive test names** that explain the scenario
3. **Follow AAA pattern** (Arrange, Act, Assert)
4. **Keep tests independent** and isolated

### Mock Strategy

1. **Mock external services** (APIs, file system, etc.)
2. **Use real database** for integration tests
3. **Mock time-dependent functions** for consistency
4. **Avoid mocking business logic**

### Data Management

1. **Reset database** between integration tests
2. **Use factories** for test data creation
3. **Clean up resources** in afterEach/afterAll
4. **Isolate test data** from production

## Maintenance

### Regular Tasks

1. **Update test dependencies** monthly
2. **Review and update** test configurations
3. **Monitor test performance** and optimize slow tests
4. **Maintain test documentation** as features evolve

### Health Checks

```bash
# Verify all test configurations work
npm run setup:test
npm test

# Check for outdated test dependencies
npm outdated
```

## Quick Reference

### Essential Commands

```bash
# Setup and run all tests
npm run setup:test && npm test

# Backend unit tests only
cd backend && npm run test:unit

# Frontend tests with UI
cd frontend && npm run test:ui

# Integration tests
cd backend && npm run test:integration

# Coverage report
cd backend && npm run test:coverage
```

### Test File Locations

- **Backend Unit**: `backend/src/__tests__/unit/`
- **Backend Integration**: `backend/src/__tests__/integration/`
- **Backend Phase 1 Tests**: `backend/src/__tests__/phase1/` (Development Setup)
- **Backend Phase 2 Tests**: `backend/src/__tests__/phase2/` (System Verification & E2E Flows)
- **Frontend Tests**: `frontend/src/__tests__/`
- **Test Utilities**: `backend/src/__tests__/utils/`

This comprehensive test procedures documentation ensures that all team members can effectively run, debug, and maintain the test suite following TDD best practices.
