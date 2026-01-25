// @ts-nocheck
/**
 * Test Database Utilities
 *
 * Provides utilities for managing test database connections,
 * data seeding, and cleanup for testing purposes.
 */

import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

/**
 * Get or create test database connection
 */
export const getTestDb = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url:
            process.env.DATABASE_URL ||
            'postgresql://postgres:password@localhost:5432/syntaxis_ai_test',
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
  await resetTestDatabase();
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
