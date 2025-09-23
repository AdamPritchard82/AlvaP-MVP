import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// Mock data
let candidates = [
  {
    id: '1',
    full_name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '+44 7700 900123',
    current_title: 'Communications Manager',
    current_employer: 'ABC Corp',
    salary_min: 45000,
    salary_max: 55000,
    seniority: 'Mid-level',
    tags: ['communications', 'campaigns'],
    notes: 'Strong background in digital marketing',
    skills: { communications: 8, campaigns: 7, policy: 5, publicAffairs: 6 },
    parse_status: 'parsed',
    needs_review: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '2',
    full_name: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    phone: '+44 7700 900456',
    current_title: 'Policy Advisor',
    current_employer: 'Government Agency',
    salary_min: 40000,
    salary_max: 50000,
    seniority: 'Senior',
    tags: ['policy', 'publicAffairs'],
    notes: 'Expert in healthcare policy',
    skills: { communications: 6, campaigns: 5, policy: 9, publicAffairs: 8 },
    parse_status: 'parsed',
    needs_review: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

let jobs = [
  {
    id: '1',
    client_id: '1',
    title: 'Senior Communications Manager',
    salary_min: 50000,
    salary_max: 60000,
    tags: ['communications', 'leadership'],
    status: 'active',
    source: 'Direct posting',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    client: {
      id: '1',
      name: 'Tech Startup Ltd',
      website: 'https://techstartup.com',
      careers_url: 'https://techstartup.com/careers',
      tags: ['technology', 'startup'],
      contacts: [
        { name: 'Jane Doe', email: 'jane@techstartup.com', role: 'HR Manager' }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }
];

let clients = [
  {
    id: '1',
    name: 'Tech Startup Ltd',
    website: 'https://techstartup.com',
    careers_url: 'https://techstartup.com/careers',
    tags: ['technology', 'startup'],
    contacts: [
      { name: 'Jane Doe', email: 'jane@techstartup.com', role: 'HR Manager' }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

let matches = [
  {
    id: '1',
    job_id: '1',
    candidate_id: '1',
    score: 85,
    stage: 'new',
    notes: 'Strong match for communications role',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    job: jobs[0],
    candidate: candidates[0]
  }
];

// Health endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Auth endpoint
app.post('/api/auth/login', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });
  
  // For demo purposes, accept any email
  const token = jwt.sign(
    { userId: '1', email, name: 'Consultant', role: 'consultant' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  return res.json({ token });
});

// Middleware to verify JWT
const requireAuth = (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

// Dashboard stats
app.get('/api/dashboard/stats', requireAuth, (req, res) => {
  res.json({
    totalCandidates: candidates.length,
    totalJobs: jobs.length,
    totalMatches: matches.length,
    activeJobs: jobs.filter(j => j.status === 'active').length,
    newMatches: matches.filter(m => m.stage === 'new').length
  });
});

// Candidates endpoints
app.get('/api/candidates', requireAuth, (req, res) => {
  const { search, tags, page = 1, limit = 50 } = req.query;
  let filteredCandidates = [...candidates];
  
  if (search) {
    const searchLower = search.toLowerCase();
    filteredCandidates = filteredCandidates.filter(c => 
      c.full_name.toLowerCase().includes(searchLower) ||
      c.current_title?.toLowerCase().includes(searchLower) ||
      c.current_employer?.toLowerCase().includes(searchLower)
    );
  }
  
  if (tags) {
    const tagList = tags.split(',');
    filteredCandidates = filteredCandidates.filter(c => 
      tagList.some(tag => c.tags.includes(tag))
    );
  }
  
  const start = (page - 1) * limit;
  const end = start + parseInt(limit);
  
  res.json({
    candidates: filteredCandidates.slice(start, end),
    total: filteredCandidates.length,
    page: parseInt(page),
    limit: parseInt(limit)
  });
});

app.get('/api/candidates/:id', requireAuth, (req, res) => {
  const candidate = candidates.find(c => c.id === req.params.id);
  if (!candidate) return res.status(404).json({ error: 'Not found' });
  res.json(candidate);
});

// Jobs endpoints
app.get('/api/jobs', requireAuth, (req, res) => {
  const { search, status, client_id, page = 1, limit = 50 } = req.query;
  let filteredJobs = [...jobs];
  
  if (search) {
    const searchLower = search.toLowerCase();
    filteredJobs = filteredJobs.filter(j => 
      j.title.toLowerCase().includes(searchLower) ||
      j.client?.name.toLowerCase().includes(searchLower)
    );
  }
  
  if (status) {
    filteredJobs = filteredJobs.filter(j => j.status === status);
  }
  
  if (client_id) {
    filteredJobs = filteredJobs.filter(j => j.client_id === client_id);
  }
  
  const start = (page - 1) * limit;
  const end = start + parseInt(limit);
  
  res.json({
    jobs: filteredJobs.slice(start, end),
    total: filteredJobs.length,
    page: parseInt(page),
    limit: parseInt(limit)
  });
});

// Clients endpoints
app.get('/api/clients', requireAuth, (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  let filteredClients = [...clients];
  
  if (search) {
    const searchLower = search.toLowerCase();
    filteredClients = filteredClients.filter(c => 
      c.name.toLowerCase().includes(searchLower) ||
      c.website?.toLowerCase().includes(searchLower)
    );
  }
  
  const start = (page - 1) * limit;
  const end = start + parseInt(limit);
  
  res.json({
    clients: filteredClients.slice(start, end),
    total: filteredClients.length,
    page: parseInt(page),
    limit: parseInt(limit)
  });
});

// Matches endpoints
app.get('/api/matches', requireAuth, (req, res) => {
  const { job_id, candidate_id, stage, page = 1, limit = 50 } = req.query;
  let filteredMatches = [...matches];
  
  if (job_id) {
    filteredMatches = filteredMatches.filter(m => m.job_id === job_id);
  }
  
  if (candidate_id) {
    filteredMatches = filteredMatches.filter(m => m.candidate_id === candidate_id);
  }
  
  if (stage) {
    filteredMatches = filteredMatches.filter(m => m.stage === stage);
  }
  
  const start = (page - 1) * limit;
  const end = start + parseInt(limit);
  
  res.json({
    matches: filteredMatches.slice(start, end),
    total: filteredMatches.length,
    page: parseInt(page),
    limit: parseInt(limit)
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log('Using mock data for testing');
});







