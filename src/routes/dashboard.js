import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/needs-review', (req, res) => {
  const db = getDb();
  const result = db.prepare(`
    SELECT id, full_name, email, phone, parse_status, needs_review, updated_at
    FROM candidates
    WHERE needs_review = 1
    ORDER BY updated_at DESC
    LIMIT 100
  `).all();
  const rows = Array.isArray(result) ? result : [];
  res.json(rows);
});

router.get('/new-jobs-this-week', (_req, res) => {
  const db = getDb();
  const since = new Date(Date.now() - 7*24*60*60*1000).toISOString();
  const result = db.prepare(`
    SELECT id, title, source, created_at
    FROM jobs
    WHERE created_at >= ?
    ORDER BY created_at DESC
    LIMIT 200
  `).all(since);
  const rows = Array.isArray(result) ? result : [];
  res.json(rows);
});

router.get('/open-matches', (_req, res) => {
  const db = getDb();
  const result = db.prepare(`
    SELECT m.id, m.job_id, j.title as job_title, m.candidate_id, c.full_name, m.stage, m.score, m.updated_at
    FROM matches m
    JOIN jobs j ON j.id = m.job_id
    JOIN candidates c ON c.id = m.candidate_id
    WHERE m.stage IN ('new','candidates_sent','interview')
    ORDER BY m.updated_at DESC
    LIMIT 200
  `).all();
  const rows = Array.isArray(result) ? result : [];
  res.json(rows);
});

export default router;




