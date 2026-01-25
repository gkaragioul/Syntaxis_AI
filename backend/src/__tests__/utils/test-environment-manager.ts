// @ts-nocheck
/**
 * Test Environment Manager
 * 
 * TDD Phase: GREEN - Minimal implementation to make tests pass
 * Task: 1.1.4 - Test Environment Setup (Priority 1)
 * 
 * This is the main orchestrator for test environment setup with extreme modularity.
 * It coordinates all the specialized managers to provide a cohesive test environment.
 */

import { PrismaClient } from '@prisma/client';
import { DatabaseManager } from './database-manager';
import { TestDataFactory } from './test-data-factory';
import { MockManager } from './mock-manager';
import { EnvironmentManager } from './environment-manager';
import { IsolationTester } from './isolation-tester';
import { PerformanceHelpers } from './performance-helpers';
import { AsyncHelpers } from './async-helpers';
import { FailureHandler } from './failure-handler';

export interface TestEnvironmentConfig {
  isolationLevel?: 'none' | 'test' | 'suite' | 'full';
  useMocks?: boolean;
  validateConnections?: boolean;
  databaseName?: string;
  redisDb?: number;
}

export class TestEnvironment {
  private static instance: TestEnvironment | null = null;
  private isSetup: boolean = false;
  private config: TestEnvironmentConfig = {};
  
  // Modular managers
  private databaseManager: DatabaseManager | null = null;
  private dataFactory: TestDataFactory | null = null;
  private mockManager: MockManager | null = null;
  private environmentManager: EnvironmentManager | null = null;
  private isolationTester: IsolationTester | null = null;
  private performanceHelpers: PerformanceHelpers | null = null;
  private asyncHelpers: AsyncHelpers | null = null;
  private failureHandler: FailureHandler | null = null;
  
  private prismaClient: PrismaClient | null = null;
  private cleanupTasks: Array<() => Promise<void>> = [];

  constructor() {
    // Singleton pattern for test environment
    if (TestEnvironment.instance) {
      return TestEnvironment.instance;
    }
    TestEnvironment.instance = this;
  }

  /**
   * Setup test environment with modular components
   * GREEN: Minimal implementation to pass tests
   */
  async setup(config: TestEnvironmentConfig = {}): Promise<void> {
    if (this.isSetup) {
      return;
    }

    this.config = {
      isolationLevel: 'test',
      useMocks: false,
      validateConnections: true,
      databaseName: `test_syntaxis_ocr_${Date.now()}`,
      redisDb: 1,
      ...config
    };

    try {
      // Initialize environment manager first
      this.environmentManager = new EnvironmentManager();
      await this.environmentManager.setTestEnvironment({
        NODE_ENV: 'test',
        DATABASE_URL: process.env.DATABASE_TEST_URL || 'postgresql://postgres:postgres@localhost:5432/syntaxis_test',
        REDIS_URL: process.env.REDIS_TEST_URL || 'redis://localhost:6379/1',
        JWT_SECRET: 'test-jwt-secret-for-testing'
      });

      // Initialize database manager
      this.databaseManager = new DatabaseManager(this.config);
      await this.databaseManager.initialize();

      // Get Prisma client from database manager
      this.prismaClient = this.databaseManager.getPrismaClient();

      // Initialize other managers
      this.dataFactory = new TestDataFactory(this.prismaClient);
      this.mockManager = new MockManager();
      this.isolationTester = new IsolationTester(this.prismaClient);
      this.performanceHelpers = new PerformanceHelpers();
      this.asyncHelpers = new AsyncHelpers();
      this.failureHandler = new FailureHandler(this.databaseManager);

      // Setup cleanup tasks
      this.setupCleanupTasks();

      this.isSetup = true;

    } catch (error) {
      throw new Error(`Test environment setup failed: ${error.message}`);
    }
  }

  /**
   * Teardown test environment
   * GREEN: Minimal cleanup implementation
   */
  async teardown(): Promise<void> {
    if (!this.isSetup) {
      return;
    }

    try {
      // Execute all cleanup tasks
      await Promise.all(
        this.cleanupTasks.map(task => 
          task().catch(error => console.warn('Cleanup task failed:', error))
        )
      );

      // Cleanup managers
      if (this.databaseManager) {
        await this.databaseManager.cleanup();
      }

      if (this.dataFactory) {
        await this.dataFactory.cleanup();
      }

      if (this.mockManager) {
        this.mockManager.clearAll();
      }

      if (this.environmentManager) {
        await this.environmentManager.restore();
      }

      // Reset state
      this.isSetup = false;
      this.cleanupTasks = [];
      
      // Clear singleton instance
      TestEnvironment.instance = null;

    } catch (error) {
      console.warn('Test environment teardown failed:', error);
    }
  }

  /**
   * Get database manager
   * GREEN: Simple getter implementation
   */
  getDatabaseManager(): DatabaseManager {
    if (!this.databaseManager) {
      throw new Error('Test environment not setup. Call setup() first.');
    }
    return this.databaseManager;
  }

  /**
   * Get data factory
   * GREEN: Simple getter implementation
   */
  getDataFactory(): TestDataFactory {
    if (!this.dataFactory) {
      throw new Error('Test environment not setup. Call setup() first.');
    }
    return this.dataFactory;
  }

