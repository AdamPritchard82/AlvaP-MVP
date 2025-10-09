// Simple Server - API First, then Frontend
console.log('=== SIMPLE SERVER STARTING ===');

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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

// API Routes - DEFINED FIRST
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    message: 'Simple server running'
  });
});

app.get('/api/jobs', (req, res) => {
  console.log('=== GET JOBS ===');
  res.json({
    success: true,
    jobs: jobs,
    total: jobs.length
  });
});

app.post('/api/jobs', (req, res) => {
  console.log('=== CREATE JOB ===');
  const { title, description, requiredSkills, salaryMin, salaryMax, location, company, isPublic, publicSlug, publicSummary, clientPublicName, employmentType } = req.body;
  
  const job = {
    id: nextJobId++,
    title: title || '',
    description: description || '',
    requiredSkills: requiredSkills || {},
    salaryMin: Number(salaryMin) || 0,
    salaryMax: Number(salaryMax) || 0,
    location: location || '',
    company: company || '',
    isPublic: Boolean(isPublic),
    publicSlug: publicSlug || null,
    publicSummary: publicSummary || '',
    clientPublicName: clientPublicName || '',
    employmentType: employmentType || 'Full-time',
    status: 'New',
    createdAt: new Date().toISOString(),
    createdBy: 'system'
  };
  
  jobs.push(job);
  res.json({
    success: true,
    data: job,
    message: 'Job created successfully'
  });
});

app.patch('/api/jobs/:id/status', (req, res) => {
  console.log('=== UPDATE JOB STATUS ===');
  const jobId = parseInt(req.params.id);
  const { status } = req.body;
  
  const validStatuses = ['New', 'Reviewed', 'Contacted', 'Interviewed', 'Offered', 'Placed', 'Rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid status'
    });
  }
  
  const job = jobs.find(j => j.id === jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }
  
  job.status = status;
  res.json({
    success: true,
    data: { id: jobId.toString(), status },
    message: 'Job status updated successfully'
  });
});

// Serve static frontend files ONLY for non-API routes
const frontendDistPath = path.join(__dirname, 'frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') {
      return next(); // Skip static serving for API routes
    }
    return express.static(frontendDistPath)(req, res, next);
  });
  console.log('✅ Frontend files found, serving static files (excluding API routes)');
} else {
  console.log('⚠️ Frontend dist folder not found, API-only mode');
}

// Catch-all handler for React routing
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'frontend/dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      message: 'AlvaP API Server Running',
      status: 'ok',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        jobs: '/api/jobs',
        createJob: 'POST /api/jobs',
        updateJobStatus: 'PATCH /api/jobs/:id/status'
      },
      note: 'Frontend not built. This is API-only mode.'
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('=== SIMPLE SERVER STARTED ===');
  console.log('✅ Server listening on 0.0.0.0:' + PORT);
  console.log('✅ Health check: http://0.0.0.0:' + PORT + '/health');
  console.log('✅ API: http://0.0.0.0:' + PORT + '/api/jobs');
  console.log('✅ Frontend: http://0.0.0.0:' + PORT);
  console.log('✅ Jobs loaded:', jobs.length);
});
