// Test CV parsing locally before Railway deployment
const fs = require('fs');
const FormData = require('form-data');
const https = require('https');
const http = require('http');

async function testLocalParsing() {
  console.log('=== TESTING LOCAL CV PARSING ===');
  
  try {
    // Start the local server
    console.log('Starting local server...');
    const { spawn } = require('child_process');
    const server = spawn('node', ['src/simple-candidate-server.js'], { 
      stdio: 'pipe',
      cwd: __dirname 
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test health endpoint
    console.log('Testing health endpoint...');
    const healthData = await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:3001/health', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
    });
    console.log('✅ Health check:', healthData);
    
    // Test CV parsing with sample text
    console.log('\nTesting CV parsing...');
    const sampleText = `John Smith
Senior Communications Manager
john.smith@email.com
+44 20 7123 4567

PROFESSIONAL SUMMARY
Experienced communications professional with over 8 years in public affairs and policy communications. Specialized in campaign management, stakeholder engagement, and media relations within the political sector.

EXPERIENCE
Senior Communications Manager — ABC Campaign Group (2020 - Present)
• Led strategic communications for high-profile political campaigns
• Managed media relations and press office operations

Communications Officer — XYZ Policy Institute (2018 - 2020)
• Created policy briefings and consultation documents
• Managed social media presence and content strategy

SKILLS
• Public Affairs and Government Relations
• Campaign Management and Strategy
• Media Relations and Press Office
• Policy Analysis and Research`;

    // Create a temporary file
    fs.writeFileSync('./temp-cv.txt', sampleText);
    
    const form = new FormData();
    form.append('file', fs.createReadStream('./temp-cv.txt'));
    
    const parseData = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/api/candidates/parse-cv',
        method: 'POST',
        headers: form.getHeaders()
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      form.pipe(req);
    });
    
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
    } else {
      console.log('❌ CV Parsing FAILED');
      console.log('   Error:', parseData.error);
    }
    
    // Clean up
    fs.unlinkSync('./temp-cv.txt');
    server.kill();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLocalParsing();
