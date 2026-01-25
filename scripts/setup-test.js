#!/usr/bin/env node

/**
 * Test Environment Setup Script
 * Implements Task 1.3.2 from scratchpad with TDD best practices
 * 
 * Usage:
 *   npm run setup:test
 *   node scripts/setup-test.js
 *   node scripts/setup-test.js --workspace=backend
 *   node scripts/setup-test.js --workspace=frontend
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  console.log('\n' + '='.repeat(60));
  console.log(colorize(title, 'cyan'));
  console.log('='.repeat(60));
}

function printResult(result) {
  if (result.success) {
    console.log(colorize('✅ ' + result.message, 'green'));
    if (result.details) {
      result.details.forEach((detail) => {
        console.log(colorize('   • ' + detail, 'blue'));
      });
    }
  } else {
    console.log(colorize('❌ ' + result.message, 'red'));
    if (result.errors) {
      result.errors.forEach((error) => {
        console.log(colorize('   • ' + error, 'red'));
      });
    }
  }
}

class TestEnvironmentSetup {
  constructor(rootDir) {
    this.rootDir = rootDir || path.resolve(__dirname, '..');
    this.backendDir = path.join(this.rootDir, 'backend');
    this.frontendDir = path.join(this.rootDir, 'frontend');
  }

  async setupTestDatabase() {
    try {
      const results = [];
      const errors = [];

      // Create test environment file
      const testEnvPath = path.join(this.backendDir, '.env.test');
      if (!fs.existsSync(testEnvPath)) {
        const testEnvContent = `# Test Environment Configuration
NODE_ENV=test
PORT=3002
DATABASE_URL=postgresql://postgres:password@localhost:5432/syntaxis_ai_test
JWT_SECRET=test-jwt-secret-key-for-testing-only
REDIS_URL=redis://localhost:6379/1
CORS_ORIGIN=http://localhost:5173

# Test-specific settings
LOG_LEVEL=error
DISABLE_RATE_LIMITING=true
ENABLE_TEST_ROUTES=true

# OCR Test Settings
OCR_CONFIDENCE_THRESHOLD=0.5
TESSERACT_WORKER_AMOUNT=1

# File Upload Test Settings
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./temp/test-uploads
`;
        fs.writeFileSync(testEnvPath, testEnvContent);
        results.push('Created .env.test file');
      } else {
        results.push('.env.test already exists');
      }

      // Create test database if it doesn't exist
      try {
        console.log('Creating test database...');
        execSync('createdb syntaxis_ai_test', { stdio: 'pipe' });
        results.push('Test database created');
      } catch (error) {
        if (error.message.includes('already exists')) {
          results.push('Test database already exists');
        } else {
          errors.push('Failed to create test database: ' + error.message);
        }
      }

      // Run test migrations
      try {
        console.log('Running test database migrations...');
        execSync('npx prisma migrate deploy', {
          cwd: this.backendDir,
          env: { ...process.env, NODE_ENV: 'test' },
          stdio: 'pipe'
        });
        results.push('Test database migrations completed');
      } catch (error) {
        errors.push('Failed to run test migrations: ' + error.message);
      }

      return {
        success: errors.length === 0,
        message: errors.length === 0 ? 'Test database setup completed' : 'Test database setup completed with warnings',
        details: results,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to setup test database',
        errors: [error.message]
      };
    }
  }

  async setupTestUtilities() {
    try {
      const results = [];
      const errors = [];

      // Create test utilities directory
      const testUtilsDir = path.join(this.backendDir, 'src/__tests__/utils');
      if (!fs.existsSync(testUtilsDir)) {
        fs.mkdirSync(testUtilsDir, { recursive: true });
        results.push('Created test utilities directory');
      }

      // Create test database utilities
      const testDbUtilsPath = path.join(testUtilsDir, 'test-db.ts');
      if (!fs.existsSync(testDbUtilsPath)) {
        const testDbUtilsContent = `import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

export const getTestDb = () => {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/syntaxis_ai_test'
        }
      }
    });
  }
  return prisma;
};

export const cleanupTestDb = async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
};

export const resetTestDb = async () => {
  const db = getTestDb();
  
  // Clean up test data in reverse order of dependencies
  await db.invoice.deleteMany();
  await db.user.deleteMany();
  
  return db;
};

export const seedTestData = async () => {
  const db = getTestDb();
  
  // Create test user
  const testUser = await db.user.create({
    data: {
      email: 'test@example.com',
      password: 'hashedpassword',
      firstName: 'Test',
      lastName: 'User'
    }
  });
  
  return { testUser };
};
`;
        fs.writeFileSync(testDbUtilsPath, testDbUtilsContent);
        results.push('Created test database utilities');
      }

      // Create test factories directory
      const testFactoriesDir = path.join(this.backendDir, 'src/__tests__/factories');
      if (!fs.existsSync(testFactoriesDir)) {
        fs.mkdirSync(testFactoriesDir, { recursive: true });
        results.push('Created test factories directory');
      }

      // Create test mocks directory
      const testMocksDir = path.join(this.backendDir, 'src/__tests__/mocks');
      if (!fs.existsSync(testMocksDir)) {
        fs.mkdirSync(testMocksDir, { recursive: true });
        results.push('Created test mocks directory');
      }

      return {
        success: errors.length === 0,
        message: 'Test utilities setup completed',
        details: results,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to setup test utilities',
        errors: [error.message]
      };
    }
  }

  async setupFrontendTests() {
    try {
      const results = [];
      const errors = [];

      // Check if vitest is installed
      const packageJsonPath = path.join(this.frontendDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      if (!packageJson.devDependencies['@vitest/ui']) {
        console.log('Installing @vitest/ui...');
        execSync('npm install --save-dev @vitest/ui', {
          cwd: this.frontendDir,
          stdio: 'inherit'
        });
        results.push('Installed @vitest/ui dependency');
      } else {
        results.push('@vitest/ui already installed');
      }

      // Create vitest configuration if it doesn't exist
      const vitestConfigPath = path.join(this.frontendDir, 'vitest.config.ts');
      if (!fs.existsSync(vitestConfigPath)) {
        const vitestConfigContent = `import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
`;
        fs.writeFileSync(vitestConfigPath, vitestConfigContent);
        results.push('Created vitest configuration');
      }

      // Create frontend test setup
      const frontendTestDir = path.join(this.frontendDir, 'src/__tests__');
      if (!fs.existsSync(frontendTestDir)) {
        fs.mkdirSync(frontendTestDir, { recursive: true });
      }

      const frontendTestSetupPath = path.join(frontendTestDir, 'setup.ts');
      if (!fs.existsSync(frontendTestSetupPath)) {
        const frontendTestSetupContent = `import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
Object.defineProperty(window, 'env', {
  value: {
    VITE_API_BASE_URL: 'http://localhost:3002',
    VITE_API_TIMEOUT: '30000'
  }
});

// Mock fetch
global.fetch = vi.fn();

// Mock console methods for cleaner test output
const originalConsole = { ...console };

beforeAll(() => {
  console.log = vi.fn();
  console.info = vi.fn();
  console.warn = vi.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});
`;
        fs.writeFileSync(frontendTestSetupPath, frontendTestSetupContent);
        results.push('Created frontend test setup');
      }

      return {
        success: errors.length === 0,
        message: 'Frontend test setup completed',
        details: results,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to setup frontend tests',
        errors: [error.message]
      };
    }
  }

  async runFullTestSetup() {
    const results = [];
    const errors = [];

    console.log('🧪 Starting test environment setup...\n');

    // Setup test database
    console.log('🗄️ Setting up test database...');
    const dbResult = await this.setupTestDatabase();
    if (dbResult.success) {
      results.push(dbResult.message);
      if (dbResult.details) results.push(...dbResult.details);
    } else {
      errors.push(dbResult.message);
      if (dbResult.errors) errors.push(...dbResult.errors);
    }

    // Setup test utilities
    console.log('\n🛠️ Setting up test utilities...');
    const utilsResult = await this.setupTestUtilities();
    if (utilsResult.success) {
      results.push(utilsResult.message);
      if (utilsResult.details) results.push(...utilsResult.details);
    } else {
      errors.push(utilsResult.message);
      if (utilsResult.errors) errors.push(...utilsResult.errors);
    }

    // Setup frontend tests
    console.log('\n⚛️ Setting up frontend tests...');
    const frontendResult = await this.setupFrontendTests();
    if (frontendResult.success) {
      results.push(frontendResult.message);
      if (frontendResult.details) results.push(...frontendResult.details);
    } else {
      errors.push(frontendResult.message);
      if (frontendResult.errors) errors.push(...frontendResult.errors);
    }

    const success = errors.length === 0;
    console.log(success ? '\n✅ Test setup completed successfully!' : '\n❌ Test setup completed with errors');

    return {
      success,
      message: success ? 'All test environment setup completed successfully' : 'Test setup completed with errors',
      details: results,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const workspaceFlag = args.find(arg => arg.startsWith('--workspace='));
  const workspace = workspaceFlag ? workspaceFlag.split('=')[1] : 'all';

  const rootDir = path.resolve(__dirname, '..');
  const setupManager = new TestEnvironmentSetup(rootDir);

  printHeader('SyntaxisAI Test Environment Setup (Task 1.3.2)');
  console.log(colorize('Setting up test environment with TDD best practices', 'yellow'));
  console.log(colorize(`Workspace: ${workspace}`, 'magenta'));
  console.log(colorize(`Root directory: ${rootDir}`, 'blue'));

  try {
    let result;
    
    switch (workspace) {
      case 'backend':
        console.log('\n' + colorize('🗄️ Setting up backend test environment', 'bright'));
        const dbResult = await setupManager.setupTestDatabase();
        const utilsResult = await setupManager.setupTestUtilities();
        result = {
          success: dbResult.success && utilsResult.success,
          message: 'Backend test environment setup completed',
          details: [...(dbResult.details || []), ...(utilsResult.details || [])],
          errors: [...(dbResult.errors || []), ...(utilsResult.errors || [])]
        };
        break;

      case 'frontend':
        console.log('\n' + colorize('⚛️ Setting up frontend test environment', 'bright'));
        result = await setupManager.setupFrontendTests();
        break;

      case 'all':
      default:
        console.log('\n' + colorize('🧪 Setting up complete test environment', 'bright'));
        result = await setupManager.runFullTestSetup();
        break;
    }

    printResult(result);

    console.log('\n' + '='.repeat(60));
    console.log(colorize('Test setup completed!', 'green'));
    console.log(colorize('Next steps:', 'yellow'));
    console.log(colorize('  1. Run tests: npm test', 'blue'));
    console.log(colorize('  2. Run unit tests: npm run test:unit', 'blue'));
    console.log(colorize('  3. Run with UI: npm run test:ui', 'blue'));
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n' + colorize('💥 Test setup failed with error:', 'red'));
    console.error(colorize(error.message, 'red'));
    
    if (error.stack) {
      console.error('\n' + colorize('Stack trace:', 'yellow'));
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(colorize('Unhandled Rejection at:', 'red'), promise);
  console.error(colorize('Reason:', 'red'), reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(colorize('Uncaught Exception:', 'red'), error);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error(colorize('Fatal error:', 'red'), error);
    process.exit(1);
  });
}

module.exports = { TestEnvironmentSetup, main };
