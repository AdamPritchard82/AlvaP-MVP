import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';

const router = Router();

router.post('/', (req, res) => {
  const db = getDb();
  const id = nanoid();
  const now = new Date().toISOString();
  const { clientId, title, salaryMin, salaryMax, tags = [], status = 'new', source } = req.body || {};
  if (!clientId || !title) return res.status(400).json({ error: 'clientId and title required' });
  
  // Get the first stage ID for new opportunities
  const firstStage = db.prepare('SELECT id FROM pipeline_stages WHERE is_first = 1 ORDER BY position ASC LIMIT 1').get();
  const defaultStatus = firstStage ? firstStage.id : 'new';

  // Insert job
  db.prepare(`
    INSERT INTO jobs (id, client_id, title, salary_min, salary_max, tags, status, source, created_at, updated_at)
    VALUES (@id, @client_id, @title, @salary_min, @salary_max, @tags, @status, @source, @created_at, @updated_at)
  `).run({
    id,
    client_id: clientId,
    title,
    salary_min: salaryMin ?? null,
    salary_max: salaryMax ?? null,
    tags: JSON.stringify(tags),
    status: status === 'new' ? defaultStatus : status,
    source: source || null,
    created_at: now,
    updated_at: now
  });

  // Get client name for event
  const client = db.prepare('SELECT name FROM clients WHERE id = ?').get(clientId);
  const clientName = client?.name || 'Unknown Client';

  // Create job:new event
  const eventId = nanoid();
  db.prepare(`
    INSERT INTO events (id, type, title, summary, job_id, client_id, priority, source, created_at)
    VALUES (@id, @type, @title, @summary, @job_id, @client_id, @priority, @source, @created_at)
  `).run({
    id: eventId,
    type: 'job:new',
    title: `New role: ${title}`,
    summary: `${title} at ${clientName}${salaryMin ? ` (${salaryMin}${salaryMax ? `-${salaryMax}` : '+'})` : ''}`,
    job_id: id,
    client_id: clientId,
    priority: 'high',
    source: source || 'manual',
    created_at: now
  });

  res.status(201).json({ id });
});

// Job ingest endpoint (internal)
router.post('/ingest', (req, res) => {
  const db = getDb();
  const id = nanoid();
  const now = new Date().toISOString();
  const { 
    clientId, 
    title, 
    salaryMin, 
    salaryMax, 
    tags = [], 
    source = 'job-board',
    clientName 
  } = req.body || {};
  
  if (!clientId || !title) {
    return res.status(400).json({ error: 'clientId and title required' });
  }

  // Get the first stage ID for new opportunities
  const firstStage = db.prepare('SELECT id FROM pipeline_stages WHERE is_first = 1 ORDER BY position ASC LIMIT 1').get();
  const defaultStatus = firstStage ? firstStage.id : 'new';

  // Insert job
  db.prepare(`
    INSERT INTO jobs (id, client_id, title, salary_min, salary_max, tags, status, source, created_at, updated_at)
    VALUES (@id, @client_id, @title, @salary_min, @salary_max, @tags, @status, @source, @created_at, @updated_at)
  `).run({
    id,
    client_id: clientId,
    title,
    salary_min: salaryMin ?? null,
    salary_max: salaryMax ?? null,
    tags: JSON.stringify(tags),
    status: defaultStatus, // Always start in first stage
    source,
    created_at: now,
    updated_at: now
  });

  // Get client name for event
  const client = db.prepare('SELECT name FROM clients WHERE id = ?').get(clientId);
  const displayClientName = clientName || client?.name || 'Unknown Client';

  // Create job:new event
  const eventId = nanoid();
  db.prepare(`
    INSERT INTO events (id, type, title, summary, job_id, client_id, priority, source, created_at)
    VALUES (@id, @type, @title, @summary, @job_id, @client_id, @priority, @source, @created_at)
  `).run({
    id: eventId,
    type: 'job:new',
    title: `New role: ${title}`,
    summary: `${title} at ${displayClientName}${salaryMin ? ` (${salaryMin}${salaryMax ? `-${salaryMax}` : '+'})` : ''}`,
    job_id: id,
    client_id: clientId,
    priority: 'high',
    source,
    created_at: now
  });

  res.status(201).json({ id, eventId });
});

