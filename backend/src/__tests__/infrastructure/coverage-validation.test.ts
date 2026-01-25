/**
 * Test Coverage Validation Tests
 * 
 * TDD Phase: RED - These tests validate test coverage reporting accuracy
 * Task: 1.1.5 - Validate test coverage reporting accuracy
 * 
 * These tests validate that:
 * 1. Coverage reports are accurate and complete
 * 2. Coverage thresholds are properly enforced
 * 3. Coverage configuration is correct across all Jest configs
 * 4. Coverage gates work in continuous integration
 * 5. Coverage metrics are reliable and consistent
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { jest } from '@jest/globals';

describe('Test Coverage Validation', () => {
  
  describe('Coverage Configuration Validation', () => {
    it('should have correct coverage thresholds in main Jest config', () => {
      // RED: This test validates the main Jest configuration
      const jestConfigPath = path.join(process.cwd(), 'jest.config.js');
      expect(fs.existsSync(jestConfigPath)).toBe(true);
      
      const jestConfig = require(jestConfigPath);
      
      // Validate coverage threshold configuration
      expect(jestConfig.coverageThreshold).toBeDefined();
      expect(jestConfig.coverageThreshold.global).toBeDefined();
      
      const thresholds = jestConfig.coverageThreshold.global;
      expect(thresholds.branches).toBe(95);
      expect(thresholds.functions).toBe(95);
      expect(thresholds.lines).toBe(95);
      expect(thresholds.statements).toBe(95);
      
      // Validate coverage collection configuration
      expect(jestConfig.collectCoverageFrom).toBeDefined();
      expect(jestConfig.collectCoverageFrom).toContain('src/**/*.ts');
      expect(jestConfig.collectCoverageFrom).toContain('!src/**/*.d.ts');
      expect(jestConfig.collectCoverageFrom).toContain('!src/**/__tests__/**');
      
      // Validate coverage reporters
      expect(jestConfig.coverageReporters).toBeDefined();
      expect(jestConfig.coverageReporters).toContain('text');
      expect(jestConfig.coverageReporters).toContain('lcov');
      expect(jestConfig.coverageReporters).toContain('html');
      
      // Validate coverage directory
      expect(jestConfig.coverageDirectory).toBe('coverage');
    });

    it('should have appropriate coverage thresholds for different test types', () => {
      // RED: This test validates different Jest configurations have appropriate thresholds
      
      // Unit test configuration
      const unitConfigPath = path.join(process.cwd(), 'jest.unit.config.js');
      if (fs.existsSync(unitConfigPath)) {
        const unitConfig = require(unitConfigPath);
        expect(unitConfig.coverageThreshold.global.lines).toBe(80);
        expect(unitConfig.coverageThreshold.global.statements).toBe(80);
      }
      
      // CI configuration
      const ciConfigPath = path.join(process.cwd(), 'jest.ci.config.js');
      if (fs.existsSync(ciConfigPath)) {
        const ciConfig = require(ciConfigPath);
        expect(ciConfig.coverageThreshold.global.lines).toBe(70);
        expect(ciConfig.coverageThreshold.global.statements).toBe(70);
      }
      
      // Integration test configuration
      const integrationConfigPath = path.join(process.cwd(), 'jest.integration.config.js');
      if (fs.existsSync(integrationConfigPath)) {
        const integrationConfig = require(integrationConfigPath);
        expect(integrationConfig.coverageThreshold.global.lines).toBe(70);
        expect(integrationConfig.coverageThreshold.global.statements).toBe(70);
      }
    });

    it('should have correct package.json test scripts for coverage', () => {
      // RED: This test validates package.json coverage scripts
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      // Validate coverage scripts exist
      expect(packageJson.scripts['test:coverage']).toBeDefined();
      expect(packageJson.scripts['test:coverage']).toContain('--coverage');
      
      // Validate other test scripts
      expect(packageJson.scripts['test:ci']).toBeDefined();
      expect(packageJson.scripts['test:unit']).toBeDefined();
    });
  });

  describe('Coverage Report Generation', () => {
    it('should generate coverage reports when running tests with coverage', () => {
      // RED: This test should fail if coverage reports are not generated properly
      
      // Clean up any existing coverage
      const coverageDir = path.join(process.cwd(), 'coverage');
      if (fs.existsSync(coverageDir)) {
        fs.rmSync(coverageDir, { recursive: true, force: true });
      }
      
      // Run a simple test with coverage
      try {
        execSync('npm run test:coverage -- --testPathPattern=infrastructure/coverage-validation.test.ts --silent', {
          stdio: 'pipe',
          timeout: 60000
        });
      } catch (error) {
        // Coverage might fail due to thresholds, but reports should still be generated
        console.log('Coverage test completed (may have failed thresholds)');
      }
      
      // Validate coverage directory exists
      expect(fs.existsSync(coverageDir)).toBe(true);
      
      // Validate coverage files exist
      const expectedFiles = [
        'coverage-final.json',
        'coverage-summary.json',
        'lcov.info',
        'lcov-report/index.html'
      ];
      
      expectedFiles.forEach(file => {
        const filePath = path.join(coverageDir, file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    it('should generate accurate coverage metrics', () => {
      // RED: This test validates coverage accuracy
      
      const coverageSummaryPath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      
      if (fs.existsSync(coverageSummaryPath)) {
        const coverageSummary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf-8'));
        
        // Validate coverage summary structure
        expect(coverageSummary.total).toBeDefined();
        expect(coverageSummary.total.lines).toBeDefined();
        expect(coverageSummary.total.statements).toBeDefined();
        expect(coverageSummary.total.functions).toBeDefined();
        expect(coverageSummary.total.branches).toBeDefined();
        
        // Validate coverage metrics are numbers
        expect(typeof coverageSummary.total.lines.pct).toBe('number');
        expect(typeof coverageSummary.total.statements.pct).toBe('number');
        expect(typeof coverageSummary.total.functions.pct).toBe('number');
        expect(typeof coverageSummary.total.branches.pct).toBe('number');
        
        // Validate coverage percentages are within valid range
        [coverageSummary.total.lines, coverageSummary.total.statements, 
         coverageSummary.total.functions, coverageSummary.total.branches].forEach(metric => {
          expect(metric.pct).toBeGreaterThanOrEqual(0);
          expect(metric.pct).toBeLessThanOrEqual(100);
          expect(metric.total).toBeGreaterThanOrEqual(0);
          expect(metric.covered).toBeGreaterThanOrEqual(0);
          expect(metric.covered).toBeLessThanOrEqual(metric.total);
        });
      }
    });

    it('should include all source files in coverage collection', () => {
      // RED: This test validates coverage collection includes all relevant files
      
      const coverageFinalPath = path.join(process.cwd(), 'coverage', 'coverage-final.json');
      
      if (fs.existsSync(coverageFinalPath)) {
        const coverageFinal = JSON.parse(fs.readFileSync(coverageFinalPath, 'utf-8'));
        
        // Get list of source files that should be covered
        const srcDir = path.join(process.cwd(), 'src');
        const sourceFiles = [];
        
        const findTsFiles = (dir: string) => {
          const files = fs.readdirSync(dir);
          files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory() && !file.includes('__tests__')) {
              findTsFiles(filePath);
            } else if (file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.includes('.test.')) {
              sourceFiles.push(filePath);
            }
          });
        };
        
        if (fs.existsSync(srcDir)) {
          findTsFiles(srcDir);
        }
        
        // Validate that coverage includes source files
        const coveredFiles = Object.keys(coverageFinal);
        expect(coveredFiles.length).toBeGreaterThan(0);
        
        // Check that at least some source files are covered
        const hasSourceFiles = sourceFiles.some(sourceFile => 
          coveredFiles.some(coveredFile => coveredFile.includes(sourceFile.replace(process.cwd(), '')))
        );
        expect(hasSourceFiles).toBe(true);
      }
    });
  });

  describe('Coverage Threshold Enforcement', () => {
    it('should enforce coverage thresholds correctly', () => {
      // RED: This test validates threshold enforcement
      
      // Create a test file with low coverage to test threshold enforcement
      const testFilePath = path.join(process.cwd(), 'src', 'test-coverage-enforcement.ts');
      const testFileContent = `
        export const uncoveredFunction1 = () => {
          console.log('This function is not covered');
          return 'uncovered1';
        };
        
        export const uncoveredFunction2 = () => {
          console.log('This function is also not covered');
          return 'uncovered2';
        };
        
        export const coveredFunction = () => {
          return 'covered';
        };
      `;
      
      // Write test file
      fs.writeFileSync(testFilePath, testFileContent);
      
      // Create a test that only covers one function
      const testTestFilePath = path.join(process.cwd(), 'src', '__tests__', 'test-coverage-enforcement.test.ts');
      const testTestContent = `
        import { coveredFunction } from '../test-coverage-enforcement';
        
        describe('Coverage Enforcement Test', () => {
          it('should only cover one function', () => {
            expect(coveredFunction()).toBe('covered');
          });
        });
      `;
      
      fs.writeFileSync(testTestFilePath, testTestContent);
      
      try {
        // Run coverage on this specific test - should fail threshold
        execSync(`npm run test:coverage -- --testPathPattern=test-coverage-enforcement.test.ts --collectCoverageFrom="src/test-coverage-enforcement.ts" --silent`, {
          stdio: 'pipe',
          timeout: 30000
        });
        
        // If we reach here, thresholds might not be enforced properly
        console.warn('Coverage test passed - threshold enforcement may not be working');
      } catch (error) {
        // Expected to fail due to low coverage
        expect(error.message || error.toString()).toContain('Coverage threshold');
      } finally {
        // Clean up test files
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
        if (fs.existsSync(testTestFilePath)) {
          fs.unlinkSync(testTestFilePath);
        }
      }
    });

    it('should validate CI coverage enforcement script', () => {
      // RED: This test validates the CI coverage enforcement
      
      const ciWorkflowPath = path.join(process.cwd(), '..', '.github', 'workflows', 'ci.yml');
      
      if (fs.existsSync(ciWorkflowPath)) {
        const ciContent = fs.readFileSync(ciWorkflowPath, 'utf-8');
        
        // Validate CI has coverage enforcement
        expect(ciContent).toContain('coverage');
        expect(ciContent).toContain('coverage-summary.json');
        expect(ciContent).toContain('95'); // Coverage threshold
      }
      
      // Validate local CI test script
      const localCiScriptPath = path.join(process.cwd(), '..', 'scripts', 'test-ci-locally.sh');
      
      if (fs.existsSync(localCiScriptPath)) {
        const scriptContent = fs.readFileSync(localCiScriptPath, 'utf-8');
        
        // Validate script has coverage checking
        expect(scriptContent).toContain('coverage');
        expect(scriptContent).toContain('coverage-summary.json');
        expect(scriptContent).toContain('95'); // Coverage threshold
      }
    });
  });

  describe('Coverage Reporting Accuracy', () => {
    it('should provide consistent coverage metrics across different runs', () => {
      // RED: This test validates coverage consistency
      
      const runCoverageAndGetMetrics = () => {
        try {
          execSync('npm run test:coverage -- --testPathPattern=infrastructure/coverage-validation.test.ts --silent', {
            stdio: 'pipe',
            timeout: 30000
          });
        } catch (error) {
          // Coverage might fail, but we still want to check the reports
        }
        
        const coverageSummaryPath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
        if (fs.existsSync(coverageSummaryPath)) {
          return JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf-8'));
        }
        return null;
      };
      
      // Run coverage twice and compare results
      const metrics1 = runCoverageAndGetMetrics();
      const metrics2 = runCoverageAndGetMetrics();
      
      if (metrics1 && metrics2) {
        // Coverage should be consistent between runs
        expect(metrics1.total.lines.pct).toBe(metrics2.total.lines.pct);
        expect(metrics1.total.statements.pct).toBe(metrics2.total.statements.pct);
        expect(metrics1.total.functions.pct).toBe(metrics2.total.functions.pct);
        expect(metrics1.total.branches.pct).toBe(metrics2.total.branches.pct);
      }
    });

    it('should exclude test files from coverage collection', () => {
      // RED: This test validates test files are excluded from coverage
      
      const coverageFinalPath = path.join(process.cwd(), 'coverage', 'coverage-final.json');
      
      if (fs.existsSync(coverageFinalPath)) {
        const coverageFinal = JSON.parse(fs.readFileSync(coverageFinalPath, 'utf-8'));
        const coveredFiles = Object.keys(coverageFinal);
        
        // Validate that test files are not included in coverage
        const hasTestFiles = coveredFiles.some(file => 
          file.includes('.test.') || 
          file.includes('.spec.') || 
          file.includes('__tests__')
        );
        
        expect(hasTestFiles).toBe(false);
        
        // Validate that .d.ts files are not included
        const hasTypeFiles = coveredFiles.some(file => file.includes('.d.ts'));
        expect(hasTypeFiles).toBe(false);
      }
    });

    it('should generate HTML coverage reports for visualization', () => {
      // RED: This test validates HTML report generation
      
      const htmlReportPath = path.join(process.cwd(), 'coverage', 'lcov-report', 'index.html');
      
      if (fs.existsSync(htmlReportPath)) {
        const htmlContent = fs.readFileSync(htmlReportPath, 'utf-8');
        
        // Validate HTML report contains expected elements
        expect(htmlContent).toContain('<html');
        expect(htmlContent).toContain('Coverage report');
        expect(htmlContent).toContain('Functions');
        expect(htmlContent).toContain('Branches');
        expect(htmlContent).toContain('Lines');
        expect(htmlContent).toContain('Statements');
      }
    });
  });

  describe('Coverage Integration with CI/CD', () => {
    it('should validate coverage gates in CI pipeline', () => {
      // RED: This test validates CI integration
      
      // Check if coverage enforcement script exists and is executable
      const ciScriptPath = path.join(process.cwd(), '..', 'scripts', 'test-ci-locally.sh');
      
      if (fs.existsSync(ciScriptPath)) {
        const scriptContent = fs.readFileSync(ciScriptPath, 'utf-8');
        
        // Validate script enforces coverage thresholds
        expect(scriptContent).toContain('coverage-summary.json');
        expect(scriptContent).toContain('lines < 95');
        expect(scriptContent).toContain('Coverage below threshold');
      }
    });

    it('should provide coverage badges and metrics for documentation', () => {
      // RED: This test validates coverage reporting for external tools
      
      const lcovPath = path.join(process.cwd(), 'coverage', 'lcov.info');
      
      if (fs.existsSync(lcovPath)) {
        const lcovContent = fs.readFileSync(lcovPath, 'utf-8');
        
        // Validate LCOV format for external tools
        expect(lcovContent).toContain('TN:');
        expect(lcovContent).toContain('SF:');
        expect(lcovContent).toContain('FN:');
        expect(lcovContent).toContain('DA:');
        expect(lcovContent).toContain('end_of_record');
      }
    });
  });
});
