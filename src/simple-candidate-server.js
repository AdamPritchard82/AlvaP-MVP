// Simple Candidate Server - Clean Version with .NET Parser Integration
console.log('=== SIMPLE CANDIDATE SERVER STARTING - CLEAN VERSION WITH .NET PARSER v4 ===');

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { parseRoute } = require('./routes/parse');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

// Import .NET parser from reference
const { DotNetCvParser } = require('./parsers/dotnetCvParser');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'), false);
    }
  }
});

// Initialize .NET parser
let dotNetParser = null;
const enableDotNetParser = process.env.ENABLE_DOTNET_PARSER === 'true' || process.env.ENABLE_DOTNET_PARSER === '1' || process.env.NODE_ENV === 'production';
const dotNetApiUrl = process.env.DOTNET_CV_API_URL || 'https://positive-bravery-production.up.railway.app';

if (enableDotNetParser) {
  try {
    dotNetParser = new DotNetCvParser();
    console.log('✅ .NET CV Parser enabled:', dotNetApiUrl);
  } catch (error) {
    console.warn('⚠️ .NET CV Parser disabled:', error.message);
  }
} else {
  console.log('ℹ️ .NET CV Parser disabled (ENABLE_DOTNET_PARSER=false)');
}

// Database setup - use PostgreSQL in production, SQLite locally
let db;
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
  // Use PostgreSQL for production (Railway)
  const { Pool } = require('pg');
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  console.log('✅ Using PostgreSQL database');
} else {
  // Use SQLite for local development
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, '../candidates.db');
  db = new sqlite3.Database(dbPath);
  console.log('✅ Using SQLite database');
}

// Initialize database
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
  // PostgreSQL initialization
  db.query(`CREATE TABLE IF NOT EXISTS candidates (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    current_title TEXT,
    current_employer TEXT,
    skills TEXT,
    experience TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('❌ Database initialization failed:', err);
    } else {
      console.log('✅ PostgreSQL database initialized');
    }
  });
} else {
  // SQLite initialization
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      current_title TEXT,
      current_employer TEXT,
      skills TEXT,
      experience TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    console.log('✅ SQLite database initialized');
  });
}

// Helper function to get database connection
const getDb = () => db;

// Simple CV parsing function (local fallback)
function parseCVContent(text) {
  console.log('Parsing CV content locally...');
  
  // Extract basic information using regex
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const phoneMatch = text.match(/(\+?[0-9\s\-\(\)]{10,})/);
  
  // Extract name (first line that looks like a name)
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const nameLine = lines[0] || '';
  const nameParts = nameLine.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  // Simple skill detection
  const allText = text.toLowerCase();
  const skills = {
    communications: /communications?|comms?|media|press|pr|public relations|marketing|social media|content|writing|editorial|journalism|brand|advertising/i.test(allText),
    campaigns: /campaigns?|advocacy|engagement|grassroots|activism|outreach|community|organizing|mobilization|political|election/i.test(allText),
    policy: /policy|policies|briefing|consultation|legislative|regulatory|government|public policy|research|analysis|strategy|planning/i.test(allText),
    publicAffairs: /public affairs|government affairs|parliamentary|stakeholder relations|lobbying|government relations|political|advocacy|corporate affairs/i.test(allText)
  };
  
  return {
    firstName,
    lastName,
    email: emailMatch ? emailMatch[1] : '',
    phone: phoneMatch ? phoneMatch[1].trim() : '',
    skills,
    experience: [],
    notes: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
    confidence: 0.7,
    source: 'local-parser'
  };
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    dotnetParser: dotNetParser ? 'enabled' : 'disabled'
  });
});

// Version endpoint for traceability
app.get('/meta/version', (req, res) => {
  res.status(200).json({
    gitSha: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
    buildTime: process.env.RAILWAY_GIT_COMMIT_CREATED_AT || new Date().toISOString(),
    dotnetUrl: process.env.DOTNET_CV_API_URL || 'not-set',
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
});

// Version endpoint
app.get('/version', (req, res) => {
  res.json({
    gitSha: process.env.GIT_SHA || 'unknown',
    buildTime: process.env.BUILD_TIME || new Date().toISOString(),
    parserMode: 'real',
    backend: 'src/simple-candidate-server.js',
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
    dotnetParser: dotNetParser ? 'enabled' : 'disabled'
  });
});

// Add the new parse route
parseRoute(app);

// CV parsing endpoint
app.post('/api/candidates/parse-cv', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, mimetype, originalname } = req.file;
    const fileExtension = path.extname(originalname).toLowerCase();
    
    console.log(`Processing CV: ${originalname} (${mimetype})`);
    
    let parsedData;
    
    // Try .NET parser first if available
    if (dotNetParser && ['.pdf', '.docx', '.doc'].includes(fileExtension)) {
      try {
        console.log('🔧 Using .NET parser for:', originalname);
        console.log('🔧 File extension:', fileExtension);
        console.log('🔧 MIME type:', mimetype);
        parsedData = await dotNetParser.parseFile(buffer, mimetype, originalname);
        console.log('✅ .NET parser success - parsed data:', JSON.stringify(parsedData, null, 2));
      } catch (error) {
        console.error('❌ .NET parser failed:', error.message);
        console.error('❌ Error details:', error);
        return res.status(503).json({ 
          error: 'ParserUnavailable',
          message: 'CV parsing service is temporarily unavailable',
          details: error.message
        });
      }
    } else {
      console.log('ℹ️ .NET parser not available or file type not supported');
      console.log('ℹ️ dotNetParser available:', !!dotNetParser);
      console.log('ℹ️ File extension:', fileExtension);
      console.log('ℹ️ Supported extensions: [.pdf, .docx, .doc]');
      return res.status(503).json({ 
        error: 'ParserUnavailable',
        message: 'CV parsing service is not available for this file type',
        supportedTypes: ['.pdf', '.docx', '.doc']
      });
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ CV parsing completed in ${duration}ms`);
    
    res.json({
      success: true,
      data: parsedData,
      duration,
      parser: 'dotnet'
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ CV parsing failed:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message,
      duration
    });
  }
});

