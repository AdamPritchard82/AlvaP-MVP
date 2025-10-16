// Simple CV parsing server - bypasses module issues
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const textract = require('textract');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));
app.use(express.json({ limit: '10mb' }));

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// File upload setup
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

// Text cleanup
function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
    .replace(/\r\n/g, '\n') // Normalize newlines
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

// Extract text from buffer
async function extractTextFromBuffer(buffer, mimetype, filename) {
  console.log('=== EXTRACT START ===');
  console.log(`MIME: ${mimetype}, Filename: ${filename}, Size: ${buffer.length} bytes`);

  try {
    // PDF handling
    if (mimetype === 'application/pdf' || (filename && filename.toLowerCase().endsWith('.pdf'))) {
      try {
        const pdfData = await pdfParse(buffer);
        const text = cleanText(pdfData.text);
        console.log(`PDF extracted via pdf-parse: ${text.length} chars`);
        
        if (text.length < 400) {
          console.log('pdf-parse returned insufficient text, trying textract...');
          const textractText = await new Promise((resolve, reject) => {
            textract.fromBufferWithName('file.pdf', buffer, (error, text) => {
              if (error) reject(error);
              else resolve(text);
            });
          });
          const cleanedTextract = cleanText(textractText);
          console.log(`PDF extracted via textract: ${cleanedTextract.length} chars`);
          return { text: cleanedTextract, source: 'textract' };
        }
        
        return { text, source: 'pdf-parse' };
      } catch (error) {
        console.log(`pdf-parse failed, trying textract: ${error.message}`);
        const textractText = await new Promise((resolve, reject) => {
          textract.fromBufferWithName('file.pdf', buffer, (error, text) => {
            if (error) reject(error);
            else resolve(text);
          });
        });
        const cleanedTextract = cleanText(textractText);
        console.log(`PDF extracted via textract: ${cleanedTextract.length} chars`);
        return { text: cleanedTextract, source: 'textract' };
      }
    }
    
    // DOCX handling
    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        (filename && filename.toLowerCase().endsWith('.docx'))) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        const text = cleanText(result.value);
        console.log(`DOCX extracted via mammoth: ${text.length} chars`);
        return { text, source: 'mammoth' };
      } catch (error) {
        console.log(`mammoth failed, trying textract: ${error.message}`);
        const textractText = await new Promise((resolve, reject) => {
          textract.fromBufferWithName('file.docx', buffer, (error, text) => {
            if (error) reject(error);
            else resolve(text);
          });
        });
        const cleanedTextract = cleanText(textractText);
        console.log(`DOCX extracted via textract: ${cleanedTextract.length} chars`);
        return { text: cleanedTextract, source: 'textract' };
      }
    }
    
    // TXT handling
    if (mimetype === 'text/plain' || (filename && filename.toLowerCase().endsWith('.txt'))) {
      const text = cleanText(buffer.toString('utf8'));
      console.log(`TXT extracted via fs: ${text.length} chars`);
      return { text, source: 'fs' };
    }
    
    // Fallback: try textract
    const extension = filename ? filename.split('.').pop() : '';
    const textractText = await new Promise((resolve, reject) => {
      textract.fromBufferWithName(`file.${extension}`, buffer, (error, text) => {
        if (error) reject(error);
        else resolve(text);
      });
    });
    const cleanedTextract = cleanText(textractText);
    console.log(`File extracted via textract: ${cleanedTextract.length} chars`);
    return { text: cleanedTextract, source: 'textract' };
    
  } catch (error) {
    console.error(`Text extraction failed: ${error.message}`);
    throw new Error(`Failed to extract text from ${mimetype} file`);
  }
}

// Parse candidate info from text
function parseCandidateInfo(text) {
  console.log('=== PARSE START ===');
  console.log(`Text length: ${text.length}`);
  
  // Extract email
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const email = emailMatch ? emailMatch[1] : '';
  
  // Extract phone
  const phoneMatch = text.match(/(\+?[\d\s\-\(\)]{10,})/);
  const phone = phoneMatch ? phoneMatch[1] : '';
  
  // Extract names from first line
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  let firstName = '';
  let lastName = '';
  
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    const words = firstLine.split(/\s+/);
    if (words.length >= 2) {
      firstName = words[0];
      lastName = words.slice(1).join(' ');
    } else {
      firstName = words[0] || '';
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
  
  // Extract experience using simple regex patterns
  const experience = [];
  const experiencePatterns = [
    /^(.+?)\s*—\s*(.+?)\s*\((\d{4})\s*[–-]\s*(\d{4}|present)\)/i,
    /^(.+?)\s*at\s*(.+?),\s*(\d{4})\s*[–-]\s*(\d{4}|present)/i,
    /^(.+?)\s*at\s*(.+?),\s*(\d{4})\s*[–-]\s*present/i,
    /^(.+?)\s*—\s*(.+?)\s*\((\d{4})\s*[–-]\s*present\)/i
  ];
  
  for (const line of lines) {
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
  
  // Generate notes from first few lines
  const summaryLines = lines.slice(0, 5).filter(line => 
    line.length > 20 && 
    !line.includes('@') && 
    !line.match(/\d{4}/) &&
    !line.toLowerCase().includes('phone') &&
    !line.toLowerCase().includes('email')
  );
  
  const notes = summaryLines.join(' ').substring(0, 200) + 
    (summaryLines.join(' ').length > 200 ? '...' : '');
  
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
    notes = (notes ? notes + ' ' : '') + 'Low text yield; please review manually.';
  }
  
  console.log('=== PARSE OK ===');
  console.log(`Name: ${firstName} ${lastName}`);
  console.log(`Email: ${email}`);
  console.log(`Experience entries: ${experience.length}`);
  console.log(`Skills detected: ${Object.entries(skills).filter(([_, v]) => v).map(([k, _]) => k).join(', ')}`);
  console.log(`Confidence: ${confidence.toFixed(2)}`);
  
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
    console.log('Request file:', req.file);
    
    if (!req.file) {
      return res.status(400).json({ 
        error: { 
          code: 'NO_FILE', 
          message: 'No file uploaded' 
        } 
      });
    }

    // Extract text
    let text, source;
    try {
      const result = await extractTextFromBuffer(req.file.buffer, req.file.mimetype, req.file.originalname);
      text = result.text;
      source = result.source;
    } catch (extractError) {
      console.error(`Text extraction failed: ${extractError.message}`);
      return res.status(422).json({ 
        success: false, 
        error: { 
          code: 'PARSE_FAILED', 
          message: 'Could not extract text from the uploaded file',
          details: extractError.message
        }
      });
    }
    
    // Parse candidate info
    let parsed;
    try {
      parsed = parseCandidateInfo(text);
    } catch (parseError) {
      console.error(`Text parsing failed: ${parseError.message}`);
      return res.status(422).json({ 
        success: false, 
        error: { 
          code: 'PARSE_FAILED', 
          message: 'Could not parse the extracted text',
          details: parseError.message
        }
      });
    }
    
    console.log('=== CV PARSE OK ===');
    console.log(`Source: ${source}`);
    console.log(`Confidence: ${parsed.confidence}`);
    
    res.json({ 
      success: true, 
      data: {
        ...parsed,
        source
      }
    });
    
  } catch (error) {
    console.error('CV parsing error:', error);
    
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
        message: 'Could not process the uploaded file',
        details: error.message
      }
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`=== SIMPLE CV SERVER STARTING ===`);
  console.log(`Port: ${PORT}`);
  console.log(`CORS Origins: http://localhost:3000, http://localhost:5173`);
  console.log(`Server running on http://localhost:${PORT}`);
});




















