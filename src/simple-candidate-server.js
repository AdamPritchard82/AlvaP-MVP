// Simple Candidate Server - Bulletproof Version
console.log('=== SIMPLE CANDIDATE SERVER STARTING v2 ===');

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['https://alvap-mvp-production.up.railway.app', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Simple in-memory storage (will persist during server uptime)
let candidates = [];
let nextId = 1;

// Database connection (optional - will use in-memory if fails)
let useDatabase = false;
let db = null;

// Try to connect to database, fallback to in-memory
try {
  const { Pool } = require('pg');
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    
    // Test connection
    pool.query('SELECT NOW()', (err, result) => {
      if (err) {
        console.log('⚠️ Database connection failed, using in-memory storage');
        useDatabase = false;
      } else {
        console.log('✅ Database connected, using PostgreSQL');
        useDatabase = true;
        db = pool;
      }
    });
  }
} catch (error) {
  console.log('⚠️ Database not available, using in-memory storage');
  useDatabase = false;
}

// Uploads directory for parsing
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 20 * 1024 * 1024 }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Simple Candidate Server is running!',
    candidatesCount: candidates.length,
    timestamp: new Date().toISOString()
  });
});

// Minimal CV parsing util
function basicParseCV(text) {
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const phoneMatch = text.match(/(\+?[\d\s\-()]{10,})/);
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let firstName = '', lastName = '';
  if (lines[0]) {
    const parts = lines[0].split(/\s+/);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || '';
  }
  return {
    firstName,
    lastName,
    email: emailMatch ? emailMatch[1] : '',
    phone: phoneMatch ? phoneMatch[1] : '',
    currentTitle: '',
    currentEmployer: '',
    skills: {},
    tags: [],
    confidence: 0.6
  };
}

// Parse CV endpoint (local parsing: txt/pdf/docx)
app.post('/api/candidates/parse-cv', upload.single('file'), async (req, res) => {
  console.log('=== PARSE CV (simple) ===');
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const ext = path.extname(fileName).toLowerCase();
    const buffer = fs.readFileSync(filePath);

    let text = '';
    if (ext === '.txt') {
      text = buffer.toString('utf8');
    } else if (ext === '.pdf') {
      const result = await pdfParse(buffer);
      text = result.text || '';
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || '';
    } else {
      return res.status(415).json({ success: false, error: 'Unsupported file type' });
    }

    if (!text || text.trim().length === 0) {
      return res.status(422).json({ success: false, error: 'No text could be extracted' });
    }

    const parsed = basicParseCV(text);
    parsed.fileName = fileName;
    parsed.parserUsed = ext.replace('.', '').toUpperCase();

    try { fs.unlinkSync(filePath); } catch {}

    return res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('❌ Parse CV error:', err);
    return res.status(500).json({ success: false, error: 'Failed to parse CV', message: err.message });
  }
});

// Create candidate - SIMPLE VERSION
app.post('/api/candidates', async (req, res) => {
  console.log('=== CREATE CANDIDATE ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { firstName, lastName, email, phone, currentTitle, currentEmployer } = req.body;
    
    // Basic validation
    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'First name, last name, and email are required'
      });
    }
    
    // Create candidate
    const candidate = {
      id: nextId++,
      firstName: firstName || '',
      lastName: lastName || '',
      email: email || '',
      phone: phone || '',
      currentTitle: currentTitle || '',
      currentEmployer: currentEmployer || '',
      createdAt: new Date().toISOString(),
      createdBy: 'system'
    };
    
    if (useDatabase && db) {
      // Use database with existing schema
      try {
        const result = await db.query(`
          INSERT INTO candidates (id, full_name, email, phone, current_title, current_employer, created_by, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, full_name, email, phone, current_title, current_employer, created_at
        `, [
          `${candidate.firstName} ${candidate.lastName}`,
          candidate.email,
          candidate.phone,
          candidate.currentTitle,
          candidate.currentEmployer,
          candidate.createdBy,
          candidate.createdAt,
          candidate.createdAt
        ]);
        
        const dbCandidate = result.rows[0];
        candidate.id = dbCandidate.id;
        console.log('✅ Candidate created in database:', candidate);
      } catch (dbError) {
        console.error('❌ Database error, falling back to in-memory:', dbError.message);
        candidates.push(candidate);
        console.log('✅ Candidate created in memory:', candidate);
      }
    } else {
      // Use in-memory storage
      candidates.push(candidate);
      console.log('✅ Candidate created in memory:', candidate);
    }
    
    console.log('Total candidates:', useDatabase ? 'in database' : candidates.length);
    
    res.status(201).json({
      success: true,
      data: candidate,
      message: 'Candidate created successfully'
    });
    
  } catch (error) {
    console.error('❌ Create candidate error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create candidate',
      message: error.message
    });
  }
});

// Get candidates - SIMPLE VERSION
app.get('/api/candidates', async (req, res) => {
  console.log('=== GET CANDIDATES ===');
  
  try {
    if (useDatabase && db) {
      // Use database
      try {
        const result = await db.query(`
          SELECT id, full_name, email, phone, current_title, current_employer, created_at
          FROM candidates 
          ORDER BY created_at DESC 
          LIMIT 50
        `);
        
        const dbCandidates = result.rows.map(row => ({
          id: row.id,
          firstName: row.full_name.split(' ')[0] || '',
          lastName: row.full_name.split(' ').slice(1).join(' ') || '',
          email: row.email || '',
          phone: row.phone || '',
          currentTitle: row.current_title || '',
          currentEmployer: row.current_employer || '',
          createdAt: row.created_at,
          createdBy: 'system'
        }));
        
        console.log('✅ Returning candidates from database:', dbCandidates.length);
        
        res.json({
          success: true,
          candidates: dbCandidates,
          total: dbCandidates.length
        });
      } catch (dbError) {
        console.error('❌ Database error, falling back to in-memory:', dbError.message);
        const sortedCandidates = [...candidates].reverse();
        res.json({
          success: true,
          candidates: sortedCandidates,
          total: sortedCandidates.length
        });
      }
    } else {
      // Use in-memory storage
      const sortedCandidates = [...candidates].reverse();
      console.log('✅ Returning candidates from memory:', sortedCandidates.length);
      
      res.json({
        success: true,
        candidates: sortedCandidates,
        total: sortedCandidates.length
      });
    }
    
  } catch (error) {
    console.error('❌ Get candidates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get candidates',
      message: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Simple Candidate Server is running!',
    status: 'success',
    candidatesCount: candidates.length,
    endpoints: {
      health: '/health',
      create: 'POST /api/candidates',
      list: 'GET /api/candidates'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('=== SIMPLE CANDIDATE SERVER STARTED ===');
  console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ Create: POST http://0.0.0.0:${PORT}/api/candidates`);
  console.log(`✅ List: GET http://0.0.0.0:${PORT}/api/candidates`);
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
