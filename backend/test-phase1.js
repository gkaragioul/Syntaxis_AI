#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running Phase 1 Tests (Fixed Version)...\n');

const testFiles = [
  'src/__tests__/phase1/environment.test.ts',
  'src/__tests__/phase1/scripts.test.ts', 
  'src/__tests__/phase1/code-quality.test.ts',
  'src/__tests__/phase1/testing-suite.test.ts',
  'src/__tests__/phase1/docker.test.ts'
];

let passedTests = 0;
let failedTests = 0;

for (const testFile of testFiles) {
  try {
    console.log(`\n📋 Running: ${testFile}`);
    execSync(`npx jest ${testFile} --verbose --testTimeout=15000`, { 
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
console.log(`📊 Phase 1 Test Results:`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Total: ${passedTests + failedTests}`);

if (failedTests === 0) {
  console.log('\n🎉 All Phase 1 tests passed! Phase 1 is complete.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some Phase 1 tests failed. Please review the output above.');
  process.exit(1);
}
