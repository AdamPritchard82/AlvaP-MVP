// Working server with login endpoint and CV parsing using CommonJS
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const textract = require('textract');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Add startup logging
console.log("Booting backend… build: %s", process.env.RAILWAY_GIT_COMMIT_SHA || "local");

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Working Server is running!',
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Working Server is running!',
    timestamp: new Date().toISOString(),
    status: 'success',
    endpoints: {
      health: '/health',
      login: '/api/auth/login (POST)',
      parseCV: '/api/candidates/parse-cv (POST)'
    }
  });
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { email } = req.body || {};
  
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  
  // For demo purposes, accept any email
  const token = jwt.sign(
    { userId: '1', email, name: 'Consultant', role: 'consultant' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  return res.json({ token });
});

// CV parsing function
async function parseCVContent(buffer, mimetype, filename) {
  console.log('=== CV PARSING START ===');
  console.log(`File: ${filename}, Type: ${mimetype}, Size: ${buffer.length} bytes`);
  
  let extractedText = '';
  let parserUsed = '';
  
  try {
    // Try different parsing methods based on file type
    if (mimetype === 'text/plain' || filename.endsWith('.txt')) {
      extractedText = buffer.toString('utf8');
      parserUsed = 'text';
    } else if (mimetype === 'application/pdf' || filename.endsWith('.pdf')) {
      try {
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text;
        parserUsed = 'pdf-parse';
      } catch (pdfError) {
        console.log('PDF parsing failed, trying textract...');
        extractedText = await new Promise((resolve, reject) => {
          textract.fromBufferWithName(filename, buffer, (error, text) => {
            if (error) reject(error);
            else resolve(text);
          });
        });
        parserUsed = 'textract';
      }
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filename.endsWith('.docx')) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
        parserUsed = 'mammoth';
      } catch (docxError) {
        console.log('DOCX parsing failed, trying textract...');
        extractedText = await new Promise((resolve, reject) => {
          textract.fromBufferWithName(filename, buffer, (error, text) => {
            if (error) reject(error);
            else resolve(text);
          });
        });
        parserUsed = 'textract';
      }
    } else {
      // Fallback to textract for any other file type
      extractedText = await new Promise((resolve, reject) => {
        textract.fromBufferWithName(filename, buffer, (error, text) => {
          if (error) reject(error);
          else resolve(text);
        });
      });
      parserUsed = 'textract';
    }
    
    console.log(`Text extracted using ${parserUsed}: ${extractedText.length} characters`);
    
    // Parse candidate information from extracted text
    const candidateInfo = parseCandidateInfo(extractedText);
    
    console.log('=== CV PARSING RESULT ===');
    console.log('Parsed data:', JSON.stringify(candidateInfo, null, 2));
    console.log('=== CV PARSING END ===');
    
    return {
      ...candidateInfo,
      source: parserUsed,
      textLength: extractedText.length
    };
    
  } catch (error) {
    console.error('=== CV PARSING ERROR ===');
    console.error('Error:', error.message);
    console.log('=== CV PARSING END ===');
    throw error;
  }
}

