/**
 * Assertion Method Fixer Utility
 * 
 * TDD Phase: GREEN - Tool to identify and fix assertion method issues
 * Task: 1.1.3 - Fix assertion methods (toContain → toContainEqual)
 * 
 * This utility helps identify and fix incorrect assertion usage patterns
 * in the test codebase.
 */

import * as fs from 'fs';
import * as path from 'path';

interface AssertionIssue {
  file: string;
  line: number;
  content: string;
  issue: string;
  suggestion: string;
}

/**
 * Scans test files for incorrect assertion usage
 */
export const scanForAssertionIssues = (testDir: string): AssertionIssue[] => {
  const issues: AssertionIssue[] = [];
  
  const scanFile = (filePath: string) => {
    if (!filePath.endsWith('.test.ts') && !filePath.endsWith('.test.js')) {
      return;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();
        
        // Look for toContain usage with object-like patterns
        if (trimmedLine.includes('.toContain({')) {
          issues.push({
            file: filePath,
            line: lineNumber,
            content: trimmedLine,
            issue: 'Using toContain with object literal - should use toContainEqual',
            suggestion: trimmedLine.replace('.toContain(', '.toContainEqual(')
          });
        }
        
        // Look for toContain with complex object patterns
        if (trimmedLine.includes('.toContain(') && 
            (trimmedLine.includes('type:') || 
             trimmedLine.includes('field:') || 
             trimmedLine.includes('id:') ||
             trimmedLine.includes('name:'))) {
          issues.push({
            file: filePath,
            line: lineNumber,
            content: trimmedLine,
            issue: 'Likely using toContain with object - should use toContainEqual',
            suggestion: trimmedLine.replace('.toContain(', '.toContainEqual(')
          });
        }
        
        // Look for expect().toContain() with multi-line objects
        if (trimmedLine.includes('expect(') && 
            trimmedLine.includes(').toContain(') &&
            (lines[index + 1]?.trim().startsWith('{') || 
             lines[index - 1]?.trim().endsWith('{'))) {
          issues.push({
            file: filePath,
            line: lineNumber,
            content: trimmedLine,
            issue: 'Multi-line object with toContain - should use toContainEqual',
            suggestion: trimmedLine.replace('.toContain(', '.toContainEqual(')
          });
        }
      });
    } catch (error) {
      console.warn(`Error scanning file ${filePath}:`, (error as Error).message);
    }
  };

  const scanDirectory = (dir: string) => {
    try {
      const entries = fs.readdirSync(dir);

      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (stat.isFile()) {
          scanFile(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Error scanning directory ${dir}:`, (error as Error).message);
    }
  };
  
  scanDirectory(testDir);
  return issues;
};

/**
 * Generates a report of assertion issues
 */
export const generateAssertionReport = (issues: AssertionIssue[]): string => {
  if (issues.length === 0) {
    return '✅ No assertion issues found!';
  }
  
  const report = [
    '🔍 Assertion Method Issues Report',
    '=' .repeat(50),
    `Found ${issues.length} potential issues:`,
    ''
  ];
  
  // Group issues by file
  const issuesByFile = issues.reduce((acc, issue) => {
    if (!acc[issue.file]) {
      acc[issue.file] = [];
    }
    acc[issue.file].push(issue);
    return acc;
  }, {} as Record<string, AssertionIssue[]>);
  
  Object.entries(issuesByFile).forEach(([file, fileIssues]) => {
    report.push(`📁 ${path.relative(process.cwd(), file)}`);
    
    fileIssues.forEach(issue => {
      report.push(`   Line ${issue.line}: ${issue.issue}`);
      report.push(`   Current: ${issue.content}`);
      report.push(`   Suggested: ${issue.suggestion}`);
      report.push('');
    });
  });
  
  report.push('=' .repeat(50));
  report.push(`Total issues: ${issues.length}`);
  
  return report.join('\n');
};

/**
 * Validates assertion usage patterns
 */
export const validateAssertionPatterns = (): {
  success: boolean;
  report: string[];
  errors: string[];
} => {
  const report: string[] = [];
  const errors: string[] = [];
  
  try {
    report.push('🔍 Starting assertion pattern validation...');
    
    // Test 1: Scan for issues
    report.push('\n📋 Scanning test files for assertion issues...');
    
    const testDir = path.join(__dirname, '..');
    const issues = scanForAssertionIssues(testDir);
    
    if (issues.length === 0) {
      report.push('✅ No assertion issues found');
    } else {
      errors.push(`❌ Found ${issues.length} assertion issues`);
      
      // Show first few issues as examples
      const exampleIssues = issues.slice(0, 3);
      exampleIssues.forEach(issue => {
        errors.push(`   - ${path.basename(issue.file)}:${issue.line} - ${issue.issue}`);
      });
      
      if (issues.length > 3) {
        errors.push(`   ... and ${issues.length - 3} more issues`);
      }
    }
    
    // Test 2: Validate helper functions
    report.push('\n🔧 Testing assertion helper functions...');
    
    try {
      const { expectArrayToContain, expectArrayToContainObject } = require('./assertionHelpers');
      
      // Test primitive array
      const primitiveArray = ['apple', 'banana', 'cherry'];
      expectArrayToContain(primitiveArray, 'banana');
      report.push('✅ Primitive array assertion helper works');
      
      // Test object array
      const objectArray = [{ id: 1, name: 'test' }];
      expectArrayToContainObject(objectArray, { id: 1, name: 'test' });
      report.push('✅ Object array assertion helper works');
      
    } catch (error) {
      errors.push(`❌ Assertion helper test failed: ${(error as Error).message}`);
    }

    // Final report
    const success = errors.length === 0;
    report.push(`\n📊 Validation ${success ? 'PASSED' : 'FAILED'}`);
    report.push(`   - Tests passed: ${report.filter(r => r.includes('✅')).length}`);
    report.push(`   - Tests failed: ${errors.length}`);

    return { success, report, errors };

  } catch (error) {
    errors.push(`❌ Validation process failed: ${(error as Error).message}`);
    return { success: false, report, errors };
  }
};

/**
 * Runs a quick validation and prints results to console
 */
export const quickAssertionValidation = (): boolean => {
  console.log('🚀 Running quick assertion method validation...\n');
  
  const { success, report, errors } = validateAssertionPatterns();
  
  // Print report
  report.forEach(line => console.log(line));
  
  // Print errors if any
  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(error => console.log(error));
  }
  
  // Generate detailed report if issues found
  if (!success) {
    console.log('\n📋 Detailed Issues Report:');
    const testDir = path.join(__dirname, '..');
    const issues = scanForAssertionIssues(testDir);
    console.log(generateAssertionReport(issues));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(success ? '✅ ASSERTION VALIDATION PASSED' : '❌ ASSERTION VALIDATION FAILED');
  console.log('='.repeat(50));
  
  return success;
};

// Export for use in tests and scripts
export default {
  scanForAssertionIssues,
  generateAssertionReport,
  validateAssertionPatterns,
  quickAssertionValidation,
};
