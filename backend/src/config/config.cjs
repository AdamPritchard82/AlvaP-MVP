// Configuration management for CV parser system
const path = require('path');

class Config {
  constructor() {
    this.loadConfig();
  }

  loadConfig() {
    // Server configuration
    this.server = {
      port: parseInt(process.env.PORT) || 3001,
      host: process.env.HOST || 'localhost',
      corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(','),
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 20 * 1024 * 1024, // 20MB
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000, // 30s
    };

    // Parser configuration
    this.parser = {
      enableOcr: process.env.ENABLE_OCR === 'true',
      enablePythonParsers: process.env.ENABLE_PYTHON_PARSERS === 'true',
      logLevel: process.env.LOG_LEVEL || 'info',
      minTextLength: parseInt(process.env.MIN_TEXT_LENGTH) || 50,
      maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.RETRY_DELAY) || 1000,
      confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.7,
      textLengthThreshold: parseInt(process.env.TEXT_LENGTH_THRESHOLD) || 500,
    };

    // OCR configuration
    this.ocr = {
      enabled: this.parser.enableOcr,
      language: process.env.OCR_LANGUAGE || 'eng',
      options: {
        logger: process.env.OCR_VERBOSE === 'true' ? console.log : () => {},
        tessedit_char_whitelist: process.env.OCR_CHAR_WHITELIST || '',
        tessedit_pageseg_mode: process.env.OCR_PAGE_SEG_MODE || '1',
      },
    };

    // Logging configuration
    this.logging = {
      level: this.parser.logLevel,
      logFile: process.env.LOG_FILE || path.join(__dirname, '../../logs/cv-parser.log'),
      maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
      maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
      enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
      enableFile: process.env.LOG_ENABLE_FILE !== 'false',
    };

    // Performance configuration
    this.performance = {
      enableMetrics: process.env.ENABLE_METRICS !== 'false',
      metricsInterval: parseInt(process.env.METRICS_INTERVAL) || 60000, // 1 minute
      enableCircuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER !== 'false',
      circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5,
      circuitBreakerTimeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 60000, // 1 minute
    };

    // File processing configuration
    this.fileProcessing = {
      allowedMimeTypes: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ],
      allowedExtensions: ['.pdf', '.docx', '.txt'],
      tempDir: process.env.TEMP_DIR || path.join(__dirname, '../../temp'),
      cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 300000, // 5 minutes
    };

    // Adapter configuration
    this.adapters = {
      pdfParse: {
        enabled: true,
        priority: 1,
        options: {}
      },
      tesseract: {
        enabled: this.parser.enableOcr,
        priority: 2,
        options: this.ocr.options
      },
      mammoth: {
        enabled: true,
        priority: 1,
        options: {}
      },
      text: {
        enabled: true,
        priority: 1,
        options: {}
      },
      textract: {
        enabled: true,
        priority: 10,
        options: {}
      }
    };

    // Database configuration (if needed)
    this.database = {
      enabled: process.env.DB_ENABLED === 'true',
      url: process.env.DATABASE_URL || 'sqlite:./data/app.db',
      options: {
        logging: process.env.DB_LOGGING === 'true',
        pool: {
          max: parseInt(process.env.DB_POOL_MAX) || 5,
          min: parseInt(process.env.DB_POOL_MIN) || 0,
          acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
          idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
        }
      }
    };

    // Security configuration
    this.security = {
      enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
      enableCors: process.env.ENABLE_CORS !== 'false',
      trustedProxies: (process.env.TRUSTED_PROXIES || '').split(',').filter(Boolean),
    };

    // Feature flags
    this.features = {
      ocr: this.parser.enableOcr,
      pythonParsers: this.parser.enablePythonParsers,
      benchmarking: process.env.ENABLE_BENCHMARKING !== 'false',
      healthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
      metrics: this.performance.enableMetrics,
      circuitBreaker: this.performance.enableCircuitBreaker,
    };
  }

  // Validation methods
  validate() {
    const errors = [];

    // Validate server config
    if (this.server.port < 1 || this.server.port > 65535) {
      errors.push('Invalid server port');
    }

    if (this.server.maxFileSize < 1024) {
      errors.push('Max file size too small');
    }

    // Validate parser config
    if (this.parser.minTextLength < 10) {
      errors.push('Min text length too small');
    }

    if (this.parser.confidenceThreshold < 0 || this.parser.confidenceThreshold > 1) {
      errors.push('Confidence threshold must be between 0 and 1');
    }

    // Validate logging config
    const validLogLevels = ['error', 'warn', 'info', 'debug'];
    if (!validLogLevels.includes(this.logging.level)) {
      errors.push(`Invalid log level: ${this.logging.level}`);
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  // Get configuration summary
  getSummary() {
    return {
      server: {
        port: this.server.port,
        host: this.server.host,
        maxFileSize: this.server.maxFileSize,
      },
      parser: {
        enableOcr: this.parser.enableOcr,
        enablePythonParsers: this.parser.enablePythonParsers,
        logLevel: this.parser.logLevel,
        confidenceThreshold: this.parser.confidenceThreshold,
      },
      features: this.features,
      adapters: Object.keys(this.adapters).filter(name => this.adapters[name].enabled),
    };
  }

  // Update configuration at runtime
  updateConfig(updates) {
    Object.keys(updates).forEach(key => {
      if (this.hasOwnProperty(key)) {
        Object.assign(this[key], updates[key]);
      }
    });
  }

  // Reset to defaults
  reset() {
    delete process.env.PORT;
    delete process.env.ENABLE_OCR;
    delete process.env.LOG_LEVEL;
    // ... reset other env vars
    this.loadConfig();
  }
}

// Create singleton instance
const config = new Config();

// Validate configuration on load
try {
  config.validate();
} catch (error) {
  console.error('Configuration validation failed:', error.message);
  process.exit(1);
}

module.exports = { Config, config };

















