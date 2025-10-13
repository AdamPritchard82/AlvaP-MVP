// Test all file formats
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function testAllFormats() {
  console.log('=== TESTING ALL FILE FORMATS ===');
  
  const testFiles = [
    { file: './test/data/sample-cv.txt', type: 'TXT' },
    { file: './test/data/proper-test.pdf', type: 'PDF' },
    { file: './test/data/proper-test.docx', type: 'DOCX' }
  ];
  
  for (const testFile of testFiles) {
    console.log(`\n📄 Testing ${testFile.type} file: ${testFile.file}`);
    console.log('─'.repeat(50));
    
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(testFile.file));
      
      const response = await fetch('http://localhost:3001/api/candidates/parse-cv', {
        method: 'POST',
        body: form
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ SUCCESS!');
        console.log(`   Adapter: ${data.data.source}`);
        console.log(`   Text length: ${data.data.textLength} chars`);
        console.log(`   Confidence: ${data.data.confidence.toFixed(2)}`);
        console.log(`   Name: ${data.data.firstName} ${data.data.lastName}`);
        console.log(`   Email: ${data.data.email}`);
        console.log(`   Experience entries: ${data.data.experience.length}`);
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

// Wait a moment for server to start
setTimeout(testAllFormats, 2000);











