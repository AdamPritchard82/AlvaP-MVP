import { Router } from 'express';
import multer from 'multer';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';
import { query, queryOne, queryAll, execute, transaction, generateId, getCurrentTimestamp, parseJsonFields, formatJsonFields } from '../db-utils.js';
import csv from 'csv-parser';
import { createReadStream } from 'node:fs';
// Simple CV parsing - no external dependencies
import fs from 'fs';

const router = Router();

// Set up file upload with size limits and MIME validation
const uploadDir = join(process.cwd(), '..', 'data', 'uploads');
mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types - we'll handle parsing in the function
    cb(null, true);
  }
});

// Enhanced CV parsing with fallback parsers
async function parseCVContent(filePath, mimetype) {
    console.log('=== CV PARSING START ===');
    console.log('File path:', filePath);
    console.log('MIME type:', mimetype);
    
    let text = '';
  let parserUsed = '';
  let parseSuccess = false;
  
  // Read file buffer for all parsers
  const buffer = fs.readFileSync(filePath);
  const fileExtension = filePath.split('.').pop().toLowerCase();
  
  // 1. Try TXT parsing first (for .txt files)
  if (fileExtension === 'txt' || mimetype === 'text/plain') {
    try {
      console.log('Trying TXT parser...');
      text = buffer.toString('utf8');
      if (text && text.trim().length > 0) {
        parserUsed = 'TXT';
        parseSuccess = true;
        console.log(`✅ TXT parser succeeded: ${text.length} characters`);
      }
    } catch (txtError) {
      console.log('❌ TXT parser failed:', txtError.message);
    }
  }
  
  // 2. Try PDF parsing with pdf-parse
  if (!parseSuccess && (fileExtension === 'pdf' || mimetype === 'application/pdf')) {
    try {
      console.log('Trying PDF parser (pdf-parse)...');
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(buffer);
      if (result.text && result.text.trim().length > 0) {
        text = result.text;
        parserUsed = 'pdf-parse';
        parseSuccess = true;
        console.log(`✅ PDF parser (pdf-parse) succeeded: ${text.length} characters`);
      }
    } catch (pdfError) {
      console.log('❌ PDF parser (pdf-parse) failed:', pdfError.message);
    }
  }
  
  // 3. Try DOCX parsing with mammoth
  if (!parseSuccess && (fileExtension === 'docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
    try {
      console.log('Trying DOCX parser (mammoth)...');
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      if (result.value && result.value.trim().length > 0) {
        text = result.value;
        parserUsed = 'mammoth';
        parseSuccess = true;
        console.log(`✅ DOCX parser (mammoth) succeeded: ${text.length} characters`);
      }
    } catch (docxError) {
      console.log('❌ DOCX parser (mammoth) failed:', docxError.message);
    }
  }
  
  // 4. Try textract as fallback for any file type
  if (!parseSuccess) {
    try {
      console.log('Trying textract fallback...');
        const textract = require('textract');
        text = await new Promise((resolve, reject) => {
        textract.fromBufferWithMime(mimetype || `application/${fileExtension}`, buffer, (error, extractedText) => {
            if (error) reject(error);
            else resolve(extractedText);
          });
        });
      if (text && text.trim().length > 0) {
        parserUsed = 'textract';
        parseSuccess = true;
        console.log(`✅ Textract fallback succeeded: ${text.length} characters`);
      }
    } catch (textractError) {
      console.log('❌ Textract fallback failed:', textractError.message);
    }
  }
  
  // 5. Try tesseract.js OCR as last resort
  if (!parseSuccess) {
    try {
      console.log('Trying Tesseract OCR...');
      const { createWorker } = require('tesseract.js');
      const worker = await createWorker();
      const { data: { text: ocrText } } = await worker.recognize(buffer);
      await worker.terminate();
      if (ocrText && ocrText.trim().length > 0) {
        text = ocrText;
        parserUsed = 'tesseract-ocr';
        parseSuccess = true;
        console.log(`✅ Tesseract OCR succeeded: ${text.length} characters`);
      }
    } catch (ocrError) {
      console.log('❌ Tesseract OCR failed:', ocrError.message);
    }
  }
  
  // If all parsers failed, throw error
  if (!parseSuccess || !text || text.trim().length === 0) {
    console.log('❌ All parsers failed');
    throw new Error('Could not extract text from file. Supported formats: TXT, PDF, DOCX');
  }
  
  console.log(`✅ Text extraction successful using ${parserUsed}: ${text.length} characters`);
    console.log('First 200 chars:', text.substring(0, 200));
    
  // Clean and parse the extracted text
  const cleanText = text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
    .replace(/\r\n/g, '\n') // Normalize newlines
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
  
  const lines = cleanText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Extract name from first line
    let firstName = '';
    let lastName = '';
    if (lines.length > 0) {
      const firstLine = lines[0];
      const words = firstLine.split(/\s+/);
      if (words.length >= 2) {
        firstName = words[0];
        lastName = words.slice(1).join(' ');
      } else if (words.length === 1) {
        firstName = words[0];
      }
    }
    
    // Extract email
  const emailMatch = cleanText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const email = emailMatch ? emailMatch[1] : '';
    
    // Enhanced phone number extraction with multiple regex patterns
    const phoneRegexes = [
      /(\+91\s?[0-9]{4}\s?[0-9]{5})/g,                   // India: +91 7838 82147
      /(\+44\s?[0-9]{2,4}\s?[0-9]{3,4}\s?[0-9]{3,4})/g,  // UK: +44 20 1234 5678
      /(\+1\s?[0-9]{3}\s?[0-9]{3}\s?[0-9]{4})/g,         // US: +1 555 123 4567
      /(\+[0-9]{1,3}\s?[0-9]{4,5}\s?[0-9]{4,5})/g,       // International: +XX XXXX XXXX
      /(0[0-9]{2,4}\s?[0-9]{3,4}\s?[0-9]{3,4})/g,        // UK: 020 1234 5678
      /([0-9]{3}\s?[0-9]{3}\s?[0-9]{4})/g,               // US: 555 123 4567
      /(\([0-9]{2,4}\)\s?[0-9]{3,4}\s?[0-9]{3,4})/g,     // (020) 1234 5678
      /([0-9]{10,})/g,                                    // 10+ digits
      /(\+?[\d\s\-\(\)]{10,})/g                          // Original fallback
    ];
    
    let phone = '';
    let phoneMatch = null;
    
    // First, try to find phone numbers in the header area (first 500 characters)
    const headerText = cleanText.substring(0, 500);
    console.log('Searching header for phone numbers:', headerText);
    
    for (const regex of phoneRegexes) {
      const matches = headerText.match(regex);
      if (matches && matches.length > 0) {
        // Find the most likely phone number (longest match)
        phoneMatch = matches.reduce((longest, current) => 
          current.replace(/\D/g, '').length > longest.replace(/\D/g, '').length ? current : longest
        );
        console.log('Found phone in header:', phoneMatch);
        break;
      }
    }
    
    // If not found in header, search the full text
    if (!phoneMatch) {
      console.log('No phone found in header, searching full text...');
      for (const regex of phoneRegexes) {
        const matches = cleanText.match(regex);
        if (matches && matches.length > 0) {
          phoneMatch = matches.reduce((longest, current) => 
            current.replace(/\D/g, '').length > longest.replace(/\D/g, '').length ? current : longest
          );
          console.log('Found phone in full text:', phoneMatch);
          break;
        }
      }
    }
    
    phone = phoneMatch || '';
    
  // Enhanced job title and employer extraction from experience section
    let currentTitle = '';
    let currentEmployer = '';
    
    // Look for common experience section headers - prioritize "work experience"
    const experienceKeywords = ['work experience', 'professional experience', 'employment history', 'career history', 'experience', 'employment', 'work history', 'career'];
    let experienceStartIndex = -1;
    
    // First pass: look for exact "work experience" matches
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      if (line === 'work experience' || line === 'professional experience') {
        experienceStartIndex = i;
        console.log('Found exact experience section at line', i, ':', lines[i]);
        break;
      }
    }
    
    // Second pass: look for other experience section headers
    if (experienceStartIndex === -1) {
      for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.toLowerCase();
        const looksLikeHeader =
          !/^•/.test(rawLine) && // not a bullet point
          rawLine.length <= 40 &&
          !/[.,;:]/.test(rawLine) && // avoid sentences
          /experience|employment|career/.test(line);
        if (looksLikeHeader && experienceKeywords.some(keyword => line.includes(keyword))) {
          experienceStartIndex = i;
          console.log('Found experience section at line', i, ':', rawLine);
          break;
        }
      }
    }
    
    // If we found experience section, look for the first job entry
    if (experienceStartIndex !== -1) {
      for (let i = experienceStartIndex + 1; i < Math.min(experienceStartIndex + 10, lines.length); i++) {
        const line = lines[i];
        
        // Skip empty lines and section headers
        if (!line || line.length < 3) continue;
        
        // Look for job title patterns (usually at the start of a line)
        const jobTitlePatterns = [
          // Common job titles with specific endings
          /^([A-Z][a-zA-Z\s&/\-]+(?:Manager|Director|Coordinator|Specialist|Analyst|Consultant|Advisor|Officer|Executive|Lead|Head|Chief|Senior|Junior|Associate|Assistant|Intern|Trainee|Representative|Agent|Clerk|Developer|Engineer|Designer))/i,
          // Any capitalized word sequence that looks like a title
          /^([A-Z][a-zA-Z\s&/\-]{3,}(?:\s+[A-Z][a-zA-Z\s&/\-]*)*)/,
          // Simple pattern for any line that starts with capital and looks like a title
          /^([A-Z][a-zA-Z\s&/\-]{4,})/
        ];
        
        for (const pattern of jobTitlePatterns) {
          const match = line.match(pattern);
          if (match && match[1] && match[1].length > 3) {
            const potentialTitle = match[1].trim();
            
            // Filter out common non-title patterns
            const skipPatterns = [
              /^(Government|Westminster|European|Parliament|London|United|Kingdom|UK|England|Scotland|Wales|Northern|Ireland)$/i,
              /^(Address|Phone|Email|Contact|Location|Date|Time|Year|Month|Day)$/i,
              /^(Summary|Objective|Profile|About|Introduction)$/i,
              /^(Education|Qualifications|Skills|Languages|Certifications)$/i,
              /^(References|Referees|Contact|Details)$/i
            ];
            
            if (!skipPatterns.some(skipPattern => skipPattern.test(potentialTitle))) {
              currentTitle = potentialTitle;
              console.log('Found job title:', currentTitle);
              break;
            }
          }
        }
        
        if (currentTitle) break;
      }
      
      // Look for employer after finding title
      if (currentTitle) {
        for (let i = experienceStartIndex + 1; i < Math.min(experienceStartIndex + 15, lines.length); i++) {
          const line = lines[i];
          if (!line || line.length < 3) continue;
          
          // Look for company patterns
          const employerPatterns = [
            /^([A-Z][a-zA-Z\s&/\-]+(?:Ltd|Inc|Corp|Company|Group|Associates|Partners|LLC|LLP|Co\.|Corporation|Limited|Services|Consulting|Solutions|Systems|Technologies|International|Global|UK|USA|Europe|London|Manchester|Birmingham|Leeds|Glasgow|Edinburgh|Bristol|Liverpool|Newcastle|Sheffield|Nottingham|Leicester|Coventry|Bradford|Cardiff|Belfast|Derby|Plymouth|Southampton|Norwich|Wolverhampton|Swansea|Southend|Middlesbrough|Huddersfield|York|Ipswich|Blackpool|Bolton|Bournemouth|Brighton|Huddersfield|Hull|Milton Keynes|Reading|Slough|Stoke|Swindon|Watford|Wigan|Wolverhampton|York))/i,
            /^([A-Z][a-zA-Z\s&/\-]{3,}(?:\s+[A-Z][a-zA-Z\s&/\-]*)*)/,
            /^([A-Z][a-zA-Z\s&/\-]{4,})/
          ];
          
          for (const pattern of employerPatterns) {
            const match = line.match(pattern);
            if (match && match[1] && match[1].length > 3) {
              const potentialEmployer = match[1].trim();
              
              // Filter out common non-employer patterns
              const skipPatterns = [
                /^(Government|Westminster|European|Parliament|London|United|Kingdom|UK|England|Scotland|Wales|Northern|Ireland)$/i,
                /^(Address|Phone|Email|Contact|Location|Date|Time|Year|Month|Day)$/i,
                /^(Summary|Objective|Profile|About|Introduction)$/i,
                /^(Education|Qualifications|Skills|Languages|Certifications)$/i,
                /^(References|Referees|Contact|Details)$/i,
                /^(Manager|Director|Coordinator|Specialist|Analyst|Consultant|Advisor|Officer|Executive|Lead|Head|Chief|Senior|Junior|Associate|Assistant|Intern|Trainee|Representative|Agent|Clerk|Developer|Engineer|Designer)$/i
              ];
              
              if (!skipPatterns.some(skipPattern => skipPattern.test(potentialEmployer)) && 
                  potentialEmployer !== currentTitle) {
                currentEmployer = potentialEmployer;
                console.log('Found employer:', currentEmployer);
                break;
              }
            }
          }
          
          if (currentEmployer) break;
        }
      }
    }
    
  // Extract skills based on keyword matching
  const textLower = cleanText.toLowerCase();
    const skills = {
      communications: /communications?|comms?|media|press|pr|public relations|marketing/i.test(textLower),
      campaigns: /campaigns?|advocacy|engagement|grassroots|activism|outreach/i.test(textLower),
      policy: /policy|policies|briefing|consultation|legislative|regulatory|government/i.test(textLower),
      publicAffairs: /public affairs|government affairs|parliamentary|stakeholder relations|lobbying/i.test(textLower)
    };
    
    // Generate tags
    const tags = [];
    if (skills.communications) tags.push('communications');
    if (skills.campaigns) tags.push('campaigns');
    if (skills.policy) tags.push('policy');
    if (skills.publicAffairs) tags.push('public-affairs');
  
  // Calculate confidence based on text length and extracted data
  let confidence = Math.min(1, cleanText.length / 8000);
  if (firstName && lastName) confidence += 0.1;
  if (email) confidence += 0.1;
  if (phone) confidence += 0.05;
  if (currentTitle) confidence += 0.1;
  const skillCount = Object.values(skills).filter(Boolean).length;
  confidence += skillCount * 0.05;
  confidence = Math.min(confidence, 1.0);
    
    const parsedData = {
      firstName,
      lastName,
      email,
      phone,
      currentTitle,
      currentEmployer,
      skills,
      experience: currentTitle && currentEmployer ? [{
        title: currentTitle,
        employer: currentEmployer,
        startDate: '',
        endDate: ''
      }] : [],
      tags,
    notes: cleanText.substring(0, 200) + (cleanText.length > 200 ? '...' : ''),
    source: parserUsed,
    confidence: Math.round(confidence * 100) / 100
    };
    
    console.log('=== CV PARSING RESULT ===');
  console.log('Parser used:', parserUsed);
  console.log('Confidence:', confidence);
  console.log('Name:', `${firstName} ${lastName}`);
  console.log('Email:', email);
  console.log('Skills detected:', Object.keys(skills).filter(k => skills[k]));
    console.log('=== CV PARSING END ===');
    
    return parsedData;
}