router.get('/', (req, res) => {
  const db = getDb();
  const { search, status, client_id, page = 1, limit = 50 } = req.query;

  let query = `SELECT j.*, c.name as client_name, c.website as client_website 
               FROM jobs j 
               LEFT JOIN clients c ON j.client_id = c.id`;
  const conditions = [];
  const params = {};
  
  if (search) {
    conditions.push(`(j.title LIKE '%' || @search || '%' OR j.source LIKE '%' || @search || '%')`);
    params.search = search;
  }
  
  if (status) {
    conditions.push(`j.status = @status`);
    params.status = status;
  }
  
  if (client_id) {
    conditions.push(`j.client_id = @client_id`);
    params.client_id = client_id;
  }
  
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  
  // Get total count
  const countQuery = query.replace('SELECT j.*, c.name as client_name, c.website as client_website', 'SELECT COUNT(*) as count');
  const total = db.prepare(countQuery).get(params)?.count || 0;
  
  // Add pagination
  const offset = (parseInt(page) - 1) * parseInt(limit);
  query += ` ORDER BY j.updated_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;

  let jobs = [];
  try {
    const result = db.prepare(query).all(params);
    console.log('Jobs query result type:', typeof result, 'isArray:', Array.isArray(result));
    jobs = Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('Error fetching jobs:', error);
    jobs = [];
  }
  
  // Ensure jobs is always an array before filtering
  if (!Array.isArray(jobs)) {
    console.error('Jobs is not an array:', jobs);
    jobs = [];
  }
  
  // Parse JSON fields and format response
  const parsedJobs = jobs.filter(job => job !== null).map(job => ({
    id: job.id,
    client_id: job.client_id,
    title: job.title,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    tags: JSON.parse(job.tags || '[]'),
    status: job.status,
    source: job.source,
    created_at: job.created_at,
    updated_at: job.updated_at,
    client: job.client_name ? {
      id: job.client_id,
      name: job.client_name,
      website: job.client_website
    } : null
  }));

  res.json({
    jobs: parsedJobs,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit))
  });
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  const now = new Date().toISOString();
  const { title, salaryMin, salaryMax, tags, status, source } = req.body || {};
  db.prepare(`
    UPDATE jobs SET
      title = @title,
      salary_min = @salary_min,
      salary_max = @salary_max,
      tags = @tags,
      status = @status,
      source = @source,
      updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    title: title ?? job.title,
    salary_min: salaryMin !== undefined ? salaryMin : job.salary_min,
    salary_max: salaryMax !== undefined ? salaryMax : job.salary_max,
    tags: tags ? JSON.stringify(tags) : job.tags,
    status: status ?? job.status,
    source: source ?? job.source,
    updated_at: now
  });
  res.json({ ok: true });
});

// Assign job to user
router.patch('/:id/assign', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { assignedTo } = req.body;
  
  if (!assignedTo) {
    return res.status(400).json({ error: 'assignedTo is required' });
  }

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const now = new Date().toISOString();
  
  // Update job assignment
  db.prepare(`
    UPDATE jobs SET updated_at = @updated_at WHERE id = @id
  `).run({ id, updated_at: now });

  // Create assignment event
  const eventId = nanoid();
  db.prepare(`
    INSERT INTO events (id, type, title, summary, job_id, client_id, assigned_to, created_at)
    VALUES (@id, @type, @title, @summary, @job_id, @client_id, @assigned_to, @created_at)
  `).run({
    id: eventId,
    type: 'job:update',
    title: `Job assigned`,
    summary: `Job "${job.title}" assigned to user`,
    job_id: id,
    client_id: job.client_id,
    assigned_to: assignedTo,
    created_at: now
  });

  res.json({ ok: true });
});

