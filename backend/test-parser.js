// Simple test for CV parser
import { parseBuffer } from './src/parsers/cvParser.js';

const testText = `John Smith
Senior Communications Manager
john.smith@example.com
Phone: +44 7700 900123

EXPERIENCE:
Senior Communications Manager at Example Corp (2019-Present)
Communications Specialist at PR Agency (2017-2019)

SKILLS:
- Communications and media relations
- Campaigns and advocacy
- Policy development and analysis
- Public affairs and stakeholder management`;

async function testParser() {
  try {
    console.log('Testing CV parser...');
    
    const buffer = Buffer.from(testText, 'utf8');
    const result = await parseBuffer(buffer, {
      mimetype: 'text/plain',
      filename: 'test.txt'
    });
    
    console.log('Parser result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Parser test failed:', error);
  }
}

testParser();











