import { Router } from 'express';
import multer from 'multer';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';
import { SimpleEnhancedCvParser } from '../parsers/simpleEnhancedCvParser.js';

const router = Router();

// Set up file upload
const uploadDir = join(process.cwd(), '..', 'data', 'uploads');
mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(), // Store in memory for parsing
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload PDF, DOCX, or TXT files.'), false);
    }
  }
});

// POST /api/candidates/parse-cv - Parse CV file
// TODO: Add authentication requirement in production
router.post('/parse-cv', upload.single('file'), async (req, res) => {
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

    // Parse the file buffer with error handling
    let parsedData;
    try {
      const parser = new SimpleEnhancedCvParser();
      parsedData = await parser.parseFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    } catch (parseError) {
      console.error('Parse buffer error:', parseError);
      return res.status(422).json({ 
        success: false, 
        error: { 
          code: 'PARSE_FAILED', 
          message: 'Could not extract text from the uploaded file',
          details: parseError.message
        }
      });
    }
    
    // Check if parsing failed (low confidence, error source, etc.)
    if (parsedData.source === 'error' || parsedData.confidence < 0.1) {
      return res.status(422).json({ 
        success: false, 
        error: { 
          code: 'PARSE_FAILED', 
          message: 'Could not extract meaningful content from the file',
          details: parsedData.notes || 'Unknown parsing error'
        }
      });
    }
    
    res.json({ 
      success: true, 
      data: parsedData 
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

// POST /api/candidates - Create candidate
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const id = nanoid();
    const now = new Date().toISOString();

    const {
      firstName,
      lastName,
      email,
      phone,
      salaryMin,
      salaryMax,
      skills = {},
      tags = [],
      notes = '',
      emailOk = true
    } = req.body;

    // Generate unsubscribe token
    const unsubscribeToken = nanoid(32);
    
    const candidateData = {
      id,
      firstName: firstName || '',
      lastName: lastName || '',
      email: email || '',
      phone: phone || '',
      salaryMin: salaryMin ? Number(salaryMin) : null,
      salaryMax: salaryMax ? Number(salaryMax) : null,
      skills: {
        communications: Boolean(skills.communications),
        campaigns: Boolean(skills.campaigns),
        policy: Boolean(skills.policy),
        publicAffairs: Boolean(skills.publicAffairs)
      },
      tags: Array.isArray(tags) ? tags : [],
      notes: notes || '',
      emailOk: Boolean(emailOk),
      unsubscribeToken,
      createdAt: now,
      updatedAt: now
    };

    // Insert into database
    const stmt = db.prepare(`
      INSERT INTO candidates (
        id, full_name, email, phone, salary_min, salary_max, skills,
        tags, notes, email_ok, unsubscribe_token, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      candidateData.id,
      `${candidateData.firstName} ${candidateData.lastName}`.trim(),
      candidateData.email,
      candidateData.phone,
      candidateData.salaryMin,
      candidateData.salaryMax,
      JSON.stringify(candidateData.skills),
      JSON.stringify(candidateData.tags),
      candidateData.notes,
      candidateData.emailOk ? 1 : 0,
      candidateData.unsubscribeToken,
      candidateData.createdAt,
      candidateData.updatedAt
    );

    res.status(201).json({ 
      success: true, 
      id: candidateData.id,
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

// GET /api/candidates - List candidates with filters
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { 
      q, 
      salaryMin, 
      salaryMax, 
      skills, 
      tags,
      mode = 'OR', 
      page = 1, 
      pageSize = 50 
    } = req.query;

    let query = 'SELECT * FROM candidates';
    const conditions = [];
    const params = [];

    // Search query
    if (q) {
      conditions.push('(full_name LIKE ? OR email LIKE ? OR notes LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    // Salary filters
    if (salaryMin) {
      conditions.push('(salary_min >= ? OR salary_max >= ?)');
      params.push(Number(salaryMin), Number(salaryMin));
    }

    if (salaryMax) {
      conditions.push('(salary_max <= ? OR salary_min <= ?)');
      params.push(Number(salaryMax), Number(salaryMax));
    }

    // Skills filter
    if (skills) {
      const skillList = Array.isArray(skills) ? skills : skills.split(',');
      if (skillList.length > 0) {
        const skillConditions = skillList.map(skill => {
          return `JSON_EXTRACT(skills, '$.${skill}') = 1`;
        });
        conditions.push(`(${skillConditions.join(' AND ')})`);
      }
    }

    // Tags filter
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : tags.split(',');
      if (tagList.length > 0) {
        if (mode === 'AND') {
          const tagConditions = tagList.map(() => 'tags LIKE ?');
          conditions.push(`(${tagConditions.join(' AND ')})`);
          tagList.forEach(tag => params.push(`%"${tag}"%`));
        } else {
          const tagConditions = tagList.map(() => 'tags LIKE ?');
          conditions.push(`(${tagConditions.join(' OR ')})`);
          tagList.forEach(tag => params.push(`%"${tag}"%`));
        }
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
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const candidates = db.prepare(query).all(params) || [];
    
    // Parse JSON fields
    const parsedCandidates = candidates.map(candidate => ({
      ...candidate,
      tags: JSON.parse(candidate.tags || '[]'),
      skills: JSON.parse(candidate.skills || '{}')
    }));

    res.json({
      success: true,
      candidates: parsedCandidates,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(total / parseInt(pageSize))
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

// GET /api/candidates/:id - Get single candidate
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

// PATCH /api/candidates/:id - Update candidate
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
      salaryMin,
      salaryMax,
      skills,
      tags,
      notes,
      emailOk
    } = req.body;

    // Update fields
    const updates = [];
    const params = [];

    if (firstName !== undefined) {
      updates.push('full_name = ?');
      params.push(`${firstName} ${lastName || ''}`.trim());
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (salaryMin !== undefined) {
      updates.push('salary_min = ?');
      params.push(salaryMin ? Number(salaryMin) : null);
    }
    if (salaryMax !== undefined) {
      updates.push('salary_max = ?');
      params.push(salaryMax ? Number(salaryMax) : null);
    }
    if (skills !== undefined) {
      updates.push('skills = ?');
      params.push(JSON.stringify(skills));
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(Array.isArray(tags) ? tags : []));
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (emailOk !== undefined) {
      updates.push('email_ok = ?');
      params.push(Boolean(emailOk) ? 1 : 0);
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const stmt = db.prepare(`
      UPDATE candidates SET ${updates.join(', ')} WHERE id = ?
    `);

    stmt.run(...params);

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

// DELETE /api/candidates/:id - Delete candidate
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

export default router;

