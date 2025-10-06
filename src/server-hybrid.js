// Hybrid Production Server with .NET CV Parser Integration and Form Validation
console.log('=== HYBRID PRODUCTION SERVER STARTING ===');
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());

// Error handling
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Database setup
let db;
const usePostgres = process.env.DATABASE_URL;

if (usePostgres) {
  console.log('🐘 Using PostgreSQL database');
  const { getDb, initDatabase } = require('./db-postgres');
  db = getDb;
  initDatabase();
} else {
  console.log('📁 Using SQLite database (development)');
  const { getDb, initDatabase } = require('./db-commonjs');
  db = getDb;
  initDatabase();
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'https://alvap-mvp-production.up.railway.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));
app.use(helmet());

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// File upload setup
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.pdf', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt, .pdf, .docx, and .doc files are allowed'), false);
    }
  }
});

// .NET CV Parser Integration
let dotNetParser = null;
const dotNetApiUrl = process.env.DOTNET_CV_API_URL || 'https://balanced-beauty-production.up.railway.app';

// Fix for Railway truncation issue - hardcode the correct URL
const actualDotNetApiUrl = 'https://balanced-beauty-production.up.railway.app';

if (process.env.ENABLE_DOTNET_PARSER === 'true' || process.env.ENABLE_DOTNET_PARSER === '1') {
  try {
    const { DotNetCvParser } = require('./parsers/dotnetCvParser');
    dotNetParser = new DotNetCvParser(actualDotNetApiUrl);
    console.log('✅ .NET CV Parser enabled:', actualDotNetApiUrl);
  } catch (error) {
    console.warn('⚠️ .NET CV Parser disabled:', error.message);
  }
} else {
  console.log('ℹ️ .NET CV Parser disabled (ENABLE_DOTNET_PARSER=false or no URL)');
  console.log('ℹ️ To enable: Set ENABLE_DOTNET_PARSER=true and DOTNET_CV_API_URL');
}

// Enhanced CV parsing function (fallback)
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
    currentTitle: '',
    currentEmployer: '',
    skills,
    tags,
    notes: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
    confidence: 0.8
  };
}

