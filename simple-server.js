// Simple server using CommonJS require (not ES modules)
console.log('=== SIMPLE SERVER STARTING ===');
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());

// Test basic functionality
console.log('Testing basic math...');
const result = 2 + 2;
console.log('2 + 2 =', result);

console.log('Testing string operations...');
const message = 'Hello from Railway!';
console.log('Message:', message);

// Create a basic HTTP server without Express
console.log('Creating HTTP server...');
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3001;

// Simple CV parsing function
function parseCVContent(text) {
  console.log('Parsing CV content...');
  
  // Extract basic information using regex
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const phoneMatch = text.match(/(\+?[\d\s\-\(\)]{10,})/);
  
  // Extract name from first line
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  let firstName = '';
  let lastName = '';
  
  if (lines.length > 0) {
    const firstLine = lines[0];
    const words = firstLine.split(/\s+/);
    if (words.length >= 2) {
      firstName = words[0];
      lastName = words.slice(1).join(' ');
    } else if (words.length === 1) {
      firstName = words[0];
    }
  }
  
  // Extract skills based on keywords
  const textLower = text.toLowerCase();
  const skills = {
    communications: /communications?|comms?|media|press|pr|public relations|marketing/i.test(textLower),
    campaigns: /campaigns?|advocacy|engagement|grassroots|activism|outreach/i.test(textLower),
    policy: /policy|policies|briefing|consultation|legislative|regulatory|government/i.test(textLower),
    publicAffairs: /public affairs|government affairs|parliamentary|stakeholder relations|lobbying/i.test(textLower)
  };
  
  // Generate tags
  const tags = [];
  if (skills.communications) tags.push('communications');
  if (skills.campaigns) tags.push('campaigns');
  if (skills.policy) tags.push('policy');
  if (skills.publicAffairs) tags.push('public-affairs');
  
  return {
    firstName,
    lastName,
    email: emailMatch ? emailMatch[1] : '',
    phone: phoneMatch ? phoneMatch[1] : '',
    skills,
    tags,
    notes: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
    confidence: 0.8
  };
}

const server = http.createServer((req, res) => {
  console.log('Request received:', req.method, req.url);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.url === '/health') {
    console.log('Health check requested');
    res.writeHead(200);
    res.end(JSON.stringify({ 
      ok: true, 
      message: 'Hello from Railway!',
      timestamp: new Date().toISOString(),
      result: result,
      platform: process.platform
    }));
  } else if (req.url === '/api/candidates/parse-cv' && req.method === 'POST') {
    console.log('CV parse requested');
    
    // Handle file upload
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // Simple text parsing (for now - can be enhanced for file uploads)
        const parsedData = parseCVContent(body);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
          success: true,
          data: parsedData,
          timestamp: new Date().toISOString(),
          message: 'CV parsed successfully'
        }));
      } catch (error) {
        console.error('CV parsing error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ 
          success: false,
          error: 'Failed to parse CV',
          message: error.message
        }));
      }
    });
  } else if (req.url === '/test-cv' && req.method === 'GET') {
    console.log('Test CV parsing requested');
    
    // Test with sample CV data
    const sampleCV = `John Smith
Senior Communications Manager
john.smith@email.com
+44 20 7123 4567

EXPERIENCE
Senior Communications Manager at ABC Company (2020-2023)
- Led strategic communications campaigns
- Managed public relations and media outreach
- Developed policy briefings for government stakeholders

Communications Officer at XYZ Agency (2018-2020)
- Coordinated advocacy campaigns
- Managed stakeholder relations
- Developed public affairs strategies

SKILLS
- Strategic communications
- Public relations
- Policy development
- Stakeholder engagement
- Campaign management`;

    const parsedData = parseCVContent(sampleCV);
    
    res.writeHead(200);
    res.end(JSON.stringify({ 
      success: true,
      data: parsedData,
      timestamp: new Date().toISOString(),
      message: 'Sample CV parsed successfully'
    }));
  } else if (req.url === '/') {
    console.log('Root route requested');
    res.writeHead(200);
    res.end(JSON.stringify({ 
      message: 'Simple Server is running!',
      timestamp: new Date().toISOString(),
      status: 'success',
      endpoints: {
        health: '/health',
        cvParse: '/api/candidates/parse-cv (POST)',
        testCV: '/test-cv (GET)'
      }
    }));
  } else {
    console.log('404 - Route not found:', req.url);
    res.writeHead(404);
    res.end(JSON.stringify({ 
      error: 'Not Found',
      message: 'Route not found',
      url: req.url
    }));
  }
});

console.log('Starting server...');
server.listen(PORT, '0.0.0.0', () => {
  console.log('=== SIMPLE SERVER STARTED SUCCESSFULLY ===');
  console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ Root: http://0.0.0.0:${PORT}/`);
});

console.log('=== SIMPLE SERVER SETUP COMPLETED ===');
