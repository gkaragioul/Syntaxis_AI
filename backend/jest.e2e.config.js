const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  testMatch: [
    '**/__tests__/e2e/**/*.test.ts',
    '**/__tests__/e2e/**/*.spec.ts',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/setup.ts',
    '<rootDir>/src/__tests__/e2e/setup.ts',
  ],
  testTimeout: 120000, // Even longer timeout for E2E tests
  globalSetup: '<rootDir>/src/__tests__/e2e/globalSetup.ts',
  globalTeardown: '<rootDir>/src/__tests__/e2e/globalTeardown.ts',
  // Disable coverage for E2E tests
  collectCoverage: false,
  // Run tests in series
  maxWorkers: 1,
  // Use a separate test environment
  testEnvironment: 'node',
  globals: {
    ...baseConfig.globals,
    'ts-jest': {
      ...baseConfig.globals['ts-jest'],
      isolatedModules: true,
    },
  },
  // Environment variables for E2E tests
  setupFiles: ['<rootDir>/src/__tests__/e2e/env.ts'],
}; 