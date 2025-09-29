import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';
import { query, queryOne, queryAll, execute, generateId, getCurrentTimestamp, parseJsonFields, formatJsonFields } from '../db-utils.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const id = generateId() || nanoid();
    const now = getCurrentTimestamp();
    const { clientId, title, salaryMin, salaryMax, tags = [], status = 'new', source } = req.body || {};
    if (!clientId || !title) return res.status(400).json({ error: 'clientId and title required' });
    
    // Get the first stage ID for new opportunities
    const firstStage = await queryOne('SELECT id FROM pipeline_stages WHERE is_first = 1 ORDER BY position ASC LIMIT 1');
    const defaultStatus = firstStage ? firstStage.id : 'new';

    // Format data for database storage
    const jobData = {
      id,
      client_id: clientId,
      title,
      salary_min: salaryMin ?? null,
      salary_max: salaryMax ?? null,
      tags: tags,
      status: status === 'new' ? defaultStatus : status,
      source: source || null,
      created_at: now,
      updated_at: now
    };

    const formattedData = formatJsonFields(jobData, ['tags']);

    // Insert job
    await execute(`
      INSERT INTO jobs (id, client_id, title, salary_min, salary_max, tags, status, source, created_at, updated_at)
      VALUES (@id, @client_id, @title, @salary_min, @salary_max, @tags, @status, @source, @created_at, @updated_at)
    `, formattedData);

    // Get client name for event
    const client = await queryOne('SELECT name FROM clients WHERE id = @clientId', { clientId });
    const clientName = client?.name || 'Unknown Client';

    // Create job:new event
    const eventId = generateId() || nanoid();
    await execute(`
      INSERT INTO events (id, type, title, summary, job_id, client_id, priority, source, created_at)
      VALUES (@id, @type, @title, @summary, @job_id, @client_id, @priority, @source, @created_at)
    `, {
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
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Job ingest endpoint (internal)
router.post('/ingest', async (req, res) => {
  try {
    const id = generateId() || nanoid();
    const now = getCurrentTimestamp();
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
    const firstStage = await queryOne('SELECT id FROM pipeline_stages WHERE is_first = 1 ORDER BY position ASC LIMIT 1');
    const defaultStatus = firstStage ? firstStage.id : 'new';

    // Format data for database storage
    const jobData = {
      id,
      client_id: clientId,
      title,
      salary_min: salaryMin ?? null,
      salary_max: salaryMax ?? null,
      tags: tags,
      status: defaultStatus, // Always start in first stage
      source,
      created_at: now,
      updated_at: now
    };

    const formattedData = formatJsonFields(jobData, ['tags']);

    // Insert job
    await execute(`
      INSERT INTO jobs (id, client_id, title, salary_min, salary_max, tags, status, source, created_at, updated_at)
      VALUES (@id, @client_id, @title, @salary_min, @salary_max, @tags, @status, @source, @created_at, @updated_at)
    `, formattedData);

    // Get client name for event
    const client = await queryOne('SELECT name FROM clients WHERE id = @clientId', { clientId });
    const displayClientName = clientName || client?.name || 'Unknown Client';

    // Create job:new event
    const eventId = generateId() || nanoid();
    await execute(`
      INSERT INTO events (id, type, title, summary, job_id, client_id, priority, source, created_at)
      VALUES (@id, @type, @title, @summary, @job_id, @client_id, @priority, @source, @created_at)
    `, {
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
  } catch (error) {
    console.error('Error ingesting job:', error);
    res.status(500).json({ error: 'Failed to ingest job' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { search, status, client_id, page = 1, limit = 50 } = req.query;

    let sql = `SELECT j.*, c.name as client_name, c.website as client_website 
               FROM jobs j 
               LEFT JOIN clients c ON j.client_id = c.id`;
    const conditions = [];
    const params = {};
    
    if (search) {
      conditions.push(`(j.title LIKE @search OR j.source LIKE @search)`);
      params.search = `%${search}%`;
    }
    
    if (status) {
      conditions.push(`j.status = @status`);
      params.status = status;
    }
    
    if (client_id) {
      conditions.push(`j.client_id = @client_id`);
      params.client_id = client_id;
    }
    
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    
    // Get total count
    const countSql = sql.replace('SELECT j.*, c.name as client_name, c.website as client_website', 'SELECT COUNT(*) as count');
    const countResult = await queryOne(countSql, params);
    const total = countResult ? countResult.count : 0;
    
    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' ORDER BY j.updated_at DESC LIMIT @limit OFFSET @offset';
    params.limit = parseInt(limit);
    params.offset = offset;

    const jobs = await queryAll(sql, params);
    
    // Ensure jobs is always an array before filtering
    const jobsArray = Array.isArray(jobs) ? jobs : [];
    
    // Parse JSON fields and format response
    const parsedJobs = jobsArray.filter(job => job !== null).map(job => {
      const parsedJob = parseJsonFields(job, ['tags']);
      return {
        id: parsedJob.id,
        client_id: parsedJob.client_id,
        title: parsedJob.title,
        salary_min: parsedJob.salary_min,
        salary_max: parsedJob.salary_max,
        tags: parsedJob.tags,
        status: parsedJob.status,
        source: parsedJob.source,
        created_at: parsedJob.created_at,
        updated_at: parsedJob.updated_at,
        client: parsedJob.client_name ? {
          id: parsedJob.client_id,
          name: parsedJob.client_name,
          website: parsedJob.client_website
        } : null
      };
    });

    res.json({
      jobs: parsedJobs,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await queryOne('SELECT * FROM jobs WHERE id = @id', { id });
    if (!job) return res.status(404).json({ error: 'Not found' });
    
    const now = getCurrentTimestamp();
    const { title, salaryMin, salaryMax, tags, status, source } = req.body || {};
    
    // Format data for database storage
    const updateData = {
      title: title ?? job.title,
      salary_min: salaryMin !== undefined ? salaryMin : job.salary_min,
      salary_max: salaryMax !== undefined ? salaryMax : job.salary_max,
      tags: tags ? tags : job.tags,
      status: status ?? job.status,
      source: source ?? job.source,
      updated_at: now
    };

    const formattedData = formatJsonFields(updateData, ['tags']);

    await execute(`
      UPDATE jobs SET
        title = @title,
        salary_min = @salary_min,
        salary_max = @salary_max,
        tags = @tags,
        status = @status,
        source = @source,
        updated_at = @updated_at
      WHERE id = @id
    `, {
      ...formattedData,
      id: id
    });
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// Assign job to user
router.patch('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;
    
    if (!assignedTo) {
      return res.status(400).json({ error: 'assignedTo is required' });
    }

    const job = await queryOne('SELECT * FROM jobs WHERE id = @id', { id });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const now = getCurrentTimestamp();
    
    // Update job assignment
    await execute('UPDATE jobs SET updated_at = @updated_at WHERE id = @id', { 
      id, 
      updated_at: now 
    });

    // Create assignment event
    const eventId = generateId() || nanoid();
    await execute(`
      INSERT INTO events (id, type, title, summary, job_id, client_id, assigned_to, created_at)
      VALUES (@id, @type, @title, @summary, @job_id, @client_id, @assigned_to, @created_at)
    `, {
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
  } catch (error) {
    console.error('Error assigning job:', error);
    res.status(500).json({ error: 'Failed to assign job' });
  }
});

// Get job by ID with client details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await queryOne(`
      SELECT j.*, c.name as client_name, c.website as client_website 
      FROM jobs j 
      LEFT JOIN clients c ON j.client_id = c.id 
      WHERE j.id = @id
    `, { id });
    
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    const parsedJob = parseJsonFields(job, ['tags']);
    
    const response = {
      id: parsedJob.id,
      client_id: parsedJob.client_id,
      title: parsedJob.title,
      salary_min: parsedJob.salary_min,
      salary_max: parsedJob.salary_max,
      tags: parsedJob.tags,
      status: parsedJob.status,
      source: parsedJob.source,
      created_at: parsedJob.created_at,
      updated_at: parsedJob.updated_at,
      client: parsedJob.client_name ? {
        id: parsedJob.client_id,
        name: parsedJob.client_name,
        website: parsedJob.client_website
      } : null
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Get matches for a specific job
router.get('/:id/matches', async (req, res) => {
  try {
    const { id } = req.params;
    const matches = await queryAll(`
      SELECT m.id, m.candidate_id, m.score, m.stage, m.notes, m.created_at, m.updated_at,
             c.full_name, c.current_title, c.current_employer, c.salary_min, c.salary_max, c.tags, c.skills
      FROM matches m
      JOIN candidates c ON c.id = m.candidate_id
      WHERE m.job_id = @id
      ORDER BY m.score DESC, m.updated_at DESC
    `, { id });
    
    const parsedMatches = matches.map(match => {
      const parsedMatch = parseJsonFields(match, ['tags', 'skills']);
      return {
        id: parsedMatch.id,
        candidate_id: parsedMatch.candidate_id,
        score: parsedMatch.score,
        stage: parsedMatch.stage,
        notes: parsedMatch.notes,
        created_at: parsedMatch.created_at,
        updated_at: parsedMatch.updated_at,
        candidate: {
          id: parsedMatch.candidate_id,
          full_name: parsedMatch.full_name,
          current_title: parsedMatch.current_title,
          current_employer: parsedMatch.current_employer,
          salary_min: parsedMatch.salary_min,
          salary_max: parsedMatch.salary_max,
          tags: parsedMatch.tags,
          skills: parsedMatch.skills
        }
      };
    });
    
    res.json({ matches: parsedMatches });
  } catch (error) {
    console.error('Error fetching job matches:', error);
    res.status(500).json({ error: 'Failed to fetch job matches' });
  }
});

// Get open roles (jobs in non-final stages)
router.get('/open', async (req, res) => {
  try {
    const { assignedTo = 'all', since, limit = 50 } = req.query;

    // Get final stages (rejected, placed)
    const finalStages = await queryAll(`
      SELECT id FROM pipeline_stages 
      WHERE name IN ('Rejected', 'Placed') OR name LIKE '%rejected%' OR name LIKE '%placed%'
    `);
    const finalStageIds = finalStages.map(s => s.id);

    let sql = `
      SELECT j.*, c.name as client_name, c.logo as client_logo,
             ps.name as stage_name, ps.color as stage_color
      FROM jobs j
      LEFT JOIN clients c ON j.client_id = c.id
      LEFT JOIN pipeline_stages ps ON j.status = ps.id
      WHERE j.status NOT IN (${finalStageIds.map((_, index) => `@finalStage${index}`).join(',')})
    `;
    
    const params = {};
    finalStageIds.forEach((id, index) => {
      params[`finalStage${index}`] = id;
    });

    // Filter by assignment (placeholder for now)
    if (assignedTo === 'me') {
      // In real implementation, filter by assigned user
    }

    // Filter by time
    if (since) {
      sql += ' AND j.created_at > @since';
      params.since = since;
    }

    sql += ' ORDER BY j.created_at DESC LIMIT @limit';
    params.limit = parseInt(limit);

    const jobs = await queryAll(sql, params);
    const parsedJobs = jobs.map(job => {
      const parsedJob = parseJsonFields(job, ['tags']);
      return {
        id: parsedJob.id,
        client_id: parsedJob.client_id,
        title: parsedJob.title,
        salary_min: parsedJob.salary_min,
        salary_max: parsedJob.salary_max,
        tags: parsedJob.tags,
        status: parsedJob.status,
        source: parsedJob.source,
        created_at: parsedJob.created_at,
        updated_at: parsedJob.updated_at,
        client: {
          id: parsedJob.client_id,
          name: parsedJob.client_name,
          logo: parsedJob.client_logo
        },
        stage: {
          id: parsedJob.status,
          name: parsedJob.stage_name,
          color: parsedJob.stage_color
        }
      };
    });

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



