// Test detailed CV parsing results
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SimpleEnhancedCvParser } from './src/parsers/simpleEnhancedCvParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testDetailedParsing() {
  console.log('=== DETAILED CV PARSING TEST ===');
  
  const parser = new SimpleEnhancedCvParser();
  const testFiles = ['sample-cv.txt', 'sample-cv-simple.txt'];
  
  for (const filename of testFiles) {
    const filePath = path.join(__dirname, 'test', 'data', filename);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Test file not found: ${filename}`);
      continue;
    }
    
    console.log(`\n📄 Testing: ${filename}`);
    console.log('─'.repeat(60));
    
    try {
      const buffer = fs.readFileSync(filePath);
      const mimetype = 'text/plain';
      
      // Parse file
      const parseResult = await parser.parseFile(buffer, mimetype, filename);
      console.log(`✅ File parsed successfully using ${parseResult.adapter}`);
      console.log(`📊 Text length: ${parseResult.text.length} characters`);
      console.log(`🎯 Parse confidence: ${parseResult.confidence.toFixed(2)}`);
      
      // Parse candidate info
      const candidateInfo = parser.parseCandidateInfo(parseResult.text);
      console.log(`\n👤 CANDIDATE INFORMATION EXTRACTED:`);
      console.log(`   Name: ${candidateInfo.firstName} ${candidateInfo.lastName}`);
      console.log(`   Email: ${candidateInfo.email}`);
      console.log(`   Phone: ${candidateInfo.phone}`);
      console.log(`   Confidence: ${candidateInfo.confidence.toFixed(2)}`);
      
      console.log(`\n🎯 SKILLS DETECTED:`);
      Object.entries(candidateInfo.skills).forEach(([skill, detected]) => {
        console.log(`   ${skill}: ${detected ? '✅' : '❌'}`);
      });
      
      console.log(`\n💼 EXPERIENCE EXTRACTED (${candidateInfo.experience.length} entries):`);
      candidateInfo.experience.forEach((exp, index) => {
        console.log(`   ${index + 1}. ${exp.title} at ${exp.employer} (${exp.startDate} - ${exp.endDate})`);
      });
      
      console.log(`\n📝 NOTES (first 200 chars):`);
      console.log(`   ${candidateInfo.notes}`);
      
      console.log(`\n📄 RAW TEXT (first 300 chars):`);
      console.log(`   ${parseResult.text.substring(0, 300)}...`);
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
}

testDetailedParsing().catch(console.error);








