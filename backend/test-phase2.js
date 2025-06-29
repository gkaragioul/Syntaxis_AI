#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running Phase 2 Tests (Core Backend Systems)...\n');

const testFiles = [
  'src/__tests__/phase2/task1-database-implementation.test.ts',
  'src/__tests__/phase2/task2-authentication-system.test.ts', 
  'src/__tests__/phase2/task3-core-api-features.test.ts'
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
console.log(`📊 Phase 2 Test Results:`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Total: ${passedTests + failedTests}`);

if (failedTests === 0) {
  console.log('\n🎉 All Phase 2 tests passed! Phase 2 is complete.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some Phase 2 tests failed. Please review the output above.');
  process.exit(1);
}
