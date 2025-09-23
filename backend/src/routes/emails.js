import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';

const router = Router();

// POST /emails/send - Send email (internal stub)
router.post('/send', (req, res) => {
  try {
    const { to, subject, body, jobId, candidateIds = [] } = req.body;
    
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }

    // TODO: Implement actual email sending (SMTP, SendGrid, etc.)
    // For now, just log and store in database
    
    const db = getDb();
    const id = nanoid();
    const now = new Date().toISOString();
    
    // Store email in database
    db.prepare(`
      INSERT INTO emails (id, job_id, to_email, subject, body, candidate_ids, status, sent_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      jobId || null,
      to,
      subject,
      body,
      JSON.stringify(candidateIds),
      'sent',
      now,
      now
    );

    console.log('Email sent (stub):', { to, subject, jobId, candidateIds });

    res.json({
      success: true,
      id,
      message: 'Email sent successfully (stub)'
    });

  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send email',
      details: error.message 
    });
  }
});

// GET /emails - List emails for a job
router.get('/', (req, res) => {
  try {
    const { job_id, limit = 5 } = req.query;
    const db = getDb();
    
    let query = 'SELECT * FROM emails';
    const params = [];
    
    if (job_id) {
      query += ' WHERE job_id = ?';
      params.push(job_id);
    }
    
    query += ' ORDER BY sent_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const emails = db.prepare(query).all(params) || [];
    
    const parsedEmails = emails.map(email => ({
      id: email.id,
      job_id: email.job_id,
      to: email.to_email,
      subject: email.subject,
      body: email.body,
      candidate_ids: JSON.parse(email.candidate_ids || '[]'),
      status: email.status,
      sent_at: email.sent_at,
      created_at: email.created_at
    }));
    
    res.json({
      success: true,
      emails: parsedEmails
    });

  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch emails',
      details: error.message 
    });
  }
});

export default router;
