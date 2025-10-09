const fetch = require('node-fetch');

async function testCandidateCreate() {
  try {
    console.log('🧪 Testing Candidate Creation...\n');

    // Test candidate creation with array skills
    console.log('1. Creating candidate with array skills...');
    const createResponse = await fetch('http://localhost:3001/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        skills: ['Public Affairs', 'Communications'],
        salaryMin: 90000,
        currentTitle: 'Test Role',
        currentEmployer: 'Test Company'
      })
    });
    
    const createData = await createResponse.json();
    console.log('✅ Create result:', createData.success ? 'PASS' : 'FAIL');
    console.log('📋 Response:', JSON.stringify(createData, null, 2));

    // Test candidate creation with object skills
    console.log('\n2. Creating candidate with object skills...');
    const createResponse2 = await fetch('http://localhost:3001/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Test2',
        lastName: 'User2',
        email: 'test2@example.com',
        skills: {
          communications: true,
          publicAffairs: true
        },
        salaryMin: 80000,
        currentTitle: 'Test Role 2',
        currentEmployer: 'Test Company 2'
      })
    });
    
    const createData2 = await createResponse2.json();
    console.log('✅ Create result 2:', createData2.success ? 'PASS' : 'FAIL');
    console.log('📋 Response 2:', JSON.stringify(createData2, null, 2));

    console.log('\n🎉 Candidate creation test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCandidateCreate();
