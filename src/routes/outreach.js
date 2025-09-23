import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// Draft outreach for a job and candidate
router.post('/draft', (req, res) => {
  const db = getDb();
  const { jobId, candidateId } = req.body || {};
  if (!jobId || !candidateId) return res.status(400).json({ error: 'jobId and candidateId required' });
  const job = db.prepare('SELECT title, source, tags FROM jobs WHERE id = ?').get(jobId);
  const c = db.prepare('SELECT full_name, cv_light, skills FROM candidates WHERE id = ?').get(candidateId);
  if (!job || !c) return res.status(404).json({ error: 'Not found' });

  const skills = JSON.parse(c.skills || '{}');
  const highlights = [
    skills.communications ? `Communications ${skills.communications}/5` : null,
    skills.campaigns ? `Campaigns ${skills.campaigns}/5` : null,
    skills.policy ? `Policy ${skills.policy}/5` : null,
    skills.publicAffairs ? `Public Affairs ${skills.publicAffairs}/5` : null
  ].filter(Boolean).join(' • ');

  const subject = `${c.full_name} for ${job.title}`;
  const intro = `Saw your role "${job.title}" and wanted to put forward ${c.full_name}.`;
  const cv = (c.cv_light || '').replace(/\n/g, '\n> ');
  const bodyText = `${intro}\n\nHighlights: ${highlights}\n\n> ${cv}\n\nLink to role: ${job.source}`.trim();
  const bodyHtml = `<p>${intro}</p><p><strong>Highlights:</strong> ${highlights}</p><blockquote>${(c.cv_light || '').replace(/\n/g, '<br/>')}</blockquote><p><a href="${job.source}">Role link</a></p>`;

  res.json({ subject, bodyText, bodyHtml });
});

export default router;










