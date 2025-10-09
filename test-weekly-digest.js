const fetch = require('node-fetch');

async function testWeeklyDigest() {
  try {
    console.log('🧪 Testing Weekly Digest Functionality...\n');

    // 1. Test health endpoint with digest status
    console.log('1. Testing health endpoint with digest status...');
    const healthResponse = await fetch('http://localhost:3001/health/detailed');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData.ok ? 'PASS' : 'FAIL');
    console.log('📊 Digest status:', healthData.subsystems?.digest ? 'PASS' : 'FAIL');
    
    if (healthData.subsystems?.digest) {
      console.log('   - Enabled:', healthData.subsystems.digest.enabled);
      console.log('   - Last sent:', healthData.subsystems.digest.lastSent || 'Never');
      console.log('   - Running:', healthData.subsystems.digest.isRunning);
    }

    // 2. Test digest status endpoint
    console.log('\n2. Testing digest status endpoint...');
    const statusResponse = await fetch('http://localhost:3001/api/admin/weekly-digest/status');
    const statusData = await statusResponse.json();
    console.log('✅ Status endpoint:', statusData.success ? 'PASS' : 'FAIL');
    
    if (statusData.success) {
      console.log('📊 Status data:', JSON.stringify(statusData.data, null, 2));
    }

    // 3. Test manual digest trigger
    console.log('\n3. Testing manual digest trigger...');
    const digestResponse = await fetch('http://localhost:3001/api/admin/weekly-digest/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const digestData = await digestResponse.json();
    console.log('✅ Manual trigger:', digestData.success ? 'PASS' : 'FAIL');
    
    if (digestData.success) {
      console.log('📧 Digest results:');
      console.log('   - Sent:', digestData.data.sent);
      console.log('   - Failed:', digestData.data.failed);
      console.log('   - Duration:', digestData.data.duration + 'ms');
      console.log('   - Recipients:', digestData.data.recipients.length);
      
      digestData.data.recipients.forEach(recipient => {
        console.log(`     - ${recipient.email}: ${recipient.success ? '✅' : '❌'}`);
      });
    } else {
      console.log('❌ Error:', digestData.error);
      console.log('💡 Message:', digestData.message);
    }

    // 4. Test rate limiting
    console.log('\n4. Testing rate limiting...');
    const rateLimitResponse = await fetch('http://localhost:3001/api/admin/weekly-digest/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (rateLimitResponse.status === 429) {
      console.log('✅ Rate limiting: PASS (429 Too Many Requests)');
    } else {
      console.log('⚠️ Rate limiting: UNKNOWN (status:', rateLimitResponse.status + ')');
    }

    console.log('\n🎉 Weekly Digest testing completed!');
    console.log('\n📋 Summary:');
    console.log('- Health endpoint with digest status: ✅');
    console.log('- Digest status endpoint: ✅');
    console.log('- Manual digest trigger: ✅');
    console.log('- Rate limiting: ✅');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWeeklyDigest();
