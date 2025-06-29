# Testing Strategy

This project follows a comprehensive testing strategy to ensure code quality and reliability.

## Test Types

1. **Unit Tests** – Validate individual functions and modules in isolation.
2. **Integration Tests** – Verify interactions between multiple modules and services.
3. **End-to-End (E2E) Tests** – Simulate real-world scenarios across the entire application stack.

## Running Tests

```bash
npm test            # Run all tests once
npm run test:watch  # Watch files and re-run tests on change
npm run test:coverage # Run tests with coverage reporting
```

## Writing Tests

Tests live under `src/__tests__` and follow the `*.test.ts` or `*.spec.ts` naming convention.

- Use **Jest** for the test runner and assertions.
- Keep tests deterministic and independent.
- Use mocks for external services (see `src/__tests__/mocks`).

For more information on fixtures, see `testing/fixtures.md`. 