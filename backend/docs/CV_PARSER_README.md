# Enhanced CV Parser System

A robust, adapter-based CV parsing system with fallback mechanisms and comprehensive error handling.

## 🚀 Features

- **Adapter Pattern Architecture**: Multiple parsing adapters with automatic fallback
- **OCR Support**: Tesseract.js integration for scanned documents
- **Multiple File Formats**: PDF, DOCX, TXT support
- **Comprehensive Logging**: Detailed logging with rotation and performance metrics
- **Error Handling**: Robust error handling with specific error codes
- **Benchmarking**: Built-in performance testing and comparison tools
- **Configuration**: Environment-based feature flags and settings

## 📁 Project Structure

```
backend/
├── src/
│   ├── parsers/
│   │   ├── enhancedCvParser.js      # Full-featured parser (with PDF.js)
│   │   └── simpleEnhancedCvParser.js # Simplified parser (without PDF.js)
│   └── utils/
│       ├── logger.js                # Enhanced logging system
│       └── errorHandler.js          # Error handling utilities
├── test/
│   └── data/
│       ├── sample-cv.txt           # Sample CV files for testing
│       └── sample-cv-simple.txt
├── logs/                           # Log files (auto-created)
├── enhanced-cv-server.js           # Enhanced server implementation
├── benchmark-cv-parser.js          # Benchmark testing script
├── start-enhanced-server.bat       # Windows startup script
└── start-enhanced-server.ps1       # PowerShell startup script
```

## 🛠️ Installation

1. **Install Dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Install Additional Parsers** (already done):
   ```bash
   npm install pdfjs-dist tesseract.js docx
   ```

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_OCR` | `false` | Enable Tesseract.js OCR processing |
| `LOG_LEVEL` | `info` | Logging level (error, warn, info, debug) |
| `PORT` | `3001` | Server port |
| `ENABLE_PYTHON_PARSERS` | `false` | Enable Python-based parsers (future) |

### Example Configuration

```bash
# Enable OCR and debug logging
set ENABLE_OCR=true
set LOG_LEVEL=debug
set PORT=3001
```

## 🚀 Usage

### Starting the Server

**Windows (Batch)**:
```cmd
start-enhanced-server.bat
```

**Windows (PowerShell)**:
```powershell
.\start-enhanced-server.ps1
```

**Manual**:
```bash
cd backend
set ENABLE_OCR=true
set LOG_LEVEL=debug
node enhanced-cv-server.js
```

### API Endpoints

#### Health Check
```http
GET /health
```

Response:
```json
{
  "ok": true,
  "features": {
    "ocr": true,
    "python": false,
    "logLevel": "debug"
  }
}
```

#### Parse CV
```http
POST /api/candidates/parse-cv
Content-Type: multipart/form-data

file: [CV file]
```

Response:
```json
{
  "success": true,
  "data": {
    "firstName": "John",
    "lastName": "Smith",
    "email": "john.smith@email.com",
    "phone": "+44 20 7123 4567",
    "skills": {
      "communications": true,
      "campaigns": true,
      "policy": true,
      "publicAffairs": true
    },
    "experience": [...],
    "notes": "...",
    "confidence": 0.85,
    "source": "pdf-parse",
    "parseConfidence": 0.9,
    "textLength": 1250,
    "duration": 150,
    "metadata": {...},
    "allResults": [...],
    "errors": []
  }
}
```

#### Benchmark Testing
```http
POST /api/candidates/benchmark
Content-Type: multipart/form-data

file: [Test file]
```

## 🔧 Adapter System

### Available Adapters

1. **PDF Adapters**:
   - `pdf-parse`: Primary PDF parser (fast, reliable)
   - `tesseract-ocr`: OCR for scanned PDFs (requires ENABLE_OCR=true)

2. **DOCX Adapters**:
   - `mammoth`: Primary DOCX parser (fast, reliable)
   - `textract`: Fallback parser (requires system dependencies)

3. **Text Adapters**:
   - `text`: Plain text files
   - `textract`: Universal fallback

### Adapter Priority

Adapters are tried in priority order (lower number = higher priority):

1. Format-specific primary adapters (pdf-parse, mammoth, text)
2. OCR adapters (tesseract-ocr)
3. Universal fallback (textract)

### Adding New Adapters

```javascript
class CustomAdapter extends ParserAdapter {
  constructor() {
    super('custom-adapter', 5); // Priority 5
  }

  async canParse(buffer, mimetype, filename) {
    // Return true if this adapter can handle the file
    return mimetype === 'application/custom';
  }

  async parse(buffer, mimetype, filename) {
    // Parse the file and return result
    return {
      text: 'extracted text',
      confidence: 0.8,
      metadata: { method: 'custom' }
    };
  }
}
```

## 📊 Benchmarking

### Running Benchmarks

```bash
cd backend
node benchmark-cv-parser.js
```

### Benchmark Output

```
=== CV PARSER BENCHMARK ===
Test files directory: /path/to/test/data

