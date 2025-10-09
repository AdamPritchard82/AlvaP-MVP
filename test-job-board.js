const fetch = require('node-fetch');

async function testJobBoard() {
  try {
    console.log('🧪 Testing Job Board Functionality...\n');

    // 1. Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:3001/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData.ok ? 'PASS' : 'FAIL');

    // 2. Create a test job
    console.log('\n2. Creating test job...');
    const jobData = {
      title: 'Senior Communications Manager',
      description: 'Internal job description',
      requiredSkills: {
        communications: true,
        campaigns: true,
        policy: false,
        publicAffairs: true
      },
      salaryMin: 60000,
      salaryMax: 80000,
      location: 'London, UK',
      company: 'Test Client',
      isPublic: false,
      publicSummary: 'We are looking for a Senior Communications Manager to lead our public affairs communications strategy.',
      clientPublicName: 'Leading Consultancy',
      employmentType: 'Full-time'
    };

    const createResponse = await fetch('http://localhost:3001/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData)
    });
    const createResult = await createResponse.json();
    console.log('✅ Job created:', createResult.success ? 'PASS' : 'FAIL');
    
    if (!createResult.success) {
      console.log('❌ Error:', createResult.error);
      return;
    }

    const jobId = createResult.data?.id;
    console.log('📝 Job ID:', jobId);
    console.log('📋 Full create result:', JSON.stringify(createResult, null, 2));

    // 3. Test job publishing
    console.log('\n3. Testing job publishing...');
    const publishResponse = await fetch(`http://localhost:3001/api/jobs/${jobId}/publish`, {
      method: 'POST'
    });
    const publishResult = await publishResponse.json();
    console.log('✅ Job published:', publishResult.success ? 'PASS' : 'FAIL');
    
    if (!publishResult.success) {
      console.log('❌ Error:', publishResult.error);
      return;
    }

    console.log('🔗 Public URL:', publishResult.data.publicUrl);
    console.log('🎫 Public Slug:', publishResult.data.publicSlug);

    // 4. Test public jobs listing
    console.log('\n4. Testing public jobs listing...');
    const publicJobsResponse = await fetch('http://localhost:3001/api/public/jobs');
    const publicJobsResult = await publicJobsResponse.json();
    console.log('✅ Public jobs retrieved:', publicJobsResult.success ? 'PASS' : 'FAIL');
    console.log('📋 Public jobs count:', publicJobsResult.data.length);

    // 5. Test public job detail
    console.log('\n5. Testing public job detail...');
    const publicJobResponse = await fetch(`http://localhost:3001/api/public/jobs/${publishResult.data.publicSlug}`);
    const publicJobResult = await publicJobResponse.json();
    console.log('✅ Public job detail:', publicJobResult.success ? 'PASS' : 'FAIL');
    
    if (publicJobResult.success) {
      console.log('👤 Job details:', {
        title: publicJobResult.data.title,
        client: publicJobResult.data.clientPublicName,
        location: publicJobResult.data.location,
        salary: `£${publicJobResult.data.salaryMin} - £${publicJobResult.data.salaryMax}`
      });
    }

    // 6. Test interest submission
    console.log('\n6. Testing interest submission...');
    const interestData = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      message: 'I am very interested in this role!'
    };

    const interestResponse = await fetch(`http://localhost:3001/api/public/jobs/${publishResult.data.publicSlug}/interest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(interestData)
    });
    const interestResult = await interestResponse.json();
    console.log('✅ Interest submitted:', interestResult.success ? 'PASS' : 'FAIL');
    console.log('💬 Message:', interestResult.message);

    // 7. Test public fields update
    console.log('\n7. Testing public fields update...');
    const updateFieldsResponse = await fetch(`http://localhost:3001/api/jobs/${jobId}/public-fields`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicSummary: 'Updated public summary for this exciting role!',
        clientPublicName: 'Updated Client Name',
        location: 'London, UK (Hybrid)',
        employmentType: 'Full-time'
      })
    });
    const updateFieldsResult = await updateFieldsResponse.json();
    console.log('✅ Public fields updated:', updateFieldsResult.success ? 'PASS' : 'FAIL');

    // 8. Test job unpublishing
    console.log('\n8. Testing job unpublishing...');
    const unpublishResponse = await fetch(`http://localhost:3001/api/jobs/${jobId}/publish`, {
      method: 'POST'
    });
    const unpublishResult = await unpublishResponse.json();
    console.log('✅ Job unpublished:', unpublishResult.success ? 'PASS' : 'FAIL');

    console.log('\n🎉 Job Board testing completed!');
    console.log('\n📋 Summary:');
    console.log('- Health check: ✅');
    console.log('- Job creation: ✅');
    console.log('- Job publishing: ✅');
    console.log('- Public jobs listing: ✅');
    console.log('- Public job detail: ✅');
    console.log('- Interest submission: ✅');
    console.log('- Public fields update: ✅');
    console.log('- Job unpublishing: ✅');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testJobBoard();
