/**
 * Jest Configuration for SyntaxisAI Backend
 * 
 * This configuration enables TypeScript support, proper module resolution,
 * and comprehensive testing setup for the AI-developed codebase.
 */

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  
  // Test environment
  testEnvironment: 'node',
  
  // Root directory for tests
  roots: ['<rootDir>/src'],
  
  // Test file patterns
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  
  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
    }],
  },
  
  // Module name mapping for path aliases and mocks
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    'pdfjs-dist': '<rootDir>/src/__tests__/__mocks__/pdfjs-dist.js',
    'pdf-lib': '<rootDir>/src/__tests__/__mocks__/pdf-lib.js',
    'sharp': '<rootDir>/src/__tests__/__mocks__/sharp.js',
    '@prisma/client': '<rootDir>/src/__tests__/__mocks__/prisma.ts',
  },
  
  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  
  // Coverage configuration - disabled by default
  collectCoverage: false,

  // Collect coverage from these files
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
  ],
  
  // Coverage thresholds (AI development standard: 95%+)
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  
  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Coverage directory
  coverageDirectory: 'coverage',
  
  // Less verbose output for better performance
  verbose: false,
  
  // Test timeout (10 seconds for most tests)
  testTimeout: 10000,

  // Force exit after tests complete to prevent hanging
  forceExit: true,

  // Detect open handles that might prevent Jest from exiting
  detectOpenHandles: true,

  // Run tests in parallel with max workers (reduced for CI stability)
  maxWorkers: process.env.CI ? 2 : '50%',
  
  // Global setup and teardown
  globalSetup: '<rootDir>/src/__tests__/global-setup.ts',
  globalTeardown: '<rootDir>/src/__tests__/global-teardown.ts',
  
  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/src/__tests__/auth/',
    '/src/__tests__/e2e/',
    '/src/__tests__/workers/',
    // These suites shell out to `npm test` / `npm run test:coverage` (and
    // `npm run format`, which rewrites sources). Run inside the normal suite
    // they start the suite again, recursively, until the machine runs out of
    // processes and memory. Keep them out of every default run.
    '/src/__tests__/infrastructure/coverage-validation.test.ts',
    '/src/__tests__/phase1/code-quality.test.ts',
    '/src/__tests__/phase1/scripts.test.ts',
    '/src/__tests__/phase1/testing-suite.test.ts',
  ],
  
  // Coverage path ignore patterns
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/dist/',
  ],
  
  // Remove deprecated globals configuration
  // TypeScript configuration is now handled in transform options above
};
