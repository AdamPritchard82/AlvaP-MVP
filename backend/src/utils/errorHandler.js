// Comprehensive error handling for CV parser
const { logger } = require('./logger');

class CvParserError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'CvParserError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

class AdapterError extends CvParserError {
  constructor(adapter, message, details = null) {
    super(`Adapter ${adapter}: ${message}`, 'ADAPTER_ERROR', details);
    this.name = 'AdapterError';
    this.adapter = adapter;
  }
}

class ParseError extends CvParserError {
  constructor(message, details = null) {
    super(message, 'PARSE_ERROR', details);
    this.name = 'ParseError';
  }
}

class ValidationError extends CvParserError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

class FileError extends CvParserError {
  constructor(message, details = null) {
    super(message, 'FILE_ERROR', details);
    this.name = 'FileError';
  }
}

// Error codes and their HTTP status mappings
const ERROR_CODES = {
  // File related errors
  NO_FILE: { status: 400, message: 'No file uploaded' },
  FILE_TOO_LARGE: { status: 413, message: 'File too large. Please upload files smaller than 20MB.' },
  UNSUPPORTED_TYPE: { status: 415, message: 'Unsupported file type. Please upload PDF, DOCX, or TXT files.' },
  FILE_CORRUPTED: { status: 422, message: 'The uploaded file appears to be corrupted or invalid.' },
  
  // Parsing errors
  PARSE_FAILED: { status: 422, message: 'Could not extract text from the uploaded file' },
  ADAPTER_ERROR: { status: 422, message: 'Text extraction failed' },
  OCR_FAILED: { status: 422, message: 'OCR processing failed' },
  
  // Validation errors
  VALIDATION_ERROR: { status: 400, message: 'Invalid input data' },
  INSUFFICIENT_TEXT: { status: 422, message: 'Insufficient text extracted from file' },
  
  // System errors
  INTERNAL_ERROR: { status: 500, message: 'Internal server error' },
  SERVICE_UNAVAILABLE: { status: 503, message: 'Service temporarily unavailable' }
};

// Error handler middleware
function errorHandler(error, req, res, next) {
  logger.error('Request error', {
    error: error.message,
    code: error.code,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle known error types
  if (error instanceof CvParserError) {
    const errorInfo = ERROR_CODES[error.code] || ERROR_CODES.INTERNAL_ERROR;
    
    return res.status(errorInfo.status).json({
      success: false,
      error: {
        code: error.code,
        message: errorInfo.message,
        details: error.details || error.message,
        timestamp: error.timestamp
      }
    });
  }

  // Handle multer errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'File too large. Please upload files smaller than 20MB.',
        timestamp: new Date().toISOString()
      }
    });
  }

  if (error.message && error.message.includes('Unsupported file type')) {
    return res.status(415).json({
      success: false,
      error: {
        code: 'UNSUPPORTED_TYPE',
        message: 'Unsupported file type. Please upload PDF, DOCX, or TXT files.',
        timestamp: new Date().toISOString()
      }
    });
  }

  // Handle unexpected errors
  logger.error('Unexpected error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    }
  });
}

// Validation helpers
function validateFile(file) {
  if (!file) {
    throw new ValidationError('No file provided', 'File is required');
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw new ValidationError('Empty file', 'File buffer is empty');
  }

  if (file.size > 20 * 1024 * 1024) { // 20MB
    throw new FileError('File too large', { size: file.size, maxSize: 20 * 1024 * 1024 });
  }

  const allowedMimes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (!allowedMimes.includes(file.mimetype)) {
    throw new ValidationError('Unsupported file type', { 
      mimetype: file.mimetype, 
      allowed: allowedMimes 
    });
  }
}

function validateText(text, minLength = 50) {
  if (!text || typeof text !== 'string') {
    throw new ParseError('No text extracted', 'Text extraction returned empty or invalid result');
  }

  if (text.length < minLength) {
    throw new ParseError('Insufficient text extracted', { 
      length: text.length, 
      minLength 
    });
  }
}

// Retry mechanism for adapters
async function withRetry(fn, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
        error: error.message,
        attempt,
        maxRetries
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  
  throw lastError;
}

// Circuit breaker for external services
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}

module.exports = {
  CvParserError,
  AdapterError,
  ParseError,
  ValidationError,
  FileError,
  errorHandler,
  validateFile,
  validateText,
  withRetry,
  CircuitBreaker,
  ERROR_CODES
};





