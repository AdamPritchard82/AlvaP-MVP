// Test Railway CV parsing deployment
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

const RAILWAY_URL = 'https://natural-kindness-production.up.railway.app';

async function testRailwayParsing() {
  console.log('=== TESTING RAILWAY CV PARSING ===');
  console.log(`Testing: ${RAILWAY_URL}`);
  
  try {
    // Test 1: Health check
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await fetch(`${RAILWAY_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    
    // Test 2: CV parsing with sample text file
    console.log('\n2. Testing CV parsing with sample text file...');
    const form = new FormData();
    form.append('file', fs.createReadStream('./backend/test/data/sample-cv.txt'));
    
    const parseResponse = await fetch(`${RAILWAY_URL}/api/candidates/parse-cv`, {
      method: 'POST',
      body: form
    });
    
    const parseData = await parseResponse.json();
    
    if (parseData.success) {
      console.log('✅ CV Parsing SUCCESS!');
      console.log(`   Name: ${parseData.data.firstName} ${parseData.data.lastName}`);
      console.log(`   Email: ${parseData.data.email}`);
      console.log(`   Phone: ${parseData.data.phone}`);
      console.log(`   Source: ${parseData.data.source}`);
      console.log(`   Text Length: ${parseData.data.textLength} chars`);
      console.log(`   Confidence: ${parseData.data.confidence.toFixed(2)}`);
      console.log(`   Experience Entries: ${parseData.data.experience.length}`);
      console.log(`   Skills Detected:`);
      Object.entries(parseData.data.skills).forEach(([skill, detected]) => {
        console.log(`     ${skill}: ${detected ? '✅' : '❌'}`);
      });
      console.log(`   Notes: ${parseData.data.notes.substring(0, 100)}...`);
    } else {
      console.log('❌ CV Parsing FAILED');
      console.log('   Error:', parseData.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test with different file types
async function testAllFormats() {
  console.log('\n=== TESTING ALL FILE FORMATS ===');
  
  const testFiles = [
    { file: './backend/test/data/sample-cv.txt', type: 'TXT' },
    { file: './backend/test/data/sample-cv-simple.txt', type: 'TXT' }
  ];
  
  for (const testFile of testFiles) {
    console.log(`\n📄 Testing ${testFile.type}: ${testFile.file}`);
    console.log('─'.repeat(50));
    
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(testFile.file));
      
      const response = await fetch(`${RAILWAY_URL}/api/candidates/parse-cv`, {
        method: 'POST',
        body: form
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ SUCCESS!');
        console.log(`   Name: ${data.data.firstName} ${data.data.lastName}`);
        console.log(`   Email: ${data.data.email}`);
        console.log(`   Source: ${data.data.source}`);
        console.log(`   Confidence: ${data.data.confidence.toFixed(2)}`);
        console.log(`   Experience: ${data.data.experience.length} entries`);
      } else {
        console.log('❌ FAILED');
        console.log(`   Error: ${data.error.message}`);
      }
      
    } catch (error) {
      console.log('❌ CONNECTION ERROR');
      console.log(`   Error: ${error.message}`);
    }
  }
}

// Run tests
testRailwayParsing().then(() => {
  console.log('\n' + '='.repeat(60));
  return testAllFormats();
}).then(() => {
  console.log('\n✅ All tests completed!');
}).catch(console.error);


