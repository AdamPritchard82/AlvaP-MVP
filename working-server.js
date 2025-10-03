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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Working server running on port ${PORT}`);
});
