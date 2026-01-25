#!/usr/bin/env node

/**
 * TDD Compliance Validation Script
 * 
 * Task 1.2.3: Pre-commit Test Validation
 * 
 * This script validates TDD compliance before commits:
 * - Runs all tests and ensures 100% pass rate
 * - Validates 95%+ test coverage
 * - Checks for proper test structure
 * - Ensures no production code without tests
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  coverageThreshold: 95,
  testTimeout: 300000, // 5 minutes
  requiredTestPatterns: [
    /\.test\.ts$/,
    /\.spec\.ts$/,
  ],
  excludeFromCoverage: [
    /\/index\.ts$/,
    /\/config\.ts$/,
    /\/__tests__\//,
    /\/mocks?\//,
    /\.d\.ts$/,
  ],
};

class TDDValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.workspaceRoot = process.cwd();
  }

  /**
   * Main validation entry point
   */
  async validate() {
    console.log('🧪 Starting TDD Compliance Validation...\n');

    try {
      // Step 1: Validate test environment
      await this.validateTestEnvironment();

      // Step 2: Run all tests
      await this.runTests();

      // Step 3: Validate coverage
      await this.validateCoverage();

      // Step 4: Check test structure
      await this.validateTestStructure();

      // Step 5: Validate TDD compliance
      await this.validateTDDCompliance();

      // Step 6: Generate report
      this.generateReport();

      return this.errors.length === 0;

    } catch (error) {
      this.errors.push(`Validation failed: ${error.message}`);
      this.generateReport();
      return false;
    }
  }

  /**
   * Validate test environment setup
   */
  async validateTestEnvironment() {
    console.log('📋 Validating test environment...');

    // Check required files exist
    const requiredFiles = [
      'jest.config.js',
      'src/__tests__/setup.ts',
      'src/__tests__/utils/test-environment.ts',
      'src/__tests__/__mocks__/prisma.ts',
      'src/__tests__/__mocks__/sharp.js',
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.workspaceRoot, 'backend', file);
      if (!fs.existsSync(filePath)) {
        this.errors.push(`Required test file missing: ${file}`);
      }
    }

    // Check environment variables
    if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
      this.warnings.push('NODE_ENV should be set to "test" for validation');
    }

    console.log('✅ Test environment validation complete\n');
  }

  /**
   * Run all tests and validate 100% pass rate
   */
  async runTests() {
    console.log('🧪 Running all tests...');

    try {
      const testCommand = 'cd backend && npm test -- --passWithNoTests --silent';
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        timeout: CONFIG.testTimeout,
        env: { ...process.env, NODE_ENV: 'test' }
      });

      // Parse test results
      const testResults = this.parseTestOutput(output);
      
      if (testResults.failed > 0) {
        this.errors.push(`${testResults.failed} tests failed. All tests must pass for TDD compliance.`);
      }

      if (testResults.total === 0) {
        this.warnings.push('No tests found. Ensure tests are properly configured.');
      }

      console.log(`✅ Tests completed: ${testResults.passed}/${testResults.total} passed\n`);

    } catch (error) {
      this.errors.push(`Test execution failed: ${error.message}`);
    }
  }

  /**
   * Validate test coverage meets 95% threshold
   */
  async validateCoverage() {
    console.log('📊 Validating test coverage...');

    try {
      const coverageCommand = 'cd backend && npm run test:coverage -- --silent';
      execSync(coverageCommand, { 
        encoding: 'utf8',
        timeout: CONFIG.testTimeout,
        env: { ...process.env, NODE_ENV: 'test' }
      });

      // Read coverage summary
      const coveragePath = path.join(this.workspaceRoot, 'backend', 'coverage', 'coverage-summary.json');
      
      if (!fs.existsSync(coveragePath)) {
        this.errors.push('Coverage report not found. Run tests with coverage first.');
        return;
      }

      const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      const { total } = coverageData;

      // Validate each coverage metric
      const metrics = ['statements', 'branches', 'functions', 'lines'];
      for (const metric of metrics) {
        const coverage = total[metric]?.pct || 0;
        if (coverage < CONFIG.coverageThreshold) {
          this.errors.push(
            `${metric} coverage (${coverage}%) below required threshold (${CONFIG.coverageThreshold}%)`
          );
        }
      }

      console.log(`✅ Coverage validation complete: ${total.statements?.pct || 0}% statements\n`);

    } catch (error) {
      this.errors.push(`Coverage validation failed: ${error.message}`);
    }
  }

  /**
   * Validate test file structure and naming
   */
  async validateTestStructure() {
    console.log('🏗️ Validating test structure...');

    const testDir = path.join(this.workspaceRoot, 'backend', 'src', '__tests__');
    
    if (!fs.existsSync(testDir)) {
      this.errors.push('Test directory not found: src/__tests__');
      return;
    }

    // Check for required test directories
    const requiredDirs = ['unit', 'integration', 'utils', '__mocks__'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(testDir, dir);
      if (!fs.existsSync(dirPath)) {
        this.warnings.push(`Recommended test directory missing: __tests__/${dir}`);
      }
    }

    // Validate test file naming
    const testFiles = this.findTestFiles(testDir);
    for (const testFile of testFiles) {
      if (!CONFIG.requiredTestPatterns.some(pattern => pattern.test(testFile))) {
        this.warnings.push(`Test file doesn't follow naming convention: ${testFile}`);
      }
    }

    console.log(`✅ Test structure validation complete: ${testFiles.length} test files found\n`);
  }

  /**
   * Validate TDD compliance (tests exist for production code)
   */
  async validateTDDCompliance() {
    console.log('🎯 Validating TDD compliance...');

    const srcDir = path.join(this.workspaceRoot, 'backend', 'src');
    const productionFiles = this.findProductionFiles(srcDir);
    const testFiles = this.findTestFiles(path.join(srcDir, '__tests__'));

    // Check for production files without corresponding tests
    const uncoveredFiles = [];
    
    for (const prodFile of productionFiles) {
      if (this.shouldHaveTest(prodFile)) {
        const hasTest = this.hasCorrespondingTest(prodFile, testFiles);
        if (!hasTest) {
          uncoveredFiles.push(prodFile);
        }
      }
    }

    if (uncoveredFiles.length > 0) {
      this.warnings.push(
        `${uncoveredFiles.length} production files may lack corresponding tests: ${uncoveredFiles.slice(0, 3).join(', ')}`
      );
    }

    console.log(`✅ TDD compliance validation complete\n`);
  }

  /**
   * Generate validation report
   */
  generateReport() {
    console.log('📋 TDD Compliance Validation Report');
    console.log('=====================================\n');

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('🎉 All validations passed! TDD compliance verified.\n');
      console.log('✅ 100% test pass rate');
      console.log('✅ 95%+ test coverage');
      console.log('✅ Proper test structure');
      console.log('✅ TDD compliance verified');
      return;
    }

    if (this.errors.length > 0) {
      console.log('❌ ERRORS (must be fixed):');
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      console.log('');
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS (recommended fixes):');
      this.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
      console.log('');
    }

    console.log('📚 TDD Resources:');
    console.log('   - TDD Workflow: docs/testing/tdd-workflow.md');
    console.log('   - Red-Green-Refactor: docs/testing/red-green-refactor-templates.md');
    console.log('   - Test Environment: src/__tests__/utils/test-environment.ts');
  }

  /**
   * Helper methods
   */
  parseTestOutput(output) {
    // Simple test result parsing
    const lines = output.split('\n');
    let passed = 0;
    let failed = 0;
    let total = 0;

    for (const line of lines) {
      if (line.includes('Tests:')) {
        const match = line.match(/(\d+) passed/);
        if (match) passed = parseInt(match[1]);
        
        const failMatch = line.match(/(\d+) failed/);
        if (failMatch) failed = parseInt(failMatch[1]);
        
        total = passed + failed;
        break;
      }
    }

    return { passed, failed, total };
  }

  findTestFiles(dir) {
    const testFiles = [];
    
    if (!fs.existsSync(dir)) return testFiles;

    const walk = (currentDir) => {
      const files = fs.readdirSync(currentDir);
      
      for (const file of files) {
        const filePath = path.join(currentDir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          walk(filePath);
        } else if (file.endsWith('.test.ts') || file.endsWith('.spec.ts')) {
          testFiles.push(filePath);
        }
      }
    };

    walk(dir);
    return testFiles;
  }

  findProductionFiles(dir) {
    const prodFiles = [];
    
    if (!fs.existsSync(dir)) return prodFiles;

    const walk = (currentDir) => {
      const files = fs.readdirSync(currentDir);
      
      for (const file of files) {
        const filePath = path.join(currentDir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !file.startsWith('.') && file !== '__tests__') {
          walk(filePath);
        } else if (file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.includes('.test.') && !file.includes('.spec.')) {
          prodFiles.push(filePath);
        }
      }
    };

    walk(dir);
    return prodFiles;
  }

  shouldHaveTest(filePath) {
    return !CONFIG.excludeFromCoverage.some(pattern => pattern.test(filePath));
  }

  hasCorrespondingTest(prodFile, testFiles) {
    const baseName = path.basename(prodFile, '.ts');
    return testFiles.some(testFile => 
      testFile.includes(baseName) || testFile.includes(baseName.toLowerCase())
    );
  }
}

// Main execution
async function main() {
  const validator = new TDDValidator();
  const isValid = await validator.validate();
  
  process.exit(isValid ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Validation script failed:', error);
    process.exit(1);
  });
}

module.exports = { TDDValidator };
