import { Router } from 'express';
import { simpleParser } from 'mailparser';
import { getDb } from '../db.js';
import { recordActivity } from '../audit.js';

const router = Router();

// Webhook to receive inbound emails (replies, bounces, OOO)
router.post('/webhook', async (req, res) => {
  const db = getDb();
  try {
    const raw = req.body;
    const parsed = await simpleParser(raw);
    
    const from = parsed.from?.text || '';
    const to = parsed.to?.text || '';
    const subject = parsed.subject || '';
    const text = parsed.text || '';
    const html = parsed.html || '';
    
    // Try to find original sender by looking up recent outbound emails
    const originalSender = db.prepare(`
      SELECT created_by FROM activities 
      WHERE action = 'email_sent' 
      AND metadata LIKE '%' || @to || '%'
      ORDER BY created_at DESC 
      LIMIT 1
    `).get({ to: from });
    
    if (originalSender) {
      // Store the inbound email
      const id = require('nanoid').nanoid();
      const now = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO inbound_emails (id, from_email, to_email, subject, text_content, html_content, original_sender_id, created_at)
        VALUES (@id, @from_email, @to_email, @subject, @text_content, @html_content, @original_sender_id, @created_at)
      `).run({
        id,
        from_email: from,
        to_email: to,
        subject,
        text_content: text,
        html_content: html,
        original_sender_id: originalSender.created_by,
        created_at: now
      });
      
      // Determine type: reply, bounce, or OOO
      let type = 'reply';
      const content = (text + ' ' + html).toLowerCase();
      if (content.includes('bounce') || content.includes('undeliverable') || content.includes('delivery failed')) {
        type = 'bounce';
      } else if (content.includes('out of office') || content.includes('away') || content.includes('vacation')) {
        type = 'ooo';
      }
      
      recordActivity({
        actorId: originalSender.created_by,
        entityType: 'inbound_email',
        entityId: id,
        action: 'received',
        metadata: { type, from, subject }
      });
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Inbound email error:', error);
    res.status(500).json({ error: 'processing_failed' });
  }
});

// Get inbound emails for a consultant
router.get('/my-emails', (req, res) => {
  const db = getDb();
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const rows = db.prepare(`
    SELECT id, from_email, subject, text_content, created_at
    FROM inbound_emails 
    WHERE original_sender_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(userId);
  
  res.json(rows);
});

export default router;








