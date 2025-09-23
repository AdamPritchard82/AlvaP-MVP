// Debug server to test main server imports step by step
console.log('=== DEBUG SERVER STARTING ===');

const PORT = process.env.PORT || 3001;

async function testImports() {
  try {
    console.log('Step 1: Basic dependencies...');
    await import('dotenv/config');
    const express = (await import('express')).default;
    const cors = (await import('cors')).default;
    const helmet = (await import('helmet')).default;
    const cookieParser = (await import('cookie-parser')).default;
    const { join } = await import('node:path');
    console.log('✅ Basic dependencies loaded');

    console.log('Step 2: Database modules...');
    const { initDatabase, getDb } = await import('./src/db.js');
    const { requireAuth, seedAdminUser, signToken } = await import('./src/auth.js');
    console.log('✅ Database modules loaded');

    console.log('Step 3: Creating Express app...');
    const app = express();
    
    app.use(helmet());
    app.use(cors({ 
      origin: ['http://localhost:3000', 'http://localhost:5173'], 
      credentials: true 
    }));
    app.use(express.json({ limit: '10mb' }));
    app.use(cookieParser());

    console.log('Step 4: Adding basic routes...');
    app.get('/health', (req, res) => {
      res.json({ ok: true, timestamp: new Date().toISOString() });
    });

    console.log('Step 5: Testing database...');
    const dataDir = join(process.cwd(), 'data');
    console.log('Data directory:', dataDir);
    
    // Initialize database
    initDatabase();
    console.log('✅ Database initialized');

    console.log('Step 6: Starting server...');
    app.listen(PORT, '0.0.0.0', () => {
      console.log('=== DEBUG SERVER STARTED SUCCESSFULLY ===');
      console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
      console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
    });

  } catch (error) {
    console.error('❌ Error in debug server:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testImports();