// Parse candidate info from extracted text
function parseCandidateInfo(text) {
  console.log(`Parsing candidate info from ${text.length} characters`);
  
  // Extract email
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const email = emailMatch ? emailMatch[1] : '';
  
  // Extract phone
  const phoneMatch = text.match(/(\+?[\d\s\-\(\)]{10,})/);
  const phone = phoneMatch ? phoneMatch[1].trim() : '';
  
  // Extract names from first line - look for name patterns
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  let firstName = '';
  let lastName = '';
  
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    
    // Look for name patterns - typically first two words that don't contain @ or numbers
    const nameMatch = firstLine.match(/^([A-Za-z]+)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s+[A-Z@\d]|$)/);
    if (nameMatch) {
      firstName = nameMatch[1];
      lastName = nameMatch[2];
    } else {
      // Fallback: split by spaces and take first two words
      const words = firstLine.split(/\s+/);
      if (words.length >= 2) {
        firstName = words[0];
        lastName = words[1];
      } else {
        firstName = words[0] || '';
      }
    }
  }
  
  // Extract skills using keyword matching
  const textLower = text.toLowerCase();
  const skills = {
    communications: /communications?|comms?|media|press|pr|public relations|marketing|social media|content|writing|editorial/i.test(textLower),
    campaigns: /campaigns?|advocacy|engagement|grassroots|activism|outreach|community|organizing|mobilization/i.test(textLower),
    policy: /policy|policies|briefing|consultation|legislative|regulatory|government|public policy|research|analysis/i.test(textLower),
    publicAffairs: /public affairs|government affairs|parliamentary|stakeholder relations|lobbying|government relations|political|advocacy/i.test(textLower)
  };
  
  // Extract experience using improved regex patterns
  const experience = [];
  const experiencePatterns = [
    // Pattern: "Title — Company (2020 - Present)" or "Title — Company (2020 - 2022)"
    /^(.+?)\s*[—–-]\s*(.+?)\s*\((\d{4})\s*[–-]\s*(\d{4}|present|Present)\)/i,
    // Pattern: "Title at Company, 2020 - Present" or "Title at Company, 2020 - 2022"
    /^(.+?)\s+at\s+(.+?),\s*(\d{4})\s*[–-]\s*(\d{4}|present|Present)/i,
    // Pattern: "Title — Company (2020 - Present)" - more flexible
    /^(.+?)\s*[—–-]\s*(.+?)\s*\((\d{4})\s*[–-]\s*(present|Present)\)/i,
    // Pattern: "Title at Company, 2020 - Present" - more flexible
    /^(.+?)\s+at\s+(.+?),\s*(\d{4})\s*[–-]\s*(present|Present)/i,
    // Pattern: "Title — Company (2020-2022)" - no spaces around dash
    /^(.+?)\s*[—–-]\s*(.+?)\s*\((\d{4})\s*[-]\s*(\d{4})\)/i,
    // Pattern: "Title at Company, 2020-2022" - no spaces around dash
    /^(.+?)\s+at\s+(.+?),\s*(\d{4})\s*[-]\s*(\d{4})/i
  ];
  
  for (const line of lines) {
    // Skip lines that are clearly not experience entries
    if (line.includes('@') || line.includes('Phone') || line.includes('Email') || 
        line.includes('SUMMARY') || line.includes('EDUCATION') || line.includes('SKILLS')) {
      continue;
    }
    
    for (const pattern of experiencePatterns) {
      const match = line.match(pattern);
      if (match) {
        const [, title, company, startDate, endDate] = match;
        experience.push({
          employer: company.trim(),
          title: title.trim(),
          startDate: startDate || '',
          endDate: endDate || ''
        });
        break;
      }
    }
  }
  
  // Generate notes from summary/professional summary section
  let notes = '';
  
  // Look for professional summary or summary section
  const summaryStart = lines.findIndex(line => 
    line.toLowerCase().includes('professional summary') || 
    line.toLowerCase().includes('summary') ||
    line.toLowerCase().includes('profile')
  );
  
  if (summaryStart !== -1) {
    // Get lines after the summary header
    const summaryLines = lines.slice(summaryStart + 1, summaryStart + 4)
      .filter(line => 
        line.trim().length > 10 && 
        !line.includes('@') && 
        !line.match(/^\d{4}/) &&
        !line.toLowerCase().includes('phone') &&
        !line.toLowerCase().includes('email') &&
        !line.toLowerCase().includes('experience') &&
        !line.toLowerCase().includes('education') &&
        !line.toLowerCase().includes('skills')
      );
    
    notes = summaryLines.join(' ').substring(0, 300) + 
      (summaryLines.join(' ').length > 300 ? '...' : '');
  }
  
  // Fallback: use first few lines if no summary found
  if (!notes) {
    const fallbackLines = lines.slice(0, 3).filter(line => 
      line.trim().length > 20 && 
      !line.includes('@') && 
      !line.match(/^\d{4}/) &&
      !line.toLowerCase().includes('phone') &&
      !line.toLowerCase().includes('email')
    );
    
    notes = fallbackLines.join(' ').substring(0, 200) + 
      (fallbackLines.join(' ').length > 200 ? '...' : '');
  }
  
  // Clean up notes
  notes = notes.trim();
  
  // Calculate confidence score
  let confidence = Math.min(1, text.length / 8000);
  if (firstName && lastName) confidence += 0.1;
  if (email) confidence += 0.1;
  if (phone) confidence += 0.05;
  if (experience.length > 0) confidence += 0.1;
  const skillCount = Object.values(skills).filter(Boolean).length;
  confidence += skillCount * 0.05;
  confidence = Math.min(confidence, 1.0);
  
  // Check for low text yield
  if (text.length < 300) {
    confidence = Math.min(confidence, 0.3);
  }
  
  console.log(`Parsed candidate: ${firstName} ${lastName}, email: ${email}, experience: ${experience.length} entries`);
  
  return {
    firstName,
    lastName,
    email,
    phone,
    skills,
    experience,
    notes,
    confidence
  };
}

