import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const setupTestDatabase = async (): Promise<void> => {
  await prisma.$connect();
};

export const cleanupTestDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
};

export default {
  setupTestDatabase,
  cleanupTestDatabase,
};
