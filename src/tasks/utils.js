import { nanoid } from 'nanoid';

function normalizeTagsFromTitle(title) {
  const t = (title || '').toLowerCase();
  const tags = [];
  if (t.includes('policy')) tags.push('policy');
  if (t.includes('campaign')) tags.push('campaigns');
  if (t.includes('public affairs')) tags.push('public_affairs');
  if (t.includes('communications') || t.includes('comms')) tags.push('communications');
  return tags;
}

export function upsertFromResults(db, items) {
  const insertedIds = [];
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const it of items) {
      const { title, org, link } = it;
      if (!title || !link) continue;
      const existing = db.prepare('SELECT id FROM jobs WHERE source = ? AND title = ?').get(link, title);
      if (existing) continue;
      let client = db.prepare('SELECT id FROM clients WHERE name = ?').get(org || 'Unknown');
      if (!client) {
        const cid = nanoid();
        db.prepare(`INSERT INTO clients (id, name, created_at, updated_at, tags, contacts) VALUES (@id, @name, @created_at, @updated_at, '[]', '[]')`)
          .run({ id: cid, name: org || 'Unknown', created_at: now, updated_at: now });
        client = { id: cid };
      }
      const id = nanoid();
      const tags = normalizeTagsFromTitle(title);
      db.prepare(`
        INSERT INTO jobs (id, client_id, title, salary_min, salary_max, tags, status, source, created_at, updated_at)
        VALUES (@id, @client_id, @title, NULL, NULL, @tags, 'new', @source, @created_at, @updated_at)
      `).run({ id, client_id: client.id, title, tags: JSON.stringify(tags), source: link, created_at: now, updated_at: now });
      insertedIds.push(id);
    }
  });
  tx();
  return { insertedIds, count: insertedIds.length };
}












