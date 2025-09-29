// Production server with PostgreSQL, file storage, and monitoring
console.log('=== PRODUCTION SERVER STARTING ===');
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

const http = require('http');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// Database setup
let db;
const usePostgres = process.env.DATABASE_URL;

if (usePostgres) {
  console.log('🐘 Using PostgreSQL database');
  const { getDb, initDatabase, query } = require('./src/db-postgres');
  db = getDb;
  initDatabase();
} else {
  console.log('📁 Using SQLite database (development)');
  const { getDb, initDatabase } = require('./src/db-commonjs');
  db = getDb;
  initDatabase();
}

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per window

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  
  const requests = rateLimitMap.get(ip);
  // Remove old requests
  const validRequests = requests.filter(time => time > windowStart);
  rateLimitMap.set(ip, validRequests);
  
  if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  validRequests.push(now);
  return true;
}

// File storage setup
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Enhanced CV parsing function
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

// Create HTTP server
const PORT = process.env.PORT || 3001;
const server = http.createServer((req, res) => {
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  console.log(`Request: ${req.method} ${req.url} from ${clientIP}`);
  
  // Rate limiting
  if (!checkRateLimit(clientIP)) {
    console.log(`Rate limit exceeded for ${clientIP}`);
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.'
    }));
    return;
  }
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Route handling
  if (req.url === '/health') {
    console.log('Health check requested');
    res.writeHead(200);
    res.end(JSON.stringify({ 
      ok: true, 
      message: 'Production server running!',
      timestamp: new Date().toISOString(),
      database: usePostgres ? 'PostgreSQL' : 'SQLite',
      platform: process.platform,
      uptime: process.uptime()
    }));
    
  } else if (req.url === '/api/candidates/parse-cv' && req.method === 'POST') {
    console.log('[parse-cv] Route started');
    
    // Handle multipart form data for file uploads
    const formidable = require('formidable');
    const form = formidable({
      uploadDir: uploadsDir,
      keepExtensions: true,
      maxFileSize: 20 * 1024 * 1024 // 20MB limit
    });
    
    form.parse(req, async (err, fields, files) => {
      const startTime = Date.now();
      
      if (err) {
        console.error('[parse-cv] Form parsing error:', err);
        res.writeHead(400);
        res.end(JSON.stringify({ 
          success: false,
          error: 'Failed to parse form data',
          message: err.message
        }));
        return;
      }
      
      try {
        const file = files.file || files.cv;
        if (!file) {
          res.writeHead(400);
          res.end(JSON.stringify({ 
            success: false,
            error: 'No file uploaded',
            message: 'Please upload a file'
          }));
          return;
        }
        
        const filePath = file.filepath;
        const fileName = file.originalFilename || 'unknown';
        const fileExtension = path.extname(fileName).toLowerCase();
        const fileSize = fs.statSync(filePath).size;
        
        console.log(`[parse-cv] ext=${fileExtension.toUpperCase()} size=${fileSize} bytes`);
        
        // Check file type support
        const supportedExtensions = ['.txt', '.pdf', '.docx'];
        if (!supportedExtensions.includes(fileExtension)) {
          console.log(`[parse-cv] Unsupported file type: ${fileExtension}`);
          res.writeHead(400);
          res.end(JSON.stringify({ 
            success: false,
            error: 'Only .txt, .pdf, and .docx files are supported.',
            message: `File type ${fileExtension} is not supported`
          }));
          return;
        }
        
        // Read file into buffer
        const buffer = fs.readFileSync(filePath);
        let extractedText = '';
        let parserUsed = '';
        let parseSuccess = false;
        
        // 1. If TXT → just read buffer.toString("utf8")
        if (fileExtension === '.txt') {
          try {
            const parseStart = Date.now();
            extractedText = buffer.toString('utf8');
            const parseTime = Date.now() - parseStart;
            
            if (extractedText && extractedText.trim().length > 0) {
              parserUsed = 'TXT';
              parseSuccess = true;
              console.log(`[parse-cv] ok via TXT in ${parseTime}ms, chars=${extractedText.length}`);
            }
          } catch (txtError) {
            console.log('[parse-cv] TXT parser failed:', txtError.message);
          }
        }
        
        // 2. If PDF → try pdf-parse
        if (!parseSuccess && fileExtension === '.pdf') {
          try {
            const parseStart = Date.now();
            const pdfParse = require('pdf-parse');
            const result = await pdfParse(buffer);
            const parseTime = Date.now() - parseStart;
            
            if (result.text && result.text.trim().length > 0) {
              extractedText = result.text;
              parserUsed = 'PDF-parse';
              parseSuccess = true;
              console.log(`[parse-cv] ok via PDF-parse in ${parseTime}ms, chars=${extractedText.length}`);
            }
          } catch (pdfError) {
            console.log('[parse-cv] PDF-parse failed:', pdfError.message);
          }
        }
        
        // 3. If DOCX → try mammoth
        if (!parseSuccess && fileExtension === '.docx') {
          try {
            const parseStart = Date.now();
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ buffer });
            const parseTime = Date.now() - parseStart;
            
            if (result.value && result.value.trim().length > 0) {
              extractedText = result.value;
              parserUsed = 'Mammoth';
              parseSuccess = true;
              console.log(`[parse-cv] ok via Mammoth in ${parseTime}ms, chars=${extractedText.length}`);
            }
          } catch (docxError) {
            console.log('[parse-cv] Mammoth failed:', docxError.message);
          }
        }
        
        // 4. If everything else or if the above fail → try textract
        if (!parseSuccess) {
          try {
            const parseStart = Date.now();
            const textract = require('textract');
            const parseTime = Date.now() - parseStart;
            
            extractedText = await new Promise((resolve, reject) => {
              textract.fromBufferWithMime(`application/${fileExtension.slice(1)}`, buffer, (error, text) => {
                if (error) reject(error);
                else resolve(text);
              });
            });
            
            if (extractedText && extractedText.trim().length > 0) {
              parserUsed = 'Textract';
              parseSuccess = true;
              console.log(`[parse-cv] ok via Textract in ${parseTime}ms, chars=${extractedText.length}`);
            }
          } catch (textractError) {
            console.log('[parse-cv] Textract failed:', textractError.message);
          }
        }
        
        // 5. As a last resort → tesseract.js for OCR
        if (!parseSuccess) {
          try {
            const parseStart = Date.now();
            const { createWorker } = require('tesseract.js');
            const worker = await createWorker();
            const { data: { text } } = await worker.recognize(buffer);
            await worker.terminate();
            const parseTime = Date.now() - parseStart;
            
            if (text && text.trim().length > 0) {
              extractedText = text;
              parserUsed = 'Tesseract OCR';
              parseSuccess = true;
              console.log(`[parse-cv] ok via Tesseract OCR in ${parseTime}ms, chars=${extractedText.length}`);
            }
          } catch (ocrError) {
            console.log('[parse-cv] Tesseract OCR failed:', ocrError.message);
          }
        }
        
        // Check if any parser succeeded
        if (!parseSuccess || !extractedText || extractedText.trim().length === 0) {
          console.log('[parse-cv] All parsers failed');
          res.writeHead(422);
          res.end(JSON.stringify({ 
            success: false,
            error: 'Could not parse file. Supported: .txt, .pdf, .docx',
            message: 'No text could be extracted from the file'
          }));
          return;
        }
        
        // Parse the extracted text using existing logic
        const parsedData = parseCVContent(extractedText);
        parsedData.parserUsed = parserUsed;
        parsedData.fileName = fileName;
        
        console.log(`[parse-cv] CV parsed successfully:`, {
          name: `${parsedData.firstName} ${parsedData.lastName}`,
          email: parsedData.email,
          phone: parsedData.phone,
          skills: Object.keys(parsedData.skills).filter(k => parsedData.skills[k])
        });
        
        // Save to database (existing logic)
        if (usePostgres) {
          try {
            const { query } = require('./src/db-postgres');
            const candidateId = require('nanoid').nanoid();
            
            await query(`
              INSERT INTO candidates (id, full_name, email, phone, skills, tags, notes, parse_status, created_by, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            `, [
              candidateId,
              `${parsedData.firstName} ${parsedData.lastName}`,
              parsedData.email,
              parsedData.phone,
              JSON.stringify(parsedData.skills),
              JSON.stringify(parsedData.tags),
              parsedData.notes,
              'parsed',
              'system'
            ]);
            
            console.log(`[parse-cv] Candidate saved to PostgreSQL: ${candidateId}`);
          } catch (dbError) {
            console.error('[parse-cv] Database save error:', dbError);
          }
        } else {
          try {
            const { getDb } = require('./src/db-commonjs');
            const db = getDb();
            const candidateId = require('nanoid').nanoid();
            
            const stmt = db.prepare(`
              INSERT INTO candidates (id, full_name, email, phone, skills, tags, notes, parse_status, created_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `);
            
            stmt.run(
              candidateId,
              `${parsedData.firstName} ${parsedData.lastName}`,
              parsedData.email,
              parsedData.phone,
              JSON.stringify(parsedData.skills),
              JSON.stringify(parsedData.tags),
              parsedData.notes,
              'parsed',
              'system'
            );
            
            console.log(`[parse-cv] Candidate saved to SQLite: ${candidateId}`);
          } catch (dbError) {
            console.error('[parse-cv] SQLite save error:', dbError);
          }
        }
        
        // Clean up uploaded file
        try {
          fs.unlinkSync(filePath);
          console.log('[parse-cv] Cleaned up uploaded file');
        } catch (cleanupError) {
          console.warn('[parse-cv] Could not clean up file:', cleanupError.message);
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`[parse-cv] Total processing time: ${totalTime}ms`);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
          success: true,
          data: parsedData,
          timestamp: new Date().toISOString(),
          message: `CV parsed successfully using ${parserUsed}`,
          parserUsed: parserUsed,
          fileName: fileName,
          processingTime: totalTime
        }));
        
      } catch (error) {
        console.error('[parse-cv] Unexpected error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ 
          success: false,
          error: 'Failed to parse CV',
          message: error.message
        }));
      }
    });
    
  } else if (req.url === '/api/candidates' && req.method === 'GET') {
    console.log('Candidates list requested');
    
    if (usePostgres) {
      try {
        const { query } = require('./src/db-postgres');
        query('SELECT * FROM candidates ORDER BY created_at DESC LIMIT 50')
          .then(result => {
            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              candidates: result.rows,
              total: result.rows.length
            }));
          })
          .catch(error => {
            console.error('Database query error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ 
              success: false,
              error: 'Database error',
              message: error.message
            }));
          });
      } catch (error) {
        console.error('Database setup error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ 
          success: false,
          error: 'Database setup error',
          message: error.message
        }));
      }
    } else {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: 'SQLite database - candidates endpoint not implemented yet',
        candidates: []
      }));
    }
    
  } else if (req.url === '/test-cv' && req.method === 'GET') {
    console.log('Test CV parsing requested');
    
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
      message: 'AlvaP Production Server is running!',
      timestamp: new Date().toISOString(),
      status: 'success',
      database: usePostgres ? 'PostgreSQL' : 'SQLite',
      features: [
        'CV Parsing',
        'Database Persistence',
        'Rate Limiting',
        'Error Handling',
        'File Storage'
      ],
      endpoints: {
        health: '/health',
        cvParse: '/api/candidates/parse-cv (POST)',
        candidates: '/api/candidates (GET)',
        testCV: '/test-cv (GET)'
      }
    }));
    
  } else {
    console.log('404 - Route not found:', req.url);
    res.writeHead(404);
    res.end(JSON.stringify({ 
      error: 'Not Found',
      message: `Route ${req.url} not found`,
      availableEndpoints: ['/health', '/api/candidates/parse-cv', '/api/candidates', '/test-cv']
    }));
  }
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log('=== PRODUCTION SERVER STARTED ===');
  console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ Database: ${usePostgres ? 'PostgreSQL' : 'SQLite'}`);
  console.log(`✅ Rate limiting: ${RATE_LIMIT_MAX_REQUESTS} requests per ${RATE_LIMIT_WINDOW/1000/60} minutes`);
  console.log(`✅ File storage: ${uploadsDir}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