// Send welcome email function
async function sendWelcomeEmail(candidateData, unsubscribeToken) {
  const unsubscribeUrl = `http://localhost:3002/unsubscribe/${unsubscribeToken}`;
  
  // Build skills summary
  let skillsSummary = '';
  if (candidateData.skills) {
    const skillEntries = [];
    const skillNames = {
      publicAffairs: 'Public Affairs',
      communications: 'Communications', 
      policy: 'Policy',
      campaigns: 'Campaign'
    };
    
    Object.entries(candidateData.skills).forEach(([key, value]) => {
      if (value && value > 0 && skillNames[key]) {
        skillEntries.push(`${skillNames[key]} (${value}/5)`);
      }
    });
    
    if (skillEntries.length > 0) {
      skillsSummary = `- **Skills we'll match on**: ${skillEntries.join(', ')}.`;
    }
  }
  
  // Build salary summary
  let salarySummary = '';
  if (candidateData.salaryMin && candidateData.salaryMax) {
    salarySummary = `- **We'll prioritise roles in the £${candidateData.salaryMin.toLocaleString()}–£${candidateData.salaryMax.toLocaleString()} range.**`;
  } else if (candidateData.salaryMin) {
    salarySummary = `- **We'll prioritise roles around £${candidateData.salaryMin.toLocaleString()}.**`;
  } else if (candidateData.salaryMax) {
    salarySummary = `- **We'll prioritise roles around £${candidateData.salaryMax.toLocaleString()}.**`;
  }
  
  const emailTemplate = `Subject: Welcome to Door 10 — what happens next

Hi ${candidateData.firstName},

Thanks for joining our candidate network. Here's how it works:
- **Your profile**: We've created a "CV Light" (no contact details) we use when exploring roles with clients.  
- **Opportunities**: We'll contact you when there's a close match on skills, sector and salary.  
${skillsSummary ? skillsSummary + '\n' : ''}${salarySummary ? salarySummary + '\n' : ''}- **Updates**: You can reply to this email to update salary, location or preferences.  
- **Privacy**: We never share your contact details without your say-so.  

If you'd rather not receive updates, you can opt out here: ${unsubscribeUrl}

Thanks,  
Door 10 Team`;

  // For now, we'll use the internal email endpoint
  // In a real implementation, you'd integrate with an email service
  try {
    const response = await fetch('http://localhost:3001/api/emails/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.JWT_SECRET || 'dev-token'}` // You might need to adjust this
      },
      body: JSON.stringify({
        to: candidateData.email,
        subject: 'Welcome to Door 10 — what happens next',
        body: emailTemplate,
        candidateIds: [candidateData.id]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Email send failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Email service unavailable, logging email locally:', error);
    // Log the email locally as a fallback
    console.log('Welcome email content:', emailTemplate);
  }
}

// POST /candidates - Create new candidate
router.post('/', upload.single('cv'), async (req, res) => {
  try {
    const id = generateId() || nanoid();
    const now = getCurrentTimestamp();

    const {
      firstName,
      lastName,
      email,
      phone,
      currentTitle,
      currentEmployer,
      salaryMin,
      salaryMax,
      seniority,
      tags = [],
      notes = '',
      skills = {},
      emailOk = true
    } = req.body;

    // Parse CV if uploaded
    let parsedData = null;
    if (req.file) {
      try {
        parsedData = await parseCVContent(req.file.path, req.file.mimetype);
      } catch (error) {
        console.log('CV parsing failed, using form data only');
      }
    }

    // Generate unsubscribe token
    const unsubscribeToken = nanoid(32);
    
    // Use parsed data if available, otherwise use form data
    const candidateData = {
      id,
      firstName: parsedData?.firstName || firstName || '',
      lastName: parsedData?.lastName || lastName || '',
      email: parsedData?.email || email || '',
      phone: parsedData?.phone || phone || '',
      currentTitle: parsedData?.currentTitle || currentTitle || '',
      currentEmployer: parsedData?.currentEmployer || currentEmployer || '',
      salaryMin: salaryMin ? Number(salaryMin) : null,
      salaryMax: salaryMax ? Number(salaryMax) : null,
      seniority: seniority || null,
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
      notes: notes || '',
      skills: {
        communications: Number(skills.communications || parsedData?.skills?.communications || 0),
        campaigns: Number(skills.campaigns || parsedData?.skills?.campaigns || 0),
        policy: Number(skills.policy || parsedData?.skills?.policy || 0),
        publicAffairs: Number(skills.publicAffairs || parsedData?.skills?.publicAffairs || 0)
      },
      cvPath: req.file ? req.file.path : null,
      emailOk: emailOk === true || emailOk === 'true',
      unsubscribeToken,
      createdAt: now,
      updatedAt: now
    };

    // Format data for database storage
    const formattedData = formatJsonFields(candidateData, ['tags', 'skills']);

    // Insert into database
    await execute(`
      INSERT INTO candidates (
        id, full_name, email, phone, current_title, current_employer,
        salary_min, salary_max, seniority, tags, notes, skills,
        cv_original_path, email_ok, unsubscribe_token, created_at, updated_at
      ) VALUES (@id, @full_name, @email, @phone, @current_title, @current_employer,
        @salary_min, @salary_max, @seniority, @tags, @notes, @skills,
        @cv_original_path, @email_ok, @unsubscribe_token, @created_at, @updated_at)
    `, {
      id: formattedData.id,
      full_name: `${formattedData.firstName} ${formattedData.lastName}`.trim(),
      email: formattedData.email,
      phone: formattedData.phone,
      current_title: formattedData.currentTitle,
      current_employer: formattedData.currentEmployer,
      salary_min: formattedData.salaryMin,
      salary_max: formattedData.salaryMax,
      seniority: formattedData.seniority,
      tags: formattedData.tags,
      notes: formattedData.notes,
      skills: formattedData.skills,
      cv_original_path: formattedData.cvPath,
      email_ok: formattedData.emailOk ? 1 : 0,
      unsubscribe_token: formattedData.unsubscribeToken,
      created_at: formattedData.createdAt,
      updated_at: formattedData.updatedAt
    });

    // Send welcome email if email is provided and email_ok is true
    if (candidateData.email && candidateData.emailOk) {
      try {
        // Prepare full candidate data for email
        const emailCandidateData = {
          ...candidateData,
          skills: candidateData.skills,
          salaryMin: candidateData.salaryMin,
          salaryMax: candidateData.salaryMax
        };
        
        await sendWelcomeEmail(emailCandidateData, unsubscribeToken);
        
        // Update welcome_sent_at timestamp
        await execute('UPDATE candidates SET welcome_sent_at = @welcome_sent_at WHERE id = @id', {
          welcome_sent_at: now,
          id: id
        });
        
        console.log('Welcome email sent to:', candidateData.email);
      } catch (error) {
        console.error('Failed to send welcome email:', error);
        // Don't fail the candidate creation if email fails
      }
    }

    console.log('Candidate created successfully:', id);
    res.status(201).json({ 
      success: true, 
      id,
      message: 'Candidate created successfully'
    });

  } catch (error) {
    console.error('Error creating candidate:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create candidate',
      details: error.message 
    });
  }
});

// POST /candidates/parse-cv - Parse CV without creating candidate
router.post('/parse-cv', upload.single('file'), async (req, res) => {
  try {
    console.log('=== CV PARSE ENDPOINT HIT ===');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ 
        error: { 
          code: 'NO_FILE', 
          message: 'No file uploaded' 
        } 
      });
    }

    console.log('Calling parseCVContent...');
    const parsedData = await parseCVContent(req.file.path, req.file.mimetype);
    console.log('parseCVContent returned:', parsedData);
    
    res.json({ success: true, data: parsedData });
    console.log('=== CV PARSE ENDPOINT END ===');

  } catch (error) {
    console.error('=== CV PARSE ENDPOINT ERROR ===');
    console.error('Error parsing CV:', error);
    
    // Handle multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: { 
          code: 'FILE_TOO_LARGE', 
          message: 'File too large. Please upload files smaller than 20MB.' 
        } 
      });
    }
    
    if (error.message.includes('Unsupported file type')) {
      return res.status(400).json({ 
        error: { 
          code: 'UNSUPPORTED_TYPE', 
          message: error.message 
        } 
      });
    }
    
    // Handle parsing errors with 422 status
    if (error.message.includes('Could not extract text') || 
        error.message.includes('Supported formats')) {
      return res.status(422).json({ 
      success: false, 
      error: { 
        code: 'PARSE_FAILED', 
          message: error.message,
          details: 'Please try uploading a different file format (TXT, PDF, or DOCX)'
        }
      });
    }
    
    // Handle other errors with 500 status
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'An unexpected error occurred while processing the file' 
      },
      details: error.message 
    });
    console.log('=== CV PARSE ENDPOINT END ===');
  }
});