// CV Parsing endpoint with .NET integration
app.post('/api/candidates/parse-cv', upload.single('file'), async (req, res) => {
  console.log('[parse-cv] Route started');
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Please upload a file'
      });
    }
    
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileExtension = path.extname(fileName).toLowerCase();
    const fileSize = req.file.size;
    
    console.log(`[parse-cv] ext=${fileExtension.toUpperCase()} size=${fileSize} bytes`);
    
    // Check file type support
    const supportedExtensions = ['.txt', '.pdf', '.docx', '.doc'];
    if (!supportedExtensions.includes(fileExtension)) {
      return res.status(400).json({
        success: false,
        error: 'Only .txt, .pdf, .docx, and .doc files are supported.',
        message: `File type ${fileExtension} is not supported`
      });
    }
    
    let parsedData = null;
    let parserUsed = '';
    
    // Try .NET parser first if enabled
    if (dotNetParser && ['.pdf', '.docx', '.doc'].includes(fileExtension)) {
      try {
        console.log('[parse-cv] Trying .NET parser...');
        const buffer = fs.readFileSync(filePath);
        parsedData = await dotNetParser.parseFile(buffer, req.file.mimetype, fileName);
        parserUsed = 'DotNet';
        console.log('[parse-cv] .NET parser succeeded');
      } catch (dotNetError) {
        console.log('[parse-cv] .NET parser failed:', dotNetError.message);
        // Fall through to local parsers
      }
    }
    
    // Fallback to local parsers
    if (!parsedData) {
      console.log('[parse-cv] Using local parsers...');
      
      // Read file into buffer
      const buffer = fs.readFileSync(filePath);
      let extractedText = '';
      let parseSuccess = false;
      
      // 1. If TXT → just read buffer.toString("utf8")
      if (fileExtension === '.txt') {
        try {
          extractedText = buffer.toString('utf8');
          if (extractedText && extractedText.trim().length > 0) {
            parserUsed = 'TXT';
            parseSuccess = true;
            console.log(`[parse-cv] ok via TXT, chars=${extractedText.length}`);
          }
        } catch (txtError) {
          console.log('[parse-cv] TXT parser failed:', txtError.message);
        }
      }
      
      // 2. If PDF → try pdf-parse
      if (!parseSuccess && fileExtension === '.pdf') {
        try {
          const pdfParse = require('pdf-parse');
          const result = await pdfParse(buffer);
          if (result.text && result.text.trim().length > 0) {
            extractedText = result.text;
            parserUsed = 'PDF-parse';
            parseSuccess = true;
            console.log(`[parse-cv] ok via PDF-parse, chars=${extractedText.length}`);
          }
        } catch (pdfError) {
          console.log('[parse-cv] PDF-parse failed:', pdfError.message);
        }
      }
      
      // 3. If DOCX → try mammoth
      if (!parseSuccess && fileExtension === '.docx') {
        try {
          const mammoth = require('mammoth');
          const result = await mammoth.extractRawText({ buffer });
          if (result.value && result.value.trim().length > 0) {
            extractedText = result.value;
            parserUsed = 'Mammoth';
            parseSuccess = true;
            console.log(`[parse-cv] ok via Mammoth, chars=${extractedText.length}`);
          }
        } catch (docxError) {
          console.log('[parse-cv] Mammoth failed:', docxError.message);
        }
      }
      
      // Check if any parser succeeded
      if (!parseSuccess || !extractedText || extractedText.trim().length === 0) {
        return res.status(422).json({
          success: false,
          error: 'Could not parse file. Supported: .txt, .pdf, .docx',
          message: 'No text could be extracted from the file'
        });
      }
      
      // Parse the extracted text using existing logic
      parsedData = parseCVContent(extractedText);
    }
    
    // Add metadata
    parsedData.parserUsed = parserUsed;
    parsedData.fileName = fileName;
    
    console.log(`[parse-cv] CV parsed successfully:`, {
      name: `${parsedData.firstName} ${parsedData.lastName}`,
      email: parsedData.email,
      phone: parsedData.phone,
      skills: Object.keys(parsedData.skills).filter(k => parsedData.skills[k])
    });
    
    // Clean up uploaded file
    try {
      fs.unlinkSync(filePath);
      console.log('[parse-cv] Cleaned up uploaded file');
    } catch (cleanupError) {
      console.warn('[parse-cv] Could not clean up file:', cleanupError.message);
    }
    
    res.json({
      success: true,
      data: parsedData,
      timestamp: new Date().toISOString(),
      message: `CV parsed successfully using ${parserUsed}`,
      parserUsed: parserUsed,
      fileName: fileName
    });
    
  } catch (error) {
    console.error('[parse-cv] Unexpected error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to parse CV',
      message: error.message
    });
  }
});

// Create candidate endpoint with form validation support
app.post('/api/candidates', async (req, res) => {
  console.log('[create-candidate] Route started');
  
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      currentTitle,
      currentEmployer,
      salaryMin,
      salaryMax,
      skills = {},
      tags = [],
      notes = '',
      emailOk = true
    } = req.body;
    
    // Basic validation
    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'First name, last name, email, and phone are required'
      });
    }
    
    // Generate candidate ID
    const candidateId = require('nanoid').nanoid();
    const now = new Date().toISOString();
    
    const candidateData = {
      id: candidateId,
      firstName: firstName || '',
      lastName: lastName || '',
      email: email || '',
      phone: phone || '',
      currentTitle: currentTitle || '',
      currentEmployer: currentEmployer || '',
      salaryMin: salaryMin ? Number(salaryMin) : null,
      salaryMax: salaryMax ? Number(salaryMax) : null,
      skills: {
        communications: Boolean(skills.communications),
        campaigns: Boolean(skills.campaigns),
        policy: Boolean(skills.policy),
        publicAffairs: Boolean(skills.publicAffairs)
      },
      tags: Array.isArray(tags) ? tags : [],
      notes: notes || '',
      emailOk: Boolean(emailOk),
      createdBy: 'system', // Add required created_by field
      createdAt: now,
      updatedAt: now
    };
    
    // Save to database
    if (usePostgres) {
      const { query } = require('./db-postgres');
      await query(`
        INSERT INTO candidates (id, full_name, email, phone, current_title, current_employer, salary_min, salary_max, skills, tags, notes, email_ok, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        candidateData.id,
        `${candidateData.firstName} ${candidateData.lastName}`,
        candidateData.email,
        candidateData.phone,
        candidateData.currentTitle,
        candidateData.currentEmployer,
        candidateData.salaryMin,
        candidateData.salaryMax,
        JSON.stringify(candidateData.skills),
        JSON.stringify(candidateData.tags),
        candidateData.notes,
        candidateData.emailOk,
        candidateData.createdBy,
        candidateData.createdAt,
        candidateData.updatedAt
      ]);
    } else {
      const dbInstance = db();
      const stmt = dbInstance.prepare(`
        INSERT INTO candidates (id, full_name, email, phone, current_title, current_employer, salary_min, salary_max, skills, tags, notes, email_ok, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        candidateData.id,
        `${candidateData.firstName} ${candidateData.lastName}`,
        candidateData.email,
        candidateData.phone,
        candidateData.currentTitle,
        candidateData.currentEmployer,
        candidateData.salaryMin,
        candidateData.salaryMax,
        JSON.stringify(candidateData.skills),
        JSON.stringify(candidateData.tags),
        candidateData.notes,
        candidateData.emailOk ? 1 : 0,
        candidateData.createdBy,
        candidateData.createdAt,
        candidateData.updatedAt
      );
    }
    
    console.log(`[create-candidate] Candidate created: ${candidateId}`);
    
    res.json({
      success: true,
      data: candidateData,
      message: 'Candidate created successfully'
    });
    
  } catch (error) {
    console.error('[create-candidate] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create candidate',
      message: error.message
    });
  }
});

