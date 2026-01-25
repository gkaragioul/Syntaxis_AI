// @ts-nocheck
/**
 * Coverage Validation Runner
 * 
 * TDD Phase: GREEN - Implementation to validate coverage setup and reporting
 * Task: 1.1.5 - Test Coverage Validation
 * 
 * This utility provides:
 * 1. Complete coverage validation workflow
 * 2. Jest configuration validation
 * 3. Coverage report accuracy verification
 * 4. CI/CD integration validation
 * 5. Performance and consistency checks
 */

import { coverageValidator, COVERAGE_THRESHOLDS } from './coverage-validator';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Validates the complete coverage setup
 * Returns a detailed report of the coverage validation state
 */
export const validateCoverageSetup = async (): Promise<{
  success: boolean;
  report: string[];
  errors: string[];
}> => {
  const report: string[] = [];
  const errors: string[] = [];

  try {
    report.push('🔍 Starting comprehensive coverage validation...');

    // Test 1: Jest configuration validation
    report.push('\n📋 Validating Jest configuration...');
    
    try {
      const jestConfigPath = path.join(process.cwd(), 'jest.config.js');
      
      if (fs.existsSync(jestConfigPath)) {
        const jestConfig = require(jestConfigPath);
        
        // Validate coverage threshold configuration
        if (jestConfig.coverageThreshold?.global) {
          const thresholds = jestConfig.coverageThreshold.global;
          
          if (thresholds.branches >= 95 && thresholds.functions >= 95 && 
              thresholds.lines >= 95 && thresholds.statements >= 95) {
            report.push('✅ Jest coverage thresholds correctly set to 95%');
          } else {
            errors.push('❌ Jest coverage thresholds not set to 95%');
          }
        } else {
          errors.push('❌ Jest coverage thresholds not configured');
        }
        
        // Validate coverage collection patterns
        if (jestConfig.collectCoverageFrom) {
          const patterns = jestConfig.collectCoverageFrom;
          
          if (patterns.includes('src/**/*.ts') && 
              patterns.includes('!src/**/*.d.ts') &&
              patterns.includes('!src/**/__tests__/**')) {
            report.push('✅ Coverage collection patterns correctly configured');
          } else {
            errors.push('❌ Coverage collection patterns incomplete');
          }
        } else {
          errors.push('❌ Coverage collection patterns not configured');
        }
        
        // Validate coverage reporters
        if (jestConfig.coverageReporters) {
          const reporters = jestConfig.coverageReporters;
          
          if (reporters.includes('text') && reporters.includes('lcov') && 
              reporters.includes('html')) {
            report.push('✅ Coverage reporters correctly configured');
          } else {
            errors.push('❌ Coverage reporters incomplete');
          }
        } else {
          errors.push('❌ Coverage reporters not configured');
        }
        
      } else {
        errors.push('❌ Jest configuration file not found');
      }
      
    } catch (error) {
      errors.push(`❌ Jest configuration validation failed: ${error.message}`);
    }

    // Test 2: Package.json scripts validation
    report.push('\n📦 Validating package.json test scripts...');
    
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
        if (packageJson.scripts?.['test:coverage']) {
          report.push('✅ Coverage test script exists');
          
          if (packageJson.scripts['test:coverage'].includes('--coverage')) {
            report.push('✅ Coverage script includes --coverage flag');
          } else {
            errors.push('❌ Coverage script missing --coverage flag');
          }
        } else {
          errors.push('❌ Coverage test script not found');
        }
        
        if (packageJson.scripts?.['test:ci']) {
          report.push('✅ CI test script exists');
        } else {
          errors.push('❌ CI test script not found');
        }
        
      } else {
        errors.push('❌ package.json not found');
      }
      
    } catch (error) {
      errors.push(`❌ Package.json validation failed: ${error.message}`);
    }

    // Test 3: Coverage report generation test
    report.push('\n🔧 Testing coverage report generation...');
    
    try {
      // Clean up any existing coverage
      const coverageDir = path.join(process.cwd(), 'coverage');
      if (fs.existsSync(coverageDir)) {
        fs.rmSync(coverageDir, { recursive: true, force: true });
      }
      
      // Run a minimal test with coverage to generate reports
      try {
        execSync('npm run test:coverage -- --testPathPattern=infrastructure/coverage-validation.test.ts --silent', {
          stdio: 'pipe',
          timeout: 60000
        });
      } catch (error) {
        // Coverage might fail due to thresholds, but reports should still be generated
        console.log('Coverage test completed (may have failed thresholds)');
      }
      
      // Validate coverage directory and files exist
      if (fs.existsSync(coverageDir)) {
        report.push('✅ Coverage directory created');
        
        const expectedFiles = [
          'coverage-final.json',
          'coverage-summary.json',
          'lcov.info',
          'lcov-report/index.html'
        ];
        
        let allFilesExist = true;
        expectedFiles.forEach(file => {
          const filePath = path.join(coverageDir, file);
          if (fs.existsSync(filePath)) {
            report.push(`✅ ${file} generated`);
          } else {
            errors.push(`❌ ${file} not generated`);
            allFilesExist = false;
          }
        });
        
        if (allFilesExist) {
          report.push('✅ All coverage reports generated successfully');
        }
        
      } else {
        errors.push('❌ Coverage directory not created');
      }
      
    } catch (error) {
      errors.push(`❌ Coverage report generation failed: ${error.message}`);
    }

    // Test 4: Coverage validator functionality
    report.push('\n⚡ Testing coverage validator...');
    
    try {
      const validationResult = await coverageValidator.validateCoverage();
      
      if (validationResult) {
        report.push('✅ Coverage validator executed successfully');
        report.push(`   - Overall valid: ${validationResult.isValid}`);
        report.push(`   - Failed thresholds: ${validationResult.failedThresholds.length}`);
        report.push(`   - Uncovered files: ${validationResult.uncoveredFiles.length}`);
        report.push(`   - Recommendations: ${validationResult.recommendations.length}`);
        
        // Validate coverage metrics structure
        const { overallCoverage } = validationResult;
        if (overallCoverage.lines && overallCoverage.statements && 
            overallCoverage.functions && overallCoverage.branches) {
          report.push('✅ Coverage metrics structure valid');
        } else {
          errors.push('❌ Coverage metrics structure invalid');
        }
        
      } else {
        errors.push('❌ Coverage validator returned null result');
      }
      
    } catch (error) {
      errors.push(`❌ Coverage validator test failed: ${error.message}`);
    }

    // Test 5: CI integration validation
    report.push('\n🚀 Validating CI integration...');
    
    try {
      const ciResult = await coverageValidator.validateForCI();
      
      if (ciResult) {
        report.push('✅ CI validation executed successfully');
        report.push(`   - Success: ${ciResult.success}`);
        report.push(`   - Message length: ${ciResult.message.length} chars`);
        
        if (ciResult.message.includes('Coverage Report') && 
            ciResult.message.includes('Statements:')) {
          report.push('✅ CI message format valid');
        } else {
          errors.push('❌ CI message format invalid');
        }
        
      } else {
        errors.push('❌ CI validation returned null result');
      }
      
    } catch (error) {
      errors.push(`❌ CI integration test failed: ${error.message}`);
    }

    // Test 6: Coverage consistency check
    report.push('\n🔄 Testing coverage consistency...');
    
    try {
      // Run coverage twice and compare results (if reports exist)
      const coverageSummaryPath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      
      if (fs.existsSync(coverageSummaryPath)) {
        const summary1 = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf-8'));
        
        // Wait a moment and check again
        setTimeout(() => {
          if (fs.existsSync(coverageSummaryPath)) {
            const summary2 = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf-8'));
            
            if (summary1.total.lines.pct === summary2.total.lines.pct) {
              report.push('✅ Coverage metrics are consistent');
            } else {
              errors.push('❌ Coverage metrics inconsistent between reads');
            }
          }
        }, 100);
        
        // Validate coverage percentages are within valid range
        const { total } = summary1;
        const metrics = [total.lines, total.statements, total.functions, total.branches];
        
        let allMetricsValid = true;
        metrics.forEach(metric => {
          if (metric.pct < 0 || metric.pct > 100 || 
              metric.covered < 0 || metric.covered > metric.total) {
            allMetricsValid = false;
          }
        });
        
        if (allMetricsValid) {
          report.push('✅ Coverage metrics within valid ranges');
        } else {
          errors.push('❌ Coverage metrics contain invalid values');
        }
        
      } else {
        errors.push('❌ Coverage summary not available for consistency check');
      }
      
    } catch (error) {
      errors.push(`❌ Coverage consistency test failed: ${error.message}`);
    }

    // Final report
    const success = errors.length === 0;
    report.push(`\n📊 Validation ${success ? 'PASSED' : 'FAILED'}`);
    report.push(`   - Tests passed: ${report.filter(r => r.includes('✅')).length}`);
    report.push(`   - Tests failed: ${errors.length}`);

    return { success, report, errors };

  } catch (error) {
    errors.push(`❌ Validation process failed: ${error.message}`);
    return { success: false, report, errors };
  }
};

/**
 * Runs a quick validation and prints results to console
 */
export const quickCoverageValidation = async (): Promise<boolean> => {
  console.log('🚀 Running comprehensive coverage validation...\n');
  
  const { success, report, errors } = await validateCoverageSetup();
  
  // Print report
  report.forEach(line => console.log(line));
  
  // Print errors if any
  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(error => console.log(error));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(success ? '✅ COVERAGE VALIDATION PASSED' : '❌ COVERAGE VALIDATION FAILED');
  console.log('='.repeat(50));
  
  return success;
};

// Export for use in tests and scripts
export default {
  validateCoverageSetup,
  quickCoverageValidation,
};
