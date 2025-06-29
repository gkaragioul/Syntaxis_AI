process.env.NODE_ENV = 'test';

// Ensure a test database URL is set for the test environment
if (!process.env.DATABASE_TEST_URL) {
  process.env.DATABASE_TEST_URL =
    'postgresql://postgres:postgres@localhost:5432/syntaxis_test';
}
if (!process.env.REDIS_TEST_URL) {
  process.env.REDIS_TEST_URL = 'redis://localhost:6379/1';
}

import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { config } from '../config';

let testPrisma: PrismaClient;
let testRedis: Redis;

async function setup() {
  // Initialize test database client
  testPrisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_TEST_URL,
      },
    },
  });

  // Initialize test Redis client
  testRedis = new Redis(process.env.REDIS_TEST_URL);

  // Run database migrations
  await testPrisma.$executeRaw`DROP SCHEMA IF EXISTS public CASCADE`;
  await testPrisma.$executeRaw`CREATE SCHEMA public`;
  await testPrisma.$executeRaw`GRANT ALL ON SCHEMA public TO postgres`;
  await testPrisma.$executeRaw`GRANT ALL ON SCHEMA public TO public`;

  // Run migrations on test database
  const { execSync } = require('child_process');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_TEST_URL
    }
  });

  // Clean up function
  global.testCleanup = async () => {
    await testPrisma.$disconnect();
    await testRedis.quit();
  };

  // Make test utilities available globally
  global.testPrisma = testPrisma;
  global.testRedis = testRedis;
}

async function teardown() {
  if (global.testCleanup) {
    await global.testCleanup();
  }
}

export default async function globalSetup() {
  await setup();
  return teardown;
}
