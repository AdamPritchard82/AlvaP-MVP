#!/usr/bin/env node

// Unit test runner for business logic validation
// Run with: npm run test:unit

const salaryBandingTests = require('./salary-banding.test');
const skillHandlingTests = require('./skill-handling.test');
const roleMatchingTests = require('./role-matching.test');

function runAllTests() {
  console.log('🚀 Running Unit Tests for Business Logic\n');
  console.log('=' .repeat(50));
  
  const startTime = Date.now();
  
  // Run all test suites
  const salaryResults = salaryBandingTests.runTests();
  console.log('\n' + '=' .repeat(50));
  
  const skillResults = skillHandlingTests.runTests();
  console.log('\n' + '=' .repeat(50));
  
  const matchingResults = roleMatchingTests.runTests();
  console.log('\n' + '=' .repeat(50));
  
  // Calculate totals
  const totalPassed = salaryResults.passed + skillResults.passed + matchingResults.passed;
  const totalFailed = salaryResults.failed + skillResults.failed + matchingResults.failed;
  const totalTests = totalPassed + totalFailed;
  
  const duration = Date.now() - startTime;
  
  // Summary
  console.log('\n📋 TEST SUMMARY');
  console.log('=' .repeat(50));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`⏱️  Duration: ${duration}ms`);
  console.log(`📊 Success Rate: ${totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0}%`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 All tests passed! Business logic is working correctly.');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed. Please review the business logic.');
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };

