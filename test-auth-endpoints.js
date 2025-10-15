#!/usr/bin/env node

/**
 * Test Authentication Endpoints
 * 
 * This script tests the new authentication endpoints to make sure they work.
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001';

async function testAuthEndpoints() {
  console.log('🧪 Testing Authentication Endpoints...\n');

  try {
    // Test 1: Register a new user
    console.log('1. Testing user registration...');
    const registerResponse = await axios.post(`${API_BASE}/api/auth/register`, {
      email: 'test@example.com',
      password: 'test123',
      name: 'Test User',
      role: 'consultant'
    });
    
    console.log('✅ Registration successful:', registerResponse.data.message);
    console.log('   User ID:', registerResponse.data.user.id);
    console.log('   Token received:', !!registerResponse.data.token);

    // Test 2: Login with the new user
    console.log('\n2. Testing user login...');
    const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
      email: 'test@example.com',
      password: 'test123'
    });
    
    console.log('✅ Login successful');
    console.log('   User:', loginResponse.data.user.name);
    console.log('   Role:', loginResponse.data.user.role);
    console.log('   Token received:', !!loginResponse.data.token);

    // Test 3: Get current user info
    console.log('\n3. Testing get current user...');
    const meResponse = await axios.get(`${API_BASE}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${loginResponse.data.token}`
      }
    });
    
    console.log('✅ Get current user successful');
    console.log('   User info:', meResponse.data.user);

    // Test 4: Test invalid login
    console.log('\n4. Testing invalid login...');
    try {
      await axios.post(`${API_BASE}/api/auth/login`, {
        email: 'test@example.com',
        password: 'wrongpassword'
      });
      console.log('❌ Invalid login should have failed');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Invalid login correctly rejected');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    console.log('\n🎉 All authentication tests passed!');
    console.log('\n📋 Next Steps:');
    console.log('1. Deploy to Railway');
    console.log('2. Test the new login page');
    console.log('3. Create your admin account');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    console.log('\n💡 Make sure the server is running: npm run start');
  }
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${API_BASE}/health`);
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Server is not running');
    console.log('💡 Start the server first: npm run start');
    process.exit(1);
  }

  await testAuthEndpoints();
}

main().catch(console.error);
