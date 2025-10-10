// Test PDF parsing through the enhanced server
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function testPDFServer() {
  console.log('=== TESTING PDF PARSING THROUGH SERVER ===');
  
  try {
    // Test with the simple PDF
    console.log('Testing with simple-test.pdf...');
    const form = new FormData();
    form.append('file', fs.createReadStream('./test/data/simple-test.pdf'));
    
    const response = await fetch('http://localhost:3001/api/candidates/parse-cv', {
      method: 'POST',
      body: form
    });
    
    const data = await response.json();
    console.log('Server response:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testPDFServer();










