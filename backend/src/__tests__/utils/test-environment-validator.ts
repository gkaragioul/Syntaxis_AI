// @ts-nocheck
/**
 * Test Environment Validator
 * 
 * TDD Phase: GREEN - Validation utility to ensure test environment is working
 * Task: 1.1.4 - Test Environment Setup Validation
 * 
 * This utility validates that the test environment setup is working correctly
 * and can be used to verify fixes before running the full test suite.
 */

import { testEnvironment, validateTestEnvironment } from './test-environment';

/**
 * Validates the test environment setup
 * Returns a detailed report of the environment state
 */
export const validateEnvironmentSetup = async (): Promise<{
  success: boolean;
  report: string[];
  errors: string[];
}> => {
  const report: string[] = [];
  const errors: string[] = [];

  try {
    report.push('🔍 Starting test environment validation...');

    // Test 1: Environment variable validation
    report.push('\n📋 Checking environment variables...');
    
    const requiredEnvVars = ['NODE_ENV', 'DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'];
    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        report.push(`✅ ${envVar}: ${process.env[envVar]?.substring(0, 20)}...`);
      } else {
        errors.push(`❌ Missing environment variable: ${envVar}`);
      }
    }

    // Test 2: Test environment setup
    report.push('\n🔧 Testing environment setup...');
    
    try {
      await testEnvironment.setup({ 
        useMocks: true, 
        validateConnections: false,
        isolationLevel: 'test' 
      });
      report.push('✅ Test environment setup successful');
    } catch (error) {
      errors.push(`❌ Test environment setup failed: ${error.message}`);
    }

    // Test 3: Environment validation
    report.push('\n🔍 Validating environment state...');
    
    const validation = validateTestEnvironment();
    if (validation.isValid) {
      report.push('✅ Environment validation passed');
      report.push(`   - Setup: ${validation.state.isSetup}`);
      report.push(`   - Prisma: ${validation.state.prismaConnected}`);
      report.push(`   - Redis: ${validation.state.redisConnected}`);
      report.push(`   - Isolation: ${validation.state.isolationLevel}`);
    } else {
      errors.push('❌ Environment validation failed:');
      validation.issues.forEach(issue => errors.push(`   - ${issue}`));
    }

    // Test 4: Cleanup test
    report.push('\n🧹 Testing cleanup functionality...');
    
    try {
      await testEnvironment.cleanup();
      report.push('✅ Cleanup successful');
    } catch (error) {
      errors.push(`❌ Cleanup failed: ${error.message}`);
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
export const quickValidation = async (): Promise<boolean> => {
  console.log('🚀 Running quick test environment validation...\n');
  
  const { success, report, errors } = await validateEnvironmentSetup();
  
  // Print report
  report.forEach(line => console.log(line));
  
  // Print errors if any
  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(error => console.log(error));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(success ? '✅ VALIDATION PASSED' : '❌ VALIDATION FAILED');
  console.log('='.repeat(50));
  
  return success;
};

// Export for use in tests and scripts
export default {
  validateEnvironmentSetup,
  quickValidation,
};
