// @ts-nocheck
/**
 * Coverage Helper Utilities
 *
 * Task 1.1.5: Validate test coverage reporting accuracy
 * GREEN phase: Provide utilities for coverage validation and reporting
 * 
 * These utilities help ensure accurate coverage reporting:
 * - Coverage threshold validation
 * - Coverage report parsing and analysis
 * - Coverage quality metrics
 * - CI/CD integration helpers
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface CoverageMetrics {
  lines: { total: number; covered: number; pct: number };
  statements: { total: number; covered: number; pct: number };
  functions: { total: number; covered: number; pct: number };
  branches: { total: number; covered: number; pct: number };
}

export interface CoverageSummary {
  total: CoverageMetrics;
  [filePath: string]: CoverageMetrics;
}

export interface CoverageThresholds {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
}

/**
 * Coverage report parsing and validation utilities
 */
export class CoverageValidator {
  private coverageDir: string;
  
  constructor(coverageDir: string = 'coverage') {
    this.coverageDir = path.resolve(coverageDir);
  }

  /**
   * Parse coverage summary from JSON file
   */
  parseCoverageSummary(): CoverageSummary | null {
    const summaryPath = path.join(this.coverageDir, 'coverage-summary.json');
    
    if (!fs.existsSync(summaryPath)) {
      return null;
    }
    
    try {
      const content = fs.readFileSync(summaryPath, 'utf-8');
      return JSON.parse(content) as CoverageSummary;
    } catch (error) {
      console.error('Failed to parse coverage summary:', error);
      return null;
    }
  }

  /**
   * Validate coverage meets specified thresholds
   */
  validateThresholds(thresholds: CoverageThresholds): {
    passed: boolean;
    failures: string[];
    metrics: CoverageMetrics | null;
  } {
    const summary = this.parseCoverageSummary();
    
    if (!summary) {
      return {
        passed: false,
        failures: ['Coverage summary not found'],
        metrics: null
      };
    }

    const failures: string[] = [];
    const metrics = summary.total;

    // Check each threshold
    Object.entries(thresholds).forEach(([metric, threshold]) => {
      const actualValue = metrics[metric as keyof CoverageMetrics].pct;
      if (actualValue < threshold) {
        failures.push(`${metric}: ${actualValue}% < ${threshold}%`);
      }
    });

    return {
      passed: failures.length === 0,
      failures,
      metrics
    };
  }

  /**
   * Get coverage for specific files or directories
   */
  getFileCoverage(pattern?: string): { [filePath: string]: CoverageMetrics } {
    const summary = this.parseCoverageSummary();
    
    if (!summary) {
      return {};
    }

    const fileCoverage: { [filePath: string]: CoverageMetrics } = {};
    
    Object.entries(summary).forEach(([filePath, metrics]) => {
      if (filePath === 'total') return;
      
      if (!pattern || filePath.includes(pattern)) {
        fileCoverage[filePath] = metrics;
      }
    });

    return fileCoverage;
  }

  /**
   * Generate coverage quality report
   */
  generateQualityReport(): {
    overall: 'excellent' | 'good' | 'fair' | 'poor';
    recommendations: string[];
    metrics: CoverageMetrics | null;
  } {
    const summary = this.parseCoverageSummary();
    
    if (!summary) {
      return {
        overall: 'poor',
        recommendations: ['Generate coverage report first'],
        metrics: null
      };
    }

    const metrics = summary.total;
    const avgCoverage = (metrics.lines.pct + metrics.statements.pct + 
                        metrics.functions.pct + metrics.branches.pct) / 4;

    let overall: 'excellent' | 'good' | 'fair' | 'poor';
    const recommendations: string[] = [];

    if (avgCoverage >= 95) {
      overall = 'excellent';
    } else if (avgCoverage >= 85) {
      overall = 'good';
      recommendations.push('Consider increasing coverage to 95% for excellent rating');
    } else if (avgCoverage >= 70) {
      overall = 'fair';
      recommendations.push('Increase test coverage to at least 85%');
    } else {
      overall = 'poor';
      recommendations.push('Critical: Test coverage is below 70%');
    }

    // Specific recommendations
    if (metrics.branches.pct < 90) {
      recommendations.push('Focus on branch coverage - add tests for conditional logic');
    }
    
    if (metrics.functions.pct < 95) {
      recommendations.push('Ensure all functions have test coverage');
    }
    
    if (metrics.lines.pct < 95) {
      recommendations.push('Add tests to cover more lines of code');
    }

    return { overall, recommendations, metrics };
  }

  /**
   * Check if coverage reports exist and are valid
   */
  validateReportFiles(): { valid: boolean; missingFiles: string[] } {
    const expectedFiles = [
      'coverage-summary.json',
      'coverage-final.json',
      'lcov.info',
      'lcov-report/index.html'
    ];

    const missingFiles: string[] = [];

    expectedFiles.forEach(file => {
      const filePath = path.join(this.coverageDir, file);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
      }
    });

