import { Router } from 'express';
import { getDb } from '../db.js';
import { fetchCharityJob } from '../monitoring/charityjob.js';
import { fetchW4MP } from '../monitoring/w4mp.js';
import { fetchIndeed } from '../monitoring/indeed.js';
import { fetchLinkedIn } from '../monitoring/linkedin.js';

const router = Router();

function normalizeTagsFromTitle(title) {
  const t = title.toLowerCase();
  const tags = [];
  if (t.includes('policy')) tags.push('policy');
  if (t.includes('campaign')) tags.push('campaigns');
  if (t.includes('public affairs')) tags.push('public_affairs');
  if (t.includes('communications') || t.includes('comms')) tags.push('communications');
  return tags;
}

function upsertJob(db, { title, org, salary, link, source }) {
  const existing = db.prepare('SELECT id FROM jobs WHERE source = ? AND title = ?').get(link, title);
  const now = new Date().toISOString();
  if (existing) {
    db.prepare('UPDATE jobs SET updated_at = ? WHERE id = ?').run(now, existing.id);
    return existing.id;
  }
  const clientName = org || 'Unknown';
  let client = db.prepare('SELECT id FROM clients WHERE name = ?').get(clientName);
  if (!client) {
    const id = require('nanoid').nanoid();
    db.prepare(`INSERT INTO clients (id, name, created_at, updated_at, tags, contacts) VALUES (@id, @name, @created_at, @updated_at, '[]', '[]')`)
      .run({ id, name: clientName, created_at: now, updated_at: now });
    client = { id };
  }
  const id = require('nanoid').nanoid();
  const tags = normalizeTagsFromTitle(title);
  db.prepare(`
    INSERT INTO jobs (id, client_id, title, salary_min, salary_max, tags, status, source, created_at, updated_at)
    VALUES (@id, @client_id, @title, NULL, NULL, @tags, 'new', @source, @created_at, @updated_at)
  `).run({ id, client_id: client.id, title, tags: JSON.stringify(tags), source: link, created_at: now, updated_at: now });
  return id;
}

router.post('/run', async (req, res) => {
  const db = getDb();
  const defaultKeywords = [
    'Public Affairs',
    'Government Affairs',
    'Corporate Communications',
    'Crisis Communications',
    'Campaign',
    'Policy'
  ];
  const { keywords = defaultKeywords } = req.body || {};

  const results = [];
  for (const kw of keywords) {
    // eslint-disable-next-line no-await-in-loop
    const calls = [
      fetchCharityJob({ query: kw, page: 1 }),
      fetchW4MP({ query: kw, page: 1 }),
      fetchIndeed({ query: kw, page: 0 })
    ];
    if (req.body?.includeLinkedIn) calls.push(fetchLinkedIn({ query: kw, start: 0 }));
    const resp = await Promise.all(calls);
    for (const r of resp) results.push(...(r || []));
  }

  const inserted = [];
  const tx = db.transaction((items) => {
    for (const it of items) {
      const id = upsertJob(db, { ...it, source: it.link });
      inserted.push(id);
    }
  });
  tx(results);
  res.json({ newJobs: inserted.length, queries: keywords.length });
});

export default router;


