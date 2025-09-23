import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { join } from 'node:path';
import { initDatabase, getDb } from './db.js';
import { requireAuth, seedAdminUser, signToken } from './auth.js';
import candidatesRouter from './routes/candidates-new.js';
import dashboardRouter from './routes/dashboard.js';
import clientsRouter from './routes/clients.js';
import jobsRouter from './routes/jobs.js';
import matchesRouter from './routes/matches.js';
import pipelineRouter from './routes/pipeline.js';
import pipelineStagesRouter from './routes/pipeline-stages.js';
import gdprRouter from './routes/gdpr.js';
import emailRouter from './routes/email.js';
import emailsRouter from './routes/emails.js';
import monitoringRouter from './routes/monitoring.js';
import templatesRouter from './routes/templates.js';
import outreachRouter from './routes/outreach.js';
import inboundRouter from './routes/inbound.js';
import oauthRouter from './routes/oauth.js';
import alertsRouter from './routes/alerts.js';
import licensingRouter from './routes/licensing.js';
import eventsRouter from './routes/events.js';
// import updatesRouter from './routes/updates.js';

const app = express();

app.use(helmet());
app.use(cors({ 
  origin: ['http://localhost:3000', 'http://localhost:5173'], 
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Health endpoint
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Manual digest trigger (secured)
app.post('/api/tasks/run-digest', requireAuth, async (_req, res) => {
  try {
    const { default: run } = await import('./tasks/runDigest.js');
    await run();
  } catch {
    // no-op, runDigest runs as standalone; we return accepted
  }
  res.status(202).json({ accepted: true });
});

// Routes
// Make CV parsing public (no auth required)
app.use('/api/candidates/parse-cv', candidatesRouter);
app.use('/api/candidates', requireAuth, candidatesRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/clients', requireAuth, clientsRouter);
app.use('/api/jobs', requireAuth, jobsRouter);
app.use('/api/matches', requireAuth, matchesRouter);
app.use('/api/pipeline', requireAuth, pipelineRouter);
app.use('/api/pipeline-stages', requireAuth, pipelineStagesRouter);
app.use('/api/gdpr', requireAuth, gdprRouter);
app.use('/api/email', requireAuth, emailRouter);
app.use('/api/emails', requireAuth, emailsRouter);
app.use('/api/monitoring', requireAuth, monitoringRouter);
app.use('/api/templates', requireAuth, templatesRouter);
app.use('/api/outreach', requireAuth, outreachRouter);
app.use('/api/inbound', requireAuth, inboundRouter);
app.use('/api/oauth', requireAuth, oauthRouter);
app.use('/api/alerts', requireAuth, alertsRouter);
app.use('/api/licensing', requireAuth, licensingRouter);
app.use('/api/events', requireAuth, eventsRouter);
// app.use('/api/updates', requireAuth, updatesRouter);

// Simple auth routes
app.post('/api/auth/login', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });
  const db = getDb();
  const user = db.prepare('SELECT id, email, name, role FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken({ userId: user.id, email: user.email, name: user.name, role: user.role });
  return res.json({ token });
});

const PORT = process.env.PORT || 3001;

// Initialize DB and start server
async function startServer() {
  try {
    const dataDir = join(process.cwd(), 'data');
    const dbFile = join(dataDir, 'app.db');
    
    console.log('=== DOOR 10 MVP BACKEND STARTING ===');
    console.log(`Port: ${PORT}`);
    console.log(`DB File: ${dbFile}`);
    console.log(`CORS Origins: http://localhost:3000, http://localhost:5173`);
    
    // Candidates router loaded via import
    
    initDatabase();
    // Wait a moment for tables to be created
    await new Promise(resolve => setTimeout(resolve, 1000));
    seedAdminUser();
    
    app.listen(PORT, () => {
      console.log('=== BACKEND STARTED SUCCESSFULLY ===');
      console.log(`✅ Server listening on http://localhost:${PORT}`);
      console.log(`✅ Health check: http://localhost:${PORT}/health`);
      console.log(`✅ CV Parse: http://localhost:${PORT}/api/candidates/parse-cv`);
      console.log('=====================================');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();


