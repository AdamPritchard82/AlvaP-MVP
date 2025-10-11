// Simple Working Server - Enhanced with .NET Parser
console.log('=== SIMPLE WORKING SERVER STARTING - ENHANCED ===');

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

// Import .NET parser
const { DotNetCvParser } = require('./src/parsers/dotnetCvParser');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize .NET parser
let dotNetParser = null;
const enableDotNetParser = process.env.ENABLE_DOTNET_PARSER === 'true' || process.env.ENABLE_DOTNET_PARSER === '1';
const dotNetApiUrl = process.env.DOTNET_CV_API_URL || 'https://balanced-beauty-production.up.railway.app';

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

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Enhanced working server running',
    dotnetParser: dotNetParser ? 'enabled' : 'disabled'
  });
});

// Version endpoint
app.get('/version', (req, res) => {
  res.json({
    gitSha: process.env.GIT_SHA || 'unknown',
    buildTime: process.env.BUILD_TIME || new Date().toISOString(),
    parserMode: 'real',
    backend: 'simple-working-server.js',
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
});

// Enhanced CV parsing function (local fallback)
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
  
  // Extract job title and employer
  let currentTitle = '';
  let currentEmployer = '';
  
  // Look for job title patterns
  const titlePatterns = [
    /(?:current|present|current role|position|title)[\s:]*([^\n]+)/i,
    /(?:job title|role|position)[\s:]*([^\n]+)/i,
    /^([^@\n]+(?:manager|director|coordinator|specialist|analyst|consultant|officer|executive|lead|head|chief)[^@\n]*)$/im
  ];
  
  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      currentTitle = match[1].trim();
      break;
    }
  }
  
  // Look for employer patterns
  const employerPatterns = [
    /(?:current|present|current employer|company|organization)[\s:]*([^\n]+)/i,
    /(?:at|@)\s*([A-Z][^@\n]+)/g,
    /(?:working at|employed at|company)[\s:]*([^\n]+)/i
  ];
  
  for (const pattern of employerPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      currentEmployer = match[1].trim();
      break;
    }
  }
  
  // If no specific patterns found, look in the first few lines for company names
  if (!currentEmployer) {
    const companyPattern = /(?:at|@)\s*([A-Z][a-zA-Z\s&]+(?:Ltd|Inc|Corp|LLC|Company|Group|Associates|Partners|Consulting|Solutions|Services|Limited))/i;
    const match = text.match(companyPattern);
    if (match && match[1]) {
      currentEmployer = match[1].trim();
    }
  }
  
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
    currentTitle: currentTitle || '',
    currentEmployer: currentEmployer || '',
    skills,
    experience: [],
    notes: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
    confidence: 0.7,
    source: 'local-parser'
  };
}

// Enhanced CV parsing endpoint
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
        console.log('Using .NET parser...');
        parsedData = await dotNetParser.parseFile(buffer, mimetype, originalname);
        console.log('✅ .NET parser success');
      } catch (error) {
        console.warn('⚠️ .NET parser failed, falling back to local:', error.message);
        // Fall through to local parser
      }
    }
    
    // Use local parser if .NET parser not available or failed
    if (!parsedData) {
      console.log('Using local parser...');
      let text = '';
      
      if (mimetype === 'application/pdf') {
        const pdfData = await pdfParse(buffer);
        text = pdfData.text;
      } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const docxData = await mammoth.extractRawText({ buffer });
        text = docxData.value;
      } else if (mimetype === 'text/plain') {
        text = buffer.toString('utf-8');
      } else {
        throw new Error('Unsupported file type');
      }
      
      parsedData = parseCVContent(text);
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ CV parsing completed in ${duration}ms`);
    
    res.json({
      success: true,
      data: parsedData,
      duration,
      parser: dotNetParser ? 'dotnet' : 'local'
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

// Get candidates
app.get('/api/candidates', (req, res) => {
  res.json([]);
});

// Create candidate
app.post('/api/candidates', (req, res) => {
  res.json({
    id: 1,
    ...req.body,
    created_at: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Enhanced server running on port ${PORT}`);
  console.log(`🔧 .NET Parser: ${dotNetParser ? 'enabled' : 'disabled'}`);
  console.log(`🌐 Health: http://localhost:${PORT}/health`);
  console.log(`🔍 API: http://localhost:${PORT}/api`);
});
