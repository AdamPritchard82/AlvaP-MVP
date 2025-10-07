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
    // Prefer Postgres when DATABASE_URL is set; fallback only if a query fails later
    db = pool;
    useDatabase = true;
    console.log('🔧 Database configured: PostgreSQL (will fallback to memory on error)');
  }
} catch (error) {
  console.log('⚠️ Database module not available, using in-memory storage');
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

// Enhanced CV parsing function (from yesterday's working version)
function parseCVContent(text) {
  console.log('Parsing CV content...');
  
  // Extract basic information using regex
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  
  // Improved phone number regex - matches various formats
  const phoneRegexes = [
    /(\+91\s?[0-9]{4}\s?[0-9]{5})/g,                   // India: +91 7838 82147
    /(\+44\s?[0-9]{2,4}\s?[0-9]{3,4}\s?[0-9]{3,4})/g,  // UK: +44 20 1234 5678
    /(\+1\s?[0-9]{3}\s?[0-9]{3}\s?[0-9]{4})/g,         // US: +1 555 123 4567
    /(\+[0-9]{1,3}\s?[0-9]{4,5}\s?[0-9]{4,5})/g,       // International: +XX XXXX XXXX
    /(0[0-9]{2,4}\s?[0-9]{3,4}\s?[0-9]{3,4})/g,        // UK: 020 1234 5678
    /([0-9]{3}\s?[0-9]{3}\s?[0-9]{4})/g,               // US: 555 123 4567
    /(\([0-9]{2,4}\)\s?[0-9]{3,4}\s?[0-9]{3,4})/g,     // (020) 1234 5678
    /([0-9]{10,})/g,                                    // 10+ digits
    /(\+?[\d\s\-\(\)]{10,})/g                          // Original fallback
  ];
  
  let phoneMatch = null;
  
  // First, try to find phone numbers in the header area (first 500 characters)
  const headerText = text.substring(0, 500);
  console.log('Searching header for phone numbers:', headerText);
  
  for (const regex of phoneRegexes) {
    const matches = headerText.match(regex);
    if (matches && matches.length > 0) {
      // Find the most likely phone number (longest match)
      phoneMatch = matches.reduce((longest, current) => 
        current.replace(/\D/g, '').length > longest.replace(/\D/g, '').length ? current : longest
      );
      console.log('Found phone in header:', phoneMatch);
      break;
    }
  }
  
  // If not found in header, search the full text
  if (!phoneMatch) {
    console.log('No phone found in header, searching full text...');
    for (const regex of phoneRegexes) {
      const matches = text.match(regex);
      if (matches && matches.length > 0) {
        phoneMatch = matches.reduce((longest, current) => 
          current.replace(/\D/g, '').length > longest.replace(/\D/g, '').length ? current : longest
        );
        console.log('Found phone in full text:', phoneMatch);
        break;
      }
    }
  }
  
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

  // Extract job title and employer from experience section
  let currentTitle = '';
  let currentEmployer = '';
  
  // Look for common experience section headers - prioritize "work experience"
  const experienceKeywords = ['work experience', 'professional experience', 'employment history', 'career history', 'experience', 'employment', 'work history', 'career'];
  let experienceStartIndex = -1;
  
  // First pass: look for exact "work experience" matches
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase().trim();
    if (line === 'work experience' || line === 'professional experience') {
      experienceStartIndex = i;
      console.log('Found exact experience section at line', i, ':', lines[i]);
      break;
    }
  }
  
  // Second pass: look for partial matches if exact not found, but avoid sentence-like lines
  if (experienceStartIndex === -1) {
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.toLowerCase();
      const looksLikeHeader =
        !/^•/.test(rawLine) && // not a bullet point
        rawLine.length <= 40 &&
        !/[.,;:]/.test(rawLine) && // avoid sentences
        /experience|employment|career/.test(line);
      if (looksLikeHeader && experienceKeywords.some(keyword => line.includes(keyword))) {
        experienceStartIndex = i;
        console.log('Found experience section at line', i, ':', rawLine);
        break;
      }
    }
  }
  
  // If we found experience section, look for the first job entry
  if (experienceStartIndex !== -1) {
    for (let i = experienceStartIndex + 1; i < Math.min(experienceStartIndex + 10, lines.length); i++) {
      const line = lines[i];
      
      // Skip empty lines and section headers
      if (!line || line.length < 3) continue;
      
      // Look for job title patterns (usually at the start of a line)
      const jobTitlePatterns = [
        // Common job titles with specific endings
        /^([A-Z][a-zA-Z\s&/\-]+(?:Manager|Director|Coordinator|Specialist|Analyst|Consultant|Advisor|Officer|Executive|Lead|Head|Chief|Senior|Junior|Associate|Assistant|Intern|Trainee|Representative|Agent|Clerk|Developer|Engineer|Designer|Coordinator|Officer|Executive|Manager|Director|Specialist|Analyst|Consultant|Advisor|Lead|Head|Chief|Senior|Junior|Associate|Assistant|Intern|Trainee|Representative|Agent|Clerk))/i,
        // Any capitalized word sequence that looks like a title
        /^([A-Z][a-zA-Z\s&/\-]{3,}(?:\s+[A-Z][a-zA-Z\s&/\-]*)*)/,
        // Simple pattern for any line that starts with capital and looks like a title
        /^([A-Z][a-zA-Z\s&/\-]{4,})/
      ];
      
      for (const pattern of jobTitlePatterns) {
        const match = line.match(pattern);
        if (match && match[1] && match[1].length > 3) {
          const potentialTitle = match[1].trim();
          
          // Filter out common non-title patterns
          const skipPatterns = [
            /^(Government|Westminster|European|Parliament|London|United|Kingdom|UK|England|Scotland|Wales|Northern|Ireland)$/i,
            /^(Address|Phone|Email|Contact|Location|Date|Time|Year|Month|Day)$/i,
            /^(Summary|Objective|Profile|About|Introduction)$/i,
            /^(Education|Qualifications|Skills|Languages|Certifications)$/i,
            /^(References|Referees|Contact|Details)$/i
          ];
          
          const shouldSkip = skipPatterns.some(skipPattern => skipPattern.test(potentialTitle));
          if (shouldSkip) {
            console.log('Skipping non-title pattern:', potentialTitle);
            continue;
          }
          
          currentTitle = potentialTitle;
          console.log('Found potential job title:', currentTitle);
          
          // Look for employer in the same line or next few lines
          const employerPatterns = [
            /at\s+([A-Z][a-zA-Z\s&.,]+)/i,
            /@\s+([A-Z][a-zA-Z\s&.,]+)/i,
            /,\s+([A-Z][a-zA-Z\s&.,]+)/i
          ];
          
          for (const empPattern of employerPatterns) {
            const empMatch = line.match(empPattern);
            if (empMatch && empMatch[1] && empMatch[1].length > 2) {
              currentEmployer = empMatch[1].trim();
              break;
            }
          }
          
          // If no employer found in same line, check next line
          if (!currentEmployer && i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            if (nextLine && nextLine.length > 2 && nextLine.length < 100) {
              currentEmployer = nextLine.trim();
            }
          }
          
          console.log('Found job info:', { title: currentTitle, employer: currentEmployer });
          break;
        }
      }
      
      if (currentTitle) break;
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
  
  const phone = phoneMatch ? phoneMatch.trim() : '';
  
  console.log('Phone parsing results:', {
    found: !!phoneMatch,
    phone: phone,
    textSample: text.substring(0, 1000) // First 1000 chars for debugging
  });
  
  // Also log all potential phone-like patterns found
  const allPhoneLike = text.match(/(\+?[\d\s\-\(\)]{8,})/g);
  console.log('All phone-like patterns found:', allPhoneLike);

  // Debug job parsing
  console.log('Job parsing debug:', {
    currentTitle: currentTitle,
    currentEmployer: currentEmployer,
    experienceStartIndex: experienceStartIndex,
    first15Lines: lines.slice(0, 15)
  });

  return {
    firstName,
    lastName,
    email: emailMatch ? emailMatch[1] : '',
    phone: phone,
    currentTitle: currentTitle,
    currentEmployer: currentEmployer,
    skills,
    tags,
    notes: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
    confidence: 0.8
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

    const parsed = parseCVContent(text);
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
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, gen_random_uuid(), $6, $7)
          RETURNING id, full_name, email, phone, current_title, current_employer, created_at
        `, [
          `${candidate.firstName} ${candidate.lastName}`,
          candidate.email,
          candidate.phone,
          candidate.currentTitle,
          candidate.currentEmployer,
          candidate.createdAt,
          candidate.createdAt
        ]);
        
        const dbCandidate = result.rows[0];
        candidate.id = dbCandidate.id;
        console.log('✅ [DB] Candidate created:', candidate);
      } catch (dbError) {
        console.error('❌ [DB] Insert error:', dbError.message);
        // Do not fallback silently; mark memory path explicitly
        candidates.push(candidate);
        console.log('✅ [MEM] Candidate created as fallback:', candidate);
        useDatabase = false; // force list to read from memory for consistency
      }
    } else {
      // Use in-memory storage
      candidates.push(candidate);
      console.log('✅ [MEM] Candidate created:', candidate);
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
          full_name: row.full_name || '',
          email: row.email || '',
          phone: row.phone || '',
          current_title: row.current_title || '',
          current_employer: row.current_employer || '',
          salary_min: row.salary_min || null,
          salary_max: row.salary_max || null,
          skills: row.skills ? JSON.parse(row.skills) : { communications: false, campaigns: false, policy: false, publicAffairs: false },
          tags: row.tags ? JSON.parse(row.tags) : [],
          notes: row.notes || '',
          email_ok: row.email_ok || true,
          created_at: row.created_at,
          updated_at: row.updated_at || row.created_at
        }));
        
        console.log('✅ [DB] Returning candidates:', dbCandidates.length);
        
        res.json({
          success: true,
          candidates: dbCandidates,
          total: dbCandidates.length
        });
      } catch (dbError) {
        console.error('❌ [DB] List error:', dbError.message);
        // To avoid split read/write confusion, if DB failed earlier we already forced memory
        const sortedCandidates = [...candidates].reverse().map(candidate => ({
          id: candidate.id,
          full_name: `${candidate.firstName} ${candidate.lastName}`,
          email: candidate.email || '',
          phone: candidate.phone || '',
          current_title: candidate.currentTitle || '',
          current_employer: candidate.currentEmployer || '',
          salary_min: candidate.salaryMin || null,
          salary_max: candidate.salaryMax || null,
          skills: candidate.skills || { communications: false, campaigns: false, policy: false, publicAffairs: false },
          tags: candidate.tags || [],
          notes: candidate.notes || '',
          email_ok: candidate.emailOk || true,
          created_at: candidate.createdAt,
          updated_at: candidate.updatedAt || candidate.createdAt
        }));
        console.log('✅ [MEM] Returning candidates:', sortedCandidates.length);
        res.json({ success: true, candidates: sortedCandidates, total: sortedCandidates.length });
      }
    } else {
      // Use in-memory storage
      const sortedCandidates = [...candidates].reverse().map(candidate => ({
        id: candidate.id,
        full_name: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email || '',
        phone: candidate.phone || '',
        current_title: candidate.currentTitle || '',
        current_employer: candidate.currentEmployer || '',
        salary_min: candidate.salaryMin || null,
        salary_max: candidate.salaryMax || null,
        skills: candidate.skills || { communications: false, campaigns: false, policy: false, publicAffairs: false },
        tags: candidate.tags || [],
        notes: candidate.notes || '',
        email_ok: candidate.emailOk || true,
        created_at: candidate.createdAt,
        updated_at: candidate.updatedAt || candidate.createdAt
      }));
      console.log('✅ [MEM] Returning candidates:', sortedCandidates.length);
      res.json({ success: true, candidates: sortedCandidates, total: sortedCandidates.length });
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
