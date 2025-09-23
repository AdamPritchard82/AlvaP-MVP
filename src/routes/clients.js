import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';

const router = Router();

router.post('/', (req, res) => {
  const db = getDb();
  const id = nanoid();
  const now = new Date().toISOString();
  const { name, website, careersUrl, tags = [], contacts = [] } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  db.prepare(`
    INSERT INTO clients (id, name, website, careers_url, tags, contacts, created_at, updated_at)
    VALUES (@id, @name, @website, @careers_url, @tags, @contacts, @created_at, @updated_at)
  `).run({
    id,
    name,
    website: website || null,
    careers_url: careersUrl || null,
    tags: JSON.stringify(tags),
    contacts: JSON.stringify(contacts),
    created_at: now,
    updated_at: now
  });
  res.status(201).json({ id });
});

router.get('/', (req, res) => {
  const db = getDb();
  const { search, page = 1, limit = 50 } = req.query;

  let query = `SELECT * FROM clients`;
  const conditions = [];
  const params = {};
  
  if (search) {
    conditions.push(`(name LIKE '%' || @search || '%' OR website LIKE '%' || @search || '%')`);
    params.search = search;
  }
  
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  
  // Get total count
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
  const total = db.prepare(countQuery).get(params)?.count || 0;
  
  // Add pagination
  const offset = (parseInt(page) - 1) * parseInt(limit);
  query += ` ORDER BY updated_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;

  const clients = db.prepare(query).all(params);
  
  // Parse JSON fields
  const parsedClients = (clients || []).filter(client => client !== null).map(client => ({
    ...client,
    tags: JSON.parse(client.tags || '[]'),
    contacts: JSON.parse(client.contacts || '[]')
  }));

  res.json({
    clients: parsedClients,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit))
  });
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'Not found' });
  const now = new Date().toISOString();
  const { name, website, careersUrl, tags, contacts } = req.body || {};
  db.prepare(`
    UPDATE clients SET
      name = @name,
      website = @website,
      careers_url = @careers_url,
      tags = @tags,
      contacts = @contacts,
      updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    name: name ?? client.name,
    website: website ?? client.website,
    careers_url: careersUrl ?? client.careers_url,
    tags: tags ? JSON.stringify(tags) : client.tags,
    contacts: contacts ? JSON.stringify(contacts) : client.contacts,
    updated_at: now
  });
  res.json({ ok: true });
});

export default router;





