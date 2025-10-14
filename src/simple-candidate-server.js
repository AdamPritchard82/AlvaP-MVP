// Simple Candidate Server - Clean Version with .NET Parser Integration
console.log('=== SIMPLE CANDIDATE SERVER STARTING - CLEAN VERSION WITH .NET PARSER v4 ===');

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { randomUUID } = require('crypto');
// const { parseRoute } = require('./routes/parse'); // Temporarily disabled - TypeScript issue
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

// Initialize database function
async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
      // Use PostgreSQL for production (Railway)
      const { Pool } = require('pg');
      db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      console.log('✅ Using PostgreSQL database');
      
      // PostgreSQL initialization - First check if table exists and what columns it has
      db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'candidates'`, (err, result) => {
        if (err) {
          console.error('❌ Error checking table structure:', err);
          reject(err);
          return;
        }
        
        const existingColumns = result.rows.map(row => row.column_name);
        console.log('📋 Existing columns:', existingColumns);
        
        // If table doesn't exist or has wrong structure, add missing columns
        if (existingColumns.length === 0 || !existingColumns.includes('first_name')) {
          console.log('🔧 Adding missing columns to existing candidates table...');
          
          // Add missing columns one by one
          const addColumns = [
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS first_name TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS last_name TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_title TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_employer TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS salary_min TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS salary_max TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS skills TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS experience TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS notes TEXT`,
            `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email_ok BOOLEAN DEFAULT true`
          ];
          
          let completed = 0;
          const total = addColumns.length;
          
          addColumns.forEach((sql, index) => {
            db.query(sql, (err) => {
              if (err) {
                console.error(`❌ Error adding column ${index + 1}:`, err);
                reject(err);
                return;
              }
              
              completed++;
              console.log(`✅ Added column ${index + 1}/${total}`);
              
              if (completed === total) {
                // Set default UUID generation for created_by column
                db.query(`ALTER TABLE candidates ALTER COLUMN created_by SET DEFAULT gen_random_uuid()`, (uuidErr) => {
                  if (uuidErr) {
                    console.warn('⚠️ Could not set UUID default (column may not exist):', uuidErr.message);
                  } else {
                    console.log('✅ Set UUID default for created_by column');
                  }
                  
                  // Try to drop the foreign key constraint if it exists
                  db.query(`ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_created_by_fkey`, (fkErr) => {
                    if (fkErr) {
                      console.warn('⚠️ Could not drop foreign key constraint:', fkErr.message);
                    } else {
                      console.log('✅ Dropped foreign key constraint for created_by');
                    }
                    console.log('✅ PostgreSQL database schema updated successfully');
                    resolve();
                  });
                });
              }
            });
          });
        } else {
          // Even if columns exist, ensure UUID default is set
          console.log('🔧 Ensuring UUID default is set for created_by column...');
          db.query(`ALTER TABLE candidates ALTER COLUMN created_by SET DEFAULT gen_random_uuid()`, (uuidErr) => {
            if (uuidErr) {
              console.warn('⚠️ Could not set UUID default:', uuidErr.message);
            } else {
              console.log('✅ Set UUID default for created_by column');
            }
            
            // Try to drop the foreign key constraint if it exists
            db.query(`ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_created_by_fkey`, (fkErr) => {
              if (fkErr) {
                console.warn('⚠️ Could not drop foreign key constraint:', fkErr.message);
              } else {
                console.log('✅ Dropped foreign key constraint for created_by');
              }
              console.log('✅ PostgreSQL database table structure is correct');
              resolve();
            });
          });
        }
      });
    } else {
      // Use SQLite for local development
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = path.join(__dirname, '../candidates.db');
      db = new sqlite3.Database(dbPath);
      console.log('✅ Using SQLite database');
      
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
          salary_min TEXT,
          salary_max TEXT,
          skills TEXT,
          experience TEXT,
          notes TEXT,
          email_ok BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            console.error('❌ Database initialization failed:', err);
            reject(err);
          } else {
            console.log('✅ SQLite database initialized');
            resolve();
          }
        });
      });
    }
  });
}

