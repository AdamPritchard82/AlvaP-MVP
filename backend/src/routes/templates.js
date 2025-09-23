import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';

const router = Router();

router.post('/', (req, res) => {
  const db = getDb();
  const id = nanoid();
  const now = new Date().toISOString();
  const { name, subject, bodyHtml = '', bodyText = '' } = req.body || {};
  if (!name || !subject) return res.status(400).json({ error: 'name and subject required' });
  db.prepare(`
    INSERT INTO email_templates (id, name, subject, body_html, body_text, created_at, updated_at)
    VALUES (@id, @name, @subject, @body_html, @body_text, @created_at, @updated_at)
  `).run({ id, name, subject, body_html: bodyHtml, body_text: bodyText, created_at: now, updated_at: now });
  res.status(201).json({ id });
});

router.get('/', (_req, res) => {
  const db = getDb();
  const result = db.prepare('SELECT * FROM email_templates ORDER BY updated_at DESC LIMIT 100').all();
  const rows = Array.isArray(result) ? result : [];
  res.json(rows);
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const t = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  const now = new Date().toISOString();
  const { name, subject, bodyHtml, bodyText } = req.body || {};
  db.prepare(`
    UPDATE email_templates SET
      name = @name,
      subject = @subject,
      body_html = @body_html,
      body_text = @body_text,
      updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    name: name ?? t.name,
    subject: subject ?? t.subject,
    body_html: bodyHtml ?? t.body_html,
    body_text: bodyText ?? t.body_text,
    updated_at: now
  });
  res.json({ ok: true });
});

export default router;










