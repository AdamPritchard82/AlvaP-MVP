// Enhanced logging utility for CV parser
const fs = require('fs');
const path = require('path');

class Logger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || process.env.LOG_LEVEL || 'info';
    this.logFile = options.logFile || path.join(__dirname, '../../logs/cv-parser.log');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    // Ensure log directory exists
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    const levelStr = level.toUpperCase().padEnd(5);
    
    let logMessage = `[${timestamp}] [${pid}] [${levelStr}] ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        logMessage += `\n${JSON.stringify(data, null, 2)}`;
      } else {
        logMessage += ` ${data}`;
      }
    }
    
    return logMessage;
  }

  writeToFile(message) {
    try {
      // Check if log rotation is needed
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.maxFileSize) {
          this.rotateLogFile();
        }
      }
      
      fs.appendFileSync(this.logFile, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  rotateLogFile() {
    try {
      // Move existing log files
      for (let i = this.maxFiles - 1; i > 0; i--) {
        const oldFile = `${this.logFile}.${i}`;
        const newFile = `${this.logFile}.${i + 1}`;
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxFiles - 1) {
            fs.unlinkSync(oldFile); // Delete oldest file
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }
      
      // Move current log file
      if (fs.existsSync(this.logFile)) {
        fs.renameSync(this.logFile, `${this.logFile}.1`);
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error.message);
    }
  }

  log(level, message, data = null) {
    if (!this.shouldLog(level)) return;
    
    const formattedMessage = this.formatMessage(level, message, data);
    
    // Console output
    const colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[90m'  // Gray
    };
    
    const resetColor = '\x1b[0m';
    console.log(`${colors[level] || ''}${formattedMessage}${resetColor}`);
    
    // File output
    this.writeToFile(formattedMessage);
  }

  error(message, data = null) {
    this.log('error', message, data);
  }

  warn(message, data = null) {
    this.log('warn', message, data);
  }

  info(message, data = null) {
    this.log('info', message, data);
  }

  debug(message, data = null) {
    this.log('debug', message, data);
  }

  // Specialized logging methods
  parseStart(filename, mimetype, size) {
    this.info('CV Parse Started', {
      filename,
      mimetype,
      size,
      timestamp: new Date().toISOString()
    });
  }

  parseEnd(filename, adapter, success, duration, textLength, confidence) {
    this.info('CV Parse Completed', {
      filename,
      adapter,
      success,
      duration,
      textLength,
      confidence,
      timestamp: new Date().toISOString()
    });
  }

  adapterAttempt(adapter, filename, success, duration, textLength, error = null) {
    const level = success ? 'debug' : 'warn';
    this.log(level, `Adapter ${adapter} ${success ? 'succeeded' : 'failed'}`, {
      filename,
      adapter,
      success,
      duration,
      textLength,
      error: error ? error.message : null
    });
  }

  performanceMetrics(metrics) {
    this.info('Performance Metrics', metrics);
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = { Logger, logger };













