#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running Phase 3 Tests (Invoice Processing Engine)...\n');

const testFiles = [
  'src/__tests__/phase3/task1-multi-engine-ocr.test.ts',
  'src/__tests__/phase3/task2-ai-data-extraction.test.ts', 
  'src/__tests__/phase3/task3-validation-system.test.ts',
  'src/__tests__/phase3/task4-processing-queue.test.ts',
  'src/__tests__/phase3/task5-human-review-system.test.ts'
];

let passedTests = 0;
let failedTests = 0;

for (const testFile of testFiles) {
  try {
    console.log(`\n📋 Running: ${testFile}`);
    execSync(`npx jest ${testFile} --verbose --testTimeout=30000`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log(`✅ PASSED: ${testFile}`);
    passedTests++;
  } catch (error) {
    console.log(`❌ FAILED: ${testFile}`);
    failedTests++;
  }
}

console.log('\n' + '='.repeat(50));
console.log(`📊 Phase 3 Test Results:`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Total: ${passedTests + failedTests}`);

if (failedTests === 0) {
  console.log('\n🎉 All Phase 3 tests passed! Phase 3 is complete.');
  console.log('🚀 100% Accuracy Invoice Processing Engine is ready!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some Phase 3 tests failed. Please review the output above.');
  console.log('💡 Remember: We are using TDD - tests should fail first, then we implement!');
  process.exit(1);
}
