// Test Jobs Pipeline Endpoints
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testJobsPipeline() {
  console.log('🧪 Testing Jobs Pipeline Endpoints...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check:', healthResponse.data.status === 'ok' ? 'PASS' : 'FAIL');
    console.log('📋 Health data:', healthResponse.data);

    // Test 2: Get jobs
    console.log('\n2. Testing get jobs endpoint...');
    const jobsResponse = await axios.get(`${BASE_URL}/api/jobs`);
    console.log('✅ Get jobs:', jobsResponse.data.success ? 'PASS' : 'FAIL');
    console.log('📋 Jobs count:', jobsResponse.data.jobs?.length || 0);
    console.log('📋 Jobs data:', JSON.stringify(jobsResponse.data, null, 2));

    // Test 3: Create a new job
    console.log('\n3. Testing create job endpoint...');
    const newJob = {
      title: 'Test Job',
      description: 'Test job description',
      requiredSkills: { communications: true, campaigns: false, policy: false, publicAffairs: true },
      salaryMin: 50000,
      salaryMax: 70000,
      location: 'Test City',
      company: 'Test Company',
      isPublic: false,
      employmentType: 'Full-time'
    };
    
    const createResponse = await axios.post(`${BASE_URL}/api/jobs`, newJob);
    console.log('✅ Create job:', createResponse.data.success ? 'PASS' : 'FAIL');
    console.log('📋 Created job ID:', createResponse.data.data?.id);
    console.log('📋 Created job data:', JSON.stringify(createResponse.data, null, 2));

    // Test 4: Update job status
    if (createResponse.data.data?.id) {
      console.log('\n4. Testing update job status endpoint...');
      const updateResponse = await axios.patch(`${BASE_URL}/api/jobs/${createResponse.data.data.id}/status`, {
        status: 'Reviewed'
      });
      console.log('✅ Update job status:', updateResponse.data.success ? 'PASS' : 'FAIL');
      console.log('📋 Updated job data:', JSON.stringify(updateResponse.data, null, 2));
    }

    // Test 5: Get jobs again to see the new job
    console.log('\n5. Testing get jobs after creation...');
    const jobsResponse2 = await axios.get(`${BASE_URL}/api/jobs`);
    console.log('✅ Get jobs after creation:', jobsResponse2.data.success ? 'PASS' : 'FAIL');
    console.log('📋 Jobs count after creation:', jobsResponse2.data.jobs?.length || 0);

    console.log('\n🎉 Jobs Pipeline testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('📋 Response status:', error.response.status);
      console.error('📋 Response data:', error.response.data);
    }
  }
}

// Run the test
testJobsPipeline();