// Get candidates endpoint
app.get('/api/candidates', async (req, res) => {
  console.log('[get-candidates] Route started');
  
  try {
    if (usePostgres) {
      const { query } = require('./db-postgres');
      const result = await query('SELECT * FROM candidates ORDER BY created_at DESC LIMIT 50');
      res.json({
        success: true,
        candidates: result.rows,
        total: result.rows.length
      });
    } else {
      const dbInstance = db();
      const candidates = dbInstance.prepare('SELECT * FROM candidates ORDER BY created_at DESC LIMIT 50').all();
      res.json({
        success: true,
        candidates: candidates,
        total: candidates.length
      });
    }
  } catch (error) {
    console.error('[get-candidates] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch candidates',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Hybrid AlvaP Backend is running!',
    database: usePostgres ? 'PostgreSQL' : 'SQLite',
    dotnetParser: dotNetParser ? 'enabled' : 'disabled',
    platform: process.platform,
    uptime: process.uptime(),
    env: {
      ENABLE_DOTNET_PARSER: process.env.ENABLE_DOTNET_PARSER,
      DOTNET_CV_API_URL: process.env.DOTNET_CV_API_URL,
      NODE_ENV: process.env.NODE_ENV
    }
  });
});

// Additional API endpoints for frontend compatibility
app.get('/api/jobs', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    res.json({ success: true, jobs: [], total: 0, limit: parseInt(limit) });
  } catch (error) {
    console.error('[get-jobs] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/matches', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    res.json({ success: true, matches: [], total: 0, limit: parseInt(limit) });
  } catch (error) {
    console.error('[get-matches] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/events/unread-count', async (req, res) => {
  try {
    res.json({ success: true, count: 0 });
  } catch (error) {
    console.error('[get-unread-count] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/licensing/subscription', async (req, res) => {
  try {
    res.json({ success: true, subscription: { status: 'active', plan: 'free' } });
  } catch (error) {
    console.error('[get-subscription] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AlvaP Hybrid Production Server is running!',
    timestamp: new Date().toISOString(),
    status: 'success',
    database: usePostgres ? 'PostgreSQL' : 'SQLite',
    dotnetParser: dotNetParser ? 'enabled' : 'disabled',
    features: [
      'CV Parsing (Local + .NET)',
      'Form Validation',
      'Database Persistence',
      'Error Handling',
      'File Storage'
    ],
    endpoints: {
      health: '/health',
      cvParse: '/api/candidates/parse-cv (POST)',
      candidates: '/api/candidates (GET/POST)'
    }
  });
});

// 404 handler
app.use((req, res) => {
  console.log('404 - Route not found:', req.method, req.url);
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
    availableEndpoints: ['/health', '/api/candidates/parse-cv', '/api/candidates']
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('=== HYBRID PRODUCTION SERVER STARTED ===');
  console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ Database: ${usePostgres ? 'PostgreSQL' : 'SQLite'}`);
  console.log(`✅ .NET Parser: ${dotNetParser ? 'enabled' : 'disabled'}`);
  console.log(`✅ File storage: ${uploadsDir}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
