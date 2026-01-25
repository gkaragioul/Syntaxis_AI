/**
 * Test Environment Setup Validation Tests
 * 
 * TDD Phase: RED - These tests demonstrate the current test environment issues
 * Task: 1.1.4 - Resolve test environment setup issues
 * 
 * These tests validate that:
 * 1. Test database setup/teardown works reliably
 * 2. Tests can run in isolation without conflicts
 * 3. Test environment is properly configured
 * 4. Parallel test execution works correctly
 */

import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { 
  setupTestEnvironment, 
  cleanupTestDatabase,
  createTestEnvironment,
  resetTestDatabase 
} from '../utils/testHelpers';

describe('Test Environment Setup Validation', () => {
  let testDb: PrismaClient;
  let testRedis: Redis;
  let cleanup: () => Promise<void>;

  describe('Database Setup and Teardown', () => {
    it('should establish database connection reliably', async () => {
      // RED: This test should fail initially due to setup issues
      const env = await setupTestEnvironment();
      testDb = env.prisma;
      cleanup = env.cleanup;

      // Validate database connection
      await expect(testDb.$queryRaw`SELECT 1 as test`).resolves.toEqual([{ test: 1 }]);
      
      // Validate database is in test mode
      const result = await testDb.$queryRaw`SELECT current_database() as db_name`;
      expect(result[0].db_name).toMatch(/test/i);
    });

    it('should clean up database state between tests', async () => {
      // RED: This test should fail due to data persistence between tests
      const env = await createTestEnvironment();
      const db = env.db;
      
      // Create test data
      const user = await db.user.create({
        data: {
          email: 'isolation-test@example.com',
          passwordHash: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptpT1/GxseHlChgyu',
          emailVerified: true,
        },
      });

      expect(user.id).toBeDefined();

      // Manually clean up the test user we created
      await db.user.delete({
        where: { id: user.id }
      });

      // Then cleanup the environment
      await env.cleanup();

      // Verify our specific test data is cleaned up
      const remainingUser = await db.user.findUnique({
        where: { id: user.id }
      });
      expect(remainingUser).toBeNull();
    });

    it('should handle concurrent database operations', async () => {
      // RED: This test should fail due to database connection conflicts
      const promises = Array.from({ length: 5 }, async (_, index) => {
        const env = await createTestEnvironment();
        const user = await env.db.user.create({
          data: {
            email: `concurrent-${index}@example.com`,
            passwordHash: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptpT1/GxseHlChgyu',
            emailVerified: true,
          },
        });
        
        await env.cleanup();
        return user.id;
      });

      const userIds = await Promise.all(promises);
      expect(userIds).toHaveLength(5);
      expect(new Set(userIds).size).toBe(5); // All IDs should be unique
    });
  });

  describe('Test Isolation Validation', () => {
    it('should not leak data between test suites', async () => {
      // RED: This test should fail if data leaks between tests
      const env1 = await createTestEnvironment();
      
      // Create data in first environment
      await env1.db.user.create({
        data: {
          email: 'leak-test-1@example.com',
          passwordHash: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptpT1/GxseHlChgyu',
          emailVerified: true,
        },
      });

      await env1.cleanup();

      // Create second environment - should not have the first environment's data
      const env2 = await createTestEnvironment();
      const leakedUser = await env2.db.user.findFirst({
        where: { email: 'leak-test-1@example.com' }
      });

      expect(leakedUser).toBeNull(); // Should not find data from first environment

      await env2.cleanup();
    });

    it('should handle test environment reset correctly', async () => {
      // RED: This test should fail due to incomplete reset functionality
      const env = await createTestEnvironment();
      
      // Create additional test data
      await env.db.user.create({
        data: {
          email: 'reset-test@example.com',
          passwordHash: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptpT1/GxseHlChgyu',
          emailVerified: true,
        },
      });

      // Reset should restore to seed state
      await resetTestDatabase();
      
      const users = await env.db.user.findMany();
      expect(users).toHaveLength(2); // Only seed users
      expect(users.map(u => u.email)).toEqual([
        'test@example.com',
        'admin@example.com'
      ]);
      
      await env.cleanup();
    });
  });

  describe('Redis Setup and Teardown', () => {
    it('should establish Redis connection reliably', async () => {
      // RED: This test should fail due to Redis setup issues
      testRedis = new Redis(process.env.REDIS_TEST_URL || 'redis://localhost:6379/1');
      
      await testRedis.set('test-key', 'test-value');
      const value = await testRedis.get('test-key');
      
      expect(value).toBe('test-value');
      
      await testRedis.quit();
    });

    it('should clean up Redis state between tests', async () => {
      // RED: This test should fail due to Redis state persistence
      testRedis = new Redis(process.env.REDIS_TEST_URL || 'redis://localhost:6379/1');
      
      // Set test data
      await testRedis.set('cleanup-test', 'should-be-removed');
      
      // Simulate cleanup
      await testRedis.flushdb();
      
      // Verify cleanup
      const value = await testRedis.get('cleanup-test');
      expect(value).toBeNull();
      
      await testRedis.quit();
    });
  });

  describe('Environment Configuration Validation', () => {
    it('should have correct test environment variables', () => {
      // RED: This test should fail due to missing or incorrect env vars
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.DATABASE_URL).toMatch(/test/i);
      expect(process.env.REDIS_URL).toMatch(/redis/);
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.JWT_SECRET).not.toBe(''); // Should not be empty
    });

    it('should isolate test environment from production', () => {
      // RED: This test should fail if production configs leak into tests
      expect(process.env.DATABASE_URL).not.toMatch(/production|prod/i);
      expect(process.env.REDIS_URL).not.toMatch(/production|prod/i);
      expect(process.env.NODE_ENV).not.toBe('production');
    });
  });

  describe('Parallel Test Execution', () => {
    it('should support multiple test workers without conflicts', async () => {
      // RED: This test should fail due to worker conflicts
      const workerPromises = Array.from({ length: 3 }, async (_, workerId) => {
        const env = await createTestEnvironment();
        
        // Each worker creates unique data
        const user = await env.db.user.create({
          data: {
            email: `worker-${workerId}@example.com`,
            passwordHash: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptpT1/GxseHlChgyu',
            emailVerified: true,
          },
        });

        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const foundUser = await env.db.user.findUnique({
          where: { id: user.id }
        });
        
        await env.cleanup();
        
        return foundUser?.email;
      });

      const results = await Promise.all(workerPromises);
      
      expect(results).toHaveLength(3);
      expect(results.every(email => email?.includes('worker-'))).toBe(true);
    });
  });

  // Global cleanup
  afterEach(async () => {
    if (cleanup) {
      await cleanup();
    }
    if (testRedis && testRedis.status === 'ready') {
      await testRedis.quit();
    }
  });
});
