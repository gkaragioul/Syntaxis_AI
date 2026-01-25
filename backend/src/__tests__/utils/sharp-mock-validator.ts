// @ts-nocheck
/**
 * Sharp Mock Validator
 * 
 * TDD Phase: GREEN - Validation utility to ensure Sharp mocking is working
 * Task: 1.1.1 - Sharp Library Mocking Validation
 * 
 * This utility validates that the Sharp mock setup is working correctly
 * and can be used to verify fixes before running the full test suite.
 */

import { setupSharpMock, cleanupSharpMock } from './sharpMockHelper';

/**
 * Validates the Sharp mock setup
 * Returns a detailed report of the mock state
 */
export const validateSharpMock = async (): Promise<{
  success: boolean;
  report: string[];
  errors: string[];
}> => {
  const report: string[] = [];
  const errors: string[] = [];

  try {
    report.push('🔍 Starting Sharp mock validation...');

    // Test 1: Mock setup
    report.push('\n📋 Setting up Sharp mock...');
    
    const mockFactory = setupSharpMock();
    report.push('✅ Sharp mock factory created');

    // Test 2: Import pattern validation
    report.push('\n🔧 Testing import pattern...');
    
    try {
      // Reset modules to test fresh import
      jest.resetModules();
      
      // Import Sharp using the OCR service pattern: import sharp from 'sharp'
      const sharpModule = await import('sharp');
      const sharp = sharpModule.default;
      
      if (typeof sharp === 'function') {
        report.push('✅ Sharp imported as function (correct for OCR service)');
      } else {
        errors.push('❌ Sharp not imported as function');
      }
      
      // Test 3: Sharp instance creation
      report.push('\n🖼️ Testing Sharp instance creation...');
      
      const buffer = Buffer.from('test image data');
      const sharpInstance = sharp(buffer);
      
      if (sharpInstance && typeof sharpInstance === 'object') {
        report.push('✅ Sharp instance created successfully');
      } else {
        errors.push('❌ Failed to create Sharp instance');
      }
      
      // Test 4: Method chaining
      report.push('\n🔗 Testing method chaining...');
      
      const chainedResult = sharpInstance
        .grayscale()
        .modulate({ brightness: 1.2 })
        .threshold(128);
        
      if (chainedResult === sharpInstance) {
        report.push('✅ Method chaining works correctly');
      } else {
        errors.push('❌ Method chaining failed');
      }
      
      // Test 5: Async operations
      report.push('\n⏳ Testing async operations...');
      
      const metadata = await sharpInstance.metadata();
      if (metadata && metadata.width && metadata.height) {
        report.push('✅ Metadata operation successful');
        report.push(`   - Width: ${metadata.width}, Height: ${metadata.height}`);
      } else {
        errors.push('❌ Metadata operation failed');
      }
      
      const processedBuffer = await sharpInstance.toBuffer();
      if (processedBuffer && Buffer.isBuffer(processedBuffer)) {
        report.push('✅ toBuffer operation successful');
      } else {
        errors.push('❌ toBuffer operation failed');
      }
      
      // Test 6: Mock reset functionality
      report.push('\n🔄 Testing mock reset...');
      
      mockFactory.resetMocks();
      report.push('✅ Mock reset completed');
      
      // Test 7: Error simulation
      report.push('\n⚠️ Testing error simulation...');
      
      mockFactory.setupFailedProcessing('Test error');
      
      try {
        await sharpInstance.metadata();
        errors.push('❌ Error simulation failed - should have thrown');
      } catch (error) {
        if (error.message === 'Test error') {
          report.push('✅ Error simulation works correctly');
        } else {
          errors.push(`❌ Wrong error message: ${error.message}`);
        }
      }
      
    } catch (error) {
      errors.push(`❌ Import/usage test failed: ${error.message}`);
    }

    // Test 8: Cleanup
    report.push('\n🧹 Testing cleanup...');
    
    try {
      cleanupSharpMock();
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
export const quickSharpValidation = async (): Promise<boolean> => {
  console.log('🚀 Running quick Sharp mock validation...\n');
  
  const { success, report, errors } = await validateSharpMock();
  
  // Print report
  report.forEach(line => console.log(line));
  
  // Print errors if any
  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(error => console.log(error));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(success ? '✅ SHARP MOCK VALIDATION PASSED' : '❌ SHARP MOCK VALIDATION FAILED');
  console.log('='.repeat(50));
  
  return success;
};

// Export for use in tests and scripts
export default {
  validateSharpMock,
  quickSharpValidation,
};
