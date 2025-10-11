// Combined Server with Jobs and CV Parsing
console.log('=== COMBINED SERVER WITH CV PARSING STARTING ===');

// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload setup for CV parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  }
});

// Test jobs data (same as server-working.js)
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

// Health check
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    message: 'Combined server with CV parsing running',
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
  });
});

// Jobs API Routes
app.get('/api/jobs', (req, res) => {
  console.log('=== GET JOBS ===');
  try {
    const sortedJobs = [...jobs].reverse();
    console.log('✅ Returning jobs:', sortedJobs.length);
    
    res.json({
      success: true,
      jobs: sortedJobs,
      total: sortedJobs.length
    });
  } catch (error) {
    console.error('❌ Get jobs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get jobs',
      message: error.message
    });
  }
});

app.post('/api/jobs', (req, res) => {
  console.log('=== CREATE JOB ===');
  try {
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
      createdBy: 'system',
      client: { name: company || 'Unknown Client' },
      client_id: String(nextJobId - 1),
      tags: [],
      salary_min: Number(salaryMin) || 0,
      salary_max: Number(salaryMax) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    jobs.push(job);
    console.log('✅ Job created:', job);
    
    res.json({
      success: true,
      data: job,
      message: 'Job created successfully'
    });
  } catch (error) {
    console.error('❌ Create job error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create job',
      message: error.message
    });
  }
});

app.patch('/api/jobs/:id/status', (req, res) => {
  console.log('=== UPDATE JOB STATUS ===');
  try {
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
    job.updated_at = new Date().toISOString();
    console.log('✅ Job status updated:', jobId, 'to', status);
    
    res.json({
      success: true,
      data: { id: jobId.toString(), status },
      message: 'Job status updated successfully'
    });
  } catch (error) {
    console.error('❌ Update job status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update job status',
      message: error.message
    });
  }
});

app.get('/api/pipeline-stages', (req, res) => {
  const stages = [
    { id: 'New', name: 'New', color: 'bg-blue-50', border_color: 'border-blue-200', position: 1, is_default: true, is_first: true, created_at: '', updated_at: '' },
    { id: 'Reviewed', name: 'Reviewed', color: 'bg-yellow-50', border_color: 'border-yellow-200', position: 2, is_default: false, is_first: false, created_at: '', updated_at: '' },
    { id: 'Contacted', name: 'Contacted', color: 'bg-orange-50', border_color: 'border-orange-200', position: 3, is_default: false, is_first: false, created_at: '', updated_at: '' },
    { id: 'Interviewed', name: 'Interviewed', color: 'bg-purple-50', border_color: 'border-purple-200', position: 4, is_default: false, is_first: false, created_at: '', updated_at: '' },
    { id: 'Offered', name: 'Offered', color: 'bg-green-50', border_color: 'border-green-200', position: 5, is_default: false, is_first: false, created_at: '', updated_at: '' },
    { id: 'Placed', name: 'Placed', color: 'bg-emerald-50', border_color: 'border-emerald-200', position: 6, is_default: false, is_first: false, created_at: '', updated_at: '' },
    { id: 'Rejected', name: 'Rejected', color: 'bg-red-50', border_color: 'border-red-200', position: 7, is_default: false, is_first: false, created_at: '', updated_at: '' }
  ];
  res.json(stages);
});

// CV Parsing endpoint
app.post('/api/candidates/parse-cv', upload.single('file'), async (req, res) => {
  try {
    console.log('=== CV PARSE ENDPOINT HIT ===');
    console.log('Request file:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'No file');
    
    if (!req.file) {
      return res.status(400).json({ 
        error: { 
          code: 'NO_FILE', 
          message: 'No file uploaded' 
        } 
      });
    }

    // Extract text from file
    let text, source;
    try {
      const result = await extractTextFromBuffer(req.file.buffer, req.file.mimetype, req.file.originalname);
      text = result.text;
      source = result.source;
    } catch (extractError) {
      console.error(`Text extraction failed: ${extractError.message}`);
      return res.status(422).json({ 
        success: false, 
        error: { 
          code: 'PARSE_FAILED', 
          message: 'Could not extract text from the uploaded file',
          details: extractError.message
        }
      });
    }
    
    // Parse candidate info
    let parsed;
    try {
      parsed = parseCandidateInfo(text);
    } catch (parseError) {
      console.error(`Text parsing failed: ${parseError.message}`);
      return res.status(422).json({ 
        success: false, 
        error: { 
          code: 'PARSE_FAILED', 
          message: 'Could not parse the extracted text',
          details: parseError.message
        }
      });
    }
    
    console.log('=== CV PARSE OK ===');
    console.log(`Source: ${source}`);
    console.log(`Confidence: ${parsed.confidence}`);
    
    res.json({ 
      success: true, 
      data: {
        ...parsed,
        source
      }
    });
    
  } catch (error) {
    console.error('CV parsing error:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'SERVER_ERROR', 
        message: 'Internal server error during CV parsing',
        details: error.message
      }
    });
  }
});

// Serve static frontend files (if they exist)
const frontendDistPath = path.join(__dirname, 'frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  console.log('✅ Frontend files found, serving static files');
} else {
  console.log('⚠️ Frontend dist folder not found, API-only mode');
}

// Catch-all handler: send back React's index.html file for client-side routing
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'frontend/dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      message: 'AlvaP Combined Server Running',
      status: 'ok',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        jobs: '/api/jobs',
        createJob: 'POST /api/jobs',
        updateJobStatus: 'PATCH /api/jobs/:id/status',
        parseCV: 'POST /api/candidates/parse-cv'
      },
      note: 'Frontend not built. This is API-only mode.'
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('=== COMBINED SERVER WITH CV PARSING STARTED ===');
  console.log('✅ Server listening on 0.0.0.0:' + PORT);
  console.log('✅ Health check: http://0.0.0.0:' + PORT + '/health');
  console.log('✅ Jobs API: http://0.0.0.0:' + PORT + '/api/jobs');
  console.log('✅ CV Parsing: http://0.0.0.0:' + PORT + '/api/candidates/parse-cv');
  console.log('✅ Frontend: http://0.0.0.0:' + PORT);
  console.log('✅ Jobs loaded:', jobs.length);
});
