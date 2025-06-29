/**
 * Jest Configuration for Integration Tests
 *
 * This configuration runs integration tests that require database
 * and external service connections.
 */

const baseConfig = require('./jest.config.js');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...baseConfig,

  // Display name for this config
  displayName: 'Integration Tests',

  // Only run integration tests
  testMatch: [
    '**/__tests__/integration/**/*.test.ts',
    '**/__tests__/integration/**/*.spec.ts',
  ],

  // Longer timeout for integration tests
  testTimeout: 30000,

  // Setup files for integration tests
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/setup.ts',
    '<rootDir>/src/__tests__/integration-setup.ts',
  ],

  // Enable coverage for integration tests
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
    '!src/__tests__/**',
  ],

  // Coverage thresholds for integration tests
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Run tests in series for integration tests
  maxWorkers: 1,

  // Use test database
  globalSetup: '<rootDir>/src/__tests__/integration/global-setup.ts',
  globalTeardown: '<rootDir>/src/__tests__/integration/global-teardown.ts',

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output for integration tests
  verbose: true,
};