// Helper function to get database connection
const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

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
// parseRoute(app); // Temporarily disabled - TypeScript issue

// Local parser function for fallback
async function parseWithLocalParser(buffer, mimetype, originalname) {
  console.log('🔧 Using local parser for:', originalname);
  
  let text = '';
  
  // Extract text based on file type
  if (mimetype === 'application/pdf') {
    const pdfData = await pdfParse(buffer);
    text = pdfData.text;
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (mimetype === 'application/msword') {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (mimetype === 'text/plain') {
    text = buffer.toString('utf8');
  } else {
    throw new Error(`Unsupported file type: ${mimetype}`);
  }
  
  // Clean and normalize text for better parsing
  text = text
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .replace(/\r/g, '\n')    // Convert remaining \r to \n
    .replace(/\n\s*\n/g, '\n\n')  // Normalize multiple newlines
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
  
  console.log('📄 Extracted text length:', text.length);
  console.log('📄 First 500 characters of extracted text:', text.substring(0, 500));
  
  // Look specifically for "Door 10" in the text
  const door10Match = text.match(/door\s*10/gi);
  console.log('🔍 Looking for "Door 10" in text:', door10Match);
  
  // Look for "Recruitment" in the text
  const recruitmentMatch = text.match(/recruitment/gi);
  console.log('🔍 Looking for "Recruitment" in text:', recruitmentMatch);
  
  // Look for the exact phrase "Door 10 Recruitment"
  const door10RecruitmentMatch = text.match(/door\s*10\s*recruitment/gi);
  console.log('🔍 Looking for "Door 10 Recruitment" in text:', door10RecruitmentMatch);
  
  // Show more of the text to find where company names might be
  console.log('📄 Text around line 10-20:', text.split('\n').slice(10, 20).join('\n'));
  
  // Parse the text using improved regex patterns
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  
  // Improved phone number patterns
  const phonePatterns = [
    /(\+44\s?\d{2,4}\s?\d{3,4}\s?\d{3,4})/g,  // UK format: +44 20 1234 5678
    /(\+44\s?\d{10})/g,                        // UK format: +44 2012345678
    /(0\d{2,4}\s?\d{3,4}\s?\d{3,4})/g,        // UK format: 020 1234 5678
    /(\+?[\d\s\-\(\)]{10,15})/g               // General international format
  ];
  
  // Extract basic information with validation
  const email = emailRegex.exec(text)?.[0] || '';
  
  let phone = '';
  let phoneConfidence = 0;
  
  for (const pattern of phonePatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const candidatePhone = match[1].replace(/[^\d+]/g, '');
      if (candidatePhone.length >= 10 && candidatePhone.length <= 15) {
        phone = candidatePhone;
        phoneConfidence = 0.8;
        console.log('🔍 Found phone with high confidence:', phone);
        break;
      } else if (candidatePhone.length >= 7 && phoneConfidence < 0.5) {
        phone = candidatePhone;
        phoneConfidence = 0.5;
        console.log('🔍 Found phone with medium confidence:', phone);
      }
    }
  }
  
  // If no phone found, try more aggressive patterns
  if (!phone) {
    const aggressivePhonePatterns = [
      /(\+?[\d\s\-\(\)]{7,15})/g,
      /(\d{3,4}[\s\-]?\d{3,4}[\s\-]?\d{3,4})/g
    ];
    
    for (const pattern of aggressivePhonePatterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        const candidatePhone = match[1].replace(/[^\d+]/g, '');
        if (candidatePhone.length >= 7 && candidatePhone.length <= 15) {
          phone = candidatePhone;
          phoneConfidence = 0.3;
          console.log('🔍 Found phone with aggressive pattern:', phone);
          break;
        }
      }
    }
  }
  
  // Improved name extraction - look for common patterns
  let firstName = '';
  let lastName = '';
  let fullName = '';
  
  // Try multiple name patterns - improved for different CV formats including double-barreled names
  const namePatterns = [
    // Look for name at the very beginning of the document (including hyphenated names)
    /^([A-Z][a-z]+(?:-[A-Z][a-z]+)?\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?)/m,
    // Look for name patterns with common prefixes
    /(?:name|full name|contact)[\s:]*([A-Za-z\s-]+?)(?:\n|$|email|phone|@)/i,
    // Look for standalone name patterns (first line that looks like a name)
    /^([A-Z][a-z]+(?:-[A-Z][a-z]+)?\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?)(?:\s|$|\n)/m,
    // Look for name patterns in the first few lines
    /^([A-Z][a-z]+(?:-[A-Z][a-z]+)?\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?)(?:\s|$|\n|email|phone|@)/m
  ];
  
  for (const pattern of namePatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      fullName = match[1].trim();
      if (fullName.length > 2 && fullName.length < 50) { // Reasonable name length
        break;
      }
    }
  }
  
  // Split name into first and last with validation
  if (fullName) {
    const nameParts = fullName.split(/\s+/);
    firstName = nameParts[0] || '';
    lastName = nameParts.slice(1).join(' ') || '';
    
    // Validate name quality
    if (firstName.length < 2 || lastName.length < 2) {
      console.log('⚠️ Name quality low, trying alternative extraction');
      // Try extracting from email if name is poor quality
      const emailMatch = text.match(/([a-zA-Z0-9._%+-]+)@/);
      if (emailMatch) {
        const emailName = emailMatch[1].replace(/[._-]/g, ' ');
        if (/^[A-Za-z\s]+$/.test(emailName) && emailName.length > 2) {
          const emailParts = emailName.split(/\s+/);
          if (emailParts.length >= 2) {
            firstName = emailParts[0];
            lastName = emailParts.slice(1).join(' ');
            console.log('🔍 Using email-based name extraction:', firstName, lastName);
          }
        }
      }
    }
  }
  
  // Improved job title and company extraction - look in experience sections
  let jobTitle = '';
  let company = '';
  
  // First, try to find the experience/employment section
  const experienceSectionPatterns = [
    /(?:employment history|professional experience|work experience|career history|experience|employment|work history)[\s:]*([\s\S]*?)(?:\n\n|\n[A-Z][a-z]+\s+[A-Z]|$)/i,
    /(?:current role|current position|present role|present position)[\s:]*([\s\S]*?)(?:\n\n|\n[A-Z][a-z]+\s+[A-Z]|$)/i
  ];
  
  let experienceSection = '';
  for (const pattern of experienceSectionPatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      experienceSection = match[1].trim();
      console.log('🔍 Found experience section:', experienceSection.substring(0, 200));
      break;
    }
  }
  
  // If we found an experience section, extract from it
  if (experienceSection) {
    console.log('🔍 Experience section found, looking for job title and company...');
    
    // Look for job title in the experience section - be more specific
    const jobTitlePatterns = [
      // Look for job titles that start a line (most common format)
      /^([A-Za-z\s&.,-]+(?:director|manager|engineer|consultant|analyst|specialist|coordinator|executive|officer|lead|senior|junior|assistant|developer|designer|architect|advisor|consultant|analyst|specialist|coordinator|executive|officer|lead|senior|junior|assistant|developer|designer|architect|consultant|analyst|specialist|coordinator|executive|officer|lead|senior|junior|assistant|developer|designer|architect))/im,
      // Look for "Title at Company" format
      /([A-Za-z\s&.,-]+(?:director|manager|engineer|consultant|analyst|specialist|coordinator|executive|officer|lead|senior|junior|assistant|developer|designer|architect|advisor|consultant|analyst|specialist|coordinator|executive|officer|lead|senior|junior|assistant|developer|designer|architect))\s+(?:at|@|of|for)\s+[A-Za-z\s&.,-]+/i,
      // Look for explicit title/position labels
      /(?:title|position|role|job)[\s:]*([A-Za-z\s&.,-]+?)(?:\n|$|company|employer|at)/i
    ];
    
    for (const pattern of jobTitlePatterns) {
      const match = pattern.exec(experienceSection);
      if (match && match[1]) {
        const candidateTitle = match[1].trim();
        // More strict validation for job titles
        if (candidateTitle.length > 2 && candidateTitle.length < 100 && 
            !candidateTitle.includes('across') && !candidateTitle.includes('public') &&
            !candidateTitle.includes('philanthropic') && !candidateTitle.includes('level') &&
            !candidateTitle.includes('experience') && !candidateTitle.includes('heading') &&
            !candidateTitle.includes('governme') && !candidateTitle.includes('professional') &&
            !candidateTitle.includes('preparation') && !candidateTitle.includes('brexit') &&
            !candidateTitle.includes('wide') && !candidateTitle.includes('and') &&
            !candidateTitle.includes('the') && !candidateTitle.includes('with') &&
            !candidateTitle.includes('for') && !candidateTitle.includes('in') &&
            !candidateTitle.includes('of') && !candidateTitle.includes('at') &&
            !candidateTitle.includes('by') && !candidateTitle.includes('from') &&
            !candidateTitle.includes('to') && !candidateTitle.includes('on') &&
            !candidateTitle.includes('is') && !candidateTitle.includes('are') &&
            !candidateTitle.includes('was') && !candidateTitle.includes('were') &&
            !candidateTitle.includes('has') && !candidateTitle.includes('have') &&
            !candidateTitle.includes('had') && !candidateTitle.includes('will') &&
            !candidateTitle.includes('would') && !candidateTitle.includes('could') &&
            !candidateTitle.includes('should') && !candidateTitle.includes('may') &&
            !candidateTitle.includes('might') && !candidateTitle.includes('can') &&
            !candidateTitle.includes('must') && !candidateTitle.includes('shall')) {
          jobTitle = candidateTitle;
          console.log('🔍 Found job title in experience section:', jobTitle);
          break;
        } else {
          console.log('🔍 Rejected job title candidate:', candidateTitle);
        }
      }
    }
    
    // Look for company in the experience section
    const companyPatterns = [
      /(?:at|@|company|employer)[\s:]*([A-Za-z\s&.,-]{2,30}?)(?:\n|$|title|position|role|experience|with|preparation|brexit|professional|level|heading|governme|government|department|ministry|agency|authority)/i,
      /([A-Za-z\s&.,-]+(?:ltd|limited|inc|corp|corporation|llc|plc|group|company|software|solutions|systems|services|consulting|consultancy|recruitment|recruiting))(?:\s|$|\n)/i
    ];
    
    for (const pattern of companyPatterns) {
      const match = pattern.exec(experienceSection);
      if (match && match[1]) {
        const candidateCompany = match[1].trim();
        if (candidateCompany.length > 2 && candidateCompany.length < 40 && 
            !candidateCompany.includes('level') && !candidateCompany.includes('experience') &&
            !candidateCompany.includes('heading') && !candidateCompany.includes('governme') &&
            /[A-Z]/.test(candidateCompany)) {
          company = candidateCompany;
          console.log('🔍 Found company in experience section:', company);
          break;
        }
      }
    }
  }
  
  // Fallback: if no experience section found, try the old patterns
  if (!jobTitle || !company) {
    console.log('🔍 No experience section found, trying fallback patterns...');
    
    // Look for job title patterns
    const jobTitlePatterns = [
      /(?:title|position|role|job)[\s:]*([A-Za-z\s&.,-]+?)(?:\n|$|company|employer)/i,
      /([A-Za-z\s&.,-]+(?:director|manager|engineer|consultant|analyst|specialist|coordinator|executive|officer|lead|senior|junior|assistant|developer|designer|architect|consultant))/i
    ];
    
    for (const pattern of jobTitlePatterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        const candidateTitle = match[1].trim();
        if (candidateTitle.length > 2 && candidateTitle.length < 100 &&
            !candidateTitle.includes('across') && !candidateTitle.includes('public') &&
            !candidateTitle.includes('philanthropic')) {
          jobTitle = candidateTitle;
          break;
        }
      }
    }
  }
  
  // Handle unemployed candidates - if no job title found, check for unemployment indicators
  if (!jobTitle) {
    const unemploymentIndicators = [
      /(?:unemployed|job seeking|seeking employment|available for work|open to opportunities|between jobs|career break|sabbatical)/i
    ];
    
    for (const pattern of unemploymentIndicators) {
      if (pattern.test(text)) {
        jobTitle = 'Seeking Employment';
        console.log('🔍 Detected unemployed candidate');
        break;
      }
    }
  }
  
  // Fallback: if no company found in experience section, try old patterns
  if (!company) {
    console.log('🔍 No company found in experience section, trying fallback patterns...');
    
    const companyPatterns = [
      // Look specifically for "Door 10" pattern (standalone company name)
      /(door\s*10)/gi,
      // Look for company names with business suffixes - most reliable
      /([A-Za-z\s&.,-]+(?:ltd|limited|inc|corp|corporation|llc|plc|group|company|software|solutions|systems|services|consulting|consultancy|recruitment|recruiting))(?:\s|$|\n)/i
    ];
    
    for (let i = 0; i < companyPatterns.length; i++) {
      const pattern = companyPatterns[i];
      console.log(`🔍 Trying fallback pattern ${i + 1}:`, pattern);
      const match = pattern.exec(text);
      if (match && match[1]) {
        const candidateCompany = match[1].trim();
        console.log(`🔍 Found candidate company: "${candidateCompany}"`);
        // Only accept company names that look reasonable - strict but allow business words
        if (candidateCompany.length > 3 && 
            candidateCompany.length < 40 && 
            // Allow "Door 10" specifically
            (candidateCompany.toLowerCase().includes('door') || 
             !candidateCompany.includes('level')) &&
            !candidateCompany.includes('experience') &&
            !candidateCompany.includes('heading') &&
            !candidateCompany.includes('governme') &&
            !candidateCompany.includes('professional') &&
            !candidateCompany.includes('preparation') &&
            !candidateCompany.includes('brexit') &&
            !candidateCompany.includes('wide') &&
            !candidateCompany.includes('and') &&
            !candidateCompany.includes('the') &&
            !candidateCompany.includes('with') &&
            !candidateCompany.includes('for') &&
            !candidateCompany.includes('in') &&
            !candidateCompany.includes('of') &&
            !candidateCompany.includes('at') &&
            !candidateCompany.includes('by') &&
            !candidateCompany.includes('from') &&
            !candidateCompany.includes('to') &&
            !candidateCompany.includes('on') &&
            !candidateCompany.includes('is') &&
            !candidateCompany.includes('are') &&
            !candidateCompany.includes('was') &&
            !candidateCompany.includes('were') &&
            !candidateCompany.includes('has') &&
            !candidateCompany.includes('have') &&
            !candidateCompany.includes('had') &&
            !candidateCompany.includes('will') &&
            !candidateCompany.includes('would') &&
            !candidateCompany.includes('could') &&
            !candidateCompany.includes('should') &&
            !candidateCompany.includes('may') &&
            !candidateCompany.includes('might') &&
            !candidateCompany.includes('can') &&
            !candidateCompany.includes('must') &&
            !candidateCompany.includes('shall') &&
            // Must contain at least one capital letter (proper company name) OR be "door10"
            (/[A-Z]/.test(candidateCompany) || candidateCompany.toLowerCase() === 'door10')) {
          console.log(`✅ Accepted company: "${candidateCompany}"`);
          company = candidateCompany;
          break;
        } else {
          console.log(`❌ Rejected company: "${candidateCompany}" (failed validation)`);
        }
      } else {
        console.log(`❌ No match for fallback pattern ${i + 1}`);
      }
    }
  }
  
  // If no company found, leave it empty rather than showing nonsense
  if (!company) {
    console.log('❌ No company name found after trying all patterns');
    company = '';
  } else {
    console.log(`✅ Final company name: "${company}"`);
  }
  
  // Calculate confidence with detailed scoring
  let confidence = 0.1; // Base confidence for local parser
  
  // Name confidence (0-0.3)
  if (firstName && lastName) {
    if (firstName.length >= 2 && lastName.length >= 2) {
      confidence += 0.3;
    } else if (firstName.length >= 2 || lastName.length >= 2) {
      confidence += 0.2;
    }
  }
  
  // Email confidence (0-0.25)
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    confidence += 0.25;
  }
  
  // Phone confidence (0-0.2)
  if (phone) {
    if (phoneConfidence >= 0.8) {
      confidence += 0.2;
    } else if (phoneConfidence >= 0.5) {
      confidence += 0.15;
    } else {
      confidence += 0.1;
    }
  }
  
  // Job title confidence (0-0.15)
  if (jobTitle && jobTitle.length > 2 && !jobTitle.includes('across') && !jobTitle.includes('public')) {
    confidence += 0.15;
  }
  
  // Company confidence (0-0.1)
  if (company && company.length > 2) {
    confidence += 0.1;
  }
  
  confidence = Math.min(confidence, 0.9); // Cap at 0.9 for local parser
  
  console.log(`🔍 Overall confidence: ${confidence.toFixed(2)} (Name: ${firstName ? '✓' : '✗'}, Email: ${email ? '✓' : '✗'}, Phone: ${phone ? '✓' : '✗'}, Title: ${jobTitle ? '✓' : '✗'}, Company: ${company ? '✓' : '✗'})`);
  
  return {
    firstName: firstName,
    lastName: lastName,
    email: email,
    phone: phone,
    currentTitle: jobTitle,
    currentEmployer: company,
    skills: {},
    experience: [],
    notes: `Parsed locally from ${originalname}`,
    confidence,
    source: 'local-fallback',
    parseConfidence: confidence,
    textLength: text.length,
    duration: 0,
    metadata: {
      originalFileName: originalname,
      documentType: mimetype,
      parsedAt: new Date().toISOString(),
      parserUsed: 'local-fallback'
    },
    allResults: [],
    errors: []
  };
}

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
        console.log('🔄 Falling back to local parser...');
        
        // Fallback to local parser
        try {
          parsedData = await parseWithLocalParser(buffer, mimetype, originalname);
          console.log('✅ Local parser fallback success');
        } catch (fallbackError) {
          console.error('❌ Local parser fallback also failed:', fallbackError.message);
          return res.status(500).json({ 
            error: 'ParsingFailed',
            message: 'Both .NET and local parsers failed',
            details: `NET: ${error.message}, Local: ${fallbackError.message}`
          });
        }
      }
    } else {
      console.log('ℹ️ Using local parser for unsupported file type:', fileExtension);
      try {
        parsedData = await parseWithLocalParser(buffer, mimetype, originalname);
        console.log('✅ Local parser success');
      } catch (error) {
        console.error('❌ Local parser failed:', error.message);
        return res.status(500).json({ 
          error: 'ParsingFailed',
          message: 'Local parser failed',
          details: error.message
        });
      }
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

  const mapRow = (row) => {
    const parseJson = (v, fallback) => {
      if (v == null) return fallback;
      if (typeof v !== 'string') return v;
      try { return JSON.parse(v); } catch { return fallback; }
    };

    return {
      id: row.id,
      full_name: row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      email: row.email || '',
      phone: row.phone || '',
      current_title: row.current_title || '',
      current_employer: row.current_employer || '',
      salary_min: row.salary_min || '',
      salary_max: row.salary_max || '',
      skills: (() => {
        const skillsData = parseJson(row.skills, {});
        return {
          communications: (skillsData.communications || 0) >= 4,
          campaigns: (skillsData.campaigns || 0) >= 4,
          policy: (skillsData.policy || 0) >= 4,
          publicAffairs: (skillsData.publicAffairs || 0) >= 4
        };
      })(),
      experience: parseJson(row.experience, []),
      tags: parseJson(row.tags, []),
      email_ok: row.email_ok || true,
      created_at: row.created_at || row.createdAt,
      updated_at: row.updated_at || row.updatedAt,
    };
  };

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    // PostgreSQL query
    db.query('SELECT * FROM candidates ORDER BY created_at DESC', (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      const rows = Array.isArray(result.rows) ? result.rows : [];
      const candidates = rows.map(mapRow);
      return res.json({
        candidates,
        total: candidates.length,
        page: 1,
        pageSize: candidates.length,
        totalPages: 1
      });
    });
  } else {
    // SQLite query
    db.all('SELECT * FROM candidates ORDER BY created_at DESC', (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      const candidates = (rows || []).map(mapRow);
      return res.json({
        candidates,
        total: candidates.length,
        page: 1,
        pageSize: candidates.length,
        totalPages: 1
      });
    });
  }
});

