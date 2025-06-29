/**
 * Jest Configuration for Unit Tests Only
 * 
 * This configuration runs unit tests without database setup,
 * perfect for testing our dependency setup utilities.
 */

const baseConfig = require('./jest.config.js');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...baseConfig,
  
  // Override global setup/teardown for unit tests
  globalSetup: undefined,
  globalTeardown: undefined,
  
  // Only run unit tests
  testMatch: [
    '**/__tests__/unit/**/*.test.ts',
    '**/__tests__/utils/**/*.test.ts',
    '**/__tests__/phase1/**/*.test.ts',
    '**/__tests__/phase2/**/*.test.ts'
  ],
  
  // Shorter timeout for unit tests
  testTimeout: 5000,
  
  // Enable coverage for unit tests
  collectCoverage: true,
  collectCoverageFrom: [
    'src/utils/**/*.ts',
    '!src/utils/**/*.d.ts',
    '!src/utils/**/__tests__/**',
  ],
  
  // Coverage thresholds for unit tests
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // Simplified setup for unit tests
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/unit-setup.ts'],
  
  // Display name for this config
  displayName: 'Unit Tests',
};