    return {
      valid: missingFiles.length === 0,
      missingFiles
    };
  }
}

/**
 * Coverage configuration validation utilities
 */
export class CoverageConfigValidator {
  /**
   * Validate Jest configuration has proper coverage setup
   */
  static validateJestConfig(configPath: string): {
    valid: boolean;
    issues: string[];
    config: any;
  } {
    const issues: string[] = [];
    
    if (!fs.existsSync(configPath)) {
      return {
        valid: false,
        issues: [`Jest config file not found: ${configPath}`],
        config: null
      };
    }

    let config: any;
    try {
      config = require(configPath);
    } catch (error) {
      return {
        valid: false,
        issues: [`Failed to load Jest config: ${error.message}`],
        config: null
      };
    }

    // Check coverage configuration
    if (!config.coverageDirectory) {
      issues.push('Missing coverageDirectory configuration');
    }

    if (!config.coverageReporters || !Array.isArray(config.coverageReporters)) {
      issues.push('Missing or invalid coverageReporters configuration');
    } else {
      const requiredReporters = ['text', 'lcov', 'html'];
      requiredReporters.forEach(reporter => {
        if (!config.coverageReporters.includes(reporter)) {
          issues.push(`Missing required coverage reporter: ${reporter}`);
        }
      });
    }

    if (!config.collectCoverageFrom || !Array.isArray(config.collectCoverageFrom)) {
      issues.push('Missing or invalid collectCoverageFrom configuration');
    }

    if (!config.coverageThreshold || !config.coverageThreshold.global) {
      issues.push('Missing coverage threshold configuration');
    } else {
      const thresholds = config.coverageThreshold.global;
      const requiredMetrics = ['lines', 'statements', 'functions', 'branches'];
      
      requiredMetrics.forEach(metric => {
        if (typeof thresholds[metric] !== 'number') {
          issues.push(`Missing or invalid threshold for ${metric}`);
        }
      });
    }

    return {
      valid: issues.length === 0,
      issues,
      config
    };
  }

  /**
   * Validate package.json has proper test scripts
   */
  static validatePackageJsonScripts(packageJsonPath: string): {
    valid: boolean;
    issues: string[];
    scripts: any;
  } {
    const issues: string[] = [];
    
    if (!fs.existsSync(packageJsonPath)) {
      return {
        valid: false,
        issues: [`package.json not found: ${packageJsonPath}`],
        scripts: null
      };
    }

    let packageJson: any;
    try {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    } catch (error) {
      return {
        valid: false,
        issues: [`Failed to parse package.json: ${error.message}`],
        scripts: null
      };
    }

    const scripts = packageJson.scripts || {};

    // Check required scripts
    if (!scripts['test:coverage']) {
      issues.push('Missing test:coverage script');
    } else if (!scripts['test:coverage'].includes('--coverage')) {
      issues.push('test:coverage script does not include --coverage flag');
    }

    if (!scripts['test']) {
      issues.push('Missing test script');
    }

    return {
      valid: issues.length === 0,
      issues,
      scripts
    };
  }
}

/**
 * CI/CD integration utilities
 */
export class CoverageCIHelper {
  /**
   * Generate coverage badge data
   */
  static generateBadgeData(metrics: CoverageMetrics): {
    color: string;
    message: string;
    percentage: number;
  } {
    const percentage = Math.round(metrics.lines.pct);
    let color: string;

    if (percentage >= 95) {
      color = 'brightgreen';
    } else if (percentage >= 85) {
      color = 'green';
    } else if (percentage >= 70) {
      color = 'yellow';
    } else if (percentage >= 50) {
      color = 'orange';
    } else {
      color = 'red';
    }

    return {
      color,
      message: `${percentage}%`,
      percentage
    };
  }

  /**
   * Check if coverage meets CI requirements
   */
  static checkCIRequirements(
    coverageDir: string,
    requiredThreshold: number = 95
  ): {
    passed: boolean;
    message: string;
    exitCode: number;
  } {
    const validator = new CoverageValidator(coverageDir);
    const summary = validator.parseCoverageSummary();

    if (!summary) {
      return {
        passed: false,
        message: 'Coverage report not found',
        exitCode: 1
      };
    }

    const linesCoverage = summary.total.lines.pct;

    if (linesCoverage < requiredThreshold) {
      return {
        passed: false,
        message: `Coverage ${linesCoverage}% below threshold ${requiredThreshold}%`,
        exitCode: 1
      };
    }

    return {
      passed: true,
      message: `Coverage ${linesCoverage}% meets threshold ${requiredThreshold}%`,
      exitCode: 0
    };
  }
}

/**
 * Export all utilities
 */
export const CoverageHelpers = {
  CoverageValidator,
  CoverageConfigValidator,
  CoverageCIHelper,
};

export default CoverageHelpers;