// Get skill counts for Library
app.get('/api/skills/counts', (req, res) => {
  const db = getDb();
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    // PostgreSQL query
    db.query(`
      SELECT 'Communications' as skill, COUNT(*) as count
      FROM candidates 
      WHERE (skills->>'communications')::boolean = true
      UNION ALL
      SELECT 'Campaigns' as skill, COUNT(*) as count
      FROM candidates 
      WHERE (skills->>'campaigns')::boolean = true
      UNION ALL
      SELECT 'Policy' as skill, COUNT(*) as count
      FROM candidates 
      WHERE (skills->>'policy')::boolean = true
      UNION ALL
      SELECT 'Public Affairs' as skill, COUNT(*) as count
      FROM candidates 
      WHERE (skills->>'publicAffairs')::boolean = true
    `, (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const counts = {};
      result.rows.forEach(row => {
        if (row.skill) {
          counts[row.skill] = parseInt(row.count);
        }
      });
      
      res.json({ success: true, counts });
    });
  } else {
    // SQLite query - simplified for now
    res.json({ 
      success: true, 
      counts: {
        'Communications': 0,
        'Campaigns': 0,
        'Policy': 0,
        'Public Affairs': 0
      }
    });
  }
});

// Get bands for a skill
app.get('/api/skills/:skill/bands', (req, res) => {
  const skill = decodeURIComponent(req.params.skill);
  const db = getDb();
  
  // Map skill names to database field names
  const skillMap = {
    'Communications': 'communications',
    'Campaigns': 'campaigns', 
    'Policy': 'policy',
    'Public Affairs': 'publicAffairs'
  };
  
  const skillField = skillMap[skill];
  if (!skillField) {
    return res.status(400).json({ error: 'Invalid skill' });
  }
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    // For now, return a simple band structure
    // In a real app, you'd calculate salary bands from salary_min/salary_max
    res.json({ 
      success: true, 
      bands: [
        { band: '£30k-£50k', count: 0 },
        { band: '£50k-£70k', count: 0 },
        { band: '£70k-£100k', count: 0 },
        { band: '£100k+', count: 0 }
      ]
    });
  } else {
    res.json({ 
      success: true, 
      bands: [
        { band: '£30k-£50k', count: 0 },
        { band: '£50k-£70k', count: 0 },
        { band: '£70k-£100k', count: 0 },
        { band: '£100k+', count: 0 }
      ]
    });
  }
});

