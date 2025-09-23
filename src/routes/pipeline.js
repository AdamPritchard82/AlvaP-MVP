import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// Pipeline summary: counts of matches by stage per job
router.get('/summary', (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT j.id as job_id, j.title, j.status,
      SUM(CASE WHEN m.stage = 'new' THEN 1 ELSE 0 END) AS new_count,
      SUM(CASE WHEN m.stage = 'candidates_sent' THEN 1 ELSE 0 END) AS candidates_sent_count,
      SUM(CASE WHEN m.stage = 'interview' THEN 1 ELSE 0 END) AS interview_count,
      SUM(CASE WHEN m.stage = 'placed' THEN 1 ELSE 0 END) AS placed_count
    FROM jobs j
    LEFT JOIN matches m ON m.job_id = j.id
    GROUP BY j.id
    ORDER BY j.updated_at DESC
  `).all();
  const result = Array.isArray(rows) ? rows : [];
  res.json(result);
});

export default router;






