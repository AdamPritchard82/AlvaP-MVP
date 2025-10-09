const fetch = require('node-fetch');

async function testCandidateCategorization() {
  try {
    console.log('🧪 Testing Candidate Categorization Issue...\n');

    // 1. Create test candidate with specific skills
    console.log('1. Creating test candidate...');
    const createResponse = await fetch('http://localhost:3001/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        skills: ['Public Affairs', 'Communications'],
        salaryMin: 90000,
        // No salaryMax - should be derived
        currentTitle: 'Test Role',
        currentEmployer: 'Test Company'
      })
    });
    
    const createData = await createResponse.json();
    console.log('✅ Create result:', createData.success ? 'PASS' : 'FAIL');
    console.log('📋 Created candidate:', JSON.stringify(createData.data, null, 2));

    // 2. Test Library skill tiles
    console.log('\n2. Testing Library skill tiles...');
    const tilesResponse = await fetch('http://localhost:3001/api/candidates/skills');
    const tilesData = await tilesResponse.json();
    console.log('✅ Skills tiles:', tilesData.success ? 'PASS' : 'FAIL');
    console.log('📊 Skills data:', JSON.stringify(tilesData.data, null, 2));

    // 3. Test Library bands
    console.log('\n3. Testing Library bands...');
    const bandsResponse = await fetch('http://localhost:3001/api/candidates/bands');
    const bandsData = await bandsResponse.json();
    console.log('✅ Bands data:', bandsData.success ? 'PASS' : 'FAIL');
    console.log('📊 Bands data:', JSON.stringify(bandsData.data, null, 2));

    // 4. Test specific skill bands
    console.log('\n4. Testing Public Affairs bands...');
    const skillBandsResponse = await fetch('http://localhost:3001/api/candidates/skills/Public Affairs/bands');
    const skillBandsData = await skillBandsResponse.json();
    console.log('✅ Public Affairs bands:', skillBandsData.success ? 'PASS' : 'FAIL');
    console.log('📊 Public Affairs bands:', JSON.stringify(skillBandsData.data, null, 2));

    // 5. Test candidate list
    console.log('\n5. Testing candidate list...');
    const listResponse = await fetch('http://localhost:3001/api/candidates');
    const listData = await listResponse.json();
    console.log('✅ Candidate list:', listData.success ? 'PASS' : 'FAIL');
    console.log('📊 List count:', listData.data?.candidates?.length || 0);

    console.log('\n🎉 Categorization test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCandidateCategorization();
