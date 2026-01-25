// @ts-nocheck
/**
 * Test Coverage Validation Utility
 *
 * Task 1.1.5: Test Coverage Validation - TDD Implementation
 *
 * This utility validates test coverage accuracy and enforces 95% threshold
 * following TDD principles.
 */

import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// Coverage thresholds for TDD compliance
export const COVERAGE_THRESHOLDS = {
  statements: 95,
  branches: 95,
  functions: 95,
  lines: 95,
} as const;

// Coverage report interfaces
interface CoverageReport {
  total: CoverageSummary;
  [filePath: string]: CoverageSummary;
}

interface CoverageSummary {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

// Coverage validation results
interface CoverageValidationResult {
  isValid: boolean;
  overallCoverage: CoverageSummary;
  failedThresholds: string[];
  uncoveredFiles: string[];
  recommendations: string[];
  detailedReport: {
    [metric: string]: {
      current: number;
      required: number;
      gap: number;
    };
  };
}

export class CoverageValidator {
  private coverageDir: string;
  private sourceDir: string;

  constructor(coverageDir = 'coverage', sourceDir = 'src') {
    this.coverageDir = path.resolve(coverageDir);
    this.sourceDir = path.resolve(sourceDir);
  }

  /**
   * Validate test coverage against TDD thresholds
   * RED: Write failing test first to validate coverage requirements
   */
  async validateCoverage(): Promise<CoverageValidationResult> {
    try {
      const coverageReport = await this.loadCoverageReport();
      const sourceFiles = await this.getSourceFiles();
      
      return this.analyzeCoverage(coverageReport, sourceFiles);
    } catch (error) {
      throw new Error(`Coverage validation failed: ${error.message}`);
    }
  }

  /**
   * Load coverage report from Jest output
   * GREEN: Implement minimal coverage loading to pass tests
   */
  private async loadCoverageReport(): Promise<CoverageReport> {
    const summaryPath = path.join(this.coverageDir, 'coverage-summary.json');
    
    if (!fs.existsSync(summaryPath)) {
      throw new Error(`Coverage summary not found at ${summaryPath}`);
    }

    const summaryContent = fs.readFileSync(summaryPath, 'utf-8');
    return JSON.parse(summaryContent) as CoverageReport;
  }

