import { getDb } from './db.js';
import { nanoid } from 'nanoid';

export function seedSampleData() {
  const db = getDb();
  const now = new Date().toISOString();

  // Check if data already exists
  try {
    const existingCandidates = db.prepare('SELECT COUNT(*) as count FROM candidates').get();
    if (existingCandidates.count > 0) {
      console.log('Sample data already exists, skipping seed');
      return;
    }
  } catch (error) {
    console.log('Tables not ready yet, skipping seed');
    return;
  }

  console.log('Seeding sample data...');

  // Create sample clients
  const client1Id = nanoid();
  const client2Id = nanoid();
  const client3Id = nanoid();

  db.prepare(`
    INSERT INTO clients (id, name, website, careers_url, tags, contacts, created_at, updated_at)
    VALUES (@id, @name, @website, @careers_url, @tags, @contacts, @created_at, @updated_at)
  `).run({
    id: client1Id,
    name: 'Green Future Campaigns',
    website: 'https://greenfuture.org',
    careers_url: 'https://greenfuture.org/careers',
    tags: JSON.stringify(['environment', 'nonprofit', 'campaigns']),
    contacts: JSON.stringify([
      { name: 'Sarah Johnson', email: 'sarah@greenfuture.org', role: 'HR Director' },
      { name: 'Mike Chen', email: 'mike@greenfuture.org', role: 'Campaign Manager' }
    ]),
    created_at: now,
    updated_at: now
  });

  db.prepare(`
    INSERT INTO clients (id, name, website, careers_url, tags, contacts, created_at, updated_at)
    VALUES (@id, @name, @website, @careers_url, @tags, @contacts, @created_at, @updated_at)
  `).run({
    id: client2Id,
    name: 'TechStart Solutions',
    website: 'https://techstart.com',
    careers_url: 'https://techstart.com/jobs',
    tags: JSON.stringify(['tech', 'startup', 'digital']),
    contacts: JSON.stringify([
      { name: 'Alex Rodriguez', email: 'alex@techstart.com', role: 'CTO' }
    ]),
    created_at: now,
    updated_at: now
  });

  db.prepare(`
    INSERT INTO clients (id, name, website, careers_url, tags, contacts, created_at, updated_at)
    VALUES (@id, @name, @website, @careers_url, @tags, @contacts, @created_at, @updated_at)
  `).run({
    id: client3Id,
    name: 'Policy Institute',
    website: 'https://policyinstitute.org',
    careers_url: 'https://policyinstitute.org/careers',
    tags: JSON.stringify(['policy', 'research', 'think-tank']),
    contacts: JSON.stringify([
      { name: 'Dr. Emma Wilson', email: 'emma@policyinstitute.org', role: 'Research Director' }
    ]),
    created_at: now,
    updated_at: now
  });

  // Create sample jobs
  const job1Id = nanoid();
  const job2Id = nanoid();
  const job3Id = nanoid();

  db.prepare(`
    INSERT INTO jobs (id, client_id, title, salary_min, salary_max, tags, status, source, created_at, updated_at)
    VALUES (@id, @client_id, @title, @salary_min, @salary_max, @tags, @status, @source, @created_at, @updated_at)
  `).run({
    id: job1Id,
    client_id: client1Id,
    title: 'Digital Campaign Manager',
    salary_min: 35000,
    salary_max: 45000,
    tags: JSON.stringify(['digital', 'campaigns', 'marketing']),
    status: 'active',
    source: 'LinkedIn',
    created_at: now,
    updated_at: now
  });

  db.prepare(`
    INSERT INTO jobs (id, client_id, title, salary_min, salary_max, tags, status, source, created_at, updated_at)
    VALUES (@id, @client_id, @title, @salary_min, @salary_max, @tags, @status, @source, @created_at, @updated_at)
  `).run({
    id: job2Id,
    client_id: client2Id,
    title: 'Senior Developer',
    salary_min: 60000,
    salary_max: 80000,
    tags: JSON.stringify(['tech', 'development', 'senior']),
    status: 'active',
    source: 'Direct',
    created_at: now,
    updated_at: now
  });

  db.prepare(`
    INSERT INTO jobs (id, client_id, title, salary_min, salary_max, tags, status, source, created_at, updated_at)
    VALUES (@id, @client_id, @title, @salary_min, @salary_max, @tags, @status, @source, @created_at, @updated_at)
  `).run({
    id: job3Id,
    client_id: client3Id,
    title: 'Policy Research Analyst',
    salary_min: 28000,
    salary_max: 35000,
    tags: JSON.stringify(['policy', 'research', 'analysis']),
    status: 'new',
    source: 'Indeed',
    created_at: now,
    updated_at: now
  });

  // Create sample candidates
  const candidate1Id = nanoid();
  const candidate2Id = nanoid();
  const candidate3Id = nanoid();

  db.prepare(`
    INSERT INTO candidates (
      id, full_name, email, phone, current_title, current_employer,
      salary_min, salary_max, seniority, tags, notes, skills,
      cv_original_path, cv_light, parsed_raw, parse_status, needs_review, created_by, created_at, updated_at
    ) VALUES (
      @id, @full_name, @email, @phone, @current_title, @current_employer,
      @salary_min, @salary_max, @seniority, @tags, @notes, @skills,
      @cv_original_path, @cv_light, @parsed_raw, @parse_status, @needs_review, @created_by, @created_at, @updated_at
    )
  `).run({
    id: candidate1Id,
    full_name: 'Jessica Martinez',
    email: 'jessica.martinez@email.com',
    phone: '+44 7700 900123',
    current_title: 'Digital Marketing Specialist',
    current_employer: 'Creative Agency Ltd',
    salary_min: 32000,
    salary_max: 40000,
    seniority: 'mid',
    tags: JSON.stringify(['digital', 'marketing', 'campaigns']),
    notes: 'Experienced in digital campaigns and social media management',
    skills: JSON.stringify({
      communications: 4,
      campaigns: 5,
      policy: 2,
      publicAffairs: 3
    }),
    cv_original_path: null,
    cv_light: null,
    parsed_raw: null,
    parse_status: 'parsed',
    needs_review: 0,
    created_by: 'system',
    created_at: now,
    updated_at: now
  });

  db.prepare(`
    INSERT INTO candidates (
      id, full_name, email, phone, current_title, current_employer,
      salary_min, salary_max, seniority, tags, notes, skills,
      cv_original_path, cv_light, parsed_raw, parse_status, needs_review, created_by, created_at, updated_at
    ) VALUES (
      @id, @full_name, @email, @phone, @current_title, @current_employer,
      @salary_min, @salary_max, @seniority, @tags, @notes, @skills,
      @cv_original_path, @cv_light, @parsed_raw, @parse_status, @needs_review, @created_by, @created_at, @updated_at
    )
  `).run({
    id: candidate2Id,
    full_name: 'David Thompson',
    email: 'david.thompson@email.com',
    phone: '+44 7700 900456',
    current_title: 'Software Engineer',
    current_employer: 'TechCorp',
    salary_min: 55000,
    salary_max: 70000,
    seniority: 'senior',
    tags: JSON.stringify(['tech', 'development', 'senior']),
    notes: 'Full-stack developer with 5+ years experience',
    skills: JSON.stringify({
      communications: 3,
      campaigns: 2,
      policy: 1,
      publicAffairs: 2
    }),
    cv_original_path: null,
    cv_light: null,
    parsed_raw: null,
    parse_status: 'parsed',
    needs_review: 0,
    created_by: 'system',
    created_at: now,
    updated_at: now
  });

  db.prepare(`
    INSERT INTO candidates (
      id, full_name, email, phone, current_title, current_employer,
      salary_min, salary_max, seniority, tags, notes, skills,
      cv_original_path, cv_light, parsed_raw, parse_status, needs_review, created_by, created_at, updated_at
    ) VALUES (
      @id, @full_name, @email, @phone, @current_title, @current_employer,
      @salary_min, @salary_max, @seniority, @tags, @notes, @skills,
      @cv_original_path, @cv_light, @parsed_raw, @parse_status, @needs_review, @created_by, @created_at, @updated_at
    )
  `).run({
    id: candidate3Id,
    full_name: 'Sarah Williams',
    email: 'sarah.williams@email.com',
    phone: '+44 7700 900789',
    current_title: 'Policy Researcher',
    current_employer: 'Think Tank UK',
    salary_min: 30000,
    salary_max: 38000,
    seniority: 'mid',
    tags: JSON.stringify(['policy', 'research', 'analysis']),
    notes: 'Specialized in environmental policy research',
    skills: JSON.stringify({
      communications: 4,
      campaigns: 3,
      policy: 5,
      publicAffairs: 4
    }),
    cv_original_path: null,
    cv_light: null,
    parsed_raw: null,
    parse_status: 'parsed',
    needs_review: 0,
    created_by: 'system',
    created_at: now,
    updated_at: now
  });

  // Create sample matches
  const match1Id = nanoid();
  const match2Id = nanoid();

  db.prepare(`
    INSERT INTO matches (id, job_id, candidate_id, score, stage, notes, created_at, updated_at)
    VALUES (@id, @job_id, @candidate_id, @score, @stage, @notes, @created_at, @updated_at)
  `).run({
    id: match1Id,
    job_id: job1Id,
    candidate_id: candidate1Id,
    score: 85,
    stage: 'new',
    notes: 'Strong match for digital campaign role',
    created_at: now,
    updated_at: now
  });

  db.prepare(`
    INSERT INTO matches (id, job_id, candidate_id, score, stage, notes, created_at, updated_at)
    VALUES (@id, @job_id, @candidate_id, @score, @stage, @notes, @created_at, @updated_at)
  `).run({
    id: match2Id,
    job_id: job3Id,
    candidate_id: candidate3Id,
    score: 92,
    stage: 'reviewed',
    notes: 'Excellent policy research background',
    created_at: now,
    updated_at: now
  });

  console.log('Sample data seeded successfully!');
}
