// @ts-nocheck
/**
 * Prisma Mock Validator
 * 
 * TDD Phase: GREEN - Validation utility to ensure Prisma mocking is working
 * Task: 1.1.2 - Prisma Client Mock Implementations Validation
 * 
 * This utility validates that the Prisma mock setup is working correctly
 * and can be used to verify fixes before running the full test suite.
 */

import { setupPrismaMock, validatePrismaMock, createTestDataWithRelations } from './prismaMockHelper';

/**
 * Validates the Prisma mock setup
 * Returns a detailed report of the mock state
 */
export const validatePrismaMockSetup = async (): Promise<{
  success: boolean;
  report: string[];
  errors: string[];
}> => {
  const report: string[] = [];
  const errors: string[] = [];

  try {
    report.push('🔍 Starting Prisma mock validation...');

    // Test 1: Mock setup
    report.push('\n📋 Setting up Prisma mock...');
    
    const mockFactory = setupPrismaMock();
    report.push('✅ Prisma mock factory created');

    // Test 2: Mock completeness validation
    report.push('\n🔧 Validating mock completeness...');
    
    const validation = validatePrismaMock(mockFactory.mock);
    if (validation.isValid) {
      report.push('✅ All required Prisma methods are mocked');
    } else {
      errors.push('❌ Missing Prisma methods:');
      validation.missingMethods.forEach(method => {
        errors.push(`   - ${method}`);
      });
    }

    // Test 3: Basic CRUD operations
    report.push('\n📝 Testing basic CRUD operations...');
    
    try {
      // Test User operations
      const userData = { email: 'test@example.com', passwordHash: 'hashed' };
      const createdUser = await mockFactory.mock.user.create({ data: userData });
      
      if (createdUser && createdUser.id) {
        report.push('✅ User create operation successful');
      } else {
        errors.push('❌ User create operation failed');
      }

      const foundUser = await mockFactory.mock.user.findUnique({ 
        where: { id: createdUser.id } 
      });
      
      if (foundUser) {
        report.push('✅ User findUnique operation successful');
      } else {
        errors.push('❌ User findUnique operation failed');
      }

      // Test Invoice operations
      const invoiceData = { userId: createdUser.id, filename: 'test.pdf' };
      const createdInvoice = await mockFactory.mock.invoice.create({ data: invoiceData });
      
      if (createdInvoice && createdInvoice.id) {
        report.push('✅ Invoice create operation successful');
      } else {
        errors.push('❌ Invoice create operation failed');
      }

      // Test File operations
      const fileData = { userId: createdUser.id, filename: 'test.pdf' };
      const createdFile = await mockFactory.mock.file.create({ data: fileData });
      
      if (createdFile && createdFile.id) {
        report.push('✅ File create operation successful');
      } else {
        errors.push('❌ File create operation failed');
      }

    } catch (error) {
      errors.push(`❌ CRUD operations test failed: ${error.message}`);
    }

    // Test 4: Advanced operations
    report.push('\n⚡ Testing advanced operations...');
    
    try {
      // Test aggregation
      const aggregateResult = await mockFactory.mock.invoice.aggregate({
        _count: { id: true },
        _avg: { extractionConfidence: true },
      });
      
      if (aggregateResult && aggregateResult._count) {
        report.push('✅ Aggregation operation successful');
      } else {
        errors.push('❌ Aggregation operation failed');
      }

      // Test transaction
      const transactionResult = await mockFactory.mock.$transaction([
        mockFactory.mock.user.create({ data: { email: 'tx@example.com' } }),
        mockFactory.mock.invoice.create({ data: { userId: 'test-id' } }),
      ]);
      
      if (transactionResult && transactionResult.length === 2) {
        report.push('✅ Transaction operation successful');
      } else {
        errors.push('❌ Transaction operation failed');
      }

      // Test raw query
      const rawResult = await mockFactory.mock.$queryRaw`SELECT 1 as test`;
      
      if (rawResult) {
        report.push('✅ Raw query operation successful');
      } else {
        errors.push('❌ Raw query operation failed');
      }

    } catch (error) {
      errors.push(`❌ Advanced operations test failed: ${error.message}`);
    }

    // Test 5: Mock reset functionality
    report.push('\n🔄 Testing mock reset...');
    
    try {
      mockFactory.resetMocks();
      report.push('✅ Mock reset completed');
      
      // Verify mocks are reset
      mockFactory.setupSuccessfulOperations();
      report.push('✅ Mock setup after reset successful');
      
    } catch (error) {
      errors.push(`❌ Mock reset failed: ${error.message}`);
    }

    // Test 6: Error simulation
    report.push('\n⚠️ Testing error simulation...');
    
    try {
      mockFactory.setupFailedOperations('Test database error');
      
      try {
        await mockFactory.mock.user.create({ data: { email: 'fail@example.com' } });
        errors.push('❌ Error simulation failed - should have thrown');
      } catch (error) {
        if (error.message === 'Test database error') {
          report.push('✅ Error simulation works correctly');
        } else {
          errors.push(`❌ Wrong error message: ${error.message}`);
        }
      }
      
    } catch (error) {
      errors.push(`❌ Error simulation test failed: ${error.message}`);
    }

    // Test 7: Test data factory
    report.push('\n🏭 Testing data factories...');
    
    try {
      const testData = createTestDataWithRelations();
      
      if (testData.user && testData.invoice && testData.ocrResult && testData.correction) {
        report.push('✅ Test data factory works correctly');
        report.push(`   - User ID: ${testData.user.id}`);
        report.push(`   - Invoice ID: ${testData.invoice.id}`);
        report.push(`   - OCR Result ID: ${testData.ocrResult.id}`);
        report.push(`   - Correction ID: ${testData.correction.id}`);
      } else {
        errors.push('❌ Test data factory failed');
      }
      
    } catch (error) {
      errors.push(`❌ Test data factory test failed: ${error.message}`);
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
export const quickPrismaValidation = async (): Promise<boolean> => {
  console.log('🚀 Running quick Prisma mock validation...\n');
  
  const { success, report, errors } = await validatePrismaMockSetup();
  
  // Print report
  report.forEach(line => console.log(line));
  
  // Print errors if any
  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(error => console.log(error));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(success ? '✅ PRISMA MOCK VALIDATION PASSED' : '❌ PRISMA MOCK VALIDATION FAILED');
  console.log('='.repeat(50));
  
  return success;
};

// Export for use in tests and scripts
export default {
  validatePrismaMockSetup,
  quickPrismaValidation,
};
