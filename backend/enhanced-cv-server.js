// Enhanced CV parsing server with adapter pattern
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { SimpleEnhancedCvParser } = require('./src/parsers/simpleEnhancedCvParser');
const cvParserHealth = require('./src/routes/cv-parser-health');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize parser
const parser = new SimpleEnhancedCvParser();

// Middleware
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));
app.use(express.json({ limit: '10mb' }));

// Health endpoints
app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    features: {
      ocr: process.env.ENABLE_OCR === 'true',
      python: process.env.ENABLE_PYTHON_PARSERS === 'true',
      dotnet: process.env.ENABLE_DOTNET_PARSER === 'true',
      logLevel: process.env.LOG_LEVEL || 'info'
    }
  });
});

// CV Parser health check
app.use('/api/cv-parser', cvParserHealth);

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

// CV parsing endpoint
app.post('/api/candidates/parse-cv', upload.single('file'), async (req, res) => {
  try {
    console.log('=== ENHANCED CV PARSE ENDPOINT HIT ===');
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

    // Parse file using enhanced parser
    let parseResult;
    try {
      parseResult = await parser.parseFile(req.file.buffer, req.file.mimetype, req.file.originalname);
      console.log(`File parsed successfully using ${parseResult.adapter}`);
    } catch (parseError) {
      console.error(`File parsing failed: ${parseError.message}`);
      return res.status(422).json({ 
        success: false, 
        error: { 
          code: 'PARSE_FAILED', 
          message: 'Could not extract text from the uploaded file',
          details: parseError.message
        }
      });
    }
    
    // Parse candidate info from extracted text
    let candidateInfo;
    try {
      candidateInfo = parser.parseCandidateInfo(parseResult.text);
    } catch (infoError) {
      console.error(`Candidate info parsing failed: ${infoError.message}`);
      return res.status(422).json({ 
        success: false, 
        error: { 
          code: 'PARSE_FAILED', 
          message: 'Could not parse the extracted text',
          details: infoError.message
        }
      });
    }
    
    console.log('=== ENHANCED CV PARSE SUCCESS ===');
    console.log(`Adapter: ${parseResult.adapter}`);
    console.log(`Text length: ${parseResult.text.length}`);
    console.log(`Parse confidence: ${parseResult.confidence.toFixed(2)}`);
    console.log(`Candidate confidence: ${candidateInfo.confidence.toFixed(2)}`);
    console.log(`Duration: ${parseResult.duration}ms`);
    
    res.json({ 
      success: true, 
      data: {
        ...candidateInfo,
        source: parseResult.adapter,
        parseConfidence: parseResult.confidence,
        textLength: parseResult.text.length,
        duration: parseResult.duration,
        metadata: parseResult.metadata,
        allResults: parseResult.allResults.map(r => ({
          adapter: r.adapter,
          confidence: r.confidence,
          textLength: r.text.length,
          duration: r.duration
        })),
        errors: parseResult.errors
      }
    });
    
  } catch (error) {
    console.error('Enhanced CV parsing error:', error);
    
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

// Benchmark endpoint for testing
app.post('/api/candidates/benchmark', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const results = await parser.parseFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    
    res.json({
      success: true,
      benchmark: {
        file: {
          name: req.file.originalname,
          type: req.file.mimetype,
          size: req.file.size
        },
        results: results.allResults.map(r => ({
          adapter: r.adapter,
          confidence: r.confidence,
          textLength: r.text.length,
          duration: r.duration,
          success: true
        })),
        errors: results.errors,
        best: {
          adapter: results.adapter,
          confidence: results.confidence,
          textLength: results.text.length,
          duration: results.duration
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`=== ENHANCED CV SERVER STARTING ===`);
  console.log(`Port: ${PORT}`);
  console.log(`CORS Origins: http://localhost:3000, http://localhost:5173`);
  console.log(`OCR Enabled: ${process.env.ENABLE_OCR === 'true'}`);
  console.log(`Python Parsers: ${process.env.ENABLE_PYTHON_PARSERS === 'true'}`);
  console.log(`Log Level: ${process.env.LOG_LEVEL || 'info'}`);
  console.log(`Server running on http://localhost:${PORT}`);
});
