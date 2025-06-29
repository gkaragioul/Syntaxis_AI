/**
 * Global Teardown for Integration Tests
 *
 * This file runs once after all integration tests to clean up
 * the test environment, database, and external services.
 */

import { cleanupTestDatabase, dropTestDatabase } from '../setup-test-db';

export default async function globalTeardown() {
  console.log('🧹 Starting global integration test teardown...');

  try {
    // Cleanup test database connections
    await cleanupTestDatabase();

    // Optionally drop test database (uncomment if needed)
    // await dropTestDatabase('syntaxis_ai_test');

    console.log('✅ Global integration test teardown completed');
  } catch (error) {
    console.error('❌ Global integration test teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}
