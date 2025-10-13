import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';

const router = Router();

// Get events with filtering
router.get('/', (req, res) => {
  const db = getDb();
  const { 
    filter = 'all', 
    assignedTo = 'all', 
    since, 
    limit = 50,
    type 
  } = req.query;

  let query = `
    SELECT e.*, 
           j.title as job_title, j.salary_min, j.salary_max, j.tags as job_tags, j.source as job_source,
           c.name as client_name, c.logo as client_logo,
           u.name as assigned_user_name
    FROM events e
    LEFT JOIN jobs j ON e.job_id = j.id
    LEFT JOIN clients c ON j.client_id = c.id
    LEFT JOIN users u ON e.assigned_to = u.id
  `;
  
  const conditions = [];
  const params = {};

  // Filter by event type
  if (filter === 'new-roles') {
    conditions.push("e.type = 'job:new'");
  } else if (type) {
    conditions.push("e.type = @type");
    params.type = type;
  }

  // Filter by assignment
  if (assignedTo === 'me') {
    // For now, we'll use a placeholder - in real implementation, get from auth
    conditions.push("e.assigned_to IS NOT NULL");
  }

  // Filter by time
  if (since) {
    conditions.push("e.created_at > @since");
    params.since = since;
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY e.created_at DESC LIMIT @limit';
  params.limit = parseInt(limit);

  try {
    const events = db.prepare(query).all(params);
    const parsedEvents = events.map(event => ({
      id: event.id,
      type: event.type,
      title: event.title,
      summary: event.summary,
      jobId: event.job_id,
      clientId: event.client_id,
      candidateId: event.candidate_id,
      createdAt: event.created_at,
      priority: event.priority,
      source: event.source,
      assignedTo: event.assigned_to,
      assignedUserName: event.assigned_user_name,
      // Job details for new roles
      job: event.job_id ? {
        id: event.job_id,
        title: event.job_title,
        salaryMin: event.salary_min,
        salaryMax: event.salary_max,
        tags: JSON.parse(event.job_tags || '[]'),
        source: event.job_source
      } : null,
      // Client details
      client: event.client_id ? {
        id: event.client_id,
        name: event.client_name,
        logo: event.client_logo
      } : null
    }));

    res.json({ events: parsedEvents });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Create a new event
router.post('/', (req, res) => {
  const db = getDb();
  const id = nanoid();
  const now = new Date().toISOString();
  const {
    type,
    title,
    summary,
    jobId,
    clientId,
    candidateId,
    priority = 'normal',
    source = 'system',
    assignedTo
  } = req.body;

  if (!type || !title) {
    return res.status(400).json({ error: 'type and title are required' });
  }

  try {
    db.prepare(`
      INSERT INTO events (id, type, title, summary, job_id, client_id, candidate_id, priority, source, assigned_to, created_at)
      VALUES (@id, @type, @title, @summary, @job_id, @client_id, @candidate_id, @priority, @source, @assigned_to, @created_at)
    `).run({
      id,
      type,
      title,
      summary: summary || null,
      job_id: jobId || null,
      client_id: clientId || null,
      candidate_id: candidateId || null,
      priority,
      source,
      assigned_to: assignedTo || null,
      created_at: now
    });

    res.status(201).json({ id });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Get unread count for new roles
router.get('/unread-count', (req, res) => {
  const db = getDb();
  const { since } = req.query;
  
  let query = "SELECT COUNT(*) as count FROM events WHERE type = 'job:new'";
  const params = {};
  
  if (since) {
    query += " AND created_at > @since";
    params.since = since;
  }

  try {
    const result = db.prepare(query).get(params);
    res.json({ count: result.count || 0 });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

export default router;















