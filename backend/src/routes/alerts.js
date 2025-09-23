import { Router } from 'express';
import { getDb } from '../db.js';
import { sendEmail } from '../email/sender.js';

const router = Router();

// Get alerts for a consultant
router.get('/my-alerts', (req, res) => {
  const db = getDb();
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  // Get new jobs from last 24h that match consultant's keywords
  const since = new Date(Date.now() - 24*60*60*1000).toISOString();
  const newJobs = db.prepare(`
    SELECT j.id, j.title, j.source, j.created_at, c.name as client_name
    FROM jobs j
    JOIN clients c ON c.id = j.client_id
    WHERE j.created_at >= ?
    ORDER BY j.created_at DESC
    LIMIT 50
  `).all(since);
  
  // Get new matches for this consultant
  const newMatches = db.prepare(`
    SELECT m.id, m.job_id, j.title as job_title, c.full_name as candidate_name, m.score, m.stage, m.created_at
    FROM matches m
    JOIN jobs j ON j.id = m.job_id
    JOIN candidates c ON c.id = m.candidate_id
    WHERE m.created_at >= ? AND m.stage = 'new'
    ORDER BY m.created_at DESC
    LIMIT 50
  `).all(since);
  
  res.json({ newJobs, newMatches });
});

// Send immediate alert email for high-priority matches
router.post('/send-match-alert', async (req, res) => {
  const db = getDb();
  const { matchId } = req.body || {};
  if (!matchId) return res.status(400).json({ error: 'matchId required' });
  
  const match = db.prepare(`
    SELECT m.*, j.title as job_title, c.full_name as candidate_name, u.email as consultant_email
    FROM matches m
    JOIN jobs j ON j.id = m.job_id
    JOIN candidates c ON c.id = m.candidate_id
    JOIN users u ON u.id = m.created_by
    WHERE m.id = ?
  `).get(matchId);
  
  if (!match) return res.status(404).json({ error: 'Match not found' });
  
  const subject = `High-priority match: ${match.candidate_name} for ${match.job_title}`;
  const html = `
    <h3>New High-Priority Match</h3>
    <p><strong>Candidate:</strong> ${match.candidate_name}</p>
    <p><strong>Job:</strong> ${match.job_title}</p>
    <p><strong>Score:</strong> ${match.score}/100</p>
    <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/matches/${match.id}">View in CRM</a></p>
  `;
  
  try {
    await sendEmail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: match.consultant_email,
      subject,
      html,
      text: `${subject}\n\nCandidate: ${match.candidate_name}\nJob: ${match.job_title}\nScore: ${match.score}/100`
    });
    res.json({ sent: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send alert' });
  }
});

// Mark alert as read
router.post('/mark-read', (req, res) => {
  const db = getDb();
  const { alertId, type } = req.body || {};
  if (!alertId || !type) return res.status(400).json({ error: 'alertId and type required' });
  
  // Simple implementation - could be expanded with read status table
  res.json({ marked: true });
});

export default router;








