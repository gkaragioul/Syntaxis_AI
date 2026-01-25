#!/usr/bin/env node

/**
 * Coverage Validation Script
 * 
 * Task 1.1.5: Validate test coverage reporting accuracy
 * GREEN phase: Comprehensive coverage validation for CI/CD
 * 
 * This script validates:
 * - Coverage reports exist and are valid
 * - Coverage meets specified thresholds
 * - Coverage configuration is correct
 * - Coverage quality metrics
 */

const fs = require('fs');
const path = require('path');

class CoverageValidator {
  constructor(options = {}) {
    this.coverageDir = options.coverageDir || 'coverage';
    this.thresholds = options.thresholds || {
      lines: 95,
      statements: 95,
      functions: 95,
      branches: 95
    };
    this.verbose = options.verbose || false;
  }

  log(message, level = 'info') {
    if (this.verbose || level === 'error') {
      const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Main validation function
   */
  async validate() {
    this.log('🔍 Starting coverage validation...');
    
    const results = {
      reportFiles: this.validateReportFiles(),
      configuration: this.validateConfiguration(),
      thresholds: this.validateThresholds(),
      quality: this.generateQualityReport()
    };

    const allPassed = Object.values(results).every(result => result.passed);
    
    this.generateSummaryReport(results, allPassed);
    
    return {
      passed: allPassed,
      results,
      exitCode: allPassed ? 0 : 1
    };
  }

  /**
   * Validate coverage report files exist
   */
  validateReportFiles() {
    this.log('Checking coverage report files...');
    
    const expectedFiles = [
      'coverage-summary.json',
      'coverage-final.json',
      'lcov.info',
      'lcov-report/index.html'
    ];

    const missingFiles = [];
    const existingFiles = [];

    expectedFiles.forEach(file => {
      const filePath = path.join(this.coverageDir, file);
      if (fs.existsSync(filePath)) {
        existingFiles.push(file);
        this.log(`Found: ${file}`);
      } else {
        missingFiles.push(file);
        this.log(`Missing: ${file}`, 'warn');
      }
    });

    return {
      passed: missingFiles.length === 0,
      existingFiles,
      missingFiles,
      message: missingFiles.length === 0 
        ? 'All coverage report files found'
        : `Missing files: ${missingFiles.join(', ')}`
    };
  }

  /**
   * Validate Jest configuration
   */
  validateConfiguration() {
    this.log('Validating Jest configuration...');
    
    const configPath = path.join(process.cwd(), 'jest.config.js');
    const issues = [];

    if (!fs.existsSync(configPath)) {
      issues.push('Jest config file not found');
      return { passed: false, issues, message: 'Jest configuration missing' };
    }

    try {
      const config = require(configPath);

      // Check coverage configuration
      if (!config.coverageDirectory) {
        issues.push('Missing coverageDirectory');
      }

      if (!config.coverageReporters || !Array.isArray(config.coverageReporters)) {
        issues.push('Missing coverageReporters');
      } else {
        const requiredReporters = ['text', 'lcov', 'html'];
        requiredReporters.forEach(reporter => {
          if (!config.coverageReporters.includes(reporter)) {
            issues.push(`Missing reporter: ${reporter}`);
          }
        });
      }

      if (!config.coverageThreshold || !config.coverageThreshold.global) {
        issues.push('Missing coverage thresholds');
      }

      if (!config.collectCoverageFrom) {
        issues.push('Missing collectCoverageFrom');
      }

    } catch (error) {
      issues.push(`Failed to load config: ${error.message}`);
    }

    return {
      passed: issues.length === 0,
      issues,
      message: issues.length === 0 
        ? 'Jest configuration is valid'
        : `Configuration issues: ${issues.join(', ')}`
    };
  }

  /**
   * Validate coverage meets thresholds
   */
  validateThresholds() {
    this.log('Checking coverage thresholds...');
    
    const summaryPath = path.join(this.coverageDir, 'coverage-summary.json');
    
    if (!fs.existsSync(summaryPath)) {
      return {
        passed: false,
        message: 'Coverage summary not found',
        metrics: null,
        failures: ['Coverage summary missing']
      };
    }

    let summary;
    try {
      summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to parse coverage summary',
        metrics: null,
        failures: [`Parse error: ${error.message}`]
      };
    }

    const metrics = summary.total;
    const failures = [];

    Object.entries(this.thresholds).forEach(([metric, threshold]) => {
      const actual = metrics[metric].pct;
      if (actual < threshold) {
        failures.push(`${metric}: ${actual}% < ${threshold}%`);
        this.log(`${metric}: ${actual}% (below ${threshold}%)`, 'warn');
      } else {
        this.log(`${metric}: ${actual}% (meets ${threshold}%)`);
      }
    });

    return {
      passed: failures.length === 0,
      metrics,
      failures,
      message: failures.length === 0 
        ? 'All coverage thresholds met'
        : `Threshold failures: ${failures.join(', ')}`
    };
  }

  /**
   * Generate coverage quality report
   */
  generateQualityReport() {
    this.log('Generating quality report...');
    
    const summaryPath = path.join(this.coverageDir, 'coverage-summary.json');
    
    if (!fs.existsSync(summaryPath)) {
      return {
        passed: false,
        overall: 'unknown',
        recommendations: ['Generate coverage report first'],
        message: 'Cannot assess quality without coverage data'
      };
    }

    let summary;
    try {
      summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    } catch (error) {
      return {
        passed: false,
        overall: 'unknown',
        recommendations: ['Fix coverage report format'],
        message: 'Invalid coverage data'
      };
    }

    const metrics = summary.total;
    const avgCoverage = (metrics.lines.pct + metrics.statements.pct + 
                        metrics.functions.pct + metrics.branches.pct) / 4;

    let overall;
    const recommendations = [];

    if (avgCoverage >= 95) {
      overall = 'excellent';
    } else if (avgCoverage >= 85) {
      overall = 'good';
      recommendations.push('Consider increasing to 95% for excellent rating');
    } else if (avgCoverage >= 70) {
      overall = 'fair';
      recommendations.push('Increase coverage to at least 85%');
    } else {
      overall = 'poor';
      recommendations.push('Critical: Coverage below 70%');
    }

    // Specific recommendations
    if (metrics.branches.pct < 90) {
      recommendations.push('Focus on branch coverage');
    }
    if (metrics.functions.pct < 95) {
      recommendations.push('Ensure all functions are tested');
    }

    return {
      passed: overall === 'excellent' || overall === 'good',
      overall,
      avgCoverage: Math.round(avgCoverage * 100) / 100,
      recommendations,
      message: `Coverage quality: ${overall} (${Math.round(avgCoverage)}% average)`
    };
  }

  /**
   * Generate summary report
   */
  generateSummaryReport(results, allPassed) {
    console.log('\n📊 Coverage Validation Summary');
    console.log('================================');
    
    Object.entries(results).forEach(([category, result]) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${category}: ${result.message}`);
      
      if (!result.passed && result.failures) {
        result.failures.forEach(failure => {
          console.log(`   - ${failure}`);
        });
      }
      
      if (result.recommendations && result.recommendations.length > 0) {
        result.recommendations.forEach(rec => {
          console.log(`   💡 ${rec}`);
        });
      }
    });

    console.log('\n' + (allPassed ? '🎉 All validations passed!' : '⚠️  Some validations failed'));
    
    if (results.thresholds.metrics) {
      console.log('\nCoverage Metrics:');
      const metrics = results.thresholds.metrics;
      console.log(`  Lines: ${metrics.lines.pct}%`);
      console.log(`  Statements: ${metrics.statements.pct}%`);
      console.log(`  Functions: ${metrics.functions.pct}%`);
      console.log(`  Branches: ${metrics.branches.pct}%`);
    }
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--coverage-dir':
        options.coverageDir = args[++i];
        break;
      case '--threshold':
        const threshold = parseInt(args[++i]);
        options.thresholds = {
          lines: threshold,
          statements: threshold,
          functions: threshold,
          branches: threshold
        };
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: node validate-coverage.js [options]

Options:
  --verbose, -v           Verbose output
  --coverage-dir <dir>    Coverage directory (default: coverage)
  --threshold <number>    Coverage threshold percentage (default: 95)
  --help, -h              Show this help message

Examples:
  node validate-coverage.js
  node validate-coverage.js --verbose --threshold 90
  node validate-coverage.js --coverage-dir ./coverage
        `);
        process.exit(0);
    }
  }

  const validator = new CoverageValidator(options);
  const result = await validator.validate();
  
  process.exit(result.exitCode);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Coverage validation failed:', error.message);
    process.exit(1);
  });
}

module.exports = { CoverageValidator };