// Get job by ID with client details
router.get('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const job = db.prepare(`
    SELECT j.*, c.name as client_name, c.website as client_website 
    FROM jobs j 
    LEFT JOIN clients c ON j.client_id = c.id 
    WHERE j.id = ?
  `).get(id);
  
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  const parsedJob = {
    id: job.id,
    client_id: job.client_id,
    title: job.title,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    tags: JSON.parse(job.tags || '[]'),
    status: job.status,
    source: job.source,
    created_at: job.created_at,
    updated_at: job.updated_at,
    client: job.client_name ? {
      id: job.client_id,
      name: job.client_name,
      website: job.client_website
    } : null
  };
  
  res.json(parsedJob);
});

// Get matches for a specific job
router.get('/:id/matches', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const matches = db.prepare(`
    SELECT m.id, m.candidate_id, m.score, m.stage, m.notes, m.created_at, m.updated_at,
           c.full_name, c.current_title, c.current_employer, c.salary_min, c.salary_max, c.tags, c.skills
    FROM matches m
    JOIN candidates c ON c.id = m.candidate_id
    WHERE m.job_id = ?
    ORDER BY m.score DESC, m.updated_at DESC
  `).all(id);
  
  const parsedMatches = matches.map(match => ({
    id: match.id,
    candidate_id: match.candidate_id,
    score: match.score,
    stage: match.stage,
    notes: match.notes,
    created_at: match.created_at,
    updated_at: match.updated_at,
    candidate: {
      id: match.candidate_id,
      full_name: match.full_name,
      current_title: match.current_title,
      current_employer: match.current_employer,
      salary_min: match.salary_min,
      salary_max: match.salary_max,
      tags: JSON.parse(match.tags || '[]'),
      skills: JSON.parse(match.skills || '{}')
    }
  }));
  
  res.json({ matches: parsedMatches });
});

// Get open roles (jobs in non-final stages)
router.get('/open', (req, res) => {
  const db = getDb();
  const { assignedTo = 'all', since, limit = 50 } = req.query;

  // Get final stages (rejected, placed)
  const finalStages = db.prepare(`
    SELECT id FROM pipeline_stages 
    WHERE name IN ('Rejected', 'Placed') OR name LIKE '%rejected%' OR name LIKE '%placed%'
  `).all();
  const finalStageIds = finalStages.map(s => s.id);

  let query = `
    SELECT j.*, c.name as client_name, c.logo as client_logo,
           ps.name as stage_name, ps.color as stage_color
    FROM jobs j
    LEFT JOIN clients c ON j.client_id = c.id
    LEFT JOIN pipeline_stages ps ON j.status = ps.id
    WHERE j.status NOT IN (${finalStageIds.map(() => '?').join(',')})
  `;
  
  const params = [...finalStageIds];

  // Filter by assignment (placeholder for now)
  if (assignedTo === 'me') {
    // In real implementation, filter by assigned user
  }

  // Filter by time
  if (since) {
    query += ' AND j.created_at > ?';
    params.push(since);
  }

  query += ' ORDER BY j.created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  try {
    const jobs = db.prepare(query).all(params);
    const parsedJobs = jobs.map(job => ({
      id: job.id,
      client_id: job.client_id,
      title: job.title,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      tags: JSON.parse(job.tags || '[]'),
      status: job.status,
      source: job.source,
      created_at: job.created_at,
      updated_at: job.updated_at,
      client: {
        id: job.client_id,
        name: job.client_name,
        logo: job.client_logo
      },
      stage: {
        id: job.status,
        name: job.stage_name,
        color: job.stage_color
      }
    }));

    res.json({ jobs: parsedJobs });
  } catch (error) {
    console.error('Error fetching open roles:', error);
    res.status(500).json({ error: 'Failed to fetch open roles' });
  }
});

// Add candidate to job
router.post('/:id/matches', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { candidateId, stage = 'new' } = req.body;
  
  if (!candidateId) return res.status(400).json({ error: 'candidateId required' });
  
  // Check if match already exists
  const existingMatch = db.prepare('SELECT id FROM matches WHERE job_id = ? AND candidate_id = ?').get(id, candidateId);
  if (existingMatch) return res.status(400).json({ error: 'Candidate already attached to this job' });
  
  // Calculate match score using existing logic
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidateId);
  
  if (!job || !candidate) return res.status(404).json({ error: 'Job or candidate not found' });
  
  const jobTags = JSON.parse(job.tags || '[]');
  const cTags = JSON.parse(candidate.tags || '[]');
  const skills = JSON.parse(candidate.skills || '{}');
  
  let score = 0;
  // Tag overlap (weight 50)
  const overlap = cTags.filter(t => jobTags.includes(t));
  score += Math.min(overlap.length, 5) / 5 * 50;
  
  // Skills alignment (weight 30)
  const wanted = ['communications','campaigns','policy','publicAffairs'].filter(k => 
    jobTags.some(t => t.toLowerCase().includes(k.replace('publicAffairs','public_affairs').replace('campaigns','campaigns')) || t.toLowerCase().includes(k))
  );
  if (wanted.length) {
    const vals = wanted.map(k => Number(skills[k] || 0));
    const avg = vals.length ? vals.reduce((a,b)=>a+b,0) / (vals.length * 5) : 0;
    score += avg * 30;
  }
  
  // Salary fit (weight 20)
  const jMin = Number(job.salary_min ?? 0), jMax = Number(job.salary_max ?? 0);
  const cMin = Number(candidate.salary_min ?? 0), cMax = Number(candidate.salary_max ?? 0);
  if (jMin || jMax) {
    let fit = 0;
    if (cMin && cMax && jMin && jMax) {
      const overlapMin = Math.max(jMin, cMin);
      const overlapMax = Math.min(jMax, cMax);
      const range = Math.max(1, (jMax - jMin));
      const overlapAmt = Math.max(0, overlapMax - overlapMin);
      fit = overlapAmt / range;
    } else if (cMin && jMax) {
      fit = cMin <= jMax ? 0.6 : 0;
    } else if (cMax && jMin) {
      fit = cMax >= jMin ? 0.6 : 0;
    }
    score += fit * 20;
  }
  
  const matchId = nanoid();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO matches (id, job_id, candidate_id, score, stage, created_at, updated_at)
    VALUES (@id, @job_id, @candidate_id, @score, @stage, @created_at, @updated_at)
  `).run({
    id: matchId,
    job_id: id,
    candidate_id: candidateId,
    score: Math.round(score),
    stage,
    created_at: now,
    updated_at: now
  });
  
  res.status(201).json({ id: matchId });
});

