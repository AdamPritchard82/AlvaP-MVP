// Salary banding business rules tests
const { toBandLabel, calculateDefaultSalaryMax } = require('./test-helpers');

function runTests() {
  console.log('🧪 Testing Salary Banding Rules...\n');
  
  let passed = 0;
  let failed = 0;
  
  function test(name, actual, expected) {
    if (actual === expected) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name} - Expected ${expected}, got ${actual}`);
      failed++;
    }
  }
  
  // Test 1: Basic band calculation
  test('Band calculation for £45,000', toBandLabel(45000), '£40,000');
  test('Band calculation for £90,000', toBandLabel(90000), '£90,000');
  test('Band calculation for £95,000', toBandLabel(95000), '£90,000');
  test('Band calculation for £120,000', toBandLabel(120000), '£120,000');
  
  // Test 2: Edge cases
  test('Band calculation for £5,000 (minimum)', toBandLabel(5000), '£10,000');
  test('Band calculation for £0', toBandLabel(0), null);
  test('Band calculation for negative amount', toBandLabel(-1000), null);
  test('Band calculation for null', toBandLabel(null), null);
  test('Band calculation for undefined', toBandLabel(undefined), null);
  test('Band calculation for empty string', toBandLabel(''), null);
  test('Band calculation for non-numeric string', toBandLabel('invalid'), null);
  
  // Test 3: Salary max defaulting rules
  test('Default salary max for £60,000 (< £100k)', calculateDefaultSalaryMax(60000), 90000);
  test('Default salary max for £90,000 (< £100k)', calculateDefaultSalaryMax(90000), 120000);
  test('Default salary max for £100,000 (≥ £100k)', calculateDefaultSalaryMax(100000), 150000);
  test('Default salary max for £120,000 (≥ £100k)', calculateDefaultSalaryMax(120000), 170000);
  
  // Test 4: Band label formatting
  test('Band label format for £30,000', toBandLabel(30000), '£30,000');
  test('Band label format for £100,000', toBandLabel(100000), '£100,000');
  test('Band label format for £1,000,000', toBandLabel(1000000), '£1,000,000');
  
  // Test 5: Rounding down behavior
  test('Rounding down £41,250 to £40,000', toBandLabel(41250), '£40,000');
  test('Rounding down £99,999 to £90,000', toBandLabel(99999), '£90,000');
  test('Rounding down £125,000 to £120,000', toBandLabel(125000), '£120,000');
  
  console.log(`\n📊 Salary Banding Tests: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

module.exports = { runTests };