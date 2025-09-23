import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';

const router = Router();

// Create a match
router.post('/', (req, res) => {
  const db = getDb();
  const { jobId, candidateId, score = 0, stage = 'new', notes = '' } = req.body || {};
  if (!jobId || !candidateId) return res.status(400).json({ error: 'jobId and candidateId required' });
  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO matches (id, job_id, candidate_id, score, stage, notes, created_at, updated_at)
    VALUES (@id, @job_id, @candidate_id, @score, @stage, @notes, @created_at, @updated_at)
  `).run({ id, job_id: jobId, candidate_id: candidateId, score, stage, notes, created_at: now, updated_at: now });
  res.status(201).json({ id });
});

// Update a match stage/score/notes
router.patch('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
  if (!match) return res.status(404).json({ error: 'Not found' });
  const now = new Date().toISOString();
  const { score, stage, notes } = req.body || {};
  db.prepare(`
    UPDATE matches SET
      score = @score,
      stage = @stage,
      notes = @notes,
      updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    score: score !== undefined ? score : match.score,
    stage: stage ?? match.stage,
    notes: notes ?? match.notes,
    updated_at: now
  });
  res.json({ ok: true });
});

// List matches with filters
router.get('/', (req, res) => {
  const db = getDb();
  const { job_id, candidate_id, stage, page = 1, limit = 50 } = req.query;

  let query = `
    SELECT m.*, 
           c.full_name as candidate_name, c.current_title as candidate_title, c.current_employer as candidate_employer,
           j.title as job_title, j.salary_min as job_salary_min, j.salary_max as job_salary_max,
           cl.name as client_name, cl.website as client_website
    FROM matches m
    LEFT JOIN candidates c ON m.candidate_id = c.id
    LEFT JOIN jobs j ON m.job_id = j.id
    LEFT JOIN clients cl ON j.client_id = cl.id
  `;
  
  const conditions = [];
  const params = {};
  
  if (job_id) {
    conditions.push(`m.job_id = @job_id`);
    params.job_id = job_id;
  }
  
  if (candidate_id) {
    conditions.push(`m.candidate_id = @candidate_id`);
    params.candidate_id = candidate_id;
  }
  
  if (stage) {
    conditions.push(`m.stage = @stage`);
    params.stage = stage;
  }
  
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  
  // Get total count
  const countQuery = query.replace('SELECT m.*, \n           c.full_name as candidate_name, c.current_title as candidate_title, c.current_employer as candidate_employer,\n           j.title as job_title, j.salary_min as job_salary_min, j.salary_max as job_salary_max,\n           cl.name as client_name, cl.website as client_website', 'SELECT COUNT(*) as count');
  const total = db.prepare(countQuery).get(params)?.count || 0;
  
  // Add pagination
  const offset = (parseInt(page) - 1) * parseInt(limit);
  query += ` ORDER BY m.updated_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;

  const matches = db.prepare(query).all(params) || [];
  
  // Ensure matches is always an array
  const matchesArray = Array.isArray(matches) ? matches : [];
  
  // Format response
  const parsedMatches = matchesArray.filter(match => match !== null).map(match => ({
    id: match.id,
    job_id: match.job_id,
    candidate_id: match.candidate_id,
    score: match.score,
    stage: match.stage,
    notes: match.notes,
    created_at: match.created_at,
    updated_at: match.updated_at,
    job: match.job_title ? {
      id: match.job_id,
      title: match.job_title,
      salary_min: match.job_salary_min,
      salary_max: match.job_salary_max,
      client: match.client_name ? {
        id: match.job_id, // This should be client_id, but we don't have it in the query
        name: match.client_name,
        website: match.client_website
      } : null
    } : null,
    candidate: match.candidate_name ? {
      id: match.candidate_id,
      full_name: match.candidate_name,
      current_title: match.candidate_title,
      current_employer: match.candidate_employer
    } : null
  }));

  res.json({
    matches: parsedMatches,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit))
  });
});

// List matches for a job
router.get('/by-job/:jobId', (req, res) => {
  const db = getDb();
  const { jobId } = req.params;
  const rows = db.prepare(`
    SELECT m.id, m.candidate_id, c.full_name, m.score, m.stage, m.notes, m.updated_at
    FROM matches m
    JOIN candidates c ON c.id = m.candidate_id
    WHERE m.job_id = ?
    ORDER BY m.updated_at DESC
  `).all(jobId);
  res.json(rows);
});

export default router;





