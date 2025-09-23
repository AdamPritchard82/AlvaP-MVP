/**
 * CV Parser - Robust text extraction from PDF, DOCX, and TXT files
 * 
 * Extractor Order & Fallbacks:
 * - PDF: pdf-parse(buffer) → textract.fromBufferWithName() if fails/insufficient text
 * - DOCX: mammoth.extractRawText({ buffer }) → textract.fromBufferWithName() if fails
 * - TXT: buffer.toString('utf8')
 * - Other: textract.fromBufferWithName() with detected mimetype/extension
 */

import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import textract from 'textract';
import fs from 'fs';
import path from 'path';

// Text cleanup utility
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

// Extract text from buffer using appropriate method
async function extractTextFromBuffer(buffer, mimetype, filename) {
  const isDebug = process.env.LOG_LEVEL === 'debug';
  
  if (isDebug) {
    console.log('=== EXTRACT START ===');
    console.log(`MIME: ${mimetype}`);
    console.log(`Filename: ${filename || 'unknown'}`);
    console.log(`Buffer size: ${buffer.length} bytes`);
  }

  try {
    // PDF handling
    if (mimetype === 'application/pdf' || (filename && filename.toLowerCase().endsWith('.pdf'))) {
      try {
        const pdfData = await pdfParse(buffer);
        const text = cleanText(pdfData.text);
        
        if (isDebug) {
          console.log(`PDF extracted via pdf-parse: ${text.length} chars`);
        }
        
        // If pdf-parse returns too little text, try textract
        if (text.length < 400) {
          if (isDebug) {
            console.log('pdf-parse returned insufficient text, trying textract...');
          }
          
          const textractText = await new Promise((resolve, reject) => {
            textract.fromBufferWithName('file.pdf', buffer, (error, text) => {
              if (error) reject(error);
              else resolve(text);
            });
          });
          
          const cleanedTextract = cleanText(textractText);
          if (isDebug) {
            console.log(`PDF extracted via textract: ${cleanedTextract.length} chars`);
          }
          
          return { text: cleanedTextract, source: 'textract' };
        }
        
        return { text, source: 'pdf-parse' };
      } catch (error) {
        if (isDebug) {
          console.log(`pdf-parse failed, trying textract: ${error.message}`);
        }
        
        const textractText = await new Promise((resolve, reject) => {
          textract.fromBufferWithName('file.pdf', buffer, (error, text) => {
            if (error) reject(error);
            else resolve(text);
          });
        });
        
        const cleanedTextract = cleanText(textractText);
        if (isDebug) {
          console.log(`PDF extracted via textract: ${cleanedTextract.length} chars`);
        }
        
        return { text: cleanedTextract, source: 'textract' };
      }
    }
    
    // DOCX handling
    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        (filename && filename.toLowerCase().endsWith('.docx'))) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        const text = cleanText(result.value);
        
        if (isDebug) {
          console.log(`DOCX extracted via mammoth: ${text.length} chars`);
        }
        
        return { text, source: 'mammoth' };
      } catch (error) {
        if (isDebug) {
          console.log(`mammoth failed, trying textract: ${error.message}`);
        }
        
        const textractText = await new Promise((resolve, reject) => {
          textract.fromBufferWithName('file.docx', buffer, (error, text) => {
            if (error) reject(error);
            else resolve(text);
          });
        });
        
        const cleanedTextract = cleanText(textractText);
        if (isDebug) {
          console.log(`DOCX extracted via textract: ${cleanedTextract.length} chars`);
        }
        
        return { text: cleanedTextract, source: 'textract' };
      }
    }
    
    // TXT handling
    if (mimetype === 'text/plain' || (filename && filename.toLowerCase().endsWith('.txt'))) {
      const text = cleanText(buffer.toString('utf8'));
      
      if (isDebug) {
        console.log(`TXT extracted via fs: ${text.length} chars`);
      }
      
      return { text, source: 'fs' };
    }
    
    // Fallback: try textract for other formats
    const extension = filename ? path.extname(filename).toLowerCase() : '';
    const textractText = await new Promise((resolve, reject) => {
      textract.fromBufferWithName(`file${extension}`, buffer, (error, text) => {
        if (error) reject(error);
        else resolve(text);
      });
    });
    
    const cleanedTextract = cleanText(textractText);
    if (isDebug) {
      console.log(`File extracted via textract: ${cleanedTextract.length} chars`);
    }
    
    return { text: cleanedTextract, source: 'textract' };
    
  } catch (error) {
    if (isDebug) {
      console.error(`Text extraction failed: ${error.message}`);
    }
    throw new Error(`Failed to extract text from ${mimetype} file`);
  }
}

