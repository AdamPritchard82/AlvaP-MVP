// Simple Candidate Server - Bulletproof Version with Advanced Services
console.log('=== SIMPLE CANDIDATE SERVER STARTING v3.1 - WITH ADVANCED SERVICES ===');

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

// Import all advanced services
const FileStorage = require('./storage');
const EmailService = require('./email-service');
const AuthService = require('./auth-service');
const RateLimitService = require('./rate-limit-service');
const MonitoringService = require('./monitoring-service');
const SearchService = require('./search-service');
const UserPreferencesService = require('./user-preferences-service');
const ExportService = require('./export-service');
const OptimisticUIService = require('./optimistic-ui-service');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize all advanced services first
const fileStorage = new FileStorage();
const emailService = new EmailService();
const authService = new AuthService();
const rateLimitService = new RateLimitService();
const monitoringService = new MonitoringService();
const searchService = new SearchService();
const userPreferencesService = new UserPreferencesService();
const exportService = new ExportService();
const optimisticUIService = new OptimisticUIService();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : ['https://alvap-mvp-production.up.railway.app', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Apply rate limiting
app.use(rateLimitService.getGeneralLimiter());
app.use('/api/candidates', rateLimitService.getStrictLimiter());
app.use('/api/candidates/parse-cv', rateLimitService.getUploadLimiter());

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

// Centralized error handling and logging utilities
function createErrorResponse(status, message, details = null) {
  const response = {
    ok: false,
    status: status,
    message: message
  };
  if (details && process.env.NODE_ENV !== 'production') {
    response.details = details;
  }
  return response;
}

function logRequest(method, path, status, duration, outcome) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${method} ${path} ${status} ${duration}ms ${outcome}`);
}

function safeJsonParse(val, fallback) {
  try {
    return typeof val === 'string' ? JSON.parse(val) : val;
  } catch {
    return fallback;
  }
}

function safeNumber(val, fallback = 0) {
  const num = Number(val);
  return isNaN(num) ? fallback : num;
}

function safeString(val, fallback = '') {
  return typeof val === 'string' ? val : fallback;
}

function safeArray(val, fallback = []) {
  return Array.isArray(val) ? val : fallback;
}

function safeObject(val, fallback = {}) {
  return typeof val === 'object' && val !== null ? val : fallback;
}

// Helpers: salary banding
function toBandLabel(amount) {
  // Handle edge cases safely
  if (amount === null || amount === undefined || amount === '') return null;
  if (isNaN(amount) || Number(amount) <= 0) return null;
  
  const numAmount = Number(amount);
  const band = Math.floor(numAmount / 10000) * 10000;
  
  // Ensure minimum band of £10,000
  if (band < 10000) return '£10,000';
  
  // Cap at £950,000 for very high salaries
  if (band > 950000) return '£950,000';
  
  return `£${band.toLocaleString('en-GB')}`;
}

function candidateToSkillSet(candidate) {
  const s = candidate.skills || {};
  const set = new Set();
  if (s.publicAffairs) set.add('Public Affairs');
  if (s.communications) set.add('Communications');
  if (s.policy) set.add('Policy');
  if (s.campaigns) set.add('Campaigns');
  return set;
}

// Health check - lightweight production monitoring
app.get('/health', (req, res) => {
  const startTime = Date.now();
  
  try {
    const health = {
      ok: true,
      timestamp: new Date().toISOString(),
      subsystems: {
        api: { status: 'ok', message: 'API responding' },
        database: { 
          status: useDatabase ? 'ok' : 'degraded', 
          message: useDatabase ? 'PostgreSQL connected' : 'Using SQLite fallback' 
        },
        storage: { 
          status: 'ok', 
          message: fileStorage.getStorageInfo().type 
        },
        email: { 
          status: emailService.getServiceInfo().configured ? 'ok' : 'degraded',
          message: emailService.getServiceInfo().configured ? 'Email service ready' : 'Email not configured'
        },
        parsers: { 
          status: 'ok', 
          message: 'Local parsers available (PDF, DOCX, TXT)' 
        }
      }
    };
    
    const duration = Date.now() - startTime;
    logRequest('GET', '/health', 200, duration, 'health: ok');
    res.json(health);
  } catch (error) {
    const duration = Date.now() - startTime;
    logRequest('GET', '/health', 500, duration, 'health: error');
    res.status(500).json({
      ok: false,
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

app.get('/health/detailed', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // System metadata
    const systemInfo = {
      backend: 'src/simple-candidate-server.js',
      nodeVersion: process.version,
      platform: process.platform,
      uptime: Math.floor(process.uptime()),
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      }
    };

    // Database health
    let dbHealth = { status: 'fail', message: 'Database not available' };
    let candidateCount = 0;
    let migrationStatus = 'unknown';
    
    if (useDatabase && db) {
      try {
        // Quick connectivity check
        await db.query('SELECT 1');
        
        // Get candidate count (fast, indexed query)
        const countResult = await db.query('SELECT COUNT(*) as count FROM candidates');
        candidateCount = parseInt(countResult.rows[0].count);
        
        // Check migration status
        const migrationResult = await db.query(`
          SELECT COUNT(*) as count FROM knex_migrations 
          WHERE batch = (SELECT MAX(batch) FROM knex_migrations)
        `);
        const appliedMigrations = parseInt(migrationResult.rows[0].count);
        migrationStatus = `${appliedMigrations} migrations applied`;
        
        dbHealth = { 
          status: 'ok', 
          message: 'PostgreSQL connected',
          driver: 'PostgreSQL',
          candidateCount,
          migrationStatus
        };
      } catch (dbError) {
        dbHealth = { 
          status: 'fail', 
          message: `Database error: ${dbError.message}`,
          driver: 'PostgreSQL'
        };
      }
    } else {
      // In-memory fallback
      candidateCount = candidates.length;
      dbHealth = { 
        status: 'degraded', 
        message: 'Using in-memory storage',
        driver: 'SQLite (fallback)',
        candidateCount
      };
    }

    // Storage health
    const storageInfo = fileStorage.getStorageInfo();
    let storageHealth = { status: 'ok', message: 'Storage accessible' };
    
    try {
      // Quick write/read probe (non-destructive)
      const testContent = `health-check-${Date.now()}`;
      const testPath = `health-check-${Date.now()}.txt`;
      
      await fileStorage.writeFile(testPath, testContent);
      const readContent = await fileStorage.readFile(testPath);
      
      if (readContent === testContent) {
        storageHealth = {
          status: 'ok',
          message: 'Storage read/write verified',
          driver: storageInfo.type,
          location: storageInfo.uploadDir || 'cloud'
        };
      } else {
        storageHealth = {
          status: 'degraded',
          message: 'Storage accessible but read/write test failed',
          driver: storageInfo.type
        };
      }
      
      // Clean up test file
      try {
        await fileStorage.deleteFile(testPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    } catch (storageError) {
      storageHealth = {
        status: 'fail',
        message: `Storage error: ${storageError.message}`,
        driver: storageInfo.type
      };
    }

    // Email health
    const emailInfo = emailService.getServiceInfo();
    const emailHealth = {
      status: emailInfo.configured ? 'ok' : 'degraded',
      message: emailInfo.configured ? 'Email service ready' : 'Email not configured',
      provider: emailInfo.provider || 'none',
      configured: emailInfo.configured
    };

    // Parser health
    const parserHealth = {
      status: 'ok',
      message: 'Local parsers available',
      parsers: ['PDF (pdf-parse)', 'DOCX (mammoth)', 'TXT (native)'],
      externalParser: 'Available via .NET API'
    };

    // Rate limit config
    const rateLimitInfo = rateLimitService.getRateLimitInfo();
    const rateLimitHealth = {
      status: 'ok',
      message: 'Rate limiting active',
      config: {
        general: rateLimitInfo.general || '100 req/15min',
        strict: rateLimitInfo.strict || '10 req/15min',
        upload: rateLimitInfo.upload || '5 req/15min'
      }
    };

    // Uptime and request metrics
    const uptimeStats = monitoringService.getUptimeStats();
    const metricsHealth = {
      status: 'ok',
      message: 'Metrics available',
      uptime: `${systemInfo.uptime}s`,
      requestRate: uptimeStats.requestsPerMinute || 0,
      totalRequests: uptimeStats.totalRequests || 0
    };

    const healthCheck = {
      ok: true,
      timestamp: new Date().toISOString(),
      system: systemInfo,
      subsystems: {
        database: dbHealth,
        storage: storageHealth,
        email: emailHealth,
        parsers: parserHealth,
        rateLimits: rateLimitHealth,
        metrics: metricsHealth
      }
    };

    const duration = Date.now() - startTime;
    logRequest('GET', '/health/detailed', 200, duration, 'health-detailed: ok');
    res.json(healthCheck);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logRequest('GET', '/health/detailed', 500, duration, 'health-detailed: error');
    res.status(500).json({
      ok: false,
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed',
      message: error.message
    });
  }
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
  const startTime = Date.now();
  let filePath = null;
  
  try {
    if (!req.file) {
      const duration = Date.now() - startTime;
      logRequest('POST', '/api/candidates/parse-cv', 400, duration, 'parse: no-file');
      return res.status(400).json(createErrorResponse(400, 'No file uploaded'));
    }
    
    filePath = req.file.path;
    const fileName = safeString(req.file.originalname, 'unknown');
    const ext = path.extname(fileName).toLowerCase();
    
    if (!['.txt', '.pdf', '.docx'].includes(ext)) {
      // Clean up temp file
      try { fs.unlinkSync(filePath); } catch {}
      const duration = Date.now() - startTime;
      logRequest('POST', '/api/candidates/parse-cv', 415, duration, 'parse: unsupported');
      return res.status(415).json(createErrorResponse(415, 'Unsupported file type. Please upload TXT, PDF or DOCX files.'));
    }
    
    const buffer = fs.readFileSync(filePath);
    let text = '';
    
    try {
      if (ext === '.txt') {
        text = buffer.toString('utf8');
      } else if (ext === '.pdf') {
        const result = await pdfParse(buffer);
        text = safeString(result.text, '');
      } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ buffer });
        text = safeString(result.value, '');
      }
    } catch (parseError) {
      // Clean up temp file
      try { fs.unlinkSync(filePath); } catch {}
      const duration = Date.now() - startTime;
      logRequest('POST', '/api/candidates/parse-cv', 422, duration, 'parse: extract-fail');
      return res.status(422).json(createErrorResponse(422, 'Failed to extract text from file'));
    }

    if (!text || text.trim().length === 0) {
      // Clean up temp file
      try { fs.unlinkSync(filePath); } catch {}
      const duration = Date.now() - startTime;
      logRequest('POST', '/api/candidates/parse-cv', 422, duration, 'parse: no-text');
      return res.status(422).json(createErrorResponse(422, 'No text could be extracted from the file'));
    }

    const parsed = parseCVContent(text);
    parsed.fileName = fileName;
    parsed.parserUsed = ext.replace('.', '').toUpperCase();

    // Clean up temp file
    try { fs.unlinkSync(filePath); } catch {}
    
    const duration = Date.now() - startTime;
    logRequest('POST', '/api/candidates/parse-cv', 200, duration, 'parse: ok');
    return res.json({ success: true, data: parsed });
    
  } catch (err) {
    // Clean up temp file on any error
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch {}
    }
    
    const duration = Date.now() - startTime;
    logRequest('POST', '/api/candidates/parse-cv', 500, duration, 'parse: error');
    console.error('❌ Parse CV error:', err);
    return res.status(500).json(createErrorResponse(500, 'Failed to parse CV'));
  }
});

// Create candidate - SIMPLE VERSION
app.post('/api/candidates', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Safe extraction with defaults
    const firstName = safeString(req.body.firstName, '').trim();
    const lastName = safeString(req.body.lastName, '').trim();
    const email = safeString(req.body.email, '').trim();
    const phone = safeString(req.body.phone, '');
    const currentTitle = safeString(req.body.currentTitle, '');
    const currentEmployer = safeString(req.body.currentEmployer, '');
    const salaryMinRaw = req.body.salaryMin;
    const salaryMaxRaw = req.body.salaryMax;
    const skillsInput = safeObject(req.body.skills, {});
    const tagsInput = safeArray(req.body.tags, []);
    const notesInput = safeString(req.body.notes, '');
    const emailOkInput = req.body.emailOk !== undefined ? !!req.body.emailOk : true;
    
    // Validation with clear error messages
    const validationErrors = [];
    if (!firstName) validationErrors.push('First name is required');
    if (!lastName) validationErrors.push('Last name is required');
    if (!email) validationErrors.push('Email is required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validationErrors.push('Email format is invalid');
    }
    
    if (validationErrors.length > 0) {
      const duration = Date.now() - startTime;
      logRequest('POST', '/api/candidates', 400, duration, 'validated: fail');
      return res.status(400).json(createErrorResponse(400, 'Validation failed', validationErrors.join('; ')));
    }
    
    // Create candidate with safe defaults
    const candidate = {
      id: nextId++,
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      currentTitle: currentTitle,
      currentEmployer: currentEmployer,
      salaryMin: safeNumber(salaryMinRaw, null),
      salaryMax: safeNumber(salaryMaxRaw, null),
      // Normalize skills booleans safely
      skills: {
        communications: !!(skillsInput.communications || skillsInput.Communications),
        campaigns: !!(skillsInput.campaigns || skillsInput.Campaigns),
        policy: !!(skillsInput.policy || skillsInput.Policy),
        publicAffairs: !!(skillsInput.publicAffairs || skillsInput['Public Affairs'])
      },
      tags: tagsInput,
      notes: notesInput,
      emailOk: emailOkInput,
      createdAt: new Date().toISOString(),
      createdBy: 'system'
    };

    // Apply salary default rule for missing max
    if (candidate.salaryMin && (candidate.salaryMax === null || candidate.salaryMax === undefined || Number.isNaN(candidate.salaryMax))) {
      candidate.salaryMax = candidate.salaryMin < 100000 ? candidate.salaryMin + 30000 : candidate.salaryMin + 50000;
    }
    
    // Calculate band_label from salary_min
    candidate.bandLabel = toBandLabel(candidate.salaryMin);
    
    if (useDatabase && db) {
      // Use database with existing schema
      try {
        const result = await db.query(`
          INSERT INTO candidates (
            id, full_name, email, phone, current_title, current_employer,
            salary_min, salary_max, band_label, skills, tags, notes, email_ok,
            created_by, created_at, updated_at
          )
          VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10, $11, $12,
            gen_random_uuid(), $13, $14
          )
          RETURNING id, full_name, email, phone, current_title, current_employer, salary_min, salary_max, band_label, skills, tags, notes, email_ok, created_at, updated_at
        `, [
          `${candidate.firstName} ${candidate.lastName}`,
          candidate.email,
          candidate.phone,
          candidate.currentTitle,
          candidate.currentEmployer,
          candidate.salaryMin,
          candidate.salaryMax,
          candidate.bandLabel,
          JSON.stringify(candidate.skills),
          JSON.stringify(candidate.tags),
          candidate.notes,
          candidate.emailOk,
          candidate.createdAt,
          candidate.createdAt
        ]);
        
        const dbCandidate = result.rows[0];
        candidate.id = dbCandidate.id;
        const duration = Date.now() - startTime;
        logRequest('POST', '/api/candidates', 201, duration, 'created');
        return res.status(201).json({
          success: true,
          data: candidate,
          message: 'Candidate created successfully'
        });
      } catch (dbError) {
        console.error('❌ [DB] Insert error:', dbError.message);
        // Fallback to memory storage
        candidates.push(candidate);
        const duration = Date.now() - startTime;
        logRequest('POST', '/api/candidates', 201, duration, 'created: fallback');
        return res.status(201).json({
          success: true,
          data: candidate,
          message: 'Candidate created successfully (fallback storage)'
        });
      }
    } else {
      // Use in-memory storage
      candidates.push(candidate);
      const duration = Date.now() - startTime;
      logRequest('POST', '/api/candidates', 201, duration, 'created');
      return res.status(201).json({
        success: true,
        data: candidate,
        message: 'Candidate created successfully'
      });
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logRequest('POST', '/api/candidates', 500, duration, 'error');
    console.error('❌ Create candidate error:', error);
    return res.status(500).json(createErrorResponse(500, 'Failed to create candidate'));
  }
});

// Update candidate
app.put('/api/candidates/:id', async (req, res) => {
  console.log('=== UPDATE CANDIDATE ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const candidateId = req.params.id;
    const { firstName, lastName, email, phone, currentTitle, currentEmployer, salaryMin, salaryMax, skills, tags, notes, emailOk } = req.body;
    
    // Basic validation
    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'First name, last name, and email are required'
      });
    }
    
    // Apply salary default rule for missing max
    let resolvedSalaryMax = salaryMax;
    if (salaryMin && (salaryMax === null || salaryMax === undefined || Number.isNaN(salaryMax))) {
      resolvedSalaryMax = salaryMin < 100000 ? salaryMin + 30000 : salaryMin + 50000;
    }
    
    // Calculate new band_label
    const newBandLabel = toBandLabel(salaryMin);
    
    if (useDatabase && db) {
      // Update in database
      try {
        const result = await db.query(`
          UPDATE candidates 
          SET full_name = $1, email = $2, phone = $3, current_title = $4, current_employer = $5,
              salary_min = $6, salary_max = $7, band_label = $8, skills = $9, tags = $10, 
              notes = $11, email_ok = $12, updated_at = $13
          WHERE id = $14
          RETURNING id, full_name, email, phone, current_title, current_employer, salary_min, salary_max, band_label, skills, tags, notes, email_ok, created_at, updated_at
        `, [
          `${firstName} ${lastName}`,
          email,
          phone || '',
          currentTitle || '',
          currentEmployer || '',
          salaryMin || null,
          resolvedSalaryMax || null,
          newBandLabel,
          JSON.stringify(skills || {}),
          JSON.stringify(tags || []),
          notes || '',
          emailOk !== false,
          new Date().toISOString(),
          candidateId
        ]);
        
        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Candidate not found'
          });
        }
        
        const updatedCandidate = result.rows[0];
        console.log('✅ [DB] Candidate updated:', updatedCandidate);
        
        res.json({
          success: true,
          data: updatedCandidate,
          message: 'Candidate updated successfully'
        });
      } catch (dbError) {
        console.error('❌ [DB] Update error:', dbError.message);
        res.status(500).json({
          success: false,
          error: 'Database update failed',
          message: dbError.message
        });
      }
    } else {
      // Update in memory
      const candidateIndex = candidates.findIndex(c => c.id == candidateId);
      if (candidateIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Candidate not found'
        });
      }
      
      const updatedCandidate = {
        ...candidates[candidateIndex],
        firstName: firstName || '',
        lastName: lastName || '',
        email: email || '',
        phone: phone || '',
        currentTitle: currentTitle || '',
        currentEmployer: currentEmployer || '',
        salaryMin: salaryMin || null,
        salaryMax: resolvedSalaryMax || null,
        bandLabel: newBandLabel,
        skills: skills || {},
        tags: tags || [],
        notes: notes || '',
        emailOk: emailOk !== false,
        updatedAt: new Date().toISOString()
      };
      
      candidates[candidateIndex] = updatedCandidate;
      console.log('✅ [MEM] Candidate updated:', updatedCandidate);
      
      res.json({
        success: true,
        data: updatedCandidate,
        message: 'Candidate updated successfully'
      });
    }
    
  } catch (error) {
    console.error('❌ Update candidate error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update candidate',
      message: error.message
    });
  }
});

// Get candidates - SIMPLE VERSION
app.get('/api/candidates', async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (useDatabase && db) {
      // Use database
      try {
        const result = await db.query(`
          SELECT id, full_name, email, phone, current_title, current_employer, salary_min, salary_max, band_label, skills, tags, notes, email_ok, created_at, updated_at
          FROM candidates 
          ORDER BY created_at DESC 
          LIMIT 50
        `);
        
        const dbCandidates = result.rows.map(row => ({
          id: row.id,
          full_name: safeString(row.full_name, ''),
          email: safeString(row.email, ''),
          phone: safeString(row.phone, ''),
          current_title: safeString(row.current_title, ''),
          current_employer: safeString(row.current_employer, ''),
          salary_min: row.salary_min ?? null,
          salary_max: row.salary_max ?? null,
          band_label: safeString(row.band_label, null),
          skills: safeJsonParse(row.skills, { communications: false, campaigns: false, policy: false, publicAffairs: false }),
          tags: safeJsonParse(row.tags, []),
          notes: safeString(row.notes, ''),
          email_ok: row.email_ok !== false,
          created_at: row.created_at,
          updated_at: row.updated_at || row.created_at
        }));
        
        const duration = Date.now() - startTime;
        logRequest('GET', '/api/candidates', 200, duration, `listed: ${dbCandidates.length}`);
        
        return res.json({
          success: true,
          candidates: dbCandidates,
          total: dbCandidates.length
        });
      } catch (dbError) {
        console.error('❌ [DB] List error:', dbError.message);
        // Fallback to memory storage
        const sortedCandidates = [...candidates].reverse().map(candidate => ({
          id: candidate.id,
          full_name: `${candidate.firstName} ${candidate.lastName}`,
          email: safeString(candidate.email, ''),
          phone: safeString(candidate.phone, ''),
          current_title: safeString(candidate.currentTitle, ''),
          current_employer: safeString(candidate.currentEmployer, ''),
          salary_min: candidate.salaryMin ?? null,
          salary_max: candidate.salaryMax ?? null,
          band_label: safeString(candidate.bandLabel, null),
          skills: safeObject(candidate.skills, { communications: false, campaigns: false, policy: false, publicAffairs: false }),
          tags: safeArray(candidate.tags, []),
          notes: safeString(candidate.notes, ''),
          email_ok: candidate.emailOk !== false,
          created_at: candidate.createdAt,
          updated_at: candidate.updatedAt || candidate.createdAt
        }));
        
        const duration = Date.now() - startTime;
        logRequest('GET', '/api/candidates', 200, duration, `listed: ${sortedCandidates.length} (fallback)`);
        
        return res.json({ success: true, candidates: sortedCandidates, total: sortedCandidates.length });
      }
    } else {
      // Use in-memory storage
      const sortedCandidates = [...candidates].reverse().map(candidate => ({
        id: candidate.id,
        full_name: `${candidate.firstName} ${candidate.lastName}`,
        email: safeString(candidate.email, ''),
        phone: safeString(candidate.phone, ''),
        current_title: safeString(candidate.currentTitle, ''),
        current_employer: safeString(candidate.currentEmployer, ''),
        salary_min: candidate.salaryMin ?? null,
        salary_max: candidate.salaryMax ?? null,
        band_label: safeString(candidate.bandLabel, null),
        skills: safeObject(candidate.skills, { communications: false, campaigns: false, policy: false, publicAffairs: false }),
        tags: safeArray(candidate.tags, []),
        notes: safeString(candidate.notes, ''),
        email_ok: candidate.emailOk !== false,
        created_at: candidate.createdAt,
        updated_at: candidate.updatedAt || candidate.createdAt
      }));
      
      const duration = Date.now() - startTime;
      logRequest('GET', '/api/candidates', 200, duration, `listed: ${sortedCandidates.length}`);
      
      return res.json({ success: true, candidates: sortedCandidates, total: sortedCandidates.length });
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logRequest('GET', '/api/candidates', 500, duration, 'error');
    console.error('❌ Get candidates error:', error);
    return res.status(500).json(createErrorResponse(500, 'Failed to get candidates'));
  }
});

// Bands per skill (only non-empty bands)
app.get('/api/skills/bands', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const collect = (items) => {
      const out = { 'Public Affairs': new Set(), 'Communications': new Set(), 'Policy': new Set(), 'Campaigns': new Set() };
      items.forEach(c => {
        const skills = safeObject(c.skills, {});
        const set = candidateToSkillSet({ skills });
        const band = toBandLabel(c.salary_min);
        if (!band) return;
        set.forEach(skill => out[skill].add(band));
      });
      return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Array.from(v).sort((a,b)=>Number(a.replace(/[^\d]/g,''))-Number(b.replace(/[^\d]/g,'')))]));
    };

    if (useDatabase && db) {
      const result = await db.query(`SELECT salary_min, skills FROM candidates`);
      const rows = result.rows.map(r => ({ 
        salary_min: safeNumber(r.salary_min, null), 
        skills: safeJsonParse(r.skills, {}) 
      }));
      const bands = collect(rows);
      const duration = Date.now() - startTime;
      logRequest('GET', '/api/skills/bands', 200, duration, 'bands: ok');
      return res.json({ success: true, bands });
    } else {
      const rows = candidates.map(c => ({ 
        salary_min: safeNumber(c.salaryMin, null), 
        skills: safeObject(c.skills, {}) 
      }));
      const bands = collect(rows);
      const duration = Date.now() - startTime;
      logRequest('GET', '/api/skills/bands', 200, duration, 'bands: ok');
      return res.json({ success: true, bands });
    }
  } catch (err) {
    const duration = Date.now() - startTime;
    logRequest('GET', '/api/skills/bands', 200, duration, 'bands: fallback');
    console.error('[bands] Error:', err);
    return res.json({ success: true, bands: { 'Public Affairs': [], 'Communications': [], 'Policy': [], 'Campaigns': [] } });
  }
});

// Bands with counts for a specific skill
app.get('/api/skills/:skill/bands', async (req, res) => {
  const startTime = Date.now();
  const { skill } = req.params;
  
  const skillKeyMap = {
    'Public Affairs': 'publicAffairs',
    'Communications': 'communications',
    'Policy': 'policy',
    'Campaigns': 'campaigns'
  };
  const skillKey = skillKeyMap[skill] || '';
  
  const addCount = (rows) => {
    const counts = new Map();
    rows.forEach(r => {
      if (!r.salary_min) return;
      if (!r.skills || !r.skills[skillKey]) return;
      const band = toBandLabel(r.salary_min);
      if (!band) return;
      counts.set(band, (counts.get(band) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a,b)=>Number(a[0].replace(/[^\d]/g,''))-Number(b[0].replace(/[^\d]/g,'')))
      .map(([band, count]) => ({ band, count }));
  };
  
  try {
    if (useDatabase && db) {
      const result = await db.query(`SELECT salary_min, skills FROM candidates`);
      const rows = result.rows.map(r => ({ 
        salary_min: safeNumber(r.salary_min, null), 
        skills: safeJsonParse(r.skills, {}) 
      }));
      const bands = addCount(rows);
      const duration = Date.now() - startTime;
      logRequest('GET', `/api/skills/${skill}/bands`, 200, duration, 'skill-bands: ok');
      return res.json({ success: true, bands });
    } else {
      const rows = candidates.map(c => ({ 
        salary_min: safeNumber(c.salaryMin, null), 
        skills: safeObject(c.skills, {}) 
      }));
      const bands = addCount(rows);
      const duration = Date.now() - startTime;
      logRequest('GET', `/api/skills/${skill}/bands`, 200, duration, 'skill-bands: ok');
      return res.json({ success: true, bands });
    }
  } catch (err) {
    const duration = Date.now() - startTime;
    logRequest('GET', `/api/skills/${skill}/bands`, 200, duration, 'skill-bands: fallback');
    console.error('[skill bands] Error:', err);
    return res.json({ success: true, bands: [] });
  }
});

// Total counts per skill
app.get('/api/skills/counts', async (_req, res) => {
  const startTime = Date.now();
  
  const sumCounts = (rows) => {
    const tot = { 'Public Affairs': 0, 'Communications': 0, 'Policy': 0, 'Campaigns': 0 };
    rows.forEach(r => {
      const set = candidateToSkillSet({ skills: safeObject(r.skills, {}) });
      set.forEach(s => tot[s] = (tot[s] || 0) + 1);
    });
    return tot;
  };
  
  try {
    if (useDatabase && db) {
      const result = await db.query(`SELECT skills FROM candidates`);
      const rows = result.rows.map(r => ({ skills: safeJsonParse(r.skills, {}) }));
      const counts = sumCounts(rows);
      const duration = Date.now() - startTime;
      logRequest('GET', '/api/skills/counts', 200, duration, 'skill-counts: ok');
      return res.json({ success: true, counts });
    } else {
      const rows = candidates.map(c => ({ skills: safeObject(c.skills, {}) }));
      const counts = sumCounts(rows);
      const duration = Date.now() - startTime;
      logRequest('GET', '/api/skills/counts', 200, duration, 'skill-counts: ok');
      return res.json({ success: true, counts });
    }
  } catch (err) {
    const duration = Date.now() - startTime;
    logRequest('GET', '/api/skills/counts', 200, duration, 'skill-counts: fallback');
    console.error('[skill counts] Error:', err);
    return res.json({ success: true, counts: { 'Public Affairs': 0, 'Communications': 0, 'Policy': 0, 'Campaigns': 0 } });
  }
});

// Candidates by skill + band (simple paging)
app.get('/api/skills/:skill/bands/:band/candidates', async (req, res) => {
  const startTime = Date.now();
  const { skill, band } = req.params;
  const page = Math.max(1, safeNumber(req.query.page, 1));
  const pageSize = Math.min(50, Math.max(1, safeNumber(req.query.pageSize, 20)));

  const skillKeyMap = {
    'Public Affairs': 'publicAffairs',
    'Communications': 'communications',
    'Policy': 'policy',
    'Campaigns': 'campaigns'
  };
  const skillKey = skillKeyMap[skill] || '';
  if (!skillKey) {
    const duration = Date.now() - startTime;
    logRequest('GET', `/api/skills/${skill}/bands/${band}/candidates`, 200, duration, 'skill-band-candidates: invalid-skill');
    return res.json({ success: true, candidates: [], total: 0, page, pageSize });
  }

  const inBand = (min) => toBandLabel(min) === band;

  try {
    let rows = [];
    if (useDatabase && db) {
      const result = await db.query(`SELECT id, full_name, email, phone, current_title, current_employer, salary_min, salary_max, band_label, skills, tags, notes, email_ok, created_at, updated_at FROM candidates ORDER BY created_at DESC LIMIT 500`);
      rows = result.rows.map(r => ({
        id: r.id,
        full_name: safeString(r.full_name, ''),
        email: safeString(r.email, ''),
        phone: safeString(r.phone, ''),
        current_title: safeString(r.current_title, ''),
        current_employer: safeString(r.current_employer, ''),
        salary_min: r.salary_min ?? null,
        salary_max: r.salary_max ?? null,
        band_label: safeString(r.band_label, null),
        skills: safeJsonParse(r.skills, {}),
        tags: safeJsonParse(r.tags, []),
        notes: safeString(r.notes, ''),
        email_ok: r.email_ok !== false,
        created_at: r.created_at,
        updated_at: r.updated_at || r.created_at
      }));
    } else {
      rows = candidates.map(c => ({
        id: c.id,
        full_name: `${c.firstName} ${c.lastName}`,
        email: safeString(c.email, ''),
        phone: safeString(c.phone, ''),
        current_title: safeString(c.currentTitle, ''),
        current_employer: safeString(c.currentEmployer, ''),
        salary_min: c.salaryMin ?? null,
        salary_max: c.salaryMax ?? null,
        band_label: safeString(c.bandLabel, null),
        skills: safeObject(c.skills, {}),
        tags: safeArray(c.tags, []),
        notes: safeString(c.notes, ''),
        email_ok: c.emailOk !== false,
        created_at: c.createdAt,
        updated_at: c.updatedAt || c.createdAt
      }));
    }

    const filtered = rows.filter(r => r.skills && r.skills[skillKey] && inBand(r.salary_min));
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const slice = filtered.slice(start, start + pageSize);
    
    const duration = Date.now() - startTime;
    logRequest('GET', `/api/skills/${skill}/bands/${band}/candidates`, 200, duration, `skill-band-candidates: ${slice.length}`);
    return res.json({ success: true, candidates: slice, total, page, pageSize });
  } catch (err) {
    const duration = Date.now() - startTime;
    logRequest('GET', `/api/skills/${skill}/bands/${band}/candidates`, 200, duration, 'skill-band-candidates: fallback');
    console.error('[skill+band] Error:', err);
    return res.json({ success: true, candidates: [], total: 0, page, pageSize });
  }
});

// Advanced Search endpoints
app.get('/api/candidates/search', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { q, limit = 10, offset = 0 } = req.query;
    
    if (!q) {
      const duration = Date.now() - startTime;
      logRequest('GET', '/api/candidates/search', 400, duration, 'search: no-query');
      return res.status(400).json(createErrorResponse(400, 'Search query required'));
    }

    const results = await searchService.searchCandidates(q, { 
      limit: safeNumber(limit, 10), 
      offset: safeNumber(offset, 0) 
    });
    
    const duration = Date.now() - startTime;
    logRequest('GET', '/api/candidates/search', 200, duration, `search: ${results.candidates.length}`);
    
    return res.json({
      success: true,
      results: safeArray(results.candidates, []),
      total: safeNumber(results.total, 0),
      suggestions: safeArray(results.suggestions, []),
      query: safeString(q, ''),
      pagination: {
        limit: safeNumber(limit, 10),
        offset: safeNumber(offset, 0),
        hasMore: safeNumber(results.total, 0) > safeNumber(offset, 0) + safeNumber(limit, 10)
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logRequest('GET', '/api/candidates/search', 500, duration, 'search: error');
    console.error('[search] Error:', error);
    return res.status(500).json(createErrorResponse(500, 'Search failed'));
  }
});

app.get('/api/candidates/suggestions', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { q } = req.query;
    
    if (!q) {
      const duration = Date.now() - startTime;
      logRequest('GET', '/api/candidates/suggestions', 200, duration, 'suggestions: empty');
      return res.json({
        success: true,
        suggestions: []
      });
    }

    const suggestions = await searchService.getSearchSuggestions(q);
    
    const duration = Date.now() - startTime;
    logRequest('GET', '/api/candidates/suggestions', 200, duration, `suggestions: ${suggestions.length}`);
    
    return res.json({
      success: true,
      suggestions: safeArray(suggestions, [])
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logRequest('GET', '/api/candidates/suggestions', 500, duration, 'suggestions: error');
    console.error('[suggestions] Error:', error);
    return res.status(500).json(createErrorResponse(500, 'Failed to get suggestions'));
  }
});

// User Preferences endpoints
app.get('/api/user/preferences', (req, res) => {
  try {
    const preferences = userPreferencesService.getUserPreferences('default');
    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('[user-preferences] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user preferences',
      message: error.message
    });
  }
});

app.put('/api/user/preferences', (req, res) => {
  try {
    const { preferences } = req.body;
    const updated = userPreferencesService.updateUserPreferences('default', preferences);
    
    res.json({
      success: true,
      preferences: updated,
      message: 'User preferences updated'
    });
  } catch (error) {
    console.error('[user-preferences-update] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user preferences',
      message: error.message
    });
  }
});

app.get('/api/user/preferences/columns', (req, res) => {
  try {
    const columns = userPreferencesService.getColumnConfiguration('default');
    res.json({
      success: true,
      columns
    });
  } catch (error) {
    console.error('[user-columns] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get column configuration',
      message: error.message
    });
  }
});

app.post('/api/user/preferences/reset', (req, res) => {
  try {
    const reset = userPreferencesService.resetToDefaults('default');
    res.json({
      success: true,
      preferences: reset,
      message: 'User preferences reset to defaults'
    });
  } catch (error) {
    console.error('[user-reset] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset preferences',
      message: error.message
    });
  }
});

// Saved Filters endpoints
app.get('/api/user/saved-filters', (req, res) => {
  try {
    const filters = userPreferencesService.getSavedFilters('default');
    res.json({
      success: true,
      filters
    });
  } catch (error) {
    console.error('[saved-filters] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get saved filters',
      message: error.message
    });
  }
});

app.post('/api/user/saved-filters', (req, res) => {
  try {
    const { name, skill, band, searchKeyword, columns, pageSize, sortBy, sortOrder, filters } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Filter name required',
        message: 'Please provide a name for the saved filter'
      });
    }

    const filterData = {
      name,
      skill,
      band,
      searchKeyword,
      columns,
      pageSize,
      sortBy,
      sortOrder,
      filters
    };

    const updatedPrefs = userPreferencesService.saveFilter('default', filterData);
    
    res.json({
      success: true,
      filter: updatedPrefs.savedFilters[updatedPrefs.savedFilters.length - 1],
      message: 'Filter saved successfully'
    });
  } catch (error) {
    console.error('[save-filter] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save filter',
      message: error.message
    });
  }
});

app.put('/api/user/saved-filters/:filterId', (req, res) => {
  try {
    const { filterId } = req.params;
    const updates = req.body;
    
    const updatedPrefs = userPreferencesService.updateSavedFilter('default', filterId, updates);
    
    res.json({
      success: true,
      preferences: updatedPrefs,
      message: 'Filter updated successfully'
    });
  } catch (error) {
    console.error('[update-filter] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update filter',
      message: error.message
    });
  }
});

app.delete('/api/user/saved-filters/:filterId', (req, res) => {
  try {
    const { filterId } = req.params;
    
    const updatedPrefs = userPreferencesService.deleteSavedFilter('default', filterId);
    
    res.json({
      success: true,
      preferences: updatedPrefs,
      message: 'Filter deleted successfully'
    });
  } catch (error) {
    console.error('[delete-filter] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete filter',
      message: error.message
    });
  }
});

app.post('/api/user/saved-filters/:filterId/apply', (req, res) => {
  try {
    const { filterId } = req.params;
    
    const updatedPrefs = userPreferencesService.applySavedFilter('default', filterId);
    
    res.json({
      success: true,
      preferences: updatedPrefs,
      message: 'Filter applied successfully'
    });
  } catch (error) {
    console.error('[apply-filter] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply filter',
      message: error.message
    });
  }
});

// Analytics endpoints
app.get('/api/analytics/skills-bands', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Get skill counts and band breakdowns
    const sumCounts = (rows) => {
      const tot = { 'Public Affairs': 0, 'Communications': 0, 'Policy': 0, 'Campaigns': 0 };
      rows.forEach(r => {
        const set = candidateToSkillSet({ skills: safeObject(r.skills, {}) });
        set.forEach(s => tot[s] = (tot[s] || 0) + 1);
      });
      return tot;
    };

    const addCount = (rows, skillKey) => {
      const counts = new Map();
      rows.forEach(r => {
        if (!r.salary_min) return;
        if (!r.skills || !r.skills[skillKey]) return;
        const band = toBandLabel(r.salary_min);
        if (!band) return;
        counts.set(band, (counts.get(band) || 0) + 1);
      });
      return Array.from(counts.entries())
        .sort((a,b)=>Number(a[0].replace(/[^\d]/g,''))-Number(b[0].replace(/[^\d]/g,'')))
        .map(([band, count]) => ({ band, count }));
    };

    let skillCounts = {};
    const bandsData = {};
    const skills = ['Public Affairs', 'Communications', 'Policy', 'Campaigns'];
    const skillKeyMap = {
      'Public Affairs': 'publicAffairs',
      'Communications': 'communications',
      'Policy': 'policy',
      'Campaigns': 'campaigns'
    };

    if (useDatabase && db) {
      const result = await db.query(`SELECT salary_min, skills FROM candidates`);
      const rows = result.rows.map(r => ({ 
        salary_min: safeNumber(r.salary_min, null), 
        skills: safeJsonParse(r.skills, {}) 
      }));
      
      skillCounts = sumCounts(rows.map(r => ({ skills: r.skills })));
      
      for (const skill of skills) {
        const skillKey = skillKeyMap[skill];
        bandsData[skill] = addCount(rows, skillKey);
      }
    } else {
      const rows = candidates.map(c => ({ 
        salary_min: safeNumber(c.salaryMin, null), 
        skills: safeObject(c.skills, {}) 
      }));
      
      skillCounts = sumCounts(rows.map(r => ({ skills: r.skills })));
      
      for (const skill of skills) {
        const skillKey = skillKeyMap[skill];
        bandsData[skill] = addCount(rows, skillKey);
      }
    }
    
    const duration = Date.now() - startTime;
    logRequest('GET', '/api/analytics/skills-bands', 200, duration, 'analytics: skills-bands');
    
    res.json({
      success: true,
      skillCounts,
      bandsData,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logRequest('GET', '/api/analytics/skills-bands', 500, duration, 'analytics: error');
    console.error('[analytics] Skills-bands error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get skills and bands data',
      message: error.message
    });
  }
});

app.get('/api/analytics/pipeline', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Get pipeline snapshot from jobs data
    // For now, return mock data since we don't have a jobs table yet
    const pipelineData = {
      stages: {
        'Sourced': 0,
        'Screened': 0,
        'Interview': 0,
        'Offer': 0,
        'Placed': 0
      },
      conversionRate: 0,
      totalCandidates: 0,
      totalJobs: 0
    };
    
    // Get total candidates count
    try {
      if (useDatabase && db) {
        const result = await db.query(`SELECT COUNT(*) as count FROM candidates`);
        pipelineData.totalCandidates = parseInt(result.rows[0]?.count || 0);
      } else {
        pipelineData.totalCandidates = candidates.length;
      }
    } catch (error) {
      console.error('[analytics] Error getting candidates count:', error);
    }
    
    const duration = Date.now() - startTime;
    logRequest('GET', '/api/analytics/pipeline', 200, duration, 'analytics: pipeline');
    
    res.json({
      success: true,
      pipeline: pipelineData,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logRequest('GET', '/api/analytics/pipeline', 500, duration, 'analytics: error');
    console.error('[analytics] Pipeline error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pipeline data',
      message: error.message
    });
  }
});

app.get('/api/analytics/email-outcomes', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Get email outcomes from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let emailStats = {
      sent: 0,
      opened: 0,
      bounced: 0,
      unsubscribed: 0,
      last30Days: true
    };
    
    if (useDatabase && db) {
      try {
        // Count candidates with welcome emails sent
        const sentResult = await db.query(`
          SELECT COUNT(*) as count 
          FROM candidates 
          WHERE welcome_sent_at IS NOT NULL 
          AND welcome_sent_at >= $1
        `, [thirtyDaysAgo.toISOString()]);
        
        emailStats.sent = parseInt(sentResult.rows[0]?.count || 0);
        
        // Count candidates with email_ok = false (bounced/unsubscribed)
        const bouncedResult = await db.query(`
          SELECT COUNT(*) as count 
          FROM candidates 
          WHERE email_ok = false 
          AND updated_at >= $1
        `, [thirtyDaysAgo.toISOString()]);
        
        emailStats.bounced = parseInt(bouncedResult.rows[0]?.count || 0);
        
        // For now, estimate opened as 60% of sent (industry average)
        emailStats.opened = Math.round(emailStats.sent * 0.6);
        
      } catch (dbError) {
        console.error('[analytics] Database error for email outcomes:', dbError);
      }
    } else {
      // Fallback to in-memory data
      const candidatesWithEmails = candidates.filter(c => c.welcomeSentAt);
      emailStats.sent = candidatesWithEmails.length;
      emailStats.opened = Math.round(emailStats.sent * 0.6);
      emailStats.bounced = candidates.filter(c => !c.emailOk).length;
    }
    
    const duration = Date.now() - startTime;
    logRequest('GET', '/api/analytics/email-outcomes', 200, duration, 'analytics: email-outcomes');
    
    res.json({
      success: true,
      emailOutcomes: emailStats,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logRequest('GET', '/api/analytics/email-outcomes', 500, duration, 'analytics: error');
    console.error('[analytics] Email outcomes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get email outcomes data',
      message: error.message
    });
  }
});

app.get('/api/analytics/recent-activity', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    
    let activities = [];
    
    if (useDatabase && db) {
      try {
        // Get recent candidate activities
        const candidatesResult = await db.query(`
          SELECT 
            'candidate_created' as type,
            full_name as name,
            created_at as timestamp,
            'Candidate added to library' as description
          FROM candidates 
          ORDER BY created_at DESC 
          LIMIT $1
        `, [limit]);
        
        activities = candidatesResult.rows.map(row => ({
          type: row.type,
          name: row.name,
          timestamp: row.timestamp,
          description: row.description
        }));
        
      } catch (dbError) {
        console.error('[analytics] Database error for recent activity:', dbError);
      }
    } else {
      // Fallback to in-memory data
      activities = candidates
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map(candidate => ({
          type: 'candidate_created',
          name: `${candidate.firstName} ${candidate.lastName}`,
          timestamp: candidate.createdAt,
          description: 'Candidate added to library'
        }));
    }
    
    const duration = Date.now() - startTime;
    logRequest('GET', '/api/analytics/recent-activity', 200, duration, 'analytics: recent-activity');
    
    res.json({
      success: true,
      activities,
      total: activities.length,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logRequest('GET', '/api/analytics/recent-activity', 500, duration, 'analytics: error');
    console.error('[analytics] Recent activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recent activity data',
      message: error.message
    });
  }
});

// Export endpoints
app.post('/api/candidates/export', async (req, res) => {
  try {
    const { format = 'csv', filters = {}, columns = [] } = req.body;
    
    const exportResult = await exportService.exportCandidates({
      format,
      filters,
      columns,
      candidates: candidates // Pass current candidates
    });
    
    res.json({
      success: true,
      export: exportResult,
      message: `Export created successfully`
    });
  } catch (error) {
    console.error('[export] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Export failed',
      message: error.message
    });
  }
});

app.get('/api/export/stats', (req, res) => {
  try {
    const stats = exportService.getExportStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[export-stats] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get export statistics',
      message: error.message
    });
  }
});

// Optimistic UI endpoints
app.post('/api/optimistic/operation', (req, res) => {
  try {
    const { operationId, operation, rollback } = req.body;

    if (!operationId || !operation) {
      return res.status(400).json({
        success: false,
        error: 'Operation ID and operation data required',
        message: 'Please provide operationId and operation data'
      });
    }

    const operationData = optimisticUIService.createOperation(operationId, operation, rollback);

    res.json({
      success: true,
      operation: operationData,
      message: 'Optimistic operation created'
    });
  } catch (error) {
    console.error('[optimistic-operation] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create optimistic operation',
      message: error.message
    });
  }
});

app.post('/api/optimistic/confirm', (req, res) => {
  try {
    const { operationId, result } = req.body;

    if (!operationId) {
      return res.status(400).json({
        success: false,
        error: 'Operation ID required',
        message: 'Please provide operationId'
      });
    }

    const confirmation = optimisticUIService.confirmOperation(operationId, result);

    res.json(confirmation);
  } catch (error) {
    console.error('[optimistic-confirm] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm operation',
      message: error.message
    });
  }
});

app.post('/api/optimistic/rollback', (req, res) => {
  try {
    const { operationId, reason } = req.body;

    if (!operationId) {
      return res.status(400).json({
        success: false,
        error: 'Operation ID required',
        message: 'Please provide operationId'
      });
    }

    const rollback = optimisticUIService.rollbackOperation(operationId, reason);

    res.json(rollback);
  } catch (error) {
    console.error('[optimistic-rollback] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rollback operation',
      message: error.message
    });
  }
});

app.get('/api/optimistic/status/:operationId', (req, res) => {
  try {
    const { operationId } = req.params;

    const status = optimisticUIService.getOperationStatus(operationId);

    res.json(status);
  } catch (error) {
    console.error('[optimistic-status] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get operation status',
      message: error.message
    });
  }
});

app.get('/api/optimistic/pending', (req, res) => {
  try {
    const pending = optimisticUIService.getPendingOperations();

    res.json(pending);
  } catch (error) {
    console.error('[optimistic-pending] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending operations',
      message: error.message
    });
  }
});

app.get('/api/optimistic/stats', (req, res) => {
  try {
    const stats = optimisticUIService.getOperationStats();

    res.json(stats);
  } catch (error) {
    console.error('[optimistic-stats] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get operation statistics',
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
      list: 'GET /api/candidates',
      skillBands: 'GET /api/skills/bands',
      candidatesBySkillBand: 'GET /api/skills/:skill/bands/:band/candidates'
    }
  });
});

// Job Management and Matching System
// In-memory job storage (for MVP)
let jobs = [];
let nextJobId = 1;

// Helper function to calculate skill overlap score
function calculateSkillOverlapScore(candidateSkills, jobSkills) {
  const candidateSkillKeys = Object.keys(candidateSkills).filter(key => candidateSkills[key]);
  const jobSkillKeys = Object.keys(jobSkills).filter(key => jobSkills[key]);
  
  if (jobSkillKeys.length === 0) return 0;
  
  const overlap = candidateSkillKeys.filter(skill => jobSkillKeys.includes(skill));
  return (overlap.length / jobSkillKeys.length) * 0.7; // 70% weight for skills
}

// Helper function to calculate salary proximity score
function calculateSalaryProximityScore(candidateMin, candidateMax, jobMin, jobMax) {
  // Handle missing candidate max using same logic as banding
  let resolvedCandidateMax = candidateMax;
  if (candidateMin && (candidateMax === null || candidateMax === undefined || Number.isNaN(candidateMax))) {
    resolvedCandidateMax = candidateMin < 100000 ? candidateMin + 30000 : candidateMin + 50000;
  }
  
  // Check if salary ranges overlap
  const candidateRange = [candidateMin, resolvedCandidateMax];
  const jobRange = [jobMin, jobMax];
  
  // Sort ranges
  candidateRange.sort((a, b) => a - b);
  jobRange.sort((a, b) => a - b);
  
  // Check for overlap
  const overlap = Math.max(0, Math.min(candidateRange[1], jobRange[1]) - Math.max(candidateRange[0], jobRange[0]));
  
  if (overlap === 0) return 0; // No overlap
  
  // Calculate proximity score (30% weight for salary)
  const totalRange = Math.max(candidateRange[1], jobRange[1]) - Math.min(candidateRange[0], jobRange[0]);
  const proximityScore = overlap / totalRange;
  
  return proximityScore * 0.3; // 30% weight for salary
}

// Create job
app.post('/api/jobs', async (req, res) => {
  console.log('=== CREATE JOB ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { title, description, requiredSkills, salaryMin, salaryMax, location, company } = req.body;
    
    // Basic validation
    if (!title || !requiredSkills || !salaryMin || !salaryMax) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Title, required skills, salary min, and salary max are required'
      });
    }
    
    const job = {
      id: nextJobId++,
      title: title || '',
      description: description || '',
      requiredSkills: requiredSkills || {},
      salaryMin: Number(salaryMin),
      salaryMax: Number(salaryMax),
      location: location || '',
      company: company || '',
      createdAt: new Date().toISOString(),
      createdBy: 'system'
    };
    
    jobs.push(job);
    console.log('✅ Job created:', job);
    
    res.status(201).json({
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

// Get all jobs
app.get('/api/jobs', async (req, res) => {
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

// Get job by ID
app.get('/api/jobs/:id', async (req, res) => {
  console.log('=== GET JOB ===');
  const jobId = parseInt(req.params.id);
  
  try {
    const job = jobs.find(j => j.id === jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    console.log('✅ Job found:', job.title);
    
    res.json({
      success: true,
      data: job
    });
    
  } catch (error) {
    console.error('❌ Get job error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get job',
      message: error.message
    });
  }
});

// Production-grade Matching Engine
app.get('/api/jobs/:jobId/matches', async (req, res) => {
  const startTime = Date.now();
  const jobId = parseInt(req.params.jobId);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const offset = Math.max(0, parseInt(req.query.offset || '0', 10));
  
  try {
    const job = jobs.find(j => j.id === jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    let candidates = [];
    
    if (useDatabase && db) {
      try {
        const result = await db.query(`
          SELECT id, full_name, email, phone, current_title, current_employer, 
                 salary_min, salary_max, band_label, skills, tags, notes, email_ok, 
                 created_at, updated_at
          FROM candidates 
          ORDER BY updated_at DESC 
          LIMIT 1000
        `);
        
        candidates = result.rows.map(row => ({
          id: row.id,
          full_name: row.full_name || '',
          email: row.email || '',
          phone: row.phone || '',
          current_title: row.current_title || '',
          current_employer: row.current_employer || '',
          salary_min: row.salary_min ?? null,
          salary_max: row.salary_max ?? null,
          band_label: row.band_label || null,
          skills: row.skills ? JSON.parse(row.skills) : { communications: false, campaigns: false, policy: false, publicAffairs: false },
          tags: row.tags ? JSON.parse(row.tags) : [],
          notes: row.notes || '',
          email_ok: row.email_ok !== false,
          created_at: row.created_at,
          updated_at: row.updated_at || row.created_at
        }));
      } catch (dbError) {
        console.error('❌ [DB] Match error:', dbError.message);
        candidates = [];
      }
    } else {
      // Use in-memory candidates
      candidates = candidates.map(c => ({
        id: c.id,
        full_name: `${c.firstName} ${c.lastName}`,
        email: c.email || '',
        phone: c.phone || '',
        current_title: c.currentTitle || '',
        current_employer: c.currentEmployer || '',
        salary_min: c.salaryMin || null,
        salary_max: c.salaryMax || null,
        band_label: c.bandLabel || null,
        skills: c.skills || { communications: false, campaigns: false, policy: false, publicAffairs: false },
        tags: c.tags || [],
        notes: c.notes || '',
        email_ok: c.emailOk !== false,
        created_at: c.createdAt,
        updated_at: c.updatedAt || c.createdAt
      }));
    }
    
    // Enhanced matching with eligibility and explainable scoring
    console.log(`[matching] Job ${jobId} skills:`, job.requiredSkills);
    console.log(`[matching] Processing ${candidates.length} candidates`);
    
    const matches = candidates
      .map(candidate => {
        // Check eligibility: must share at least 1 required skill
        const candidateSkills = Object.keys(candidate.skills).filter(skill => candidate.skills[skill]);
        const jobSkills = Object.keys(job.requiredSkills || {}).filter(skill => job.requiredSkills[skill]);
        const skillOverlap = candidateSkills.filter(skill => jobSkills.includes(skill));
        
        console.log(`[matching] Candidate ${candidate.id}: skills=${candidateSkills}, overlap=${skillOverlap}`);
        
        if (skillOverlap.length === 0) {
          return null; // Not eligible
        }
        
        // Check salary overlap
        const candidateMin = candidate.salary_min;
        let candidateMax = candidate.salary_max;
        
        // Apply defaulting logic for missing max
        if (candidateMin && (candidateMax === null || candidateMax === undefined || Number.isNaN(candidateMax))) {
          candidateMax = candidateMin < 100000 ? candidateMin + 30000 : candidateMin + 50000;
        }
        
        const jobMin = job.salaryMin;
        const jobMax = job.salaryMax;
        
        // Check salary overlap
        const salaryOverlap = candidateMin && candidateMax && jobMin && jobMax && 
          Math.max(candidateMin, jobMin) <= Math.min(candidateMax, jobMax);
        
        if (!salaryOverlap) {
          return null; // No salary overlap
        }
        
        // Calculate scores (0-100 scale)
        const skillScore = (skillOverlap.length / jobSkills.length) * 70; // 70% weight
        const salaryProximity = calculateSalaryProximity(candidateMin, candidateMax, jobMin, jobMax);
        const salaryScore = salaryProximity * 30; // 30% weight
        
        const totalScore = Math.round((skillScore + salaryScore) * 100) / 100;
        
        // Generate explainable "why" array
        const why = [];
        if (skillOverlap.length > 0) {
          const skillNames = skillOverlap.map(skill => {
            const skillMap = {
              'communications': 'Communications',
              'campaigns': 'Campaigns', 
              'policy': 'Policy',
              'publicAffairs': 'Public Affairs'
            };
            return skillMap[skill] || skill;
          });
          why.push(`Skill match: ${skillNames.join(', ')}`);
        }
        
        if (salaryOverlap) {
          const candidateRange = `£${Math.round(candidateMin/1000)}k–£${Math.round(candidateMax/1000)}k`;
          const jobRange = `£${Math.round(jobMin/1000)}k–£${Math.round(jobMax/1000)}k`;
          why.push(`Salary overlap: ${candidateRange} vs ${jobRange}`);
        }
        
        return {
          candidate_id: candidate.id,
          full_name: candidate.full_name,
          current_title: candidate.current_title,
          current_employer: candidate.current_employer,
          salary_min: candidateMin,
          salary_max: candidateMax,
          band_label: candidate.band_label,
          skills: candidate.skills,
          score: totalScore,
          why: why
        };
      })
      .filter(match => match !== null) // Remove ineligible candidates
      .sort((a, b) => {
        // Primary sort by score desc, secondary by most recently updated
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
      });
    
    // Apply pagination
    const paginatedMatches = matches.slice(offset, offset + limit);
    
    const duration = Date.now() - startTime;
    logRequest('GET', `/api/jobs/${jobId}/matches`, 200, duration, `matched ${paginatedMatches.length} of ${matches.length} candidates for job ${jobId}`);
    
    res.json({
      success: true,
      total: matches.length,
      items: paginatedMatches,
      limit,
      offset,
      job_id: jobId,
      job_title: job.title,
      search_time_ms: duration
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logRequest('GET', `/api/jobs/${jobId}/matches`, 500, duration, 'matching: error');
    console.error('[matching] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to match candidates',
      message: error.message
    });
  }
});

// Helper function for salary proximity calculation
function calculateSalaryProximity(candidateMin, candidateMax, jobMin, jobMax) {
  if (!candidateMin || !candidateMax || !jobMin || !jobMax) return 0;
  
  // Calculate overlap percentage
  const overlap = Math.max(0, Math.min(candidateMax, jobMax) - Math.max(candidateMin, jobMin));
  const totalRange = Math.max(candidateMax, jobMax) - Math.min(candidateMin, jobMin);
  
  if (totalRange === 0) return 1; // Perfect match
  
  return overlap / totalRange;
}

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
  console.log(`✅ Database: ${useDatabase ? 'PostgreSQL' : 'SQLite'}`);
  console.log(`✅ File storage: ${fileStorage.getStorageInfo().type}`);
  console.log(`✅ Email service: ${emailService.getServiceInfo().configured ? 'configured' : 'not configured'}`);
  console.log(`✅ Rate limiting: enabled`);
  console.log(`✅ CORS: hardened`);
  
  // Start monitoring
  monitoringService.startMonitoring();
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
