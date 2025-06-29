#!/usr/bin/env ts-node

/**
 * Dependency Setup Script
 * Implements lines 93-98 of scratchpad with TDD best practices
 * 
 * Usage:
 *   npm run setup:dependencies
 *   npx ts-node scripts/setup-dependencies.ts
 *   npx ts-node scripts/setup-dependencies.ts --task backend
 *   npx ts-node scripts/setup-dependencies.ts --task frontend
 *   npx ts-node scripts/setup-dependencies.ts --task root
 *   npx ts-node scripts/setup-dependencies.ts --task env
 *   npx ts-node scripts/setup-dependencies.ts --task migrations
 */

import { DependencySetupManager } from '../backend/src/utils/setup-dependencies.js';
import path from 'path';

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

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title: string): void {
  console.log('\n' + '='.repeat(60));
  console.log(colorize(title, 'cyan'));
  console.log('='.repeat(60));
}

function printResult(result: any): void {
  if (result.success) {
    console.log(colorize('✅ ' + result.message, 'green'));
    if (result.details) {
      result.details.forEach((detail: string) => {
        console.log(colorize('   • ' + detail, 'blue'));
      });
    }
  } else {
    console.log(colorize('❌ ' + result.message, 'red'));
    if (result.errors) {
      result.errors.forEach((error: string) => {
        console.log(colorize('   • ' + error, 'red'));
      });
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const taskFlag = args.find(arg => arg.startsWith('--task='));
  const task = taskFlag ? taskFlag.split('=')[1] : 'all';

  const rootDir = path.resolve(__dirname, '..');
  const setupManager = new DependencySetupManager(rootDir);

  printHeader('SyntaxisAI Dependency Setup (Lines 93-98)');
  console.log(colorize('Implementing scratchpad tasks with TDD best practices', 'yellow'));
  console.log(colorize(`Task: ${task}`, 'magenta'));
  console.log(colorize(`Root directory: ${rootDir}`, 'blue'));

  try {
    switch (task) {
      case 'backend':
        console.log('\n' + colorize('🔧 Task 1.2.1: Installing Backend Dependencies', 'bright'));
        const backendResult = await setupManager.installBackendDependencies();
        printResult(backendResult);
        break;

      case 'frontend':
        console.log('\n' + colorize('⚛️ Task 1.2.2: Installing Frontend Dependencies', 'bright'));
        const frontendResult = await setupManager.installFrontendDependencies();
        printResult(frontendResult);
        break;

      case 'root':
        console.log('\n' + colorize('📦 Task 1.2.3: Installing Root Dependencies', 'bright'));
        const rootResult = await setupManager.installRootDependencies();
        printResult(rootResult);
        break;

      case 'env':
        console.log('\n' + colorize('🔐 Task 1.2.4: Setting Up Environment Variables', 'bright'));
        const envResult = await setupManager.setupEnvironmentVariables();
        printResult(envResult);
        break;

      case 'migrations':
        console.log('\n' + colorize('🗄️ Task 1.2.5: Running Prisma Migrations', 'bright'));
        const migrationResult = await setupManager.runPrismaMigrations();
        printResult(migrationResult);
        break;

      case 'all':
      default:
        console.log('\n' + colorize('🚀 Running All Setup Tasks (1.2.1 - 1.2.5)', 'bright'));
        const fullResult = await setupManager.runFullSetup();
        printResult(fullResult);
        break;
    }

    console.log('\n' + '='.repeat(60));
    console.log(colorize('Setup completed!', 'green'));
    console.log(colorize('Next steps:', 'yellow'));
    console.log(colorize('  1. Run tests: npm test', 'blue'));
    console.log(colorize('  2. Start development: npm run dev', 'blue'));
    console.log(colorize('  3. Check status: npm run dev:status', 'blue'));
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n' + colorize('💥 Setup failed with error:', 'red'));
    console.error(colorize(error instanceof Error ? error.message : String(error), 'red'));
    
    if (error instanceof Error && error.stack) {
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

export { main };