// Extract candidate information from text
function parseCandidateInfo(text) {
  const isDebug = process.env.LOG_LEVEL === 'debug';
  
  if (isDebug) {
    console.log('=== PARSE START ===');
    console.log(`Text length: ${text.length}`);
  }
  
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
  
  // Pattern 1: "Company — Title (2019–2022)" or "Title at Company, 2021–present"
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
  
  // If no structured experience found, try to extract from common patterns
  if (experience.length === 0) {
    const jobKeywords = [
      'manager', 'director', 'officer', 'specialist', 'coordinator', 
      'executive', 'analyst', 'consultant', 'advisor', 'associate', 
      'assistant', 'head', 'chief', 'vice', 'deputy', 'senior', 'junior',
      'lead', 'principal', 'architect', 'engineer', 'developer', 'designer'
    ];
    
    let currentEntry = null;
    
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i];
      
      // Skip headers and short lines
      if (line.length < 3 || 
          line.match(/^(name|email|phone|address|summary|profile|objective|skills|education|experience|employment|work|location|contact|references|achievements|qualifications)/i)) {
        continue;
      }
      
      // Look for job titles
      if (!currentEntry) {
        const hasJobKeyword = jobKeywords.some(keyword => 
          line.toLowerCase().includes(keyword)
        );
        
        const looksLikeTitle = /^[A-Z][a-zA-Z\s&,\-\/]+$/.test(line) && 
                              line.length > 5 && line.length < 60 &&
                              !line.includes('@') && !line.includes('http') &&
                              !line.match(/\d{4}/);
        
        if ((hasJobKeyword || looksLikeTitle) && 
            !line.toLowerCase().includes('university') &&
            !line.toLowerCase().includes('college') &&
            !line.toLowerCase().includes('school')) {
          currentEntry = { title: line, employer: '', startDate: '', endDate: '' };
        }
      } else if (!currentEntry.employer) {
        // Look for company name
        const companyKeywords = [
          'Ltd', 'Inc', 'Corp', 'Company', 'Group', 'Associates', 'Partners',
          'Consulting', 'Services', 'Solutions', 'Limited', 'International',
          'Department', 'Agency', 'Authority', 'Commission', 'Ministry'
        ];
        
        const hasCompanyKeyword = companyKeywords.some(keyword => 
          line.includes(keyword)
        );
        
        const looksLikeCompany = /^[A-Z][a-zA-Z\s&,\-\/\.]+$/.test(line) && 
                                line.length > 3 && line.length < 80 &&
                                !line.includes('@') && !line.includes('http') &&
                                !line.match(/\d{4}/);
        
        if ((hasCompanyKeyword || looksLikeCompany) && 
            !line.toLowerCase().includes('university') &&
            !line.toLowerCase().includes('college') &&
            !line.toLowerCase().includes('school')) {
          currentEntry.employer = line;
          experience.push(currentEntry);
          currentEntry = null;
        }
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
  let confidence = Math.min(1, text.length / 8000); // Base confidence on text length
  if (firstName && lastName) confidence += 0.1;
  if (email) confidence += 0.1;
  if (phone) confidence += 0.05;
  if (experience.length > 0) confidence += 0.1;
  const skillCount = Object.values(skills).filter(Boolean).length;
  confidence += skillCount * 0.05;
  confidence = Math.min(confidence, 1.0);
  
  // Check for low text yield
  if (text.length < 300) {
    confidence = Math.min(confidence, 0.3); // Cap confidence at 0.3 for low text
    notes = (notes ? notes + ' ' : '') + 'Low text yield; please review manually.';
  }
  
  if (isDebug) {
    console.log('=== PARSE OK ===');
    console.log(`Name: ${firstName} ${lastName}`);
    console.log(`Email: ${email}`);
    console.log(`Experience entries: ${experience.length}`);
    console.log(`Skills detected: ${Object.entries(skills).filter(([_, v]) => v).map(([k, _]) => k).join(', ')}`);
    console.log(`Confidence: ${confidence.toFixed(2)}`);
  }
  
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

// Main CV parsing function
async function parseBuffer(buffer, { mimetype, filename }) {
  const isDebug = process.env.LOG_LEVEL === 'debug';
  
  try {
    if (isDebug) {
      console.log('=== CV PARSE START ===');
      console.log(`MIME: ${mimetype}`);
      console.log(`Filename: ${filename || 'unknown'}`);
      console.log(`Buffer size: ${buffer.length} bytes`);
    }
    
    // Guard text extraction with try/catch
    let text, source;
    try {
      const result = await extractTextFromBuffer(buffer, mimetype, filename);
      text = result.text;
      source = result.source;
    } catch (extractError) {
      if (isDebug) {
        console.error(`Text extraction failed: ${extractError.message}`);
      }
      throw new Error(`Failed to extract text: ${extractError.message}`);
    }
    
    // Guard parsing with try/catch
    let parsed;
    try {
      parsed = parseCandidateInfo(text);
    } catch (parseError) {
      if (isDebug) {
        console.error(`Text parsing failed: ${parseError.message}`);
      }
      throw new Error(`Failed to parse text: ${parseError.message}`);
    }
    
    if (isDebug) {
      console.log('=== CV PARSE OK ===');
      console.log(`Source: ${source}`);
      console.log(`Confidence: ${parsed.confidence}`);
    }
    
    return {
      ...parsed,
      source
    };
    
  } catch (error) {
    if (isDebug) {
      console.error('=== CV PARSE FAIL ===');
      console.error(`Error: ${error.message}`);
    }
    
    return {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      skills: {
        communications: false,
        campaigns: false,
        policy: false,
        publicAffairs: false
      },
      experience: [],
      notes: `Parse error: ${error.message}`,
      source: 'error',
      confidence: 0.0
    };
  }
}

export { parseBuffer };