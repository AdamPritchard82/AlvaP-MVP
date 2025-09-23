// Main server using CommonJS for Railway compatibility
console.log('=== MAIN SERVER STARTING ===');
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());

// Load environment variables
require('dotenv').config();

// Import dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

console.log('Basic dependencies loaded');

// Import our modules
const { initDatabase, getDb } = require('./src/db.js');
const { requireAuth, seedAdminUser, signToken } = require('./src/auth.js');

console.log('Database and auth modules loaded');

// Import routes
const candidatesRouter = require('./src/routes/candidates.js');
const dashboardRouter = require('./src/routes/dashboard.js');
const clientsRouter = require('./src/routes/clients.js');
const jobsRouter = require('./src/routes/jobs.js');
const matchesRouter = require('./src/routes/matches.js');
const pipelineRouter = require('./src/routes/pipeline.js');
const pipelineStagesRouter = require('./src/routes/pipeline-stages.js');
const gdprRouter = require('./src/routes/gdpr.js');
const emailRouter = require('./src/routes/email.js');
const emailsRouter = require('./src/routes/emails.js');
const monitoringRouter = require('./src/routes/monitoring.js');
const templatesRouter = require('./src/routes/templates.js');
const outreachRouter = require('./src/routes/outreach.js');
const inboundRouter = require('./src/routes/inbound.js');
const oauthRouter = require('./src/routes/oauth.js');
const alertsRouter = require('./src/routes/alerts.js');
const licensingRouter = require('./src/routes/licensing.js');
const eventsRouter = require('./src/routes/events.js');

console.log('All routes loaded');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({ 
  origin: ['http://localhost:3000', 'http://localhost:5173'], 
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

console.log('Middleware configured');

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/candidates', candidatesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/pipeline-stages', pipelineStagesRouter);
app.use('/api/gdpr', gdprRouter);
app.use('/api/email', emailRouter);
app.use('/api/emails', emailsRouter);
app.use('/api/monitoring', monitoringRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/outreach', outreachRouter);
app.use('/api/inbound', inboundRouter);
app.use('/api/oauth', oauthRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/licensing', licensingRouter);
app.use('/api/events', eventsRouter);

console.log('API routes configured');

// Initialize database and start server
async function startServer() {
  try {
    console.log('Initializing database...');
    initDatabase();
    console.log('Database initialized');
    
    // Wait a moment for tables to be created
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Seeding admin user...');
    seedAdminUser();
    console.log('Admin user seeded');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log('=== MAIN SERVER STARTED SUCCESSFULLY ===');
      console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
      console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
      console.log(`✅ CV Parse: http://0.0.0.0:${PORT}/api/candidates/parse-cv`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('Error details:', error.stack);
    process.exit(1);
  }
}

startServer();
