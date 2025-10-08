// Skill handling business rules tests
const { normalizeSkill, hasSkill } = require('./test-helpers');

function runTests() {
  console.log('🧪 Testing Skill Handling Rules...\n');
  
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
  
  // Test 1: Skill normalization
  test('Normalize "Public Affairs"', normalizeSkill('Public Affairs'), 'public affairs');
  test('Normalize "COMMUNICATIONS"', normalizeSkill('COMMUNICATIONS'), 'communications');
  test('Normalize "  Policy  " (with spaces)', normalizeSkill('  Policy  '), 'policy');
  test('Normalize "Campaigns & Strategy"', normalizeSkill('Campaigns & Strategy'), 'campaigns  strategy');
  test('Normalize empty string', normalizeSkill(''), '');
  test('Normalize null', normalizeSkill(null), '');
  test('Normalize undefined', normalizeSkill(undefined), '');
  
  // Test 2: Multi-skill candidate handling
  const candidateSkills1 = {
    publicAffairs: true,
    communications: false,
    policy: false,
    campaigns: false
  };
  test('Candidate with Public Affairs skill', hasSkill(candidateSkills1, 'Public Affairs'), true);
  
  const candidateSkills2 = {
    publicAffairs: false,
    communications: true,
    policy: false,
    campaigns: false
  };
  test('Candidate with Communications skill', hasSkill(candidateSkills2, 'communications'), true);
  
  const candidateSkills3 = {
    publicAffairs: true,
    communications: true,
    policy: false,
    campaigns: false
  };
  test('Candidate with multiple skills (Public Affairs)', hasSkill(candidateSkills3, 'Public Affairs'), true);
  test('Candidate with multiple skills (Communications)', hasSkill(candidateSkills3, 'Communications'), true);
  test('Candidate with multiple skills (Policy)', hasSkill(candidateSkills3, 'Policy'), false);
  
  const candidateSkills4 = {
    publicAffairs: false,
    communications: false,
    policy: false,
    campaigns: false
  };
  test('Candidate with no skills', hasSkill(candidateSkills4, 'Public Affairs'), false);
  test('Candidate with null skills object', hasSkill(null, 'Public Affairs'), false);
  test('Candidate with undefined skills', hasSkill(undefined, 'Public Affairs'), false);
  
  // Test 3: Case insensitive skill matching
  test('Case insensitive "public affairs"', hasSkill(candidateSkills1, 'public affairs'), true);
  test('Case insensitive "PUBLIC AFFAIRS"', hasSkill(candidateSkills1, 'PUBLIC AFFAIRS'), true);
  
  // Test 4: All four skill categories
  const candidateSkills5 = {
    publicAffairs: true,
    communications: true,
    policy: true,
    campaigns: true
  };
  test('All skill categories (Public Affairs)', hasSkill(candidateSkills5, 'Public Affairs'), true);
  test('All skill categories (Communications)', hasSkill(candidateSkills5, 'Communications'), true);
  test('All skill categories (Policy)', hasSkill(candidateSkills5, 'Policy'), true);
  test('All skill categories (Campaigns)', hasSkill(candidateSkills5, 'Campaigns'), true);
  
  // Test 5: Edge cases with malformed data
  test('Empty skills object', hasSkill({}, 'Public Affairs'), false);
  
  const candidateSkills6 = {
    publicAffairs: null,
    communications: undefined,
    policy: false,
    campaigns: false
  };
  test('Skills object with null values', hasSkill(candidateSkills6, 'Public Affairs'), false);
  
  const candidateSkills7 = {
    publicAffairs: 'true',
    communications: false,
    policy: false,
    campaigns: false
  };
  test('Skills object with string values', hasSkill(candidateSkills7, 'Public Affairs'), false);
  
  console.log(`\n📊 Skill Handling Tests: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

module.exports = { runTests };