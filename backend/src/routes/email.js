import { Router } from 'express';
import { getDb } from '../db.js';
import { sendEmail } from '../email/sender.js';
import { renderTemplate } from '../utils/renderTemplate.js';
import { Router as _R } from 'express';

const router = Router();

// Send candidate pitch email with optional CV Light insertion
router.post('/send', async (req, res) => {
  const db = getDb();
  const { to, subject, bodyHtml, bodyText, candidateId, includeCvLight, templateId, variables = {} } = req.body || {};
  if (!to) return res.status(400).json({ error: 'to required' });

  let html = bodyHtml || '';
  let text = bodyText || '';
  let subj = subject || '';

  if (templateId) {
    const tpl = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(templateId);
    if (!tpl) return res.status(400).json({ error: 'invalid_template' });
    const rendered = renderTemplate({ template: tpl, variables });
    subj = subj || rendered.subject;
    html = html || rendered.html;
    text = text || rendered.text;
  }
  if (includeCvLight && candidateId) {
    const c = db.prepare('SELECT full_name, cv_light FROM candidates WHERE id = ?').get(candidateId);
    if (c) {
      const snippet = `<div><strong>${c.full_name}</strong><br/>${(c.cv_light || '').replace(/\n/g, '<br/>')}</div>`;
      html = snippet + (html ? '<hr/>' + html : '');
      text = `${c.full_name}\n${c.cv_light || ''}\n\n${text}`.trim();
    }
  }

  try {
    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    const info = await sendEmail({ from, to, subject: subj, html, text, userId: req.user?.userId });
    
    // Record email sent activity for inbound routing
    const { recordActivity } = await import('../audit.js');
    recordActivity({
      actorId: req.user?.userId,
      entityType: 'email',
      entityId: info.messageId,
      action: 'email_sent',
      metadata: { to, subject: subj }
    });
    
    res.json({ ok: true, messageId: info.messageId });
  } catch (e) {
    res.status(500).json({ error: 'send_failed' });
  }
});

export default router;