// Get all candidates
app.get('/api/candidates', (req, res) => {
  const db = getDb();
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    // PostgreSQL query
    db.query('SELECT * FROM candidates ORDER BY created_at DESC', (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(result.rows);
    });
  } else {
    // SQLite query
    db.all('SELECT * FROM candidates ORDER BY created_at DESC', (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(rows);
    });
  }
});

// Create candidate
app.post('/api/candidates', (req, res) => {
  const { firstName, lastName, email, phone, currentTitle, currentEmployer, skills, experience, notes } = req.body;
  
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const db = getDb();
  const skillsJson = JSON.stringify(skills || {});
  const experienceJson = JSON.stringify(experience || []);
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    // PostgreSQL query
    db.query(
      'INSERT INTO candidates (first_name, last_name, email, phone, current_title, current_employer, skills, experience, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [firstName, lastName, email, phone, currentTitle, currentEmployer, skillsJson, experienceJson, notes],
      (err, result) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          id: result.rows[0].id,
          firstName,
          lastName,
          email,
          phone,
          currentTitle,
          currentEmployer,
          skills,
          experience,
          notes
        });
      }
    );
  } else {
    // SQLite query
    db.run(
      'INSERT INTO candidates (first_name, last_name, email, phone, current_title, current_employer, skills, experience, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [firstName, lastName, email, phone, currentTitle, currentEmployer, skillsJson, experienceJson, notes],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          id: this.lastID,
          firstName,
          lastName,
          email,
          phone,
          currentTitle,
          currentEmployer,
          skills,
          experience,
          notes
        });
      }
    );
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Database: ${process.env.DATABASE_URL ? 'PostgreSQL (Railway)' : 'SQLite (local)'}`);
  console.log(`🔧 .NET Parser: ${dotNetParser ? 'enabled' : 'disabled'}`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`🔍 API: http://localhost:${PORT}/api`);
});
