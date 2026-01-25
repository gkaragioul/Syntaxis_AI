// @ts-nocheck
/**
 * Test Data Factory
 * 
 * TDD Phase: GREEN - Minimal implementation to make data factory tests pass
 * Task: 1.1.4 - Test Environment Setup (Priority 1)
 * 
 * This class provides type-safe test data creation with:
 * - Factory pattern for different data types
 * - Sequence generation for unique values
 * - Batch creation utilities
 * - Cleanup tracking
 */

import { PrismaClient } from '@prisma/client';

export interface FactoryOptions {
  [key: string]: any;
}

export interface Factory<T> {
  create(overrides?: Partial<T>): Promise<T>;
  createMany(count: number, overrides?: Partial<T>): Promise<T[]>;
  sequence(field: string): string;
}

export class TestDataFactory {
  private prismaClient: PrismaClient;
  private createdRecords: Record<string, string[]> = {};
  private sequences: Record<string, number> = {};

  constructor(prismaClient: PrismaClient) {
    this.prismaClient = prismaClient;
  }

  /**
   * Get factory for specific model type
   * GREEN: Basic factory implementation
   */
  getFactory<T>(modelName: string): Factory<T> {
    switch (modelName) {
      case 'user':
        return this.createUserFactory() as Factory<T>;
      default:
        throw new Error(`Factory for model '${modelName}' not implemented`);
    }
  }

  /**
   * Create user factory
   * GREEN: Minimal user factory implementation
   */
  private createUserFactory(): Factory<any> {
    return {
      create: async (overrides = {}) => {
        const userData = {
          email: overrides.email || this.sequence('email'),
          passwordHash: overrides.passwordHash || '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptpT1/GxseHlChgyu',
          emailVerified: overrides.emailVerified !== undefined ? overrides.emailVerified : true,
          ...overrides
        };

        const user = await this.prismaClient.user.create({
          data: userData
        });

        // Track created record
        this.trackRecord('user', user.id);

        return user;
      },

      createMany: async (count: number, overrides = {}) => {
        const users = [];
        for (let i = 0; i < count; i++) {
          const user = await this.createUserFactory().create({
            email: this.sequence('email'),
            ...overrides
          });
          users.push(user);
        }
        return users;
      },

      sequence: (field: string) => this.sequence(field)
    };
  }

  /**
   * Generate sequence value
   * GREEN: Basic sequence implementation
   */
  sequence(field: string): string {
    if (!this.sequences[field]) {
      this.sequences[field] = 0;
    }
    this.sequences[field]++;

    switch (field) {
      case 'email':
        return `user${this.sequences[field]}@example.com`;
      default:
        return `${field}${this.sequences[field]}`;
    }
  }

  /**
   * Track created record for cleanup
   * GREEN: Basic tracking implementation
   */
  private trackRecord(modelName: string, id: string): void {
    if (!this.createdRecords[modelName]) {
      this.createdRecords[modelName] = [];
    }
    this.createdRecords[modelName].push(id);
  }

  /**
   * Get created records
   * GREEN: Simple getter for tracking
   */
  getCreatedRecords(): Record<string, string[]> {
    return { ...this.createdRecords };
  }

  /**
   * Reset tracking
   * GREEN: Clear tracking without cleanup
   */
  resetTracking(): void {
    this.createdRecords = {};
    this.sequences = {};
  }

  /**
   * Cleanup all created records
   * GREEN: Basic cleanup implementation
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up in reverse dependency order
      if (this.createdRecords.user) {
        await this.prismaClient.user.deleteMany({
          where: {
            id: {
              in: this.createdRecords.user
            }
          }
        });
      }

      // Reset tracking
      this.resetTracking();
    } catch (error) {
      console.warn('Test data factory cleanup warning:', error.message);
    }
  }
}

export default TestDataFactory;