// Get job recommendations
router.get('/:id/recommendations', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  const jobTags = JSON.parse(job.tags || '[]');
  const result = db.prepare('SELECT id, full_name, tags, skills, salary_min, salary_max, seniority FROM candidates').all();
  const candidates = Array.isArray(result) ? result : [];

  function calcScore(c) {
    const cTags = JSON.parse(c.tags || '[]');
    const skills = JSON.parse(c.skills || '{}');
    let score = 0;

    // Tag overlap (weight 50)
    const overlap = cTags.filter(t => jobTags.includes(t));
    score += Math.min(overlap.length, 5) / 5 * 50;

    // Skills alignment (weight 30)
    const wanted = ['communications','campaigns','policy','publicAffairs'].filter(k => 
      jobTags.some(t => t.toLowerCase().includes(k.replace('publicAffairs','public_affairs').replace('campaigns','campaigns')) || t.toLowerCase().includes(k))
    );
    if (wanted.length) {
      const vals = wanted.map(k => Number(skills[k] || 0));
      const avg = vals.length ? vals.reduce((a,b)=>a+b,0) / (vals.length * 5) : 0;
      score += avg * 30;
    }

    // Salary fit (weight 20)
    const jMin = Number(job.salary_min ?? 0), jMax = Number(job.salary_max ?? 0);
    const cMin = Number(c.salary_min ?? 0), cMax = Number(c.salary_max ?? 0);
    if (jMin || jMax) {
      let fit = 0;
      if (cMin && cMax && jMin && jMax) {
        const overlapMin = Math.max(jMin, cMin);
        const overlapMax = Math.min(jMax, cMax);
        const range = Math.max(1, (jMax - jMin));
        const overlapAmt = Math.max(0, overlapMax - overlapMin);
        fit = overlapAmt / range;
      } else if (cMin && jMax) {
        fit = cMin <= jMax ? 0.6 : 0;
      } else if (cMax && jMin) {
        fit = cMax >= jMin ? 0.6 : 0;
      }
      score += fit * 20;
    }

    return { id: c.id, fullName: c.full_name, score: Number(score.toFixed(1)) };
  }

  const scored = candidates.map(calcScore).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  res.json(scored);
});

