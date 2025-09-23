// Enhanced CV Parser with Adapter Pattern and Fallback Pipeline
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const textract = require('textract');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const Tesseract = require('tesseract.js');
const { Document, Packer, Paragraph, TextRun } = require('docx');

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');

// Environment flags
const ENABLE_OCR = process.env.ENABLE_OCR === 'true';
const ENABLE_PYTHON_PARSERS = process.env.ENABLE_PYTHON_PARSERS === 'true';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Logging utility
function log(level, message, data = null) {
  const levels = { error: 0, warn: 1, info: 2, debug: 3 };
  if (levels[level] <= levels[LOG_LEVEL]) {
    console.log(`[${level.toUpperCase()}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

// Base adapter class
class ParserAdapter {
  constructor(name, priority = 1) {
    this.name = name;
    this.priority = priority; // Lower number = higher priority
  }

  async canParse(buffer, mimetype, filename) {
    throw new Error('canParse method must be implemented');
  }

  async parse(buffer, mimetype, filename) {
    throw new Error('parse method must be implemented');
  }

  getConfidence(text) {
    if (!text || text.length < 100) return 0.1;
    if (text.length < 500) return 0.3;
    if (text.length < 1000) return 0.6;
    if (text.length < 2000) return 0.8;
    return 0.9;
  }
}

// PDF Adapters
class PdfParseAdapter extends ParserAdapter {
  constructor() {
    super('pdf-parse', 1);
  }

  async canParse(buffer, mimetype, filename) {
    return mimetype === 'application/pdf' || (filename && filename.toLowerCase().endsWith('.pdf'));
  }

  async parse(buffer, mimetype, filename) {
    try {
      const pdfData = await pdfParse(buffer);
      const text = this.cleanText(pdfData.text);
      return {
        text,
        confidence: this.getConfidence(text),
        metadata: {
          pages: pdfData.numpages,
          info: pdfData.info
        }
      };
    } catch (error) {
      log('warn', `PDF-parse failed: ${error.message}`);
      throw error;
    }
  }

  cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

class PdfJsAdapter extends ParserAdapter {
  constructor() {
    super('pdfjs-dist', 2);
  }

  async canParse(buffer, mimetype, filename) {
    return mimetype === 'application/pdf' || (filename && filename.toLowerCase().endsWith('.pdf'));
  }

  async parse(buffer, mimetype, filename) {
    try {
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }

      const text = this.cleanText(fullText);
      return {
        text,
        confidence: this.getConfidence(text),
        metadata: {
          pages: pdf.numPages
        }
      };
    } catch (error) {
      log('warn', `PDF.js failed: ${error.message}`);
      throw error;
    }
  }

  cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

class TesseractAdapter extends ParserAdapter {
  constructor() {
    super('tesseract-ocr', 3);
  }

  async canParse(buffer, mimetype, filename) {
    if (!ENABLE_OCR) return false;
    return mimetype === 'application/pdf' || (filename && filename.toLowerCase().endsWith('.pdf'));
  }

  async parse(buffer, mimetype, filename) {
    try {
      log('info', 'Starting OCR processing...');
      const { data: { text } } = await Tesseract.recognize(buffer, 'eng', {
        logger: m => log('debug', `OCR: ${m}`)
      });
      
      const cleanedText = this.cleanText(text);
      return {
        text: cleanedText,
        confidence: this.getConfidence(cleanedText),
        metadata: {
          method: 'ocr'
        }
      };
    } catch (error) {
      log('warn', `Tesseract OCR failed: ${error.message}`);
      throw error;
    }
  }

  cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// DOCX Adapters
class MammothAdapter extends ParserAdapter {
  constructor() {
    super('mammoth', 1);
  }

  async canParse(buffer, mimetype, filename) {
    return mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
           (filename && filename.toLowerCase().endsWith('.docx'));
  }

  async parse(buffer, mimetype, filename) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = this.cleanText(result.value);
      return {
        text,
        confidence: this.getConfidence(text),
        metadata: {
          warnings: result.messages
        }
      };
    } catch (error) {
      log('warn', `Mammoth failed: ${error.message}`);
      throw error;
    }
  }

  cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

class DocxAdapter extends ParserAdapter {
  constructor() {
    super('docx', 2);
  }

  async canParse(buffer, mimetype, filename) {
    return mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
           (filename && filename.toLowerCase().endsWith('.docx'));
  }

  async parse(buffer, mimetype, filename) {
    try {
      // This is a simplified implementation - in practice you'd need to parse the DOCX structure
      // For now, we'll use this as a fallback that calls textract
      throw new Error('DOCX native parsing not implemented - using textract fallback');
    } catch (error) {
      log('warn', `DOCX native failed: ${error.message}`);
      throw error;
    }
  }

  cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Text Adapters
class TextAdapter extends ParserAdapter {
  constructor() {
    super('text', 1);
  }

  async canParse(buffer, mimetype, filename) {
    return mimetype === 'text/plain' || (filename && filename.toLowerCase().endsWith('.txt'));
  }

  async parse(buffer, mimetype, filename) {
    try {
      const text = this.cleanText(buffer.toString('utf8'));
      return {
        text,
        confidence: this.getConfidence(text),
        metadata: {
          encoding: 'utf8'
        }
      };
    } catch (error) {
      log('warn', `Text parsing failed: ${error.message}`);
      throw error;
    }
  }

  cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Fallback Adapter
class TextractAdapter extends ParserAdapter {
  constructor() {
    super('textract', 10); // Lowest priority
  }

  async canParse(buffer, mimetype, filename) {
    return true; // Can attempt to parse any file
  }

  async parse(buffer, mimetype, filename) {
    try {
      const extension = filename ? filename.split('.').pop() : 'bin';
      const text = await new Promise((resolve, reject) => {
        textract.fromBufferWithName(`file.${extension}`, buffer, (error, text) => {
          if (error) reject(error);
          else resolve(text);
        });
      });
      
      const cleanedText = this.cleanText(text);
      return {
        text: cleanedText,
        confidence: this.getConfidence(cleanedText),
        metadata: {
          method: 'textract'
        }
      };
    } catch (error) {
      log('warn', `Textract failed: ${error.message}`);
      throw error;
    }
  }

  cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Enhanced CV Parser with Adapter Pipeline
class EnhancedCvParser {
  constructor() {
    this.adapters = [
      new PdfParseAdapter(),
      new PdfJsAdapter(),
      new TesseractAdapter(),
      new MammothAdapter(),
      new DocxAdapter(),
      new TextAdapter(),
      new TextractAdapter()
    ];
  }

  async parseFile(buffer, mimetype, filename) {
    log('info', `Starting file parsing: ${filename} (${mimetype})`);
    
    const results = [];
    const errors = [];

    // Try each adapter in priority order
    for (const adapter of this.adapters) {
      try {
        if (await adapter.canParse(buffer, mimetype, filename)) {
          log('debug', `Trying adapter: ${adapter.name}`);
          const startTime = Date.now();
          
          const result = await adapter.parse(buffer, mimetype, filename);
          const duration = Date.now() - startTime;
          
          result.adapter = adapter.name;
          result.duration = duration;
          results.push(result);
          
          log('info', `Adapter ${adapter.name} succeeded: ${result.text.length} chars, confidence: ${result.confidence.toFixed(2)}, duration: ${duration}ms`);
          
          // If we got good results, we can stop here
          if (result.confidence > 0.7 && result.text.length > 500) {
            log('info', `High confidence result from ${adapter.name}, stopping pipeline`);
            break;
          }
        }
      } catch (error) {
        errors.push({
          adapter: adapter.name,
          error: error.message
        });
        log('debug', `Adapter ${adapter.name} failed: ${error.message}`);
      }
    }

    if (results.length === 0) {
      throw new Error(`All parsing methods failed. Errors: ${errors.map(e => `${e.adapter}: ${e.error}`).join(', ')}`);
    }

    // Select best result
    const bestResult = this.selectBestResult(results);
    log('info', `Selected best result: ${bestResult.adapter} (confidence: ${bestResult.confidence.toFixed(2)})`);

    return {
      ...bestResult,
      allResults: results,
      errors: errors
    };
  }

  selectBestResult(results) {
    // Sort by confidence, then by text length, then by duration
    return results.sort((a, b) => {
      if (Math.abs(a.confidence - b.confidence) > 0.1) {
        return b.confidence - a.confidence;
      }
      if (Math.abs(a.text.length - b.text.length) > 100) {
        return b.text.length - a.text.length;
      }
      return a.duration - b.duration;
    })[0];
  }

  // Parse candidate info from extracted text
  parseCandidateInfo(text) {
    log('debug', `Parsing candidate info from ${text.length} characters`);
    
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
    }
    
    log('debug', `Parsed candidate: ${firstName} ${lastName}, email: ${email}, experience: ${experience.length} entries`);
    
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
}

module.exports = { EnhancedCvParser };
