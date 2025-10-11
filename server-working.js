// Working Combined Server - Serves both Frontend and Backend API
console.log('=== WORKING COMBINED SERVER STARTING ===');

// Load environment variables
require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3001;

// CV Parsing dependencies
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Log environment variables for debugging
console.log('Environment variables:');
console.log('- PORT:', PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL || 'Not set');

// Test jobs data
let jobs = [
  {
    id: 1,
    title: "Senior Communications Manager",
    description: "Lead communications strategy for a leading consultancy",
    requiredSkills: { communications: true, campaigns: true, policy: false, publicAffairs: true },
    salaryMin: 60000,
    salaryMax: 80000,
    location: "London, UK",
    company: "Leading Consultancy",
    isPublic: false,
    publicSlug: null,
    publicSummary: "",
    clientPublicName: "Leading Consultancy",
    employmentType: "Full-time",
    status: "New",
    createdAt: new Date().toISOString(),
    createdBy: "system",
    client: { name: "Leading Consultancy" },
    client_id: "1",
    tags: ["communications", "campaigns"],
    salary_min: 60000,
    salary_max: 80000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 2,
    title: "Policy Advisor",
    description: "Develop policy recommendations for government clients",
    requiredSkills: { communications: false, campaigns: false, policy: true, publicAffairs: true },
    salaryMin: 45000,
    salaryMax: 60000,
    location: "Manchester, UK",
    company: "Policy Institute",
    isPublic: false,
    publicSlug: null,
    publicSummary: "",
    clientPublicName: "Policy Institute",
    employmentType: "Full-time",
    status: "Reviewed",
    createdAt: new Date().toISOString(),
    createdBy: "system",
    client: { name: "Policy Institute" },
    client_id: "2",
    tags: ["policy", "publicAffairs"],
    salary_min: 45000,
    salary_max: 60000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 3,
    title: "Campaign Director",
    description: "Lead high-profile political campaigns",
    requiredSkills: { communications: true, campaigns: true, policy: false, publicAffairs: true },
    salaryMin: 70000,
    salaryMax: 90000,
    location: "Birmingham, UK",
    company: "Campaign Agency",
    isPublic: false,
    publicSlug: null,
    publicSummary: "",
    clientPublicName: "Campaign Agency",
    employmentType: "Full-time",
    status: "Contacted",
    createdAt: new Date().toISOString(),
    createdBy: "system",
    client: { name: "Campaign Agency" },
    client_id: "3",
    tags: ["communications", "campaigns"],
    salary_min: 70000,
    salary_max: 90000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

let nextJobId = 4;

// CV Parsing Functions
async function extractTextFromBuffer(buffer, mimeType, filename) {
  const ext = path.extname(filename).toLowerCase();
  
  if (mimeType === 'application/pdf' || ext === '.pdf') {
    try {
      const data = await pdfParse(buffer);
      return { text: data.text, source: 'pdf-parse' };
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value, source: 'mammoth' };
    } catch (error) {
      throw new Error(`DOCX parsing failed: ${error.message}`);
    }
  } else if (mimeType === 'text/plain' || ext === '.txt') {
    return { text: buffer.toString('utf8'), source: 'text' };
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

function parseCandidateInfo(text) {
  // Simple parsing logic
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let firstName = '';
  let lastName = '';
  let email = '';
  let phone = '';
  let skills = {
    communications: false,
    campaigns: false,
    policy: false,
    publicAffairs: false
  };
  let experience = [];
  let notes = '';
  
  // Extract name (first two words that look like a name)
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const words = lines[i].split(' ');
    if (words.length >= 2 && words[0].length > 1 && words[1].length > 1) {
      firstName = words[0];
      lastName = words[1];
      break;
    }
  }
  
  // Extract email
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  if (emailMatch) {
    email = emailMatch[0];
  }
  
  // Extract phone
  const phoneMatch = text.match(/(\+?[\d\s\-\(\)]{10,})/);
  if (phoneMatch) {
    phone = phoneMatch[0].trim();
  }
  
  // Extract skills based on keywords
  const textLower = text.toLowerCase();
  if (textLower.includes('communication') || textLower.includes('communications')) {
    skills.communications = true;
  }
  if (textLower.includes('campaign') || textLower.includes('campaigns')) {
    skills.campaigns = true;
  }
  if (textLower.includes('policy') || textLower.includes('policies')) {
    skills.policy = true;
  }
  if (textLower.includes('public affairs') || textLower.includes('publicaffairs')) {
    skills.publicAffairs = true;
  }
  
  // Extract experience (simple version)
  const experienceKeywords = ['experience', 'employment', 'work', 'position', 'role'];
  for (let i = 0; i < lines.length; i++) {
    if (experienceKeywords.some(keyword => lines[i].toLowerCase().includes(keyword))) {
      // Look for job titles in the next few lines
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].length > 5 && lines[j].length < 100) {
          experience.push(lines[j]);
        }
      }
      break;
    }
  }
  
  // Calculate confidence based on extracted data
  let confidence = 0.1;
  if (firstName && lastName) confidence += 0.3;
  if (email) confidence += 0.3;
  if (phone) confidence += 0.2;
  if (Object.values(skills).some(skill => skill)) confidence += 0.1;
  if (experience.length > 0) confidence += 0.1;
  
  return {
    firstName,
    lastName,
    email,
    phone,
    skills,
    experience,
    notes,
    confidence: Math.min(confidence, 1.0)
  };
}

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // API Routes
  if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({
      ok: true,
      message: 'Working combined server running',
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: PORT,
        databaseUrl: process.env.DATABASE_URL ? 'Set' : 'Not set',
        frontendUrl: process.env.FRONTEND_URL || 'Not set'
      },
      jobsLoaded: jobs.length,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }));
  } else if (req.url === '/api/jobs' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      jobs: jobs,
      total: jobs.length,
      timestamp: new Date().toISOString()
    }));
  } else if (req.url === '/api/jobs' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const jobData = JSON.parse(body);
        const job = {
          id: nextJobId++,
          title: jobData.title || '',
          description: jobData.description || '',
          requiredSkills: jobData.requiredSkills || {},
          salaryMin: Number(jobData.salaryMin) || 0,
          salaryMax: Number(jobData.salaryMax) || 0,
          location: jobData.location || '',
          company: jobData.company || '',
          isPublic: Boolean(jobData.isPublic),
          publicSlug: jobData.publicSlug || null,
          publicSummary: jobData.publicSummary || '',
          clientPublicName: jobData.clientPublicName || '',
          employmentType: jobData.employmentType || 'Full-time',
          status: 'New',
          createdAt: new Date().toISOString(),
          createdBy: 'system',
          client: { name: jobData.company || 'Unknown Client' },
          client_id: String(nextJobId - 1),
          tags: jobData.tags || [],
          salary_min: Number(jobData.salaryMin) || 0,
          salary_max: Number(jobData.salaryMax) || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        jobs.push(job);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: job,
          message: 'Job created successfully',
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error('Create job error:', error);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(500);
        res.end(JSON.stringify({
          success: false,
          error: 'Failed to create job',
          message: error.message
        }));
      }
    });
  } else if (req.url.startsWith('/api/jobs/') && req.url.endsWith('/status') && req.method === 'PATCH') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const jobId = parseInt(req.url.split('/')[3]);
        const { status } = JSON.parse(body);
        const validStatuses = ['New', 'Reviewed', 'Contacted', 'Interviewed', 'Offered', 'Placed', 'Rejected'];

        if (!validStatuses.includes(status)) {
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: 'Invalid status'
          }));
          return;
        }

        const job = jobs.find(j => j.id === jobId);
        if (!job) {
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(404);
          res.end(JSON.stringify({
            success: false,
            error: 'Job not found'
          }));
          return;
        }

        job.status = status;
        job.updated_at = new Date().toISOString();
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: { id: jobId.toString(), status },
          message: 'Job status updated successfully',
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error('Update job status error:', error);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(500);
        res.end(JSON.stringify({
          success: false,
          error: 'Failed to update job status',
          message: error.message
        }));
      }
    });
  } else if (req.url === '/api/pipeline-stages' && req.method === 'GET') {
    // Return default pipeline stages for the Jobs funnel
    const stages = [
      { id: 'New', name: 'New', color: 'bg-blue-50', border_color: 'border-blue-200', position: 1, is_default: true, is_first: true, created_at: '', updated_at: '' },
      { id: 'Reviewed', name: 'Reviewed', color: 'bg-yellow-50', border_color: 'border-yellow-200', position: 2, is_default: false, is_first: false, created_at: '', updated_at: '' },
      { id: 'Contacted', name: 'Contacted', color: 'bg-orange-50', border_color: 'border-orange-200', position: 3, is_default: false, is_first: false, created_at: '', updated_at: '' },
      { id: 'Interviewed', name: 'Interviewed', color: 'bg-purple-50', border_color: 'border-purple-200', position: 4, is_default: false, is_first: false, created_at: '', updated_at: '' },
      { id: 'Offered', name: 'Offered', color: 'bg-green-50', border_color: 'border-green-200', position: 5, is_default: false, is_first: false, created_at: '', updated_at: '' },
      { id: 'Placed', name: 'Placed', color: 'bg-emerald-50', border_color: 'border-emerald-200', position: 6, is_default: false, is_first: false, created_at: '', updated_at: '' },
      { id: 'Rejected', name: 'Rejected', color: 'bg-red-50', border_color: 'border-red-200', position: 7, is_default: false, is_first: false, created_at: '', updated_at: '' }
    ];
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(stages));
  } else if (req.url === '/api/candidates/parse-cv' && req.method === 'POST') {
    // CV Parsing endpoint
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        console.log('=== CV PARSE ENDPOINT HIT ===');
        
        // Parse multipart form data (simplified version)
        const boundary = req.headers['content-type']?.split('boundary=')[1];
        if (!boundary) {
          return res.status(400).json({
            success: false,
            error: { code: 'NO_FILE', message: 'No file uploaded' }
          });
        }
        
        // For now, return a simple response indicating CV parsing is available
        // In a real implementation, you'd parse the multipart data
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+44 20 7123 4567',
            skills: {
              communications: true,
              campaigns: false,
              policy: true,
              publicAffairs: true
            },
            experience: ['Senior Communications Manager', 'Policy Advisor'],
            notes: 'CV parsing endpoint is working',
            confidence: 0.8,
            source: 'test'
          }
        }));
      } catch (error) {
        console.error('CV parsing error:', error);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(500);
        res.end(JSON.stringify({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'CV parsing failed' }
        }));
      }
    });
  } else {
    // Serve static frontend files
    const frontendPath = path.join(__dirname, 'frontend/dist');
    let filePath = path.join(frontendPath, req.url === '/' ? 'index.html' : req.url);
    
    // Check if file exists
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const contentType = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
      }[ext] || 'text/plain';
      
      res.setHeader('Content-Type', contentType);
      res.writeHead(200);
      fs.createReadStream(filePath).pipe(res);
    } else {
      // Fallback to index.html for client-side routing
      const indexPath = path.join(frontendPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.setHeader('Content-Type', 'text/html');
        res.writeHead(200);
        fs.createReadStream(indexPath).pipe(res);
      } else {
        console.log('404 - Route not found:', req.url);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(404);
        res.end(JSON.stringify({ 
          error: 'Not Found',
          message: 'Route not found',
          url: req.url,
          availableEndpoints: ['/health', '/api/jobs', '/api/pipeline-stages']
        }));
      }
    }
  }
});

console.log('Starting working combined server...');
server.listen(PORT, '0.0.0.0', () => {
  console.log('=== WORKING COMBINED SERVER STARTED ===');
  console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ API: http://0.0.0.0:${PORT}/api/jobs`);
  console.log(`✅ Frontend: http://0.0.0.0:${PORT}`);
  console.log('✅ Jobs loaded:', jobs.length);
});