  /**
   * Get all source files that should be covered
   * GREEN: Implement source file discovery
   */
  private async getSourceFiles(): Promise<string[]> {
    const sourceFiles: string[] = [];
    
    const walkDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !file.startsWith('.') && file !== '__tests__') {
          walkDir(filePath);
        } else if (file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.includes('.test.')) {
          sourceFiles.push(filePath);
        }
      }
    };

    if (fs.existsSync(this.sourceDir)) {
      walkDir(this.sourceDir);
    }

    return sourceFiles;
  }

  /**
   * Analyze coverage data against thresholds
   * REFACTOR: Improve analysis logic for better insights
   */
  private analyzeCoverage(
    coverageReport: CoverageReport, 
    sourceFiles: string[]
  ): CoverageValidationResult {
    const { total } = coverageReport;
    const failedThresholds: string[] = [];
    const uncoveredFiles: string[] = [];
    const recommendations: string[] = [];

    // Check each coverage metric against thresholds
    const detailedReport: CoverageValidationResult['detailedReport'] = {};

    for (const [metric, threshold] of Object.entries(COVERAGE_THRESHOLDS)) {
      const current = total[metric as keyof CoverageSummary]?.pct || 0;
      const gap = threshold - current;

      detailedReport[metric] = {
        current,
        required: threshold,
        gap: Math.max(0, gap),
      };

      if (current < threshold) {
        failedThresholds.push(`${metric}: ${current}% < ${threshold}%`);
      }
    }

    // Identify uncovered files
    const coveredFiles = Object.keys(coverageReport).filter(key => key !== 'total');
    const relativeCoveredFiles = coveredFiles.map(file => path.resolve(file));
    
    for (const sourceFile of sourceFiles) {
      const isExcluded = this.isFileExcluded(sourceFile);
      if (!isExcluded && !relativeCoveredFiles.some(covered => 
        path.resolve(covered) === path.resolve(sourceFile)
      )) {
        uncoveredFiles.push(sourceFile);
      }
    }

    // Generate recommendations
    recommendations.push(...this.generateRecommendations(detailedReport, uncoveredFiles));

    return {
      isValid: failedThresholds.length === 0 && uncoveredFiles.length === 0,
      overallCoverage: total,
      failedThresholds,
      uncoveredFiles,
      recommendations,
      detailedReport,
    };
  }

  /**
   * Check if file should be excluded from coverage
   */
  private isFileExcluded(filePath: string): boolean {
    const excludePatterns = [
      /\/index\.ts$/,
      /\/config\.ts$/,
      /\/__tests__\//,
      /\/mocks?\//,
      /\/fixtures?\//,
      /\.d\.ts$/,
      /\.test\.ts$/,
      /\.spec\.ts$/,
    ];

    return excludePatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Generate actionable recommendations for improving coverage
   */
  private generateRecommendations(
    detailedReport: CoverageValidationResult['detailedReport'],
    uncoveredFiles: string[]
  ): string[] {
    const recommendations: string[] = [];

    // Coverage gap recommendations
    for (const [metric, data] of Object.entries(detailedReport)) {
      if (data.gap > 0) {
        if (data.gap > 20) {
          recommendations.push(
            `Critical: ${metric} coverage is ${data.gap.toFixed(1)}% below threshold. ` +
            `Focus on comprehensive test coverage for core functionality.`
          );
        } else if (data.gap > 10) {
          recommendations.push(
            `High: ${metric} coverage needs ${data.gap.toFixed(1)}% improvement. ` +
            `Add tests for edge cases and error handling.`
          );
        } else {
          recommendations.push(
            `Medium: ${metric} coverage needs ${data.gap.toFixed(1)}% improvement. ` +
            `Add tests for remaining uncovered code paths.`
          );
        }
      }
    }

    // Uncovered files recommendations
    if (uncoveredFiles.length > 0) {
      recommendations.push(
        `${uncoveredFiles.length} files have no test coverage. ` +
        `Priority files: ${uncoveredFiles.slice(0, 3).map(f => path.basename(f)).join(', ')}`
      );
    }

    // TDD process recommendations
    if (detailedReport.statements.gap > 5) {
      recommendations.push(
        'Consider implementing stricter TDD practices: write tests before implementation.'
      );
    }

    if (detailedReport.branches.gap > 10) {
      recommendations.push(
        'Focus on testing conditional logic and error handling paths.'
      );
    }

    if (detailedReport.functions.gap > 5) {
      recommendations.push(
        'Ensure all public functions have corresponding unit tests.'
      );
    }

    return recommendations;
  }

  /**
   * Generate coverage report summary for CI/CD
   */
  generateCoverageSummary(result: CoverageValidationResult): string {
    const { overallCoverage, isValid, failedThresholds } = result;
    
    let summary = '📊 Test Coverage Report\n\n';
    
    summary += `Overall Status: ${isValid ? '✅ PASSED' : '❌ FAILED'}\n\n`;
    
    summary += 'Coverage Metrics:\n';
    summary += `• Statements: ${overallCoverage.statements.pct}%\n`;
    summary += `• Branches: ${overallCoverage.branches.pct}%\n`;
    summary += `• Functions: ${overallCoverage.functions.pct}%\n`;
    summary += `• Lines: ${overallCoverage.lines.pct}%\n\n`;
    
    if (failedThresholds.length > 0) {
      summary += 'Failed Thresholds:\n';
      failedThresholds.forEach(threshold => {
        summary += `• ${threshold}\n`;
      });
      summary += '\n';
    }
    
    if (result.recommendations.length > 0) {
      summary += 'Recommendations:\n';
      result.recommendations.slice(0, 3).forEach(rec => {
        summary += `• ${rec}\n`;
      });
    }
    
    return summary;
  }

  /**
   * Validate coverage in CI environment
   */
  async validateForCI(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.validateCoverage();
      const summary = this.generateCoverageSummary(result);
      
      return {
        success: result.isValid,
        message: summary,
      };
    } catch (error) {
      return {
        success: false,
        message: `Coverage validation failed: ${error.message}`,
      };
    }
  }
}

// Export singleton instance
export const coverageValidator = new CoverageValidator();

// Export utility functions
export const validateCoverage = () => coverageValidator.validateCoverage();
export const validateCoverageForCI = () => coverageValidator.validateForCI();

// Export for Jest configuration
export default coverageValidator;
