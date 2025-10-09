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
// Environment & database selection
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.RAILWAY_STATIC_URL;
const hasPostgresUrl = Boolean(process.env.DATABASE_URL);
const usePostgres = hasPostgresUrl || false;

// Debug logging
console.log('🔍 Environment Debug:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('  RAILWAY_STATIC_URL:', process.env.RAILWAY_STATIC_URL);
console.log('  DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('  DATABASE_URL value:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('  isProduction:', isProduction);
console.log('  hasPostgresUrl:', hasPostgresUrl);
console.log('  usePostgres:', usePostgres);

if (isProduction) {
  // In production we must use Postgres – SQLite is disabled to avoid split environments
  if (!hasPostgresUrl) {
    console.error('❌ FATAL: DATABASE_URL is not set in production. Refusing to start with SQLite.');
    console.error('Please set DATABASE_URL in Railway environment variables.');
    process.exit(1);
  }
}

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

// Run Knex migrations on startup
(async () => {
  try {
    const { runMigrations } = require('./db-knex');
    await runMigrations();
  } catch (error) {
    console.error('⚠️ Migration warning (continuing):', error.message);
    // Don't exit on migration errors in case of existing data
  }
})();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - Hardened CORS configuration
const allowedOrigins = [
    'https://alvap-mvp-production.up.railway.app',
  'https://natural-kindness-production.up.railway.app', // Frontend URL
    'http://localhost:5173',
    'http://localhost:3000'
];

// Add frontend URL from environment if provided
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.warn(`🚫 CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'), false);
  },
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

// Apply rate limiting
app.use(rateLimitService.getGeneralLimiter());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// File storage setup
const FileStorage = require('./storage');
const fileStorage = new FileStorage();

// Email service setup
const EmailService = require('./email-service');
const emailService = new EmailService();

// Authentication service setup
const AuthService = require('./auth-service');
const authService = new AuthService();

// Rate limiting service setup
const RateLimitService = require('./rate-limit-service');
const rateLimitService = new RateLimitService();

// Monitoring service setup
const MonitoringService = require('./monitoring-service');
const monitoringService = new MonitoringService();

// Search service setup
const SearchService = require('./search-service');
const searchService = new SearchService();

// User preferences service setup
const UserPreferencesService = require('./user-preferences-service');
const userPreferencesService = new UserPreferencesService();

// Export service setup
const ExportService = require('./export-service');
const exportService = new ExportService();

// Optimistic UI service setup
const OptimisticUIService = require('./optimistic-ui-service');
const optimisticUIService = new OptimisticUIService();

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

// Temporarily disable .NET parser to test local parsing
if (false && (process.env.ENABLE_DOTNET_PARSER === 'true' || process.env.ENABLE_DOTNET_PARSER === '1')) {
  try {
    const { DotNetCvParser } = require('./parsers/dotnetCvParser');
    dotNetParser = new DotNetCvParser(actualDotNetApiUrl);
    console.log('✅ .NET CV Parser enabled:', actualDotNetApiUrl);
  } catch (error) {
    console.warn('⚠️ .NET CV Parser disabled:', error.message);
  }
} else {
  console.log('ℹ️ .NET CV Parser temporarily disabled for testing');
  console.log('ℹ️ Using local parsers only');
}

// Enhanced CV parsing function (fallback)
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

  // If still not found, try header-area heuristics (first ~15 non-empty lines)
  if (!currentTitle || !currentEmployer) {
    const headerWindow = lines.slice(0, Math.min(15, lines.length));
    const companySuffixes = /(Limited|Ltd\.?|PLC|LLC|Inc\.?|Incorporated|GmbH|SAS|BV|SA|PTY|Pty\.? Ltd\.?)/i;
    const roleKeywords = /(Manager|Director|Coordinator|Specialist|Analyst|Consultant|Advisor|Officer|Executive|Lead|Head|Chief|Engineer|Developer|Designer|Assistant|Associate)/i;
    const blacklist = /(Government|Parliament|Westminster|European\s+Parliament)/i;

    for (let i = 0; i < headerWindow.length; i++) {
      const line = headerWindow[i];
      if (!line || line.length < 3) continue;

      // Common patterns
      const patterns = [
        // "Title at Company"
        { type: 'title_at_company', rx: /^([A-Z][A-Za-z &/\-]+)\s+at\s+([A-Z][A-Za-z0-9 &.,'\-]+)$/i },
        // "Title, Company"
        { type: 'title_comma_company', rx: /^([A-Z][A-Za-z &/\-]+),\s+([A-Z][A-Za-z0-9 &.,'\-]+)$/ },
        // "Company - Title" or "Company — Title"
        { type: 'company_dash_title', rx: /^([A-Z][A-Za-z0-9 &.,'\-]+)\s+[\-\u2013\u2014]\s+([A-Z][A-Za-z &/\-]+)$/ },
        // "Title @ Company"
        { type: 'title_at_symbol_company', rx: /^([A-Z][A-Za-z &/\-]+)\s+@\s+([A-Z][A-Za-z0-9 &.,'\-]+)$/ }
      ];

      let matched = false;
      for (const { type, rx } of patterns) {
        const m = line.match(rx);
        if (m && m[1] && m[2]) {
          // Select which is title/company based on pattern type
          if (type === 'company_dash_title') {
            // company, title
            const candidateEmployer = m[1].trim();
            const candidateTitle = m[2].trim();
            // Validate candidates
            const titleOk = roleKeywords.test(candidateTitle) && !blacklist.test(candidateTitle);
            const employerOk = (!blacklist.test(candidateEmployer)) && (companySuffixes.test(candidateEmployer) || /\b(Company|Group|Ltd|PLC|Inc|LLC|Holdings)\b/i.test(candidateEmployer) || candidateEmployer.split(/\s+/).length >= 2);
            if (titleOk && employerOk) {
              if (!currentEmployer) currentEmployer = candidateEmployer;
              if (!currentTitle) currentTitle = candidateTitle;
              matched = true;
              break;
            }
          } else {
            // title, company
            const candidateTitle = m[1].trim();
            const candidateEmployer = m[2].trim();
            // Validate candidates
            const titleOk = roleKeywords.test(candidateTitle) && !blacklist.test(candidateTitle);
            const employerOk = (!blacklist.test(candidateEmployer)) && (companySuffixes.test(candidateEmployer) || /\b(Company|Group|Ltd|PLC|Inc|LLC|Holdings)\b/i.test(candidateEmployer) || candidateEmployer.split(/\s+/).length >= 2);
            if (titleOk && employerOk) {
              if (!currentTitle) currentTitle = candidateTitle;
              if (!currentEmployer) currentEmployer = candidateEmployer;
              matched = true;
              break;
            }
          }
        }
      }
      if (matched) break;

      // Fallback: two-line combo where one looks like a title and the next looks like a company
      if (i + 1 < headerWindow.length && (!currentTitle || !currentEmployer)) {
        const next = headerWindow[i + 1];
        const looksLikeTitle = /^[A-Z][A-Za-z &/\-]{3,}$/.test(line) && !companySuffixes.test(line);
        const looksLikeCompany = /^[A-Z][A-Za-z0-9 &.,'\-]{3,}$/.test(next) && (companySuffixes.test(next) || /\b(Ltd|Limited|Inc|PLC|LLC)\b/i.test(next));
        if (looksLikeTitle && looksLikeCompany) {
          if (!currentTitle) currentTitle = line.trim();
          if (!currentEmployer) currentEmployer = next.trim();
          break;
        }
      }
    }

    if (currentTitle || currentEmployer) {
      console.log('Header heuristics found job info:', { title: currentTitle, employer: currentEmployer });
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

// CV Parsing endpoint with .NET integration
app.post('/api/candidates/parse-cv', rateLimitService.getUploadLimiter(), upload.single('file'), async (req, res) => {
  console.log('[parse-cv] Route started');
  console.log('[parse-cv] Request body:', req.body);
  console.log('[parse-cv] Request file:', req.file);
  
  try {
    if (!req.file) {
      console.log('[parse-cv] No file uploaded');
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
    
    // Store file in persistent storage and clean up temp file
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const storageResult = await fileStorage.saveFile(fileBuffer, fileName, req.file.mimetype);
      console.log('[parse-cv] File stored:', storageResult.storageType, storageResult.fileId);
      
      // Clean up temporary file
      fs.unlinkSync(filePath);
      console.log('[parse-cv] Cleaned up temporary file');
      
      // Add storage info to response
      parsedData.storageInfo = {
        fileId: storageResult.fileId,
        storageType: storageResult.storageType,
        url: storageResult.url
      };
    } catch (storageError) {
      console.warn('[parse-cv] File storage failed:', storageError.message);
      // Clean up temp file anyway
      try {
        fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.warn('[parse-cv] Could not clean up file:', cleanupError.message);
      }
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
    console.error('[parse-cv] Error stack:', error.stack);
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
      try {
      const { query } = require('./db-postgres');
        console.log('[create-candidate] Inserting into PostgreSQL...');
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
        console.log('[create-candidate] PostgreSQL insert OK for id', candidateData.id);
      } catch (pgErr) {
        console.error('[create-candidate] PostgreSQL insert error:', pgErr);
        throw new Error(pgErr.message);
      }
    } else {
      const dbInstance = db();
      
      // Ensure table exists first
      try {
        const tableCheck = dbInstance.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='candidates'").get();
        if (!tableCheck) {
          console.log('[create-candidate] Creating candidates table...');
          dbInstance.exec(`
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
        }
        
      const stmt = dbInstance.prepare(`
        INSERT INTO candidates (id, full_name, email, phone, current_title, current_employer, salary_min, salary_max, skills, tags, notes, email_ok, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
        const result = stmt.run(
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
        
        console.log('[create-candidate] SQLite insert result:', result);
        
        // Verify the insert worked
        const verify = dbInstance.prepare('SELECT COUNT(*) as count FROM candidates WHERE id = ?').get(candidateData.id);
        console.log('[create-candidate] Verification - row exists:', verify.count > 0);
        
        if (verify.count === 0) {
          throw new Error('Insert verification failed - row not found after insert');
        }
        
      } catch (dbError) {
        console.error('[create-candidate] Database error:', dbError);
        throw new Error(`Database insert failed: ${dbError.message}`);
      }
    }
    
    console.log(`[create-candidate] Candidate created: ${candidateId}, email: ${candidateData.email}`);
    
    // Send welcome email if email is valid and email_ok is true
    if (candidateData.email && candidateData.emailOk) {
      try {
        const emailResult = await emailService.sendWelcomeEmail(candidateData);
        if (emailResult.success) {
          console.log(`[create-candidate] Welcome email sent to ${candidateData.email}`);
        } else {
          console.warn(`[create-candidate] Failed to send welcome email:`, emailResult.reason || emailResult.error);
        }
      } catch (emailError) {
        console.warn(`[create-candidate] Email service error:`, emailError.message);
      }
    }
    
    res.status(201).json({
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

// Get candidates endpoint with advanced search and pagination
app.get('/api/candidates', async (req, res) => {
  console.log('[get-candidates] Route started');
  
  try {
    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const skills = req.query.skills ? req.query.skills.split(',') : [];
    const tags = req.query.tags ? req.query.tags.split(',') : [];
    const salaryMin = req.query.salaryMin ? parseInt(req.query.salaryMin) : null;
    const salaryMax = req.query.salaryMax ? parseInt(req.query.salaryMax) : null;
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder || 'desc';
    
    console.log('[get-candidates] Query params:', { page, limit, search, skills, tags, salaryMin, salaryMax, sortBy, sortOrder });
    
    if (usePostgres) {
      try {
      const { query } = require('./db-postgres');
        
        // Build dynamic WHERE clause
        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;
        
        // Search across multiple fields
        if (search) {
          whereConditions.push(`(
            full_name ILIKE $${paramIndex} OR 
            email ILIKE $${paramIndex} OR 
            current_title ILIKE $${paramIndex} OR 
            current_employer ILIKE $${paramIndex} OR
            notes ILIKE $${paramIndex}
          )`);
          queryParams.push(`%${search}%`);
          paramIndex++;
        }
        
        // Skills filter
        if (skills.length > 0) {
          const skillConditions = skills.map(skill => {
            whereConditions.push(`skills->>'${skill}' = 'true'`);
          });
        }
        
        // Tags filter
        if (tags.length > 0) {
          const tagConditions = tags.map(tag => {
            whereConditions.push(`tags @> $${paramIndex}`);
            queryParams.push(`["${tag}"]`);
            paramIndex++;
          });
        }
        
        // Salary range filter
        if (salaryMin !== null) {
          whereConditions.push(`(salary_min >= $${paramIndex} OR salary_max >= $${paramIndex})`);
          queryParams.push(salaryMin);
          paramIndex++;
        }
        
        if (salaryMax !== null) {
          whereConditions.push(`(salary_max <= $${paramIndex} OR salary_min <= $${paramIndex})`);
          queryParams.push(salaryMax);
          paramIndex++;
        }
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        // Build ORDER BY clause
        const validSortFields = ['created_at', 'full_name', 'email', 'current_title', 'current_employer', 'salary_min', 'salary_max'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
        const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        
        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM candidates ${whereClause}`;
        const countResult = await query(countQuery, queryParams);
        const total = parseInt(countResult.rows[0].total);
        
        // Get paginated results
        const dataQuery = `
          SELECT * FROM candidates 
          ${whereClause}
          ORDER BY ${sortField} ${sortDirection}
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        queryParams.push(limit, offset);
        
        const result = await query(dataQuery, queryParams);
        const rows = result.rows || [];
        
        // Parse JSON fields
        const safeParse = (str, fallback) => {
          if (!str) return fallback;
          try { return JSON.parse(str); } catch { return fallback; }
        };
        const parsed = rows.map(r => ({
          ...r,
          tags: safeParse(r.tags, []),
          skills: safeParse(r.skills, {})
        }));
        
        console.log(`[get-candidates] Found ${parsed.length} candidates in PostgreSQL (page ${page}/${Math.ceil(total / limit)})`);
        
      res.json({
        success: true,
          candidates: parsed,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
          },
          filters: {
            search,
            skills,
            tags,
            salaryMin,
            salaryMax
          }
        });
      } catch (pgErr) {
        console.error('[get-candidates] PostgreSQL error:', pgErr);
        return res.status(500).json({ success: false, error: 'Failed to load candidates', message: pgErr.message });
      }
    } else {
      const dbInstance = db();
      
      // First check if candidates table exists
      try {
        const tableCheck = dbInstance.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='candidates'").get();
        console.log('[get-candidates] Table exists:', !!tableCheck);
        
        if (!tableCheck) {
          console.log('[get-candidates] Creating candidates table...');
          // Create the table if it doesn't exist
          dbInstance.exec(`
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
        }
        
        // Build SQLite query with filters
        let whereConditions = [];
        let queryParams = [];
        
        if (search) {
          whereConditions.push(`(
            full_name LIKE ? OR 
            email LIKE ? OR 
            current_title LIKE ? OR 
            current_employer LIKE ? OR
            notes LIKE ?
          )`);
          const searchTerm = `%${search}%`;
          queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }
        
        if (salaryMin !== null) {
          whereConditions.push(`(salary_min >= ? OR salary_max >= ?)`);
          queryParams.push(salaryMin, salaryMin);
        }
        
        if (salaryMax !== null) {
          whereConditions.push(`(salary_max <= ? OR salary_min <= ?)`);
          queryParams.push(salaryMax, salaryMax);
        }
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM candidates ${whereClause}`;
        const countResult = dbInstance.prepare(countQuery).get(...queryParams);
        const total = countResult.total;
        
        // Get paginated results
        const validSortFields = ['created_at', 'full_name', 'email', 'current_title', 'current_employer', 'salary_min', 'salary_max'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
        const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        
        const dataQuery = `
          SELECT * FROM candidates 
          ${whereClause}
          ORDER BY ${sortField} ${sortDirection}
          LIMIT ? OFFSET ?
        `;
        queryParams.push(limit, offset);
        
        const candidates = dbInstance.prepare(dataQuery).all(...queryParams) || [];
        console.log(`[get-candidates] Found ${candidates.length} candidates in SQLite (page ${page}/${Math.ceil(total / limit)})`);
        
        // Parse JSON fields for SQLite with null safety
        const parsedCandidates = candidates
          .filter(candidate => candidate !== null && candidate !== undefined)
          .map(candidate => {
            try {
              return {
                ...candidate,
                tags: candidate.tags ? JSON.parse(candidate.tags) : [],
                skills: candidate.skills ? JSON.parse(candidate.skills) : {}
              };
            } catch (parseError) {
              console.error('[get-candidates] JSON parse error for candidate:', candidate.id, parseError);
              return {
                ...candidate,
                tags: [],
                skills: {}
              };
            }
          });
        
      res.json({
        success: true,
          candidates: parsedCandidates,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
          },
          filters: {
            search,
            skills,
            tags,
            salaryMin,
            salaryMax
          }
        });
      } catch (dbError) {
        console.error('[get-candidates] Database error:', dbError);
        res.status(500).json({
          success: false,
          error: 'Database error',
          message: dbError.message
        });
      }
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

// Advanced search endpoint with fuzzy search
app.get('/api/candidates/search', async (req, res) => {
  console.log('[search-candidates] Route started');
  
  try {
    const query = req.query.q || '';
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    
    if (!query.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Search query required',
        message: 'Please provide a search query'
      });
    }
    
    console.log('[search-candidates] Search query:', query);
    
    // Get all candidates for fuzzy search
    let allCandidates = [];
    if (usePostgres) {
      try {
        const { query: dbQuery } = require('./db-postgres');
        const result = await dbQuery('SELECT * FROM candidates ORDER BY created_at DESC');
        const rows = result.rows || [];
        
        const safeParse = (str, fallback) => {
          if (!str) return fallback;
          try { return JSON.parse(str); } catch { return fallback; }
        };
        
        allCandidates = rows.map(r => ({
          ...r,
          tags: safeParse(r.tags, []),
          skills: safeParse(r.skills, {})
        }));
      } catch (pgErr) {
        console.error('[search-candidates] PostgreSQL error:', pgErr);
        return res.status(500).json({ success: false, error: 'Database error', message: pgErr.message });
      }
    } else {
      const dbInstance = db();
      const candidates = dbInstance.prepare('SELECT * FROM candidates ORDER BY created_at DESC').all() || [];
      
      allCandidates = candidates
        .filter(candidate => candidate !== null && candidate !== undefined)
        .map(candidate => {
          try {
            return {
              ...candidate,
              tags: candidate.tags ? JSON.parse(candidate.tags) : [],
              skills: candidate.skills ? JSON.parse(candidate.skills) : {}
            };
          } catch (parseError) {
            return {
              ...candidate,
              tags: [],
              skills: {}
            };
          }
        });
    }
    
    // Perform fuzzy search with relevance scoring
    const searchResults = await searchService.searchCandidates(query, allCandidates, {
      limit,
      page
    });
    
    // Get search suggestions
    const suggestions = searchService.generateSearchSuggestions(query, allCandidates);
    
    // Get search analytics
    const analytics = searchService.getSearchAnalytics(searchResults, query);
    
    // Apply pagination to results
    const paginatedResults = searchResults.slice(offset, offset + limit);
    
    console.log(`[search-candidates] Found ${searchResults.length} results for "${query}"`);
    
    res.json({
      success: true,
      results: paginatedResults,
      pagination: {
        page,
        limit,
        total: searchResults.length,
        totalPages: Math.ceil(searchResults.length / limit),
        hasNext: page < Math.ceil(searchResults.length / limit),
        hasPrev: page > 1
      },
      suggestions,
      analytics,
      query
    });
    
  } catch (error) {
    console.error('[search-candidates] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

// Search suggestions endpoint
app.get('/api/candidates/suggestions', async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit) || 10;
    
    if (!query.trim()) {
      return res.json({ success: true, suggestions: [] });
    }
    
    // Get recent candidates for suggestions
    let candidates = [];
    if (usePostgres) {
      const { query: dbQuery } = require('./db-postgres');
      const result = await dbQuery('SELECT * FROM candidates ORDER BY created_at DESC LIMIT 100');
      candidates = result.rows || [];
    } else {
      const dbInstance = db();
      candidates = dbInstance.prepare('SELECT * FROM candidates ORDER BY created_at DESC LIMIT 100').all() || [];
    }
    
    const suggestions = searchService.generateSearchSuggestions(query, candidates);
    
    res.json({
      success: true,
      suggestions: suggestions.slice(0, limit)
    });
    
  } catch (error) {
    console.error('[search-suggestions] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get suggestions',
      message: error.message
    });
  }
});

// User preferences endpoints
app.get('/api/user/preferences', (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const preferences = userPreferencesService.getUserPreferences(userId);
    
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
    const { userId = 'default', preferences } = req.body;
    
    if (!preferences) {
      return res.status(400).json({
        success: false,
        error: 'Preferences required',
        message: 'Please provide preferences to update'
      });
    }
    
    const updatedPreferences = userPreferencesService.updateUserPreferences(userId, preferences);
    
    res.json({
      success: true,
      preferences: updatedPreferences,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    console.error('[user-preferences-update] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update preferences',
      message: error.message
    });
  }
});

app.get('/api/user/preferences/columns', (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const viewType = req.query.viewType || 'candidates';
    
    const columnConfig = userPreferencesService.getColumnConfig(userId, viewType);
    const availableColumns = userPreferencesService.getAvailableColumns();
    const columnStats = userPreferencesService.getColumnStats();
    
    res.json({
      success: true,
      columnConfig,
      availableColumns,
      columnStats
    });
  } catch (error) {
    console.error('[user-preferences-columns] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get column configuration',
      message: error.message
    });
  }
});

app.post('/api/user/preferences/reset', (req, res) => {
  try {
    const { userId = 'default' } = req.body;
    
    const resetPreferences = userPreferencesService.resetToDefaults(userId);
    
    res.json({
      success: true,
      preferences: resetPreferences,
      message: 'Preferences reset to defaults'
    });
  } catch (error) {
    console.error('[user-preferences-reset] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset preferences',
      message: error.message
    });
  }
});

// Export endpoints
app.post('/api/candidates/export', async (req, res) => {
  try {
    const { 
      format = 'csv', 
      columns = ['full_name', 'email', 'phone', 'current_title', 'current_employer'],
      limit = 1000,
      search = '',
      skills = [],
      tags = [],
      salaryMin = null,
      salaryMax = null
    } = req.body;
    
    console.log('[export-candidates] Export request:', { format, columns, limit, search });
    
    // Validate export options
    const validation = exportService.validateOptions({ format, columns, limit });
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid export options',
        details: validation.errors
      });
    }
    
    // Get candidates with same filters as search
    let candidates = [];
    if (usePostgres) {
      try {
        const { query: dbQuery } = require('./db-postgres');
        
        // Build WHERE clause similar to search
        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;
        
        if (search) {
          whereConditions.push(`(
            full_name ILIKE $${paramIndex} OR 
            email ILIKE $${paramIndex} OR 
            current_title ILIKE $${paramIndex} OR 
            current_employer ILIKE $${paramIndex} OR
            notes ILIKE $${paramIndex}
          )`);
          queryParams.push(`%${search}%`);
          paramIndex++;
        }
        
        if (skills.length > 0) {
          skills.forEach(skill => {
            whereConditions.push(`skills->>'${skill}' = 'true'`);
          });
        }
        
        if (tags.length > 0) {
          tags.forEach(tag => {
            whereConditions.push(`tags @> $${paramIndex}`);
            queryParams.push(`["${tag}"]`);
            paramIndex++;
          });
        }
        
        if (salaryMin !== null) {
          whereConditions.push(`(salary_min >= $${paramIndex} OR salary_max >= $${paramIndex})`);
          queryParams.push(salaryMin);
          paramIndex++;
        }
        
        if (salaryMax !== null) {
          whereConditions.push(`(salary_max <= $${paramIndex} OR salary_min <= $${paramIndex})`);
          queryParams.push(salaryMax);
          paramIndex++;
        }
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const query = `SELECT * FROM candidates ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex}`;
        queryParams.push(limit);
        
        const result = await dbQuery(query, queryParams);
        const rows = result.rows || [];
        
        const safeParse = (str, fallback) => {
          if (!str) return fallback;
          try { return JSON.parse(str); } catch { return fallback; }
        };
        
        candidates = rows.map(r => ({
          ...r,
          tags: safeParse(r.tags, []),
          skills: safeParse(r.skills, {})
        }));
      } catch (pgErr) {
        console.error('[export-candidates] PostgreSQL error:', pgErr);
        return res.status(500).json({ success: false, error: 'Database error', message: pgErr.message });
      }
    } else {
      const dbInstance = db();
      
      // Build SQLite query with filters
      let whereConditions = [];
      let queryParams = [];
      
      if (search) {
        whereConditions.push(`(
          full_name LIKE ? OR 
          email LIKE ? OR 
          current_title LIKE ? OR 
          current_employer LIKE ? OR
          notes LIKE ?
        )`);
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }
      
      if (salaryMin !== null) {
        whereConditions.push(`(salary_min >= ? OR salary_max >= ?)`);
        queryParams.push(salaryMin, salaryMin);
      }
      
      if (salaryMax !== null) {
        whereConditions.push(`(salary_max <= ? OR salary_min <= ?)`);
        queryParams.push(salaryMax, salaryMax);
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      const query = `SELECT * FROM candidates ${whereClause} ORDER BY created_at DESC LIMIT ?`;
      queryParams.push(limit);
      
      const candidatesData = dbInstance.prepare(query).all(...queryParams) || [];
      
      candidates = candidatesData
        .filter(candidate => candidate !== null && candidate !== undefined)
        .map(candidate => {
          try {
            return {
              ...candidate,
              tags: candidate.tags ? JSON.parse(candidate.tags) : [],
              skills: candidate.skills ? JSON.parse(candidate.skills) : {}
            };
          } catch (parseError) {
            return {
              ...candidate,
              tags: [],
              skills: {}
            };
          }
        });
    }
    
    console.log(`[export-candidates] Found ${candidates.length} candidates to export`);
    
    // Export based on format
    let exportResult;
    if (format === 'csv') {
      exportResult = await exportService.exportToCSV(candidates, { columns });
    } else if (format === 'pdf') {
      exportResult = await exportService.exportToPDF(candidates, { columns });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported format',
        message: `Format ${format} not supported. Use csv or pdf.`
      });
    }
    
    // Send file to client
    res.download(exportResult.filePath, exportResult.filename, (err) => {
      if (err) {
        console.error('[export-candidates] Download error:', err);
        res.status(500).json({
          success: false,
          error: 'Failed to download export file',
          message: err.message
        });
      } else {
        // Clean up file after download
        setTimeout(() => {
          try {
            fs.unlinkSync(exportResult.filePath);
            console.log('[export-candidates] Cleaned up export file:', exportResult.filename);
          } catch (cleanupError) {
            console.warn('[export-candidates] Could not clean up file:', cleanupError.message);
          }
        }, 5000); // Clean up after 5 seconds
      }
    });
    
  } catch (error) {
    console.error('[export-candidates] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Export failed',
      message: error.message
    });
  }
});

// Export statistics endpoint
app.get('/api/export/stats', (req, res) => {
  try {
    const stats = exportService.getExportStats();
    const supportedFormats = exportService.getSupportedFormats();
    
    res.json({
      success: true,
      stats,
      supportedFormats
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

// Job pipeline optimistic operations
app.post('/api/jobs/:jobId/move', (req, res) => {
  try {
    const { jobId } = req.params;
    const { fromStage, toStage, candidateId, optimistic = true } = req.body;
    
    if (!fromStage || !toStage) {
      return res.status(400).json({
        success: false,
        error: 'From and to stages required',
        message: 'Please provide fromStage and toStage'
      });
    }
    
    if (optimistic) {
      // Create optimistic operation
      const operationId = `job-move-${jobId}-${Date.now()}`;
      const operation = optimisticUIService.createJobPipelineOperation(
        operationId, 
        jobId, 
        fromStage, 
        toStage, 
        candidateId
      );
      
      res.json({
        success: true,
        operation,
        message: 'Job move operation created (optimistic)',
        optimistic: true
      });
    } else {
      // Direct operation (non-optimistic)
      // In a real implementation, this would actually move the job
      res.json({
        success: true,
        message: 'Job moved successfully',
        optimistic: false
      });
    }
  } catch (error) {
    console.error('[job-move] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to move job',
      message: error.message
    });
  }
});

// Candidate assignment optimistic operations
app.post('/api/candidates/:candidateId/assign', (req, res) => {
  try {
    const { candidateId } = req.params;
    const { jobId, optimistic = true } = req.body;
    
    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID required',
        message: 'Please provide jobId'
      });
    }
    
    if (optimistic) {
      // Create optimistic operation
      const operationId = `candidate-assign-${candidateId}-${Date.now()}`;
      const operation = optimisticUIService.createCandidateAssignmentOperation(
        operationId, 
        candidateId, 
        jobId, 
        'assign'
      );
      
      res.json({
        success: true,
        operation,
        message: 'Candidate assignment created (optimistic)',
        optimistic: true
      });
    } else {
      // Direct operation (non-optimistic)
      // In a real implementation, this would actually assign the candidate
      res.json({
        success: true,
        message: 'Candidate assigned successfully',
        optimistic: false
      });
    }
  } catch (error) {
    console.error('[candidate-assign] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign candidate',
      message: error.message
    });
  }
});

// Email webhook endpoints
app.post('/webhooks/email/bounce', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const webhookData = JSON.parse(req.body);
    const result = await emailService.handleBounceWebhook(webhookData);
    
    console.log('📧 Email bounce webhook processed:', result);
    res.json({ success: true, result });
  } catch (error) {
    console.error('❌ Email bounce webhook error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/webhooks/email/out-of-office', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const webhookData = JSON.parse(req.body);
    const result = await emailService.handleBounceWebhook(webhookData);
    
    console.log('📧 Email OOO webhook processed:', result);
    res.json({ success: true, result });
  } catch (error) {
    console.error('❌ Email OOO webhook error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Unsubscribe endpoint
app.get('/unsubscribe', async (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).send('Invalid unsubscribe link');
  }
  
  try {
    // Update candidate email_ok status in database
    if (usePostgres) {
      const { query } = require('./db-postgres');
      await query('UPDATE candidates SET email_ok = false WHERE unsubscribe_token = $1', [token]);
    } else {
      const dbInstance = db();
      dbInstance.prepare('UPDATE candidates SET email_ok = 0 WHERE unsubscribe_token = ?').run(token);
    }
    
    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Successfully Unsubscribed</h2>
          <p>You have been unsubscribed from AlvaP emails. You will no longer receive communications from us.</p>
          <p>If you change your mind, please contact us to re-subscribe.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ Unsubscribe error:', error);
    res.status(500).send('Error processing unsubscribe request');
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
    fileStorage: fileStorage.getStorageInfo(),
    emailService: emailService.getServiceInfo(),
    authService: authService.getAuthInfo(),
    rateLimits: rateLimitService.getRateLimitInfo(),
    monitoring: monitoringService.getUptimeStats(),
    searchService: {
      configured: true,
      features: ['fuzzy-search', 'relevance-scoring', 'suggestions']
    },
    userPreferences: {
      configured: true,
      features: ['customizable-columns', 'view-preferences', 'export-settings']
    },
    exportService: {
      configured: true,
      supportedFormats: exportService.getSupportedFormats(),
      stats: exportService.getExportStats()
    },
    optimisticUI: {
      configured: true,
      config: optimisticUIService.getConfig(),
      stats: optimisticUIService.getOperationStats()
    },
    platform: process.platform,
    uptime: process.uptime(),
    env: {
      ENABLE_DOTNET_PARSER: process.env.ENABLE_DOTNET_PARSER,
      DOTNET_CV_API_URL: process.env.DOTNET_CV_API_URL,
      NODE_ENV: process.env.NODE_ENV,
      FILE_STORAGE: process.env.FILE_STORAGE || 'local',
      EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'resend',
      JWT_SECRET: process.env.JWT_SECRET ? 'configured' : 'not-set'
    }
  });
});

// Detailed health check endpoint
app.get('/health/detailed', async (req, res) => {
  try {
    const healthCheck = await monitoringService.performHealthCheck();
    res.json(healthCheck);
  } catch (error) {
    res.status(500).json({
      overall: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Jobs Pipeline API endpoints
app.get('/api/jobs', async (req, res) => {
  try {
    const { search, status, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM jobs';
    const params = [];
    let paramCount = 0;
    
    const conditions = [];
    
    if (search) {
      paramCount++;
      conditions.push(`(title ILIKE $${paramCount} OR company ILIKE $${paramCount} OR description ILIKE $${paramCount})`);
      params.push(`%${search}%`);
    }
    
    if (status) {
      paramCount++;
      conditions.push(`status = $${paramCount}`);
      params.push(status);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM jobs';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      success: true,
      jobs: result.rows,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('[get-jobs] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/jobs', async (req, res) => {
  try {
    const { title, description, requiredSkills, salaryMin, salaryMax, location, company, isPublic, publicSlug, publicSummary, clientPublicName, employmentType } = req.body;
    
    const result = await db.query(`
      INSERT INTO jobs (title, description, required_skills, salary_min, salary_max, location, company, is_public, public_slug, public_summary, client_public_name, employment_type, status, created_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      title || '',
      description || '',
      JSON.stringify(requiredSkills || {}),
      Number(salaryMin) || 0,
      Number(salaryMax) || 0,
      location || '',
      company || '',
      Boolean(isPublic),
      publicSlug || null,
      publicSummary || '',
      clientPublicName || '',
      employmentType || 'Full-time',
      'New', // Default status for pipeline
      new Date().toISOString(),
      'system'
    ]);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Job created successfully'
    });
  } catch (error) {
    console.error('[create-job] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/jobs/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['New', 'Reviewed', 'Contacted', 'Interviewed', 'Offered', 'Placed', 'Rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    
    const result = await db.query(
      'UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Job status updated successfully'
    });
  } catch (error) {
    console.error('[update-job-status] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/jobs/:jobId/matches', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const result = await db.query(`
      SELECT 
        jm.id as match_id,
        jm.stage,
        jm.match_score,
        jm.created_at as matched_at,
        c.id,
        c.name,
        c.email,
        c.current_title,
        c.current_employer,
        c.skills,
        c.salary_min,
        c.salary_max,
        c.location,
        c.created_at
      FROM job_matches jm
      JOIN candidates c ON jm.candidate_id = c.id
      WHERE jm.job_id = $1
      ORDER BY jm.created_at DESC
    `, [jobId]);
    
    res.json({
      success: true,
      data: {
        candidates: result.rows
      }
    });
  } catch (error) {
    console.error('[get-job-matches] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/jobs/:jobId/matches', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { candidateId, stage = 'New' } = req.body;
    
    // Check if match already exists
    const existingMatch = await db.query(
      'SELECT id FROM job_matches WHERE job_id = $1 AND candidate_id = $2',
      [jobId, candidateId]
    );
    
    if (existingMatch.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Candidate already matched to this job' });
    }
    
    const result = await db.query(`
      INSERT INTO job_matches (job_id, candidate_id, stage, match_score, created_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [jobId, candidateId, stage, 0, new Date().toISOString()]);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Candidate added to job pipeline'
    });
  } catch (error) {
    console.error('[add-job-match] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/matches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;
    
    const validStages = ['New', 'Reviewed', 'Contacted', 'Interviewed', 'Offered', 'Placed', 'Rejected'];
    if (!validStages.includes(stage)) {
      return res.status(400).json({ success: false, error: 'Invalid stage' });
    }
    
    const result = await db.query(
      'UPDATE job_matches SET stage = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [stage, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Match stage updated successfully'
    });
  } catch (error) {
    console.error('[update-match-stage] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/candidates/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.json({ success: true, data: { candidates: [] } });
    }
    
    const result = await db.query(`
      SELECT id, name, email, current_title, current_employer, skills, salary_min, salary_max, location
      FROM candidates 
      WHERE name ILIKE $1 OR email ILIKE $1 OR current_title ILIKE $1
      ORDER BY name
      LIMIT 20
    `, [`%${q}%`]);
    
    res.json({
      success: true,
      data: {
        candidates: result.rows
      }
    });
  } catch (error) {
    console.error('[search-candidates] Error:', error);
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

// Global error handler to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  // Don't exit, just log and continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, just log and continue
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('=== HYBRID PRODUCTION SERVER STARTED ===');
  console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ Database: ${usePostgres ? 'PostgreSQL' : 'SQLite'}`);
  console.log(`✅ .NET Parser: ${dotNetParser ? 'enabled' : 'disabled'}`);
  console.log(`✅ File storage: ${uploadsDir}`);
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
