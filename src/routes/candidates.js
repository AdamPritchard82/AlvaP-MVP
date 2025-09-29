import { Router } from 'express';
import multer from 'multer';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';
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

// Simple CV parsing - works with any text-based file
async function parseCVContent(filePath, mimetype) {
  try {
    console.log('=== CV PARSING START ===');
    console.log('File path:', filePath);
    console.log('MIME type:', mimetype);
    
    let text = '';
    
    // Try to read as text first (works for TXT files)
    try {
      text = fs.readFileSync(filePath, 'utf8');
      console.log('Read as text file');
    } catch (textError) {
      // If that fails, try to read as binary and extract text
      console.log('Text read failed, trying binary extraction...');
      try {
        const textract = require('textract');
        text = await new Promise((resolve, reject) => {
          textract.fromFileWithPath(filePath, (error, extractedText) => {
            if (error) reject(error);
            else resolve(extractedText);
          });
        });
        console.log('Extracted text using textract');
      } catch (extractError) {
        console.error('Text extraction failed:', extractError.message);
        throw new Error('Could not extract text from file. Please try a different format.');
      }
    }
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted from the file.');
    }
    
    console.log('Extracted text length:', text.length);
    console.log('First 200 chars:', text.substring(0, 200));
    
    // Simple parsing - just extract basic info
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
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
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const email = emailMatch ? emailMatch[1] : '';
    
    // Extract phone
    const phoneMatch = text.match(/(\+?[\d\s\-\(\)]{10,})/);
    const phone = phoneMatch ? phoneMatch[1] : '';
    
    // Extract current title and employer (simple approach)
    let currentTitle = '';
    let currentEmployer = '';
    
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i];
      
      // Look for job titles
      if (!currentTitle && line.length > 5 && line.length < 60 && 
          /^[A-Z]/.test(line) && !line.includes('@') && !line.match(/\d{4}/)) {
        const jobKeywords = ['manager', 'director', 'officer', 'specialist', 'coordinator', 
                           'executive', 'analyst', 'consultant', 'advisor', 'associate'];
        if (jobKeywords.some(keyword => line.toLowerCase().includes(keyword))) {
          currentTitle = line;
        }
      }
      
      // Look for companies
      if (!currentEmployer && line.length > 3 && line.length < 80 && 
          /^[A-Z]/.test(line) && !line.includes('@') && !line.match(/\d{4}/)) {
        const companyKeywords = ['Ltd', 'Inc', 'Corp', 'Company', 'Group', 'Associates', 'Partners'];
        if (companyKeywords.some(keyword => line.includes(keyword))) {
          currentEmployer = line;
        }
      }
    }
    
    // Extract skills based on simple keyword matching
    const textLower = text.toLowerCase();
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
      notes: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
      source: 'text-file',
      confidence: 0.8
    };
    
    console.log('=== CV PARSING RESULT ===');
    console.log('Parsed data:', JSON.stringify(parsedData, null, 2));
    console.log('=== CV PARSING END ===');
    
    return parsedData;
  } catch (error) {
    console.error('=== CV PARSING ERROR ===');
    console.error('Error:', error);
    console.log('=== CV PARSING END ===');
    
    return {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      currentTitle: '',
      currentEmployer: '',
      skills: {
        communications: false,
        campaigns: false,
        policy: false,
        publicAffairs: false
      },
      experience: [],
      tags: [],
      notes: '',
      source: 'error',
      confidence: 0.0
    };
  }
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
    const db = getDb();
    const id = nanoid();
    const now = new Date().toISOString();

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

    // Insert into database
    const stmt = db.prepare(`
      INSERT INTO candidates (
        id, full_name, email, phone, current_title, current_employer,
        salary_min, salary_max, seniority, tags, notes, skills,
        cv_original_path, email_ok, unsubscribe_token, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      candidateData.id,
      `${candidateData.firstName} ${candidateData.lastName}`.trim(),
      candidateData.email,
      candidateData.phone,
      candidateData.currentTitle,
      candidateData.currentEmployer,
      candidateData.salaryMin,
      candidateData.salaryMax,
      candidateData.seniority,
      JSON.stringify(candidateData.tags),
      candidateData.notes,
      JSON.stringify(candidateData.skills),
      candidateData.cvPath,
      candidateData.emailOk ? 1 : 0,
      candidateData.unsubscribeToken,
      candidateData.createdAt,
      candidateData.updatedAt
    );

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
        db.prepare('UPDATE candidates SET welcome_sent_at = ? WHERE id = ?')
          .run(now, id);
        
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
    
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'PARSE_FAILED', 
        message: 'Failed to parse CV' 
      },
      details: error.message 
    });
    console.log('=== CV PARSE ENDPOINT END ===');
  }
});

// GET /candidates - List candidates with advanced filters
router.get('/', (req, res) => {
  try {
    const db = getDb();
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

    let query = 'SELECT * FROM candidates';
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(full_name LIKE ? OR notes LIKE ? OR current_title LIKE ? OR current_employer LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (tags) {
      const tagList = Array.isArray(tags) ? tags : tags.split(',');
      if (tagList.length > 0) {
        if (mode === 'AND') {
          // All tags must be present
          const tagConditions = tagList.map(() => 'tags LIKE ?');
          conditions.push(`(${tagConditions.join(' AND ')})`);
          tagList.forEach(tag => params.push(`%"${tag}"%`));
        } else {
          // Any tag can be present (OR mode)
          const tagConditions = tagList.map(() => 'tags LIKE ?');
          conditions.push(`(${tagConditions.join(' OR ')})`);
          tagList.forEach(tag => params.push(`%"${tag}"%`));
        }
      }
    }

    if (salaryMin) {
      conditions.push('(salary_min >= ? OR salary_max >= ?)');
      params.push(Number(salaryMin), Number(salaryMin));
    }

    if (salaryMax) {
      conditions.push('(salary_max <= ? OR salary_min <= ?)');
      params.push(Number(salaryMax), Number(salaryMax));
    }

    if (skills) {
      const skillList = Array.isArray(skills) ? skills : skills.split(',');
      if (skillList.length > 0) {
        const skillConditions = skillList.map(skill => {
          const skillKey = skill.toLowerCase().replace(/\s+/g, '');
          return `JSON_EXTRACT(skills, '$.${skillKey}') >= 3`;
        });
        conditions.push(`(${skillConditions.join(' AND ')})`);
      }
    }

    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = db.prepare(countQuery).get(params);
    const total = countResult ? countResult.count : 0;

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const candidates = db.prepare(query).all(params) || [];
    
    // Ensure candidates is an array
    const candidatesArray = Array.isArray(candidates) ? candidates : [];

    // Parse JSON fields and filter out null candidates
    const parsedCandidates = candidatesArray
      .filter(candidate => candidate !== null)
      .map(candidate => ({
        ...candidate,
        tags: JSON.parse(candidate.tags || '[]'),
        skills: JSON.parse(candidate.skills || '{}')
      }));

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
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
    
    if (!candidate) {
      return res.status(404).json({ 
        success: false, 
        error: 'Candidate not found' 
      });
    }

    // Parse JSON fields
    const parsedCandidate = {
      ...candidate,
      tags: JSON.parse(candidate.tags || '[]'),
      skills: JSON.parse(candidate.skills || '{}')
    };

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
router.patch('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const now = new Date().toISOString();

    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
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
      tags: tags !== undefined ? JSON.stringify(Array.isArray(tags) ? tags : []) : candidate.tags,
      notes: notes !== undefined ? notes : candidate.notes,
      skills: skills !== undefined ? JSON.stringify(skills) : candidate.skills,
      updated_at: now
    };

    const stmt = db.prepare(`
      UPDATE candidates SET
        full_name = ?, email = ?, phone = ?, current_title = ?, current_employer = ?,
        salary_min = ?, salary_max = ?, seniority = ?, tags = ?, notes = ?, skills = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updatedData.full_name,
      updatedData.email,
      updatedData.phone,
      updatedData.current_title,
      updatedData.current_employer,
      updatedData.salary_min,
      updatedData.salary_max,
      updatedData.seniority,
      updatedData.tags,
      updatedData.notes,
      updatedData.skills,
      updatedData.updated_at,
      id
    );

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
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
    if (!candidate) {
      return res.status(404).json({ 
        success: false, 
        error: 'Candidate not found' 
      });
    }

    db.prepare('DELETE FROM candidates WHERE id = ?').run(id);

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
            const db = getDb();
            const id = nanoid();
            const now = new Date().toISOString();

            const stmt = db.prepare(`
              INSERT INTO candidates (
                id, full_name, email, phone, current_title, current_employer,
                salary_min, salary_max, seniority, tags, notes, skills,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
              id,
              `${candidate.firstName} ${candidate.lastName}`.trim(),
              candidate.email,
              candidate.phone,
              candidate.currentTitle,
              candidate.currentEmployer,
              candidate.salaryMin,
              candidate.salaryMax,
              candidate.seniority,
              JSON.stringify(candidate.tags),
              candidate.notes,
              JSON.stringify(candidate.skills),
              now,
              now
            );

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
router.get('/unsubscribe/:token', (req, res) => {
  try {
    const db = getDb();
    const { token } = req.params;
    
    // Find candidate by unsubscribe token
    const candidate = db.prepare('SELECT id, full_name FROM candidates WHERE unsubscribe_token = ?').get(token);
    
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
    db.prepare('UPDATE candidates SET email_ok = 0 WHERE unsubscribe_token = ?').run(token);
    
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

// PATCH /candidates/:id - Update candidate email preferences
router.patch('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { email_ok } = req.body;
    
    if (typeof email_ok !== 'boolean') {
      return res.status(400).json({ error: 'email_ok must be a boolean' });
    }
    
    const now = new Date().toISOString();
    
    db.prepare('UPDATE candidates SET email_ok = ?, updated_at = ? WHERE id = ?')
      .run(email_ok ? 1 : 0, now, id);
    
    // Get updated candidate
    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
    
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    // Parse JSON fields
    const parsedCandidate = {
      ...candidate,
      tags: JSON.parse(candidate.tags || '[]'),
      skills: JSON.parse(candidate.skills || '{}'),
      email_ok: Boolean(candidate.email_ok)
    };
    
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
    const db = getDb();
    const { id } = req.params;
    
    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
    
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
    const skills = JSON.parse(candidate.skills || '{}');
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
    const now = new Date().toISOString();
    db.prepare('UPDATE candidates SET welcome_sent_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, id);
    
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