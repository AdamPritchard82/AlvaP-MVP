// Deployment Verification Script
// This script verifies that the Railway deployment is working correctly

const http = require('http');
const https = require('https');

const RAILWAY_URL = process.env.RAILWAY_URL || 'https://natural-kindness-production.up.railway.app';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://alvap-mvp-production.up.railway.app';

console.log('=== RAILWAY DEPLOYMENT VERIFICATION ===');
console.log('Backend URL:', RAILWAY_URL);
console.log('Frontend URL:', FRONTEND_URL);
console.log('');

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers, raw: true });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => reject(new Error('Request timeout')));
    req.end();
  });
}

async function verifyBackend() {
  console.log('🔍 Verifying Backend...');
  
  try {
    // Test health endpoint
    const healthResponse = await makeRequest(`${RAILWAY_URL}/health`);
    console.log('✅ Health Check:', healthResponse.status === 200 ? 'PASS' : 'FAIL');
    console.log('   Status:', healthResponse.status);
    console.log('   Response:', JSON.stringify(healthResponse.data, null, 2));
    
    // Test jobs API
    const jobsResponse = await makeRequest(`${RAILWAY_URL}/api/jobs`);
    console.log('✅ Jobs API:', jobsResponse.status === 200 ? 'PASS' : 'FAIL');
    console.log('   Status:', jobsResponse.status);
    console.log('   Jobs Count:', jobsResponse.data?.jobs?.length || 0);
    
    // Test pipeline stages API
    const stagesResponse = await makeRequest(`${RAILWAY_URL}/api/pipeline-stages`);
    console.log('✅ Pipeline Stages API:', stagesResponse.status === 200 ? 'PASS' : 'FAIL');
    console.log('   Status:', stagesResponse.status);
    console.log('   Stages Count:', stagesResponse.data?.length || 0);
    
    return healthResponse.status === 200 && jobsResponse.status === 200;
  } catch (error) {
    console.log('❌ Backend Error:', error.message);
    return false;
  }
}

async function verifyFrontend() {
  console.log('🔍 Verifying Frontend...');
  
  try {
    const response = await makeRequest(FRONTEND_URL);
    console.log('✅ Frontend:', response.status === 200 ? 'PASS' : 'FAIL');
    console.log('   Status:', response.status);
    console.log('   Content-Type:', response.headers['content-type']);
    
    // Check if it's serving HTML (not JSON)
    const isHtml = response.data.includes && response.data.includes('<html');
    console.log('   Serving HTML:', isHtml ? 'YES' : 'NO');
    
    return response.status === 200 && isHtml;
  } catch (error) {
    console.log('❌ Frontend Error:', error.message);
    return false;
  }
}

async function verifyIntegration() {
  console.log('🔍 Verifying Integration...');
  
  try {
    // Test if frontend can reach backend
    const response = await makeRequest(`${FRONTEND_URL}/api/jobs`);
    console.log('✅ Frontend-Backend Integration:', response.status === 200 ? 'PASS' : 'FAIL');
    console.log('   Status:', response.status);
    
    return response.status === 200;
  } catch (error) {
    console.log('❌ Integration Error:', error.message);
    return false;
  }
}

async function runVerification() {
  console.log('Starting deployment verification...\n');
  
  const backendOk = await verifyBackend();
  console.log('');
  
  const frontendOk = await verifyFrontend();
  console.log('');
  
  const integrationOk = await verifyIntegration();
  console.log('');
  
  console.log('=== VERIFICATION SUMMARY ===');
  console.log('Backend:', backendOk ? '✅ WORKING' : '❌ FAILED');
  console.log('Frontend:', frontendOk ? '✅ WORKING' : '❌ FAILED');
  console.log('Integration:', integrationOk ? '✅ WORKING' : '❌ FAILED');
  
  const allOk = backendOk && frontendOk && integrationOk;
  console.log('');
  console.log('Overall Status:', allOk ? '🎉 ALL SYSTEMS WORKING' : '⚠️ ISSUES DETECTED');
  
  if (!allOk) {
    console.log('');
    console.log('Troubleshooting Steps:');
    if (!backendOk) {
      console.log('1. Check Railway backend service logs');
      console.log('2. Verify environment variables (PORT, DATABASE_URL)');
      console.log('3. Ensure npm run start:server is working locally');
    }
    if (!frontendOk) {
      console.log('4. Check Railway frontend service logs');
      console.log('5. Verify frontend build completed successfully');
      console.log('6. Check VITE_API_BASE environment variable');
    }
    if (!integrationOk) {
      console.log('7. Check CORS configuration');
      console.log('8. Verify API endpoints are accessible');
    }
  }
  
  process.exit(allOk ? 0 : 1);
}

// Run verification
runVerification().catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});