// Basic tag-based matching: overlap count
router.get('/:id/match-candidates', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  const jobTags = JSON.parse(job.tags || '[]');
  const result = db.prepare('SELECT id, full_name, tags, skills, salary_min, salary_max, seniority FROM candidates').all();
  const candidates = Array.isArray(result) ? result : [];

  function calcScore(c) {
    const cTags = JSON.parse(c.tags || '[]');
    const skills = JSON.parse(c.skills || '{}');
    const explanation = [];
    let score = 0;

    // Tag overlap (weight 50)
    const overlap = cTags.filter(t => jobTags.includes(t));
    const tagComponent = Math.min(overlap.length, 5) / 5 * 50;
    if (overlap.length) explanation.push(`Tag overlap: ${overlap.join(', ')} (+${tagComponent.toFixed(1)})`);
    score += tagComponent;

    // Skills alignment (weight 30) - map jobTags to skill keys
    const wanted = ['communications','campaigns','policy','publicAffairs'].filter(k => jobTags.some(t => t.toLowerCase().includes(k.replace('publicAffairs','public_affairs').replace('campaigns','campaigns')) || t.toLowerCase().includes(k)));
    if (wanted.length) {
      const vals = wanted.map(k => Number(skills[k] || 0));
      const avg = vals.length ? vals.reduce((a,b)=>a+b,0) / (vals.length * 5) : 0; // 0..1
      const skillComponent = avg * 30;
      score += skillComponent;
      explanation.push(`Skills ${wanted.join(', ')} avg ${(avg*5).toFixed(1)}/5 (+${skillComponent.toFixed(1)})`);
    }

    // Salary fit (weight 20)
    const jMin = Number(job.salary_min ?? 0), jMax = Number(job.salary_max ?? 0);
    const cMin = Number(c.salary_min ?? 0), cMax = Number(c.salary_max ?? 0);
    if (jMin || jMax) {
      let fit = 0;
      if (cMin && cMax && jMin && jMax) {
        const overlapMin = Math.max(jMin, cMin);
        const overlapMax = Math.min(jMax, cMax);
        const range = Math.max(1, (jMax - jMin));
        const overlapAmt = Math.max(0, overlapMax - overlapMin);
        fit = overlapAmt / range; // 0..1
      } else if (cMin && jMax) {
        fit = cMin <= jMax ? 0.6 : 0;
      } else if (cMax && jMin) {
        fit = cMax >= jMin ? 0.6 : 0;
      }
      const salComponent = fit * 20;
      if (fit > 0) explanation.push(`Salary fit ${(fit*100).toFixed(0)}% (+${salComponent.toFixed(1)})`);
      score += salComponent;
    }

    return { id: c.id, fullName: c.full_name, score: Number(score.toFixed(1)), explanation, overlap };
  }

  const scored = candidates.map(calcScore).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 50);
  res.json(scored);
});

export default router;



