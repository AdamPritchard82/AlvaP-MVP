// Minimal Jobs API Server for Railway
console.log('=== MINIMAL JOBS API SERVER STARTING ===');

const http = require('http');
const PORT = process.env.PORT || 3001;

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
    createdBy: "system"
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
    createdBy: "system"
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
    createdBy: "system"
  }
];

let nextJobId = 4;

const server = http.createServer((req, res) => {
  console.log('Request received:', req.method, req.url);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.url === '/health') {
    console.log('Health check requested');
    res.writeHead(200);
    res.end(JSON.stringify({ 
      ok: true, 
      message: 'Minimal Jobs API Server Running',
      timestamp: new Date().toISOString(),
      jobs: jobs.length
    }));
  } else if (req.url === '/api/jobs' && req.method === 'GET') {
    console.log('Jobs list requested');
    res.writeHead(200);
    res.end(JSON.stringify({ 
      success: true,
      jobs: jobs,
      total: jobs.length,
      timestamp: new Date().toISOString()
    }));
  } else if (req.url === '/api/jobs' && req.method === 'POST') {
    console.log('Create job requested');
    
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
          createdBy: 'system'
        };
        
        jobs.push(job);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
          success: true,
          data: job,
          message: 'Job created successfully',
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error('Create job error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ 
          success: false,
          error: 'Failed to create job',
          message: error.message
        }));
      }
    });
  } else if (req.url.startsWith('/api/jobs/') && req.url.endsWith('/status') && req.method === 'PATCH') {
    console.log('Update job status requested');
    
    const jobId = parseInt(req.url.split('/')[3]);
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { status } = JSON.parse(body);
        const validStatuses = ['New', 'Reviewed', 'Contacted', 'Interviewed', 'Offered', 'Placed', 'Rejected'];
        
        if (!validStatuses.includes(status)) {
          res.writeHead(400);
          res.end(JSON.stringify({ 
            success: false,
            error: 'Invalid status'
          }));
          return;
        }
        
        const job = jobs.find(j => j.id === jobId);
        if (!job) {
          res.writeHead(404);
          res.end(JSON.stringify({ 
            success: false,
            error: 'Job not found'
          }));
          return;
        }
        
        job.status = status;
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
          success: true,
          data: { id: jobId.toString(), status },
          message: 'Job status updated successfully',
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error('Update job status error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ 
          success: false,
          error: 'Failed to update job status',
          message: error.message
        }));
      }
    });
  } else {
    console.log('404 - Route not found:', req.url);
    res.writeHead(404);
    res.end(JSON.stringify({ 
      error: 'Not Found',
      message: 'Route not found',
      url: req.url,
      availableEndpoints: ['/health', '/api/jobs']
    }));
  }
});

console.log('Starting minimal server...');
server.listen(PORT, '0.0.0.0', () => {
  console.log('=== MINIMAL JOBS API SERVER STARTED ===');
  console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ Jobs API: http://0.0.0.0:${PORT}/api/jobs`);
  console.log(`✅ Jobs loaded: ${jobs.length}`);
});

console.log('=== MINIMAL SERVER SETUP COMPLETED ===');