// GET /candidates - List candidates with advanced filters
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      tags, 
      salaryMin, 
      salaryMax, 
      skills, 
      mode = 'AND', 
      page = 1, 
      limit = 50 
    } = req.query;

    let sql = 'SELECT * FROM candidates';
    const conditions = [];
    const params = {};

    if (search) {
      conditions.push('(full_name LIKE @search OR notes LIKE @search OR current_title LIKE @search OR current_employer LIKE @search)');
      params.search = `%${search}%`;
    }

    if (tags) {
      const tagList = Array.isArray(tags) ? tags : tags.split(',');
      if (tagList.length > 0) {
        if (mode === 'AND') {
          // All tags must be present
          const tagConditions = tagList.map((tag, index) => `tags LIKE @tag${index}`);
          conditions.push(`(${tagConditions.join(' AND ')})`);
          tagList.forEach((tag, index) => {
            params[`tag${index}`] = `%"${tag}"%`;
          });
        } else {
          // Any tag can be present (OR mode)
          const tagConditions = tagList.map((tag, index) => `tags LIKE @tag${index}`);
          conditions.push(`(${tagConditions.join(' OR ')})`);
          tagList.forEach((tag, index) => {
            params[`tag${index}`] = `%"${tag}"%`;
          });
        }
      }
    }

    if (salaryMin) {
      conditions.push('(salary_min >= @salaryMin OR salary_max >= @salaryMin)');
      params.salaryMin = Number(salaryMin);
    }

    if (salaryMax) {
      conditions.push('(salary_max <= @salaryMax OR salary_min <= @salaryMax)');
      params.salaryMax = Number(salaryMax);
    }

    if (skills) {
      const skillList = Array.isArray(skills) ? skills : skills.split(',');
      if (skillList.length > 0) {
        const skillConditions = skillList.map((skill, index) => {
          const skillKey = skill.toLowerCase().replace(/\s+/g, '');
          return `JSON_EXTRACT(skills, '$.${skillKey}') >= @skill${index}`;
        });
        conditions.push(`(${skillConditions.join(' AND ')})`);
        skillList.forEach((skill, index) => {
          params[`skill${index}`] = 3;
        });
      }
    }

    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    // Get total count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await queryOne(countSql, params);
    const total = countResult ? countResult.count : 0;

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' ORDER BY updated_at DESC LIMIT @limit OFFSET @offset';
    params.limit = parseInt(limit);
    params.offset = offset;

    const candidates = await queryAll(sql, params);
    
    // Ensure candidates is an array
    const candidatesArray = Array.isArray(candidates) ? candidates : [];

    // Parse JSON fields and filter out null candidates
    const parsedCandidates = candidatesArray
      .filter(candidate => candidate !== null)
      .map(candidate => parseJsonFields(candidate, ['tags', 'skills']));

    res.json({
      success: true,
      candidates: parsedCandidates,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });

  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch candidates',
      details: error.message 
    });
  }
});