// CV parsing endpoint
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

    // Parse the CV file
    const parsedData = await parseCVContent(req.file.buffer, req.file.mimetype, req.file.originalname);
    
    console.log('=== CV PARSE SUCCESS ===');
    console.log(`Source: ${parsedData.source}`);
    console.log(`Text length: ${parsedData.textLength}`);
    console.log(`Confidence: ${parsedData.confidence.toFixed(2)}`);
    
    res.json({ 
      success: true, 
      data: parsedData
    });
    
  } catch (error) {
    console.error('=== CV PARSE ENDPOINT ERROR ===');
    console.error('Error parsing CV:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: { 
          code: 'FILE_TOO_LARGE', 
          message: 'File too large. Please upload files smaller than 20MB.' 
        } 
      });
    }
    
    if (error.message.includes('Unsupported file type')) {
      return res.status(415).json({ 
        error: { 
          code: 'UNSUPPORTED_TYPE', 
          message: 'Unsupported file type. Please upload PDF, DOCX, or TXT files.' 
        } 
      });
    }
    
    res.status(422).json({ 
      success: false, 
      error: { 
        code: 'PARSE_FAILED', 
        message: 'Could not parse the uploaded file',
        details: error.message
      }
    });
  }
});

console.log("Mounted POST /api/candidates/parse-cv");

