// Add error handling at the top
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('Loading dependencies...');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { join } = require('node:path');
console.log('Basic dependencies loaded');

console.log('Loading database modules...');
const { initDatabase, getDb } = require('./db-commonjs.js');
const { requireAuth, seedAdminUser, signToken } = require('./auth.js');
console.log('Database modules loaded');

console.log('Loading route modules...');
const candidatesRouter = require('./routes/candidates-new.js');
const dashboardRouter = require('./routes/dashboard.js');
const clientsRouter = require('./routes/clients.js');
const jobsRouter = require('./routes/jobs.js');
const matchesRouter = require('./routes/matches.js');
const pipelineRouter = require('./routes/pipeline.js');
const pipelineStagesRouter = require('./routes/pipeline-stages.js');
const gdprRouter = require('./routes/gdpr.js');
const emailRouter = require('./routes/email.js');
const emailsRouter = require('./routes/emails.js');
const monitoringRouter = require('./routes/monitoring.js');
const templatesRouter = require('./routes/templates.js');
const outreachRouter = require('./routes/outreach.js');
const inboundRouter = require('./routes/inbound.js');
const oauthRouter = require('./routes/oauth.js');
const alertsRouter = require('./routes/alerts.js');
const licensingRouter = require('./routes/licensing.js');
const eventsRouter = require('./routes/events.js');
// import updatesRouter from './routes/updates.js';
console.log('Route modules loaded');

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
    console.log(`Working Directory: ${process.cwd()}`);
    console.log(`DB File: ${dbFile}`);
    console.log(`CORS Origins: http://localhost:3000, http://localhost:5173`);
    
    // Initialize database
    console.log('Initializing database...');
    initDatabase();
    console.log('Database initialized successfully');
    
    // Wait a moment for tables to be created
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Seeding admin user...');
    seedAdminUser();
    console.log('Admin user seeded');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log('=== BACKEND STARTED SUCCESSFULLY ===');
      console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
      console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
      console.log(`✅ CV Parse: http://0.0.0.0:${PORT}/api/candidates/parse-cv`);
      console.log('=====================================');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('Error details:', error.stack);
    process.exit(1);
  }
}

startServer();