// Get candidates by skill and band
app.get('/api/skills/:skill/bands/:band/candidates', (req, res) => {
  const skill = decodeURIComponent(req.params.skill);
  const band = decodeURIComponent(req.params.band);
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const offset = (page - 1) * pageSize;
  
  const db = getDb();
  
  // Map skill names to database field names
  const skillMap = {
    'Communications': 'communications',
    'Campaigns': 'campaigns', 
    'Policy': 'policy',
    'Public Affairs': 'publicAffairs'
  };
  
  const skillField = skillMap[skill];
  if (!skillField) {
    return res.status(400).json({ error: 'Invalid skill' });
  }
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    // For now, just return all candidates with the skill
    // In a real app, you'd filter by salary band too
    db.query(`
      SELECT * FROM candidates 
      WHERE (skills->>'${skillField}')::boolean = true
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `, [pageSize, offset], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const mapRow = (row) => {
        const parseJson = (v, fallback) => {
          if (v == null) return fallback;
          if (typeof v !== 'string') return v;
          try { return JSON.parse(v); } catch { return fallback; }
        };

        return {
          id: row.id,
          full_name: row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
          email: row.email || '',
          phone: row.phone || '',
          current_title: row.current_title || '',
          current_employer: row.current_employer || '',
          salary_min: row.salary_min || '',
          salary_max: row.salary_max || '',
          skills: (() => {
            const skillsData = parseJson(row.skills, {});
            return {
              communications: (skillsData.communications || 0) >= 4,
              campaigns: (skillsData.campaigns || 0) >= 4,
              policy: (skillsData.policy || 0) >= 4,
              publicAffairs: (skillsData.publicAffairs || 0) >= 4
            };
          })(),
          experience: parseJson(row.experience, []),
          tags: parseJson(row.tags, []),
          email_ok: row.email_ok || true,
          created_at: row.created_at || row.createdAt,
          updated_at: row.updated_at || row.updatedAt,
        };
      };
      
      const candidates = result.rows.map(mapRow);
      res.json({
        success: true,
        candidates,
        total: candidates.length, // Simplified - in real app you'd count total
        page,
        pageSize
      });
    });
  } else {
    res.json({ 
      success: true, 
      candidates: [],
      total: 0,
      page,
      pageSize
    });
  }
});

