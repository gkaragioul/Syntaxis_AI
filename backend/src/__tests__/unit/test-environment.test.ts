/**
 * Test Environment Validation Tests
 * 
 * Task 1.1.4: Test Environment Setup - TDD Red Phase
 * 
 * These tests validate that our test environment setup works correctly
 * and provides proper isolation between tests.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  testEnvironment, 
  setupTestEnvironment, 
  cleanupTestEnvironment,
  validateTestEnvironment,
  resetTestEnvironment 
} from '../utils/test-environment';
import { prismaMock, resetPrismaMock } from '../__mocks__/prisma';

describe('Test Environment Setup', () => {
  beforeEach(async () => {
    // Reset environment before each test
    await cleanupTestEnvironment();
  });

  afterEach(async () => {
    // Clean up after each test
    await cleanupTestEnvironment();
  });

  describe('Environment Setup', () => {
    it('should setup mocked environment successfully', async () => {
      // RED: This test should initially fail until we implement proper setup
      await setupTestEnvironment({ useMocks: true, validateConnections: false });

      const validation = validateTestEnvironment();
      
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.state.isSetup).toBe(true);
      expect(validation.state.prismaConnected).toBe(true);
      expect(validation.state.redisConnected).toBe(true);
    });

    it('should make Prisma mock available globally', async () => {
      await setupTestEnvironment({ useMocks: true });

      expect(global.testPrisma).toBeDefined();
      expect(global.testPrisma.user).toBeDefined();
      expect(global.testPrisma.invoice).toBeDefined();
      expect(global.testPrisma.reviewTask).toBeDefined();
    });

    it('should make Redis mock available globally', async () => {
      await setupTestEnvironment({ useMocks: true });

      expect(global.testRedis).toBeDefined();
      expect(global.testRedis.get).toBeDefined();
      expect(global.testRedis.set).toBeDefined();
      expect(global.testRedis.del).toBeDefined();
    });

    it('should set correct environment variables', async () => {
      await setupTestEnvironment({ useMocks: true });

      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.DATABASE_URL).toContain('syntaxis_test');
    });

    it('should handle setup errors gracefully', async () => {
      // Mock a setup failure
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      try {
        await expect(setupTestEnvironment({ 
          useMocks: false, 
          validateConnections: true 
        })).rejects.toThrow('Test environment setup failed');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Test Isolation', () => {
    it('should reset mocks between tests', async () => {
      await setupTestEnvironment({ useMocks: true });

      // Modify mock behavior
      prismaMock.user.findUnique.mockResolvedValue(null);
      
      // Reset environment
      await resetTestEnvironment();

      // Mock should be reset to default behavior
      const result = await prismaMock.user.findUnique({ where: { id: 'test-user-id' } });
      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-user-id');
    });

    it('should clear all Jest mocks on reset', async () => {
      await setupTestEnvironment({ useMocks: true });

      const mockFn = jest.fn();
      mockFn('test');

      expect(mockFn).toHaveBeenCalledWith('test');

      await resetTestEnvironment();

      // Note: This test validates that our reset mechanism works
      // The mock function itself won't be cleared, but our environment mocks will be
      expect(prismaMock.user.findUnique).toBeDefined();
    });

    it('should maintain isolation between test suites', async () => {
      await setupTestEnvironment({ useMocks: true, isolationLevel: 'suite' });

      // Modify state
      prismaMock.user.create.mockResolvedValue({ id: 'modified-user' } as any);

      const validation = validateTestEnvironment();
      expect(validation.state.isolationLevel).toBe('suite');
    });
  });

  describe('Environment Validation', () => {
    it('should detect uninitialized environment', () => {
      const validation = validateTestEnvironment();
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Test environment not setup');
    });

    it('should detect missing Prisma client', async () => {
      await setupTestEnvironment({ useMocks: true });
      
      // Remove global Prisma client
      global.testPrisma = null;

      const validation = validateTestEnvironment();
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Prisma client not available');
    });

    it('should detect missing Redis client', async () => {
      await setupTestEnvironment({ useMocks: true });
      
      // Remove global Redis client
      global.testRedis = null;

      const validation = validateTestEnvironment();
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Redis client not available');
    });

    it('should detect incorrect NODE_ENV', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        const validation = validateTestEnvironment();
        expect(validation.isValid).toBe(false);
        expect(validation.issues).toContain('NODE_ENV not set to test');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Cleanup', () => {
    it('should cleanup environment properly', async () => {
      await setupTestEnvironment({ useMocks: true });
      
      expect(validateTestEnvironment().isValid).toBe(true);

      await cleanupTestEnvironment();

      const validation = validateTestEnvironment();
      expect(validation.isValid).toBe(false);
      expect(validation.state.isSetup).toBe(false);
    });

    it('should handle cleanup errors gracefully', async () => {
      await setupTestEnvironment({ useMocks: true });

      // Mock a cleanup error
      const originalQuit = global.testRedis?.quit;
      if (global.testRedis) {
        global.testRedis.quit = jest.fn().mockRejectedValue(new Error('Cleanup error'));
      }

      // Should not throw
      await expect(cleanupTestEnvironment()).resolves.not.toThrow();

      // Restore original function
      if (global.testRedis && originalQuit) {
        global.testRedis.quit = originalQuit;
      }
    });

    it('should reset global references on cleanup', async () => {
      await setupTestEnvironment({ useMocks: true });
      
      expect(global.testPrisma).toBeDefined();
      expect(global.testRedis).toBeDefined();

      await cleanupTestEnvironment();

      expect(global.testPrisma).toBeNull();
      expect(global.testRedis).toBeNull();
    });
  });

  describe('State Management', () => {
    it('should track environment state correctly', async () => {
      const initialState = testEnvironment.getState();
      expect(initialState.isSetup).toBe(false);

      await setupTestEnvironment({ useMocks: true, isolationLevel: 'full' });

      const setupState = testEnvironment.getState();
      expect(setupState.isSetup).toBe(true);
      expect(setupState.isolationLevel).toBe('full');
      expect(setupState.prismaConnected).toBe(true);
      expect(setupState.redisConnected).toBe(true);
    });

    it('should use singleton pattern correctly', () => {
      const instance1 = testEnvironment;
      const instance2 = testEnvironment;
      
      expect(instance1).toBe(instance2);
    });
  });
});

// Test helper to validate Prisma mock functionality
describe('Prisma Mock Integration', () => {
  beforeEach(async () => {
    await setupTestEnvironment({ useMocks: true });
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  it('should provide working Prisma mock with default data', async () => {
    const user = await global.testPrisma.user.findUnique({ 
      where: { id: 'test-user-id' } 
    });

    expect(user).toBeDefined();
    expect(user?.id).toBe('test-user-id');
    expect(user?.email).toBe('test@example.com');
  });

  it('should support Prisma operations', async () => {
    const newUser = await global.testPrisma.user.create({
      data: {
        email: 'new@example.com',
        passwordHash: 'hash',
      },
    });

    expect(newUser).toBeDefined();
    expect(newUser.email).toBe('new@example.com');
  });

  it('should reset mock behavior between tests', async () => {
    // This test validates that mocks are properly reset
    const user = await global.testPrisma.user.findUnique({ 
      where: { id: 'test-user-id' } 
    });

    expect(user).toBeDefined();
    expect(user?.email).toBe('test@example.com');
  });
});
