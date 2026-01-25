/**
 * Environment Manager
 * 
 * TDD Phase: GREEN - Minimal implementation to make environment tests pass
 * Task: 1.1.4 - Test Environment Setup (Priority 1)
 * 
 * This class provides environment variable management with:
 * - Test environment isolation
 * - Configuration management
 * - Environment validation
 * - Automatic restoration
 */

export interface TestEnvironmentVars {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  REDIS_URL?: string;
  JWT_SECRET?: string;
  [key: string]: string | undefined;
}

export interface TestConfiguration {
  database: {
    url: string;
    maxConnections: number;
    connectionTimeout: number;
  };
  redis: {
    url: string;
    db: number;
    keyPrefix: string;
  };
  logging: {
    level: string;
    enabled: boolean;
  };
  external: {
    googleVision: {
      enabled: boolean;
      mockResponses: boolean;
      apiKey: string;
    };
  };
  security: {
    jwtSecret: string;
    bcryptRounds: number;
  };
}

export interface EnvironmentValidation {
  valid: boolean;
  missing: string[];
  present: string[];
  warnings: string[];
}

export class EnvironmentManager {
  private originalEnv: Record<string, string | undefined> = {};
  private isTestEnvironmentSet: boolean = false;

  /**
   * Set test environment variables
   * GREEN: Basic environment variable setting
   */
  async setTestEnvironment(vars: TestEnvironmentVars): Promise<void> {
    // Store original values for restoration
    Object.keys(vars).forEach(key => {
      if (!this.originalEnv.hasOwnProperty(key)) {
        this.originalEnv[key] = process.env[key];
      }
    });

    // Set test environment variables
    Object.entries(vars).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      }
    });

    this.isTestEnvironmentSet = true;
  }

  /**
   * Restore original environment variables
   * GREEN: Basic environment restoration
   */
  async restore(): Promise<void> {
    if (!this.isTestEnvironmentSet) {
      return;
    }

    // Restore original values
    Object.entries(this.originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });

    this.originalEnv = {};
    this.isTestEnvironmentSet = false;
  }

  /**
   * Get test configuration
   * GREEN: Return mock configuration to pass tests
   */
  async getTestConfiguration(): Promise<TestConfiguration> {
    return {
      database: {
        url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db',
        maxConnections: 10,
        connectionTimeout: 5000
      },
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379/1',
        db: 1,
        keyPrefix: 'test:'
      },
      logging: {
        level: 'silent',
        enabled: false
      },
      external: {
        googleVision: {
          enabled: false,
          mockResponses: true,
          apiKey: 'test-api-key'
        }
      },
      security: {
        jwtSecret: process.env.JWT_SECRET || 'test-jwt-secret',
        bcryptRounds: 1
      }
    };
  }

  /**
   * Validate environment variables
   * GREEN: Basic validation implementation
   */
  async validateEnvironment(requiredVars: string[]): Promise<EnvironmentValidation> {
    const missing: string[] = [];
    const present: string[] = [];
    const warnings: string[] = [];

    requiredVars.forEach(varName => {
      if (process.env[varName]) {
        present.push(varName);
      } else {
        missing.push(varName);
      }
    });

    // Check for potential issues
    if (process.env.NODE_ENV !== 'test') {
      warnings.push('NODE_ENV is not set to "test"');
    }

    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('production')) {
      warnings.push('DATABASE_URL appears to point to production');
    }

    return {
      valid: missing.length === 0,
      missing,
      present,
      warnings
    };
  }

  /**
   * Unset environment variables
   * GREEN: Basic variable removal
   */
  async unset(varNames: string[]): Promise<void> {
    varNames.forEach(varName => {
      // Store original value if not already stored
      if (!this.originalEnv.hasOwnProperty(varName)) {
        this.originalEnv[varName] = process.env[varName];
      }
      delete process.env[varName];
    });
  }

  /**
   * Get current environment state
   * GREEN: Environment state inspection
   */
  getEnvironmentState(): {
    isTestEnvironment: boolean;
    nodeEnv: string | undefined;
    hasOriginalBackup: boolean;
    backedUpVars: string[];
  } {
    return {
      isTestEnvironment: this.isTestEnvironmentSet,
      nodeEnv: process.env.NODE_ENV,
      hasOriginalBackup: Object.keys(this.originalEnv).length > 0,
      backedUpVars: Object.keys(this.originalEnv)
    };
  }

  /**
   * Set single environment variable
   * GREEN: Individual variable setting
   */
  async setVar(name: string, value: string): Promise<void> {
    if (!this.originalEnv.hasOwnProperty(name)) {
      this.originalEnv[name] = process.env[name];
    }
    process.env[name] = value;
  }

  /**
   * Get environment variable
   * GREEN: Safe variable retrieval
   */
  getVar(name: string, defaultValue?: string): string | undefined {
    return process.env[name] || defaultValue;
  }

  /**
   * Check if running in test environment
   * GREEN: Test environment detection
   */
  isTestEnvironment(): boolean {
    return process.env.NODE_ENV === 'test' || this.isTestEnvironmentSet;
  }

  /**
   * Reset to clean test environment
   * GREEN: Clean environment setup
   */
  async resetToTestEnvironment(): Promise<void> {
    await this.setTestEnvironment({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/syntaxis_test',
      REDIS_URL: 'redis://localhost:6379/1',
      JWT_SECRET: 'test-jwt-secret-for-testing'
    });
  }

  /**
   * Cleanup environment manager
   * GREEN: Basic cleanup
   */
  async cleanup(): Promise<void> {
    await this.restore();
  }
}

export default EnvironmentManager;