  /**
   * Get mock manager
   * GREEN: Simple getter implementation
   */
  getMockManager(): MockManager {
    if (!this.mockManager) {
      throw new Error('Test environment not setup. Call setup() first.');
    }
    return this.mockManager;
  }

  /**
   * Get environment manager
   * GREEN: Simple getter implementation
   */
  getEnvironmentManager(): EnvironmentManager {
    if (!this.environmentManager) {
      throw new Error('Test environment not setup. Call setup() first.');
    }
    return this.environmentManager;
  }

  /**
   * Get isolation tester
   * GREEN: Simple getter implementation
   */
  getIsolationTester(): IsolationTester {
    if (!this.isolationTester) {
      throw new Error('Test environment not setup. Call setup() first.');
    }
    return this.isolationTester;
  }

  /**
   * Get performance helpers
   * GREEN: Simple getter implementation
   */
  getPerformanceHelpers(): PerformanceHelpers {
    if (!this.performanceHelpers) {
      throw new Error('Test environment not setup. Call setup() first.');
    }
    return this.performanceHelpers;
  }

  /**
   * Get async helpers
   * GREEN: Simple getter implementation
   */
  getAsyncHelpers(): AsyncHelpers {
    if (!this.asyncHelpers) {
      throw new Error('Test environment not setup. Call setup() first.');
    }
    return this.asyncHelpers;
  }

  /**
   * Get failure handler
   * GREEN: Simple getter implementation
   */
  getFailureHandler(): FailureHandler {
    if (!this.failureHandler) {
      throw new Error('Test environment not setup. Call setup() first.');
    }
    return this.failureHandler;
  }

  /**
   * Get Prisma client
   * GREEN: Simple getter implementation
   */
  getPrismaClient(): PrismaClient {
    if (!this.prismaClient) {
      throw new Error('Test environment not setup. Call setup() first.');
    }
    return this.prismaClient;
  }

  /**
   * Check if environment is setup
   * GREEN: Simple status check
   */
  isEnvironmentSetup(): boolean {
    return this.isSetup;
  }

  /**
   * Get current configuration
   * GREEN: Simple config getter
   */
  getConfig(): TestEnvironmentConfig {
    return { ...this.config };
  }

  /**
   * Setup cleanup tasks
   * GREEN: Basic cleanup task registration
   */
  private setupCleanupTasks(): void {
    // Register cleanup for database connections
    this.cleanupTasks.push(async () => {
      if (this.prismaClient) {
        await this.prismaClient.$disconnect();
      }
    });

    // Register cleanup for temporary files/resources
    this.cleanupTasks.push(async () => {
      // Cleanup any temporary test files or resources
      console.log('Cleaning up temporary test resources...');
    });

    // Setup process cleanup handlers
    const cleanup = () => {
      this.teardown().catch(console.error);
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', cleanup);
  }

  /**
   * Add custom cleanup task
   * GREEN: Allow registration of custom cleanup tasks
   */
  addCleanupTask(task: () => Promise<void>): void {
    this.cleanupTasks.push(task);
  }

  /**
   * Reset environment for next test
   * GREEN: Basic reset functionality
   */
  async resetForTest(): Promise<void> {
    if (!this.isSetup) {
      return;
    }

    // Reset database state
    if (this.databaseManager) {
      await this.databaseManager.resetDatabase();
    }

    // Clear mocks
    if (this.mockManager) {
      this.mockManager.clearAll();
    }

    // Reset data factory tracking
    if (this.dataFactory) {
      this.dataFactory.resetTracking();
    }
  }

  /**
   * Validate environment health
   * GREEN: Basic health check
   */
  async validateHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    components: Record<string, boolean>;
  }> {
    const issues: string[] = [];
    const components: Record<string, boolean> = {};

    // Check if setup
    if (!this.isSetup) {
      issues.push('Test environment not setup');
      return { healthy: false, issues, components };
    }

    // Check database manager
    try {
      if (this.databaseManager) {
        const dbInfo = await this.databaseManager.getDatabaseInfo();
        components.database = dbInfo.connected;
        if (!dbInfo.connected) {
          issues.push('Database not connected');
        }
      } else {
        components.database = false;
        issues.push('Database manager not initialized');
      }
    } catch (error) {
      components.database = false;
      issues.push(`Database health check failed: ${error.message}`);
    }

    // Check other components
    components.dataFactory = !!this.dataFactory;
    components.mockManager = !!this.mockManager;
    components.environmentManager = !!this.environmentManager;

    if (!components.dataFactory) issues.push('Data factory not initialized');
    if (!components.mockManager) issues.push('Mock manager not initialized');
    if (!components.environmentManager) issues.push('Environment manager not initialized');

    return {
      healthy: issues.length === 0,
      issues,
      components
    };
  }
}

// Export singleton instance
export const testEnvironment = new TestEnvironment();

// Export utility functions for backward compatibility
export const setupTestEnvironment = async (config?: TestEnvironmentConfig) => {
  await testEnvironment.setup(config);
  return {
    prisma: testEnvironment.getPrismaClient(),
    cleanup: () => testEnvironment.teardown(),
  };
};

export const cleanupTestEnvironment = () => testEnvironment.teardown();
export const resetTestEnvironment = () => testEnvironment.resetForTest();
export const validateTestEnvironment = () => testEnvironment.validateHealth();

export default TestEnvironment;