// GET /candidates/:id - Get single candidate
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const candidate = await queryOne('SELECT * FROM candidates WHERE id = @id', { id });
    
    if (!candidate) {
      return res.status(404).json({ 
        success: false, 
        error: 'Candidate not found' 
      });
    }

    // Parse JSON fields
    const parsedCandidate = parseJsonFields(candidate, ['tags', 'skills']);

    res.json({ success: true, candidate: parsedCandidate });

  } catch (error) {
    console.error('Error fetching candidate:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch candidate',
      details: error.message 
    });
  }
});

// PATCH /candidates/:id - Update candidate
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const now = getCurrentTimestamp();

    const candidate = await queryOne('SELECT * FROM candidates WHERE id = @id', { id });
    if (!candidate) {
      return res.status(404).json({ 
        success: false, 
        error: 'Candidate not found' 
      });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      currentTitle,
      currentEmployer,
      salaryMin,
      salaryMax,
      seniority,
      tags,
      notes,
      skills
    } = req.body;

    // Merge with existing data
    const updatedData = {
      full_name: `${firstName || ''} ${lastName || ''}`.trim() || candidate.full_name,
      email: email !== undefined ? email : candidate.email,
      phone: phone !== undefined ? phone : candidate.phone,
      current_title: currentTitle !== undefined ? currentTitle : candidate.current_title,
      current_employer: currentEmployer !== undefined ? currentEmployer : candidate.current_employer,
      salary_min: salaryMin !== undefined ? (salaryMin ? Number(salaryMin) : null) : candidate.salary_min,
      salary_max: salaryMax !== undefined ? (salaryMax ? Number(salaryMax) : null) : candidate.salary_max,
      seniority: seniority !== undefined ? seniority : candidate.seniority,
      tags: tags !== undefined ? (Array.isArray(tags) ? tags : []) : candidate.tags,
      notes: notes !== undefined ? notes : candidate.notes,
      skills: skills !== undefined ? skills : candidate.skills,
      updated_at: now
    };

    // Format JSON fields for database storage
    const formattedData = formatJsonFields(updatedData, ['tags', 'skills']);

    await execute(`
      UPDATE candidates SET
        full_name = @full_name, email = @email, phone = @phone, current_title = @current_title, current_employer = @current_employer,
        salary_min = @salary_min, salary_max = @salary_max, seniority = @seniority, tags = @tags, notes = @notes, skills = @skills, updated_at = @updated_at
      WHERE id = @id
    `, {
      full_name: formattedData.full_name,
      email: formattedData.email,
      phone: formattedData.phone,
      current_title: formattedData.current_title,
      current_employer: formattedData.current_employer,
      salary_min: formattedData.salary_min,
      salary_max: formattedData.salary_max,
      seniority: formattedData.seniority,
      tags: formattedData.tags,
      notes: formattedData.notes,
      skills: formattedData.skills,
      updated_at: formattedData.updated_at,
      id: id
    });

    res.json({ success: true, message: 'Candidate updated successfully' });

  } catch (error) {
    console.error('Error updating candidate:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update candidate',
      details: error.message 
    });
  }
});

