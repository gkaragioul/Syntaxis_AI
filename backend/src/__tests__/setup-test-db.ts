/**
 * Test Database Setup Utility
 *
 * Provides utilities for setting up and managing test database
 * connections and data for testing purposes.
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';

let prisma: PrismaClient | null = null;

export interface TestDbConfig {
  url: string;
  name: string;
  resetBetweenTests: boolean;
}

export const defaultTestDbConfig: TestDbConfig = {
  url:
    process.env.DATABASE_URL ||
    'postgresql://postgres:password@localhost:5432/syntaxis_ai_test',
  name: 'syntaxis_ai_test',
  resetBetweenTests: true,
};

/**
 * Get or create test database connection
 */
export const getTestDb = (config: Partial<TestDbConfig> = {}): PrismaClient => {
  if (!prisma) {
    const finalConfig = { ...defaultTestDbConfig, ...config };

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: finalConfig.url,
        },
      },
      log:
        process.env.NODE_ENV === 'test'
          ? []
          : ['query', 'info', 'warn', 'error'],
    });
  }
  return prisma;
};

/**
 * Disconnect from test database
 */
export const disconnectTestDb = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
};

/**
 * Create test database if it doesn't exist
 */
export const createTestDatabase = async (
  dbName: string = 'syntaxis_ai_test',
): Promise<void> => {
  try {
    execSync(`createdb ${dbName}`, { stdio: 'pipe' });
    console.log(`✅ Test database '${dbName}' created`);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log(`ℹ️ Test database '${dbName}' already exists`);
    } else {
      throw new Error(`Failed to create test database: ${error.message}`);
    }
  }
};

/**
 * Drop test database
 */
export const dropTestDatabase = async (
  dbName: string = 'syntaxis_ai_test',
): Promise<void> => {
  try {
    execSync(`dropdb ${dbName}`, { stdio: 'pipe' });
    console.log(`✅ Test database '${dbName}' dropped`);
  } catch (error: any) {
    if (error.message.includes('does not exist')) {
      console.log(`ℹ️ Test database '${dbName}' does not exist`);
    } else {
      throw new Error(`Failed to drop test database: ${error.message}`);
    }
  }
};

/**
 * Run test database migrations
 */
export const migrateTestDatabase = async (): Promise<void> => {
  try {
    const backendDir = path.resolve(__dirname, '../../..');
    execSync('npx prisma migrate deploy', {
      cwd: backendDir,
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'pipe',
    });
    console.log('✅ Test database migrations completed');
  } catch (error: any) {
    throw new Error(`Failed to migrate test database: ${error.message}`);
  }
};

/**
 * Reset test database to clean state
 */
export const resetTestDatabase = async (): Promise<void> => {
  const db = getTestDb();

  try {
    // Clean up test data in reverse order of dependencies
    await db.invoice.deleteMany();
    await db.user.deleteMany();

    console.log('✅ Test database reset completed');
  } catch (error: any) {
    throw new Error(`Failed to reset test database: ${error.message}`);
  }
};

/**
 * Seed test database with basic data
 */
export const seedTestDatabase = async () => {
  const db = getTestDb();

  try {
    // Create test user
    const testUser = await db.user.create({
      data: {
        email: 'test@example.com',
        password:
          '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptpT1/GxseHlChgyu', // 'password'
        firstName: 'Test',
        lastName: 'User',
        isEmailVerified: true,
      },
    });

    // Create admin user
    const adminUser = await db.user.create({
      data: {
        email: 'admin@example.com',
        password:
          '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptpT1/GxseHlChgyu', // 'password'
        firstName: 'Admin',
        lastName: 'User',
        isEmailVerified: true,
      },
    });

    console.log('✅ Test database seeded');

    return {
      testUser,
      adminUser,
    };
  } catch (error: any) {
    throw new Error(`Failed to seed test database: ${error.message}`);
  }
};

/**
 * Setup test database for testing
 */
export const setupTestDatabase = async (): Promise<void> => {
  try {
    await createTestDatabase();
    await migrateTestDatabase();
    console.log('✅ Test database setup completed');
  } catch (error: any) {
    throw new Error(`Failed to setup test database: ${error.message}`);
  }
};

/**
 * Cleanup test database after testing
 */
export const cleanupTestDatabase = async (): Promise<void> => {
  try {
    await disconnectTestDb();
    console.log('✅ Test database cleanup completed');
  } catch (error: any) {
    throw new Error(`Failed to cleanup test database: ${error.message}`);
  }
};

/**
 * Test database transaction wrapper
 */
export const withTestTransaction = async <T>(
  callback: (db: PrismaClient) => Promise<T>,
): Promise<T> => {
  const db = getTestDb();

  return await db.$transaction(async (tx) => {
    return await callback(tx as PrismaClient);
  });
};

/**
 * Create isolated test environment
 */
export const createTestEnvironment = async () => {
  await setupTestDatabase();
  const seedData = await seedTestDatabase();

  return {
    db: getTestDb(),
    seedData,
    cleanup: async () => {
      await resetTestDatabase();
      await disconnectTestDb();
    },
  };
};

// Export for use in global setup/teardown
export { prisma as testDbConnection };
