/**
 * Isolation Tester
 * 
 * TDD Phase: GREEN - Minimal implementation for test isolation
 * Task: 1.1.4 - Test Environment Setup (Priority 1)
 */

import { PrismaClient } from '@prisma/client';

export class IsolationTester {
  constructor(private prismaClient: PrismaClient) {}

  async runIsolatedTest<T>(testName: string, testFn: () => Promise<T>): Promise<T> {
    // Basic isolation - just run the test
    return await testFn();
  }
}

export default IsolationTester;
