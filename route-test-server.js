// Test server to identify which route import is causing the issue
console.log('=== ROUTE TEST SERVER STARTING ===');

const PORT = process.env.PORT || 3001;

async function testRouteImports() {
  try {
    console.log('Step 1: Basic setup...');
    await import('dotenv/config');
    const express = (await import('express')).default;
    const cors = (await import('cors')).default;
    const helmet = (await import('helmet')).default;
    const cookieParser = (await import('cookie-parser')).default;
    const { join } = await import('node:path');
    
    const { initDatabase, getDb } = await import('./src/db.js');
    const { requireAuth, seedAdminUser, signToken } = await import('./src/auth.js');
    console.log('✅ Basic setup complete');

    console.log('Step 2: Testing route imports one by one...');
    
    // Test each route import individually
    const routes = [
      { name: 'candidates-new', path: './src/routes/candidates-new.js' },
      { name: 'dashboard', path: './src/routes/dashboard.js' },
      { name: 'clients', path: './src/routes/clients.js' },
      { name: 'jobs', path: './src/routes/jobs.js' },
      { name: 'matches', path: './src/routes/matches.js' },
      { name: 'pipeline', path: './src/routes/pipeline.js' },
      { name: 'pipeline-stages', path: './src/routes/pipeline-stages.js' },
      { name: 'gdpr', path: './src/routes/gdpr.js' },
      { name: 'email', path: './src/routes/email.js' },
      { name: 'emails', path: './src/routes/emails.js' },
      { name: 'monitoring', path: './src/routes/monitoring.js' },
      { name: 'templates', path: './src/routes/templates.js' },
      { name: 'outreach', path: './src/routes/outreach.js' },
      { name: 'inbound', path: './src/routes/inbound.js' },
      { name: 'oauth', path: './src/routes/oauth.js' },
      { name: 'alerts', path: './src/routes/alerts.js' },
      { name: 'licensing', path: './src/routes/licensing.js' },
      { name: 'events', path: './src/routes/events.js' }
    ];

    for (const route of routes) {
      try {
        console.log(`Testing ${route.name}...`);
        const router = await import(route.path);
        console.log(`✅ ${route.name} loaded successfully`);
      } catch (error) {
        console.error(`❌ ${route.name} FAILED:`, error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
      }
    }

    console.log('Step 3: Creating Express app...');
    const app = express();
    
    app.use(helmet());
    app.use(cors({ 
      origin: ['http://localhost:3000', 'http://localhost:5173'], 
      credentials: true 
    }));
    app.use(express.json({ limit: '10mb' }));
    app.use(cookieParser());

    app.get('/health', (req, res) => {
      res.json({ ok: true, timestamp: new Date().toISOString() });
    });

    console.log('Step 4: Initializing database...');
    initDatabase();
    console.log('✅ Database initialized');

    console.log('Step 5: Starting server...');
    app.listen(PORT, '0.0.0.0', () => {
      console.log('=== ROUTE TEST SERVER STARTED SUCCESSFULLY ===');
      console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
      console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
    });

  } catch (error) {
    console.error('❌ Error in route test server:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testRouteImports();
