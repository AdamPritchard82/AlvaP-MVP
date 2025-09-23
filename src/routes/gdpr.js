import { Router } from 'express';
import fs from 'node:fs/promises';
import { getDb } from '../db.js';
import { recordActivity } from '../audit.js';

const router = Router();

// Export candidate data bundle
router.get('/candidate/:id/export', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
  if (!candidate) return res.status(404).json({ error: 'Not found' });
  const matches = db.prepare('SELECT * FROM matches WHERE candidate_id = ?').all(id);
  const activities = db.prepare(`SELECT * FROM activities WHERE entity_type = 'candidate' AND entity_id = ?`).all(id);
  recordActivity({ actorId: req.user?.userId, entityType: 'candidate', entityId: id, action: 'export' });
  res.json({ candidate, matches, activities });
});

// Delete candidate (and related matches), remove CV file
router.delete('/candidate/:id', async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
  if (!candidate) return res.status(404).json({ error: 'Not found' });
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM matches WHERE candidate_id = ?').run(id);
    db.prepare('DELETE FROM candidates WHERE id = ?').run(id);
  });
  tx();
  if (candidate.cv_original_path) {
    try { await fs.unlink(candidate.cv_original_path); } catch {}
  }
  recordActivity({ actorId: req.user?.userId, entityType: 'candidate', entityId: id, action: 'delete' });
  res.json({ ok: true });
});

export default router;






