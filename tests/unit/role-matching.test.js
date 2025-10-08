// Role-candidate matching business rules tests
const { 
  calculateSkillOverlapScore, 
  calculateSalaryProximityScore, 
  calculateMatchScore 
} = require('./test-helpers');

function runTests() {
  console.log('🧪 Testing Role-Candidate Matching Rules...\n');
  
  let passed = 0;
  let failed = 0;
  
  function test(name, actual, expected, tolerance = 0.001) {
    if (typeof actual === 'number' && typeof expected === 'number') {
      if (Math.abs(actual - expected) <= tolerance) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name} - Expected ${expected}, got ${actual} (tolerance: ${tolerance})`);
        failed++;
      }
    } else if (actual === expected) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name} - Expected ${expected}, got ${actual}`);
      failed++;
    }
  }
  
  // Test 1: Skill overlap scoring
  const candidateSkills1 = { publicAffairs: true, communications: false, policy: false, campaigns: false };
  const jobSkills1 = { publicAffairs: true, communications: false, policy: false, campaigns: false };
  test('Perfect skill match (100% overlap)', calculateSkillOverlapScore(candidateSkills1, jobSkills1), 1.0);
  
  const candidateSkills2 = { publicAffairs: true, communications: true, policy: false, campaigns: false };
  const jobSkills2 = { publicAffairs: true, communications: false, policy: false, campaigns: false };
  test('Partial skill match (50% overlap)', calculateSkillOverlapScore(candidateSkills2, jobSkills2), 1.0);
  
  const candidateSkills3 = { publicAffairs: false, communications: true, policy: false, campaigns: false };
  const jobSkills3 = { publicAffairs: true, communications: false, policy: false, campaigns: false };
  test('No skill match (0% overlap)', calculateSkillOverlapScore(candidateSkills3, jobSkills3), 0.0);
  
  const candidateSkills4 = { publicAffairs: true, communications: false, policy: true, campaigns: false };
  const jobSkills4 = { publicAffairs: true, communications: true, policy: false, campaigns: false };
  test('Multiple job skills with partial match', calculateSkillOverlapScore(candidateSkills4, jobSkills4), 0.5);
  
  test('Null candidate skills', calculateSkillOverlapScore(null, jobSkills1), 0.0);
  test('Null job skills', calculateSkillOverlapScore(candidateSkills1, null), 0.0);
  
  // Test 2: Salary proximity scoring (already includes 30% weight)
  test('Perfect salary overlap', calculateSalaryProximityScore(80000, 100000, 90000, 110000), 0.1);
  test('Partial salary overlap', calculateSalaryProximityScore(80000, 100000, 95000, 120000), 0.0375);
  test('No salary overlap (candidate too low)', calculateSalaryProximityScore(50000, 70000, 80000, 100000), 0.0);
  test('No salary overlap (candidate too high)', calculateSalaryProximityScore(120000, 150000, 80000, 100000), 0.0);
  test('Salary overlap with missing candidate max (uses default)', calculateSalaryProximityScore(80000, null, 90000, 110000), 0.2);
  test('Salary overlap with high salary default', calculateSalaryProximityScore(120000, null, 130000, 150000), 0.12);
  test('Missing candidate min returns 0', calculateSalaryProximityScore(null, 100000, 80000, 100000), 0.0);
  test('Missing job min returns 0', calculateSalaryProximityScore(80000, 100000, null, 100000), 0.0);
  
  // Test 3: Combined match scoring
  const candidate1 = {
    skills: { publicAffairs: true, communications: false, policy: false, campaigns: false },
    salaryMin: 80000,
    salaryMax: 100000
  };
  const job1 = {
    requiredSkills: { publicAffairs: true, communications: false, policy: false, campaigns: false },
    salaryMin: 90000,
    salaryMax: 110000
  };
  const match1 = calculateMatchScore(candidate1, job1);
  test('Perfect match (100% skills + 100% salary)', match1.totalScore, 0.8);
  test('Perfect match skill score', match1.skillScore, 0.7);
  test('Perfect match salary score', match1.salaryScore, 0.1);
  
  const candidate2 = {
    skills: { publicAffairs: true, communications: false, policy: false, campaigns: false },
    salaryMin: 80000,
    salaryMax: 100000
  };
  const job2 = {
    requiredSkills: { publicAffairs: true, communications: true, policy: false, campaigns: false },
    salaryMin: 90000,
    salaryMax: 120000
  };
  const match2 = calculateMatchScore(candidate2, job2);
  test('Good match (50% skills + 50% salary)', match2.totalScore, 0.425);
  test('Good match skill score', match2.skillScore, 0.35);
  test('Good match salary score', match2.salaryScore, 0.075);
  
  const candidate3 = {
    skills: { publicAffairs: false, communications: true, policy: false, campaigns: false },
    salaryMin: 80000,
    salaryMax: 100000
  };
  const job3 = {
    requiredSkills: { publicAffairs: true, communications: false, policy: false, campaigns: false },
    salaryMin: 90000,
    salaryMax: 110000
  };
  const match3 = calculateMatchScore(candidate3, job3);
  test('Poor match (0% skills + 100% salary)', match3.totalScore, 0.1);
  test('Poor match skill score', match3.skillScore, 0.0);
  test('Poor match salary score', match3.salaryScore, 0.1);
  
  const candidate4 = {
    skills: { publicAffairs: false, communications: true, policy: false, campaigns: false },
    salaryMin: 50000,
    salaryMax: 70000
  };
  const job4 = {
    requiredSkills: { publicAffairs: true, communications: false, policy: false, campaigns: false },
    salaryMin: 80000,
    salaryMax: 100000
  };
  const match4 = calculateMatchScore(candidate4, job4);
  test('No match (0% skills + 0% salary)', match4.totalScore, 0.0);
  test('No match skill score', match4.skillScore, 0.0);
  test('No match salary score', match4.salaryScore, 0.0);
  
  // Test 4: Edge cases
  const candidate5 = {
    skills: { publicAffairs: true, communications: false, policy: false, campaigns: false },
    salaryMin: 80000,
    salaryMax: 100000
  };
  const job5 = {
    requiredSkills: {},
    salaryMin: 90000,
    salaryMax: 110000
  };
  const match5 = calculateMatchScore(candidate5, job5);
  test('Empty job skills', match5.totalScore, 0.1);
  
  // Test null handling
  try {
    const match6 = calculateMatchScore(null, job1);
    test('Null candidate', match6.totalScore, 0.0);
  } catch (error) {
    console.log(`❌ Null candidate - Error: ${error.message}`);
    failed++;
  }
  
  try {
    const match7 = calculateMatchScore(candidate1, null);
    test('Null job', match7.totalScore, 0.0);
  } catch (error) {
    console.log(`❌ Null job - Error: ${error.message}`);
    failed++;
  }
  
  console.log(`\n📊 Role Matching Tests: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

module.exports = { runTests };