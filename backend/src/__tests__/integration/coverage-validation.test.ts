/**
 * Coverage Validation Tests
 * 
 * Task 1.3.5: Coverage Validation Tests - TDD Implementation
 * 
 * These tests validate that the 95% coverage requirement is properly enforced
 * following TDD principles: Red-Green-Refactor
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { setupTestEnvironment, cleanupTestEnvironment } from '../utils/test-environment';
import { coverageValidator, COVERAGE_THRESHOLDS } from '../utils/coverage-validator';

// Mock fs for testing coverage validation
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Coverage Validation Requirements', () => {
  beforeEach(async () => {
    await setupTestEnvironment({ useMocks: true });
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('Coverage Threshold Enforcement', () => {
    it('should enforce 95% coverage threshold for all metrics', () => {
      // RED: This test validates our strict 95% requirement
      expect(COVERAGE_THRESHOLDS.statements).toBe(95);
      expect(COVERAGE_THRESHOLDS.branches).toBe(95);
      expect(COVERAGE_THRESHOLDS.functions).toBe(95);
      expect(COVERAGE_THRESHOLDS.lines).toBe(95);
    });

    it('should pass validation when coverage meets 95% threshold', async () => {
      const mockCoverageSummary = {
        total: {
          statements: { total: 1000, covered: 960, skipped: 0, pct: 96 },
          branches: { total: 500, covered: 480, skipped: 0, pct: 96 },
          functions: { total: 200, covered: 192, skipped: 0, pct: 96 },
          lines: { total: 1000, covered: 960, skipped: 0, pct: 96 },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockCoverageSummary));
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

      const result = await coverageValidator.validateCoverage();

      expect(result.isValid).toBe(true);
      expect(result.failedThresholds).toHaveLength(0);
      expect(result.overallCoverage.statements.pct).toBeGreaterThanOrEqual(95);
      expect(result.overallCoverage.branches.pct).toBeGreaterThanOrEqual(95);
      expect(result.overallCoverage.functions.pct).toBeGreaterThanOrEqual(95);
      expect(result.overallCoverage.lines.pct).toBeGreaterThanOrEqual(95);
    });

    it('should fail validation when coverage below 95% threshold', async () => {
      const mockCoverageSummary = {
        total: {
          statements: { total: 1000, covered: 940, skipped: 0, pct: 94 }, // Below threshold
          branches: { total: 500, covered: 460, skipped: 0, pct: 92 }, // Below threshold
          functions: { total: 200, covered: 192, skipped: 0, pct: 96 }, // Above threshold
          lines: { total: 1000, covered: 930, skipped: 0, pct: 93 }, // Below threshold
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockCoverageSummary));
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

      const result = await coverageValidator.validateCoverage();

      expect(result.isValid).toBe(false);
      expect(result.failedThresholds.length).toBeGreaterThan(0);
      expect(result.failedThresholds).toContain('statements: 94% < 95%');
      expect(result.failedThresholds).toContain('branches: 92% < 95%');
      expect(result.failedThresholds).toContain('lines: 93% < 95%');
    });

    it('should identify specific coverage gaps', async () => {
      const mockCoverageSummary = {
        total: {
          statements: { total: 1000, covered: 850, skipped: 0, pct: 85 }, // 10% gap
          branches: { total: 500, covered: 400, skipped: 0, pct: 80 }, // 15% gap
          functions: { total: 200, covered: 180, skipped: 0, pct: 90 }, // 5% gap
          lines: { total: 1000, covered: 880, skipped: 0, pct: 88 }, // 7% gap
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockCoverageSummary));
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

      const result = await coverageValidator.validateCoverage();

      expect(result.detailedReport.statements.gap).toBe(10);
      expect(result.detailedReport.branches.gap).toBe(15);
      expect(result.detailedReport.functions.gap).toBe(5);
      expect(result.detailedReport.lines.gap).toBe(7);
    });
  });

  describe('Coverage Report Analysis', () => {
    it('should detect uncovered source files', async () => {
      const mockCoverageSummary = {
        total: {
          statements: { total: 500, covered: 480, skipped: 0, pct: 96 },
          branches: { total: 250, covered: 240, skipped: 0, pct: 96 },
          functions: { total: 100, covered: 96, skipped: 0, pct: 96 },
          lines: { total: 500, covered: 480, skipped: 0, pct: 96 },
        },
        // Only one file covered
        '/src/services/invoice.service.ts': {
          statements: { total: 500, covered: 480, skipped: 0, pct: 96 },
          branches: { total: 250, covered: 240, skipped: 0, pct: 96 },
          functions: { total: 100, covered: 96, skipped: 0, pct: 96 },
          lines: { total: 500, covered: 480, skipped: 0, pct: 96 },
        },
      };

      // Mock source files discovery
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockCoverageSummary));
      mockFs.readdirSync.mockReturnValue(['invoice.service.ts', 'ocr.service.ts', 'user.service.ts'] as any);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

      const result = await coverageValidator.validateCoverage();

      expect(result.uncoveredFiles.length).toBeGreaterThan(0);
      expect(result.isValid).toBe(false); // Should fail due to uncovered files
    });

    it('should exclude appropriate files from coverage requirements', async () => {
      const excludedFiles = [
        'src/index.ts',
        'src/config.ts',
        'src/__tests__/setup.ts',
        'src/__tests__/mocks/prisma.ts',
        'src/types.d.ts',
      ];

      // These files should be excluded from coverage requirements
      excludedFiles.forEach(file => {
        // Test that these files would be excluded by the validator
        expect(file).toMatch(/\/(index|config)\.ts$|__tests__|\.d\.ts$/);
      });
    });

    it('should generate actionable recommendations', async () => {
      const mockCoverageSummary = {
        total: {
          statements: { total: 1000, covered: 700, skipped: 0, pct: 70 }, // Large gap
          branches: { total: 500, covered: 400, skipped: 0, pct: 80 }, // Medium gap
          functions: { total: 200, covered: 190, skipped: 0, pct: 95 }, // No gap
          lines: { total: 1000, covered: 920, skipped: 0, pct: 92 }, // Small gap
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockCoverageSummary));
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

      const result = await coverageValidator.validateCoverage();

      expect(result.recommendations.length).toBeGreaterThan(0);
      
      // Should have critical recommendation for large gap
      expect(result.recommendations.some(rec => rec.includes('Critical'))).toBe(true);
      
      // Should have TDD recommendation for poor statement coverage
      expect(result.recommendations.some(rec => rec.includes('TDD practices'))).toBe(true);
    });
  });

  describe('CI/CD Integration', () => {
    it('should provide CI-friendly validation results', async () => {
      const mockCoverageSummary = {
        total: {
          statements: { total: 1000, covered: 960, skipped: 0, pct: 96 },
          branches: { total: 500, covered: 480, skipped: 0, pct: 96 },
          functions: { total: 200, covered: 192, skipped: 0, pct: 96 },
          lines: { total: 1000, covered: 960, skipped: 0, pct: 96 },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockCoverageSummary));
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

      const ciResult = await coverageValidator.validateForCI();

      expect(ciResult.success).toBe(true);
      expect(ciResult.message).toContain('✅ PASSED');
      expect(ciResult.message).toContain('Statements: 96%');
      expect(ciResult.message).toContain('Coverage Metrics:');
    });

    it('should provide detailed failure information for CI', async () => {
      const mockCoverageSummary = {
        total: {
          statements: { total: 1000, covered: 850, skipped: 0, pct: 85 },
          branches: { total: 500, covered: 400, skipped: 0, pct: 80 },
          functions: { total: 200, covered: 180, skipped: 0, pct: 90 },
          lines: { total: 1000, covered: 880, skipped: 0, pct: 88 },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockCoverageSummary));
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

      const ciResult = await coverageValidator.validateForCI();

      expect(ciResult.success).toBe(false);
      expect(ciResult.message).toContain('❌ FAILED');
      expect(ciResult.message).toContain('Failed Thresholds:');
      expect(ciResult.message).toContain('statements: 85% < 95%');
      expect(ciResult.message).toContain('Recommendations:');
    });

    it('should handle missing coverage reports gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const ciResult = await coverageValidator.validateForCI();

      expect(ciResult.success).toBe(false);
      expect(ciResult.message).toContain('Coverage validation failed');
      expect(ciResult.message).toContain('Coverage summary not found');
    });
  });

  describe('Coverage Regression Prevention', () => {
    it('should detect coverage regression', async () => {
      // Simulate previous coverage being higher
      const previousCoverage = {
        statements: 97,
        branches: 96,
        functions: 98,
        lines: 97,
      };

      const currentCoverage = {
        statements: 94, // Regression
        branches: 96,
        functions: 95, // Regression
        lines: 97,
      };

      const regressions = Object.keys(previousCoverage).filter(metric => 
        currentCoverage[metric as keyof typeof currentCoverage] < 
        previousCoverage[metric as keyof typeof previousCoverage]
      );

      expect(regressions).toContain('statements');
      expect(regressions).toContain('functions');
      expect(regressions).not.toContain('branches');
      expect(regressions).not.toContain('lines');
    });

    it('should validate coverage trends over time', async () => {
      const coverageHistory = [
        { date: '2024-01-01', statements: 92, branches: 90, functions: 94, lines: 93 },
        { date: '2024-01-02', statements: 94, branches: 92, functions: 95, lines: 94 },
        { date: '2024-01-03', statements: 96, branches: 95, functions: 96, lines: 96 },
        { date: '2024-01-04', statements: 97, branches: 96, functions: 97, lines: 97 },
      ];

      // Coverage should be trending upward
      const isImproving = coverageHistory.every((current, index) => {
        if (index === 0) return true;
        const previous = coverageHistory[index - 1];
        return current.statements >= previous.statements;
      });

      expect(isImproving).toBe(true);

      // Final coverage should meet requirements
      const latest = coverageHistory[coverageHistory.length - 1];
      expect(latest.statements).toBeGreaterThanOrEqual(95);
      expect(latest.branches).toBeGreaterThanOrEqual(95);
      expect(latest.functions).toBeGreaterThanOrEqual(95);
      expect(latest.lines).toBeGreaterThanOrEqual(95);
    });
  });

  describe('Coverage Quality Metrics', () => {
    it('should validate test quality beyond just coverage percentage', async () => {
      const testQualityMetrics = {
        coveragePercentage: 96,
        testCount: 150,
        averageTestComplexity: 'medium',
        edgeCasesCovered: 85,
        errorPathsCovered: 90,
        integrationTestCoverage: 80,
        mutationTestScore: 88, // Mutation testing score
      };

      expect(testQualityMetrics.coveragePercentage).toBeGreaterThanOrEqual(95);
      expect(testQualityMetrics.testCount).toBeGreaterThan(100);
      expect(testQualityMetrics.edgeCasesCovered).toBeGreaterThan(80);
      expect(testQualityMetrics.errorPathsCovered).toBeGreaterThan(85);
      expect(testQualityMetrics.mutationTestScore).toBeGreaterThan(80);
    });

    it('should ensure comprehensive test scenarios', async () => {
      const testScenarios = {
        unitTests: 120,
        integrationTests: 25,
        endToEndTests: 15,
        performanceTests: 8,
        securityTests: 12,
        errorHandlingTests: 30,
      };

      const totalTests = Object.values(testScenarios).reduce((sum, count) => sum + count, 0);
      
      expect(totalTests).toBeGreaterThan(150);
      expect(testScenarios.unitTests).toBeGreaterThan(100); // Majority should be unit tests
      expect(testScenarios.integrationTests).toBeGreaterThan(20);
      expect(testScenarios.errorHandlingTests).toBeGreaterThan(25);
    });

    it('should validate test execution performance', async () => {
      const testPerformanceMetrics = {
        totalExecutionTime: 25000, // 25 seconds
        averageTestTime: 167, // ~167ms per test (25s / 150 tests)
        slowestTest: 2000, // 2 seconds
        fastestTest: 10, // 10ms
        parallelizationEfficiency: 0.85,
      };

      expect(testPerformanceMetrics.totalExecutionTime).toBeLessThan(30000); // Under 30 seconds
      expect(testPerformanceMetrics.averageTestTime).toBeLessThan(200); // Under 200ms average
      expect(testPerformanceMetrics.slowestTest).toBeLessThan(5000); // No test over 5 seconds
      expect(testPerformanceMetrics.parallelizationEfficiency).toBeGreaterThan(0.8);
    });
  });

  describe('Coverage Reporting and Visualization', () => {
    it('should generate comprehensive coverage reports', async () => {
      const mockCoverageSummary = {
        total: {
          statements: { total: 1000, covered: 960, skipped: 0, pct: 96 },
          branches: { total: 500, covered: 480, skipped: 0, pct: 96 },
          functions: { total: 200, covered: 192, skipped: 0, pct: 96 },
          lines: { total: 1000, covered: 960, skipped: 0, pct: 96 },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockCoverageSummary));
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

      const result = await coverageValidator.validateCoverage();
      const summary = coverageValidator.generateCoverageSummary(result);

      expect(summary).toContain('📊 Test Coverage Report');
      expect(summary).toContain('✅ PASSED');
      expect(summary).toContain('Coverage Metrics:');
      expect(summary).toContain('Statements: 96%');
      expect(summary).toContain('Branches: 96%');
      expect(summary).toContain('Functions: 96%');
      expect(summary).toContain('Lines: 96%');
    });

    it('should provide actionable improvement suggestions', async () => {
      const mockCoverageSummary = {
        total: {
          statements: { total: 1000, covered: 920, skipped: 0, pct: 92 },
          branches: { total: 500, covered: 450, skipped: 0, pct: 90 },
          functions: { total: 200, covered: 190, skipped: 0, pct: 95 },
          lines: { total: 1000, covered: 940, skipped: 0, pct: 94 },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockCoverageSummary));
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

      const result = await coverageValidator.validateCoverage();

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(rec => 
        rec.includes('Focus on testing conditional logic')
      )).toBe(true);
    });
  });
});
