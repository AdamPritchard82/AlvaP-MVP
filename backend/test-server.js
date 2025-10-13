// Test the enhanced CV server
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function testServer() {
  console.log('=== TESTING ENHANCED CV SERVER ===');
  
  try {
    // Test health endpoint
    console.log('Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:3001/health');
    const healthData = await healthResponse.json();
    console.log('Health check:', healthData);
    
    // Test CV parsing
    console.log('\nTesting CV parsing...');
    const form = new FormData();
    form.append('file', fs.createReadStream('./test/data/sample-cv.txt'));
    
    const parseResponse = await fetch('http://localhost:3001/api/candidates/parse-cv', {
      method: 'POST',
      body: form
    });
    
    const parseData = await parseResponse.json();
    console.log('Parse response:', JSON.stringify(parseData, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testServer();