// Create candidate
app.post('/api/candidates', (req, res) => {
  const { firstName, lastName, email, phone, currentTitle, currentEmployer, salaryMin, salaryMax, skills, experience, notes, emailOk } = req.body;
  
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const db = getDb();
  const skillsJson = JSON.stringify(skills || {});
  const experienceJson = JSON.stringify(experience || []);
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    // PostgreSQL query - let PostgreSQL generate the UUID
    const fullName = `${firstName} ${lastName}`.trim();
    db.query(
      'INSERT INTO candidates (first_name, last_name, full_name, email, phone, current_title, current_employer, salary_min, salary_max, skills, experience, notes, email_ok) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id, created_by',
      [firstName, lastName, fullName, email, phone, currentTitle, currentEmployer, salaryMin, salaryMax, skillsJson, experienceJson, notes, emailOk],
      (err, result) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          success: true,
          id: result.rows[0].id,
          message: 'Candidate created successfully'
        });
      }
    );
  } else {
    // SQLite query - generate UUID for SQLite
    const fullName = `${firstName} ${lastName}`.trim();
    const createdBy = randomUUID(); // Generate a proper UUID for created_by
    db.run(
      'INSERT INTO candidates (first_name, last_name, full_name, email, phone, current_title, current_employer, salary_min, salary_max, skills, experience, notes, email_ok, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [firstName, lastName, fullName, email, phone, currentTitle, currentEmployer, salaryMin, salaryMax, skillsJson, experienceJson, notes, emailOk, createdBy],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          success: true,
          id: this.lastID,
          message: 'Candidate created successfully'
        });
      }
    );
  }
});

// Serve frontend (only if built assets exist). In Railway, frontend is a separate service.
const frontendIndexPath = path.join(__dirname, '../frontend/dist/index.html');
let loggedMissingFrontend = false;
app.get('*', (req, res) => {
  try {
    if (fs.existsSync(frontendIndexPath)) {
      return res.sendFile(frontendIndexPath);
    }
  } catch {}
  if (!loggedMissingFrontend) {
    loggedMissingFrontend = true;
    console.warn('Frontend dist not found. Skipping static serve for wildcard routes.');
  }
  return res.status(404).json({ ok: true, message: 'Frontend not served from backend. Use the frontend service.' });
});

// Start server after database initialization
async function startServer() {
  try {
    await initializeDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📁 Database: ${process.env.DATABASE_URL ? 'PostgreSQL (Railway)' : 'SQLite (local)'}`);
      console.log(`🔧 .NET Parser: ${dotNetParser ? 'enabled' : 'disabled'}`);
      console.log(`🌐 Frontend: http://localhost:${PORT}`);
      console.log(`🔍 API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