// Create candidate endpoint
app.post('/api/candidates', async (req, res) => {
  try {
    console.log('[create-candidate] Route started');
    console.log('Request body:', req.body);
    
    const { getDb } = require('./src/db-commonjs');
    const db = getDb();
    const { nanoid } = require('nanoid');
    const id = nanoid();
    const now = new Date().toISOString();

    const {
      firstName,
      lastName,
      email,
      phone,
      currentTitle,
      currentEmployer,
      salaryMin,
      salaryMax,
      seniority,
      tags = [],
      notes = '',
      skills = {},
      emailOk = true
    } = req.body;

    // Generate unsubscribe token
    const unsubscribeToken = nanoid(32);
    
    const candidateData = {
      id,
      firstName: (firstName || '').trim(),
      lastName: (lastName || '').trim(),
      email: (email || '').trim().toLowerCase(),
      phone: (phone || '').trim(),
      currentTitle: (currentTitle || '').trim(),
      currentEmployer: (currentEmployer || '').trim(),
      salaryMin: salaryMin ? Number(salaryMin) : null,
      salaryMax: salaryMax ? Number(salaryMax) : null,
      seniority: seniority || null,
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
      notes: (notes || '').trim(),
      skills: {
        communications: Number(skills.communications || 0),
        campaigns: Number(skills.campaigns || 0),
        policy: Number(skills.policy || 0),
        publicAffairs: Number(skills.publicAffairs || 0)
      },
      emailOk: emailOk === true || emailOk === 'true',
      unsubscribeToken,
      createdAt: now,
      updatedAt: now
    };

    // Enhanced validation
    const validationErrors = [];
    
    if (!candidateData.firstName) {
      validationErrors.push('First name is required');
    }
    
    if (!candidateData.lastName) {
      validationErrors.push('Last name is required');
    }
    
    if (candidateData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateData.email)) {
      validationErrors.push('Invalid email format');
    }
    
    if (candidateData.salaryMin && candidateData.salaryMax && candidateData.salaryMin > candidateData.salaryMax) {
      validationErrors.push('Minimum salary cannot be greater than maximum salary');
    }
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Insert into database
    const stmt = db.prepare(`
      INSERT INTO candidates (
        id, full_name, email, phone, current_title, current_employer,
        salary_min, salary_max, seniority, tags, notes, skills,
        email_ok, unsubscribe_token, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      candidateData.id,
      `${candidateData.firstName} ${candidateData.lastName}`.trim(),
      candidateData.email,
      candidateData.phone,
      candidateData.currentTitle,
      candidateData.currentEmployer,
      candidateData.salaryMin,
      candidateData.salaryMax,
      candidateData.seniority,
      JSON.stringify(candidateData.tags),
      candidateData.notes,
      JSON.stringify(candidateData.skills),
      candidateData.emailOk ? 1 : 0,
      candidateData.unsubscribeToken,
      'system', // created_by
      candidateData.createdAt,
      candidateData.updatedAt
    );
    
    console.log(`✅ Candidate created successfully: ${candidateData.id}`);
    console.log(`Name: ${candidateData.firstName} ${candidateData.lastName}`);
    console.log(`Email: ${candidateData.email}`);
    
    res.status(201).json({ 
      success: true, 
      id: candidateData.id,
      message: 'Candidate created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating candidate:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create candidate',
      details: error.message 
    });
  }
});

console.log("Mounted POST /api/candidates");

// Get candidates endpoint
app.get('/api/candidates', (req, res) => {
  try {
    const { getDb } = require('./src/db-commonjs');
    const db = getDb();
    
    // Test database connection first
    try {
      const testQuery = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='candidates'").get();
      console.log('[get-candidates] Database test - candidates table exists:', !!testQuery);
      
      if (!testQuery) {
        console.log('[get-candidates] Creating candidates table...');
        db.exec(`
          CREATE TABLE IF NOT EXISTS candidates (
            id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            current_title TEXT,
            current_employer TEXT,
            salary_min INTEGER,
            salary_max INTEGER,
            seniority TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            notes TEXT,
            skills TEXT NOT NULL DEFAULT '{"communications":false,"campaigns":false,"policy":false,"publicAffairs":false}',
            cv_original_path TEXT,
            cv_light TEXT,
            parsed_raw TEXT,
            parse_status TEXT NOT NULL DEFAULT 'unparsed',
            needs_review INTEGER NOT NULL DEFAULT 0,
            email_ok INTEGER NOT NULL DEFAULT 1,
            unsubscribe_token TEXT UNIQUE,
            welcome_sent_at TEXT,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);
        console.log('[get-candidates] Table created successfully');
      }
    } catch (dbTestError) {
      console.error('[get-candidates] Database test failed:', dbTestError);
    }
    
    const { 
      search, 
      tags, 
      salaryMin, 
      salaryMax, 
      skills, 
      mode = 'AND', 
      page = 1, 
      limit = 50 
    } = req.query;

    let query = 'SELECT * FROM candidates';
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(full_name LIKE ? OR notes LIKE ? OR current_title LIKE ? OR current_employer LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (tags) {
      const tagList = Array.isArray(tags) ? tags : tags.split(',');
      if (tagList.length > 0) {
        if (mode === 'AND') {
          const tagConditions = tagList.map(() => 'tags LIKE ?');
          conditions.push(`(${tagConditions.join(' AND ')})`);
          tagList.forEach(tag => params.push(`%"${tag}"%`));
        } else {
          const tagConditions = tagList.map(() => 'tags LIKE ?');
          conditions.push(`(${tagConditions.join(' OR ')})`);
          tagList.forEach(tag => params.push(`%"${tag}"%`));
        }
      }
    }

    if (salaryMin) {
      conditions.push('(salary_min >= ? OR salary_max >= ?)');
      params.push(Number(salaryMin), Number(salaryMin));
    }

    if (salaryMax) {
      conditions.push('(salary_max <= ? OR salary_min <= ?)');
      params.push(Number(salaryMax), Number(salaryMax));
    }

    if (skills) {
      const skillList = Array.isArray(skills) ? skills : skills.split(',');
      if (skillList.length > 0) {
        const skillConditions = skillList.map(skill => {
          const skillKey = skill.toLowerCase().replace(/\s+/g, '');
          return `JSON_EXTRACT(skills, '$.${skillKey}') >= 3`;
        });
        conditions.push(`(${skillConditions.join(' AND ')})`);
      }
    }

    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = db.prepare(countQuery).get(params);
    const total = countResult ? countResult.count : 0;

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    console.log('[get-candidates] Executing query:', query);
    console.log('[get-candidates] With params:', params);
    
    const candidates = db.prepare(query).all(params) || [];
    console.log('[get-candidates] Raw query result:', candidates);
    console.log('[get-candidates] Candidates type:', typeof candidates);
    console.log('[get-candidates] Is array:', Array.isArray(candidates));
    
    // Parse JSON fields
    const parsedCandidates = candidates.map(candidate => ({
      ...candidate,
      tags: JSON.parse(candidate.tags || '[]'),
      skills: JSON.parse(candidate.skills || '{}')
    }));

    console.log(`📊 Retrieved ${parsedCandidates.length} candidates (total: ${total})`);

    res.json({
      success: true,
      candidates: parsedCandidates,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });

  } catch (error) {
    console.error('❌ Error fetching candidates:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch candidates',
      details: error.message 
    });
  }
});

console.log("Mounted GET /api/candidates");

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Working server running on port ${PORT}`);
});
