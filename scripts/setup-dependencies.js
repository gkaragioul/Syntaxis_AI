#!/usr/bin/env node

/**
 * Dependency Setup Script (JavaScript version)
 * Implements lines 93-98 of scratchpad with TDD best practices
 * 
 * Usage:
 *   npm run setup:dependencies
 *   node scripts/setup-dependencies.js
 *   node scripts/setup-dependencies.js --task=backend
 *   node scripts/setup-dependencies.js --task=frontend
 *   node scripts/setup-dependencies.js --task=root
 *   node scripts/setup-dependencies.js --task=env
 *   node scripts/setup-dependencies.js --task=migrations
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

// Simple dependency setup functions
class SimpleDependencySetup {
  constructor(rootDir) {
    this.rootDir = rootDir || path.resolve(__dirname, '..');
    this.backendDir = path.join(this.rootDir, 'backend');
    this.frontendDir = path.join(this.rootDir, 'frontend');
  }

  async installBackendDependencies() {
    try {
      const packageJsonPath = path.join(this.backendDir, 'package.json');
      
      if (!fs.existsSync(packageJsonPath)) {
        return {
          success: false,
          message: 'Backend package.json not found',
          errors: [`Package.json not found at ${packageJsonPath}`]
        };
      }

      console.log('Installing backend dependencies...');
      execSync('npm install', { 
        cwd: this.backendDir, 
        stdio: 'inherit',
        timeout: 300000
      });

      return {
        success: true,
        message: 'Backend dependencies installed successfully',
        details: ['All backend packages installed']
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to install backend dependencies',
        errors: [error.message]
      };
    }
  }

  async installFrontendDependencies() {
    try {
      const packageJsonPath = path.join(this.frontendDir, 'package.json');
      
      if (!fs.existsSync(packageJsonPath)) {
        return {
          success: false,
          message: 'Frontend package.json not found',
          errors: [`Package.json not found at ${packageJsonPath}`]
        };
      }

      console.log('Installing frontend dependencies...');
      execSync('npm install', { 
        cwd: this.frontendDir, 
        stdio: 'inherit',
        timeout: 300000
      });

      return {
        success: true,
        message: 'Frontend dependencies installed successfully',
        details: ['All frontend packages installed']
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to install frontend dependencies',
        errors: [error.message]
      };
    }
  }

  async installRootDependencies() {
    try {
      const packageJsonPath = path.join(this.rootDir, 'package.json');
      
      if (!fs.existsSync(packageJsonPath)) {
        return {
          success: false,
          message: 'Root package.json not found',
          errors: [`Package.json not found at ${packageJsonPath}`]
        };
      }

      console.log('Installing root dependencies...');
      execSync('npm install', { 
        cwd: this.rootDir, 
        stdio: 'inherit',
        timeout: 300000
      });

      return {
        success: true,
        message: 'Root dependencies installed successfully',
        details: ['All root packages installed']
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to install root dependencies',
        errors: [error.message]
      };
    }
  }

  async setupEnvironmentVariables() {
    try {
      const results = [];
      const errors = [];

      // Backend environment setup
      const backendEnvPath = path.join(this.backendDir, '.env.development');
      if (!fs.existsSync(backendEnvPath)) {
        const examplePath = path.join(this.rootDir, '.env.example');
        if (fs.existsSync(examplePath)) {
          fs.copyFileSync(examplePath, backendEnvPath);
          results.push('Created backend/.env.development from .env.example');
        } else {
          errors.push('Backend .env.example not found');
        }
      } else {
        results.push('Backend .env.development already exists');
      }

      // Frontend environment setup
      const frontendEnvPath = path.join(this.frontendDir, '.env.development');
      if (!fs.existsSync(frontendEnvPath)) {
        const frontendEnvContent = `# API Configuration
VITE_API_BASE_URL=http://localhost:3001
VITE_API_TIMEOUT=30000

# Feature Flags
VITE_ENABLE_MOCK_API=false
VITE_ENABLE_ANALYTICS=false

# Upload Configuration
VITE_MAX_FILE_SIZE=104857600  # 100MB in bytes
VITE_ALLOWED_FILE_TYPES=application/pdf
VITE_MAX_FILES_PER_BATCH=50

# Development Tools
VITE_ENABLE_DEVTOOLS=true
VITE_ENABLE_LOGGING=true
VITE_LOG_LEVEL=debug

# Security
VITE_CORS_ORIGIN=http://localhost:5173
VITE_RATE_LIMIT_WINDOW_MS=60000
VITE_RATE_LIMIT_MAX=1000
`;
        fs.writeFileSync(frontendEnvPath, frontendEnvContent);
        results.push('Created frontend/.env.development');
      } else {
        results.push('Frontend .env.development already exists');
      }

      return {
        success: errors.length === 0,
        message: errors.length === 0 ? 'Environment variables setup completed' : 'Environment setup completed with warnings',
        details: results,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to setup environment variables',
        errors: [error.message]
      };
    }
  }

  async runPrismaMigrations() {
    try {
      const schemaPath = path.join(this.backendDir, 'prisma', 'schema.prisma');
      
      if (!fs.existsSync(schemaPath)) {
        return {
          success: false,
          message: 'Prisma schema not found',
          errors: [`Schema not found at ${schemaPath}`]
        };
      }

      const results = [];

      console.log('Generating Prisma client...');
      execSync('npx prisma generate', { 
        cwd: this.backendDir, 
        stdio: 'inherit',
        timeout: 120000
      });
      results.push('Prisma client generated');

      console.log('Running Prisma migrations...');
      execSync('npx prisma migrate dev --name init', { 
        cwd: this.backendDir, 
        stdio: 'inherit',
        timeout: 120000
      });
      results.push('Database migrations completed');

      return {
        success: true,
        message: 'Prisma migrations completed successfully',
        details: results
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to run Prisma migrations',
        errors: [error.message]
      };
    }
  }

  async runFullSetup() {
    const results = [];
    const errors = [];

    console.log('🚀 Starting full dependency setup...\n');

    // Task 1.2.3: Root dependencies first
    console.log('📦 Installing root dependencies...');
    const rootResult = await this.installRootDependencies();
    if (rootResult.success) {
      results.push(rootResult.message);
      if (rootResult.details) results.push(...rootResult.details);
    } else {
      errors.push(rootResult.message);
      if (rootResult.errors) errors.push(...rootResult.errors);
    }

    // Task 1.2.1: Backend dependencies
    console.log('\n🔧 Installing backend dependencies...');
    const backendResult = await this.installBackendDependencies();
    if (backendResult.success) {
      results.push(backendResult.message);
      if (backendResult.details) results.push(...backendResult.details);
    } else {
      errors.push(backendResult.message);
      if (backendResult.errors) errors.push(...backendResult.errors);
    }

    // Task 1.2.2: Frontend dependencies
    console.log('\n⚛️ Installing frontend dependencies...');
    const frontendResult = await this.installFrontendDependencies();
    if (frontendResult.success) {
      results.push(frontendResult.message);
      if (frontendResult.details) results.push(...frontendResult.details);
    } else {
      errors.push(frontendResult.message);
      if (frontendResult.errors) errors.push(...frontendResult.errors);
    }

    // Task 1.2.4: Environment variables
    console.log('\n🔐 Setting up environment variables...');
    const envResult = await this.setupEnvironmentVariables();
    if (envResult.success) {
      results.push(envResult.message);
      if (envResult.details) results.push(...envResult.details);
    } else {
      errors.push(envResult.message);
      if (envResult.errors) errors.push(...envResult.errors);
    }

    // Task 1.2.5: Prisma migrations (only if backend setup succeeded)
    if (backendResult.success) {
      console.log('\n🗄️ Running Prisma migrations...');
      const migrationResult = await this.runPrismaMigrations();
      if (migrationResult.success) {
        results.push(migrationResult.message);
        if (migrationResult.details) results.push(...migrationResult.details);
      } else {
        errors.push(migrationResult.message);
        if (migrationResult.errors) errors.push(...migrationResult.errors);
      }
    } else {
      errors.push('Skipped Prisma migrations due to backend setup failure');
    }

    const success = errors.length === 0;
    console.log(success ? '\n✅ Setup completed successfully!' : '\n❌ Setup completed with errors');

    return {
      success,
      message: success ? 'All dependency setup tasks completed successfully' : 'Setup completed with errors',
      details: results,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const taskFlag = args.find(arg => arg.startsWith('--task='));
  const task = taskFlag ? taskFlag.split('=')[1] : 'all';

  const rootDir = path.resolve(__dirname, '..');
  const setupManager = new SimpleDependencySetup(rootDir);

  printHeader('SyntaxisAI Dependency Setup (Lines 93-98)');
  console.log(colorize('Implementing scratchpad tasks with TDD best practices', 'yellow'));
  console.log(colorize(`Task: ${task}`, 'magenta'));
  console.log(colorize(`Root directory: ${rootDir}`, 'blue'));

  try {
    let result;
    
    switch (task) {
      case 'backend':
        console.log('\n' + colorize('🔧 Task 1.2.1: Installing Backend Dependencies', 'bright'));
        result = await setupManager.installBackendDependencies();
        break;

      case 'frontend':
        console.log('\n' + colorize('⚛️ Task 1.2.2: Installing Frontend Dependencies', 'bright'));
        result = await setupManager.installFrontendDependencies();
        break;

      case 'root':
        console.log('\n' + colorize('📦 Task 1.2.3: Installing Root Dependencies', 'bright'));
        result = await setupManager.installRootDependencies();
        break;

      case 'env':
        console.log('\n' + colorize('🔐 Task 1.2.4: Setting Up Environment Variables', 'bright'));
        result = await setupManager.setupEnvironmentVariables();
        break;

      case 'migrations':
        console.log('\n' + colorize('🗄️ Task 1.2.5: Running Prisma Migrations', 'bright'));
        result = await setupManager.runPrismaMigrations();
        break;

      case 'all':
      default:
        console.log('\n' + colorize('🚀 Running All Setup Tasks (1.2.1 - 1.2.5)', 'bright'));
        result = await setupManager.runFullSetup();
        break;
    }

    printResult(result);

    console.log('\n' + '='.repeat(60));
    console.log(colorize('Setup completed!', 'green'));
    console.log(colorize('Next steps:', 'yellow'));
    console.log(colorize('  1. Run tests: npm test', 'blue'));
    console.log(colorize('  2. Start development: npm run dev', 'blue'));
    console.log(colorize('  3. Check status: npm run dev:status', 'blue'));
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n' + colorize('💥 Setup failed with error:', 'red'));
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

module.exports = { SimpleDependencySetup, main };