📄 Testing: sample-cv.pdf
──────────────────────────────────────────────────
✅ Success!
   Best adapter: pdf-parse
   Text length: 1250 characters
   Confidence: 0.85
   Total time: 200ms
   Duration: 150ms

   All adapter results:
   - pdf-parse: 1250 chars, confidence: 0.85, 150ms
   - tesseract-ocr: 1200 chars, confidence: 0.80, 300ms

============================================================
📊 BENCHMARK SUMMARY
============================================================
Total files: 1
Successful: 1
Failed: 0

🏆 Adapter Performance:
   pdf-parse: 1 runs, avg confidence: 0.85, avg duration: 150ms
   tesseract-ocr: 1 runs, avg confidence: 0.80, avg duration: 300ms
```

## 🔍 Logging

### Log Levels

- `error`: Critical errors that prevent operation
- `warn`: Warnings and recoverable errors
- `info`: General information and successful operations
- `debug`: Detailed debugging information

### Log Files

- **Location**: `backend/logs/cv-parser.log`
- **Rotation**: Automatic rotation when file exceeds 10MB
- **Retention**: Keeps 5 log files maximum

### Log Format

```
[2024-01-15T10:30:45.123Z] [12345] [INFO ] CV Parse Started {"filename":"cv.pdf","mimetype":"application/pdf","size":1024000}
[2024-01-15T10:30:45.200Z] [12345] [DEBUG] Adapter pdf-parse succeeded {"filename":"cv.pdf","duration":150,"textLength":1250}
[2024-01-15T10:30:45.201Z] [12345] [INFO ] CV Parse Completed {"filename":"cv.pdf","adapter":"pdf-parse","success":true,"duration":150}
```

## 🚨 Error Handling

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `NO_FILE` | 400 | No file uploaded |
| `FILE_TOO_LARGE` | 413 | File exceeds 20MB limit |
| `UNSUPPORTED_TYPE` | 415 | Unsupported file type |
| `PARSE_FAILED` | 422 | Text extraction failed |
| `ADAPTER_ERROR` | 422 | Adapter-specific error |
| `OCR_FAILED` | 422 | OCR processing failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "PARSE_FAILED",
    "message": "Could not extract text from the uploaded file",
    "details": "PDF structure is invalid",
    "timestamp": "2024-01-15T10:30:45.123Z"
  }
}
```

## 🧪 Testing

### Test Files

Sample test files are provided in `backend/test/data/`:
- `sample-cv.txt`: Comprehensive CV example
- `sample-cv-simple.txt`: Simple CV example

### Running Tests

1. **Unit Tests** (if implemented):
   ```bash
   npm test
   ```

2. **Integration Tests**:
   ```bash
   node benchmark-cv-parser.js
   ```

3. **Manual Testing**:
   Use the provided test files with the API endpoints

## 🔧 Troubleshooting

### Common Issues

1. **PDF.js Compatibility**:
   - Use `simpleEnhancedCvParser.js` instead of `enhancedCvParser.js`
   - PDF.js has Node.js compatibility issues

2. **OCR Not Working**:
   - Ensure `ENABLE_OCR=true` is set
   - Check Tesseract.js installation

3. **Textract Failures**:
   - Install system dependencies (pdftotext, etc.)
   - Use as fallback only

4. **Memory Issues**:
   - Reduce file size limits
   - Enable log rotation
   - Monitor memory usage

### Performance Optimization

1. **Adapter Selection**:
   - Higher priority adapters are tried first
   - Stop on high confidence results

2. **Caching**:
   - Consider implementing result caching
   - Cache parsed results by file hash

3. **Parallel Processing**:
   - Run multiple adapters in parallel
   - Use worker threads for heavy processing

## 📈 Monitoring

### Performance Metrics

The system tracks:
- Parse duration per adapter
- Text extraction confidence
- Success/failure rates
- Memory usage
- Error frequencies

### Health Checks

- Server health: `GET /health`
- Adapter availability
- System resource usage
- Log file status

## 🔮 Future Enhancements

1. **Additional Adapters**:
   - Python-based parsers
   - Cloud OCR services
   - AI-powered extraction

2. **Performance Improvements**:
   - Parallel adapter execution
   - Result caching
   - Worker thread support

3. **Enhanced Features**:
   - Batch processing
   - Progress tracking
   - Real-time monitoring

## 📝 License

This project is part of the Door 10 MVP system.

## 🤝 Contributing

1. Follow the adapter pattern for new parsers
2. Add comprehensive error handling
3. Include logging and performance metrics
4. Update documentation
5. Add tests for new features






