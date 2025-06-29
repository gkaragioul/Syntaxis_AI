/**
 * Global Setup for Integration Tests
 *
 * This file runs once before all integration tests to set up
 * the test environment, database, and external services.
 */

import { setupTestDatabase, createTestDatabase } from '../setup-test-db';

export default async function globalSetup() {
  console.log('🚀 Starting global integration test setup...');

  try {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://postgres:password@localhost:5432/syntaxis_ai_test';
    process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';
    process.env.REDIS_URL = 'redis://localhost:6379/1';
    process.env.LOG_LEVEL = 'error';
    process.env.DISABLE_RATE_LIMITING = 'true';

    // Create and setup test database
    await createTestDatabase('syntaxis_ai_test');
    await setupTestDatabase();

    console.log('✅ Global integration test setup completed');
  } catch (error) {
    console.error('❌ Global integration test setup failed:', error);
    throw error;
  }
}