// DELETE /candidates/:id - Delete candidate
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const candidate = await queryOne('SELECT * FROM candidates WHERE id = @id', { id });
    if (!candidate) {
      return res.status(404).json({ 
        success: false, 
        error: 'Candidate not found' 
      });
    }

    await execute('DELETE FROM candidates WHERE id = @id', { id });

    res.json({ success: true, message: 'Candidate deleted successfully' });

  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete candidate',
      details: error.message 
    });
  }
});

// Helper function to normalize column names
function normalizeColumnName(name) {
  return name.toLowerCase().trim().replace(/[_\s-]+/g, ' ');
}

// Helper function to check if a value indicates a skill (binary)
function hasSkill(value) {
  if (!value) return false;
  const normalized = value.toString().toLowerCase().trim();
  return normalized === 'x' || normalized === 'true' || normalized === '1' || normalized === 'yes';
}

// Helper function to parse salary value
function parseSalary(value) {
  if (!value || value.toString().trim() === '') return null;
  
  // Remove common currency symbols and formatting
  const cleaned = value.toString().replace(/[£$,]/g, '').trim();
  const parsed = parseInt(cleaned);
  
  return isNaN(parsed) ? null : parsed;
}

// Helper function to validate email
function isValidEmail(email) {
  if (!email || email.trim() === '') return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

// POST /candidates/import - Preview CSV import
router.post('/import', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const results = [];
    const errors = [];
    let rowIndex = 0;
    let headers = [];

    await new Promise((resolve, reject) => {
      createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => {
          rowIndex++;
          
          // Get headers on first row
          if (rowIndex === 1) {
            headers = Object.keys(row);
          }

          // Normalize column names for mapping
          const normalizedRow = {};
          Object.keys(row).forEach(key => {
            normalizedRow[normalizeColumnName(key)] = row[key];
          });

          const candidate = {
            row: rowIndex,
            firstName: (normalizedRow['first name'] || '').trim(),
            lastName: (normalizedRow['last name'] || '').trim(),
            email: (normalizedRow['email'] || '').trim(),
            phone: (normalizedRow['phone'] || '').trim(),
            currentTitle: (normalizedRow['current title'] || '').trim(),
            currentEmployer: (normalizedRow['current employer'] || '').trim(),
            salaryMin: parseSalary(normalizedRow['salary min']),
            salaryMax: parseSalary(normalizedRow['salary max']),
            seniority: (normalizedRow['seniority'] || '').trim(),
            tags: normalizedRow['tags'] ? normalizedRow['tags'].split(',').map(t => t.trim()).filter(t => t) : [],
            notes: (normalizedRow['notes'] || '').trim(),
            skills: {
              communications: hasSkill(normalizedRow['communications']),
              campaigns: hasSkill(normalizedRow['campaigns']),
              policy: hasSkill(normalizedRow['policy']),
              publicAffairs: hasSkill(normalizedRow['public affairs'])
            }
          };

          // Validate required fields and business rules
          const rowErrors = [];
          
          if (!candidate.firstName) rowErrors.push('First name is required');
          if (!candidate.lastName) rowErrors.push('Last name is required');
          
          if (!isValidEmail(candidate.email)) {
            rowErrors.push('Invalid email format');
          }
          
          // Validate salary ranges
          if (candidate.salaryMin !== null && candidate.salaryMax !== null) {
            if (candidate.salaryMin > candidate.salaryMax) {
              rowErrors.push('Salary min cannot be greater than salary max');
            }
          }
          
          // Check for invalid salary values
          if (normalizedRow['salary min'] && candidate.salaryMin === null) {
            rowErrors.push('Salary min must be a valid number');
          }
          if (normalizedRow['salary max'] && candidate.salaryMax === null) {
            rowErrors.push('Salary max must be a valid number');
          }

          if (rowErrors.length > 0) {
            errors.push({
              row: rowIndex,
              errors: rowErrors,
              data: candidate
            });
          } else {
            results.push(candidate);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    res.json({
      success: true,
      preview: results.slice(0, 10), // Show first 10 rows
      totalRows: results.length + errors.length,
      validRows: results.length,
      errorRows: errors.length,
      errors: errors.slice(0, 10), // Show first 10 errors
      fileId: req.file.filename,
      headers: headers
    });

  } catch (error) {
    console.error('Error processing CSV:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process CSV file',
      details: error.message 
    });
  }
});

// POST /candidates/import/commit - Commit CSV import
router.post('/import/commit', async (req, res) => {
  try {
    const { fileId, mapping } = req.body;
    
    if (!fileId) {
      return res.status(400).json({ error: 'File ID required' });
    }

    const filePath = join(uploadDir, fileId);
    const results = [];
    const errors = [];
    let rowIndex = 0;

    await new Promise((resolve, reject) => {
      createReadStream(filePath)
        .pipe(csv())
        .on('data', async (row) => {
          rowIndex++;
          
          // Normalize column names for mapping
          const normalizedRow = {};
          Object.keys(row).forEach(key => {
            normalizedRow[normalizeColumnName(key)] = row[key];
          });

          const candidate = {
            firstName: (row[mapping.firstName] || '').trim(),
            lastName: (row[mapping.lastName] || '').trim(),
            email: (row[mapping.email] || '').trim(),
            phone: (row[mapping.phone] || '').trim(),
            currentTitle: (row[mapping.currentTitle] || '').trim(),
            currentEmployer: (row[mapping.currentEmployer] || '').trim(),
            salaryMin: parseSalary(row[mapping.salaryMin]),
            salaryMax: parseSalary(row[mapping.salaryMax]),
            seniority: (row[mapping.seniority] || '').trim(),
            tags: row[mapping.tags] ? row[mapping.tags].split(',').map(t => t.trim()).filter(t => t) : [],
            notes: (row[mapping.notes] || '').trim(),
            skills: {
              communications: hasSkill(row[mapping.communications]),
              campaigns: hasSkill(row[mapping.campaigns]),
              policy: hasSkill(row[mapping.policy]),
              publicAffairs: hasSkill(row[mapping.publicAffairs])
            }
          };

          // Validate required fields
          if (!candidate.firstName || !candidate.lastName) {
            errors.push({
              row: rowIndex,
              errors: ['First name and last name are required'],
              data: candidate
            });
            return;
          }

          try {
            const id = generateId() || nanoid();
            const now = getCurrentTimestamp();

            // Format data for database storage
            const formattedData = formatJsonFields(candidate, ['tags', 'skills']);

            await execute(`
              INSERT INTO candidates (
                id, full_name, email, phone, current_title, current_employer,
                salary_min, salary_max, seniority, tags, notes, skills,
                created_at, updated_at
              ) VALUES (@id, @full_name, @email, @phone, @current_title, @current_employer,
                @salary_min, @salary_max, @seniority, @tags, @notes, @skills,
                @created_at, @updated_at)
            `, {
              id: id,
              full_name: `${candidate.firstName} ${candidate.lastName}`.trim(),
              email: candidate.email,
              phone: candidate.phone,
              current_title: candidate.currentTitle,
              current_employer: candidate.currentEmployer,
              salary_min: candidate.salaryMin,
              salary_max: candidate.salaryMax,
              seniority: candidate.seniority,
              tags: formattedData.tags,
              notes: candidate.notes,
              skills: formattedData.skills,
              created_at: now,
              updated_at: now
            });

            results.push({ id, ...candidate });
          } catch (dbError) {
            errors.push({
              row: rowIndex,
              errors: [dbError.message],
              data: candidate
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    res.json({
      success: true,
      imported: results.length,
      errors: errors.length,
      candidates: results,
      errorDetails: errors
    });

  } catch (error) {
    console.error('Error committing CSV import:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to commit CSV import',
      details: error.message 
    });
  }
});

// GET /unsubscribe/:token - Unsubscribe candidate from emails
router.get('/unsubscribe/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find candidate by unsubscribe token
    const candidate = await queryOne('SELECT id, full_name FROM candidates WHERE unsubscribe_token = @token', { token });
    
    if (!candidate) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Unsubscribe - Door 10</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: #dc3545; }
          </style>
        </head>
        <body>
          <h1>Unsubscribe Link Invalid</h1>
          <p class="error">This unsubscribe link is invalid or has expired.</p>
          <p>If you continue to receive emails, please contact us directly.</p>
        </body>
        </html>
      `);
    }
    
    // Update email_ok to false
    await execute('UPDATE candidates SET email_ok = 0 WHERE unsubscribe_token = @token', { token });
    
    console.log('Candidate unsubscribed:', candidate.full_name, candidate.id);
    
    // Return confirmation page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed - Door 10</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .success { color: #28a745; }
          .info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>You're Unsubscribed</h1>
        <p class="success">You will no longer receive updates from Door 10.</p>
        <div class="info">
          <p><strong>What this means:</strong></p>
          <ul>
            <li>You won't receive job opportunity emails</li>
            <li>You won't receive updates about your profile</li>
            <li>Your profile remains in our system for potential matches</li>
          </ul>
        </div>
        <p>If you change your mind, you can contact us to re-subscribe.</p>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error - Door 10</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { color: #dc3545; }
        </style>
      </head>
      <body>
        <h1>Error</h1>
        <p class="error">There was an error processing your unsubscribe request.</p>
        <p>Please try again later or contact us directly.</p>
      </body>
      </html>
    `);
  }
});

// PATCH /candidates/:id/email-preferences - Update candidate email preferences
router.patch('/:id/email-preferences', async (req, res) => {
  try {
    const { id } = req.params;
    const { email_ok } = req.body;
    
    if (typeof email_ok !== 'boolean') {
      return res.status(400).json({ error: 'email_ok must be a boolean' });
    }
    
    const now = getCurrentTimestamp();
    
    await execute('UPDATE candidates SET email_ok = @email_ok, updated_at = @updated_at WHERE id = @id', {
      email_ok: email_ok ? 1 : 0,
      updated_at: now,
      id: id
    });
    
    // Get updated candidate
    const candidate = await queryOne('SELECT * FROM candidates WHERE id = @id', { id });
    
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    // Parse JSON fields
    const parsedCandidate = parseJsonFields(candidate, ['tags', 'skills']);
    parsedCandidate.email_ok = Boolean(candidate.email_ok);
    
    res.json(parsedCandidate);
    
  } catch (error) {
    console.error('Error updating candidate email preferences:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update email preferences',
      details: error.message 
    });
  }
});

// POST /candidates/:id/resend-welcome - Resend welcome email
router.post('/:id/resend-welcome', async (req, res) => {
  try {
    const { id } = req.params;
    
    const candidate = await queryOne('SELECT * FROM candidates WHERE id = @id', { id });
    
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    if (!candidate.email) {
      return res.status(400).json({ error: 'Candidate has no email address' });
    }
    
    if (!candidate.email_ok) {
      return res.status(400).json({ error: 'Candidate has opted out of emails' });
    }
    
    // Parse candidate data
    const parsedCandidate = parseJsonFields(candidate, ['tags', 'skills']);
    const skills = parsedCandidate.skills;
    const candidateData = {
      id: candidate.id,
      firstName: candidate.full_name.split(' ')[0] || '',
      lastName: candidate.full_name.split(' ').slice(1).join(' ') || '',
      email: candidate.email,
      skills: skills,
      salaryMin: candidate.salary_min,
      salaryMax: candidate.salary_max
    };
    
    // Send welcome email
    await sendWelcomeEmail(candidateData, candidate.unsubscribe_token);
    
    // Update welcome_sent_at timestamp
    const now = getCurrentTimestamp();
    await execute('UPDATE candidates SET welcome_sent_at = @welcome_sent_at, updated_at = @updated_at WHERE id = @id', {
      welcome_sent_at: now,
      updated_at: now,
      id: id
    });
    
    console.log('Welcome email resent to:', candidate.email);
    
    res.json({ 
      success: true, 
      message: 'Welcome email sent successfully' 
    });
    
  } catch (error) {
    console.error('Error resending welcome email:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to resend welcome email',
      details: error.message 
    });
  }
});

export default router;